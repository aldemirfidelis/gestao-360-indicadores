import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { WorkItemAggregationService } from './work-item-aggregation.service';
import { WorkflowApprovalService } from '../automations/services/workflow-approval.service';
import { ActionsService } from '../actions/actions.service';
import { WorkItemEventBus } from './work-item-event-bus';
import { MyDayTeamService } from './my-day-team.service';

const REFRESH_TTL_MS = 30_000;

export interface MyDayItemsQuery {
  tab?: string;
  itemType?: string;
  priority?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class MyDayService implements OnModuleInit {
  private readonly lastRefresh = new Map<string, number>();
  private readonly dirty = new Map<string, { companyId: string; userId: string }>();
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregation: WorkItemAggregationService,
    private readonly approvals: WorkflowApprovalService,
    private readonly actions: ActionsService,
    private readonly bus: WorkItemEventBus,
    private readonly team: MyDayTeamService,
  ) {}

  /** Assina o bus: quando um registro muda, agenda rebuild incremental do(s) usuario(s). */
  onModuleInit(): void {
    this.bus.onDirty((e) => {
      for (const userId of e.userIds) this.dirty.set(`${e.companyId}:${userId}`, { companyId: e.companyId, userId });
      if (!this.flushTimer) this.flushTimer = setTimeout(() => void this.flushDirty(), 1500);
    });
  }

  private async flushDirty(): Promise<void> {
    this.flushTimer = null;
    const batch = [...this.dirty.values()];
    this.dirty.clear();
    for (const { companyId, userId } of batch) {
      try {
        await this.aggregation.rebuildFor(companyId, userId);
        this.lastRefresh.set(`${companyId}:${userId}`, Date.now());
      } catch {
        // resiliencia: erro de um usuario nao impede os demais
      }
    }
  }

  private refreshKey(me: AuthPayload) {
    return `${me.companyId}:${me.sub}`;
  }

  /** Atualiza a fatia do usuario na projecao, respeitando um TTL curto. */
  async ensureFresh(me: AuthPayload, force = false): Promise<void> {
    const key = this.refreshKey(me);
    const last = this.lastRefresh.get(key) ?? 0;
    if (!force && Date.now() - last < REFRESH_TTL_MS) return;
    await this.aggregation.rebuildForUser(me);
    this.lastRefresh.set(key, Date.now());
  }

  async getOverview(me: AuthPayload) {
    await this.ensureFresh(me);
    const [summary, items, isManager] = await Promise.all([
      this.computeSummary(me),
      this.queryItems(me, { tab: 'priorities', pageSize: 25 }),
      this.team.isManager(me),
    ]);
    return { generatedAt: new Date().toISOString(), isManager, summary, items: items.rows, total: items.total };
  }

  async getSummary(me: AuthPayload) {
    await this.ensureFresh(me);
    return this.computeSummary(me);
  }

  async getItems(me: AuthPayload, query: MyDayItemsQuery) {
    await this.ensureFresh(me);
    return this.queryItems(me, query);
  }

  async getItem(me: AuthPayload, id: string) {
    const item = await this.prisma.workItemIndex.findFirst({
      where: { id, companyId: me.companyId, assignedUserId: me.sub },
    });
    if (!item) throw new NotFoundException('Item não encontrado');
    return item;
  }

  /** Executa uma acao rapida; acoes de servidor sao delegadas ao modulo de origem. */
  async executeAction(me: AuthPayload, id: string, dto: { action: string; justification?: string }) {
    const item = await this.getItem(me, id);
    const action = (dto.action ?? '').toLowerCase();

    if (item.itemType === 'APPROVAL' && ['approve', 'reject', 'changes'].includes(action)) {
      if ((action === 'reject' || action === 'changes') && !dto.justification?.trim()) {
        throw new BadRequestException('Justificativa obrigatória para reprovar ou solicitar ajustes.');
      }
      const decision = action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'CHANGES';
      await this.approvals.submitDecision(me.companyId, item.sourceEntityId, decision as any, dto.justification ?? '', me.sub);
      await this.ensureFresh(me, true);
      return { ok: true, message: 'Decisão registrada.' };
    }

    if (action === 'complete' && item.sourceEntityType === 'ACTION_PLAN') {
      await this.actions.changeStatus(item.sourceEntityId, 'DONE' as any, me.sub);
      await this.ensureFresh(me, true);
      return { ok: true, message: 'Tarefa concluída.' };
    }

    if (action === 'markread' && item.sourceEntityType === 'NOTIFICATION') {
      await this.prisma.notification.updateMany({ where: { id: item.sourceEntityId, userId: me.sub }, data: { readAt: new Date() } });
      await this.ensureFresh(me, true);
      return { ok: true, message: 'Marcada como lida.' };
    }

    // Acoes nao tratadas no servidor: encaminha para o modulo de origem (mantendo contexto).
    const actions = (item.availableActions as Array<{ key: string; href?: string }> | null) ?? [];
    const match = actions.find((a) => a.key === action) ?? actions.find((a) => a.key === 'open');
    if (match?.href) return { ok: true, redirect: match.href };
    return { ok: true, redirect: null, message: 'Abra o registro de origem para concluir esta ação.' };
  }

