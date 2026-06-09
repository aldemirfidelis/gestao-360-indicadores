import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
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
    let followFilter: Array<{ sourceEntityType: string; sourceEntityId: string; itemType: string }> | null = null;

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
      case 'delegated': where.isDelegated = true; break;
      case 'following':
      case 'pinned': {
        const follows = await this.prisma.workItemFollow.findMany({
          where: { companyId: me.companyId, userId: me.sub, ...(query.tab === 'pinned' ? { pinned: true } : {}) },
          select: { sourceEntityType: true, sourceEntityId: true, itemType: true },
        });
        followFilter = follows;
        where.OR = follows.map((f) => ({ sourceEntityType: f.sourceEntityType, sourceEntityId: f.sourceEntityId, itemType: f.itemType }));
        break;
      }
      default: break; // priorities / all
    }
    if (followFilter && followFilter.length === 0) return { rows: [], total: 0, page: 1, pageSize: Math.min(100, Math.max(5, Number(query.pageSize) || 25)) };
    if (query.itemType) where.itemType = query.itemType;
    if (query.priority) where.priority = query.priority;
    if (query.q?.trim()) {
      const searchOr = [
        { title: { contains: query.q.trim(), mode: 'insensitive' } },
        { summary: { contains: query.q.trim(), mode: 'insensitive' } },
      ];
      where.AND = [...(where.AND ?? []), { OR: searchOr }];
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
    const enriched = await this.attachFollowState(me, rows);
    enriched.sort((a: any, b: any) => Number(b.isPinned) - Number(a.isPinned) || b.priorityScore - a.priorityScore);
    return { rows: enriched, total, page, pageSize };
  }

  private followKey(row: { sourceEntityType: string; sourceEntityId: string; itemType: string }) {
    return `${row.sourceEntityType}:${row.sourceEntityId}:${row.itemType}`;
  }

  private async attachFollowState(me: AuthPayload, rows: any[]) {
    if (!rows.length) return rows;
    const follows = await this.prisma.workItemFollow.findMany({
      where: {
        companyId: me.companyId,
        userId: me.sub,
        OR: rows.map((r) => ({ sourceEntityType: r.sourceEntityType, sourceEntityId: r.sourceEntityId, itemType: r.itemType })),
      },
    });
    const byKey = new Map(follows.map((f) => [this.followKey(f), f]));
    return rows.map((row) => {
      const f = byKey.get(this.followKey(row));
      return {
        ...row,
        isFollowed: !!f,
        isPinned: !!f?.pinned,
        followNote: f?.note ?? null,
        followedAt: f?.followedAt ?? null,
        pinnedAt: f?.pinnedAt ?? null,
      };
    });
  }

  // ---------- delegacoes ----------

  async listDelegationUsers(me: AuthPayload) {
    return this.prisma.user.findMany({
      where: { companyId: me.companyId, id: { not: me.sub }, deletedAt: null, status: 'ACTIVE', active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, jobTitle: true },
      take: 200,
    });
  }

  async listDelegations(me: AuthPayload) {
    const [given, received, users] = await Promise.all([
      this.prisma.userDelegation.findMany({
        where: { companyId: me.companyId, delegatorUserId: me.sub, status: { not: 'REVOKED' } },
        include: { delegate: { select: { id: true, name: true, email: true } } },
        orderBy: [{ status: 'asc' }, { startsAt: 'desc' }],
      }),
      this.prisma.userDelegation.findMany({
        where: { companyId: me.companyId, delegateUserId: me.sub, status: { not: 'REVOKED' } },
        include: { delegator: { select: { id: true, name: true, email: true } } },
        orderBy: [{ status: 'asc' }, { startsAt: 'desc' }],
      }),
      this.listDelegationUsers(me),
    ]);
    return { given, received, users };
  }

  async createDelegation(me: AuthPayload, dto: Record<string, any>) {
    const delegateUserId = String(dto.delegateUserId ?? '');
    if (!delegateUserId || delegateUserId === me.sub) throw new BadRequestException('Informe um substituto valido.');
    const delegate = await this.prisma.user.findFirst({
      where: { id: delegateUserId, companyId: me.companyId, deletedAt: null, status: 'ACTIVE', active: true },
      select: { id: true },
    });
    if (!delegate) throw new NotFoundException('Substituto nao encontrado.');
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) throw new BadRequestException('Periodo invalido.');
    if (endsAt && endsAt <= startsAt) throw new BadRequestException('O fim da delegacao deve ser posterior ao inicio.');
    const row = await this.prisma.userDelegation.create({
      data: {
        companyId: me.companyId,
        delegatorUserId: me.sub,
        delegateUserId,
        startsAt,
        endsAt,
        reason: dto.reason ? String(dto.reason).slice(0, 500) : null,
        scope: dto.scope ?? null,
        createdById: me.sub,
      },
    });
    return row;
  }

  async revokeDelegation(me: AuthPayload, id: string) {
    const row = await this.prisma.userDelegation.findFirst({ where: { id, companyId: me.companyId } });
    if (!row) throw new NotFoundException('Delegacao nao encontrada.');
    if (row.delegatorUserId !== me.sub && row.delegateUserId !== me.sub) throw new ForbiddenException('Sem acesso a esta delegacao.');
    return this.prisma.userDelegation.update({ where: { id }, data: { status: 'REVOKED', revokedAt: new Date() } });
  }

  // ---------- acompanhar / fixar ----------

  async listFollows(me: AuthPayload) {
    return this.prisma.workItemFollow.findMany({
      where: { companyId: me.companyId, userId: me.sub },
      orderBy: [{ pinned: 'desc' }, { followedAt: 'desc' }],
    });
  }

  async followItem(me: AuthPayload, id: string, dto: Record<string, any>) {
    const item = await this.getItem(me, id);
    const pinned = !!dto.pinned;
    return this.prisma.workItemFollow.upsert({
      where: {
        companyId_userId_sourceEntityType_sourceEntityId_itemType: {
          companyId: me.companyId,
          userId: me.sub,
          sourceEntityType: item.sourceEntityType,
          sourceEntityId: item.sourceEntityId,
          itemType: item.itemType,
        },
      },
      create: {
        companyId: me.companyId,
        userId: me.sub,
        sourceModule: item.sourceModule,
        sourceEntityType: item.sourceEntityType,
        sourceEntityId: item.sourceEntityId,
        itemType: item.itemType,
        titleSnapshot: item.title,
        pinned,
        pinnedAt: pinned ? new Date() : null,
        note: dto.note ? String(dto.note).slice(0, 500) : null,
      },
      update: {
        titleSnapshot: item.title,
        pinned,
        pinnedAt: pinned ? new Date() : null,
        note: dto.note === undefined ? undefined : dto.note ? String(dto.note).slice(0, 500) : null,
      },
    });
  }

  async unfollowItem(me: AuthPayload, id: string) {
    const item = await this.getItem(me, id);
    await this.prisma.workItemFollow.deleteMany({
      where: {
        companyId: me.companyId,
        userId: me.sub,
        sourceEntityType: item.sourceEntityType,
        sourceEntityId: item.sourceEntityId,
        itemType: item.itemType,
      },
    });
    return { ok: true };
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

  // ---------- filtros salvos (armazenados em UserDashboardPreference.savedFilters) ----------

  async listSavedFilters(me: AuthPayload): Promise<any[]> {
    const pref = await this.getPreferences(me);
    return Array.isArray((pref as any).savedFilters) ? (pref as any).savedFilters : [];
  }

  async addSavedFilter(me: AuthPayload, dto: Record<string, any>) {
    const list = await this.listSavedFilters(me);
    const entry = {
      id: randomUUID(),
      name: (dto.name ?? 'Filtro').toString().slice(0, 60),
      view: dto.view ?? null,
      tab: dto.tab ?? null,
      itemType: dto.itemType ?? null,
      priority: dto.priority ?? null,
      q: dto.q ?? null,
    };
    await this.setPreferences(me, { savedFilters: [...list, entry].slice(0, 30) });
    return entry;
  }

  async removeSavedFilter(me: AuthPayload, id: string) {
    const list = await this.listSavedFilters(me);
    await this.setPreferences(me, { savedFilters: list.filter((f: any) => f.id !== id) });
    return { ok: true };
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
