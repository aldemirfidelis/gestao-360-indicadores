import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectStatus } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string) {
    const items = await this.prisma.project.findMany({
      where: { companyId, deletedAt: null },
      include: {
        _count: { select: { tasks: true, milestones: true } },
        milestones: { orderBy: { dueDate: 'asc' } },
        tasks: { select: { progress: true } },
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
    });
    return items.map((p) => ({
      ...p,
      progressOverall: this.projectProgress(p as any),
    }));
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

  async getById(id: string) {
    const proj = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
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
    return { ...proj, progressOverall: this.projectProgress(proj as any) };
  }

  async create(companyId: string, body: { name: string; description?: string; startsAt?: string; endsAt?: string; responsible?: string; budget?: number; status?: ProjectStatus; indicatorId?: string }) {
    return this.prisma.project.create({
      data: {
        companyId,
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

  async update(id: string, patch: any) {
    const data: any = { ...patch };
    if (data.startsAt) data.startsAt = new Date(data.startsAt);
    if (data.endsAt) data.endsAt = new Date(data.endsAt);
    if (data.indicatorId === '') data.indicatorId = null;
    return this.prisma.project.update({ where: { id }, data });
  }

  async listIndicators(companyId: string) {
    return this.prisma.indicator.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, name: true, code: true, unit: true, unitLabel: true, direction: true },
      orderBy: { name: 'asc' },
    });
  }

  async remove(id: string) {
    return this.prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async addMilestone(projectId: string, name: string, dueDate: string) {
    return this.prisma.projectMilestone.create({
      data: { projectId, name, dueDate: new Date(dueDate) },
    });
  }

  async toggleMilestone(id: string, done: boolean) {
    return this.prisma.projectMilestone.update({ where: { id }, data: { done } });
  }

  async addTask(projectId: string, body: {
    name: string;
    startDate?: string;
    endDate?: string;
    responsible?: string;
    dependencyId?: string;
  }) {
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

  async updateTask(id: string, patch: any) {
    if (patch.startDate) patch.startDate = new Date(patch.startDate);
    if (patch.endDate) patch.endDate = new Date(patch.endDate);
    return this.prisma.projectTask.update({ where: { id }, data: patch });
  }

  async removeTask(id: string) {
    return this.prisma.projectTask.delete({ where: { id } });
  }
}
