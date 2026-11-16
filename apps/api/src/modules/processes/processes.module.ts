import { Module } from '@nestjs/common';
import { TraceabilityModule } from '../traceability/traceability.module';
import { ProcessesController } from './processes.controller';
import { ProcessesService } from './processes.service';
import { ProcessGovernanceService } from './process-governance.service';
import { ProcessGovernanceController } from './process-governance.controller';
import { ProcessLinksService } from './process-links.service';
import { AuthModule } from '../auth/auth.module';
import { PortalAdminModule } from '../portal-admin/portal-admin.module';
import { ProjectsModule } from '../projects/projects.module';
import { ProcessPmoController } from './process-pmo.controller';
import { ProcessPmoService } from './process-pmo.service';

@Module({
  imports: [TraceabilityModule, AuthModule, PortalAdminModule, ProjectsModule],
  controllers: [ProcessesController, ProcessGovernanceController, ProcessPmoController],
  providers: [ProcessesService, ProcessGovernanceService, ProcessLinksService, ProcessPmoService],
  exports: [ProcessesService],
})
export class ProcessesModule {}
