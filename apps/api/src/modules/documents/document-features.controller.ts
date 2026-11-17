import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { DocumentContentService } from './document-content.service';
import { DocumentDistributionService } from './document-distribution.service';
import { DocumentChangeRequestService } from './document-change-request.service';
import { DocumentGovernanceService } from './document-governance.service';
import { DocumentMaintenanceService } from './document-maintenance.service';
import { DocumentWorkflowService } from './document-workflow.service';
import { DocumentsService, MAX_UPLOAD_BYTES } from './documents.service';

/** Arquivo recebido pelo multer em memória (sem depender dos tipos do multer). */
interface UploadedBinary {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

function context(req: Request) {
  return { ip: req.ip, userAgent: String(req.headers['user-agent'] ?? '') };
}

export function contentDisposition(type: 'inline' | 'attachment', fileName: string) {
  const ascii = fileName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_') || 'arquivo';
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

const uploadInterceptor = FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

/**
 * Rotas do GED moderno. Registrado ANTES do DocumentsController para que as
 * rotas fixas (search, overview, inbox...) não sejam capturadas por `:id`.
 */
@Controller('documents')
export class DocumentFeaturesController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly content: DocumentContentService,
    private readonly workflow: DocumentWorkflowService,
    private readonly distribution: DocumentDistributionService,
    private readonly governance: DocumentGovernanceService,
    private readonly changeRequests: DocumentChangeRequestService,
    private readonly maintenance: DocumentMaintenanceService,
  ) {}

  private async requireCapability(me: AuthPayload, id: string, capability: 'canConfigure' | 'canManageAccess' | 'canEditMetadata') {
    const doc = await this.documents.loadVisible(me, id);
    const caps = await this.documents.capabilities(me, doc);
    if (!caps[capability]) throw new ForbiddenException('Você não tem permissão para esta configuração do documento.');
    return doc;
  }

  // ------------------------------------------------------------ rotas fixas

  @Get('search')
  @RequirePermissions('doc:view')
  search(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string>) {
    return this.documents.search(me, query);
  }

  @Get('overview')
  @RequirePermissions('doc:view')
  overview(@CurrentUser() me: AuthPayload) {
    return this.documents.overview(me);
  }

  @Get('inbox')
  @RequirePermissions('doc:view')
  inbox(@CurrentUser() me: AuthPayload) {
    return this.governance.inbox(me);
  }

  @Get('access-groups')
  @RequirePermissions('doc:view')
  groups(@CurrentUser() me: AuthPayload) {
    return this.governance.listGroups(me);
  }

  @Post('access-groups')
  @RequirePermissions('doc:manage')
  createGroup(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.governance.saveGroup(me, body);
  }

  @Patch('access-groups/:groupId')
  @RequirePermissions('doc:manage')
  updateGroup(@CurrentUser() me: AuthPayload, @Param('groupId') groupId: string, @Body() body: any) {
    return this.governance.saveGroup(me, body, groupId);
  }

  @Delete('access-groups/:groupId')
  @RequirePermissions('doc:manage')
  removeGroup(@CurrentUser() me: AuthPayload, @Param('groupId') groupId: string) {
    return this.governance.removeGroup(me, groupId);
  }

  @Get('retention')
  @RequirePermissions('doc:manage')
  retention(@CurrentUser() me: AuthPayload) {
    return this.governance.retention(me);
  }

  @Post('retention-rules')
  @RequirePermissions('doc:manage')
  createRetentionRule(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.governance.saveRetentionRule(me, body);
  }

  @Patch('retention-rules/:ruleId')
  @RequirePermissions('doc:manage')
  updateRetentionRule(@CurrentUser() me: AuthPayload, @Param('ruleId') ruleId: string, @Body() body: any) {
    return this.governance.saveRetentionRule(me, body, ruleId);
  }

  @Post('ai/draft-from-process')
  @RequirePermissions('doc:create')
  draftFromProcess(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.documents.aiDraft(me, body);
  }

  @Post('import/docx-html')
  @RequirePermissions('doc:create', 'doc:update')
  @UseInterceptors(uploadInterceptor)
  importDocxHtml(@UploadedFile() file: UploadedBinary | undefined) {
    if (!file) throw new BadRequestException('Envie o arquivo .docx no campo "file".');
    return this.documents.convertDocxForEditor(file.buffer);
  }

