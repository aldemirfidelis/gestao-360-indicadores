import { Module } from '@nestjs/common';
import { TraceabilityModule } from '../traceability/traceability.module';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';

@Module({
  imports: [TraceabilityModule],
  controllers: [FormsController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
