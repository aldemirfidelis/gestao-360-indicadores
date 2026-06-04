import { Module } from '@nestjs/common';
import { TraceabilityModule } from '../traceability/traceability.module';
import { NonConformitiesController } from './nonconformities.controller';
import { NonConformitiesService } from './nonconformities.service';

@Module({
  imports: [TraceabilityModule],
  controllers: [NonConformitiesController],
  providers: [NonConformitiesService],
  exports: [NonConformitiesService],
})
export class NonConformitiesModule {}
