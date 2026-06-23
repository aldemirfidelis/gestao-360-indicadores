import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { z } from 'zod';
import { userCreateSchema } from '@g360/shared';
import { Public } from '../auth/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UsersService } from '../users/users.service';
import { PlatformAdminAuthService } from './services/platform-admin-auth.service';
import { PlatformAdminService } from './services/platform-admin.service';
import { PlatformAdminAuditService } from './services/platform-admin-audit.service';
import { PlatformEmailService } from './services/platform-email.service';
import { PlatformAdminRequired } from './decorators/platform-permissions.decorator';
import { CurrentPlatformAdmin } from './decorators/current-platform-admin.decorator';
import { PlatformAdminIdentity } from './platform-admin.types';

function platformCompanyHeader(req?: Request) {
  const raw = req?.headers['x-platform-company-id'];
  if (Array.isArray(raw)) return raw[0];
  return raw ? String(raw) : undefined;
}

function requirePlatformCompanyHeader(req?: Request) {
  const companyId = platformCompanyHeader(req);
  if (!companyId) throw new BadRequestException('Selecione uma empresa para gerenciar usuarios.');
  return companyId;
}

const loginDto = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshDto = z.object({
  refreshToken: z.string().min(10),
});

@Public()
@Controller('platform-admin')
export class PlatformAdminController {
  constructor(
    private readonly auth: PlatformAdminAuthService,
    private readonly service: PlatformAdminService,
    private readonly audit: PlatformAdminAuditService,
    private readonly usersService: UsersService,
    private readonly email: PlatformEmailService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('auth/login')
  login(@Body(new ZodValidationPipe(loginDto)) body: z.infer<typeof loginDto>, @Req() req: Request) {
    return this.auth.login(body.email, body.password, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('auth/refresh')
  refresh(@Body(new ZodValidationPipe(refreshDto)) body: z.infer<typeof refreshDto>) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('auth/logout')
  logout(@Body() body: { refreshToken?: string }, @Req() req: Request) {
    return this.auth.logout(body.refreshToken, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('auth/me')
  @PlatformAdminRequired()
  me(@CurrentPlatformAdmin() user: PlatformAdminIdentity) {
    return this.auth.me(user.sub, user.sessionId);
  }

  @Post('sync-foundation')
  @PlatformAdminRequired('platform.internal_users.manage')
  syncFoundation(@CurrentPlatformAdmin() user: PlatformAdminIdentity) {
    return this.service.syncFoundation(user);
  }

  @Get('dashboard')
  @PlatformAdminRequired('platform.dashboard.view')
  dashboard() {
    return this.service.dashboard();
  }

  @Get('seo-presence')
  @PlatformAdminRequired('platform.dashboard.view')
  seoPresence() {
    return this.service.getSeoPresence();
  }

  @Patch('seo-presence')
  @PlatformAdminRequired('platform.internal_users.manage')
  updateSeoPresence(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Body() body: Record<string, unknown>) {
    return this.service.updateSeoPresence(user, body);
  }

  @Get('companies')
  @PlatformAdminRequired('platform.companies.view')
  companies(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('plan') plan?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.service.listCompanies({
      q,
      status,
      plan,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Post('companies')
  @PlatformAdminRequired('platform.companies.create')
  createCompany(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Body() body: Record<string, unknown>) {
    return this.service.createCompany(user, body);
  }

  @Get('companies/:id')
  @PlatformAdminRequired('platform.companies.view')
  company(@Param('id') id: string) {
    return this.service.getCompany(id);
  }

  @Patch('companies/:id')
  @PlatformAdminRequired('platform.companies.edit')
  updateCompany(
    @CurrentPlatformAdmin() user: PlatformAdminIdentity,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updateCompany(user, id, body);
  }

  @Patch('companies/:id/status')
  @PlatformAdminRequired('platform.companies.suspend')
  setCompanyStatus(
    @CurrentPlatformAdmin() user: PlatformAdminIdentity,
    @Param('id') id: string,
    @Body() body: { status: string; reason?: string },
  ) {
    return this.service.setCompanyStatus(user, id, body.status, body.reason ?? null);
  }

  @Get('modules')
  @PlatformAdminRequired('platform.modules.view')
  modules() {
    return this.service.listModules();
  }

  @Get('module-matrix')
  @PlatformAdminRequired('platform.modules.view')
  moduleMatrix() {
    return this.service.moduleMatrix();
  }

  @Patch('companies/:companyId/modules/:moduleCode')
  @PlatformAdminRequired('platform.modules.manage')
  setCompanyModule(
    @CurrentPlatformAdmin() user: PlatformAdminIdentity,
    @Param('companyId') companyId: string,
    @Param('moduleCode') moduleCode: string,
    @Body() body: { status: string; reason?: string; note?: string; readOnly?: boolean; activationScheduledAt?: string; expirationScheduledAt?: string; trialEndsAt?: string },
  ) {
    return this.service.setCompanyModule(user, companyId, moduleCode, body);
  }

  @Post('companies/:companyId/modules/apply-plan/:planCode')
  @PlatformAdminRequired('platform.modules.manage')
  applyPlanModules(
    @CurrentPlatformAdmin() user: PlatformAdminIdentity,
    @Param('companyId') companyId: string,
    @Param('planCode') planCode: string,
  ) {
    return this.service.applyPlanDefaults(companyId, planCode, user);
  }

  @Get('plans')
  @PlatformAdminRequired('platform.plans.view')
  plans() {
    return this.service.listPlans();
  }

  @Post('plans')
  @PlatformAdminRequired('platform.plans.manage')
  upsertPlan(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Body() body: Record<string, unknown>) {
    return this.service.upsertPlan(user, body);
  }

  @Get('users')
  @PlatformAdminRequired('platform.users.view')
  users(@Req() req: Request, @Query('q') q?: string, @Query('companyId') companyId?: string, @Query('status') status?: string) {
    const scopedCompanyId = companyId ?? platformCompanyHeader(req);
    if (scopedCompanyId) return this.usersService.list(scopedCompanyId);
    return this.service.listUsers({ q, status });
  }

  @Get('users/permissions')
  @PlatformAdminRequired('platform.users.manage')
  userPermissions() {
    return this.usersService.listPermissions();
  }

  @Get('users/:id')
  @PlatformAdminRequired('platform.users.view')
  userById(@Req() req: Request, @Param('id') id: string) {
    return this.usersService.getById(id, requirePlatformCompanyHeader(req), true);
  }

  @Post('users')
  @PlatformAdminRequired('platform.users.manage')
  createUser(@Req() req: Request, @Body(new ZodValidationPipe(userCreateSchema)) body: any) {
    return this.usersService.create({ ...body, companyId: requirePlatformCompanyHeader(req) }, true);
  }

  @Patch('users/:id')
  @PlatformAdminRequired('platform.users.manage')
  updateUser(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.usersService.update(id, requirePlatformCompanyHeader(req), true, body);
  }

  @Patch('users/:id/permissions')
  @PlatformAdminRequired('platform.users.manage')
  setUserPermissions(@Req() req: Request, @Param('id') id: string, @Body() body: { permissionKeys: string[] }) {
    return this.usersService.setPermissions(id, requirePlatformCompanyHeader(req), true, body.permissionKeys ?? []);
  }

  @Patch('users/:id/active')
  @PlatformAdminRequired('platform.users.manage')
  setUserActive(@Req() req: Request, @Param('id') id: string, @Body() body: { active: boolean }) {
    return this.usersService.setActive(id, requirePlatformCompanyHeader(req), true, Boolean(body.active));
  }

  @Patch('users/:id/status')
  @PlatformAdminRequired('platform.users.manage')
  setUserStatus(
    @CurrentPlatformAdmin() user: PlatformAdminIdentity,
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'PENDING' },
  ) {
    return this.service.setUserStatus(user, id, body.status);
  }

  @Post('users/:id/revoke-sessions')
  @PlatformAdminRequired('platform.users.manage')
  revokeUserSessions(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Param('id') id: string) {
    return this.service.revokeUserSessions(user, id);
  }

  @Delete('users/:id')
  @PlatformAdminRequired('platform.users.manage')
  removeUser(@Req() req: Request, @Param('id') id: string) {
    return this.usersService.remove(id, requirePlatformCompanyHeader(req), true);
  }

  @Get('sessions')
  @PlatformAdminRequired('platform.access_logs.view')
  sessions() {
    return this.service.sessions();
  }

  @Post('support-sessions')
  @PlatformAdminRequired('platform.support_mode.start')
  startSupport(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Body() body: { companyId?: string; reason?: string; justification?: string; minutes?: number; readOnly?: boolean }) {
    return this.service.startSupportSession(user, body);
  }

  @Patch('support-sessions/:id/end')
  @PlatformAdminRequired('platform.support_mode.start')
  endSupport(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Param('id') id: string) {
    return this.service.endSupportSession(user, id);
  }

  @Get('database')
  @PlatformAdminRequired('platform.database.health')
  database() {
    return this.service.database();
  }

  @Get('audit')
  @PlatformAdminRequired('platform.audit_logs.view')
  auditLogs(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
    @Query('moduleCode') moduleCode?: string,
    @Query('action') action?: string,
    @Query('result') result?: string,
    @Query('q') q?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.audit.list({
      from,
      to,
      companyId,
      moduleCode,
      action,
      result,
      q,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Get('feature-flags')
  @PlatformAdminRequired('platform.feature_flags.manage')
  featureFlags() {
    return this.service.featureFlags();
  }

  @Post('feature-flags')
  @PlatformAdminRequired('platform.feature_flags.manage')
  upsertFeatureFlag(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Body() body: Record<string, unknown>) {
    return this.service.upsertFeatureFlag(user, body);
  }

  @Get('environments')
  @PlatformAdminRequired('platform.environments.manage')
  environments() {
    return this.service.environments();
  }

  @Get('integrations')
  @PlatformAdminRequired('platform.integrations.manage')
  integrations() {
    return this.service.integrations();
  }

  // ---- E-mail (SMTP + remetentes do sistema) ----

  @Get('email/settings')
  @PlatformAdminRequired('platform.integrations.manage')
  emailSettings() {
    return this.email.getSettings();
  }

  @Put('email/settings')
  @PlatformAdminRequired('platform.integrations.manage')
  updateEmailSettings(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Body() body: Record<string, unknown>) {
    return this.email.updateSettings(user, body);
  }

  @Post('email/test')
  @PlatformAdminRequired('platform.integrations.manage')
  testEmail(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Body() body: { to?: string }) {
    return this.email.sendTest(user, body);
  }

  @Get('email/mailboxes')
  @PlatformAdminRequired('platform.integrations.manage')
  mailboxes() {
    return this.email.listMailboxes();
  }

  @Post('email/mailboxes')
  @PlatformAdminRequired('platform.integrations.manage')
  createMailbox(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Body() body: Record<string, unknown>) {
    return this.email.createMailbox(user, body);
  }

  @Patch('email/mailboxes/:id')
  @PlatformAdminRequired('platform.integrations.manage')
  updateMailbox(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.email.updateMailbox(user, id, body);
  }

  @Post('email/mailboxes/:id/default')
  @PlatformAdminRequired('platform.integrations.manage')
  setDefaultMailbox(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Param('id') id: string) {
    return this.email.setDefaultMailbox(user, id);
  }

  @Delete('email/mailboxes/:id')
  @PlatformAdminRequired('platform.integrations.manage')
  deleteMailbox(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Param('id') id: string) {
    return this.email.deleteMailbox(user, id);
  }

  @Get('jobs')
  @PlatformAdminRequired('platform.jobs.manage')
  jobs() {
    return this.service.jobs();
  }

  @Get('maintenance')
  @PlatformAdminRequired('platform.maintenance.manage')
  maintenance() {
    return this.service.maintenance();
  }

  @Post('maintenance')
  @PlatformAdminRequired('platform.maintenance.manage')
  createMaintenance(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Body() body: Record<string, unknown>) {
    return this.service.createMaintenance(user, body);
  }
}
