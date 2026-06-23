import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { TraceabilityModule } from '../traceability/traceability.module';
import { NonConformitiesModule } from '../nonconformities/nonconformities.module';
import { AuditCodeService } from './audit-code.service';
import { AuditRiskService } from './audit-risk.service';
import { AuditStorageService } from './audit-storage.service';
import { AuditsController } from './audits.controller';
import { AuditsService } from './audits.service';

@Module({
  imports: [AiModule, TraceabilityModule, NonConformitiesModule],
  controllers: [AuditsController],
  providers: [AuditsService, AuditCodeService, AuditRiskService, AuditStorageService],
  exports: [AuditsService],
})
export class AuditsModule {}