  // ---------- leitura/projecao ----------

  private async computeSummary(me: AuthPayload) {
    const base = { companyId: me.companyId, assignedUserId: me.sub };
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);

    const [pending, overdue, dueToday, approvals, risksCritical, documentsToReview, meetingsToday, unreadMessages, indicatorsOffTarget] =
      await Promise.all([
        this.prisma.workItemIndex.count({ where: { ...base, status: { notIn: ['DONE', 'ARCHIVED'] } } }),
        this.prisma.workItemIndex.count({ where: { ...base, overdueDays: { gt: 0 } } }),
        this.prisma.workItemIndex.count({ where: { ...base, dueAt: { gte: dayStart, lte: dayEnd } } }),
        this.prisma.workItemIndex.count({ where: { ...base, itemType: 'APPROVAL' } }),
        this.prisma.workItemIndex.count({ where: { ...base, itemType: 'RISK_CRITICAL' } }),
        this.prisma.workItemIndex.count({ where: { ...base, itemType: 'DOCUMENT_REVIEW' } }),
        this.prisma.workItemIndex.count({ where: { ...base, itemType: 'MEETING' } }),
        this.prisma.notification.count({ where: { companyId: me.companyId, userId: me.sub, readAt: null } }),
        this.prisma.workItemIndex.count({ where: { ...base, itemType: 'INDICATOR_OFF_TARGET' } }),
      ]);

    return {
      pending, overdue, dueToday, approvals,
      indicatorsOffTarget, risksCritical, documentsToReview,
      trainingsPending: 0, meetingsToday, unreadMessages,
    };
  }

  private async queryItems(me: AuthPayload, query: MyDayItemsQuery) {
    const where: any = { companyId: me.companyId, assignedUserId: me.sub };
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);

    switch (query.tab) {
      case 'overdue': where.overdueDays = { gt: 0 }; break;
      case 'approvals': where.itemType = 'APPROVAL'; break;
      case 'today': where.dueAt = { gte: dayStart, lte: dayEnd }; break;
      case 'upcoming': {
        const in7 = new Date(); in7.setDate(in7.getDate() + 7);
        where.dueAt = { gte: dayStart, lte: in7 };
        break;
      }
      case 'pending': where.status = { notIn: ['DONE', 'ARCHIVED'] }; break;
      default: break; // priorities / all
    }
    if (query.itemType) where.itemType = query.itemType;
    if (query.priority) where.priority = query.priority;
    if (query.q?.trim()) {
      where.OR = [
        { title: { contains: query.q.trim(), mode: 'insensitive' } },
        { summary: { contains: query.q.trim(), mode: 'insensitive' } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(5, Number(query.pageSize) || 25));

    const [rows, total] = await Promise.all([
      this.prisma.workItemIndex.findMany({
        where,
        orderBy: [{ priorityScore: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.workItemIndex.count({ where }),
    ]);
    return { rows, total, page, pageSize };
  }

  // ---------- preferencias ----------

  async getPreferences(me: AuthPayload) {
    const pref = await this.prisma.userDashboardPreference.findUnique({
      where: { companyId_userId: { companyId: me.companyId, userId: me.sub } },
    });
    return pref ?? this.defaultPreferences();
  }

  async setPreferences(me: AuthPayload, dto: Record<string, any>) {
    const data = {
      landingPage: dto.landingPage,
      defaultView: dto.defaultView,
      visibleWidgets: dto.visibleWidgets,
      widgetOrder: dto.widgetOrder,
      savedFilters: dto.savedFilters,
      defaultCompanyId: dto.defaultCompanyId,
      defaultUnitId: dto.defaultUnitId,
      compactMode: dto.compactMode,
      aiEnabled: dto.aiEnabled,
      dailySummaryEnabled: dto.dailySummaryEnabled,
      dailySummaryTime: dto.dailySummaryTime,
    };
    Object.keys(data).forEach((k) => (data as any)[k] === undefined && delete (data as any)[k]);
    return this.prisma.userDashboardPreference.upsert({
      where: { companyId_userId: { companyId: me.companyId, userId: me.sub } },
      create: { companyId: me.companyId, userId: me.sub, ...data },
      update: data,
    });
  }

  private defaultPreferences() {
    return {
      landingPage: '/meu-dia',
      defaultView: 'list',
      visibleWidgets: null,
      widgetOrder: null,
      savedFilters: null,
      defaultCompanyId: null,
      defaultUnitId: null,
      compactMode: false,
      aiEnabled: true,
      dailySummaryEnabled: false,
      dailySummaryTime: null,
    };
  }
}
