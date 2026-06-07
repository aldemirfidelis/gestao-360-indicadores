import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminModule } from '../admin/admin.module';
import { AccessModule } from '../access/access.module';
import { DatabaseAdminModule } from '../database-admin/database-admin.module';
import { HelpModule } from '../help/help.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { PortalAdminModule } from '../portal-admin/portal-admin.module';
import { PlatformAdminController } from './platform-admin.controller';
import {
  PlatformAdminLegacyAccessController,
  PlatformAdminLegacyDatabaseController,
  PlatformAdminLegacyExternalIntegrationsController,
  PlatformAdminLegacyHelpController,
  PlatformAdminLegacyPortalController,
  PlatformAdminLegacySettingsController,
} from './platform-admin-legacy.controller';
import { PlatformAdminAuthGuard } from './guards/platform-admin-auth.guard';
import { PlatformAdminAuthService } from './services/platform-admin-auth.service';
import { PlatformAdminAuditService } from './services/platform-admin-audit.service';
import { PlatformAdminService } from './services/platform-admin.service';
import { PlatformAdminBootstrapService } from './services/platform-admin-bootstrap.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}),
    AdminModule,
    AccessModule,
    DatabaseAdminModule,
    HelpModule,
    IntegrationsModule,
    PortalAdminModule,
  ],
  controllers: [
    PlatformAdminController,
    PlatformAdminLegacySettingsController,
    PlatformAdminLegacyDatabaseController,
    PlatformAdminLegacyPortalController,
    PlatformAdminLegacyAccessController,
    PlatformAdminLegacyExternalIntegrationsController,
    PlatformAdminLegacyHelpController,
  ],
  providers: [
    PlatformAdminAuthGuard,
    PlatformAdminAuthService,
    PlatformAdminAuditService,
    PlatformAdminService,
    PlatformAdminBootstrapService,
  ],
  exports: [PlatformAdminService],
})
export class PlatformAdminGlobalModule {}
