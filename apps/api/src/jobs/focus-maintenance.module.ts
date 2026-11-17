import { Inject, Injectable, Logger, Module, OnApplicationBootstrap, OnApplicationShutdown, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { NotificationsService } from '../modules/notifications/notifications.service';
import type { DocumentMaintenanceService } from '../modules/documents/document-maintenance.service';

@Injectable()
class FocusMaintenanceScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;
  private busy = false;
  private readonly logger = new Logger(FocusMaintenanceScheduler.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    // GED ativo: vencimentos, publicações agendadas, lembretes e leituras obrigatórias.
    @Optional() @Inject('parked.documents.maintenance') private readonly documents?: DocumentMaintenanceService,
  ) {}
  onApplicationBootstrap() {
    if (process.env.MAINTENANCE_JOBS_ENABLED === 'false') return;
    this.timer = setInterval(() => void this.tick(), Math.max(300_000, Number(process.env.MAINTENANCE_INTERVAL_MS) || 3_600_000));
  }
  onApplicationShutdown() { if (this.timer) clearInterval(this.timer); }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      const companies = await this.prisma.company.findMany({ where: { deletedAt: null, status: 'ACTIVE' }, select: { id: true } });
      for (const company of companies) {
        await this.notifications.generateAlerts(company.id);
        if (this.documents) {
          try {
            await this.documents.tick(company.id);
          } catch (error) {
            this.logger.warn(`Rotina do GED falhou (empresa ${company.id}): ${(error as Error).message}`);
          }
        }
      }
    } catch (error) { this.logger.error((error as Error).message); }
    finally { this.busy = false; }
  }
}
@Module({ imports: [NotificationsModule], providers: [FocusMaintenanceScheduler] })
export class FocusMaintenanceModule {}
