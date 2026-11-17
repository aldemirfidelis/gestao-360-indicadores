import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TraceabilityModule } from '../traceability/traceability.module';
import { DocumentAccessService } from './document-access.service';
import { DocumentAiService } from './document-ai.service';
import { DocumentChangeRequestService } from './document-change-request.service';
import { DocumentCodeService } from './document-code.service';
import { DocumentContentService } from './document-content.service';
import { DocumentDistributionService } from './document-distribution.service';
import { DocumentEditorService } from './document-editor.service';
import { DocumentFeaturesController } from './document-features.controller';
import { DocumentGovernanceService } from './document-governance.service';
import { DocumentMaintenanceService } from './document-maintenance.service';
import { DocumentRenderService } from './document-render.service';
import { DocumentStorageService } from './document-storage.service';
import { DocumentWorkflowService } from './document-workflow.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { WebDavController } from './webdav.controller';
import { WopiController } from './wopi.controller';

/**
 * GED (Documentos): procedimentos, POPs, normas, instruções, políticas e
 * documentos externos, com fluxo de revisão/aprovação assinado, PDF oficial,
 * leitura obrigatória e busca. Não depende do módulo de Treinamento.
 */
@Module({
  imports: [TraceabilityModule, NotificationsModule, AiModule],
  // DocumentFeaturesController vem primeiro: suas rotas fixas (search,
  // overview, inbox...) precisam ser registradas antes de `GET :id`.
  controllers: [DocumentFeaturesController, DocumentsController, WopiController, WebDavController],
  providers: [
    DocumentAccessService,
    DocumentStorageService,
    DocumentCodeService,
    DocumentEditorService,
    DocumentRenderService,
    DocumentContentService,
    DocumentWorkflowService,
    DocumentDistributionService,
    DocumentChangeRequestService,
    DocumentGovernanceService,
    DocumentAiService,
    DocumentsService,
    DocumentMaintenanceService,
  ],
  exports: [DocumentsService, DocumentStorageService, DocumentContentService, DocumentAccessService, DocumentMaintenanceService],
})
export class DocumentsModule {}
