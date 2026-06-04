import { Module } from '@nestjs/common';
import { TraceabilityModule } from '../traceability/traceability.module';
import { NonConformitiesModule } from '../nonconformities/nonconformities.module';
import { AuditsController } from './audits.controller';
import { AuditsService } from './audits.service';

@Module({
  imports: [TraceabilityModule, NonConformitiesModule],
  controllers: [AuditsController],
  providers: [AuditsService],
  exports: [AuditsService],
})
export class AuditsModule {}
