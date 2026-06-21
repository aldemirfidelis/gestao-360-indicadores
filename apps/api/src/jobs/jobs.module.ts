import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import {
  AUTOMATIONS_QUEUE,
  NOTIFICATIONS_QUEUE,
  PRIZE_QUEUE,
  defaultJobOptions,
  redisConnection,
} from './jobs.constants';
import { NotificationsProcessor } from './notifications.processor';
import { JobsScheduler } from './jobs.scheduler';

/**
 * Infra de jobs assíncronos (BullMQ) — item 14. Só é importado pelo AppModule
 * quando WORKERS_ENABLED=true (ver workersEnabled()), então nenhuma conexão Redis
 * é aberta no boot padrão.
 *
 * Filas:
 *  - notifications: regras de alerta agendadas (worker abaixo);
 *  - prize: apuração/sync (registrada para produtores; processor a seguir);
 *  - automations: retry/dead-letter das automações (attempts + backoff + removeOnFail).
 */
@Module({
  imports: [
    BullModule.forRoot({ connection: redisConnection }),
    BullModule.registerQueue(
      { name: NOTIFICATIONS_QUEUE, defaultJobOptions },
      { name: PRIZE_QUEUE, defaultJobOptions },
      { name: AUTOMATIONS_QUEUE, defaultJobOptions },
    ),
    PrismaModule,
    NotificationsModule,
  ],
  providers: [NotificationsProcessor, JobsScheduler],
})
export class JobsModule {}
