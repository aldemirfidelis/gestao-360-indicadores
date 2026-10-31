import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { SiteAnalyticsService } from './site-analytics.service';

const GEO_EVERY_MS = 5 * 60_000;
const RETENTION_EVERY_MS = 24 * 3600_000;
/** Visitas (IP e localização) ficam 12 meses: dá para comparar com o ano anterior. */
const RETENTION_DAYS = 365;

/**
 * Rotinas in-process dos visitantes do site (sem Redis, como as demais rotinas de manutenção):
 * localização das visitas novas a cada 5 minutos e retenção de 12 meses uma vez por dia.
 */
@Injectable()
export class SiteAnalyticsScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SiteAnalyticsScheduler.name);
  private readonly timers: NodeJS.Timeout[] = [];
  private busy = false;

  constructor(private readonly analytics: SiteAnalyticsService) {}

  onApplicationBootstrap() {
    if (process.env.MAINTENANCE_JOBS_ENABLED === 'false') return;
    this.timers.push(setInterval(() => void this.run('localização', () => this.analytics.resolvePendingGeo()), GEO_EVERY_MS));
    this.timers.push(setInterval(() => void this.run('retenção', () => this.purge()), RETENTION_EVERY_MS));
  }

  onApplicationShutdown() {
    for (const timer of this.timers) clearInterval(timer);
  }

  private async purge() {
    const removed = await this.analytics.purgeBefore(new Date(Date.now() - RETENTION_DAYS * 86_400_000));
    if (removed) this.logger.log(`Retenção: ${removed} visitas do site com mais de 12 meses removidas`);
  }

  private async run(name: string, job: () => Promise<unknown>) {
    if (this.busy) return;
    this.busy = true;
    try {
      await job();
    } catch (error) {
      this.logger.error(`Rotina de ${name} dos visitantes do site falhou: ${(error as Error).message}`);
    } finally {
      this.busy = false;
    }
  }
}
