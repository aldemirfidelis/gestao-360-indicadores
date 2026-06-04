import { Module } from '@nestjs/common';
import { TraceabilityModule } from '../traceability/traceability.module';
import { ProcessesController } from './processes.controller';
import { ProcessesService } from './processes.service';

@Module({
  imports: [TraceabilityModule],
  controllers: [ProcessesController],
  providers: [ProcessesService],
  exports: [ProcessesService],
})
export class ProcessesModule {}
