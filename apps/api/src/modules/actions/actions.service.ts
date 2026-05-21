import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionStatus, Prisma, TraceEntityType, TraceEventType, TreatmentStatus } from '@prisma/client';
import { ActionCreateInput } from '@g360/shared';
import { TraceabilityService } from '../traceability/traceability.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
  ) {}

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
    const action = await this.prisma.actionPlan.create({
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
    const ctx = await this.actionTraceContext(action.id);
    await this.traceability.record({
      companyId: action.companyId,
      indicatorId: ctx.indicatorId,
      userId: createdById,
      eventType: TraceEventType.ACTION_CREATED,
      entityType: TraceEntityType.ACTION_PLAN,
      entityId: action.id,
      title: 'Plano de acao criado',
      description: action.title,
      statusTo: action.status,
      metadata: { origin: action.origin, priority: action.priority, dueDate: action.dueDate },
    });
    return action;
  }

  async update(id: string, patch: Prisma.ActionPlanUpdateInput) {
    return this.prisma.actionPlan.update({ where: { id }, data: patch });
  }

  async changeStatus(id: string, status: ActionStatus, userId?: string) {
    const action = await this.getById(id);
    let completedAt: Date | null = action.completedAt;
    let finalStatus = status;

    if (status === ActionStatus.DONE) {
      completedAt = new Date();
      if (action.dueDate && completedAt > action.dueDate) finalStatus = ActionStatus.DONE_LATE;
    }
    const updated = await this.prisma.actionPlan.update({
      where: { id },
      data: { status: finalStatus, completedAt },
    });
    const ctx = await this.actionTraceContext(id);
    if (ctx.treatmentId) {
      await this.updateTreatmentFromActions(ctx.treatmentId);
    }
    await this.traceability.record({
      companyId: updated.companyId,
      indicatorId: ctx.indicatorId,
      userId,
      eventType: TraceEventType.ACTION_STATUS_CHANGED,
      entityType: TraceEntityType.ACTION_PLAN,
      entityId: id,
      title: 'Status do plano de acao alterado',
      description: updated.title,
      statusFrom: action.status,
      statusTo: updated.status,
      metadata: { progress: updated.progress, completedAt: updated.completedAt },
    });
    return updated;
  }

  async addTask(actionId: string, title: string, dueDate?: Date) {
    const count = await this.prisma.actionTask.count({ where: { actionId } });
    const task = await this.prisma.actionTask.create({
      data: { actionId, title, dueDate: dueDate ?? null, position: count },
    });
    const ctx = await this.actionTraceContext(actionId);
    await this.traceability.record({
      companyId: ctx.companyId,
      indicatorId: ctx.indicatorId,
      eventType: TraceEventType.TASK_UPDATED,
      entityType: TraceEntityType.ACTION_TASK,
      entityId: task.id,
      relatedType: TraceEntityType.ACTION_PLAN,
      relatedId: actionId,
      title: 'Tarefa criada no plano de acao',
      description: task.title,
      metadata: { dueDate: task.dueDate },
    });
    return task;
  }

  async toggleTask(taskId: string, done: boolean) {
    const t = await this.prisma.actionTask.update({
      where: { id: taskId },
      data: { done },
    });
    await this.recalcProgress(t.actionId);
    const ctx = await this.actionTraceContext(t.actionId);
    await this.traceability.record({
      companyId: ctx.companyId,
      indicatorId: ctx.indicatorId,
      eventType: TraceEventType.TASK_UPDATED,
      entityType: TraceEntityType.ACTION_TASK,
      entityId: taskId,
      relatedType: TraceEntityType.ACTION_PLAN,
      relatedId: t.actionId,
      title: done ? 'Tarefa concluida' : 'Tarefa reaberta',
      description: t.title,
      statusTo: done ? 'DONE' : 'OPEN',
    });
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
    const removed = await this.prisma.actionPlan.update({
      where: { id },
      data: { deletedAt: new Date(), status: ActionStatus.CANCELLED },
    });
    const ctx = await this.actionTraceContext(id);
    await this.traceability.record({
      companyId: removed.companyId,
      indicatorId: ctx.indicatorId,
      eventType: TraceEventType.STATUS_CHANGED,
      entityType: TraceEntityType.ACTION_PLAN,
      entityId: id,
      title: 'Plano de acao cancelado',
      description: removed.title,
      statusTo: ActionStatus.CANCELLED,
    });
    return removed;
  }

  private async actionTraceContext(actionId: string) {
    const action = await this.prisma.actionPlan.findUnique({
      where: { id: actionId },
      select: {
        companyId: true,
        indicatorId: true,
        treatmentId: true,
        deviation: { select: { indicatorId: true } },
        origin: true,
        originRefId: true,
      },
    });
    if (!action) throw new NotFoundException('Acao nao encontrada');
    let indicatorId = action.indicatorId ?? action.deviation?.indicatorId ?? null;
    if (!indicatorId && action.origin === 'INDICATOR') indicatorId = action.originRefId;
    return { companyId: action.companyId, indicatorId, treatmentId: action.treatmentId };
  }

  private async updateTreatmentFromActions(treatmentId: string) {
    const actions = await this.prisma.actionPlan.findMany({
      where: { treatmentId, deletedAt: null },
      select: { status: true, dueDate: true },
    });
    if (actions.length === 0) return;
    const now = new Date();
    const finalStatuses: ActionStatus[] = [ActionStatus.DONE, ActionStatus.DONE_LATE, ActionStatus.CANCELLED];
    const allDone = actions.every((action) => finalStatuses.includes(action.status));
    const hasOverdue = actions.some((action) => action.dueDate && action.dueDate < now && !finalStatuses.includes(action.status));
    const status = allDone
      ? TreatmentStatus.AWAITING_REEVALUATION
      : hasOverdue
        ? TreatmentStatus.ACTIONS_OVERDUE
        : TreatmentStatus.ACTIONS_IN_PROGRESS;
    await this.prisma.treatmentCase.update({ where: { id: treatmentId }, data: { status } });
  }
}
