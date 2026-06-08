import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkflowQueueAdapter } from './workflow-queue.adapter';

@Injectable()
export class WorkflowScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WorkflowScheduler.name);
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueAdapter: WorkflowQueueAdapter
  ) {}

  onApplicationBootstrap() {
    this.logger.log('Starting Workflow Scheduler polling loop...');
    // Run every 10 seconds to scan for delayed timers and pending event retries
    this.intervalId = setInterval(() => {
      this.pollAndProcess().catch((err) => {
        this.logger.error(`Error in scheduler poll loop: ${err.message}`, err.stack);
      });
    }, 10000);
  }

  onApplicationShutdown() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.logger.log('Stopped Workflow Scheduler polling loop.');
    }
  }

  async pollAndProcess(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      await this.processTimers();
      await this.processEventRetries();
    } catch (error: any) {
      this.logger.error(`Error processing scheduled items: ${error.message}`, error.stack);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processTimers(): Promise<void> {
    const now = new Date();

    // Fetch and lock scheduled timers using SKIP LOCKED to prevent duplicate processing in a cluster
    let timers: any[] = [];
    try {
      timers = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "WorkflowTimer" WHERE status = 'SCHEDULED' AND "scheduledAt" <= $1 FOR UPDATE SKIP LOCKED`,
        now
      );
    } catch (err) {
      // Fallback for non-postgres or query errors
      timers = await this.prisma.workflowTimer.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { lte: now },
        },
        take: 50,
      });
    }

    if (timers.length === 0) return;

    this.logger.log(`Processing ${timers.length} scheduled workflow timers.`);

    for (const timer of timers) {
      try {
        await this.prisma.workflowTimer.update({
          where: { id: timer.id },
          data: {
            status: 'EXECUTED',
            executedAt: now,
          },
        });

        const payload = JSON.parse(timer.payload);
        await this.queueAdapter.processJob(payload.type, payload.payload);
      } catch (error: any) {
        this.logger.error(`Failed to process timer ${timer.id}: ${error.message}`, error.stack);
        await this.prisma.workflowTimer.update({
          where: { id: timer.id },
          data: { status: 'FAILED' },
        });
      }
    }
  }

  private async processEventRetries(): Promise<void> {
    const now = new Date();

    let pendingRetries: any[] = [];
    try {
      pendingRetries = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "WorkflowEvent" WHERE status = 'FAILED' AND "nextRetryAt" <= $1 AND "attemptCount" < 3 FOR UPDATE SKIP LOCKED`,
        now
      );
    } catch (err) {
      pendingRetries = await this.prisma.workflowEvent.findMany({
        where: {
          status: 'FAILED',
          nextRetryAt: { lte: now },
          attemptCount: { lt: 3 },
        },
        take: 20,
      });
    }

    if (pendingRetries.length === 0) return;

    this.logger.log(`Retrying ${pendingRetries.length} failed workflow events.`);

    for (const event of pendingRetries) {
      try {
        await this.prisma.workflowEvent.update({
          where: { id: event.id },
          data: { status: 'PENDING' },
        });
        await this.queueAdapter.enqueue('process_event', { companyId: event.companyId, eventId: event.id });
      } catch (error: any) {
        this.logger.error(`Failed to enqueue retry for event ${event.id}: ${error.message}`, error.stack);
      }
    }
  }
}
