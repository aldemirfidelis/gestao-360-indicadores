import { Module } from '@nestjs/common';
import { TraceabilityModule } from '../traceability/traceability.module';
import { ActionsService } from './actions.service';
import { ActionsController } from './actions.controller';

@Module({
  imports: [TraceabilityModule],
  controllers: [ActionsController],
  providers: [ActionsService],
  exports: [ActionsService],
})
export class ActionsModule {}
