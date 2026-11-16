import { Module } from '@nestjs/common';
import { TraceabilityModule } from '../traceability/traceability.module';
import { ProcessesController } from './processes.controller';
import { ProcessesService } from './processes.service';
import { ProcessGovernanceService } from './process-governance.service';
import { ProcessGovernanceController } from './process-governance.controller';
import { ProcessLinksService } from './process-links.service';
import { AuthModule } from '../auth/auth.module';
import { PortalAdminModule } from '../portal-admin/portal-admin.module';

@Module({
  imports: [TraceabilityModule, AuthModule, PortalAdminModule],
  controllers: [ProcessesController, ProcessGovernanceController],
  providers: [ProcessesService, ProcessGovernanceService, ProcessLinksService],
  exports: [ProcessesService],
})
export class ProcessesModule {}
