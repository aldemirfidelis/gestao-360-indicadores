import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionStatus, Prisma } from '@prisma/client';
import { ActionCreateInput } from '@g360/shared';

interface ActionFilter {
  companyId: string;
  status?: ActionStatus;
  responsibleUserId?: string;
  ownerNodeId?: string;
  overdue?: boolean;
  origin?: string;
}

@Injectable()
export class ActionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(f: ActionFilter) {
    const where: Prisma.ActionPlanWhereInput = {
      companyId: f.companyId,
      deletedAt: null,
      ...(f.status ? { status: f.status } : {}),
      ...(f.responsibleUserId ? { responsibleUserId: f.responsibleUserId } : {}),
      ...(f.ownerNodeId ? { ownerNodeId: f.ownerNodeId } : {}),
      ...(f.origin ? { origin: f.origin as any } : {}),
      ...(f.overdue
        ? {
            dueDate: { lt: new Date() },
            status: { notIn: [ActionStatus.DONE, ActionStatus.DONE_LATE, ActionStatus.CANCELLED] },
          }
        : {}),
    };
    return this.prisma.actionPlan.findMany({
      where,
      include: {
        ownerNode: { select: { id: true, name: true } },
        responsibleUser: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });
  }

  async getById(id: string) {
    const action = await this.prisma.actionPlan.findFirst({
      where: { id, deletedAt: null },
      include: {
        ownerNode: true,
        responsibleUser: true,
        createdBy: true,
        deviation: { select: { id: true, number: true, title: true } },
        tasks: { orderBy: { position: 'asc' } },
      },
    });
    if (!action) throw new NotFoundException('Acao nao encontrada');
    return action;
  }

  async create(input: ActionCreateInput, createdById: string) {
    return this.prisma.actionPlan.create({
      data: {
        companyId: input.companyId,
        title: input.title,
        description: input.description ?? null,
        origin: input.origin,
        originRefId: input.originRefId ?? null,
        responsibleUserId: input.responsibleUserId ?? null,
        ownerNodeId: input.ownerNodeId ?? null,
        priority: input.priority,
        status: input.status,
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
        estimatedCost: input.estimatedCost ?? null,
        createdById,
        deviationId: input.origin === 'DEVIATION' ? input.originRefId ?? null : null,
      },
    });
  }

  async update(id: string, patch: Prisma.ActionPlanUpdateInput) {
    return this.prisma.actionPlan.update({ where: { id }, data: patch });
  }

  async changeStatus(id: string, status: ActionStatus) {
    const action = await this.getById(id);
    let completedAt: Date | null = action.completedAt;
    let finalStatus = status;

    if (status === ActionStatus.DONE) {
      completedAt = new Date();
      if (action.dueDate && completedAt > action.dueDate) finalStatus = ActionStatus.DONE_LATE;
    }
    return this.prisma.actionPlan.update({
      where: { id },
      data: { status: finalStatus, completedAt },
    });
  }

  async addTask(actionId: string, title: string, dueDate?: Date) {
    const count = await this.prisma.actionTask.count({ where: { actionId } });
    return this.prisma.actionTask.create({
      data: { actionId, title, dueDate: dueDate ?? null, position: count },
    });
  }

  async toggleTask(taskId: string, done: boolean) {
    const t = await this.prisma.actionTask.update({
      where: { id: taskId },
      data: { done },
    });
    await this.recalcProgress(t.actionId);
    return t;
  }

  async recalcProgress(actionId: string) {
    const tasks = await this.prisma.actionTask.findMany({ where: { actionId } });
    if (tasks.length === 0) return;
    const done = tasks.filter((t) => t.done).length;
    const progress = Math.round((done / tasks.length) * 100);
    await this.prisma.actionPlan.update({ where: { id: actionId }, data: { progress } });
  }

  async remove(id: string) {
    return this.prisma.actionPlan.update({
      where: { id },
      data: { deletedAt: new Date(), status: ActionStatus.CANCELLED },
    });
  }
}
