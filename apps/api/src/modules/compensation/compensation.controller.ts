import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { PortalGate } from '../portal-admin/decorators/portal-gate.decorator';
import { CompensationService } from './compensation.service';

const VIEW = ['compensation:view', 'org:positions:view'];
const MANAGE = ['compensation:manage', 'org:positions:manage'];

@Controller('cargos-salarios')
@PortalGate({ module: 'compensation' })
export class CompensationController {
  constructor(private readonly service: CompensationService) {}

  @Get('options')
  @RequirePermissions(...VIEW)
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me);
  }

  @Get('overview')
  @RequirePermissions(...VIEW)
  overview(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.overview(me, query);
  }

  @Get('estrutura-quadro')
  @RequirePermissions(...VIEW)
  structure(@CurrentUser() me: AuthPayload) {
    return this.service.structure(me);
  }

  @Get('jobs')
  @RequirePermissions(...VIEW)
  listJobs(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listJobs(me, query);
  }

  @Post('jobs')
  @RequirePermissions('compensation:jobs:create', ...MANAGE)
  createJob(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createJob(me, body);
  }

  @Patch('jobs/:id')
  @RequirePermissions('compensation:jobs:update', ...MANAGE)
  updateJob(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateJob(me, id, body);
  }

  @Post('jobs/:id/duplicate')
  @RequirePermissions('compensation:jobs:create', ...MANAGE)
  duplicateJob(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.duplicateJob(me, id);
  }

  @Post('jobs/:id/version')
  @RequirePermissions('compensation:jobs:update', ...MANAGE)
  versionJob(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.versionJob(me, id, String(body.reason ?? 'Nova versao'));
  }

  @Patch('jobs/:id/inactivate')
  @RequirePermissions('compensation:jobs:update', ...MANAGE)
  inactivateJob(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.inactivateJob(me, id, String(body.reason ?? ''));
  }

  @Patch('jobs/:id/reactivate')
  @RequirePermissions('compensation:jobs:update', ...MANAGE)
  reactivateJob(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.reactivateJob(me, id);
  }

  @Get('descriptions')
  @RequirePermissions('compensation:descriptions:view', ...VIEW)
  listDescriptions(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listDescriptions(me, query);
  }

  @Post('descriptions')
  @RequirePermissions('compensation:descriptions:update', ...MANAGE)
  createDescription(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createDescription(me, body);
  }

  @Patch('descriptions/:id')
  @RequirePermissions('compensation:descriptions:update', ...MANAGE)
  updateDescription(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateDescription(me, id, body);
  }

  @Patch('descriptions/:id/status')
  @RequirePermissions('compensation:descriptions:approve', ...MANAGE)
  changeDescriptionStatus(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.changeDescriptionStatus(me, id, String(body.status ?? ''), String(body.reason ?? ''));
  }

  @Get('salary-tables')
  @RequirePermissions('compensation:salary-table:view', ...VIEW)
  listSalaryTables(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listSalaryTables(me, query);
  }

  @Post('salary-tables')
  @RequirePermissions('compensation:salary-table:update', ...MANAGE)
  createSalaryTable(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createSalaryTable(me, body);
  }

  @Patch('salary-tables/:id')
  @RequirePermissions('compensation:salary-table:update', ...MANAGE)
  updateSalaryTable(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateSalaryTable(me, id, body);
  }

  @Post('salary-tables/:id/ranges')
  @RequirePermissions('compensation:salary-table:update', ...MANAGE)
  addSalaryRange(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.addSalaryRange(me, id, body);
  }

  @Post('salary-tables/:id/publish')
  @RequirePermissions('compensation:salary-table:approve', ...MANAGE)
  publishSalaryTable(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.publishSalaryTable(me, id);
  }

  @Post('salary-tables/:id/revision')
  @RequirePermissions('compensation:salary-table:update', ...MANAGE)
  createSalaryTableRevision(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.createSalaryTableRevision(me, id, String(body.justification ?? 'Nova revisao'));
  }

  @Get('enquadramento')
  @RequirePermissions('compensation:salary-fit:view', ...VIEW)
  salaryFit(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.salaryFit(me, query);
  }

  @Get('movements')
  @RequirePermissions('compensation:movements:view', ...VIEW)
  listMovements(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listMovements(me, query);
  }

  @Post('movements')
  @RequirePermissions('compensation:movements:request', ...MANAGE)
  createMovement(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createMovement(me, body);
  }

  @Patch('movements/:id/approve')
  @RequirePermissions('compensation:movements:approve', ...MANAGE)
  approveMovement(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.decideMovement(me, id, 'APPROVED', String(body.note ?? ''));
  }

  @Patch('movements/:id/reject')
  @RequirePermissions('compensation:movements:approve', ...MANAGE)
  rejectMovement(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.decideMovement(me, id, 'REJECTED', String(body.note ?? ''));
  }

  @Patch('movements/:id/apply')
  @RequirePermissions('compensation:movements:execute', ...MANAGE)
  applyMovement(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.applyMovement(me, id);
  }

  @Get('reports')
  @RequirePermissions('compensation:reports:view', ...VIEW)
  reports(@CurrentUser() me: AuthPayload) {
    return this.service.reports(me);
  }

  @Get('audit')
  @RequirePermissions('compensation:audit:view', 'audit:view')
  audit(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.auditTimeline(me, query);
  }
}

