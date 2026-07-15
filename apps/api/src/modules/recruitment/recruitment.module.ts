import { Module } from '@nestjs/common';
import { RecruitmentController } from './recruitment.controller';
import { CareersController } from './careers.controller';
import { RecruitRequisitionService } from './recruit-requisition.service';
import { RecruitPostingService } from './recruit-posting.service';
import { RecruitCareersService } from './recruit-careers.service';

/**
 * Recrutamento e Seleção (docs/diagnostico-recrutamento-selecao.md). Reusa
 * CompensationPosition/Budget, OrgJob/OrgNode e OrgEmployee — sem cadastro
 * paralelo. F1: requisição + travas. F2: vaga + pipeline + portal público.
 */
@Module({
  controllers: [RecruitmentController, CareersController],
  providers: [RecruitRequisitionService, RecruitPostingService, RecruitCareersService],
  exports: [RecruitRequisitionService, RecruitPostingService],
})
export class RecruitmentModule {}
