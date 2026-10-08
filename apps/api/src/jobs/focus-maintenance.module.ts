import { Injectable, Logger, Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { NotificationsService } from '../modules/notifications/notifications.service';

@Injectable()
class FocusMaintenanceScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;
  private busy = false;
  private readonly logger = new Logger(FocusMaintenanceScheduler.name);
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}
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
      for (const company of companies) await this.notifications.generateAlerts(company.id);
    } catch (error) { this.logger.error((error as Error).message); }
    finally { this.busy = false; }
  }
}
@Module({ imports: [NotificationsModule], providers: [FocusMaintenanceScheduler] })
export class FocusMaintenanceModule {}
