import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { AUTOMATIONS_QUEUE, workersEnabled } from '../../../jobs/jobs.constants';

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

    // Workers BullMQ ligados: enfileira na fila 'automations' (retry exponencial +
    // dead-letter via removeOnFail). Default (flag off) mantem o comportamento atual.
    if (workersEnabled()) {
      const queue = this.resolveQueue();
      if (queue) {
        await queue.add(type, { type, payload }, delayMs > 0 ? { delay: delayMs } : {});
        this.logger.log(`Enfileirado (BullMQ) ${type} para empresa ${companyId}${delayMs > 0 ? ` (+${delayMs}ms)` : ''}`);
        return;
      }
      this.logger.warn('WORKERS_ENABLED=true mas fila automations indisponivel; usando fallback em processo.');
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

  /** Resolve a fila BullMQ 'automations' (registrada no JobsModule) sem acoplar no boot. */
  private resolveQueue(): Queue | null {
    try {
      return this.moduleRef.get<Queue>(getQueueToken(AUTOMATIONS_QUEUE), { strict: false });
    } catch {
      return null;
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
