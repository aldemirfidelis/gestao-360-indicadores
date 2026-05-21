import { Module } from '@nestjs/common';
import { TraceabilityModule } from '../traceability/traceability.module';
import { TreatmentsController } from './treatments.controller';
import { TreatmentsService } from './treatments.service';

@Module({
  imports: [TraceabilityModule],
  controllers: [TreatmentsController],
  providers: [TreatmentsService],
  exports: [TreatmentsService],
})
export class TreatmentsModule {}
