import { Module } from '@nestjs/common';
import { DocumentsModule } from '../modules/documents/documents.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { CommunicationModule } from '../modules/communication/communication.module';
import { PersonnelModule } from '../modules/personnel/personnel.module';
import { MaintenanceScheduler } from './maintenance.scheduler';

/**
 * Módulo sempre ativo (diferente do JobsModule, que exige WORKERS_ENABLED e
 * Redis): rotinas de manutenção in-process — vencimento de documentos e
 * alertas automáticos.
 */
@Module({
  imports: [DocumentsModule, NotificationsModule, CommunicationModule, PersonnelModule],
  providers: [MaintenanceScheduler],
})
export class MaintenanceModule {}
