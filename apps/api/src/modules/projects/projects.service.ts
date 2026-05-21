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
      },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((p) => ({
      ...p,
      progressOverall: this.projectProgress(p as any),
    }));
  }

  private projectProgress(p: { milestones: { done: boolean }[] }) {
    if (p.milestones.length === 0) return 0;
    return Math.round((p.milestones.filter((m) => m.done).length / p.milestones.length) * 100);
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
      },
    });
    if (!proj) throw new NotFoundException('Projeto nao encontrado');
    return { ...proj, progressOverall: this.projectProgress(proj as any) };
  }

  async create(companyId: string, body: { name: string; description?: string; startsAt?: string; endsAt?: string; responsible?: string; budget?: number; status?: ProjectStatus }) {
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
      },
    });
  }

  async update(id: string, patch: any) {
    return this.prisma.project.update({ where: { id }, data: patch });
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
