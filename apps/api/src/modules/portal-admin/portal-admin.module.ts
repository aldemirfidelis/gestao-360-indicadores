import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from '../../prisma/prisma.module';

import { PortalAuditService } from './services/portal-audit.service';
import { FeatureFlagService } from './services/feature-flag.service';
import { RegistryService } from './services/registry.service';
import { PortalConfigService } from './services/portal-config.service';
import { PortalOverviewService } from './services/portal-overview.service';
import { NavigationService } from './services/navigation.service';
import { ScopeService } from './services/scope.service';
import { MaintenanceService } from './services/maintenance.service';
import { ParameterService } from './services/parameter.service';
import { IntegrationService } from './services/integration.service';
import { AnnouncementService } from './services/announcement.service';
import { SnapshotService } from './services/snapshot.service';
import { PortalDiagnosticsService } from './services/portal-diagnostics.service';
import { PermissionViewService } from './services/permission-view.service';
import { SuperAdminPortalGuard } from './guards/super-admin-portal.guard';
import { FeatureFlagGuard } from './guards/feature-flag.guard';
import { PortalGateGuard } from './guards/portal-gate.guard';

import { PortalConfigController } from './controllers/portal-config.controller';
import { PortalAdminController } from './controllers/portal-admin.controller';
import { PortalManageController } from './controllers/portal-manage.controller';

/**
 * Central de Administração do Portal (Configurações > Configurações Avançadas).
 * Acesso exclusivo do Super Admin (SuperAdminPortalGuard, que audita acessos),
 * exceto GET /portal/config (overlay para qualquer autenticado).
 * Exporta FeatureFlagService + FeatureFlagGuard para enforcement curado em outros módulos.
 */
@Module({
  imports: [PrismaModule],
  controllers: [PortalConfigController, PortalAdminController, PortalManageController],
  providers: [
    PortalAuditService,
    FeatureFlagService,
    RegistryService,
    PortalConfigService,
    PortalOverviewService,
    NavigationService,
    ScopeService,
    MaintenanceService,
    ParameterService,
    IntegrationService,
    AnnouncementService,
    SnapshotService,
    PortalDiagnosticsService,
    PermissionViewService,
    SuperAdminPortalGuard,
    FeatureFlagGuard,
    { provide: APP_GUARD, useClass: PortalGateGuard },
  ],
  exports: [
    PortalAuditService,
    FeatureFlagService,
    RegistryService,
    PortalConfigService,
    PortalOverviewService,
    NavigationService,
    ScopeService,
    MaintenanceService,
    ParameterService,
    IntegrationService,
    AnnouncementService,
    SnapshotService,
    PortalDiagnosticsService,
    PermissionViewService,
    FeatureFlagGuard,
  ],
})
export class PortalAdminModule {}
