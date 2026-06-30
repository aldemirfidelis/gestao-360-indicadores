import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { FormsService } from './forms.service';

@Controller('forms')
export class FormsController {
  constructor(private readonly service: FormsService) {}

  @Get()
  @RequirePermissions('forms:view')
  list(
    @CurrentUser() me: AuthPayload,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('orgNodeId') orgNodeId?: string,
    @Query('processId') processId?: string,
    @Query('indicatorId') indicatorId?: string,
  ) {
    return this.service.list(me, { status, type, search, orgNodeId, processId, indicatorId });
  }

  @Get('summary')
  @RequirePermissions('forms:view')
  summary(@CurrentUser() me: AuthPayload) {
    return this.service.summary(me);
  }

  @Get('dashboard')
  @RequirePermissions('forms:dashboard')
  dashboard(@CurrentUser() me: AuthPayload) {
    return this.service.dashboard(me);
  }

  @Get('library')
  @RequirePermissions('forms:templates')
  library(@CurrentUser() me: AuthPayload) {
    return this.service.library(me);
  }

  @Get('options')
  @RequirePermissions('forms:view')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me);
  }

  @Get('executions')
  @RequirePermissions('forms:execute')
  executions(
    @CurrentUser() me: AuthPayload,
    @Query('status') status?: string,
    @Query('templateId') templateId?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listExecutions(me, { status, templateId, assignedToId, search });
  }

  @Post('executions')
  @RequirePermissions('forms:execute')
  createExecution(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createExecution(me, body);
  }

  @Get('executions/:executionId')
  @RequirePermissions('forms:execute')
  executionById(@CurrentUser() me: AuthPayload, @Param('executionId') executionId: string) {
    return this.service.getExecution(me, executionId);
  }

  @Post('executions/:executionId/responses')
  @RequirePermissions('forms:execute')
  saveExecutionResponses(@CurrentUser() me: AuthPayload, @Param('executionId') executionId: string, @Body() body: any) {
    return this.service.saveExecutionResponses(me, executionId, body);
  }

  @Post('executions/:executionId/complete')
  @RequirePermissions('forms:execute')
  completeExecution(@CurrentUser() me: AuthPayload, @Param('executionId') executionId: string, @Body() body: any) {
    return this.service.completeExecution(me, executionId, body);
  }

  @Post('ai/suggestions')
  @RequirePermissions('forms:ai')
  createAiSuggestions(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createAiSuggestions(me, body);
  }

  @Get(':id')
  @RequirePermissions('forms:view')
  byId(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getById(me, id);
  }

  @Get(':id/builder')
  @RequirePermissions('forms:builder')
  builder(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.builder(me, id);
  }

  @Post()
  @RequirePermissions('forms:create')
  create(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.create(me, body);
  }

  @Post(':id/versions')
  @RequirePermissions('forms:versions')
  createVersion(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.createVersion(me, id, body);
  }

  @Post(':id/publish')
  @RequirePermissions('forms:publish')
  publish(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.publish(me, id, body);
  }

  @Post(':id/duplicate')
  @RequirePermissions('forms:create')
  duplicate(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.duplicate(me, id, body);
  }

  @Patch(':id')
  @RequirePermissions('forms:update')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.update(me, id, body);
  }

  @Delete(':id')
  @RequirePermissions('forms:delete')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.remove(me, id);
  }

  @Get(':id/submissions')
  @RequirePermissions('forms:view')
  submissions(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.listSubmissions(me, id);
  }

  @Post(':id/submissions')
  @RequirePermissions('forms:update')
  createSubmission(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.createSubmission(me, id, body);
  }

  // QR Code do formulário: gerar (gestão de templates) e validar/resolver (para abrir a inspeção).
  @Get('qrcode/validate/:token')
  @RequirePermissions('forms:view')
  validateQr(@CurrentUser() me: AuthPayload, @Param('token') token: string) {
    return this.service.validateFormQr(me, token);
  }

  @Post(':id/qrcode')
  @RequirePermissions('forms:templates')
  createQr(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.createTemplateQr(me, id, body);
  }

  @Patch('submissions/:submissionId')
  @RequirePermissions('forms:update')
  updateSubmission(@CurrentUser() me: AuthPayload, @Param('submissionId') submissionId: string, @Body() body: any) {
    return this.service.updateSubmission(me, submissionId, body);
  }

  @Post('submissions/:submissionId/evidence')
  @RequirePermissions('forms:evidence')
  addEvidence(@CurrentUser() me: AuthPayload, @Param('submissionId') submissionId: string, @Body() body: any) {
    return this.service.addEvidence(me, submissionId, body);
  }

  @Post('submissions/:submissionId/signatures')
  @RequirePermissions('forms:execute')
  sign(@CurrentUser() me: AuthPayload, @Param('submissionId') submissionId: string, @Body() body: any) {
    return this.service.signSubmission(me, submissionId, body);
  }

  @Post('submissions/:submissionId/approvals')
  @RequirePermissions('forms:approve')
  approve(@CurrentUser() me: AuthPayload, @Param('submissionId') submissionId: string, @Body() body: any) {
    return this.service.approveSubmission(me, submissionId, body);
  }

  @Post('submissions/:submissionId/issues')
  @RequirePermissions('forms:issues')
  createIssue(@CurrentUser() me: AuthPayload, @Param('submissionId') submissionId: string, @Body() body: any) {
    return this.service.createIssue(me, submissionId, body);
  }
}
