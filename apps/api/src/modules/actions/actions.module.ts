import { Module } from '@nestjs/common';
import { TraceabilityModule } from '../traceability/traceability.module';
import { AiModule } from '../ai/ai.module';
import { ActionsService } from './actions.service';
import { ActionsController } from './actions.controller';

@Module({
  imports: [TraceabilityModule, AiModule],
  controllers: [ActionsController],
  providers: [ActionsService],
  exports: [ActionsService],
})
export class ActionsModule {}
