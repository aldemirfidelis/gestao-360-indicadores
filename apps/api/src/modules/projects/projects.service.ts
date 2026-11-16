import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { listTake } from '../../common/http/list-take';
import { Prisma, ProjectStatus } from '@prisma/client';
import { buildPortfolioCurve, buildProjectCurve, projectExpectedProgress, projectMeasurementDay, projectProgress } from '@g360/shared';
import { AccessService } from '../access/access.service';
import type { AreaAction } from '../access/access.logic';
import { AuthPayload } from '../auth/auth.types';
import { withProjectProgressSnapshot } from './project-progress-snapshot';

// Projetos não têm área própria: derivam do indicador vinculado (quando houver).
// Projetos sem indicador são "gerais" (company-wide) e não restringem por área.
const MODULE = 'projects';
const FINAL_PROJECT_STATUSES = new Set<ProjectStatus>([ProjectStatus.DONE, ProjectStatus.CANCELLED]);
const PROJECT_STATUSES: string[] = Object.values(ProjectStatus);
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const COST_KINDS = ['PLANNED', 'ACTUAL'];
const RISK_KINDS = ['RISK', 'ISSUE'];
const RISK_STATUSES = ['OPEN', 'MITIGATING', 'RESOLVED', 'ACCEPTED'];
const OPEN_RISK_STATUSES = ['OPEN', 'MITIGATING'];
const HEALTHS = ['GREEN', 'YELLOW', 'RED'];

/** Textos livres do projeto (cadastro e termo de abertura): [campo, rótulo, tamanho máximo]. */
const PROJECT_TEXT_FIELDS: Array<[string, string, number]> = [
  ['description', 'Descrição', 4000],
  ['responsible', 'Responsável', 180],
  ['category', 'Categoria', 80],
  ['sponsor', 'Patrocinador', 180],
  ['objective', 'Objetivo', 4000],
  ['justification', 'Justificativa', 4000],
  ['scope', 'Escopo', 4000],
  ['outOfScope', 'Fora do escopo', 4000],
  ['assumptions', 'Premissas e restrições', 4000],
  ['benefits', 'Benefícios esperados', 4000],
  ['lessonsLearned', 'Lições aprendidas', 4000],
];

type ProjectListFilters = {
  indicatorId?: string;
  status?: ProjectStatus;
  search?: string;
  priority?: string;
  managerId?: string;
  /** Projetos de melhoria: vinculados ao processo (no processo inteiro ou numa atividade). */
  processId?: string;
  /** Uso interno (painel PMO de processos): restringe a estes projetos. */
  ids?: string[];
};

/** Itens da agenda do portfólio: marcos e tarefas em aberto dos projetos não finalizados. */
const AGENDA_LIMIT = 40;
const DUE_SOON_DAYS = 14;

type ChildModel = 'projectMilestone' | 'projectMember' | 'projectCost' | 'projectRisk' | 'projectUpdate';

function has(body: any, key: string): boolean {
  return body !== null && body !== undefined && body[key] !== undefined;
}

function requiredText(value: unknown, label: string, max = 180): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new BadRequestException(`${label}: campo obrigatório.`);
  if (text.length > max) throw new BadRequestException(`${label}: máximo de ${max} caracteres.`);
  return text;
}

function optionalText(value: unknown, label: string, max = 4000): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new BadRequestException(`${label}: valor inválido.`);
  const text = value.trim();
  if (text.length > max) throw new BadRequestException(`${label}: máximo de ${max} caracteres.`);
  return text || null;
}

function optionalDate(value: unknown, label: string): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' && !(value instanceof Date)) throw new BadRequestException(`${label}: data inválida.`);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new BadRequestException(`${label}: data inválida.`);
  return date;
}

function requiredDate(value: unknown, label: string): Date {
  const date = optionalDate(value, label);
  if (!date) throw new BadRequestException(`${label}: campo obrigatório.`);
  return date;
}

function optionalAmount(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new BadRequestException(`${label}: informe um valor igual ou maior que zero.`);
  }
  return value;
}

function requiredAmount(value: unknown, label: string): number {
  const amount = optionalAmount(value, label);
  if (amount === null) throw new BadRequestException(`${label}: campo obrigatório.`);
  return amount;
}

function integerBetween(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException(`${label}: informe um número inteiro entre ${min} e ${max}.`);
  }
  return value;
}

function oneOf(value: unknown, allowed: string[], label: string): string {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new BadRequestException(`${label}: opção inválida.`);
  return value;
}

