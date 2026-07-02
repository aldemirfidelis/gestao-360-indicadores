import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { AuthPayload } from '../auth/auth.types';
import { WorkItemAggregationService } from './work-item-aggregation.service';

const TEAM_REFRESH_TTL_MS = 60_000;
const MAX_REBUILD_PER_REQUEST = 60;
const ACTIVE_ACTION_STATUS = [
  'NOT_STARTED', 'UNDER_ANALYSIS', 'IN_PROGRESS', 'WAITING_THIRD',
  'WAITING_EVIDENCE', 'WAITING_VALIDATION', 'PAUSED', 'REOPENED',
];

interface TeamScope {
  memberIds: string[];
  members: Array<{ id: string; name: string; defaultNodeId: string | null }>;
  nodeIds: string[];
  allCompany: boolean;
}

export interface TeamItemsQuery {
  member?: string;
  itemType?: string;
  priority?: string;
  tab?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

/**
 * "Meu Dia — Equipe" (gestores). Time = nos org sob responsabilidade do gestor
 * (OrgNode.responsibleUserId) + descendentes; membros = usuarios com defaultNode
 * nesse conjunto. COMPANY_ADMIN/SUPER_ADMIN veem a empresa toda. Itens lidos da
 * projecao (referenciam o registro original; nada duplicado).
 */
@Injectable()
export class MyDayTeamService {
  private readonly teamRefresh = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregation: WorkItemAggregationService,
    private readonly access: AccessService,
  ) {}

  async isManager(me: AuthPayload): Promise<boolean> {
    if (me.role === 'SUPER_ADMIN' || me.role === 'COMPANY_ADMIN') return true;
    const n = await this.prisma.orgNode.count({ where: { companyId: me.companyId, responsibleUserId: me.sub, active: true, deletedAt: null } });
    return n > 0;
  }

  /**
   * Membros da equipe do usuário (mesma definição de "Meu Dia — Equipe"):
   * áreas que ele lidera + descendentes. `scope`: 'managed' quando ele lidera
   * áreas, 'company' para admin, 'none' quando não lidera ninguém.
   */
  async getTeamMembers(me: AuthPayload): Promise<{ members: Array<{ id: string; name: string }>; scope: 'managed' | 'company' | 'none' }> {
    const team = await this.resolveTeam(me);
    const members = team.members.map((m) => ({ id: m.id, name: m.name }));
    const scope = team.allCompany ? 'company' : team.memberIds.length ? 'managed' : 'none';
    return { members, scope };
  }

  private async resolveTeam(me: AuthPayload): Promise<TeamScope> {
    const managed = await this.prisma.orgNode.findMany({
      where: { companyId: me.companyId, responsibleUserId: me.sub, active: true, deletedAt: null },
      select: { id: true },
    });
    let nodeIds: string[] = [];
    let allCompany = false;
    if (managed.length) {
      nodeIds = await this.access.expandWithDescendants(me.companyId, managed.map((m) => m.id));
    } else if (me.role === 'SUPER_ADMIN' || me.role === 'COMPANY_ADMIN') {
      allCompany = true;
    } else {
      return { memberIds: [], members: [], nodeIds: [], allCompany: false };
    }
    const where: any = allCompany
      ? { companyId: me.companyId, status: 'ACTIVE', id: { not: me.sub } }
      : { companyId: me.companyId, status: 'ACTIVE', defaultNodeId: { in: nodeIds }, id: { not: me.sub } };
    const members = await this.prisma.user.findMany({
      where, select: { id: true, name: true, defaultNodeId: true }, take: 200, orderBy: { name: 'asc' },
    });
    return { memberIds: members.map((m) => m.id), members, nodeIds, allCompany };
  }

  private async ensureTeamFresh(me: AuthPayload, memberIds: string[]): Promise<void> {
    const key = `${me.companyId}:${me.sub}`;
    if (Date.now() - (this.teamRefresh.get(key) ?? 0) < TEAM_REFRESH_TTL_MS) return;
    for (const uid of memberIds.slice(0, MAX_REBUILD_PER_REQUEST)) {
      try { await this.aggregation.rebuildFor(me.companyId, uid); } catch { /* resiliente */ }
    }
    this.teamRefresh.set(key, Date.now());
  }

