import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../../prisma/prisma.service';

export interface QueueJob {
  type: 'process_event' | 'execute_node' | 'retry_node' | 'timer_trigger';
  payload: any;
}

@Injectable()
export class WorkflowQueueAdapter {
  private readonly logger = new Logger(WorkflowQueueAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef
  ) {}

  async enqueue(type: QueueJob['type'], payload: any, delayMs = 0): Promise<void> {
    const companyId = payload.companyId;
    if (!companyId) {
      throw new Error('companyId is required in job payload');
    }

    if (delayMs > 0) {
      // Save as scheduled WorkflowTimer
      await this.prisma.workflowTimer.create({
        data: {
          companyId,
          workflowInstanceId: payload.workflowInstanceId ?? '',
          nodeKey: payload.nodeKey ?? '',
          timerType: 'DELAY',
          scheduledAt: new Date(Date.now() + delayMs),
          status: 'SCHEDULED',
          payload: JSON.stringify({ type, payload }),
        },
      });
      this.logger.log(`Enqueued delayed job ${type} for company ${companyId} (+${delayMs}ms)`);
    } else {
      // Immediate processing
      // We process in background asynchronously to not block the current transaction / HTTP request
      setImmediate(() => {
        this.processJob(type, payload).catch((err) => {
          this.logger.error(`Failed to process immediate job ${type}: ${err.message}`, err.stack);
        });
      });
    }
  }

  async processJob(type: QueueJob['type'], payload: any): Promise<void> {
    try {
      if (type === 'process_event') {
        const { WorkflowEventDispatcher } = await import('./workflow-dispatcher.service');
        const dispatcher = this.moduleRef.get(WorkflowEventDispatcher, { strict: false });
        await dispatcher.processEvent(payload.eventId, payload.companyId);
      } else if (type === 'execute_node') {
        const { WorkflowExecutionEngine } = await import('./workflow-engine.service');
        const engine = this.moduleRef.get(WorkflowExecutionEngine, { strict: false });
        await engine.processNode(payload.workflowInstanceId, payload.nodeKey, 1, payload.companyId);
      } else if (type === 'retry_node') {
        const { WorkflowExecutionEngine } = await import('./workflow-engine.service');
        const engine = this.moduleRef.get(WorkflowExecutionEngine, { strict: false });
        await engine.processNode(payload.workflowInstanceId, payload.nodeKey, payload.attemptNumber, payload.companyId);
      } else if (type === 'timer_trigger') {
        const { WorkflowExecutionEngine } = await import('./workflow-engine.service');
        const engine = this.moduleRef.get(WorkflowExecutionEngine, { strict: false });
        await engine.resumeInstance(payload.workflowInstanceId, payload.nodeKey, { triggeredAt: new Date() }, payload.companyId);
      }
    } catch (error: any) {
      this.logger.error(`Error executing job ${type} with payload ${JSON.stringify(payload)}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
