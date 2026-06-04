import { Module } from '@nestjs/common';
import { TraceabilityModule } from '../traceability/traceability.module';
import { AiModule } from '../ai/ai.module';
import { MeetingsService } from './meetings.service';
import { MeetingsController } from './meetings.controller';

@Module({
  imports: [TraceabilityModule, AiModule],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
