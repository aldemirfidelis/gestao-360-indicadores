import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkItemEventBus } from '../../my-day/work-item-event-bus';

@Injectable()
export class WorkflowApprovalService {
  private readonly logger = new Logger(WorkflowApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workItemBus: WorkItemEventBus,
  ) {}

  async createApproval(
    instance: any,
    nodeKey: string,
    nodeConfig: any,
    context: any
  ): Promise<any> {
    const companyId = instance.companyId;

    // Resolve approver ID
    const approverId = await this.resolveApprover(
      companyId,
      nodeConfig.approver,
      instance,
      context
    );

    // Calculate due date
    let dueAt: Date | null = null;
    if (nodeConfig.dueDateOffsetDays) {
      dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + Number(nodeConfig.dueDateOffsetDays));
    }

    const approval = await this.prisma.workflowApproval.create({
      data: {
        companyId,
        workflowInstanceId: instance.id,
        nodeKey,
        approvalType: nodeConfig.approvalType || 'SIMPLE',
        status: 'PENDING',
        approverId,
        dueAt,
      },
    });

    // Notify approver
    if (approverId) {
      await this.prisma.notification.create({
        data: {
          companyId,
          userId: approverId,
          title: `Solicitação de Aprovação`,
          body: nodeConfig.description || 'Uma nova aprovação foi solicitada de você.',
          kind: 'MEETING_UPCOMING', // Or custom notification type
        },
      });
    }

    this.workItemBus.markDirty(companyId, [approverId], 'approval.created');
    return approval;
  }

  async resolveApprover(
    companyId: string,
    config: any,
    instance: any,
    context: any
  ): Promise<string | null> {
    if (!config) return null;

    const type = config.type;

    switch (type) {
      case 'USER':
        if (!config.userId) return null;
        return (
          await this.prisma.user.findFirst({
            where: { id: config.userId, companyId, active: true },
            select: { id: true },
          })
        )?.id ?? null;

      case 'ROLE':
        const roleUsers = await this.prisma.user.findMany({
          where: { companyId, role: config.role, active: true },
          select: { id: true },
        });
        return roleUsers.length > 0 ? roleUsers[0].id : null;

      case 'SECTOR_MANAGER':
        if (context.ownerNodeId) {
          const node = await this.prisma.orgNode.findFirst({
            where: { id: context.ownerNodeId, companyId },
          });
          return node?.responsibleUserId || null;
        }
        return null;

      case 'CREATOR':
        if (!instance.sourceEventId) return null;
        const creatorEvent = await this.prisma.workflowEvent.findFirst({ where: { id: instance.sourceEventId, companyId } });
        return creatorEvent?.eventPayload ? JSON.parse(creatorEvent.eventPayload || '{}').userId || null : null;

      default:
        const admin = await this.prisma.user.findFirst({
          where: { companyId, role: 'COMPANY_ADMIN', active: true },
          select: { id: true },
        });
        return admin?.id || null;
    }
  }

  async submitDecision(
    companyId: string,
    approvalId: string,
    decision: 'APPROVED' | 'REJECTED' | 'CHANGES',
    comments: string,
    userId: string
  ): Promise<any> {
    const approval = await this.prisma.workflowApproval.findFirst({
      where: { id: approvalId, companyId },
    });

    if (!approval || approval.status !== 'PENDING') {
      throw new Error('Approval not found or already completed.');
    }

    const updatedApproval = await this.prisma.workflowApproval.update({
      where: { id: approvalId },
      data: {
        status: decision === 'APPROVED' ? 'APPROVED' : decision === 'REJECTED' ? 'REJECTED' : 'CHANGES_REQUESTED',
        decision,
        comments,
        respondedAt: new Date(),
      },
    });

    // Notify requester if applicable
    if (approval.requesterId) {
      await this.prisma.notification.create({
        data: {
          companyId,
          userId: approval.requesterId,
          title: `Decisão de aprovação registrada: ${decision}`,
          body: `Sua solicitação de aprovação foi avaliada como ${decision}. Comentários: ${comments}`,
          kind: 'MEETING_UPCOMING',
        },
      });
    }

    this.workItemBus.markDirty(companyId, [approval.approverId, approval.requesterId], 'approval.decided');
    return updatedApproval;
  }
}
