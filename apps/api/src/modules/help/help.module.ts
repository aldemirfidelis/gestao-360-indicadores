import { Module } from '@nestjs/common';
import { PortalAdminModule } from '../portal-admin/portal-admin.module';
import { SuperAdminPortalGuard } from '../portal-admin/guards/super-admin-portal.guard';
import { AdminHelpController } from './admin-help.controller';
import { HelpController } from './help.controller';
import { HelpService } from './help.service';

@Module({
  imports: [PortalAdminModule],
  controllers: [HelpController, AdminHelpController],
  providers: [HelpService, SuperAdminPortalGuard],
})
export class HelpModule {}
