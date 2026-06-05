import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { AuditsService } from './audits.service';

@Controller('audits')
export class AuditsController {
  constructor(private readonly service: AuditsService) {}

  @Get()
  @RequirePermissions('audits:view')
  list(
    @CurrentUser() me: AuthPayload,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('modality') modality?: string,
    @Query('search') search?: string,
    @Query('orgNodeId') orgNodeId?: string,
    @Query('programId') programId?: string,
    @Query('leadAuditorUserId') leadAuditorUserId?: string,
  ) {
    return this.service.list(me, { status, type, modality, search, orgNodeId, programId, leadAuditorUserId });
  }

  @Get('summary')
  @RequirePermissions('audits:view', 'audits:dashboard')
  summary(@CurrentUser() me: AuthPayload) {
    return this.service.summary(me);
  }

  @Get('dashboard')
  @RequirePermissions('audits:view', 'audits:dashboard')
  dashboard(@CurrentUser() me: AuthPayload) {
    return this.service.dashboard(me);
  }

  @Get('options')
  @RequirePermissions('audits:view')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me);
  }

  @Get('programs')
  @RequirePermissions('audits:view', 'audits:programs')
  programs(@CurrentUser() me: AuthPayload, @Query('status') status?: string, @Query('search') search?: string) {
    return this.service.listPrograms(me, { status, search });
  }

  @Post('programs')
  @RequirePermissions('audits:programs', 'audits:create')
  createProgram(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createProgram(me, body);
  }

  @Patch('programs/:programId')
  @RequirePermissions('audits:programs', 'audits:update')
  updateProgram(@CurrentUser() me: AuthPayload, @Param('programId') programId: string, @Body() body: any) {
    return this.service.updateProgram(me, programId, body);
  }

  @Get('universe')
  @RequirePermissions('audits:view', 'audits:universe')
  universe(@CurrentUser() me: AuthPayload, @Query('kind') kind?: string, @Query('riskLevel') riskLevel?: string, @Query('search') search?: string) {
    return this.service.listUniverse(me, { kind, riskLevel, search });
  }

  @Post('universe')
  @RequirePermissions('audits:universe', 'audits:create')
  createUniverse(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createUniverseItem(me, body);
  }

  @Patch('universe/:itemId')
  @RequirePermissions('audits:universe', 'audits:update')
  updateUniverse(@CurrentUser() me: AuthPayload, @Param('itemId') itemId: string, @Body() body: any) {
    return this.service.updateUniverseItem(me, itemId, body);
  }

  @Get('risk-criteria')
  @RequirePermissions('audits:view', 'audits:universe')
  riskCriteria(@CurrentUser() me: AuthPayload) {
    return this.service.listRiskCriteria(me);
  }

  @Post('risk-criteria')
  @RequirePermissions('audits:universe', 'audits:manage')
  createRiskCriterion(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createRiskCriterion(me, body);
  }

  @Patch('risk-criteria/:criterionId')
  @RequirePermissions('audits:universe', 'audits:manage')
  updateRiskCriterion(@CurrentUser() me: AuthPayload, @Param('criterionId') criterionId: string, @Body() body: any) {
    return this.service.updateRiskCriterion(me, criterionId, body);
  }

  @Get('types')
  @RequirePermissions('audits:view', 'audits:types')
  types(@CurrentUser() me: AuthPayload) {
    return this.service.listTypes(me);
  }

  @Post('types')
  @RequirePermissions('audits:types', 'audits:manage')
  createType(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createType(me, body);
  }

  @Patch('types/:typeId')
  @RequirePermissions('audits:types', 'audits:manage')
  updateType(@CurrentUser() me: AuthPayload, @Param('typeId') typeId: string, @Body() body: any) {
    return this.service.updateType(me, typeId, body);
  }

  @Get('auditors')
  @RequirePermissions('audits:view', 'audits:auditors')
  auditors(@CurrentUser() me: AuthPayload) {
    return this.service.listAuditors(me);
  }

  @Post('auditors')
  @RequirePermissions('audits:auditors', 'audits:manage')
  createAuditor(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createAuditor(me, body);
  }

  @Patch('auditors/:auditorId')
  @RequirePermissions('audits:auditors', 'audits:manage')
  updateAuditor(@CurrentUser() me: AuthPayload, @Param('auditorId') auditorId: string, @Body() body: any) {
    return this.service.updateAuditor(me, auditorId, body);
  }

  @Post('auditors/suggest')
  @RequirePermissions('audits:view', 'audits:auditors')
  suggestAuditors(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.suggestAuditors(me, body);
  }

  @Get('standards')
  @RequirePermissions('audits:view', 'audits:standards')
  standards(@CurrentUser() me: AuthPayload) {
    return this.service.listStandards(me);
  }

  @Post('standards')
  @RequirePermissions('audits:standards', 'audits:manage')
  createStandard(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createStandard(me, body);
  }

  @Patch('standards/:standardId')
  @RequirePermissions('audits:standards', 'audits:manage')
  updateStandard(@CurrentUser() me: AuthPayload, @Param('standardId') standardId: string, @Body() body: any) {
    return this.service.updateStandard(me, standardId, body);
  }

  @Get('checklist-templates')
  @RequirePermissions('audits:view', 'audits:checklists')
  checklistTemplates(@CurrentUser() me: AuthPayload) {
    return this.service.listChecklistTemplates(me);
  }

  @Post('checklist-templates')
  @RequirePermissions('audits:checklists', 'audits:manage')
  createChecklistTemplate(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createChecklistTemplate(me, body);
  }

  @Patch('checklist-templates/:templateId')
  @RequirePermissions('audits:checklists', 'audits:manage')
  updateChecklistTemplate(@CurrentUser() me: AuthPayload, @Param('templateId') templateId: string, @Body() body: any) {
    return this.service.updateChecklistTemplate(me, templateId, body);
  }

  @Post('checklist-executions/:executionId/responses')
  @RequirePermissions('audits:execute', 'audits:update')
  saveChecklistResponse(@CurrentUser() me: AuthPayload, @Param('executionId') executionId: string, @Body() body: any) {
    return this.service.saveChecklistResponse(me, executionId, body);
  }

  @Post('checklist-executions/:executionId/complete')
  @RequirePermissions('audits:execute', 'audits:update')
  completeChecklist(@CurrentUser() me: AuthPayload, @Param('executionId') executionId: string, @Body() body: any) {
    return this.service.completeChecklist(me, executionId, body);
  }

  @Patch('reports/:reportId/decision')
  @RequirePermissions('audits:approve', 'audits:update')
  decideReport(@CurrentUser() me: AuthPayload, @Param('reportId') reportId: string, @Body() body: any) {
    return this.service.decideReport(me, reportId, body);
  }

  @Patch('follow-ups/:followUpId')
  @RequirePermissions('audits:followup', 'audits:update')
  updateFollowUp(@CurrentUser() me: AuthPayload, @Param('followUpId') followUpId: string, @Body() body: any) {
    return this.service.updateFollowUp(me, followUpId, body);
  }

  @Patch('ai/suggestions/:suggestionId/decision')
  @RequirePermissions('audits:ai', 'audits:update')
  decideAiSuggestion(@CurrentUser() me: AuthPayload, @Param('suggestionId') suggestionId: string, @Body() body: any) {
    return this.service.decideAiSuggestion(me, suggestionId, body);
  }

  @Post()
  @RequirePermissions('audits:create')
  create(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.create(me, body);
  }

  @Get(':id')
  @RequirePermissions('audits:view')
  byId(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getById(me, id);
  }

  @Patch(':id')
  @RequirePermissions('audits:update')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.update(me, id, body);
  }

  @Delete(':id')
  @RequirePermissions('audits:delete')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.remove(me, id);
  }

  @Post(':id/transition')
  @RequirePermissions('audits:update')
  transition(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.transition(me, id, body?.status, body);
  }

  @Post(':id/start')
  @RequirePermissions('audits:execute', 'audits:update')
  start(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.start(me, id, body);
  }

  @Post(':id/complete')
  @RequirePermissions('audits:close', 'audits:update')
  complete(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.complete(me, id, body);
  }

  @Post(':id/reopen')
  @RequirePermissions('audits:reopen', 'audits:update')
  reopen(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.reopen(me, id, body);
  }

  @Post(':id/checklists')
  @RequirePermissions('audits:execute', 'audits:update')
  startChecklist(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.startChecklist(me, id, body);
  }

  @Get(':id/evidence')
  @RequirePermissions('audits:view', 'audits:evidence')
  evidence(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.listEvidence(me, id);
  }

  @Post(':id/evidence')
  @RequirePermissions('audits:evidence', 'audits:update')
  addEvidence(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addEvidence(me, id, body);
  }

  @Post(':id/report')
  @RequirePermissions('audits:reports', 'audits:update')
  generateReport(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.generateReport(me, id, body);
  }

  @Post(':id/follow-ups')
  @RequirePermissions('audits:followup', 'audits:update')
  createFollowUp(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.createFollowUp(me, id, body);
  }

  @Post(':id/ai/suggestions')
  @RequirePermissions('audits:ai', 'audits:update')
  createAiSuggestions(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.createAiSuggestions(me, id, body);
  }

  @Post(':id/findings')
  @RequirePermissions('audits:findings', 'audits:update')
  addFinding(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addFinding(me, id, body);
  }

  @Patch('findings/:findingId')
  @RequirePermissions('audits:findings', 'audits:update')
  updateFinding(@CurrentUser() me: AuthPayload, @Param('findingId') findingId: string, @Body() body: any) {
    return this.service.updateFinding(me, findingId, body);
  }

  @Delete('findings/:findingId')
  @RequirePermissions('audits:findings', 'audits:update')
  removeFinding(@CurrentUser() me: AuthPayload, @Param('findingId') findingId: string) {
    return this.service.removeFinding(me, findingId);
  }

  @Post('findings/:findingId/nonconformity')
  @RequirePermissions('audits:findings', 'audits:update')
  generateNc(@CurrentUser() me: AuthPayload, @Param('findingId') findingId: string, @Body() body: any) {
    return this.service.generateNonConformity(me, findingId, body);
  }
}
