import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkflowQueueAdapter } from './workflow-queue.adapter';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class WorkflowEventDispatcher {
  private readonly logger = new Logger(WorkflowEventDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueAdapter: WorkflowQueueAdapter,
    private readonly moduleRef: ModuleRef
  ) {}

  async dispatchEvent(
    companyId: string,
    eventType: string,
    entityType: string,
    entityId: string,
    payload: any,
    tx?: any
  ): Promise<void> {
    const db = tx || this.prisma;
    const payloadStr = JSON.stringify(payload);

    // Idempotency: prevent double triggers in a 5-second window
    const timeBucket = Math.floor(Date.now() / 5000);
    const idempotencyKey = `evt:${companyId}:${eventType}:${entityId}:${timeBucket}`;

    try {
      // Check if event already exists
      const existing = await db.workflowEvent.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        this.logger.warn(`Duplicate event ignored (idempotency): ${idempotencyKey}`);
        return;
      }

      // Create PENDING event
      const event = await db.workflowEvent.create({
        data: {
          companyId,
          eventType,
          entityType,
          entityId,
          eventPayload: payloadStr,
          idempotencyKey,
          status: 'PENDING',
        },
      });

      // Queue event for processing
      await this.queueAdapter.enqueue('process_event', { companyId, eventId: event.id });
    } catch (error: any) {
      this.logger.error(`Failed to dispatch event ${eventType} for entity ${entityId}: ${error.message}`, error.stack);
    }
  }

  async processEvent(eventId: string, companyId?: string): Promise<void> {
    const event = await this.prisma.workflowEvent.findFirst({
      where: { id: eventId, ...(companyId ? { companyId } : {}) },
    });

    if (!event || event.status !== 'PENDING') {
      return;
    }

    this.logger.log(`Processing workflow event: ${event.eventType} for entity ${event.entityId}`);

    try {
      // Update status to RUNNING / PROCESSING
      await this.prisma.workflowEvent.update({
        where: { id: eventId },
        data: { attemptCount: { increment: 1 } },
      });

      // Find active workflows matching this trigger event
      const workflows = await this.prisma.workflowDefinition.findMany({
        where: {
          companyId: event.companyId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        include: {
          versions: {
            where: { status: 'PUBLISHED' },
            include: {
              nodes: {
                where: {
                  nodeType: 'TRIGGER',
                  blockType: event.eventType,
                },
              },
            },
          },
        },
      });

      const matchedWorkflows = workflows.filter(
        (w) => w.versions.length > 0 && w.versions[0].nodes.length > 0
      );

      this.logger.log(`Found ${matchedWorkflows.length} active workflows matching event ${event.eventType}`);

      const { WorkflowExecutionEngine } = await import('./workflow-engine.service');
      const engine = this.moduleRef.get(WorkflowExecutionEngine, { strict: false });

      for (const workflow of matchedWorkflows) {
        const activeVersion = workflow.versions[0];
        
        // Create execution instance
        const instance = await this.prisma.workflowInstance.create({
          data: {
            companyId: event.companyId,
            workflowDefinitionId: workflow.id,
            workflowVersionId: activeVersion.id,
            sourceEventId: event.id,
            sourceEntityType: event.entityType,
            sourceEntityId: event.entityId,
            status: 'RUNNING',
            currentState: event.eventPayload, // Initial state variables are the event fields
            priority: 'MEDIUM',
          },
        });

        this.logger.log(`Created workflow instance ${instance.id} for definition ${workflow.name}`);

        // Launch instance execution (immediate node processing)
        const triggerNode = activeVersion.nodes[0];
        await this.prisma.workflowNodeExecution.create({
          data: {
            companyId: event.companyId,
            workflowInstanceId: instance.id,
            nodeKey: triggerNode.nodeKey,
            nodeType: 'TRIGGER',
            status: 'COMPLETED',
            inputData: event.eventPayload,
            outputData: event.eventPayload,
            completedAt: new Date(),
          },
        });

        // Trigger next node(s) connected to the trigger
        await engine.triggerNextNodes(instance.id, triggerNode.nodeKey, event.eventPayload);
      }

      // Mark event as PROCESSED
      await this.prisma.workflowEvent.update({
        where: { id: eventId },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });
    } catch (error: any) {
      this.logger.error(`Error processing event ${eventId}: ${error.message}`, error.stack);
      await this.prisma.workflowEvent.update({
        where: { id: eventId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          nextRetryAt: new Date(Date.now() + 60000), // Retry in 1 minute
        },
      });
    }
  }
}
