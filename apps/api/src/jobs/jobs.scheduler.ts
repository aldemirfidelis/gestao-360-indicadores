import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NOTIFICATIONS_QUEUE, PRIZE_QUEUE } from './jobs.constants';

/**
 * Agenda os jobs repetíveis (cron) no boot. O `jobId` estável evita duplicar o
 * agendamento entre reinícios/instâncias.
 *  - notifications: sempre (default 15min) — substitui o cron externo.
 *  - prize sync-open: só quando PRIZE_SYNC_CRON está definido (opt-in), para manter
 *    o realizado fresco em background sem alterar a apuração síncrona.
 */
@Injectable()
export class JobsScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobsScheduler.name);

  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly notifications: Queue,
    @InjectQueue(PRIZE_QUEUE) private readonly prize: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const notificationsCron = process.env.NOTIFICATIONS_CRON ?? '*/15 * * * *';
    try {
      await this.notifications.add(
        'generate-alerts',
        {},
        { repeat: { pattern: notificationsCron }, jobId: 'notifications:generate-alerts' },
      );
      this.logger.log(`Job repetível de notificações agendado (cron "${notificationsCron}").`);
    } catch (err) {
      this.logger.error(`Falha ao agendar job de notificações: ${(err as Error).message}`);
    }

    const prizeCron = process.env.PRIZE_SYNC_CRON?.trim();
    if (prizeCron) {
      try {
        await this.prize.add(
          'sync-open',
          { kind: 'sync-open' },
          { repeat: { pattern: prizeCron }, jobId: 'prize:sync-open' },
        );
        this.logger.log(`Job repetível de sync de prêmio agendado (cron "${prizeCron}").`);
      } catch (err) {
        this.logger.error(`Falha ao agendar job de prêmio: ${(err as Error).message}`);
      }
    }
  }
}
