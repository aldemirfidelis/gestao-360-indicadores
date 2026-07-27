import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import {
  TrainingCatalogController,
  TrainingCertificatesController,
  TrainingClassesController,
  TrainingController,
  TrainingDocumentController,
  TrainingEmployeeController,
} from './training.controller';
import { TrainingCatalogService } from './training-catalog.service';
import { TrainingDocumentService } from './training-document.service';
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
  ],
  providers: [
    TrainingMatrixService,
    TrainingCatalogService,
    TrainingDocumentService,
    TrainingClassesService,
    TrainingCertificatesService,
    TrainingQueryService,
    TrainingEmployeeService,
  ],
  exports: [TrainingMatrixService, TrainingDocumentService],
})
export class TrainingModule {}
