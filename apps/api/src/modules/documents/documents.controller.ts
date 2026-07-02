import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, StreamableFile } from '@nestjs/common';
import { Request, Response } from 'express';
import { DocumentStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { titledCreateSchema, titledUpdateSchema } from '@g360/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  @RequirePermissions('doc:view')
  list(
    @CurrentUser() me: AuthPayload,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('orgNodeId') orgNodeId?: string,
    @Query('indicatorId') indicatorId?: string,
    @Query('ownerUserId') ownerUserId?: string,
    @Query('approverUserId') approverUserId?: string,
    @Query('expiring') expiring?: string,
  ) {
    return this.service.list(me, { status, type, search, orgNodeId, indicatorId, ownerUserId, approverUserId, expiring });
  }

  @Get('summary')
  @RequirePermissions('doc:view')
  summary(@CurrentUser() me: AuthPayload) {
    return this.service.summary(me);
  }

  @Get('dashboard')
  @RequirePermissions('doc:view')
  dashboard(@CurrentUser() me: AuthPayload) {
    return this.service.dashboard(me);
  }

  @Get('matrix')
  @RequirePermissions('doc:view')
  matrix(
    @CurrentUser() me: AuthPayload,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('orgNodeId') orgNodeId?: string,
    @Query('indicatorId') indicatorId?: string,
    @Query('expiring') expiring?: string,
  ) {
    return this.service.matrix(me, { status, type, search, orgNodeId, indicatorId, expiring });
  }

  @Get('options')
  @RequirePermissions('doc:view')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me);
  }

  @Get('types')
  @RequirePermissions('doc:view')
  types(@CurrentUser() me: AuthPayload) {
    return this.service.listTypes(me);
  }

  @Post('types')
  @RequirePermissions('doc:manage')
  createType(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createType(me, body);
  }

  @Patch('types/:id')
  @RequirePermissions('doc:manage')
  updateType(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateType(me, id, body);
  }

  @Get('templates')
  @RequirePermissions('doc:view')
  templates(@CurrentUser() me: AuthPayload) {
    return this.service.listTemplates(me);
  }

  @Post('templates')
  @RequirePermissions('doc:manage')
  createTemplate(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createTemplate(me, body);
  }

  @Get('templates/library')
  @RequirePermissions('doc:manage')
  templateLibrary(@CurrentUser() me: AuthPayload) {
    return this.service.listTemplateLibrary(me);
  }

  @Post('templates/library/install')
  @RequirePermissions('doc:manage')
  installLibraryTemplates(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.installLibraryTemplates(me, body);
  }

  @Post('templates/import')
  @RequirePermissions('doc:manage')
  importTemplate(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.importTemplate(me, body);
  }

  @Patch('templates/:templateId')
  @RequirePermissions('doc:manage')
  updateTemplate(@CurrentUser() me: AuthPayload, @Param('templateId') templateId: string, @Body() body: any) {
    return this.service.updateTemplate(me, templateId, body);
  }

  @Delete('templates/:templateId')
  @RequirePermissions('doc:manage')
  deleteTemplate(@CurrentUser() me: AuthPayload, @Param('templateId') templateId: string) {
    return this.service.deleteTemplate(me, templateId);
  }

  @Post('templates/:templateId/duplicate')
  @RequirePermissions('doc:manage')
  duplicateTemplate(@CurrentUser() me: AuthPayload, @Param('templateId') templateId: string) {
    return this.service.duplicateTemplate(me, templateId);
  }

  @Get('templates/:templateId/download')
  @RequirePermissions('doc:view')
  async downloadTemplate(
    @CurrentUser() me: AuthPayload,
    @Param('templateId') templateId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.downloadTemplate(me, templateId);
    res.setHeader('content-type', result.mimeType);
    res.setHeader('content-disposition', `attachment; filename="${result.fileName}"`);
    return new StreamableFile(result.content);
  }

  @Post('generate-code')
  @RequirePermissions('doc:create')
  generateCode(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.generateCode(me, body);
  }

  @Get('editor/status')
  @RequirePermissions('doc:view')
  editorStatus(@CurrentUser() me: AuthPayload) {
    return this.service.options(me).then((options) => options.editor);
  }

  @Post('edit-requests/:requestId/approve')
  @RequirePermissions('doc:view')
  approveEditRequest(@CurrentUser() me: AuthPayload, @Param('requestId') requestId: string, @Body() body: any) {
    return this.service.approveEditRequest(me, requestId, body);
  }

  @Post('edit-requests/:requestId/reject')
  @RequirePermissions('doc:view')
  rejectEditRequest(@CurrentUser() me: AuthPayload, @Param('requestId') requestId: string, @Body() body: any) {
    return this.service.rejectEditRequest(me, requestId, body);
  }

  @Post('edit-requests/:requestId/complete')
  @RequirePermissions('doc:view')
  completeEditRequest(@CurrentUser() me: AuthPayload, @Param('requestId') requestId: string, @Body() body: any) {
    return this.service.completeEditRequest(me, requestId, body);
  }

  @Post('jobs/expiration')
  @RequirePermissions('doc:manage')
  runExpirationJob(@CurrentUser() me: AuthPayload) {
    return this.service.runExpirationJob(me);
  }

  @Get('diagnostics')
  @RequirePermissions('doc:manage')
  diagnostics(@CurrentUser() me: AuthPayload) {
    return this.service.diagnostics(me);
  }

  @Get(':id')
  @RequirePermissions('doc:view')
  byId(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getById(me, id);
  }

  @Post()
  @RequirePermissions('doc:create')
  create(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(titledCreateSchema)) body: any) {
    return this.service.create(me, body);
  }

  @Patch(':id')
  @RequirePermissions('doc:update')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(titledUpdateSchema)) body: any) {
    return this.service.update(me, id, body);
  }

  @Delete(':id')
  @RequirePermissions('doc:delete')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.remove(me, id);
  }

  @Post(':id/editor/open')
  @RequirePermissions('doc:view')
  openEditor(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.openEditor(me, id);
  }

  @Post(':id/editor/open-word')
  @RequirePermissions('doc:view')
  openWordDesktopEditor(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.openWordDesktopEditor(me, id);
  }

  @Post(':id/edit-requests/grant')
  @RequirePermissions('doc:view')
  grantEditRequest(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.grantEditRequest(me, id, body);
  }

  @Post(':id/edit-requests')
  @RequirePermissions('doc:view')
  requestEdit(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.requestEdit(me, id, body);
  }

  @Post(':id/autosave')
  @RequirePermissions('doc:update')
  autosave(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.autosave(me, id, body);
  }

  @Post(':id/files')
  @RequirePermissions('doc:update')
  uploadFile(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.uploadFile(me, id, body);
  }

  @Get(':id/files/:fileId/download')
  @RequirePermissions('doc:view')
  async downloadFile(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.downloadFile(me, id, fileId, { ip: req.ip, userAgent: req.headers['user-agent'] });
    res.setHeader('content-type', result.mimeType);
    res.setHeader('content-disposition', `attachment; filename="${result.file.fileName}"`);
    return new StreamableFile(result.content);
  }

  @Post(':id/comments')
  @RequirePermissions('doc:view')
  addComment(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addComment(me, id, body);
  }

  @Post(':id/read-confirmations')
  @RequirePermissions('doc:view')
  confirmRead(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.confirmRead(me, id, body);
  }

  @Post(':id/new-revision')
  @RequirePermissions('doc:update')
  newRevision(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.createRevision(me, id, body);
  }

  @Post(':id/submit-review')
  @RequirePermissions('doc:update')
  submitReview(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.transition(me, id, DocumentStatus.WAITING_REVIEW, body);
  }

  @Post(':id/start-review')
  @RequirePermissions('doc:update')
  startReview(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.transition(me, id, DocumentStatus.IN_REVIEW, body);
  }

  @Post(':id/request-adjustments')
  @RequirePermissions('doc:update')
  requestAdjustments(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.transition(me, id, DocumentStatus.ADJUSTMENTS_REQUESTED, body);
  }

  @Post(':id/complete-review')
  @RequirePermissions('doc:update')
  completeReview(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.transition(me, id, DocumentStatus.REVIEWED, body);
  }

  @Post(':id/send-approval')
  @RequirePermissions('doc:update')
  sendApproval(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.transition(me, id, DocumentStatus.WAITING_APPROVAL, body);
  }

  @Post(':id/start-approval')
  @RequirePermissions('doc:update')
  startApproval(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.transition(me, id, DocumentStatus.IN_APPROVAL, body);
  }

  @Post(':id/approve')
  @RequirePermissions('doc:update')
  approve(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.transition(me, id, DocumentStatus.APPROVED, body);
  }

  @Post(':id/reject')
  @RequirePermissions('doc:update')
  reject(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.transition(me, id, DocumentStatus.REJECTED, body);
  }

  @Post(':id/publish')
  @RequirePermissions('doc:update')
  publish(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.publish(me, id, body);
  }

  @Post(':id/obsolete')
  @RequirePermissions('doc:update')
  obsolete(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.transition(me, id, DocumentStatus.OBSOLETE, body);
  }

  @Post(':id/archive')
  @RequirePermissions('doc:update')
  archive(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.transition(me, id, DocumentStatus.ARCHIVED, body);
  }
}
