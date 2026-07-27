import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TraceabilityModule } from '../traceability/traceability.module';
import { TrainingModule } from '../training/training.module';
import { DocumentCodeService } from './document-code.service';
import { DocumentEditorService } from './document-editor.service';
import { DocumentStorageService } from './document-storage.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { WebDavController } from './webdav.controller';
import { WopiController } from './wopi.controller';

@Module({
  // TrainingModule: a publicacao de uma revisao reabre os treinamentos
  // vinculados ao documento (Evento 3 do T&D).
  imports: [TraceabilityModule, NotificationsModule, TrainingModule],
  controllers: [DocumentsController, WopiController, WebDavController],
  providers: [DocumentCodeService, DocumentEditorService, DocumentStorageService, DocumentsService],
  exports: [DocumentsService, DocumentStorageService],
})
export class DocumentsModule {}
