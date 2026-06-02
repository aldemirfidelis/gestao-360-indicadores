import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { SuperAdminPortalGuard } from '../guards/super-admin-portal.guard';
import { PortalTabTag } from '../decorators/portal-tab.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthPayload } from '../../auth/auth.types';
import { PortalOverviewService } from '../services/portal-overview.service';
import { RegistryService } from '../services/registry.service';
import { FeatureFlagService } from '../services/feature-flag.service';
import { PortalAuditService } from '../services/portal-audit.service';

@Controller('admin/portal')
@UseGuards(SuperAdminPortalGuard)
export class PortalAdminController {
  constructor(
    private readonly overview: PortalOverviewService,
    private readonly registry: RegistryService,
    private readonly flags: FeatureFlagService,
    private readonly audit: PortalAuditService,
  ) {}

  // ---- Visão geral ----
  @Get('overview')
  @PortalTabTag('overview')
  getOverview() {
    return this.overview.getOverview();
  }

  // ---- Registro (sync) ----
  @Post('registry/sync')
  @PortalTabTag('advanced')
  sync(@CurrentUser() user: AuthPayload) {
    return this.registry.sync(user);
  }

  // ---- Módulos ----
  @Get('modules')
  @PortalTabTag('modules')
  listModules() {
    return this.registry.listModules();
  }

  @Put('modules/:code')
  @PortalTabTag('modules')
  updateModule(@Param('code') code: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthPayload) {
    return this.registry.updateModule(code, body ?? {}, user);
  }

  @Post('modules/:code/status')
  @PortalTabTag('modules')
  setModuleStatus(@Param('code') code: string, @Body() body: { status: string; confirmationPhrase?: string; reason?: string }, @CurrentUser() user: AuthPayload) {
    return this.registry.setModuleStatus(code, body?.status, { confirmationPhrase: body?.confirmationPhrase, reason: body?.reason }, user);
  }

  @Post('modules/:code/enable')
  @PortalTabTag('modules')
  enableModule(@Param('code') code: string, @CurrentUser() user: AuthPayload) {
    return this.registry.setModuleStatus(code, 'ACTIVE', {}, user);
  }

  @Post('modules/:code/disable')
  @PortalTabTag('modules')
  disableModule(@Param('code') code: string, @Body() body: { confirmationPhrase?: string; reason?: string }, @CurrentUser() user: AuthPayload) {
    return this.registry.setModuleStatus(code, 'INACTIVE', { confirmationPhrase: body?.confirmationPhrase, reason: body?.reason }, user);
  }

  @Post('modules/:code/maintenance')
  @PortalTabTag('modules')
  maintenanceModule(@Param('code') code: string, @Body() body: { confirmationPhrase?: string; reason?: string }, @CurrentUser() user: AuthPayload) {
    return this.registry.setModuleStatus(code, 'MAINTENANCE', { confirmationPhrase: body?.confirmationPhrase, reason: body?.reason }, user);
  }

  // ---- Páginas ----
  @Get('pages')
  @PortalTabTag('pages')
  listPages() {
    return this.registry.listPages();
  }

  @Post('pages/:code/status')
  @PortalTabTag('pages')
  setPageStatus(@Param('code') code: string, @Body() body: { status: string; confirmationPhrase?: string; reason?: string }, @CurrentUser() user: AuthPayload) {
    return this.registry.setPageStatus(code, body?.status, { confirmationPhrase: body?.confirmationPhrase, reason: body?.reason }, user);
  }

  @Put('pages/:code')
  @PortalTabTag('pages')
  updatePage(@Param('code') code: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthPayload) {
    return this.registry.updatePage(code, body ?? {}, user);
  }

  // ---- Funcionalidades ----
  @Get('features')
  @PortalTabTag('features')
  listFeatures() {
    return this.registry.listFeatures();
  }

  @Post('features/:code/status')
  @PortalTabTag('features')
  setFeatureStatus(@Param('code') code: string, @Body() body: { status: string }, @CurrentUser() user: AuthPayload) {
    return this.registry.setFeatureStatus(code, body?.status, user);
  }

  @Put('features/:code')
  @PortalTabTag('features')
  updateFeature(@Param('code') code: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthPayload) {
    return this.registry.updateFeature(code, body ?? {}, user);
  }

  // ---- Feature flags ----
  @Get('flags')
  @PortalTabTag('features')
  listFlags() {
    return this.flags.list();
  }

  @Put('flags')
  @PortalTabTag('features')
  upsertFlag(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthPayload) {
    return this.flags.upsert(body as Parameters<FeatureFlagService['upsert']>[0], user);
  }

  @Delete('flags/:key')
  @PortalTabTag('features')
  deleteFlag(@Param('key') key: string, @CurrentUser() user: AuthPayload) {
    return this.flags.remove(key, user);
  }

  // ---- Auditoria ----
  @Get('audit')
  @PortalTabTag('audit')
  audit_(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tab') tab?: string,
    @Query('action') action?: string,
    @Query('result') result?: string,
    @Query('q') q?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.audit.list({ from, to, tab, action, result, q, skip: skip ? parseInt(skip, 10) : undefined, take: take ? parseInt(take, 10) : undefined });
  }
}
