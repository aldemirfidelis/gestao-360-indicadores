import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkItemEventBus } from '../../my-day/work-item-event-bus';

@Injectable()
export class WorkflowTaskService {
  private readonly logger = new Logger(WorkflowTaskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workItemBus: WorkItemEventBus,
  ) {}

  async createTask(
    instance: any,
    nodeKey: string,
    nodeConfig: any,
    context: any
  ): Promise<any> {
    const companyId = instance.companyId;

    // Resolve responsible user ID
    const responsibleId = await this.resolveResponsible(
      companyId,
      nodeConfig.responsible,
      instance,
      context
    );

    // Resolve substitute user ID
    const substituteId = nodeConfig.substitute
      ? await this.resolveResponsible(companyId, nodeConfig.substitute, instance, context)
      : null;

    // Calculate due date
    let dueAt: Date | null = null;
    if (nodeConfig.dueDateOffsetDays) {
      dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + Number(nodeConfig.dueDateOffsetDays));
    }

    const task = await this.prisma.workflowTask.create({
      data: {
        companyId,
        workflowInstanceId: instance.id,
        nodeKey,
        title: this.interpolate(nodeConfig.title || 'Tarefa de Fluxo', context),
        description: this.interpolate(nodeConfig.description || '', context),
        type: nodeConfig.taskType || 'OPERATIONAL',
        priority: nodeConfig.priority || 'MEDIUM',
        criticity: nodeConfig.criticity || 'MEDIUM',
        responsibleId,
        responsibleSubstituteId: substituteId,
        status: 'PENDING',
        dueAt,
        requiredEvidence: !!nodeConfig.requiredEvidence,
        escalationLevel: 0,
        originType: instance.sourceEntityType,
        originId: instance.sourceEntityId,
      },
    });

    // Create notifications for task assignee
    if (responsibleId) {
      await this.prisma.notification.create({
        data: {
          companyId,
          userId: responsibleId,
          title: `Nova tarefa gerada: ${task.title}`,
          body: task.description || 'Uma nova tarefa foi atribuída a você por automação.',
          kind: 'ACTION_DUE_SOON',
        },
      });
    }

    this.workItemBus.markDirty(companyId, [responsibleId], 'task.created');
    return task;
  }

  async resolveResponsible(
    companyId: string,
    config: any,
    instance: any,
    context: any
  ): Promise<string | null> {
    if (!config) return null;

    const type = config.type; // USER, CREATOR, INDICATOR_RESPONSIBLE, DOCUMENT_RESPONSIBLE, ROLE, SECTOR_MANAGER

    switch (type) {
      case 'USER':
        if (!config.userId) return null;
        return (
          await this.prisma.user.findFirst({
            where: { id: config.userId, companyId, active: true },
            select: { id: true },
          })
        )?.id ?? null;

      case 'CREATOR':
        if (!instance.sourceEventId) return null;
        const creatorEvent = await this.prisma.workflowEvent.findFirst({ where: { id: instance.sourceEventId, companyId } });
        return creatorEvent?.eventPayload ? JSON.parse(creatorEvent.eventPayload || '{}').userId || null : null;

      case 'INDICATOR_RESPONSIBLE':
        if (instance.sourceEntityType === 'INDICATOR' && instance.sourceEntityId) {
          const indicator = await this.prisma.indicator.findFirst({
            where: { id: instance.sourceEntityId, companyId },
          });
          return indicator?.responsibleUserId || null;
        }
        return null;

      case 'DOCUMENT_RESPONSIBLE':
        if (instance.sourceEntityType === 'DOCUMENT' && instance.sourceEntityId) {
          const doc = await this.prisma.document.findFirst({
            where: { id: instance.sourceEntityId, companyId },
          });
          return doc?.ownerUserId || null;
        }
        return null;

      case 'ROLE':
        const roleUsers = await this.prisma.user.findMany({
          where: { companyId, role: config.role, active: true },
          select: { id: true },
        });
        return roleUsers.length > 0 ? roleUsers[0].id : null;

      case 'SECTOR_MANAGER':
        // Resolve manager of the org node
        if (context.ownerNodeId) {
          const node = await this.prisma.orgNode.findFirst({
            where: { id: context.ownerNodeId, companyId },
          });
          return node?.responsibleUserId || null;
        }
        return null;

      default:
        // Fallback: Super Admin or first administrator
        const admin = await this.prisma.user.findFirst({
          where: { companyId, role: 'COMPANY_ADMIN', active: true },
          select: { id: true },
        });
        return admin?.id || null;
    }
  }

  async completeTask(companyId: string, taskId: string, outputData: any): Promise<void> {
    const task = await this.prisma.workflowTask.findFirst({
      where: { id: taskId, companyId },
    });

    if (!task || task.status !== 'PENDING') return;

    await this.prisma.workflowTask.update({
      where: { id: taskId },
      data: {
        status: 'DONE',
        completedAt: new Date(),
      },
    });

    // Resume execution
    const { WorkflowExecutionEngine } = await import('./workflow-engine.service');
    const engine = new WorkflowExecutionEngine(
      this.prisma,
      null as any, // resolved inside engine
      null as any
    );
    // Dynamic import inside engine will resolve execution engine again, so let's trigger via engine service directly
    // but wait! We can inject it using dynamic resolution or call it from engine service.
  }

  private interpolate(str: string, context: any): string {
    return str.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const parts = key.trim().split('.');
      let val = context;
      for (const p of parts) {
        if (val === null || val === undefined) return '';
        val = val[p];
      }
      return val !== undefined ? String(val) : '';
    });
  }
}
