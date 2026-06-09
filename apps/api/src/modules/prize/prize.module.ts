import { Module } from '@nestjs/common';
import { PrizeController } from './prize.controller';
import { PrizeProgramsController } from './prize-programs.controller';
import { PrizeCompetencesController } from './prize-competences.controller';
import { PrizeAnnexesController } from './prize-annexes.controller';
import { PrizeIndicatorsController } from './prize-indicators.controller';
import { PrizeActualsController } from './prize-actuals.controller';
import { PrizeEligibleController } from './prize-eligible.controller';
import { PrizeAuditService } from './prize-audit.service';
import { PrizeOverviewService } from './prize-overview.service';
import { PrizeProgramsService } from './prize-programs.service';
import { PrizeCompetencesService } from './prize-competences.service';
import { PrizeAnnexesService } from './prize-annexes.service';
import { PrizeIndicatorsService } from './prize-indicators.service';
import { PrizeActualsService } from './prize-actuals.service';
import { PrizePrevistoRealizadoService } from './prize-previsto-realizado.service';
import { PrizeEligibleService } from './prize-eligible.service';
import { PrizeConnectorsService } from './prize-connectors.service';

/**
 * Gestao de Premio (Remuneracao Variavel) - Fase 1.
 * PrismaModule e AccessModule sao @Global; nao precisam ser importados aqui.
 */
@Module({
  controllers: [
    PrizeController,
    PrizeProgramsController,
    PrizeCompetencesController,
    PrizeAnnexesController,
    PrizeIndicatorsController,
    PrizeActualsController,
    PrizeEligibleController,
  ],
  providers: [
    PrizeAuditService,
    PrizeOverviewService,
    PrizeProgramsService,
    PrizeCompetencesService,
    PrizeAnnexesService,
    PrizeIndicatorsService,
    PrizeActualsService,
    PrizePrevistoRealizadoService,
    PrizeEligibleService,
    PrizeConnectorsService,
  ],
  exports: [PrizeAuditService, PrizeAnnexesService, PrizeCompetencesService, PrizeActualsService],
})
export class PrizeModule {}
