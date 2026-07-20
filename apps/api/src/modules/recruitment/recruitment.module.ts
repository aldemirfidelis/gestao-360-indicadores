import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AiModule } from '../ai/ai.module';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PayrollModule } from '../payroll/payroll.module';
import { PersonnelModule } from '../personnel/personnel.module';
import { RecruitmentController } from './recruitment.controller';
import { CareersController } from './careers.controller';
import { RecruitRequisitionService } from './recruit-requisition.service';
import { RecruitPostingService } from './recruit-posting.service';
import { RecruitCareersService } from './recruit-careers.service';
import { RecruitCandidateAuthService } from './recruit-candidate-auth.service';
import { RecruitApplicationService } from './recruit-application.service';
import { RecruitEvaluationService } from './recruit-evaluation.service';
import { RecruitOfferService } from './recruit-offer.service';
import { RecruitOccupationalHealthService } from './recruit-occupational-health.service';
import { RecruitAdmissionService } from './recruit-admission.service';
import { RecruitLgpdService } from './recruit-lgpd.service';
import { RecruitCommunicationService } from './recruit-communication.service';
import { RecruitAnalyticsService } from './recruit-analytics.service';
import { RecruitTalentPoolService } from './recruit-talent-pool.service';
import { CandidateGuard } from './candidate.guard';

/**
 * Recrutamento e Seleção (docs/diagnostico-recrutamento-selecao.md). Reusa
 * CompensationPosition/Budget, OrgJob/OrgNode e OrgEmployee — sem cadastro
 * paralelo. F1: requisição + travas. F2: vaga + pipeline + portal público.
 */
@Module({
  imports: [JwtModule.register({}), DocumentsModule, NotificationsModule, AiModule, PersonnelModule, PayrollModule],
  controllers: [RecruitmentController, CareersController],
  providers: [
    RecruitRequisitionService,
    RecruitPostingService,
    RecruitCareersService,
    RecruitCandidateAuthService,
    RecruitApplicationService,
    RecruitEvaluationService,
    RecruitOfferService,
    RecruitOccupationalHealthService,
    RecruitAdmissionService,
    RecruitLgpdService,
    RecruitCommunicationService,
    RecruitAnalyticsService,
    RecruitTalentPoolService,
    CandidateGuard,
  ],
  exports: [RecruitRequisitionService, RecruitPostingService, RecruitApplicationService, RecruitEvaluationService, RecruitOfferService, RecruitOccupationalHealthService, RecruitAdmissionService, RecruitLgpdService, RecruitCommunicationService],
})
export class RecruitmentModule {}
