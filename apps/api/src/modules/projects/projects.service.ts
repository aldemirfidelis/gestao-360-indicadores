import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { listTake } from '../../common/http/list-take';
import { ProjectStatus } from '@prisma/client';
import { AccessService } from '../access/access.service';
import type { AreaAction } from '../access/access.logic';
import { AuthPayload } from '../auth/auth.types';

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
    if (!project) throw new NotFoundException('Projeto nao encontrado');
    return project;
  }

  private expectedProgress(startsAt?: Date | string | null, endsAt?: Date | string | null, now = new Date()) {
    if (!startsAt || !endsAt) return null;
    const start = new Date(startsAt).getTime();
    const end = new Date(endsAt).getTime();
    const current = now.getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    if (current <= start) return 0;
    if (current >= end) return 100;
    return Math.round(((current - start) / (end - start)) * 100);
  }

  private enrichProject(p: any) {
    const now = new Date();
    const progressOverall = this.projectProgress(p as any);
    const milestones = p.milestones ?? [];
    const tasks = p.tasks ?? [];
    const milestonesDone = milestones.filter((m: any) => m.done).length;
    const milestonesOverdue = milestones.filter((m: any) => !m.done && m.dueDate && new Date(m.dueDate) < now).length;
    const tasksOverdue = tasks.filter((t: any) => (t.progress ?? 0) < 100 && t.endDate && new Date(t.endDate) < now).length;
    const expectedProgress = this.expectedProgress(p.startsAt, p.endsAt, now);
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

  private projectProgress(p: { milestones: { done: boolean }[]; tasks?: { progress: number }[] }) {
    const taskProgress = p.tasks && p.tasks.length > 0
      ? p.tasks.reduce((acc, t) => acc + (t.progress ?? 0), 0) / p.tasks.length
      : null;
    const msProgress = p.milestones.length > 0
      ? (p.milestones.filter((m) => m.done).length / p.milestones.length) * 100
      : null;
    if (taskProgress !== null && msProgress !== null) return Math.round((taskProgress + msProgress) / 2);
    if (taskProgress !== null) return Math.round(taskProgress);
    if (msProgress !== null) return Math.round(msProgress);
    return 0;
  }

  async getById(me: AuthPayload, id: string) {
    const proj = await this.prisma.project.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: {
        milestones: { orderBy: { dueDate: 'asc' } },
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
    if (!proj) throw new NotFoundException('Projeto nao encontrado');
    // Restrição por área (leitura): projeto vinculado a indicador de área não permitida.
    const area = proj.indicator?.ownerNodeId ?? null;
    if (area) {
      const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
      if (permitted && !permitted.includes(area)) {
        throw new ForbiddenException('Você não tem acesso aos projetos desta área.');
      }
    }
    return this.enrichProject(proj);
  }

  async create(me: AuthPayload, body: { name: string; description?: string; startsAt?: string; endsAt?: string; responsible?: string; budget?: number; status?: ProjectStatus; indicatorId?: string }) {
    let area: string | null = null;
    if (body.indicatorId) {
      const ind = await this.prisma.indicator.findFirst({
        where: { id: body.indicatorId, companyId: me.companyId, deletedAt: null },
        select: { ownerNodeId: true },
      });
      if (!ind) throw new NotFoundException('Indicador nao encontrado');
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
      },
    });
  }

  async update(me: AuthPayload, id: string, patch: any) {
    const project = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(project), 'edit');
    const { companyId: _c, id: _i, ...rest } = patch ?? {};
    const data: any = { ...rest };
    if (data.startsAt) data.startsAt = new Date(data.startsAt);
    if (data.endsAt) data.endsAt = new Date(data.endsAt);
    if (data.indicatorId === '') data.indicatorId = null;
    // Trocar o indicador exige poder escrever também na área de destino.
    if (data.indicatorId) {
      const ind = await this.prisma.indicator.findFirst({
        where: { id: data.indicatorId, companyId: me.companyId, deletedAt: null },
        select: { ownerNodeId: true },
      });
      if (!ind) throw new NotFoundException('Indicador nao encontrado');
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
    return this.prisma.projectMilestone.create({
      data: { projectId, name, dueDate: new Date(dueDate) },
    });
  }

  async toggleMilestone(me: AuthPayload, id: string, done: boolean) {
    const ms = await this.prisma.projectMilestone.findFirst({
      where: { id, project: { companyId: me.companyId, deletedAt: null } },
      include: { project: { select: { indicator: { select: { ownerNodeId: true } } } } },
    });
    if (!ms) throw new NotFoundException('Marco nao encontrado');
    await this.assertWriteArea(me, ms.project.indicator?.ownerNodeId ?? null, 'edit');
    return this.prisma.projectMilestone.update({ where: { id }, data: { done } });
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
    const count = await this.prisma.projectTask.count({ where: { projectId } });
    return this.prisma.projectTask.create({
      data: {
        projectId,
        name: body.name,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        responsible: body.responsible ?? null,
        dependencyId: body.dependencyId ?? null,
        position: count,
      },
    });
  }

  async updateTask(me: AuthPayload, id: string, patch: any) {
    const task = await this.loadScopedTask(me.companyId, id);
    await this.assertWriteArea(me, task.project.indicator?.ownerNodeId ?? null, 'edit');
    const { id: _i, projectId: _p, ...data } = patch ?? {};
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    return this.prisma.projectTask.update({ where: { id }, data });
  }

  async removeTask(me: AuthPayload, id: string) {
    const task = await this.loadScopedTask(me.companyId, id);
    await this.assertWriteArea(me, task.project.indicator?.ownerNodeId ?? null, 'edit');
    return this.prisma.projectTask.delete({ where: { id } });
  }

  private async loadScopedTask(companyId: string, id: string) {
    const task = await this.prisma.projectTask.findFirst({
      where: { id, project: { companyId, deletedAt: null } },
      include: { project: { select: { indicator: { select: { ownerNodeId: true } } } } },
    });
    if (!task) throw new NotFoundException('Tarefa nao encontrada');
    return task;
  }
}
