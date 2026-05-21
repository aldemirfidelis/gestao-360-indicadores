import { Module } from '@nestjs/common';
import { TraceabilityModule } from '../traceability/traceability.module';
import { DeviationsService } from './deviations.service';
import { DeviationsController } from './deviations.controller';

@Module({
  imports: [TraceabilityModule],
  controllers: [DeviationsController],
  providers: [DeviationsService],
  exports: [DeviationsService],
})
export class DeviationsModule {}
