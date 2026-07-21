import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, StreamableFile } from '@nestjs/common';
import { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { PersonnelService } from './personnel.service';
import { TimeBankService } from './time-bank.service';
import { PayrollService } from './payroll.service';
import { LegalFilesService } from './legal-files.service';

@Controller('personnel')
export class PersonnelController {
  constructor(
    private readonly service: PersonnelService,
    private readonly timeBank: TimeBankService,
    private readonly payroll: PayrollService,
    private readonly legal: LegalFilesService,
  ) {}

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

  @Get('time-clock/user/:userId')
  @RequirePermissions('ponto:team', 'ponto:manage')
  userMirror(@CurrentUser() me: AuthPayload, @Param('userId') userId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.userMirror(me, userId, from, to);
  }

  @Get('time-clock/team/dashboard')
  @RequirePermissions('ponto:team')
  teamDashboard(@CurrentUser() me: AuthPayload) {
    return this.service.teamDashboard(me);
  }

  @Get('time-clock/entries/:id/receipt')
  @RequirePermissions('ponto:view')
  punchReceipt(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.punchReceipt(me, id);
  }

  @Get('time-clock/explain/:userId/:dayKey')
  @RequirePermissions('ponto:view', 'ponto:team')
  explainDay(@CurrentUser() me: AuthPayload, @Param('userId') userId: string, @Param('dayKey') dayKey: string) {
    return this.service.explainDay(me, userId, dayKey);
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

  // Líderes (ponto:team) decidem dentro da própria abrangência; o service
  // aplica o escopo por área e proíbe decidir a própria solicitação.
  @Get('time-clock/adjustments/pending')
  @RequirePermissions('ponto:team', 'ponto:manage')
  pendingAdjustments(@CurrentUser() me: AuthPayload) {
    return this.service.pendingAdjustments(me);
  }

  @Post('time-clock/adjustments/:id/approve')
  @RequirePermissions('ponto:team', 'ponto:manage')
  approveAdjustment(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.decideAdjustment(me, id, 'approve', body);
  }

  @Post('time-clock/adjustments/:id/reject')
  @RequirePermissions('ponto:team', 'ponto:manage')
  rejectAdjustment(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.decideAdjustment(me, id, 'reject', body);
  }

  // ------------------------------ Central de Ocorrências ------------------------------

  @Get('occurrences')
  @RequirePermissions('ponto:team', 'ponto:manage')
  listOccurrences(@CurrentUser() me: AuthPayload, @Query() query: any) {
    return this.service.listOccurrences(me, query);
  }

  @Get('occurrences/mine')
  @RequirePermissions('ponto:view')
  myOccurrences(@CurrentUser() me: AuthPayload) {
    return this.service.myOccurrences(me);
  }

  @Post('occurrences/scan')
  @RequirePermissions('ponto:team', 'ponto:manage')
  scanOccurrences(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.scanOccurrences(me, body);
  }

  @Post('occurrences/:id/justify')
  @RequirePermissions('ponto:team', 'ponto:manage')
  justifyOccurrence(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.treatOccurrence(me, id, 'justify', body);
  }

  @Post('occurrences/:id/dismiss')
  @RequirePermissions('ponto:manage')
  dismissOccurrence(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.treatOccurrence(me, id, 'dismiss', body);
  }

  // ------------------------------ Banco de horas ------------------------------

  @Get('time-bank/me')
  @RequirePermissions('ponto:view')
  myBank(@CurrentUser() me: AuthPayload) {
    return this.timeBank.statement(me);
  }

  @Get('time-bank/user/:userId')
  @RequirePermissions('ponto:team', 'ponto:manage')
  userBank(@CurrentUser() me: AuthPayload, @Param('userId') userId: string) {
    return this.timeBank.statement(me, userId);
  }

  @Post('time-bank/entries')
  @RequirePermissions('ponto:manage')
  manualBankEntry(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.timeBank.manualEntry(me, body);
  }

  @Get('time-bank/policy')
  @RequirePermissions('ponto:view')
  bankPolicy(@CurrentUser() me: AuthPayload) {
    return this.timeBank.getPolicy(me.companyId);
  }

  @Post('time-bank/policy')
  @RequirePermissions('ponto:manage')
  setBankPolicy(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.timeBank.setPolicy(me, body);
  }

  // ------------------------------ Eventos para folha ------------------------------

  @Get('payroll/rubrics')
  @RequirePermissions('ponto:manage')
  payrollRubrics(@CurrentUser() me: AuthPayload) {
    return this.payroll.listRubrics(me.companyId);
  }

  @Post('payroll/rubrics')
  @RequirePermissions('ponto:manage')
  setPayrollRubric(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.payroll.setRubric(me, body);
  }

  @Get('payroll/events/:ref')
  @RequirePermissions('ponto:manage')
  payrollEvents(@CurrentUser() me: AuthPayload, @Param('ref') ref: string) {
    return this.payroll.computeEvents(me, ref);
  }

  @Get('payroll/exports')
  @RequirePermissions('ponto:manage')
  payrollExports(@CurrentUser() me: AuthPayload, @Query('ref') ref?: string) {
    return this.payroll.listExports(me, ref);
  }

  @Get('payroll/export/:ref')
  @RequirePermissions('ponto:manage')
  async payrollExport(
    @CurrentUser() me: AuthPayload,
    @Param('ref') ref: string,
    @Query('format') format: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const fmt = ['JSON', 'TXT', 'CSV'].includes(String(format).toUpperCase()) ? (String(format).toUpperCase() as 'CSV' | 'JSON' | 'TXT') : 'CSV';
    const result = await this.payroll.export(me, ref, fmt);
    res.setHeader('content-type', result.mimeType);
    res.setHeader('content-disposition', `attachment; filename="${result.fileName}"`);
    return new StreamableFile(result.content);
  }

  // ------------------------------ Central Fiscal (REP-P) ------------------------------

  @Get('legal/config')
  @RequirePermissions('ponto:view')
  legalConfig(@CurrentUser() me: AuthPayload) {
    return this.legal.getConfig(me.companyId);
  }

  @Post('legal/config')
  @RequirePermissions('ponto:manage')
  setLegalConfig(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.legal.setConfig(me, body);
  }

  @Get('legal/status')
  @RequirePermissions('ponto:manage')
  legalStatus(@CurrentUser() me: AuthPayload) {
    return this.legal.complianceStatus(me);
  }

  @Get('legal/afd/:ref')
  @RequirePermissions('ponto:manage')
  async afd(@CurrentUser() me: AuthPayload, @Param('ref') ref: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.legal.buildAfd(me, ref);
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('x-file-warnings', String(result.warnings.length));
    return new StreamableFile(Buffer.from(result.content, 'utf8'));
  }

  @Get('legal/aej/:ref')
  @RequirePermissions('ponto:manage')
  async aej(@CurrentUser() me: AuthPayload, @Param('ref') ref: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.legal.buildAej(me, ref);
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('x-file-warnings', String(result.warnings.length));
    return new StreamableFile(Buffer.from(result.content, 'utf8'));
  }

  @Get('legal/afd/:ref/preview')
  @RequirePermissions('ponto:manage')
  async afdPreview(@CurrentUser() me: AuthPayload, @Param('ref') ref: string) {
    const result = await this.legal.buildAfd(me, ref);
    return { fileName: result.fileName, lines: result.lines, warnings: result.warnings };
  }

  @Get('legal/aej/:ref/preview')
  @RequirePermissions('ponto:manage')
  async aejPreview(@CurrentUser() me: AuthPayload, @Param('ref') ref: string) {
    const result = await this.legal.buildAej(me, ref);
    return { fileName: result.fileName, lines: result.lines, warnings: result.warnings };
  }

  @Get('legal/mirror/:ref/:userId')
  @RequirePermissions('ponto:manage')
  async legalMirror(
    @CurrentUser() me: AuthPayload,
    @Param('ref') ref: string,
    @Param('userId') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.legal.buildMirror(me, ref, userId);
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('x-file-warnings', String(result.warnings.length));
    return new StreamableFile(Buffer.from(result.content, 'utf8'));
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

  @Get('time-clock/periods/:ref/preview')
  @RequirePermissions('ponto:manage')
  closingPreview(@CurrentUser() me: AuthPayload, @Param('ref') ref: string) {
    return this.service.closingPreview(me, ref);
  }

  @Post('time-clock/periods/:ref/close')
  @RequirePermissions('ponto:manage')
  closePeriod(@CurrentUser() me: AuthPayload, @Param('ref') ref: string) {
    return this.service.closePeriod(me, ref);
  }

  @Post('time-clock/periods/:ref/reopen')
  @RequirePermissions('ponto:manage')
  reopenPeriod(@CurrentUser() me: AuthPayload, @Param('ref') ref: string, @Body() body: any) {
    return this.service.reopenPeriod(me, ref, body);
  }

  @Get('time-clock/periods/:ref/versions')
  @RequirePermissions('ponto:manage')
  periodVersions(@CurrentUser() me: AuthPayload, @Param('ref') ref: string) {
    return this.service.periodVersions(me, ref);
  }

  // ------------------------------ Feriados ------------------------------

  @Get('holidays')
  @RequirePermissions('ponto:view')
  listHolidays(@CurrentUser() me: AuthPayload, @Query('year') year?: string) {
    return this.service.listHolidays(me, year);
  }

  @Post('holidays')
  @RequirePermissions('ponto:manage')
  createHoliday(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createHoliday(me, body);
  }

  @Post('holidays/generate')
  @RequirePermissions('ponto:manage')
  generateHolidays(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.generateHolidays(me, body);
  }

  @Delete('holidays/:id')
  @RequirePermissions('ponto:manage')
  deleteHoliday(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.deleteHoliday(me, id);
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
