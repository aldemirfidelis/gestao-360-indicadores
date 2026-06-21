import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueJob, WorkflowQueueAdapter } from '../modules/automations/services/workflow-queue.adapter';
import { AUTOMATIONS_QUEUE } from './jobs.constants';

/**
 * Worker das automações: processa os jobs que o WorkflowQueueAdapter enfileira
 * quando WORKERS_ENABLED=true, reusando a MESMA lógica de despacho (processJob →
 * dispatcher/engine). Ganha retry exponencial + dead-letter do BullMQ.
 */
@Processor(AUTOMATIONS_QUEUE)
export class AutomationsProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationsProcessor.name);

  constructor(private readonly adapter: WorkflowQueueAdapter) {
    super();
  }

  async process(job: Job<{ type: QueueJob['type']; payload: any }>): Promise<void> {
    const { type, payload } = job.data;
    await this.adapter.processJob(type, payload);
  }
}
