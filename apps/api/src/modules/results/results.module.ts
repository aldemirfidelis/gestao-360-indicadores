import { Module } from '@nestjs/common';
import { TraceabilityModule } from '../traceability/traceability.module';
import { ResultsService } from './results.service';
import { ResultsController } from './results.controller';

@Module({
  imports: [TraceabilityModule],
  controllers: [ResultsController],
  providers: [ResultsService],
  exports: [ResultsService],
})
export class ResultsModule {}
