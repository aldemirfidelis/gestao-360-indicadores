import { Module } from '@nestjs/common';
import { TraceabilityModule } from '../traceability/traceability.module';
import { MeetingsService } from './meetings.service';
import { MeetingsController } from './meetings.controller';

@Module({
  imports: [TraceabilityModule],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
