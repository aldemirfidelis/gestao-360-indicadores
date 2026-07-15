import { Module } from '@nestjs/common';
import { RecruitmentController } from './recruitment.controller';
import { RecruitRequisitionService } from './recruit-requisition.service';

/**
 * Recrutamento e Seleção (docs/diagnostico-recrutamento-selecao.md). Reusa
 * CompensationPosition/Budget, OrgJob/OrgNode e OrgEmployee — sem cadastro
 * paralelo. F1: requisição de vaga com travas flexíveis e workflow de aprovação.
 */
@Module({
  controllers: [RecruitmentController],
  providers: [RecruitRequisitionService],
  exports: [RecruitRequisitionService],
})
export class RecruitmentModule {}