  @Post('change-requests/:requestId/decide')
  @RequirePermissions('doc:view')
  async decideChangeRequest(@CurrentUser() me: AuthPayload, @Param('requestId') requestId: string, @Body() body: any) {
    const request = await this.changeRequests.load(me.companyId, requestId);
    const doc = await this.documents.loadVisible(me, request.documentId);
    const caps = await this.documents.capabilities(me, doc);
    const decided = await this.changeRequests.decide(me, requestId, body, caps.canEditMetadata);
    if (decided.status === 'ACCEPTED' && body?.openRevision && caps.canRevise) {
      return this.documents.createRevision(me, request.documentId, { reason: `Solicitação de alteração: ${request.reason}`.slice(0, 500), summary: body?.note ?? null });
    }
    return this.documents.getById(me, request.documentId);
  }

  @Post('jobs/maintenance')
  @RequirePermissions('doc:manage')
  runMaintenance(@CurrentUser() me: AuthPayload) {
    return this.maintenance.runForCompany(me.companyId);
  }

  @Post('jobs/reindex')
  @RequirePermissions('doc:manage')
  reindex(@CurrentUser() me: AuthPayload) {
    return this.content.reindexMissing(me.companyId, 2000).then((count) => ({ reindexed: count }));
  }

  // ----------------------------------------------------- conteúdo e arquivos

  @Put(':id/content')
  @RequirePermissions('doc:view')
  saveContent(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.documents.saveContent(me, id, body);
  }

  @Post(':id/content/format')
  @RequirePermissions('doc:view')
  changeFormat(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.documents.changeFormat(me, id, body);
  }

  @Post(':id/files/upload')
  @RequirePermissions('doc:update')
  @UseInterceptors(uploadInterceptor)
  upload(@CurrentUser() me: AuthPayload, @Param('id') id: string, @UploadedFile() file: UploadedBinary | undefined, @Body() body: any) {
    if (!file) throw new BadRequestException('Envie o arquivo no campo "file".');
    return this.documents.uploadBuffer(me, id, {
      purpose: body?.purpose,
      fileName: body?.fileName || file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
      reason: body?.reason ?? null,
    });
  }

  @Get(':id/files/:fileId/view')
  @RequirePermissions('doc:view')
  async viewFile(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Param('fileId') fileId: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.documents.downloadFile(me, id, fileId, context(req), { inline: true });
    res.setHeader('content-type', result.mimeType);
    res.setHeader('content-disposition', contentDisposition('inline', result.file.fileName));
    res.setHeader('cache-control', 'private, no-store');
    return new StreamableFile(result.content);
  }

  @Get(':id/official-pdf')
  @RequirePermissions('doc:view')
  async officialPdf(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Query('inline') inline: string | undefined, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const isInline = inline === '1' || inline === 'true';
    const result = await this.documents.officialPdf(me, id, context(req), { inline: isInline });
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', contentDisposition(isInline ? 'inline' : 'attachment', result.file.fileName));
    res.setHeader('cache-control', 'private, no-store');
    return new StreamableFile(result.content);
  }

  @Get(':id/preview-pdf')
  @RequirePermissions('doc:view')
  async previewPdf(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.documents.previewPdf(me, id);
    res.setHeader('content-type', result.mimeType);
    res.setHeader('content-disposition', contentDisposition('inline', result.fileName));
    res.setHeader('cache-control', 'private, no-store');
    return new StreamableFile(result.content);
  }

  @Get(':id/export/docx')
  @RequirePermissions('doc:view')
  async exportDocx(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.documents.exportDocx(me, id, context(req));
    res.setHeader('content-type', result.mimeType);
    res.setHeader('content-disposition', contentDisposition('attachment', result.fileName));
    res.setHeader('cache-control', 'private, no-store');
    return new StreamableFile(result.buffer);
  }

  @Get(':id/reader')
  @RequirePermissions('doc:view')
  reader(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Req() req: Request) {
    return this.documents.reader(me, id, context(req));
  }

  @Get(':id/compare')
  @RequirePermissions('doc:view')
  compare(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.documents.compare(me, id, from, to);
  }

  // -------------------------------------------------------------------- fluxo

