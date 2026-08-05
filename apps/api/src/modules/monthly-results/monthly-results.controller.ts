import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { MonthlyResultsService, PresentationBrandingInput } from './monthly-results.service';
import { MeetingMinutesService } from './meeting-minutes.service';

@Controller('monthly-results')
export class MonthlyResultsController {
  constructor(
    private readonly service: MonthlyResultsService,
    private readonly minutes: MeetingMinutesService,
  ) {}

  // ---- Ata integrada (ações que saíram da reunião) ----
  @Get('minutes/meetings')
  @RequirePermissions('monthly:view', 'actions:view')
  minutesMeetings(@CurrentUser() me: AuthPayload) {
    return this.minutes.meetings(me);
  }

  @Get('minutes')
  @RequirePermissions('monthly:view', 'actions:view')
  minutesList(
    @CurrentUser() me: AuthPayload,
    @Query('meetingId') meetingId?: string,
    @Query('periodRef') periodRef?: string,
    @Query('onlyOpen') onlyOpen?: string,
    @Query('source') source?: string,
  ) {
    return this.minutes.minutes(me, { meetingId, periodRef, onlyOpen, source });
  }

  /** Acompanhamento das acoes de reunioes anteriores (card da apresentacao). */
  @Get('meetings/:id/outcome-follow-up')
  @RequirePermissions('monthly:view', 'actions:view')
  outcomeFollowUp(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.minutes.outcomeFollowUp(me, id);
  }

  @Get('minutes/actions/:actionId/curve')
  @RequirePermissions('monthly:view', 'actions:view')
  minutesCurve(@CurrentUser() me: AuthPayload, @Param('actionId') actionId: string) {
    return this.minutes.curve(me, actionId);
  }

  // ---- Leitura / overview ----
  @Get('options')
  @RequirePermissions('monthly:view')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me);
  }

  @Get('dashboard')
  @RequirePermissions('monthly:view')
  dashboard(@CurrentUser() me: AuthPayload, @Query('periodRef') periodRef?: string, @Query('areaIds') areaIds?: string) {
    return this.service.dashboard(me, { periodRef, areaIds });
  }

  @Get('meetings/:id')
  @RequirePermissions('monthly:view')
  meetingDetail(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.meetingDetail(me, id);
  }

  // ---- Cabeçalho da apresentação (faixa PNG por empresa) ----
  @Get('presentation-branding')
  @RequirePermissions('monthly:view')
  presentationBranding(@CurrentUser() me: AuthPayload) {
    return this.service.presentationBranding(me);
  }

  @Put('presentation-branding')
  @RequirePermissions('monthly:update')
  savePresentationBranding(@CurrentUser() me: AuthPayload, @Body() body: PresentationBrandingInput) {
    return this.service.savePresentationBranding(me, body ?? {});
  }

  // ---- Reunião ----
  @Post('meetings')
  @RequirePermissions('monthly:create')
  createMeeting(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createMeeting(me, body);
  }

  @Patch('meetings/:id')
  @RequirePermissions('monthly:update')
  updateMeeting(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateMeeting(me, id, body);
  }

  @Delete('meetings/:id')
  @RequirePermissions('monthly:update')
  deleteMeeting(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.deleteMeeting(me, id);
  }

  @Post('meetings/:id/status')
  @RequirePermissions('monthly:present', 'monthly:update')
  changeStatus(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.changeStatus(me, id, body);
  }

  // ---- Preparação por área ----
  @Post('areas/:id/seed')
  @RequirePermissions('monthly:prepare', 'monthly:update')
  seedArea(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.seedArea(me, id);
  }

  @Patch('areas/:id')
  @RequirePermissions('monthly:prepare', 'monthly:validate', 'monthly:update')
  updateArea(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateArea(me, id, body);
  }

  @Patch('meeting-indicators/:id')
  @RequirePermissions('monthly:prepare', 'monthly:update')
  updateMeetingIndicator(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateMeetingIndicator(me, id, body);
  }

  // ---- Agenda + condução ----
  @Patch('agenda/:id')
  @RequirePermissions('monthly:update')
  updateAgendaItem(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateAgendaItem(me, id, body);
  }

  @Post('meetings/:id/agenda/reorder')
  @RequirePermissions('monthly:update')
  reorderAgenda(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { orderedIds?: string[] }) {
    return this.service.reorderAgenda(me, id, body?.orderedIds ?? []);
  }

  @Post('agenda/:id/timer')
  @RequirePermissions('monthly:present', 'monthly:update')
  agendaTimer(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.agendaTimer(me, id, body);
  }

  // ---- Decisões / riscos / escalonamentos ----
  @Post('meetings/:id/decisions')
  @RequirePermissions('monthly:decide', 'monthly:update')
  addDecision(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addDecision(me, id, body);
  }

  @Post('decisions/:id/action')
  @RequirePermissions('monthly:decide', 'monthly:update')
  createDecisionAction(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.createDecisionAction(me, id);
  }

  @Patch('decisions/:id')
  @RequirePermissions('monthly:decide', 'monthly:update')
  updateDecision(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateDecision(me, id, body);
  }

  @Delete('decisions/:id')
  @RequirePermissions('monthly:decide', 'monthly:update')
  deleteDecision(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.deleteDecision(me, id);
  }

  // ---- Ação vinculada (reuso de Planos de Ação) ----
  @Post('meetings/:id/actions')
  @RequirePermissions('monthly:decide', 'monthly:update')
  createAction(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.createAction(me, id, body);
  }

  // ---- Follow-up ----
  @Post('meetings/:id/follow-ups')
  @RequirePermissions('monthly:update')
  addFollowUp(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addFollowUp(me, id, body);
  }

  @Patch('follow-ups/:id')
  @RequirePermissions('monthly:update')
  updateFollowUp(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateFollowUp(me, id, body);
  }

  @Delete('follow-ups/:id')
  @RequirePermissions('monthly:update')
  deleteFollowUp(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.deleteFollowUp(me, id);
  }

  // ---- Aprendizado ----
  @Post('meetings/:id/learnings')
  @RequirePermissions('monthly:update')
  addLearning(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addLearning(me, id, body);
  }

  @Patch('learnings/:id')
  @RequirePermissions('monthly:update')
  updateLearning(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateLearning(me, id, body);
  }

  @Delete('learnings/:id')
  @RequirePermissions('monthly:update')
  deleteLearning(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.deleteLearning(me, id);
  }

  // ---- Padronização ----
  @Post('meetings/:id/standardizations')
  @RequirePermissions('monthly:update')
  addStandardization(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addStandardization(me, id, body);
  }

  @Patch('standardizations/:id')
  @RequirePermissions('monthly:update')
  updateStandardization(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateStandardization(me, id, body);
  }

  @Delete('standardizations/:id')
  @RequirePermissions('monthly:update')
  deleteStandardization(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.deleteStandardization(me, id);
  }

  // ---- Checklist ----
  @Patch('checklist/:id')
  @RequirePermissions('monthly:prepare', 'monthly:update')
  toggleChecklist(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.toggleChecklist(me, id, body);
  }

  // ---- IA ----
  @Post('meetings/:id/ai/key-message')
  @RequirePermissions('monthly:update')
  generateKeyMessage(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.generateKeyMessage(me, id);
  }

  @Post('meetings/:id/ai/minutes')
  @RequirePermissions('monthly:update')
  generateMinutes(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.generateMinutes(me, id);
  }

  @Post('meetings/:id/ai/executive-summary')
  @RequirePermissions('monthly:update')
  generateExecutiveSummary(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.generateExecutiveSummary(me, id);
  }
}
