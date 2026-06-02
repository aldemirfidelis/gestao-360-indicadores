import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { SuperAdminPortalGuard } from '../guards/super-admin-portal.guard';
import { PortalTabTag } from '../decorators/portal-tab.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthPayload } from '../../auth/auth.types';
import { NavigationService } from '../services/navigation.service';
import { ScopeService } from '../services/scope.service';
import { MaintenanceService } from '../services/maintenance.service';
import { ParameterService } from '../services/parameter.service';
import { IntegrationService } from '../services/integration.service';
import { AnnouncementService } from '../services/announcement.service';
import { SnapshotService } from '../services/snapshot.service';
import { PortalDiagnosticsService } from '../services/portal-diagnostics.service';
import { PermissionViewService } from '../services/permission-view.service';

@Controller('admin/portal')
@UseGuards(SuperAdminPortalGuard)
export class PortalManageController {
  constructor(
    private readonly navigation: NavigationService,
    private readonly scope: ScopeService,
    private readonly maintenance: MaintenanceService,
    private readonly parameters: ParameterService,
    private readonly integrations: IntegrationService,
    private readonly announcements: AnnouncementService,
    private readonly snapshots: SnapshotService,
    private readonly diagnostics: PortalDiagnosticsService,
    private readonly permissions: PermissionViewService,
  ) {}

  // ---- Navegação / Menus ----
  @Get('navigation') @PortalTabTag('navigation') navList() { return this.navigation.list(); }
  @Put('navigation') @PortalTabTag('navigation') navUpsert(@Body() b: { itemKey: string; kind?: string; hidden?: boolean; order?: number | null; labelOverride?: string | null; iconOverride?: string | null; groupOverride?: string | null }, @CurrentUser() u: AuthPayload) { return this.navigation.upsert(b.itemKey, b, u); }
  @Post('navigation/reorder') @PortalTabTag('navigation') navReorder(@Body() b: { items: { itemKey: string; order: number }[] }, @CurrentUser() u: AuthPayload) { return this.navigation.reorder(b?.items ?? [], u); }
  @Delete('navigation/:itemKey') @PortalTabTag('navigation') navRemove(@Param('itemKey') k: string, @CurrentUser() u: AuthPayload) { return this.navigation.remove(decodeURIComponent(k), u); }

  // ---- Escopo organizacional ----
  @Get('scope') @PortalTabTag('scope') scopeList(@Query('targetType') t?: string, @Query('targetCode') c?: string) { return this.scope.list(t, c); }
  @Get('scope/options') @PortalTabTag('scope') scopeOptions() { return this.scope.options(); }
  @Post('scope') @PortalTabTag('scope') scopeCreate(@Body() b: { targetType: string; targetCode: string; scopeType: string; scopeId: string; effect?: string }, @CurrentUser() u: AuthPayload) { return this.scope.create(b, u); }
  @Delete('scope/:id') @PortalTabTag('scope') scopeRemove(@Param('id') id: string, @CurrentUser() u: AuthPayload) { return this.scope.remove(id, u); }

  // ---- Manutenção ----
  @Get('maintenance') @PortalTabTag('maintenance') maintList() { return this.maintenance.list(); }
  @Post('maintenance') @PortalTabTag('maintenance') maintCreate(@Body() b: Record<string, unknown>, @CurrentUser() u: AuthPayload) { return this.maintenance.create(b, u); }
  @Put('maintenance/:id') @PortalTabTag('maintenance') maintUpdate(@Param('id') id: string, @Body() b: Record<string, unknown>, @CurrentUser() u: AuthPayload) { return this.maintenance.update(id, b, u); }
  @Delete('maintenance/:id') @PortalTabTag('maintenance') maintCancel(@Param('id') id: string, @CurrentUser() u: AuthPayload) { return this.maintenance.cancel(id, u); }

  // ---- Parâmetros ----
  @Get('parameters') @PortalTabTag('parameters') paramList() { return this.parameters.list(); }
  @Put('parameters') @PortalTabTag('parameters') paramSet(@Body() b: { key: string; value: string; valueType?: string }, @CurrentUser() u: AuthPayload) { return this.parameters.set(b?.key, b?.value ?? '', b?.valueType ?? null, u); }

  // ---- Integrações ----
  @Get('integrations') @PortalTabTag('integrations') intList() { return this.integrations.list(); }
  @Post('integrations/:code/test') @PortalTabTag('integrations') intTest(@Param('code') code: string, @CurrentUser() u: AuthPayload) { return this.integrations.test(code, u); }
  @Post('integrations/:code/status') @PortalTabTag('integrations') intStatus(@Param('code') code: string, @Body() b: { status: 'enabled' | 'disabled' }, @CurrentUser() u: AuthPayload) { return this.integrations.setStatus(code, b?.status === 'disabled' ? 'disabled' : 'enabled', u); }

  // ---- Comunicados ----
  @Get('announcements') @PortalTabTag('announcements') annList() { return this.announcements.list(); }
  @Post('announcements') @PortalTabTag('announcements') annCreate(@Body() b: Record<string, unknown>, @CurrentUser() u: AuthPayload) { return this.announcements.create(b, u); }
  @Put('announcements/:id') @PortalTabTag('announcements') annUpdate(@Param('id') id: string, @Body() b: Record<string, unknown>, @CurrentUser() u: AuthPayload) { return this.announcements.update(id, b, u); }
  @Delete('announcements/:id') @PortalTabTag('announcements') annRemove(@Param('id') id: string, @CurrentUser() u: AuthPayload) { return this.announcements.remove(id, u); }

  // ---- Snapshots / Restauração ----
  @Get('snapshots') @PortalTabTag('snapshots') snapList() { return this.snapshots.list(); }
  @Post('snapshots') @PortalTabTag('snapshots') snapCreate(@Body() b: { label?: string; reason?: string }, @CurrentUser() u: AuthPayload) { return this.snapshots.create(b?.label ?? '', b?.reason ?? null, 'MANUAL', u); }
  @Get('snapshots/:id/diff') @PortalTabTag('snapshots') snapDiff(@Param('id') id: string) { return this.snapshots.diff(id); }
  @Post('snapshots/:id/restore') @PortalTabTag('snapshots') snapRestore(@Param('id') id: string, @Body() b: { confirmationPhrase?: string }, @CurrentUser() u: AuthPayload) { return this.snapshots.restore(id, b?.confirmationPhrase, u); }
  @Delete('snapshots/:id') @PortalTabTag('snapshots') snapRemove(@Param('id') id: string, @CurrentUser() u: AuthPayload) { return this.snapshots.remove(id, u); }

  // ---- Diagnóstico ----
  @Get('diagnostics') @PortalTabTag('diagnostics') diagGet(@CurrentUser() u: AuthPayload) { return this.diagnostics.run(u); }
  @Post('diagnostics/run') @PortalTabTag('diagnostics') diagRun(@CurrentUser() u: AuthPayload) { return this.diagnostics.run(u); }

  // ---- Perfis e Permissões (surface do RBAC) ----
  @Get('permissions') @PortalTabTag('permissions') perms() { return this.permissions.overview(); }
}