  @Get(':id/workflow')
  @RequirePermissions('doc:view')
  async workflowState(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    const doc = await this.documents.loadVisible(me, id);
    return this.workflow.state(me, doc);
  }

  @Put(':id/workflow/participants')
  @RequirePermissions('doc:view')
  participants(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.documents.setParticipants(me, id, body);
  }

  @Post(':id/workflow/submit')
  @RequirePermissions('doc:update')
  submit(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.documents.submit(me, id, body);
  }

  @Post(':id/workflow/decide')
  @RequirePermissions('doc:view')
  decide(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any, @Req() req: Request) {
    return this.documents.decide(me, id, body, context(req));
  }

  @Post(':id/workflow/delegate')
  @RequirePermissions('doc:view')
  delegate(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.documents.delegate(me, id, body);
  }

  @Post(':id/workflow/cancel')
  @RequirePermissions('doc:update')
  cancel(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.documents.cancelFlow(me, id, body);
  }

  // ------------------------------------------------------ leitura obrigatória

  @Get(':id/distribution')
  @RequirePermissions('doc:view')
  async distributionSummary(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    const doc = await this.documents.loadVisible(me, id);
    return this.distribution.summary(me.companyId, doc, me.sub);
  }

  @Put(':id/distribution')
  @RequirePermissions('doc:update')
  async setDistribution(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    const doc = await this.requireCapability(me, id, 'canConfigure');
    await this.distribution.setDistribution(me, doc, body);
    return this.distribution.summary(me.companyId, { ...doc, readRequired: Boolean(body?.readRequired), readDueDays: body?.readDueDays ?? null }, me.sub);
  }

  @Post(':id/read')
  @RequirePermissions('doc:view')
  confirmRead(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Req() req: Request) {
    return this.documents.confirmRead(me, id, {}, context(req));
  }

  // ------------------------------------------------------------- governança

  @Get(':id/access')
  @RequirePermissions('doc:view')
  async getAccess(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    const doc = await this.requireCapability(me, id, 'canManageAccess');
    return this.governance.access(me, doc);
  }

  @Put(':id/access')
  @RequirePermissions('doc:update')
  async setAccess(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    const doc = await this.requireCapability(me, id, 'canManageAccess');
    return this.governance.setAccess(me, doc, body);
  }

  @Get(':id/relations')
  @RequirePermissions('doc:view')
  async relations(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    const doc = await this.documents.loadVisible(me, id);
    return this.governance.relations(me, doc);
  }

  @Post(':id/relations')
  @RequirePermissions('doc:update')
  async addRelation(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    const doc = await this.requireCapability(me, id, 'canEditMetadata');
    return this.governance.addRelation(me, doc, body);
  }

  @Delete(':id/relations/:relationId')
  @RequirePermissions('doc:update')
  async removeRelation(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Param('relationId') relationId: string) {
    const doc = await this.requireCapability(me, id, 'canEditMetadata');
    return this.governance.removeRelation(me, doc, relationId);
  }

  @Put(':id/external')
  @RequirePermissions('doc:update')
  async saveExternal(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    const doc = await this.requireCapability(me, id, 'canEditMetadata');
    return this.governance.saveExternal(me, doc, body);
  }

  @Get(':id/impact')
  @RequirePermissions('doc:view')
  async impact(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    const doc = await this.documents.loadVisible(me, id);
    return this.governance.impact(me, doc);
  }

  @Get(':id/change-requests')
  @RequirePermissions('doc:view')
  async listChangeRequests(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    await this.documents.loadVisible(me, id);
    return this.changeRequests.list(me.companyId, id);
  }

  @Post(':id/change-requests')
  @RequirePermissions('doc:view')
  async createChangeRequest(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    const doc = await this.documents.loadVisible(me, id);
    return this.changeRequests.create(me, doc, body);
  }

  @Post(':id/dispose')
  @RequirePermissions('doc:manage')
  async dispose(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    const doc = await this.documents.loadVisible(me, id);
    return this.governance.dispose(me, doc, body);
  }

  // ---------------------------------------------------------------------- IA

  @Post(':id/ai/summary')
  @RequirePermissions('doc:view')
  aiSummary(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.documents.aiSummary(me, id, body);
  }

  @Post(':id/ai/check')
  @RequirePermissions('doc:view')
  aiCheck(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.documents.aiCheck(me, id);
  }
}
