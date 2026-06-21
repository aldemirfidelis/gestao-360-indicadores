import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NOTIFICATIONS_QUEUE } from './jobs.constants';

/**
 * Agenda os jobs repetíveis (cron) no boot. O `jobId` estável evita duplicar o
 * agendamento entre reinícios/instâncias. Substitui o cron externo que chamaria
 * POST /notifications/generate.
 */
@Injectable()
export class JobsScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobsScheduler.name);

  constructor(@InjectQueue(NOTIFICATIONS_QUEUE) private readonly notifications: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    const pattern = process.env.NOTIFICATIONS_CRON ?? '*/15 * * * *';
    try {
      await this.notifications.add(
        'generate-alerts',
        {},
        { repeat: { pattern }, jobId: 'notifications:generate-alerts' },
      );
      this.logger.log(`Job repetível de notificações agendado (cron "${pattern}").`);
    } catch (err) {
      this.logger.error(`Falha ao agendar job de notificações: ${(err as Error).message}`);
    }
  }
}