  async getOverview(me: AuthPayload) {
    const scope = await this.resolveTeam(me);
    await this.ensureTeamFresh(me, scope.memberIds);
    const [summary, items, workload, bottlenecks] = await Promise.all([
      this.computeSummary(me, scope.memberIds),
      this.queryItems(me, scope, { pageSize: 25, tab: 'priorities' }),
      this.computeWorkload(me, scope),
      this.computeBottlenecks(me, scope),
    ]);
    return {
      teamSize: scope.members.length,
      scope: scope.allCompany ? 'company' : 'managed',
      summary, workload, bottlenecks,
      items: items.rows, total: items.total,
    };
  }

  async getSummary(me: AuthPayload) {
    const scope = await this.resolveTeam(me);
    await this.ensureTeamFresh(me, scope.memberIds);
    return this.computeSummary(me, scope.memberIds);
  }

  async getItems(me: AuthPayload, query: TeamItemsQuery) {
    const scope = await this.resolveTeam(me);
    await this.ensureTeamFresh(me, scope.memberIds);
    return this.queryItems(me, scope, query);
  }

  async getWorkload(me: AuthPayload) {
    const scope = await this.resolveTeam(me);
    await this.ensureTeamFresh(me, scope.memberIds);
    return this.computeWorkload(me, scope);
  }

  async getBottlenecks(me: AuthPayload) {
    const scope = await this.resolveTeam(me);
    await this.ensureTeamFresh(me, scope.memberIds);
    return this.computeBottlenecks(me, scope);
  }

  // ---------- internos ----------

  private emptySummary() {
    return { teamSize: 0, total: 0, critical: 0, overdue: 0, dueToday: 0, approvals: 0, blocking: 0, risksCritical: 0, documentsToReview: 0, indicatorsOffTarget: 0 };
  }

