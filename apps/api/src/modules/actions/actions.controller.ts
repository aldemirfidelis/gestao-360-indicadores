import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ActionAiSuggestionStatus, ActionEffectivenessStatus, ActionStatus } from '@prisma/client';
import { actionCreateSchema } from '@g360/shared';
import { ActionsService } from './actions.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthPayload } from '../auth/auth.types';

@Controller('actions')
export class ActionsController {
  constructor(private readonly service: ActionsService) {}

  @Get()
  @RequirePermissions('actions:view')
  list(
    @CurrentUser() me: AuthPayload,
    @Query('status') status?: ActionStatus,
    @Query('responsibleUserId') responsibleUserId?: string,
    @Query('ownerNodeId') ownerNodeId?: string,
    @Query('indicatorId') indicatorId?: string,
    @Query('strategicObjectiveId') strategicObjectiveId?: string,
    @Query('effectivenessStatus') effectivenessStatus?: ActionEffectivenessStatus,
    @Query('overdue') overdue?: string,
    @Query('origin') origin?: string,
    @Query('search') search?: string,
  ) {
    return this.service.list({
      companyId: me.companyId,
      status,
      responsibleUserId,
      ownerNodeId,
      indicatorId,
      strategicObjectiveId,
      effectivenessStatus,
      overdue: overdue === 'true',
      origin,
      search,
    });
  }

  @Get('options')
  @RequirePermissions('actions:view')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me.companyId);
  }

  @Get('general-approvals')
  @RequirePermissions('actions:view', 'actions:delete', 'actions:approve', 'actions:manage')
  generalApprovals(
    @CurrentUser() me: AuthPayload,
    @Query('scope') scope?: 'pending' | 'requested' | 'all',
  ) {
    return this.service.listGeneralApprovals(me.companyId, me.sub, scope);
  }

  @Get('evidences/:evidenceId')
  @RequirePermissions('actions:view')
  evidenceFile(@CurrentUser() me: AuthPayload, @Param('evidenceId') evidenceId: string) {
    return this.service.getEvidenceFile(evidenceId, me.companyId);
  }

  @Get(':id')
  @RequirePermissions('actions:view')
  byId(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getById(id, me.companyId);
  }

  @Post()
  @RequirePermissions('actions:create')
  create(
    @CurrentUser() me: AuthPayload,
    @Body(new ZodValidationPipe(actionCreateSchema)) input: any,
  ) {
    return this.service.create({ ...input, companyId: me.companyId }, me.sub);
  }

  @Patch(':id')
  @RequirePermissions('actions:update')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() patch: any) {
    return this.service.update(id, patch, me.sub);
  }

  @Patch(':id/status')
  @RequirePermissions('actions:update')
  changeStatus(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { status: ActionStatus; reason?: string },
  ) {
    return this.service.changeStatus(id, body.status, me.sub, body.reason);
  }

  @Post(':id/meeting')
  @RequirePermissions('meetings:create', 'actions:update')
  createMeetingForAction(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { startsAt?: string; title?: string; location?: string; format?: 'PRESENTIAL' | 'ONLINE' | 'HYBRID'; objective?: string },
  ) {
    return this.service.createMeetingForAction(id, body as any, me.sub);
  }

  @Post(':id/tasks')
  @RequirePermissions('actions:update')
  addTask(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { title: string; dueDate?: string; startDate?: string; endDate?: string; assignedToId?: string },
  ) {
    return this.service.addTask(
      id,
      {
        title: body.title,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        assignedToId: body.assignedToId || undefined,
      },
      me.sub,
    );
  }

  @Patch('tasks/:taskId')
  @RequirePermissions('actions:update')
  updateTask(
    @CurrentUser() me: AuthPayload,
    @Param('taskId') taskId: string,
    @Body() body: { title?: string; done?: boolean; completionNote?: string | null; dueDate?: string | null; startDate?: string | null; endDate?: string | null; assignedToId?: string | null },
  ) {
    const patch: any = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.done !== undefined) patch.done = body.done;
    if (body.completionNote !== undefined) patch.completionNote = body.completionNote || null;
    if (body.dueDate !== undefined) patch.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.startDate !== undefined) patch.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) patch.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.assignedToId !== undefined) patch.assignedToId = body.assignedToId || null;
    return this.service.updateTask(taskId, patch, me.sub);
  }

  @Delete('tasks/:taskId')
  @RequirePermissions('actions:update')
  deleteTask(@CurrentUser() me: AuthPayload, @Param('taskId') taskId: string) {
    return this.service.deleteTask(taskId, me.sub);
  }

  @Post(':id/delete-request')
  @RequirePermissions('actions:update', 'actions:delete')
  requestDelete(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body?: { reason?: string }) {
    return this.service.requestDeletionApproval(id, me.companyId, me.sub, body?.reason);
  }

  @Patch('general-approvals/:requestId/decision')
  @RequirePermissions('actions:delete', 'actions:approve', 'actions:manage')
  decideGeneralApproval(
    @CurrentUser() me: AuthPayload,
    @Param('requestId') requestId: string,
    @Body() body: { decision: 'APPROVED' | 'REJECTED'; decisionNote?: string },
  ) {
    return this.service.decideGeneralApproval(requestId, me.companyId, me.sub, body.decision, body.decisionNote);
  }

  @Post(':id/analysis')
  @RequirePermissions('actions:analysis')
  saveAnalysis(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.saveAnalysis(id, body, me.sub);
  }

  @Post(':id/evidences')
  @RequirePermissions('actions:update')
  addEvidence(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addEvidence(id, body, me.sub);
  }

  @Post(':id/comments')
  @RequirePermissions('actions:update')
  addComment(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addComment(id, body, me.sub, me.email);
  }

  @Post(':id/effectiveness/request')
  @RequirePermissions('actions:update')
  requestEffectivenessReview(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.requestEffectivenessReview(id, body, me.sub);
  }

  @Post(':id/effectiveness')
  @RequirePermissions('actions:effectiveness')
  validateEffectiveness(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.validateEffectiveness(id, body, me.sub);
  }

  @Post(':id/ai-assist')
  @RequirePermissions('actions:ai')
  aiAssist(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.aiAssist(id, body, me.sub);
  }

  @Patch('ai-suggestions/:id')
  @RequirePermissions('actions:ai')
  decideSuggestion(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { status: ActionAiSuggestionStatus }) {
    return this.service.decideSuggestion(id, body.status, me.sub);
  }

  @Delete(':id')
  @RequirePermissions('actions:delete')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body?: { reason?: string }) {
    return this.service.remove(id, me.sub, body?.reason);
  }
}
