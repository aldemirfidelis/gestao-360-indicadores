import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, StreamableFile } from '@nestjs/common';
import { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { PersonnelService } from './personnel.service';

@Controller('personnel')
export class PersonnelController {
  constructor(private readonly service: PersonnelService) {}

  // ------------------------------ Ponto ------------------------------

  @Post('time-clock/punch')
  @RequirePermissions('ponto:clock', 'ponto:view')
  punch(@CurrentUser() me: AuthPayload, @Body() body: any, @Req() req: Request) {
    return this.service.punch(me, body, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Get('time-clock/summary')
  @RequirePermissions('ponto:view')
  summary(@CurrentUser() me: AuthPayload) {
    return this.service.summary(me);
  }

  @Get('time-clock/me')
  @RequirePermissions('ponto:view')
  myMirror(@CurrentUser() me: AuthPayload, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.myMirror(me, from, to);
  }

  @Get('time-clock/team')
  @RequirePermissions('ponto:team')
  teamMirror(@CurrentUser() me: AuthPayload, @Query('day') day?: string) {
    return this.service.teamMirror(me, day);
  }

  // ------------------------------ Ajustes ------------------------------

  @Post('time-clock/adjustments')
  @RequirePermissions('ponto:view')
  requestAdjustment(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.requestAdjustment(me, body);
  }

  @Get('time-clock/adjustments')
  @RequirePermissions('ponto:view')
  myAdjustments(@CurrentUser() me: AuthPayload) {
    return this.service.myAdjustments(me);
  }

  @Get('time-clock/adjustments/pending')
  @RequirePermissions('ponto:manage')
  pendingAdjustments(@CurrentUser() me: AuthPayload) {
    return this.service.pendingAdjustments(me);
  }

  @Post('time-clock/adjustments/:id/approve')
  @RequirePermissions('ponto:manage')
  approveAdjustment(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.decideAdjustment(me, id, 'approve', body);
  }

  @Post('time-clock/adjustments/:id/reject')
  @RequirePermissions('ponto:manage')
  rejectAdjustment(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.decideAdjustment(me, id, 'reject', body);
  }

  // ------------------------------ Importação ------------------------------

  @Post('time-clock/import')
  @RequirePermissions('ponto:manage')
  importPunches(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.importPunches(me, body);
  }

  // ------------------------------ Fechamento ------------------------------

  @Get('time-clock/periods/:ref/report')
  @RequirePermissions('ponto:manage')
  periodReport(@CurrentUser() me: AuthPayload, @Param('ref') ref: string) {
    return this.service.periodReport(me, ref);
  }

  @Get('time-clock/periods/:ref/report.csv')
  @RequirePermissions('ponto:manage')
  async periodReportCsv(
    @CurrentUser() me: AuthPayload,
    @Param('ref') ref: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.periodReportCsv(me, ref);
    res.setHeader('content-type', result.mimeType);
    res.setHeader('content-disposition', `attachment; filename="${result.fileName}"`);
    return new StreamableFile(result.content);
  }

  @Get('time-clock/periods')
  @RequirePermissions('ponto:manage')
  listPeriods(@CurrentUser() me: AuthPayload) {
    return this.service.listPeriods(me);
  }

  @Post('time-clock/periods/:ref/close')
  @RequirePermissions('ponto:manage')
  closePeriod(@CurrentUser() me: AuthPayload, @Param('ref') ref: string) {
    return this.service.closePeriod(me, ref);
  }

  @Post('time-clock/periods/:ref/reopen')
  @RequirePermissions('ponto:manage')
  reopenPeriod(@CurrentUser() me: AuthPayload, @Param('ref') ref: string) {
    return this.service.reopenPeriod(me, ref);
  }

  // ------------------------------ Escalas ------------------------------

  @Get('schedules')
  @RequirePermissions('ponto:view')
  listTemplates(@CurrentUser() me: AuthPayload) {
    return this.service.listTemplates(me);
  }

  @Post('schedules')
  @RequirePermissions('ponto:manage')
  createTemplate(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createTemplate(me, body);
  }

  @Patch('schedules/:id')
  @RequirePermissions('ponto:manage')
  updateTemplate(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateTemplate(me, id, body);
  }

  @Get('schedules/assignments')
  @RequirePermissions('ponto:team')
  listAssignments(@CurrentUser() me: AuthPayload) {
    return this.service.listAssignments(me);
  }

  @Post('schedules/assign')
  @RequirePermissions('ponto:manage')
  assignSchedule(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.assignSchedule(me, body);
  }

  @Get('options')
  @RequirePermissions('ponto:team')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me);
  }
}
