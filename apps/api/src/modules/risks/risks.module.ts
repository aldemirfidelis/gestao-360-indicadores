import { Module } from '@nestjs/common';
import { TraceabilityModule } from '../traceability/traceability.module';
import { RisksController } from './risks.controller';
import { RisksService } from './risks.service';

@Module({
  imports: [TraceabilityModule],
  controllers: [RisksController],
  providers: [RisksService],
  exports: [RisksService],
})
export class RisksModule {}
