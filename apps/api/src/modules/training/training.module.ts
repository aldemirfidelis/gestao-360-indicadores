import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import {
  TrainingCatalogController,
  TrainingCertificatesController,
  TrainingClassesController,
  TrainingController,
  TrainingAssessmentController,
  TrainingDevelopmentController,
  TrainingDocumentController,
  TrainingEmployeeController,
  TrainingReportsController,
} from './training.controller';
import { TrainingCatalogService } from './training-catalog.service';
import { TrainingDocumentService } from './training-document.service';
import { TrainingDevelopmentService } from './training-development.service';
import { TrainingAssessmentService } from './training-assessment.service';
import { TrainingReportsService } from './training-reports.service';
import { TrainingCertificatesService } from './training-certificates.service';
import { TrainingClassesService } from './training-classes.service';
import { TrainingEmployeeService } from './training-employee.service';
import { TrainingMatrixService } from './training-matrix.service';
import { TrainingQueryService } from './training-query.service';

/**
 * Treinamento e Desenvolvimento (T&D).
 *
 * O módulo não possui cadastro próprio de pessoas, cargos, áreas ou documentos:
 * consome OrgEmployee, OrgJob, OrgNode e Document (GED) por relação.
 *
 * `TrainingMatrixService` é exportado para que Serviço Pessoal (admissão e
 * movimentação), GED (revisão de documento) e o MaintenanceScheduler
 * (vencimentos) disparem a recomputação da matriz.
 */
@Module({
  imports: [AccessModule],
  controllers: [
    TrainingController,
    TrainingCatalogController,
    TrainingClassesController,
    TrainingCertificatesController,
    TrainingEmployeeController,
    TrainingDocumentController,
    TrainingAssessmentController,
    TrainingDevelopmentController,
    TrainingReportsController,
  ],
  providers: [
    TrainingMatrixService,
    TrainingCatalogService,
    TrainingDocumentService,
    TrainingDevelopmentService,
    TrainingAssessmentService,
    TrainingReportsService,
    TrainingClassesService,
    TrainingCertificatesService,
    TrainingQueryService,
    TrainingEmployeeService,
  ],
  exports: [TrainingMatrixService, TrainingDocumentService],
})
export class TrainingModule {}
