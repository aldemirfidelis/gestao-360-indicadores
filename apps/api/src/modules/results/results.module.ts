import { Module } from '@nestjs/common';
import { TraceabilityModule } from '../traceability/traceability.module';
import { PeriodsModule } from '../periods/periods.module';
import { ClosedMonthsModule } from '../closed-months/closed-months.module';
import { ResultsService } from './results.service';
import { ResultsController } from './results.controller';

@Module({
  imports: [TraceabilityModule, PeriodsModule, ClosedMonthsModule],
  controllers: [ResultsController],
  providers: [ResultsService],
  exports: [ResultsService],
})
export class ResultsModule {}
