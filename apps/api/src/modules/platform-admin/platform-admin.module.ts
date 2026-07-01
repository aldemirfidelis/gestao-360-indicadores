import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminModule } from '../admin/admin.module';
import { AccessModule } from '../access/access.module';
import { DatabaseAdminModule } from '../database-admin/database-admin.module';
import { HelpModule } from '../help/help.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { LgpdModule } from '../lgpd/lgpd.module';
import { OrgNodesModule } from '../orgnodes/orgnodes.module';
import { PortalAdminModule } from '../portal-admin/portal-admin.module';
import { PrizeModule } from '../prize/prize.module';
import { UsersModule } from '../users/users.module';
import { PlatformAdminController } from './platform-admin.controller';
import {
  PlatformAdminLegacyAccessController,
  PlatformAdminLegacyCompanyAuditController,
  PlatformAdminLegacyDatabaseController,
  PlatformAdminLegacyExternalIntegrationsController,
  PlatformAdminLegacyHelpController,
  PlatformAdminLegacyLgpdController,
  PlatformAdminLegacyOrgNodesController,
  PlatformAdminLegacyPortalController,
  PlatformAdminLegacyPrizeEligibleController,
  PlatformAdminLegacySettingsController,
} from './platform-admin-legacy.controller';
import { PlatformAdminAuthGuard } from './guards/platform-admin-auth.guard';
import { PlatformAdminAuthService } from './services/platform-admin-auth.service';
import { PlatformAdminAuditService } from './services/platform-admin-audit.service';
import { PlatformAdminService } from './services/platform-admin.service';
import { PlatformAdminBootstrapService } from './services/platform-admin-bootstrap.service';
import { PlatformEmailService } from './services/platform-email.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}),
    AdminModule,
    AccessModule,
    DatabaseAdminModule,
    HelpModule,
    IntegrationsModule,
    LgpdModule,
    OrgNodesModule,
    PortalAdminModule,
    PrizeModule,
    UsersModule,
  ],
  controllers: [
    PlatformAdminController,
    PlatformAdminLegacySettingsController,
    PlatformAdminLegacyDatabaseController,
    PlatformAdminLegacyPortalController,
    PlatformAdminLegacyAccessController,
    PlatformAdminLegacyExternalIntegrationsController,
    PlatformAdminLegacyHelpController,
    PlatformAdminLegacyOrgNodesController,
    PlatformAdminLegacyLgpdController,
    PlatformAdminLegacyPrizeEligibleController,
    PlatformAdminLegacyCompanyAuditController,
  ],
  providers: [
    PlatformAdminAuthGuard,
    PlatformAdminAuthService,
    PlatformAdminAuditService,
    PlatformAdminService,
    PlatformAdminBootstrapService,
    PlatformEmailService,
  ],
  exports: [PlatformAdminService],
})
export class PlatformAdminGlobalModule {}
