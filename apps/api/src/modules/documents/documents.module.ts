import { Module } from '@nestjs/common';
import { TraceabilityModule } from '../traceability/traceability.module';
import { DocumentCodeService } from './document-code.service';
import { DocumentEditorService } from './document-editor.service';
import { DocumentStorageService } from './document-storage.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [TraceabilityModule],
  controllers: [DocumentsController],
  providers: [DocumentCodeService, DocumentEditorService, DocumentStorageService, DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
