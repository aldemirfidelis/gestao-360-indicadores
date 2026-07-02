import { Module } from '@nestjs/common';
import { DocumentsModule } from '../modules/documents/documents.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { MaintenanceScheduler } from './maintenance.scheduler';

/**
 * Módulo sempre ativo (diferente do JobsModule, que exige WORKERS_ENABLED e
 * Redis): rotinas de manutenção in-process — vencimento de documentos e
 * alertas automáticos.
 */
@Module({
  imports: [DocumentsModule, NotificationsModule],
  providers: [MaintenanceScheduler],
})
export class MaintenanceModule {}