  private async computeSummary(me: AuthPayload, memberIds: string[]) {
    if (!memberIds.length) return this.emptySummary();
    const base = { companyId: me.companyId, assignedUserId: { in: memberIds } };
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);
    const [total, critical, overdue, dueToday, approvals, blocking, risksCritical, documentsToReview, indicatorsOffTarget] =
      await Promise.all([
        this.prisma.workItemIndex.count({ where: { ...base, status: { notIn: ['DONE', 'ARCHIVED'] } } }),
        this.prisma.workItemIndex.count({ where: { ...base, priority: 'CRITICAL' } }),
        this.prisma.workItemIndex.count({ where: { ...base, overdueDays: { gt: 0 } } }),
        this.prisma.workItemIndex.count({ where: { ...base, dueAt: { gte: dayStart, lte: dayEnd } } }),
        this.prisma.workItemIndex.count({ where: { ...base, itemType: 'APPROVAL' } }),
        this.prisma.workItemIndex.count({ where: { ...base, isBlocking: true } }),
        this.prisma.workItemIndex.count({ where: { ...base, itemType: 'RISK_CRITICAL' } }),
        this.prisma.workItemIndex.count({ where: { ...base, itemType: 'DOCUMENT_REVIEW' } }),
        this.prisma.workItemIndex.count({ where: { ...base, itemType: 'INDICATOR_OFF_TARGET' } }),
      ]);
    return { teamSize: memberIds.length, total, critical, overdue, dueToday, approvals, blocking, risksCritical, documentsToReview, indicatorsOffTarget };
  }

  private async queryItems(me: AuthPayload, scope: TeamScope, query: TeamItemsQuery) {
    if (!scope.memberIds.length) return { rows: [], total: 0, page: 1, pageSize: 25 };
    const ids = query.member && scope.memberIds.includes(query.member) ? [query.member] : scope.memberIds;
    const where: any = { companyId: me.companyId, assignedUserId: { in: ids } };
    if (query.tab === 'overdue') where.overdueDays = { gt: 0 };
    else if (query.tab === 'critical') where.priority = 'CRITICAL';
    else if (query.tab === 'blocking') where.isBlocking = true;
    if (query.itemType) where.itemType = query.itemType;
    if (query.priority) where.priority = query.priority;
    if (query.q?.trim()) where.OR = [
      { title: { contains: query.q.trim(), mode: 'insensitive' } },
      { summary: { contains: query.q.trim(), mode: 'insensitive' } },
    ];
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(5, Number(query.pageSize) || 25));
    const [rows, total] = await Promise.all([
      this.prisma.workItemIndex.findMany({ where, orderBy: [{ priorityScore: 'desc' }, { dueAt: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.workItemIndex.count({ where }),
    ]);
    return { rows, total, page, pageSize };
  }

  private async computeWorkload(me: AuthPayload, scope: TeamScope) {
    if (!scope.memberIds.length) return [];
    const items = await this.prisma.workItemIndex.findMany({
      where: { companyId: me.companyId, assignedUserId: { in: scope.memberIds } },
      select: { assignedUserId: true, priority: true, overdueDays: true, itemType: true },
    });
    const byUser = new Map<string, { total: number; overdue: number; critical: number; approvals: number }>();
    for (const m of scope.members) byUser.set(m.id, { total: 0, overdue: 0, critical: 0, approvals: 0 });
    for (const it of items) {
      const u = it.assignedUserId && byUser.get(it.assignedUserId);
      if (!u) continue;
      u.total += 1;
      if (it.overdueDays > 0) u.overdue += 1;
      if (it.priority === 'CRITICAL') u.critical += 1;
      if (it.itemType === 'APPROVAL') u.approvals += 1;
    }
    return scope.members
      .map((m) => ({ userId: m.id, name: m.name, ...byUser.get(m.id)! }))
      .sort((a, b) => b.overdue - a.overdue || b.total - a.total);
  }

  private async computeBottlenecks(me: AuthPayload, scope: TeamScope) {
    const out: Array<{ type: string; label: string; count: number; userId?: string; userName?: string }> = [];
    if (!scope.memberIds.length) return out;

    const workload = await this.computeWorkload(me, scope);
    // Sobrecarga: membros com mais itens vencidos.
    for (const w of workload.filter((x) => x.overdue >= 3).slice(0, 3)) {
      out.push({ type: 'OVERLOAD', label: `${w.name} acumula ${w.overdue} item(ns) vencido(s)`, count: w.overdue, userId: w.userId, userName: w.name });
    }
    // Aprovacoes paradas (vencidas).
    const stuckApprovals = await this.prisma.workItemIndex.count({
      where: { companyId: me.companyId, assignedUserId: { in: scope.memberIds }, itemType: 'APPROVAL', overdueDays: { gt: 0 } },
    });
    if (stuckApprovals > 0) out.push({ type: 'STUCK_APPROVALS', label: `${stuckApprovals} aprovação(ões) parada(s) (vencidas) na equipe`, count: stuckApprovals });
    // Itens bloqueantes.
    const blocking = await this.prisma.workItemIndex.count({
      where: { companyId: me.companyId, assignedUserId: { in: scope.memberIds }, isBlocking: true },
    });
    if (blocking > 0) out.push({ type: 'BLOCKING', label: `${blocking} item(ns) bloqueante(s) aguardando ação`, count: blocking });

    // Acoes sem responsavel / sem prazo no escopo gerenciado (consulta direta na origem).
    if (!scope.allCompany && scope.nodeIds.length) {
      const [noResp, noDue] = await Promise.all([
        this.prisma.actionPlan.count({ where: { companyId: me.companyId, deletedAt: null, ownerNodeId: { in: scope.nodeIds }, responsibleUserId: null, status: { in: ACTIVE_ACTION_STATUS as any } } }),
        this.prisma.actionPlan.count({ where: { companyId: me.companyId, deletedAt: null, ownerNodeId: { in: scope.nodeIds }, dueDate: null, status: { in: ACTIVE_ACTION_STATUS as any } } }),
      ]);
      if (noResp > 0) out.push({ type: 'NO_RESPONSIBLE', label: `${noResp} plano(s) de ação sem responsável`, count: noResp });
      if (noDue > 0) out.push({ type: 'NO_DUE_DATE', label: `${noDue} plano(s) de ação sem prazo`, count: noDue });
    }
    return out;
  }
}
