import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { listTake } from '../../common/http/list-take';
import { Prisma, ProjectStatus } from '@prisma/client';
import { buildProjectCurve, projectExpectedProgress, projectMeasurementDay, projectProgress } from '@g360/shared';
import { AccessService } from '../access/access.service';
import type { AreaAction } from '../access/access.logic';
import { AuthPayload } from '../auth/auth.types';
import { withProjectProgressSnapshot } from './project-progress-snapshot';

// Projetos não têm área própria: derivam do indicador vinculado (quando houver).
// Projetos sem indicador são "gerais" (company-wide) e não restringem por área.
const MODULE = 'projects';
const FINAL_PROJECT_STATUSES = new Set<ProjectStatus>([ProjectStatus.DONE, ProjectStatus.CANCELLED]);

type ProjectListFilters = {
  indicatorId?: string;
  status?: ProjectStatus;
  search?: string;
};

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

  /** Carrega o projeto isolado por EMPRESA (defesa contra id de outra empresa) + área. */
  private async loadScoped(id: string, companyId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { indicator: { select: { ownerNodeId: true } } },
    });
    if (!project) throw new NotFoundException('Projeto não encontrado');
    return project;
  }

  private async withProgressSnapshot<T>(projectId: string, write: (tx: Prisma.TransactionClient) => Promise<T>) {
    return withProjectProgressSnapshot(this.prisma, projectId, write);
  }

  private enrichProject(p: any) {
    const now = new Date();
    const progressOverall = projectProgress(p);
    const milestones = p.milestones ?? [];
    const tasks = p.tasks ?? [];
    const milestonesDone = milestones.filter((m: any) => m.done).length;
    const milestonesOverdue = milestones.filter((m: any) => !m.done && m.dueDate && new Date(m.dueDate) < now).length;
    const tasksOverdue = tasks.filter((t: any) => (t.progress ?? 0) < 100 && t.endDate && new Date(t.endDate) < now).length;
    const expectedProgress = projectExpectedProgress(p, now);
    const scheduleVariance = expectedProgress === null ? null : progressOverall - expectedProgress;
    const isFinal = FINAL_PROJECT_STATUSES.has(p.status);
    const isPastEnd = Boolean(p.endsAt && new Date(p.endsAt) < now && !isFinal);
    const pmoStatus = isFinal
      ? 'FINALIZED'
      : isPastEnd || milestonesOverdue > 0 || tasksOverdue > 0
        ? 'CRITICAL'
        : scheduleVariance !== null && scheduleVariance < -15
          ? 'AT_RISK'
          : 'ON_TRACK';

    return {
      ...p,
      progressOverall,
      expectedProgress,
      scheduleVariance,
      pmoStatus,
      milestonesDone,
      milestonesOverdue,
      tasksOverdue,
    };
  }

  async list(me: AuthPayload, filters: ProjectListFilters = {}) {
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
        ],
      });
    }
    const items = await this.prisma.project.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(filters.indicatorId ? { indicatorId: filters.indicatorId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(and.length ? { AND: and } : {}),
      },
      include: {
        _count: { select: { tasks: true, milestones: true } },
        milestones: { orderBy: { dueDate: 'asc' } },
        tasks: { select: { progress: true, startDate: true, endDate: true } },
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
      },
      orderBy: { createdAt: 'desc' },
      take: listTake(),
    });
    return items.map((p) => this.enrichProject(p));
  }

  async portfolio(me: AuthPayload, filters: ProjectListFilters = {}) {
    const projects = await this.list(me, filters);
    const activeProjects = projects.filter((p: any) => !FINAL_PROJECT_STATUSES.has(p.status));
    const statusCounts = Object.fromEntries(Object.values(ProjectStatus).map((status) => [status, 0])) as Record<ProjectStatus, number>;
    for (const p of projects as any[]) statusCounts[p.status as ProjectStatus]++;
    const budgetTotal = projects.reduce((sum: number, p: any) => sum + (p.budget ?? 0), 0);
    const activeBudget = activeProjects.reduce((sum: number, p: any) => sum + (p.budget ?? 0), 0);
    const avgProgress = projects.length
      ? Math.round(projects.reduce((sum: number, p: any) => sum + p.progressOverall, 0) / projects.length)
      : 0;
    const milestonesTotal = projects.reduce((sum: number, p: any) => sum + (p.milestones?.length ?? 0), 0);
    const milestonesDone = projects.reduce((sum: number, p: any) => sum + (p.milestonesDone ?? 0), 0);
    const milestonesOverdue = projects.reduce((sum: number, p: any) => sum + (p.milestonesOverdue ?? 0), 0);
    const tasksTotal = projects.reduce((sum: number, p: any) => sum + (p._count?.tasks ?? p.tasks?.length ?? 0), 0);
    const tasksOverdue = projects.reduce((sum: number, p: any) => sum + (p.tasksOverdue ?? 0), 0);
    const behindSchedule = projects.filter((p: any) => p.pmoStatus === 'AT_RISK').length;
    const criticalProjects = (projects as any[])
      .filter((p) => p.pmoStatus === 'CRITICAL' || p.pmoStatus === 'AT_RISK')
      .sort((a, b) => {
        const order = { CRITICAL: 0, AT_RISK: 1 } as Record<string, number>;
        return (order[a.pmoStatus] ?? 9) - (order[b.pmoStatus] ?? 9);
      })
      .slice(0, 8)
      .map((p) => ({
        id: p.id,
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
      budgetTotal,
      activeBudget,
      avgProgress,
      milestonesTotal,
      milestonesDone,
      milestonesOverdue,
      tasksTotal,
      tasksOverdue,
      behindSchedule,
      criticalProjects,
      timeline: (projects as any[]).map((p) => ({
        id: p.id,
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

  async getById(me: AuthPayload, id: string) {
    const proj = await this.prisma.project.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: {
        milestones: { orderBy: { dueDate: 'asc' } },
        progressSnapshots: { orderBy: { measuredOn: 'asc' } },
        tasks: {
          orderBy: { position: 'asc' },
          include: { dependency: { select: { id: true, name: true } } },
        },
        indicator: {
          include: {
            ownerNode: { select: { id: true, name: true } },
            results: { orderBy: { periodDate: 'desc' }, take: 12 },
          },
        },
      },
    });
    if (!proj) throw new NotFoundException('Projeto não encontrado');
    // Restrição por área (leitura): projeto vinculado a indicador de área não permitida.
    const area = proj.indicator?.ownerNodeId ?? null;
    if (area) {
      const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
      if (permitted && !permitted.includes(area)) {
        throw new ForbiddenException('Você não tem acesso aos projetos desta área.');
      }
    }
    return { ...this.enrichProject(proj), curve: buildProjectCurve(proj) };
  }

  async create(me: AuthPayload, body: { name: string; description?: string; startsAt?: string; endsAt?: string; responsible?: string; budget?: number; status?: ProjectStatus; indicatorId?: string }) {
    let area: string | null = null;
    if (body.indicatorId) {
      const ind = await this.prisma.indicator.findFirst({
        where: { id: body.indicatorId, companyId: me.companyId, deletedAt: null },
        select: { ownerNodeId: true },
      });
      if (!ind) throw new NotFoundException('Indicador não encontrado');
      area = ind.ownerNodeId;
    }
    await this.assertWriteArea(me, area, 'create');
    return this.prisma.project.create({
      data: {
        companyId: me.companyId,
        name: body.name,
        description: body.description ?? null,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        responsible: body.responsible ?? null,
        budget: body.budget ?? null,
        status: body.status ?? ProjectStatus.PLANNED,
        indicatorId: body.indicatorId || null,
        progressSnapshots: { create: { measuredOn: projectMeasurementDay(), progress: 0 } },
      },
    });
  }

  async update(me: AuthPayload, id: string, patch: any) {
    const project = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(project), 'edit');
    // Aceita somente campos editáveis; relações e medições não vêm do cliente.
    const data: any = {};
    for (const key of ['name', 'description', 'startsAt', 'endsAt', 'responsible', 'budget', 'status', 'indicatorId']) {
      if (patch?.[key] !== undefined) data[key] = patch[key];
    }
    if (data.startsAt) data.startsAt = new Date(data.startsAt);
    if (data.endsAt) data.endsAt = new Date(data.endsAt);
    if (data.indicatorId === '') data.indicatorId = null;
    // Trocar o indicador exige poder escrever também na área de destino.
    if (data.indicatorId) {
      const ind = await this.prisma.indicator.findFirst({
        where: { id: data.indicatorId, companyId: me.companyId, deletedAt: null },
        select: { ownerNodeId: true },
      });
      if (!ind) throw new NotFoundException('Indicador não encontrado');
      await this.assertWriteArea(me, ind.ownerNodeId, 'edit');
    }
    return this.prisma.project.update({ where: { id }, data });
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

  async remove(me: AuthPayload, id: string) {
    const project = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(project), 'delete');
    return this.prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async addMilestone(me: AuthPayload, projectId: string, name: string, dueDate: string) {
    const project = await this.loadScoped(projectId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(project), 'edit');
    return this.withProgressSnapshot(projectId, (tx) => tx.projectMilestone.create({
      data: { projectId, name, dueDate: new Date(dueDate) },
    }));
  }

  async toggleMilestone(me: AuthPayload, id: string, done: boolean) {
    const ms = await this.prisma.projectMilestone.findFirst({
      where: { id, project: { companyId: me.companyId, deletedAt: null } },
      include: { project: { select: { indicator: { select: { ownerNodeId: true } } } } },
    });
    if (!ms) throw new NotFoundException('Marco não encontrado');
    await this.assertWriteArea(me, ms.project.indicator?.ownerNodeId ?? null, 'edit');
    if (typeof done !== 'boolean') throw new BadRequestException('Informe se o marco foi concluído.');
    return this.withProgressSnapshot(ms.projectId, (tx) => tx.projectMilestone.update({ where: { id }, data: { done } }));
  }

  async addTask(me: AuthPayload, projectId: string, body: {
    name: string;
    startDate?: string;
    endDate?: string;
    responsible?: string;
    dependencyId?: string;
  }) {
    const project = await this.loadScoped(projectId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(project), 'edit');
    return this.withProgressSnapshot(projectId, async (tx) => {
      if (body.dependencyId) await this.assertDependency(tx, projectId, body.dependencyId);
      const count = await tx.projectTask.count({ where: { projectId } });
      return tx.projectTask.create({
        data: {
          projectId,
          name: body.name,
          startDate: body.startDate ? new Date(body.startDate) : null,
          endDate: body.endDate ? new Date(body.endDate) : null,
          responsible: body.responsible ?? null,
          dependencyId: body.dependencyId || null,
          position: count,
        },
      });
    });
  }

  async updateTask(me: AuthPayload, id: string, patch: any) {
    const task = await this.loadScopedTask(me.companyId, id);
    await this.assertWriteArea(me, task.project.indicator?.ownerNodeId ?? null, 'edit');
    const data: Prisma.ProjectTaskUncheckedUpdateInput = {};
    for (const key of ['name', 'responsible', 'position'] as const) {
      if (patch?.[key] !== undefined) (data as any)[key] = patch[key];
    }
    if (patch?.progress !== undefined) {
      if (typeof patch.progress !== 'number' || !Number.isFinite(patch.progress) || patch.progress < 0 || patch.progress > 100) {
        throw new BadRequestException('O progresso deve estar entre 0 e 100.');
      }
      data.progress = patch.progress;
    }
    for (const key of ['startDate', 'endDate'] as const) {
      if (patch?.[key] !== undefined) data[key] = patch[key] ? new Date(patch[key]) : null;
    }
    if (patch?.dependencyId !== undefined) data.dependencyId = patch.dependencyId || null;
    return this.withProgressSnapshot(task.projectId, async (tx) => {
      if (patch?.dependencyId) await this.assertDependency(tx, task.projectId, patch.dependencyId, id);
      return tx.projectTask.update({ where: { id }, data });
    });
  }

  async removeTask(me: AuthPayload, id: string) {
    const task = await this.loadScopedTask(me.companyId, id);
    await this.assertWriteArea(me, task.project.indicator?.ownerNodeId ?? null, 'edit');
    return this.withProgressSnapshot(task.projectId, (tx) => tx.projectTask.delete({ where: { id } }));
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
}