function assertDateOrder(start: Date | null | undefined, end: Date | null | undefined, message: string) {
  if (start && end && end.getTime() < start.getTime()) throw new BadRequestException(message);
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002';
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  private areaOf(p: { indicator?: { ownerNodeId: string | null } | null }): string | null {
    return p.indicator?.ownerNodeId ?? null;
  }

  private async assertWriteArea(me: AuthPayload, area: string | null, action: AreaAction) {
    if (area) await this.access.assertCanWrite(me.sub, area, MODULE, action);
  }

  /** Restrição por área (leitura): projeto vinculado a indicador de área não permitida. */
  private async assertViewArea(me: AuthPayload, area: string | null) {
    if (!area) return;
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    if (permitted && !permitted.includes(area)) {
      throw new ForbiddenException('Você não tem acesso aos projetos desta área.');
    }
  }

  /** Carrega o projeto isolado por EMPRESA (defesa contra id de outra empresa) + área. */
  private async loadScoped(id: string, companyId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { indicator: { select: { ownerNodeId: true } } },
    });
    if (!project) throw new NotFoundException('Projeto não encontrado');
    return project;
  }

  /** Carrega um registro filho (marco, participante, custo, risco, status report) isolado por empresa. */
  private async loadChild(model: ChildModel, companyId: string, id: string, notFound: string): Promise<any> {
    const row = await (this.prisma as any)[model].findFirst({
      where: { id, project: { companyId, deletedAt: null } },
      include: { project: { select: { indicator: { select: { ownerNodeId: true } } } } },
    });
    if (!row) throw new NotFoundException(notFound);
    return row;
  }

  private async assertChildWrite(me: AuthPayload, row: any) {
    await this.assertWriteArea(me, row.project?.indicator?.ownerNodeId ?? null, 'edit');
  }

  private async resolveUser(companyId: string, userId: unknown, label: string) {
    if (typeof userId !== 'string') throw new BadRequestException(`${label}: pessoa inválida.`);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!user) throw new BadRequestException(`${label}: pessoa inválida para esta empresa.`);
    return user;
  }

  private async withProgressSnapshot<T>(projectId: string, write: (tx: Prisma.TransactionClient) => Promise<T>) {
    return withProjectProgressSnapshot(this.prisma, projectId, write);
  }

  /** Próximo código sequencial da empresa (PRJ-0001). Considera também projetos excluídos. */
  private async nextCode(companyId: string): Promise<string> {
    const rows = await this.prisma.project.findMany({
      where: { companyId, code: { startsWith: 'PRJ-' } },
      select: { code: true },
    });
    let last = 0;
    for (const row of rows) {
      const match = /^PRJ-(\d+)$/.exec(row.code ?? '');
      const value = match ? Number(match[1]) : 0;
      if (value > last) last = value;
    }
    return `PRJ-${String(last + 1).padStart(4, '0')}`;
  }

  /** Grava com código único: informado pelo usuário (conflito = 409) ou gerado (com nova tentativa). */
  private async withProjectCode<T>(companyId: string, explicitCode: string | null, write: (code: string) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const code = explicitCode ?? (await this.nextCode(companyId));
      try {
        return await write(code);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        if (explicitCode) throw new ConflictException('Já existe um projeto com este código.');
        if (attempt >= 3) throw new ConflictException('Não foi possível gerar o código do projeto. Tente novamente.');
      }
    }
  }

  private enrichProject(p: any) {
    const now = new Date();
    const progressOverall = projectProgress(p);
    const milestones = p.milestones ?? [];
    const tasks = p.tasks ?? [];
    const milestonesDone = milestones.filter((m: any) => m.done).length;
    // Um prazo só vence depois que o dia termina: quem vence hoje ainda está no prazo.
    const today = projectMeasurementDay(now).getTime();
    const overdue = (value: unknown) => Boolean(value) && new Date(value as string | Date).getTime() < today;
    const milestonesOverdue = milestones.filter((m: any) => !m.done && overdue(m.dueDate)).length;
    const tasksOverdue = tasks.filter((t: any) => (t.progress ?? 0) < 100 && overdue(t.endDate)).length;
    const expectedProgress = projectExpectedProgress(p, now);
    const scheduleVariance = expectedProgress === null ? null : progressOverall - expectedProgress;
    const isFinal = FINAL_PROJECT_STATUSES.has(p.status);
    const isPastEnd = !isFinal && overdue(p.endsAt);
    const pmoStatus = isFinal
      ? 'FINALIZED'
      : isPastEnd || milestonesOverdue > 0 || tasksOverdue > 0
        ? 'CRITICAL'
        : scheduleVariance !== null && scheduleVariance < -15
          ? 'AT_RISK'
          : 'ON_TRACK';

    const costs: any[] = p.costs ?? [];
    const sumCosts = (kind: string) => costs.filter((c) => c.kind === kind).reduce((sum, c) => sum + (c.amount ?? 0), 0);
    const plannedCost = sumCosts('PLANNED');
    const actualCost = sumCosts('ACTUAL');
    const budget: number | null = p.budget ?? null;
    const finance = {
      budget,
      plannedCost,
      actualCost,
      balance: budget === null ? null : budget - actualCost,
      consumedPct: budget ? Math.round((actualCost / budget) * 100) : null,
      overBudget: budget !== null && actualCost > budget,
    };

    const openItems: any[] = (p.projectRisks ?? []).filter((r: any) => !r.status || OPEN_RISK_STATUSES.includes(r.status));
    const openRisks = openItems.filter((r) => r.kind !== 'ISSUE').length;
    const openIssues = openItems.filter((r) => r.kind === 'ISSUE').length;
    const latestUpdate = (p.updates ?? [])[0] ?? null;

    return {
      ...p,
      progressOverall,
      expectedProgress,
      scheduleVariance,
      pmoStatus,
      milestonesDone,
      milestonesOverdue,
      tasksOverdue,
      finance,
      openRisks,
      openIssues,
      latestHealth: latestUpdate?.health ?? null,
    };
  }

  /** Filtro comum da lista, do portfólio e da execução: empresa, área visível e filtros da tela. */
  private async listWhere(me: AuthPayload, filters: ProjectListFilters): Promise<Prisma.ProjectWhereInput> {
    if (filters.status && !PROJECT_STATUSES.includes(filters.status)) throw new BadRequestException('Status: opção inválida.');
    if (filters.priority && !PRIORITIES.includes(filters.priority)) throw new BadRequestException('Prioridade: opção inválida.');
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const and: any[] = [];
    if (permitted) {
      and.push({ OR: [{ indicatorId: null }, { indicator: { ownerNodeId: { in: permitted } } }] });
    }
    const term = filters.search?.trim();
    if (term) {
      and.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { responsible: { contains: term, mode: 'insensitive' } },
          { indicator: { name: { contains: term, mode: 'insensitive' } } },
          { indicator: { code: { contains: term, mode: 'insensitive' } } },
          { code: { contains: term, mode: 'insensitive' } },
          { category: { contains: term, mode: 'insensitive' } },
        ],
      });
    }
    if (filters.processId) and.push({ processIntegrations: { some: { processId: filters.processId } } });
    return {
      companyId: me.companyId,
      deletedAt: null,
      ...(filters.ids ? { id: { in: filters.ids } } : {}),
      ...(filters.indicatorId ? { indicatorId: filters.indicatorId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority as any } : {}),
      ...(filters.managerId ? { managerId: filters.managerId } : {}),
      ...(and.length ? { AND: and } : {}),
    };
  }

  async list(me: AuthPayload, filters: ProjectListFilters = {}) {
    if (filters.ids && !filters.ids.length) return [];
    const where = await this.listWhere(me, filters);
    const include: any = {
      _count: { select: { tasks: true, milestones: true } },
      milestones: { orderBy: { dueDate: 'asc' } },
      tasks: { select: { progress: true, startDate: true, endDate: true } },
      manager: { select: { id: true, name: true } },
      costs: { select: { kind: true, amount: true } },
      projectRisks: {
        where: { status: { in: OPEN_RISK_STATUSES } },
        select: { id: true, kind: true, status: true },
      },
      updates: {
        orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }],
        take: 1,
        select: { health: true, reportDate: true, summary: true },
      },
      indicator: {
        select: {
          id: true,
          name: true,
          code: true,
          unit: true,
          unitLabel: true,
          direction: true,
          results: { orderBy: { periodDate: 'desc' }, take: 1, select: { value: true, light: true, attainment: true, periodRef: true } },
        },
      },
    };
    const items: any[] = await this.prisma.project.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
      take: listTake(),
    });
    // Lançamentos de custo e riscos ficam no detalhe; a lista leva apenas os totais.
    return items.map((p) => {
      const enriched: any = this.enrichProject(p);
      delete enriched.costs;
      delete enriched.projectRisks;
      return enriched;
    });
  }

  async portfolio(me: AuthPayload, filters: ProjectListFilters = {}) {
    const projects: any[] = await this.list(me, filters);
    const activeProjects = projects.filter((p) => !FINAL_PROJECT_STATUSES.has(p.status));
    const statusCounts = Object.fromEntries(Object.values(ProjectStatus).map((status) => [status, 0])) as Record<ProjectStatus, number>;
    for (const p of projects) statusCounts[p.status as ProjectStatus]++;
    const priorityCounts = Object.fromEntries(PRIORITIES.map((priority) => [priority, 0])) as Record<string, number>;
    for (const p of projects) {
      if (p.priority && priorityCounts[p.priority] !== undefined) priorityCounts[p.priority]++;
    }
    const budgetTotal = projects.reduce((sum, p) => sum + (p.budget ?? 0), 0);
    const activeBudget = activeProjects.reduce((sum, p) => sum + (p.budget ?? 0), 0);
    const actualCost = projects.reduce((sum, p) => sum + (p.finance?.actualCost ?? 0), 0);
    const plannedCost = projects.reduce((sum, p) => sum + (p.finance?.plannedCost ?? 0), 0);
    const overBudget = projects.filter((p) => p.finance?.overBudget).length;
    const avgProgress = projects.length
      ? Math.round(projects.reduce((sum, p) => sum + p.progressOverall, 0) / projects.length)
      : 0;
    const milestonesTotal = projects.reduce((sum, p) => sum + (p.milestones?.length ?? 0), 0);
    const milestonesDone = projects.reduce((sum, p) => sum + (p.milestonesDone ?? 0), 0);
    const milestonesOverdue = projects.reduce((sum, p) => sum + (p.milestonesOverdue ?? 0), 0);
    const tasksTotal = projects.reduce((sum, p) => sum + (p._count?.tasks ?? p.tasks?.length ?? 0), 0);
    const tasksOverdue = projects.reduce((sum, p) => sum + (p.tasksOverdue ?? 0), 0);
    const openRisks = activeProjects.reduce((sum, p) => sum + (p.openRisks ?? 0), 0);
    const openIssues = activeProjects.reduce((sum, p) => sum + (p.openIssues ?? 0), 0);
    const behindSchedule = projects.filter((p) => p.pmoStatus === 'AT_RISK').length;
    const criticalProjects = projects
      .filter((p) => p.pmoStatus === 'CRITICAL' || p.pmoStatus === 'AT_RISK')
      .sort((a, b) => {
        const order = { CRITICAL: 0, AT_RISK: 1 } as Record<string, number>;
        return (order[a.pmoStatus] ?? 9) - (order[b.pmoStatus] ?? 9);
      })
      .slice(0, 8)
      .map((p) => ({
        id: p.id,
        code: p.code ?? null,
        name: p.name,
        status: p.status,
        pmoStatus: p.pmoStatus,
        responsible: p.responsible,
        endsAt: p.endsAt,
        progressOverall: p.progressOverall,
        expectedProgress: p.expectedProgress,
        scheduleVariance: p.scheduleVariance,
        milestonesOverdue: p.milestonesOverdue,
        tasksOverdue: p.tasksOverdue,
        indicator: p.indicator ? { id: p.indicator.id, name: p.indicator.name, code: p.indicator.code } : null,
      }));
    return {
      totalProjects: projects.length,
      activeProjects: activeProjects.length,
      statusCounts,
      priorityCounts,
      budgetTotal,
      activeBudget,
      actualCost,
      plannedCost,
      overBudget,
      avgProgress,
      milestonesTotal,
      milestonesDone,
      milestonesOverdue,
      tasksTotal,
      tasksOverdue,
      openRisks,
      openIssues,
      behindSchedule,
      criticalProjects,
      timeline: projects.map((p) => ({
        id: p.id,
        code: p.code ?? null,
        name: p.name,
        status: p.status,
        pmoStatus: p.pmoStatus,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        progressOverall: p.progressOverall,
        expectedProgress: p.expectedProgress,
        indicator: p.indicator ? { id: p.indicator.id, name: p.indicator.name, code: p.indicator.code } : null,
      })),
    };
  }

  /** Execução do portfólio filtrado: curva S consolidada e agenda de marcos e tarefas em aberto. */
  async execution(me: AuthPayload, filters: ProjectListFilters = {}) {
    const where = await this.listWhere(me, filters);
    const projects = await this.prisma.project.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        startsAt: true,
        endsAt: true,
        milestones: { select: { id: true, name: true, dueDate: true, done: true }, orderBy: { dueDate: 'asc' } },
        tasks: {
          select: { id: true, name: true, phase: true, progress: true, startDate: true, endDate: true, responsible: true },
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
        },
        progressSnapshots: { select: { measuredOn: true, progress: true }, orderBy: { measuredOn: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: listTake(),
    });
    // Mesma regra do status PMO: um prazo só vence depois que o dia (de São Paulo) termina.
    const today = projectMeasurementDay().getTime();
    const soon = today + DUE_SOON_DAYS * 86_400_000;
    const due = (value: Date | null) => (value ? value.getTime() : Number.MAX_SAFE_INTEGER);
    const open = projects.filter((project) => !FINAL_PROJECT_STATUSES.has(project.status));
    const ref = (project: (typeof projects)[number]) => ({ id: project.id, code: project.code, name: project.name });

    const milestones = open
      .flatMap((project) => project.milestones.filter((milestone) => !milestone.done).map((milestone) => ({
        id: milestone.id,
        name: milestone.name,
        dueDate: milestone.dueDate,
        overdue: milestone.dueDate.getTime() < today,
        project: ref(project),
      })))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    const tasks = open.flatMap((project) => project.tasks.filter((task) => (task.progress ?? 0) < 100).map((task) => ({
      id: task.id,
      name: task.name,
      phase: task.phase,
      progress: task.progress,
      startDate: task.startDate,
      endDate: task.endDate,
      responsible: task.responsible,
      overdue: due(task.endDate) < today,
      project: ref(project),
    })));
    // Agenda: o que venceu, o que vence nos próximos dias e o que já está em andamento.
    const agendaTasks = tasks
      .filter((task) => task.overdue || due(task.endDate) <= soon || task.progress > 0)
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || due(a.endDate) - due(b.endDate));

    return {
      curve: buildPortfolioCurve(projects),
      milestones: milestones.slice(0, AGENDA_LIMIT),
      tasks: agendaTasks.slice(0, AGENDA_LIMIT),
      totals: {
        openMilestones: milestones.length,
        overdueMilestones: milestones.filter((milestone) => milestone.overdue).length,
        openTasks: tasks.length,
        overdueTasks: tasks.filter((task) => task.overdue).length,
        dueSoonTasks: tasks.filter((task) => !task.overdue && due(task.endDate) <= soon).length,
      },
    };
  }

  async getById(me: AuthPayload, id: string) {
    const include: any = {
      milestones: { orderBy: { dueDate: 'asc' } },
      progressSnapshots: { orderBy: { measuredOn: 'asc' } },
      tasks: {
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        include: {
          dependency: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
        },
      },
      manager: { select: { id: true, name: true, jobTitle: true } },
      members: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true, jobTitle: true } } },
      },
      costs: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] },
      projectRisks: {
        orderBy: { createdAt: 'desc' },
        include: { owner: { select: { id: true, name: true } } },
      },
      updates: { orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }] },
      indicator: {
        include: {
          ownerNode: { select: { id: true, name: true } },
          results: { orderBy: { periodDate: 'desc' }, take: 12 },
        },
      },
    };
    const proj: any = await this.prisma.project.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include,
    });
    if (!proj) throw new NotFoundException('Projeto não encontrado');
    await this.assertViewArea(me, proj.indicator?.ownerNodeId ?? null);
    return { ...this.enrichProject(proj), curve: buildProjectCurve(proj) };
  }

  /** Normaliza somente os campos editáveis informados; relações e medições não vêm do cliente. */
  private async projectInput(me: AuthPayload, body: any, current: any | null) {
    const data: any = {};
    if (has(body, 'name') || !current) data.name = requiredText(body?.name, 'Nome do projeto');
    for (const [key, label, max] of PROJECT_TEXT_FIELDS) {
      if (has(body, key)) data[key] = optionalText(body[key], label, max);
    }
    if (has(body, 'code')) {
      const code = optionalText(body.code, 'Código', 30);
      if (code) data.code = code.toUpperCase();
    }
    if (has(body, 'startsAt')) data.startsAt = optionalDate(body.startsAt, 'Início');
    if (has(body, 'endsAt')) data.endsAt = optionalDate(body.endsAt, 'Fim previsto');
    if (has(body, 'actualStartAt')) data.actualStartAt = optionalDate(body.actualStartAt, 'Início real');
    if (has(body, 'actualEndAt')) data.actualEndAt = optionalDate(body.actualEndAt, 'Fim real');
    if (has(body, 'budget')) data.budget = optionalAmount(body.budget, 'Orçamento');
    if (has(body, 'status')) data.status = oneOf(body.status, PROJECT_STATUSES, 'Status');
    if (has(body, 'priority')) data.priority = oneOf(body.priority, PRIORITIES, 'Prioridade');
    if (has(body, 'indicatorId')) data.indicatorId = body.indicatorId || null;
    if (has(body, 'managerId')) {
      if (body.managerId) {
        const manager = await this.resolveUser(me.companyId, body.managerId, 'Gerente do projeto');
        data.managerId = manager.id;
        data.responsible = manager.name;
      } else {
        data.managerId = null;
        // O nome exibido vinha do gerente: sem gerente, só permanece se um texto foi informado.
        if (current?.managerId && !has(body, 'responsible')) data.responsible = null;
      }
    }

    if ('startsAt' in data || 'endsAt' in data) {
      const start = 'startsAt' in data ? data.startsAt : current?.startsAt ?? null;
      const end = 'endsAt' in data ? data.endsAt : current?.endsAt ?? null;
      assertDateOrder(start, end, 'O fim previsto não pode ser anterior ao início.');
    }
    if ('actualStartAt' in data || 'actualEndAt' in data) {
      const start = 'actualStartAt' in data ? data.actualStartAt : current?.actualStartAt ?? null;
      const end = 'actualEndAt' in data ? data.actualEndAt : current?.actualEndAt ?? null;
      assertDateOrder(start, end, 'O fim real não pode ser anterior ao início real.');
    }

    // Datas reais acompanham a mudança de status quando não informadas explicitamente.
    if (data.status && data.status !== current?.status) {
      if (data.status === 'IN_PROGRESS' && !('actualStartAt' in data) && !current?.actualStartAt) data.actualStartAt = new Date();
      if (data.status === 'DONE' && !('actualEndAt' in data) && !current?.actualEndAt) data.actualEndAt = new Date();
      if (current?.status === 'DONE' && data.status !== 'DONE' && !('actualEndAt' in data)) data.actualEndAt = null;
    }
    return data;
  }

  async create(me: AuthPayload, body: {
    name: string;
    description?: string;
    startsAt?: string;
    endsAt?: string;
    responsible?: string;
    budget?: number;
    status?: ProjectStatus;
    indicatorId?: string;
    [key: string]: unknown;
  }) {
    const data = await this.projectInput(me, body, null);
    let area: string | null = null;
    if (data.indicatorId) {
      const ind = await this.prisma.indicator.findFirst({
        where: { id: data.indicatorId, companyId: me.companyId, deletedAt: null },
        select: { ownerNodeId: true },
      });
      if (!ind) throw new NotFoundException('Indicador não encontrado');
      area = ind.ownerNodeId;
    }
    await this.assertWriteArea(me, area, 'create');
    const { code: explicitCode, ...fields } = data;
    return this.withProjectCode(me.companyId, explicitCode ?? null, (code) =>
      this.prisma.project.create({
        data: {
          ...fields,
          companyId: me.companyId,
          code,
          status: fields.status ?? ProjectStatus.PLANNED,
          indicatorId: fields.indicatorId ?? null,
          progressSnapshots: { create: { measuredOn: projectMeasurementDay(), progress: 0 } },
        },
      }));
  }

  async update(me: AuthPayload, id: string, patch: any) {
    const project = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(project), 'edit');
    const data = await this.projectInput(me, patch ?? {}, project);
    // Trocar o indicador exige poder escrever também na área de destino.
    if (data.indicatorId) {
      const ind = await this.prisma.indicator.findFirst({
        where: { id: data.indicatorId, companyId: me.companyId, deletedAt: null },
        select: { ownerNodeId: true },
      });
      if (!ind) throw new NotFoundException('Indicador não encontrado');
      await this.assertWriteArea(me, ind.ownerNodeId, 'edit');
    }
    try {
      return await this.prisma.project.update({ where: { id }, data });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Já existe um projeto com este código.');
      throw error;
    }
  }

  /** Cria um novo projeto a partir da estrutura (tarefas, marcos e equipe) de um existente. */
  async duplicate(me: AuthPayload, id: string, body: any) {
    const source: any = await this.prisma.project.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: {
        indicator: { select: { ownerNodeId: true } },
        tasks: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
        milestones: true,
        members: true,
      },
    });
    if (!source) throw new NotFoundException('Projeto não encontrado');
    const area = this.areaOf(source);
    await this.assertViewArea(me, area);
    await this.assertWriteArea(me, area, 'create');

    const name = has(body, 'name') ? requiredText(body.name, 'Nome do projeto') : `${source.name} (cópia)`.slice(0, 180);
    const newStart = optionalDate(body?.startsAt, 'Início');
    // Com nova data de início, todo o cronograma é deslocado pelo mesmo intervalo.
    const shift = newStart && source.startsAt ? newStart.getTime() - new Date(source.startsAt).getTime() : 0;
    const move = (value: Date | string | null | undefined) => (value ? new Date(new Date(value).getTime() + shift) : null);

    return this.withProjectCode(me.companyId, null, (code) =>
      this.prisma.$transaction(async (tx) => {
        const created = await tx.project.create({
          data: {
            companyId: me.companyId,
            code,
            name,
            description: source.description,
            category: source.category,
            priority: source.priority,
            sponsor: source.sponsor,
            managerId: source.managerId,
            responsible: source.responsible,
            objective: source.objective,
            justification: source.justification,
            scope: source.scope,
            outOfScope: source.outOfScope,
            assumptions: source.assumptions,
            benefits: source.benefits,
            budget: source.budget,
            indicatorId: source.indicatorId,
            status: ProjectStatus.PLANNED,
            startsAt: source.startsAt ? move(source.startsAt) : newStart,
            endsAt: move(source.endsAt),
            progressSnapshots: { create: { measuredOn: projectMeasurementDay(), progress: 0 } },
          } as any,
        });
        const taskIds = new Map<string, string>();
        for (const task of source.tasks as any[]) {
          const copy = await tx.projectTask.create({
            data: {
              projectId: created.id,
              name: task.name,
              description: task.description,
              phase: task.phase,
              startDate: move(task.startDate),
              endDate: move(task.endDate),
              responsible: task.responsible,
              assigneeId: task.assigneeId,
              position: task.position,
            } as any,
          });
          taskIds.set(task.id, copy.id);
        }
        for (const task of source.tasks as any[]) {
          const dependencyId = task.dependencyId ? taskIds.get(task.dependencyId) : null;
          if (dependencyId) {
            await tx.projectTask.update({ where: { id: taskIds.get(task.id) as string }, data: { dependencyId } });
          }
        }
        for (const milestone of source.milestones as any[]) {
          await tx.projectMilestone.create({
            data: {
              projectId: created.id,
              name: milestone.name,
              description: milestone.description,
              dueDate: move(milestone.dueDate) as Date,
            } as any,
          });
        }
        for (const member of source.members as any[]) {
          await (tx as any).projectMember.create({
            data: {
              projectId: created.id,
              userId: member.userId,
              name: member.name,
              role: member.role,
              allocation: member.allocation,
            },
          });
        }
        return created;
      }));
  }

  async listIndicators(me: AuthPayload) {
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    return this.prisma.indicator.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(permitted ? { ownerNodeId: { in: permitted } } : {}),
      },
      select: { id: true, name: true, code: true, unit: true, unitLabel: true, direction: true, ownerNodeId: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Opções dos formulários: pessoas ativas da empresa, indicadores visíveis e categorias já usadas. */
  async options(me: AuthPayload) {
    const [people, indicators, categories] = await Promise.all([
      this.prisma.user.findMany({
        where: { companyId: me.companyId, active: true, deletedAt: null },
        select: { id: true, name: true, jobTitle: true },
        orderBy: { name: 'asc' },
      }),
      this.listIndicators(me),
      this.prisma.project.findMany({
        where: { companyId: me.companyId, deletedAt: null, category: { not: null } },
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' },
      }),
    ]);
    return {
      people,
      indicators,
      categories: categories.map((row) => row.category).filter(Boolean),
    };
  }

  async remove(me: AuthPayload, id: string) {
    const project = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(project), 'delete');
    return this.prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ----------------------------------------------------------------- Marcos

  async addMilestone(me: AuthPayload, projectId: string, name: string, dueDate: string, description?: string) {
    const project = await this.loadScoped(projectId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(project), 'edit');
    const data: any = {
      projectId,
      name: requiredText(name, 'Nome do marco'),
      dueDate: requiredDate(dueDate, 'Data do marco'),
      description: optionalText(description, 'Descrição do marco', 2000),
    };
    return this.withProgressSnapshot(projectId, (tx) => tx.projectMilestone.create({ data }));
  }

  async updateMilestone(me: AuthPayload, id: string, patch: any) {
    const ms = await this.loadChild('projectMilestone', me.companyId, id, 'Marco não encontrado');
    await this.assertChildWrite(me, ms);
    const data: any = {};
    if (has(patch, 'name')) data.name = requiredText(patch.name, 'Nome do marco');
    if (has(patch, 'dueDate')) data.dueDate = requiredDate(patch.dueDate, 'Data do marco');
    if (has(patch, 'description')) data.description = optionalText(patch.description, 'Descrição do marco', 2000);
    if (has(patch, 'done')) {
      if (typeof patch.done !== 'boolean') throw new BadRequestException('Informe se o marco foi concluído.');
      data.done = patch.done;
      if (patch.done !== Boolean(ms.done)) data.completedAt = patch.done ? new Date() : null;
    }
    return this.withProgressSnapshot(ms.projectId, (tx) => tx.projectMilestone.update({ where: { id }, data }));
  }

  async toggleMilestone(me: AuthPayload, id: string, done: boolean) {
    const ms = await this.loadChild('projectMilestone', me.companyId, id, 'Marco não encontrado');
    await this.assertChildWrite(me, ms);
    if (typeof done !== 'boolean') throw new BadRequestException('Informe se o marco foi concluído.');
    const data: any = { done };
    if (done !== Boolean(ms.done)) data.completedAt = done ? new Date() : null;
    return this.withProgressSnapshot(ms.projectId, (tx) => tx.projectMilestone.update({ where: { id }, data }));
  }

  async removeMilestone(me: AuthPayload, id: string) {
    const ms = await this.loadChild('projectMilestone', me.companyId, id, 'Marco não encontrado');
    await this.assertChildWrite(me, ms);
    return this.withProgressSnapshot(ms.projectId, (tx) => tx.projectMilestone.delete({ where: { id } }));
  }

  // ---------------------------------------------------------------- Tarefas

  async addTask(me: AuthPayload, projectId: string, body: {
    name: string;
    description?: string;
    phase?: string;
    startDate?: string;
    endDate?: string;
    responsible?: string;
    assigneeId?: string;
    dependencyId?: string;
  }) {
    const project = await this.loadScoped(projectId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(project), 'edit');
    const data: any = {
      projectId,
      name: requiredText(body?.name, 'Nome da tarefa'),
      description: optionalText(body?.description, 'Descrição da tarefa', 2000),
      phase: optionalText(body?.phase, 'Fase', 120),
      startDate: optionalDate(body?.startDate, 'Início da tarefa'),
      endDate: optionalDate(body?.endDate, 'Fim da tarefa'),
      responsible: optionalText(body?.responsible, 'Responsável', 180),
      dependencyId: body?.dependencyId || null,
    };
    assertDateOrder(data.startDate, data.endDate, 'O fim da tarefa não pode ser anterior ao início.');
    if (body?.assigneeId) {
      const assignee = await this.resolveUser(me.companyId, body.assigneeId, 'Responsável');
      data.assigneeId = assignee.id;
      data.responsible = assignee.name;
    }
    return this.withProgressSnapshot(projectId, async (tx) => {
      if (data.dependencyId) await this.assertDependency(tx, projectId, data.dependencyId);
      const last = await tx.projectTask.findFirst({
        where: { projectId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      return tx.projectTask.create({ data: { ...data, position: (last?.position ?? -1) + 1 } });
    });
  }

  async updateTask(me: AuthPayload, id: string, patch: any) {
    const task: any = await this.loadScopedTask(me.companyId, id);
    await this.assertWriteArea(me, task.project.indicator?.ownerNodeId ?? null, 'edit');
    const data: any = {};
    if (has(patch, 'name')) data.name = requiredText(patch.name, 'Nome da tarefa');
    if (has(patch, 'description')) data.description = optionalText(patch.description, 'Descrição da tarefa', 2000);
    if (has(patch, 'phase')) data.phase = optionalText(patch.phase, 'Fase', 120);
    if (has(patch, 'responsible')) data.responsible = optionalText(patch.responsible, 'Responsável', 180);
    if (has(patch, 'position')) data.position = integerBetween(patch.position, 0, 100000, 'Posição');
    if (patch?.progress !== undefined) {
      if (typeof patch.progress !== 'number' || !Number.isFinite(patch.progress) || patch.progress < 0 || patch.progress > 100) {
        throw new BadRequestException('O progresso deve estar entre 0 e 100.');
      }
      data.progress = patch.progress;
      if (patch.progress >= 100 && !task.completedAt) data.completedAt = new Date();
      if (patch.progress < 100 && task.completedAt) data.completedAt = null;
    }
    if (has(patch, 'startDate')) data.startDate = optionalDate(patch.startDate, 'Início da tarefa');
    if (has(patch, 'endDate')) data.endDate = optionalDate(patch.endDate, 'Fim da tarefa');
    if ('startDate' in data || 'endDate' in data) {
      const start = 'startDate' in data ? data.startDate : task.startDate ?? null;
      const end = 'endDate' in data ? data.endDate : task.endDate ?? null;
      assertDateOrder(start, end, 'O fim da tarefa não pode ser anterior ao início.');
    }
    if (patch?.dependencyId !== undefined) data.dependencyId = patch.dependencyId || null;
    if (has(patch, 'assigneeId')) {
      if (patch.assigneeId) {
        const assignee = await this.resolveUser(me.companyId, patch.assigneeId, 'Responsável');
        data.assigneeId = assignee.id;
        data.responsible = assignee.name;
      } else {
        data.assigneeId = null;
        if (task.assigneeId && !has(patch, 'responsible')) data.responsible = null;
      }
    }
    return this.withProgressSnapshot(task.projectId, async (tx) => {
      if (patch?.dependencyId) await this.assertDependency(tx, task.projectId, patch.dependencyId, id);
      return tx.projectTask.update({ where: { id }, data });
    });
  }

  async removeTask(me: AuthPayload, id: string) {
    const task = await this.loadScopedTask(me.companyId, id);
    await this.assertWriteArea(me, task.project.indicator?.ownerNodeId ?? null, 'edit');
    // Tarefas que dependiam desta ficam sem predecessora (a chave estrangeira usa SET NULL).
    return this.withProgressSnapshot(task.projectId, (tx) => tx.projectTask.delete({ where: { id } }));
  }

  /** Reordena o cronograma: recebe todos os ids das tarefas do projeto na nova ordem. */
  async reorderTasks(me: AuthPayload, projectId: string, ids: unknown) {
    const project = await this.loadScoped(projectId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(project), 'edit');
    if (!Array.isArray(ids) || ids.some((value) => typeof value !== 'string')) {
      throw new BadRequestException('Informe a nova ordem das tarefas.');
    }
    const order = ids as string[];
    const tasks = await this.prisma.projectTask.findMany({ where: { projectId }, select: { id: true } });
    const known = new Set(tasks.map((task) => task.id));
    if (order.length !== known.size || new Set(order).size !== order.length || order.some((taskId) => !known.has(taskId))) {
      throw new BadRequestException('A ordenação deve conter todas as tarefas do projeto.');
    }
    await this.prisma.$transaction(
      order.map((taskId, index) => this.prisma.projectTask.update({ where: { id: taskId }, data: { position: index } })),
    );
    return { ok: true };
  }

  private async assertDependency(tx: Prisma.TransactionClient, projectId: string, dependencyId: string, taskId?: string) {
    const dependency = await tx.projectTask.findFirst({ where: { id: dependencyId, projectId } });
    if (!dependency || dependency.id === taskId) throw new BadRequestException('Escolha uma dependência do mesmo projeto.');
    // Impede ciclos que tornariam o cronograma impossível de executar.
    const visited = new Set<string>();
    let current: typeof dependency | null = dependency;
    while (current) {
      if (current.id === taskId || visited.has(current.id)) throw new BadRequestException('A dependência cria um ciclo no cronograma.');
      visited.add(current.id);
      current = current.dependencyId ? await tx.projectTask.findFirst({ where: { id: current.dependencyId, projectId } }) : null;
    }
  }

  private async loadScopedTask(companyId: string, id: string) {
    const task = await this.prisma.projectTask.findFirst({
      where: { id, project: { companyId, deletedAt: null } },
      include: { project: { select: { indicator: { select: { ownerNodeId: true } } } } },
    });
    if (!task) throw new NotFoundException('Tarefa não encontrada');
    return task;
  }

  // ----------------------------------------------------------------- Equipe

  async addMember(me: AuthPayload, projectId: string, body: any) {
    const project = await this.loadScoped(projectId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(project), 'edit');
    const data: any = {
      projectId,
      role: optionalText(body?.role, 'Papel no projeto', 120),
      allocation: has(body, 'allocation') && body.allocation !== null ? integerBetween(body.allocation, 0, 100, 'Dedicação (%)') : null,
    };
    if (body?.userId) {
      const user = await this.resolveUser(me.companyId, body.userId, 'Participante');
      data.userId = user.id;
      data.name = user.name;
    } else {
      data.name = requiredText(body?.name, 'Nome do participante');
    }
    try {
      return await (this.prisma as any).projectMember.create({ data });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Esta pessoa já faz parte da equipe do projeto.');
      throw error;
    }
  }

  async updateMember(me: AuthPayload, id: string, patch: any) {
    const member = await this.loadChild('projectMember', me.companyId, id, 'Participante não encontrado');
    await this.assertChildWrite(me, member);
    const data: any = {};
    if (has(patch, 'role')) data.role = optionalText(patch.role, 'Papel no projeto', 120);
    if (has(patch, 'allocation')) {
      data.allocation = patch.allocation === null ? null : integerBetween(patch.allocation, 0, 100, 'Dedicação (%)');
    }
    // O nome só é editável para participantes externos (sem usuário vinculado).
    if (has(patch, 'name') && !member.userId) data.name = requiredText(patch.name, 'Nome do participante');
    return (this.prisma as any).projectMember.update({ where: { id }, data });
  }

  async removeMember(me: AuthPayload, id: string) {
    const member = await this.loadChild('projectMember', me.companyId, id, 'Participante não encontrado');
    await this.assertChildWrite(me, member);
    return (this.prisma as any).projectMember.delete({ where: { id } });
  }

  // ----------------------------------------------------------------- Custos

  private costInput(body: any, partial: boolean) {
    const data: any = {};
    if (!partial || has(body, 'kind')) data.kind = oneOf(body?.kind ?? 'ACTUAL', COST_KINDS, 'Tipo do lançamento');
    if (!partial || has(body, 'description')) data.description = requiredText(body?.description, 'Descrição do lançamento', 240);
    if (!partial || has(body, 'amount')) data.amount = requiredAmount(body?.amount, 'Valor');
    if (!partial || has(body, 'date')) data.date = requiredDate(body?.date, 'Data do lançamento');
    if (has(body, 'category')) data.category = optionalText(body.category, 'Categoria', 80);
    if (has(body, 'notes')) data.notes = optionalText(body.notes, 'Observações', 2000);
    return data;
  }

  async addCost(me: AuthPayload, projectId: string, body: any) {
    const project = await this.loadScoped(projectId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(project), 'edit');
    const data = this.costInput(body, false);
    return (this.prisma as any).projectCost.create({ data: { ...data, projectId, createdById: me.sub } });
  }

  async updateCost(me: AuthPayload, id: string, patch: any) {
    const cost = await this.loadChild('projectCost', me.companyId, id, 'Lançamento não encontrado');
    await this.assertChildWrite(me, cost);
    return (this.prisma as any).projectCost.update({ where: { id }, data: this.costInput(patch, true) });
  }

  async removeCost(me: AuthPayload, id: string) {
    const cost = await this.loadChild('projectCost', me.companyId, id, 'Lançamento não encontrado');
    await this.assertChildWrite(me, cost);
    return (this.prisma as any).projectCost.delete({ where: { id } });
  }

  // ------------------------------------------------- Riscos e impedimentos

  private async riskInput(me: AuthPayload, body: any, current: any | null) {
    const data: any = {};
    if (!current || has(body, 'kind')) data.kind = oneOf(body?.kind ?? 'RISK', RISK_KINDS, 'Tipo');
    if (!current || has(body, 'title')) data.title = requiredText(body?.title, 'Título', 240);
    if (has(body, 'description')) data.description = optionalText(body.description, 'Descrição', 4000);
    if (has(body, 'response')) data.response = optionalText(body.response, 'Plano de resposta', 4000);
    if (has(body, 'probability')) data.probability = integerBetween(body.probability, 1, 5, 'Probabilidade');
    if (has(body, 'impact')) data.impact = integerBetween(body.impact, 1, 5, 'Impacto');
    if (has(body, 'dueDate')) data.dueDate = optionalDate(body.dueDate, 'Prazo');
    if (has(body, 'ownerName')) data.ownerName = optionalText(body.ownerName, 'Responsável', 180);
    if (has(body, 'ownerId')) {
      if (body.ownerId) {
        const owner = await this.resolveUser(me.companyId, body.ownerId, 'Responsável');
        data.ownerId = owner.id;
        data.ownerName = owner.name;
      } else {
        data.ownerId = null;
        if (current?.ownerId && !has(body, 'ownerName')) data.ownerName = null;
      }
    }
    if (has(body, 'status')) {
      data.status = oneOf(body.status, RISK_STATUSES, 'Situação');
      const closed = !OPEN_RISK_STATUSES.includes(data.status);
      const wasClosed = current ? !OPEN_RISK_STATUSES.includes(current.status) : false;
      if (closed && !wasClosed) data.resolvedAt = new Date();
      if (!closed) data.resolvedAt = null;
    }
    return data;
  }

  async addRisk(me: AuthPayload, projectId: string, body: any) {
    const project = await this.loadScoped(projectId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(project), 'edit');
    const data = await this.riskInput(me, body, null);
    return (this.prisma as any).projectRisk.create({ data: { ...data, projectId } });
  }

  async updateRisk(me: AuthPayload, id: string, patch: any) {
    const risk = await this.loadChild('projectRisk', me.companyId, id, 'Registro não encontrado');
    await this.assertChildWrite(me, risk);
    const data = await this.riskInput(me, patch, risk);
    return (this.prisma as any).projectRisk.update({ where: { id }, data });
  }

  async removeRisk(me: AuthPayload, id: string) {
    const risk = await this.loadChild('projectRisk', me.companyId, id, 'Registro não encontrado');
    await this.assertChildWrite(me, risk);
    return (this.prisma as any).projectRisk.delete({ where: { id } });
  }

  // ---------------------------------------------------------- Status report

  /** Registra o status report com o avanço calculado no momento do registro. */
  async addUpdate(me: AuthPayload, projectId: string, body: any) {
    const project = await this.loadScoped(projectId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(project), 'edit');
    const data: any = {
      projectId,
      authorId: me.sub,
      authorName: (me.name ?? '').trim() || me.email,
      health: oneOf(body?.health, HEALTHS, 'Saúde do projeto'),
      summary: requiredText(body?.summary, 'Resumo', 4000),
      achievements: optionalText(body?.achievements, 'Realizações', 4000),
      nextSteps: optionalText(body?.nextSteps, 'Próximos passos', 4000),
      blockers: optionalText(body?.blockers, 'Pontos de atenção', 4000),
      reportDate: optionalDate(body?.reportDate, 'Data do relato') ?? projectMeasurementDay(),
    };
    const current = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { tasks: true, milestones: true },
    });
    data.progress = projectProgress(current);
    return (this.prisma as any).projectUpdate.create({ data });
  }

  async removeUpdate(me: AuthPayload, id: string) {
    const update = await this.loadChild('projectUpdate', me.companyId, id, 'Status report não encontrado');
    await this.assertChildWrite(me, update);
    return (this.prisma as any).projectUpdate.delete({ where: { id } });
  }
}
