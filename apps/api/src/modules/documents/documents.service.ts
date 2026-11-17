import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentApprovalDecision,
  DocumentConfidentiality,
  DocumentContentFormat,
  DocumentFileKind,
  DocumentStatus,
  DocumentType,
  NotificationKind,
  Prisma,
  TraceEntityType,
  TraceEventType,
} from '@prisma/client';
import {
  applyDocPlaceholders,
  docToPlainText,
  isDocNode,
  markdownToDoc,
  type DocNode,
} from '@g360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { TraceabilityService } from '../traceability/traceability.service';
import { AccessService } from '../access/access.service';
import type { AreaAction } from '../access/access.logic';
import { AuthPayload } from '../auth/auth.types';
import { DocumentCodeService } from './document-code.service';
import { DocumentEditorService, WopiTokenPayload } from './document-editor.service';
import { DocumentStorageService, sha256, type StoredDocumentFile } from './document-storage.service';
import {
  applyDocxPlaceholders,
  applyTextPlaceholders,
  buildDocx,
  buildDocxFromDoc,
  detectPlaceholders,
  docxHasMacros,
  extractDocxText,
  isDocxBuffer,
} from './docx.util';
import { buildPdf } from './pdf.util';
import { TEMPLATE_LIBRARY, findLibraryTemplate } from './template-library';
import { WorkItemEventBus } from '../my-day/work-item-event-bus';
import { listTake } from '../../common/http/list-take';
import { NotificationsService } from '../notifications/notifications.service';
import { DocumentAccessService } from './document-access.service';
import { DocumentContentService, PUBLISHED_LIKE, summarize } from './document-content.service';
import { DocumentRenderService, DOCUMENT_STATUS_LABEL, formatDateTimeBr } from './document-render.service';
import { APPROVAL_ROLE, DocumentWorkflowService, EDITABLE_STATUSES, authorOf, label } from './document-workflow.service';
import { DocumentDistributionService } from './document-distribution.service';
import { DocumentChangeRequestService } from './document-change-request.service';
import { DocumentGovernanceService } from './document-governance.service';
import { DocumentAiService } from './document-ai.service';
import { docxToHtml, docxToText } from './document-text';
import { assertDocumentUnchanged } from './document-lock';

const MODULE = 'documents';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME = 'application/pdf';
// Upload legado em base64 no JSON (limite do body: 10 MB) ~8 MB decodificados.
const MAX_BASE64_BYTES = 8 * 1024 * 1024;
// Upload por arquivo (multipart): guardado no Postgres.
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_CONTENT_JSON_BYTES = 20 * 1024 * 1024;

type Tx = Prisma.TransactionClient;

type DocFilters = {
  status?: string;
  type?: string;
  search?: string;
  orgNodeId?: string;
  indicatorId?: string;
  ownerUserId?: string;
  approverUserId?: string;
  expiring?: string;
  limit?: string;
};

type LinkInput = {
  orgNodeId?: string | null;
  indicatorId?: string | null;
  ownerUserId?: string | null;
  approverUserId?: string | null;
};

export type UploadInput = {
  purpose?: string;
  kind?: string;
  fileName: string;
  mimeType?: string | null;
  buffer: Buffer;
  reason?: string | null;
};

const DIRECT_STATUS_MESSAGE = 'Use as ações do fluxo para alterar o status do documento.';

const ACTIVE_EDIT_REQUEST_STATUSES = ['REQUESTED', 'APPROVED', 'IN_PROGRESS'];
const APPROVED_EDIT_REQUEST_STATUSES = ['APPROVED', 'IN_PROGRESS'];

const COMMENT_REQUIRED = new Set<DocumentStatus>([
  DocumentStatus.CANCELLED,
  DocumentStatus.ARCHIVED,
  DocumentStatus.OBSOLETE,
  DocumentStatus.PERIODIC_REVIEW,
]);

/** Transições manuais (as de revisão/aprovação passam pelo fluxo assinado). */
const MANUAL_TRANSITIONS: Partial<Record<DocumentStatus, DocumentStatus[]>> = {
  [DocumentStatus.DRAFT]: [DocumentStatus.CANCELLED],
  [DocumentStatus.IN_DEVELOPMENT]: [DocumentStatus.CANCELLED],
  [DocumentStatus.ADJUSTMENTS_REQUESTED]: [DocumentStatus.CANCELLED],
  [DocumentStatus.REJECTED]: [DocumentStatus.CANCELLED],
  [DocumentStatus.SCHEDULED_PUBLICATION]: [DocumentStatus.APPROVED],
  [DocumentStatus.PUBLISHED]: [DocumentStatus.PERIODIC_REVIEW, DocumentStatus.OBSOLETE],
  [DocumentStatus.NEAR_EXPIRATION]: [DocumentStatus.PERIODIC_REVIEW, DocumentStatus.OBSOLETE],
  [DocumentStatus.EXPIRED]: [DocumentStatus.PERIODIC_REVIEW, DocumentStatus.OBSOLETE, DocumentStatus.ARCHIVED],
  [DocumentStatus.PERIODIC_REVIEW]: [DocumentStatus.OBSOLETE],
  [DocumentStatus.REPLACED]: [DocumentStatus.OBSOLETE, DocumentStatus.ARCHIVED],
  [DocumentStatus.OBSOLETE]: [DocumentStatus.ARCHIVED],
};

const UPLOAD_PURPOSES = new Set(['MAIN_DOCX', 'MAIN_PDF', 'ATTACHMENT', 'EVIDENCE', 'IMAGE']);

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
    private readonly access: AccessService,
    private readonly codes: DocumentCodeService,
    private readonly editor: DocumentEditorService,
    private readonly storage: DocumentStorageService,
    private readonly workItems: WorkItemEventBus,
    private readonly notifications: NotificationsService,
    private readonly accessPolicy: DocumentAccessService,
    private readonly content: DocumentContentService,
    private readonly render: DocumentRenderService,
    private readonly workflow: DocumentWorkflowService,
    private readonly distribution: DocumentDistributionService,
    private readonly changeRequests: DocumentChangeRequestService,
    private readonly governance: DocumentGovernanceService,
    private readonly ai: DocumentAiService,
  ) {}

  private include() {
    return {
      orgNode: { select: { id: true, name: true, type: true } },
      indicator: { select: { id: true, name: true, code: true, ownerNodeId: true } },
      owner: { select: { id: true, name: true, email: true } },
      approver: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      typeConfig: { select: { id: true, name: true, sigla: true, prefix: true, category: true, alertDays: true, defaultValidityDays: true } },
    };
  }

  private areaOf(doc: any): string | null {
    return doc.orgNodeId ?? doc.orgNode?.id ?? doc.indicator?.ownerNodeId ?? null;
  }

  private async assertWriteArea(me: AuthPayload, area: string | null, action: AreaAction) {
    if (area) await this.access.assertCanWrite(me.sub, area, MODULE, action);
  }

  /** Leitura: área + classificação (interno/restrito/confidencial). */
  private async assertViewArea(me: AuthPayload, doc: any) {
    await this.accessPolicy.assertCanView(me, doc);
  }

  private enrich(doc: any) {
    const validUntil = doc.validUntil ? new Date(doc.validUntil) : null;
    const isPublishedLike = PUBLISHED_LIKE.includes(doc.status);
    const isExpired = Boolean(validUntil && validUntil < new Date() && isPublishedLike);
    const daysToExpire = validUntil ? Math.ceil((validUntil.getTime() - Date.now()) / 86_400_000) : null;
    const alertWindow = doc.typeConfig?.alertDays ?? 30;
    const needsReview = Boolean(isPublishedLike && validUntil && !isExpired && daysToExpire !== null && daysToExpire <= alertWindow);
    const rest = { ...doc };
    delete rest.searchText; // texto interno de busca não vai para a interface
    return { ...rest, isExpired, needsReview, daysToExpire, areaId: this.areaOf(doc) };
  }

  private parseStatus(value?: string): DocumentStatus | undefined {
    if (!value) return undefined;
    if (!Object.values(DocumentStatus).includes(value as DocumentStatus)) {
      throw new BadRequestException('Status de documento inválido.');
    }
    return value as DocumentStatus;
  }

  private parseType(value?: string): DocumentType | undefined {
    if (!value) return undefined;
    if (!Object.values(DocumentType).includes(value as DocumentType)) {
      throw new BadRequestException('Tipo de documento inválido.');
    }
    return value as DocumentType;
  }

  private parseFileKind(value?: string): DocumentFileKind {
    if (!value) return DocumentFileKind.ATTACHMENT;
    if (!Object.values(DocumentFileKind).includes(value as DocumentFileKind)) {
      throw new BadRequestException('Tipo de arquivo inválido.');
    }
    return value as DocumentFileKind;
  }

  private parseConfidentiality(value: unknown): DocumentConfidentiality | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (!(Object.values(DocumentConfidentiality) as string[]).includes(String(value))) throw new BadRequestException('Classificação inválida.');
    return value as DocumentConfidentiality;
  }

  private parseFormat(value: unknown): DocumentContentFormat | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (!(Object.values(DocumentContentFormat) as string[]).includes(String(value))) throw new BadRequestException('Formato de conteúdo inválido.');
    return value as DocumentContentFormat;
  }

  private requiredText(value: unknown, field: string) {
    const text = String(value ?? '').trim();
    if (!text) throw new BadRequestException(`${field} é obrigatório.`);
    return text;
  }

  private nullableText(value: unknown) {
    if (value === undefined) return undefined;
    const text = String(value ?? '').trim();
    return text ? text : null;
  }

  private id(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text ? text : null;
  }

  private ids(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))];
  }

  private optionalInt(value: unknown, min = 1): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new BadRequestException('Valor numérico inválido.');
    return Math.max(min, Math.round(n));
  }

  private optionalDate(value: unknown, field: string): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`${field} inválido.`);
    return d;
  }

  private async loadScoped(id: string, companyId: string, tx: Tx | PrismaService = this.prisma) {
    const doc = await tx.document.findFirst({
      where: { id, companyId, deletedAt: null },
      include: this.include(),
    });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    return doc;
  }

  /** Documento visível ao usuário (área + classificação). */
  async loadVisible(me: AuthPayload, id: string) {
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertViewArea(me, doc);
    return doc;
  }

  // ---------------------------------------------------------------- listagens

  async list(me: AuthPayload, filters: DocFilters = {}) {
    const status = this.parseStatus(filters.status);
    const type = this.parseType(filters.type);
    const and: Prisma.DocumentWhereInput[] = [await this.accessPolicy.visibilityWhere(me)];
    const term = filters.search?.trim();
    if (term) {
      const candidates = await this.content.ftsCandidates(me.companyId, term, 1000);
      and.push({ id: { in: candidates.map((candidate) => candidate.id) } });
    }
    if (filters.expiring === 'expired') {
      and.push({ validUntil: { lt: new Date() }, status: { in: PUBLISHED_LIKE } });
    }
    if (filters.expiring === 'soon') {
      const limit = new Date(Date.now() + 90 * 86_400_000);
      and.push({ validUntil: { gte: new Date(), lte: limit }, status: { in: PUBLISHED_LIKE } });
    }
    const items = await this.prisma.document.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
        ...(filters.orgNodeId ? { orgNodeId: filters.orgNodeId } : {}),
        ...(filters.indicatorId ? { indicatorId: filters.indicatorId } : {}),
        ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
        ...(filters.approverUserId ? { approverUserId: filters.approverUserId } : {}),
        AND: and,
      },
      include: this.include(),
      orderBy: [{ status: 'asc' }, { validUntil: 'asc' }, { number: 'desc' }],
      take: listTake(filters.limit),
    });
    return items.map((doc) => this.enrich({ ...doc, content: undefined, contentJson: undefined, bodyText: undefined }));
  }

  search(me: AuthPayload, query: Record<string, string | undefined>) {
    return this.content.search(me, query);
  }

  overview(me: AuthPayload) {
    return this.content.overview(me);
  }

  /** Formato legado do resumo, agora calculado no banco (sem teto de lista). */
  async summary(me: AuthPayload) {
    const data = await this.content.overview(me);
    return {
      total: data.total,
      published: data.published,
      draft: data.development + data.review,
      waitingApproval: data.approval,
      obsolete: data.obsolete,
      expired: data.expired,
      needsReview: data.needsReview,
      byStatus: data.byStatus,
      byType: data.byType,
      expiringSoon: data.expiringSoon,
    };
  }

  async dashboard(me: AuthPayload) {
    const [overview, recent] = await Promise.all([
      this.content.overview(me),
      this.content.search(me, { sort: 'recent', pageSize: '10' }),
    ]);
    return { summary: overview, recent: recent.items };
  }

  async matrix(me: AuthPayload, filters: DocFilters = {}) {
    const docs = (await this.list(me, filters)) as any[];
    return docs.map((doc) => ({
      id: doc.id,
      code: doc.code ?? `#${doc.number}`,
      title: doc.title,
      type: doc.type,
      typeConfig: doc.typeConfig,
      status: doc.status,
      confidentiality: doc.confidentiality,
      orgNode: doc.orgNode,
      indicator: doc.indicator,
      owner: doc.owner,
      approver: doc.approver,
      version: doc.version,
      validFrom: doc.validFrom,
      validUntil: doc.validUntil,
      publishedAt: doc.publishedAt,
      daysToExpire: doc.daysToExpire,
      isExpired: doc.isExpired,
      needsReview: doc.needsReview,
    }));
  }

  // ------------------------------------------------------------------ detalhe

  /** O que o usuário pode fazer neste documento (a interface só mostra o permitido). */
  async capabilities(me: AuthPayload, doc: any) {
    const [manager, canUpdate, canPublishPerm, canDelete, canDownloadDocx, areaWrite] = await Promise.all([
      this.accessPolicy.isManager(me),
      this.accessPolicy.has(me, 'doc:update'),
      this.accessPolicy.has(me, 'doc:publish'),
      this.accessPolicy.has(me, 'doc:delete'),
      this.accessPolicy.has(me, 'doc:download_docx'),
      this.accessPolicy.canWriteArea(me, doc),
    ]);
    const author = authorOf(doc);
    const isAuthor = author === me.sub || doc.createdById === me.sub;
    const editable = EDITABLE_STATUSES.has(doc.status);
    const writer = canUpdate && areaWrite;
    const directEdit = writer && (manager || isAuthor || !doc.ownerUserId);
    const finalApprover = await this.isFinalApprover(me, doc);
    return {
      isAuthor,
      isManager: manager,
      canEditMetadata: writer,
      canEditContent: editable && directEdit,
      canConfigure: writer && (manager || isAuthor),
      canSubmit: editable && writer,
      canPublish: [DocumentStatus.APPROVED, DocumentStatus.SCHEDULED_PUBLICATION].includes(doc.status) && (canPublishPerm || finalApprover),
      canRevise: PUBLISHED_LIKE.includes(doc.status) && writer,
      canDelete: canDelete && areaWrite,
      canDownloadDocx: canDownloadDocx || writer || isAuthor,
      canManageAccess: manager || (writer && isAuthor),
      canObsolete: writer && (manager || isAuthor),
    };
  }

  private async isFinalApprover(me: AuthPayload, doc: any) {
    const version = await this.prisma.documentVersion.findFirst({ where: { documentId: doc.id, deletedAt: null }, orderBy: { revisionNumber: 'desc' }, select: { id: true } });
    if (!version) return false;
    const step = await this.prisma.documentWorkflowStep.findFirst({ where: { documentId: doc.id, versionId: version.id, role: APPROVAL_ROLE, userId: me.sub, decision: 'APPROVED' } });
    return Boolean(step);
  }

  async getById(me: AuthPayload, id: string) {
    const doc = await this.loadVisible(me, id);
    const [versions, files, statusHistory, approvals, reviewRequests, editRequests, comments, auditLogs, externalMetadata, tagRelations, processLinks, changeRequests] =
      await Promise.all([
        this.prisma.documentVersion.findMany({
          where: { documentId: id, companyId: me.companyId, deletedAt: null },
          orderBy: { revisionNumber: 'desc' },
          select: {
            id: true, revisionNumber: true, versionLabel: true, status: true, changeReason: true, changeSummary: true, docxFileId: true, pdfFileId: true,
            contentHash: true, pdfSource: true, publicationDate: true, expirationDate: true, createdById: true, publishedById: true, createdAt: true, updatedAt: true,
          },
        }),
        this.prisma.documentFile.findMany({ where: { documentId: id, companyId: me.companyId, deletedAt: null }, orderBy: { createdAt: 'desc' }, select: { id: true, kind: true, versionId: true, fileName: true, mimeType: true, sizeBytes: true, hashSha256: true, protected: true, createdAt: true, storageProvider: true } }),
        this.prisma.documentStatusHistory.findMany({ where: { documentId: id, companyId: me.companyId }, orderBy: { createdAt: 'desc' }, take: 100 }),
        this.prisma.documentApproval.findMany({ where: { documentId: id, companyId: me.companyId }, orderBy: [{ createdAt: 'desc' }], take: 200 }),
        this.prisma.documentReviewRequest.findMany({ where: { documentId: id, companyId: me.companyId }, orderBy: { createdAt: 'desc' } }),
        this.prisma.documentEditRequest.findMany({
          where: { documentId: id, companyId: me.companyId },
          include: {
            requester: { select: { id: true, name: true, email: true } },
            operator: { select: { id: true, name: true, email: true } },
            decidedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        this.prisma.documentComment.findMany({ where: { documentId: id, companyId: me.companyId }, orderBy: { createdAt: 'desc' }, take: 200 }),
        this.prisma.documentAuditLog.findMany({ where: { documentId: id, companyId: me.companyId }, orderBy: { createdAt: 'desc' }, take: 150 }),
        this.prisma.documentExternalMetadata.findUnique({ where: { documentId: id } }),
        this.prisma.documentTagRelation.findMany({ where: { documentId: id, companyId: me.companyId }, include: { tag: true } }),
        this.prisma.processIntegration.findMany({
          where: { documentId: id, process: { companyId: me.companyId, deletedAt: null } },
          include: { process: { select: { id: true, code: true, name: true } }, activity: { select: { id: true, name: true } } },
        }),
        this.changeRequests.list(me.companyId, id),
      ]);
    const userIds = [
      ...new Set([
        ...comments.map((item) => item.userId),
        ...approvals.map((item) => item.approverUserId),
        ...auditLogs.map((item) => item.userId),
        ...statusHistory.map((item) => item.userId),
      ].filter(Boolean)),
    ] as string[];
    const users = userIds.length ? await this.prisma.user.findMany({ where: { id: { in: userIds }, companyId: me.companyId }, select: { id: true, name: true, email: true } }) : [];
    const byId = new Map(users.map((user) => [user.id, user]));
    const [workflow, distribution, capabilities] = await Promise.all([
      this.workflow.state(me, doc),
      this.distribution.summary(me.companyId, doc, me.sub),
      this.capabilities(me, doc),
    ]);
    return {
      ...this.enrich(doc),
      editor: this.editor.openPayload(id, files.find((file) => file.kind === DocumentFileKind.DOCX)?.id ?? null),
      converterAvailable: Boolean(this.render.converterUrl()),
      versions,
      files,
      statusHistory: statusHistory.map((item) => ({ ...item, user: item.userId ? byId.get(item.userId) ?? null : null })),
      approvals: approvals.map((item) => ({ ...item, user: item.approverUserId ? byId.get(item.approverUserId) ?? null : null, signatureHash: item.signatureHash ? item.signatureHash.slice(0, 12).toUpperCase() : null })),
      reviewRequests,
      editRequests,
      comments: comments.map((item) => ({ ...item, user: item.userId ? byId.get(item.userId) ?? null : null })),
      auditLogs: auditLogs.map((item) => ({ id: item.id, action: item.action, reason: item.reason, result: item.result, createdAt: item.createdAt, user: item.userId ? byId.get(item.userId) ?? null : null })),
      externalMetadata,
      tags: tagRelations.map((relation) => relation.tag),
      processLinks: processLinks.map((link) => ({ id: link.id, process: link.process, activity: link.activity, label: link.label })),
      changeRequests,
      workflow,
      distribution,
      capabilities,
    };
  }

  async options(me: AuthPayload) {
    await this.codes.ensureDefaultTypes(me.companyId, me.sub);
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const areaWhere = permitted ? { id: { in: permitted } } : {};
    const indicatorWhere = permitted ? { ownerNodeId: { in: permitted } } : {};
    const [orgNodes, allOrgNodes, indicators, users, typeConfigs, templates, groups, processes] = await Promise.all([
      this.prisma.orgNode.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true, ...areaWhere },
        select: { id: true, name: true, type: true },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.orgNode.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true }, select: { id: true, name: true, type: true }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
      this.prisma.indicator.findMany({
        where: { companyId: me.companyId, deletedAt: null, ...indicatorWhere },
        select: { id: true, name: true, code: true, ownerNodeId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true },
        select: { id: true, name: true, email: true, defaultNodeId: true },
        orderBy: { name: 'asc' },
      }),
      this.codes.listTypes(me),
      this.prisma.documentTemplate.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        select: { id: true, name: true, description: true, typeConfigId: true, version: true, isDefault: true, active: true, fileName: true, content: true, placeholders: true, updatedAt: true },
      }),
      this.prisma.documentAccessGroup.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.process.findMany({ where: { companyId: me.companyId, deletedAt: null }, select: { id: true, code: true, name: true, status: true }, orderBy: { name: 'asc' }, take: 500 }),
    ]);
    return {
      orgNodes,
      allOrgNodes,
      indicators,
      users,
      typeConfigs,
      templates,
      groups,
      processes,
      placeholders: defaultPlaceholders(),
      editor: this.editor.status(),
      converterAvailable: Boolean(this.render.converterUrl()),
      storage: this.storage.provider,
      statuses: Object.values(DocumentStatus),
      types: Object.values(DocumentType),
      confidentialities: Object.values(DocumentConfidentiality),
      contentFormats: Object.values(DocumentContentFormat),
      permissions: {
        manage: await this.accessPolicy.isManager(me),
        publish: await this.accessPolicy.has(me, 'doc:publish'),
        create: await this.accessPolicy.has(me, 'doc:create'),
      },
    };
  }

  // --------------------------------------------------------- tipos e modelos

  async listTypes(me: AuthPayload) {
    return this.codes.listTypes(me);
  }

  async createType(me: AuthPayload, body: any) {
    return this.codes.createType(me, body);
  }

  async updateType(me: AuthPayload, id: string, body: any) {
    return this.codes.updateType(me, id, body);
  }

  async listTemplates(me: AuthPayload) {
    return this.prisma.documentTemplate.findMany({
      where: { companyId: me.companyId, deletedAt: null },
      orderBy: [{ active: 'desc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  private async loadTemplate(me: AuthPayload, id: string) {
    const template = await this.prisma.documentTemplate.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!template) throw new NotFoundException('Modelo não encontrado.');
    return template;
  }

  private async validateTemplateType(companyId: string, typeConfigId: string | null) {
    if (!typeConfigId) return null;
    const exists = await this.prisma.documentTypeConfig.findFirst({ where: { id: typeConfigId, companyId, deletedAt: null } });
    if (!exists) throw new NotFoundException('Tipo de documento não encontrado.');
    return typeConfigId;
  }

  /** Garante um único modelo padrão por tipo (ou global) e sincroniza o tipo documental. */
  private async applyDefaultTemplateTx(tx: Tx, companyId: string, templateId: string, typeConfigId: string | null) {
    await tx.documentTemplate.updateMany({
      where: { companyId, typeConfigId, deletedAt: null, isDefault: true, id: { not: templateId } },
      data: { isDefault: false },
    });
    if (typeConfigId) {
      await tx.documentTypeConfig.update({ where: { id: typeConfigId }, data: { defaultTemplateId: templateId } });
    }
  }

  async createTemplate(me: AuthPayload, body: any) {
    const name = this.requiredText(body?.name, 'Nome do modelo');
    const content = this.nullableText(body?.content) ?? defaultTemplateContent();
    const typeConfigId = await this.validateTemplateType(me.companyId, this.id(body?.typeConfigId));
    const stored = await this.storage.putBinary(me.companyId, 'templates', `${name}.docx`, buildDocx(content), DOCX_MIME);
    const isDefault = Boolean(body?.isDefault);
    const placeholders = detectPlaceholders(content);
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.documentTemplate.create({
        data: {
          companyId: me.companyId,
          typeConfigId,
          name,
          description: this.nullableText(body?.description),
          content,
          isDefault,
          active: body?.active ?? true,
          placeholders: placeholders.length ? placeholders : defaultPlaceholders(),
          createdById: me.sub,
          ...templateStorage(stored),
        },
      });
      if (isDefault) await this.applyDefaultTemplateTx(tx, me.companyId, template.id, template.typeConfigId);
      return template;
    });
  }

  async updateTemplate(me: AuthPayload, id: string, patch: any) {
    const before = await this.loadTemplate(me, id);
    const data: any = {};
    if ('name' in (patch ?? {})) data.name = this.requiredText(patch.name, 'Nome do modelo');
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('typeConfigId' in (patch ?? {})) data.typeConfigId = await this.validateTemplateType(me.companyId, this.id(patch.typeConfigId));
    if ('active' in (patch ?? {})) data.active = Boolean(patch.active);
    if ('content' in (patch ?? {})) {
      const content = this.nullableText(patch.content);
      if (content && content !== before.content) {
        // Regera o .docx a partir do texto. Para modelos importados isso
        // substitui o arquivo original (a UI avisa antes de editar).
        const stored = await this.storage.putBinary(me.companyId, 'templates', `${data.name ?? before.name}.docx`, buildDocx(content), DOCX_MIME);
        Object.assign(data, templateStorage(stored), { content, placeholders: detectPlaceholders(content), version: before.version + 1 });
      }
    }
    const isDefault = 'isDefault' in (patch ?? {}) ? Boolean(patch.isDefault) : undefined;
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.documentTemplate.update({
        where: { id },
        data: { ...data, ...(isDefault !== undefined ? { isDefault } : {}) },
      });
      if (isDefault) await this.applyDefaultTemplateTx(tx, me.companyId, id, template.typeConfigId);
      if (isDefault === false) {
        await tx.documentTypeConfig.updateMany({ where: { companyId: me.companyId, defaultTemplateId: id }, data: { defaultTemplateId: null } });
      }
      return template;
    });
  }

  async deleteTemplate(me: AuthPayload, id: string) {
    await this.loadTemplate(me, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.documentTypeConfig.updateMany({ where: { companyId: me.companyId, defaultTemplateId: id }, data: { defaultTemplateId: null } });
      return tx.documentTemplate.update({ where: { id }, data: { deletedAt: new Date(), isDefault: false, active: false } });
    });
  }

  async duplicateTemplate(me: AuthPayload, id: string) {
    const source = await this.loadTemplate(me, id);
    const name = `${source.name} (cópia)`;
    let stored = null as Awaited<ReturnType<DocumentStorageService['putBinary']>> | null;
    if (source.storageKey) {
      try {
        const buffer = await this.storage.readBinary(source.storageKey);
        stored = await this.storage.putBinary(me.companyId, 'templates', source.fileName ?? `${name}.docx`, buffer, source.mimeType ?? DOCX_MIME);
      } catch {
        stored = null; // arquivo fonte ausente: regenera a partir do texto abaixo
      }
    }
    if (!stored) {
      stored = await this.storage.putBinary(me.companyId, 'templates', `${name}.docx`, buildDocx(source.content ?? defaultTemplateContent()), DOCX_MIME);
    }
    return this.prisma.documentTemplate.create({
      data: {
        companyId: me.companyId,
        typeConfigId: source.typeConfigId,
        name,
        description: source.description,
        content: source.content,
        isDefault: false,
        active: true,
        placeholders: source.placeholders ?? defaultPlaceholders(),
        createdById: me.sub,
        ...templateStorage(stored),
      },
    });
  }

  /** Importa um .docx real enviado pela empresa como modelo. */
  async importTemplate(me: AuthPayload, body: any) {
    const name = this.requiredText(body?.name, 'Nome do modelo');
    const fileName = this.nullableText(body?.fileName) ?? `${name}.docx`;
    const buffer = decodeBase64(this.requiredText(body?.contentBase64, 'Arquivo do modelo'));
    if (!buffer.length) throw new BadRequestException('Arquivo vazio.');
    if (buffer.length > MAX_BASE64_BYTES) throw new BadRequestException('Arquivo excede o limite de 8 MB.');
    if (!isDocxBuffer(buffer)) throw new BadRequestException('Arquivo inválido: envie um .docx (Word/LibreOffice) válido.');
    if (docxHasMacros(buffer)) throw new BadRequestException('Arquivos com macros não são aceitos. Salve como .docx comum e envie de novo.');
    const typeConfigId = await this.validateTemplateType(me.companyId, this.id(body?.typeConfigId));
    const extracted = extractDocxText(buffer);
    const placeholders = detectPlaceholders(extracted);
    const stored = await this.storage.putBinary(me.companyId, 'templates', fileName, buffer, DOCX_MIME);
    const isDefault = Boolean(body?.isDefault);
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.documentTemplate.create({
        data: {
          companyId: me.companyId,
          typeConfigId,
          name,
          description: this.nullableText(body?.description),
          content: extracted,
          isDefault,
          active: true,
          placeholders: placeholders.length ? placeholders : defaultPlaceholders(),
          createdById: me.sub,
          ...templateStorage(stored),
        },
      });
      if (isDefault) await this.applyDefaultTemplateTx(tx, me.companyId, template.id, typeConfigId);
      return template;
    });
  }

  /** Baixa o modelo como .docx real (binario importado ou gerado do texto). */
  async downloadTemplate(me: AuthPayload, id: string) {
    const template = await this.loadTemplate(me, id);
    let buffer: Buffer | null = null;
    if (template.storageKey) {
      try {
        const raw = await this.storage.readBinary(template.storageKey);
        if (isDocxBuffer(raw)) buffer = raw;
      } catch {
        buffer = null; // storage indisponivel/legado: gera do texto abaixo
      }
    }
    if (!buffer) buffer = buildDocx(template.content ?? defaultTemplateContent());
    const fileName = template.fileName?.toLowerCase().endsWith('.docx') ? template.fileName : `${template.name}.docx`;
    return { fileName, mimeType: DOCX_MIME, content: buffer };
  }

  /** Galeria de modelos prontos, com marcacao dos ja instalados na empresa. */
  async listTemplateLibrary(me: AuthPayload) {
    const existing = await this.prisma.documentTemplate.findMany({
      where: { companyId: me.companyId, deletedAt: null },
      select: { name: true },
    });
    const names = new Set(existing.map((template) => template.name.toLowerCase()));
    return TEMPLATE_LIBRARY.map((entry) => ({
      key: entry.key,
      name: entry.name,
      description: entry.description,
      category: entry.category,
      sigla: entry.sigla,
      preview: entry.content,
      installed: names.has(entry.name.toLowerCase()),
    }));
  }

  /** Instala modelos da galeria como templates proprios (editaveis) da empresa. */
  async installLibraryTemplates(me: AuthPayload, body: any) {
    const keys: string[] = Array.isArray(body?.keys) ? body.keys.map(String) : [];
    if (!keys.length) throw new BadRequestException('Selecione ao menos um modelo da galeria.');
    await this.codes.ensureDefaultTypes(me.companyId, me.sub);
    const types = await this.prisma.documentTypeConfig.findMany({ where: { companyId: me.companyId, deletedAt: null } });
    const existing = await this.prisma.documentTemplate.findMany({
      where: { companyId: me.companyId, deletedAt: null },
      select: { name: true },
    });
    const names = new Set(existing.map((template) => template.name.toLowerCase()));
    const installed: any[] = [];
    const skipped: string[] = [];
    for (const key of keys) {
      const entry = findLibraryTemplate(key);
      if (!entry || names.has(entry.name.toLowerCase())) {
        skipped.push(entry?.name ?? key);
        continue;
      }
      const typeConfig = types.find((type) => type.sigla === entry.sigla) ?? types.find((type) => type.category === entry.category) ?? null;
      const stored = await this.storage.putBinary(me.companyId, 'templates', `${entry.name}.docx`, buildDocx(entry.content), DOCX_MIME);
      const template = await this.prisma.documentTemplate.create({
        data: {
          companyId: me.companyId,
          typeConfigId: typeConfig?.id ?? null,
          name: entry.name,
          description: entry.description,
          content: entry.content,
          isDefault: false,
          active: true,
          placeholders: detectPlaceholders(entry.content),
          createdById: me.sub,
          ...templateStorage(stored),
        },
      });
      names.add(entry.name.toLowerCase());
      installed.push(template);
    }
    return { installed, skipped, total: keys.length };
  }

  /** Resolve os valores dos placeholders {{...}} para um documento em criação. */
  private async buildPlaceholderValuesTx(
    tx: Tx,
    me: AuthPayload,
    doc: {
      code: string | null;
      title: string;
      typeName: string;
      orgNodeId: string | null;
      ownerUserId: string | null;
      approverUserId: string | null;
      validUntil: Date | null;
    },
  ): Promise<Record<string, string>> {
    const [company, orgNode, owner, approver] = await Promise.all([
      tx.company.findUnique({ where: { id: me.companyId }, select: { name: true } }),
      doc.orgNodeId ? tx.orgNode.findFirst({ where: { id: doc.orgNodeId }, select: { name: true, type: true } }) : Promise.resolve(null),
      doc.ownerUserId ? tx.user.findFirst({ where: { id: doc.ownerUserId }, select: { name: true } }) : Promise.resolve(null),
      doc.approverUserId ? tx.user.findFirst({ where: { id: doc.approverUserId }, select: { name: true } }) : Promise.resolve(null),
    ]);
    const formatDate = (value: Date | null) => (value ? value.toLocaleDateString('pt-BR') : '____/____/______');
    const today = formatDate(new Date());
    const authorName = me.name ?? '';
    return {
      document_code: doc.code ?? '',
      document_title: doc.title,
      document_type: doc.typeName,
      revision: 'Rev. 00',
      company_name: company?.name ?? '',
      company_logo: company?.name ?? '',
      unit_name: orgNode?.type === 'UNIT' ? orgNode.name : '',
      area_name: orgNode?.name ?? '',
      process_name: orgNode?.type === 'PROCESS' ? orgNode.name : '',
      author_name: authorName,
      responsible_name: owner?.name ?? authorName,
      approver_name: approver?.name ?? '',
      publication_date: today,
      expiration_date: formatDate(doc.validUntil),
      page_number: '',
      total_pages: '',
      qr_code: doc.code ?? '',
      revision_history: `| Revisão | Data | Descrição | Responsável |\n|---|---|---|---|\n| Rev. 00 | ${today} | Emissão inicial | ${authorName} |`,
    };
  }

  async generateCode(me: AuthPayload, body: any) {
    const type = this.parseType(body?.type) ?? DocumentType.PROCEDURE;
    const typeConfigId = this.id(body?.typeConfigId);
    return this.prisma.$transaction(async (tx) => this.codes.nextCode(tx, me.companyId, typeConfigId, type));
  }

  // ----------------------------------------------------------------- criação

  /** Pessoas, áreas e grupos informados existem nesta empresa. */
  private async validateAudience(companyId: string, input: { userIds?: string[]; orgNodeIds?: string[]; groupIds?: string[] }) {
    const userIds = input.userIds ?? [];
    const orgNodeIds = input.orgNodeIds ?? [];
    const groupIds = input.groupIds ?? [];
    const [users, nodes, groups] = await Promise.all([
      userIds.length ? this.prisma.user.count({ where: { id: { in: userIds }, companyId, deletedAt: null, active: true } }) : 0,
      orgNodeIds.length ? this.prisma.orgNode.count({ where: { id: { in: orgNodeIds }, companyId, deletedAt: null } }) : 0,
      groupIds.length ? this.prisma.documentAccessGroup.count({ where: { id: { in: groupIds }, companyId, deletedAt: null } }) : 0,
    ]);
    if (users !== userIds.length || nodes !== orgNodeIds.length || groups !== groupIds.length) {
      throw new BadRequestException('Há pessoas, áreas ou grupos inativos ou de outra empresa.');
    }
  }

  async create(me: AuthPayload, body: any) {
    const title = this.requiredText(body?.title, 'Título');
    const type = this.parseType(body?.type) ?? DocumentType.PROCEDURE;
    if (body?.status && this.parseStatus(body.status) !== DocumentStatus.DRAFT) {
      throw new BadRequestException(DIRECT_STATUS_MESSAGE);
    }
    const confidentiality = this.parseConfidentiality(body?.confidentiality) ?? DocumentConfidentiality.INTERNAL;
    const format = this.parseFormat(body?.contentFormat) ?? DocumentContentFormat.STRUCTURED;
    const links = await this.validateLinks(me.companyId, {
      orgNodeId: this.id(body?.orgNodeId),
      indicatorId: this.id(body?.indicatorId),
      ownerUserId: this.id(body?.ownerUserId),
      approverUserId: null,
    });
    await this.assertWriteArea(me, links.area, 'create');

    // Participantes e público validados antes de criar (nada fica pela metade).
    const reviewerIds = this.ids(body?.reviewerIds);
    const approverIds = this.ids(body?.approverIds ?? (body?.approverUserId ? [body.approverUserId] : []));
    const author = links.ids.ownerUserId ?? me.sub;
    if ([...reviewerIds, ...approverIds].includes(author)) {
      throw new BadRequestException('Quem elabora o documento não pode revisá-lo nem aprová-lo. Escolha outras pessoas.');
    }
    if (reviewerIds.some((userId) => approverIds.includes(userId))) {
      throw new BadRequestException('A mesma pessoa não pode ser revisora e aprovadora da mesma revisão.');
    }
    const distribution = body?.distribution ?? null;
    const accessList = body?.access ?? null;
    await this.validateAudience(me.companyId, {
      userIds: [...reviewerIds, ...approverIds, ...this.ids(distribution?.userIds), ...this.ids(accessList?.userIds)],
      orgNodeIds: [...this.ids(distribution?.orgNodeIds), ...this.ids(accessList?.orgNodeIds)],
      groupIds: [...this.ids(distribution?.groupIds), ...this.ids(accessList?.groupIds)],
    });
    await this.codes.ensureDefaultTypes(me.companyId, me.sub);

    const created = await this.prisma.$transaction(async (tx) => {
      const typeConfigId = this.id(body?.typeConfigId);
      const manualCode = this.nullableText(body?.code);
      const codeResult = manualCode
        ? { code: manualCode, typeConfig: await this.codes.resolveType(me.companyId, typeConfigId, type, tx) }
        : await this.codes.nextCode(tx, me.companyId, typeConfigId, type);
      if (manualCode) {
        const duplicate = await tx.document.findFirst({ where: { companyId: me.companyId, code: manualCode, deletedAt: null }, select: { id: true } });
        if (duplicate) throw new ConflictException('Já existe documento com este código nesta empresa.');
      }
      const validFrom = this.optionalDate(body?.validFrom, 'Início de vigência') ?? null;
      const validUntil =
        this.optionalDate(body?.validUntil, 'Validade') ??
        (codeResult.typeConfig.defaultValidityDays ? addDays(validFrom ?? new Date(), codeResult.typeConfig.defaultValidityDays) : null);

      // Modelo: explicito (templateId) ou o padrao do tipo documental.
      const explicitContent = this.nullableText(body?.content);
      const explicitJson = isDocNode(body?.contentJson) ? (body.contentJson as DocNode) : null;
      const templateId = this.id(body?.templateId);
      let template: any = null;
      if (templateId) {
        template = await tx.documentTemplate.findFirst({ where: { id: templateId, companyId: me.companyId, deletedAt: null, active: true } });
        if (!template) throw new NotFoundException('Modelo não encontrado.');
      } else if (!explicitContent && !explicitJson) {
        template = await tx.documentTemplate.findFirst({
          where: codeResult.typeConfig.defaultTemplateId
            ? { id: codeResult.typeConfig.defaultTemplateId, companyId: me.companyId, deletedAt: null, active: true }
            : { companyId: me.companyId, typeConfigId: codeResult.typeConfig.id, isDefault: true, deletedAt: null, active: true },
        });
      }

      let content = explicitContent ?? generatedDocumentBody(title, codeResult.code, 'Rev. 00');
      let contentJson: DocNode | null = explicitJson;
      let templateDocx: Buffer | null = null;
      let values: Record<string, string> = {};
      if (template) {
        values = await this.buildPlaceholderValuesTx(tx, me, {
          code: codeResult.code,
          title,
          typeName: codeResult.typeConfig.name ?? codeResult.typeConfig.category,
          orgNodeId: links.ids.orgNodeId,
          ownerUserId: links.ids.ownerUserId,
          approverUserId: approverIds[0] ?? null,
          validUntil,
        });
        if (!explicitContent && template.content) content = applyTextPlaceholders(template.content, values);
        if (format === DocumentContentFormat.DOCX && template.storageKey) {
          try {
            const raw = await this.storage.readBinary(template.storageKey);
            if (isDocxBuffer(raw)) templateDocx = applyDocxPlaceholders(raw, values);
          } catch {
            templateDocx = null; // arquivo do modelo indisponivel: cai no texto
          }
        }
      }
      if (format === DocumentContentFormat.STRUCTURED && !contentJson) {
        contentJson = template?.content ? applyDocPlaceholders(markdownToDoc(template.content), values) : markdownToDoc(explicitContent ?? '');
      }

      const last = await tx.document.findFirst({
        where: { companyId: me.companyId },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      const doc = await tx.document.create({
        data: {
          companyId: me.companyId,
          number: (last?.number ?? 0) + 1,
          code: codeResult.code,
          title,
          description: this.nullableText(body?.description) ?? null,
          type: codeResult.typeConfig.category,
          typeConfigId: codeResult.typeConfig.id,
          status: DocumentStatus.DRAFT,
          version: 1,
          content: format === DocumentContentFormat.STRUCTURED ? null : content,
          contentFormat: format,
          contentJson: contentJson ? (contentJson as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
          confidentiality,
          externalUrl: this.nullableText(body?.externalUrl) ?? null,
          changeNote: this.nullableText(body?.changeNote) ?? 'Criação inicial',
          validFrom,
          validUntil,
          reviewIntervalMonths: this.optionalInt(body?.reviewIntervalMonths) ?? null,
          approvedAt: null,
          publishedAt: null,
          createdById: me.sub,
          ...links.ids,
          approverUserId: approverIds[0] ?? null,
        },
        include: this.include(),
      });
      const version = await tx.documentVersion.create({
        data: {
          companyId: me.companyId,
          documentId: doc.id,
          revisionNumber: 0,
          versionLabel: 'Rev. 00',
          status: DocumentStatus.DRAFT,
          changeReason: 'Criação inicial',
          changeSummary: doc.changeNote,
          expirationDate: validUntil,
          createdById: me.sub,
        },
      });
      // Word: semente do DOCX editavel (binario real do modelo ou texto que
      // o WOPI converte on-the-fly). Editor visual e PDF anexado não precisam.
      if (format === DocumentContentFormat.DOCX || format === DocumentContentFormat.TEXT) {
        let stored: StoredDocumentFile;
        let fileContentText: string | null;
        if (templateDocx) {
          stored = await this.storage.putBinary(me.companyId, `documents/${doc.id}/rev-00`, `${doc.code ?? doc.number}-rev-00.docx`, templateDocx, DOCX_MIME);
          fileContentText = null;
        } else {
          const text = template ? content : renderDocxText(doc, version.versionLabel);
          stored = await this.storage.putText(me.companyId, `documents/${doc.id}/rev-00`, `${doc.code ?? doc.number}-rev-00.docx`, text, DOCX_MIME);
          fileContentText = text;
        }
        const file = await tx.documentFile.create({
          data: {
            companyId: me.companyId,
            documentId: doc.id,
            versionId: version.id,
            kind: DocumentFileKind.DOCX,
            protected: false,
            createdById: me.sub,
            contentText: fileContentText,
            ...stored,
          },
        });
        await tx.documentVersion.update({ where: { id: version.id }, data: { docxFileId: file.id } });
      }
      await this.recordStatusTx(tx, me, doc.id, null, DocumentStatus.DRAFT, 'Documento criado', { versionId: version.id });
      await this.auditTx(
        tx,
        me,
        doc.id,
        'CREATE',
        null,
        { code: doc.code, title: doc.title, type: doc.type, templateId: template?.id ?? null, format, confidentiality },
        'Criação do documento',
      );
      return doc;
    });

    if (reviewerIds.length || approverIds.length) {
      await this.workflow.setParticipants(me, created, { reviewerIds, approverIds, mode: body?.workflowMode, reviewDays: body?.reviewDays, approvalDays: body?.approvalDays });
    }
    if (distribution) await this.distribution.setDistribution(me, created, distribution);
    if (accessList && confidentiality !== DocumentConfidentiality.INTERNAL) await this.governance.setAccess(me, created, { ...accessList, confidentiality });
    await this.content.syncText(created.id);

    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: created.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.CREATED,
      entityType: TraceEntityType.DOCUMENT,
      entityId: created.id,
      title: `Documento ${created.code ?? `#${created.number}`} criado`,
      description: created.title,
      statusTo: created.status,
      metadata: { type: created.type, version: created.version },
    });

    return this.getById(me, created.id);
  }

  async update(me: AuthPayload, id: string, patch: any) {
    const before = await this.loadVisible(me, id);
    await this.assertWriteArea(me, this.areaOf(before), 'edit');
    if ('status' in (patch ?? {}) && this.parseStatus(patch.status) !== before.status) {
      throw new BadRequestException(DIRECT_STATUS_MESSAGE);
    }
    this.assertEditableMetadata(before, patch);

    const links = await this.validateLinks(me.companyId, {
      orgNodeId: 'orgNodeId' in (patch ?? {}) ? this.id(patch.orgNodeId) : before.orgNodeId,
      indicatorId: 'indicatorId' in (patch ?? {}) ? this.id(patch.indicatorId) : before.indicatorId,
      ownerUserId: 'ownerUserId' in (patch ?? {}) ? this.id(patch.ownerUserId) : before.ownerUserId,
      approverUserId: before.approverUserId,
    });
    await this.assertWriteArea(me, links.area, 'edit');
    if (links.ids.ownerUserId !== before.ownerUserId && links.ids.ownerUserId) {
      const config = await this.workflow.config(me.companyId, before);
      if ([...config.reviewers, ...config.approvers].includes(links.ids.ownerUserId)) {
        throw new BadRequestException('O novo responsável já é revisor ou aprovador deste documento. Ajuste os participantes primeiro.');
      }
    }

    const data: any = { ...links.ids };
    if ('title' in (patch ?? {})) data.title = this.requiredText(patch.title, 'Título');
    if ('code' in (patch ?? {})) {
      const code = this.nullableText(patch.code);
      if (code && code !== before.code) {
        const duplicate = await this.prisma.document.findFirst({ where: { companyId: me.companyId, code, deletedAt: null, id: { not: id } } });
        if (duplicate) throw new ConflictException('Já existe documento com este código nesta empresa.');
      }
      data.code = code;
    }
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('type' in (patch ?? {})) data.type = this.parseType(patch.type) ?? before.type;
    if ('content' in (patch ?? {})) data.content = this.nullableText(patch.content);
    if ('externalUrl' in (patch ?? {})) data.externalUrl = this.nullableText(patch.externalUrl);
    if ('changeNote' in (patch ?? {})) data.changeNote = this.nullableText(patch.changeNote);
    if ('validFrom' in (patch ?? {})) data.validFrom = this.optionalDate(patch.validFrom, 'Início de vigência');
    if ('validUntil' in (patch ?? {})) data.validUntil = this.optionalDate(patch.validUntil, 'Validade');
    if ('reviewIntervalMonths' in (patch ?? {})) data.reviewIntervalMonths = this.optionalInt(patch.reviewIntervalMonths);

    const updated = await this.prisma.$transaction(async (tx) => {
      await assertDocumentUnchanged(tx, me.companyId, before);
      const doc = await tx.document.update({ where: { id }, data, include: this.include() });
      await this.auditTx(tx, me, doc.id, 'UPDATE_METADATA', { title: before.title, code: before.code, ownerUserId: before.ownerUserId, validUntil: before.validUntil }, data, this.nullableText(patch?.reason) ?? 'Atualização de metadados');
      return doc;
    });
    await this.content.syncText(updated.id);

    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: updated.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.UPDATED,
      entityType: TraceEntityType.DOCUMENT,
      entityId: updated.id,
      title: `Documento ${updated.code ?? `#${updated.number}`} atualizado`,
      description: updated.title,
      statusFrom: before.status,
      statusTo: updated.status,
      metadata: { type: updated.type, version: updated.version },
    });

    return this.getById(me, updated.id);
  }

  async remove(me: AuthPayload, id: string) {
    const doc = await this.loadVisible(me, id);
    await this.assertWriteArea(me, this.areaOf(doc), 'delete');
    if (PUBLISHED_LIKE.includes(doc.status)) {
      throw new ConflictException('Documento vigente não pode ser excluído. Torne-o obsoleto para retirá-lo de uso.');
    }
    const removed = await this.prisma.$transaction(async (tx) => {
      await assertDocumentUnchanged(tx, me.companyId, doc);
      const item = await tx.document.update({ where: { id }, data: { deletedAt: new Date() }, include: this.include() });
      await this.auditTx(tx, me, doc.id, 'SOFT_DELETE', { status: doc.status }, { deletedAt: item.deletedAt }, 'Exclusão lógica');
      return item;
    });
    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: doc.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.UPDATED,
      entityType: TraceEntityType.DOCUMENT,
      entityId: doc.id,
      title: `Documento ${doc.code ?? `#${doc.number}`} excluído`,
      description: doc.title,
      statusFrom: doc.status,
      statusTo: 'DELETED',
    });
    return this.enrich(removed);
  }

  // -------------------------------------------------------- conteúdo (editor)

  private async assertCanEditContent(me: AuthPayload, doc: any) {
    if (!EDITABLE_STATUSES.has(doc.status)) {
      throw new ConflictException('Documento bloqueado para edição. Crie uma nova revisão para alterar uma versão aprovada ou publicada.');
    }
    const caps = await this.capabilities(me, doc);
    if (!caps.canEditContent) {
      const approved = await this.findApprovedEditRequest(me, doc.id);
      if (!approved) throw new ForbiddenException('Só o responsável edita o conteúdo. Peça a liberação de edição.');
    }
  }

  /** Salva o conteúdo do editor visual (autosave). */
  async saveContent(me: AuthPayload, id: string, body: any = {}) {
    const doc = await this.loadVisible(me, id);
    await this.assertCanEditContent(me, doc);
    if (!isDocNode(body?.contentJson)) throw new BadRequestException('Conteúdo do editor inválido.');
    const json = JSON.stringify(body.contentJson);
    if (Buffer.byteLength(json, 'utf8') > MAX_CONTENT_JSON_BYTES) throw new BadRequestException('O documento passou de 20 MB. Reduza o tamanho ou a quantidade das imagens.');
    const checksum = sha256(json);
    const saved = await this.prisma.$transaction(async (tx) => {
      await assertDocumentUnchanged(tx, me.companyId, doc);
      const version = await this.ensureLatestVersionTx(tx, doc, me.sub);
      const item = await tx.document.update({
        where: { id },
        data: {
          contentJson: body.contentJson as Prisma.InputJsonValue,
          contentFormat: DocumentContentFormat.STRUCTURED,
          changeNote: this.nullableText(body?.changeNote) ?? doc.changeNote,
          ...(doc.status === DocumentStatus.DRAFT ? { status: DocumentStatus.IN_DEVELOPMENT } : {}),
        },
      });
      if (doc.status === DocumentStatus.DRAFT) {
        await tx.documentVersion.update({ where: { id: version.id }, data: { status: DocumentStatus.IN_DEVELOPMENT } });
      }
      await tx.documentAutosaveCheckpoint.create({
        data: { companyId: me.companyId, documentId: id, versionId: version.id, userId: me.sub, content: json.length <= 2_000_000 ? json : null, checksum },
      });
      return item;
    });
    await this.content.syncText(id);
    return { savedAt: new Date().toISOString(), checksum, status: saved.status };
  }

  /** Troca o formato principal (editor visual ⇄ Word ⇄ PDF anexado). */
  async changeFormat(me: AuthPayload, id: string, body: any = {}) {
    const doc = await this.loadVisible(me, id);
    await this.assertCanEditContent(me, doc);
    const to = this.parseFormat(body?.format);
    if (!to || to === DocumentContentFormat.TEXT) throw new BadRequestException('Escolha editor visual, Word ou PDF anexado.');
    if (to === doc.contentFormat) return { format: to, html: null };
    let html: string | null = null;
    const version = await this.ensureLatestVersion(doc, me.sub);
    if (to === DocumentContentFormat.STRUCTURED) {
      // Do Word para o editor: o HTML volta para o editor montar o documento;
      // o texto já vira um documento inicial, caso a pessoa não salve.
      let initial: DocNode | null = null;
      if (doc.contentFormat === DocumentContentFormat.DOCX) {
        const docx = await this.render.latestDocx(doc, version);
        if (docx) {
          html = (await docxToHtml(docx.buffer)).html;
          initial = markdownToDoc(await docxToText(docx.buffer));
        }
      }
      if (!initial) initial = isDocNode(doc.contentJson) ? (doc.contentJson as DocNode) : markdownToDoc(doc.content ?? doc.bodyText ?? '');
      await this.prisma.$transaction(async (tx) => {
        await assertDocumentUnchanged(tx, me.companyId, doc);
        await tx.document.update({ where: { id }, data: { contentFormat: to, contentJson: initial as unknown as Prisma.InputJsonValue } });
      });
    } else if (to === DocumentContentFormat.DOCX) {
      // Do editor para o Word: gera um .docx real com o conteúdo atual.
      const source = isDocNode(doc.contentJson) ? (doc.contentJson as DocNode) : markdownToDoc(doc.content ?? '');
      const buffer = buildDocxFromDoc(source as any);
      const stored = await this.storage.putBinary(me.companyId, `documents/${doc.id}/editor`, `${doc.code ?? doc.number}-${version.versionLabel.replace(/\W+/g, '')}.docx`, buffer, DOCX_MIME);
      await this.prisma.$transaction(async (tx) => {
        await assertDocumentUnchanged(tx, me.companyId, doc);
        const file = await tx.documentFile.create({
          data: { companyId: me.companyId, documentId: doc.id, versionId: version.id, kind: DocumentFileKind.DOCX, protected: false, createdById: me.sub, contentText: null, ...stored },
        });
        await tx.documentVersion.update({ where: { id: version.id }, data: { docxFileId: file.id } });
        await tx.document.update({ where: { id }, data: { contentFormat: to } });
      });
    } else {
      await this.prisma.$transaction(async (tx) => {
        await assertDocumentUnchanged(tx, me.companyId, doc);
        await tx.document.update({ where: { id }, data: { contentFormat: to } });
      });
    }
    await this.audit(me, id, 'CONTENT_FORMAT', { format: doc.contentFormat }, { format: to }, 'Troca do formato principal');
    await this.content.syncText(id);
    return { format: to, html };
  }

  /** Converte um .docx enviado em HTML para importar no editor visual. */
  async convertDocxForEditor(buffer: Buffer) {
    if (!buffer?.length) throw new BadRequestException('Arquivo vazio.');
    if (buffer.length > MAX_UPLOAD_BYTES) throw new BadRequestException('Arquivo excede o limite de 20 MB.');
    if (!isDocxBuffer(buffer)) throw new BadRequestException('Envie um arquivo .docx válido.');
    if (docxHasMacros(buffer)) throw new BadRequestException('Arquivos com macros não são aceitos.');
    return docxToHtml(buffer);
  }

  // -------------------------------------------------------------- fluxo/status

  /** Transições manuais: cancelar rascunho, revisão periódica, obsoleto, arquivar. */
  async transition(me: AuthPayload, id: string, to: DocumentStatus, body: any = {}) {
    const doc = await this.loadVisible(me, id);
    await this.assertWriteArea(me, this.areaOf(doc), 'edit');
    const caps = await this.capabilities(me, doc);
    if ((to === DocumentStatus.OBSOLETE || to === DocumentStatus.ARCHIVED) && !caps.canObsolete) {
      throw new ForbiddenException('Só o responsável ou o gestor do GED retira o documento de uso.');
    }
    const comment = this.nullableText(body?.comment);
    if (COMMENT_REQUIRED.has(to) && !comment) throw new BadRequestException('Comentário obrigatório para esta transição.');
    if (!MANUAL_TRANSITIONS[doc.status as DocumentStatus]?.includes(to)) {
      throw new ConflictException(`Transição de ${DOCUMENT_STATUS_LABEL[doc.status] ?? doc.status} para ${DOCUMENT_STATUS_LABEL[to] ?? to} não permitida.`);
    }
    const retentionUntil = to === DocumentStatus.OBSOLETE || to === DocumentStatus.ARCHIVED
      ? doc.retentionUntil ?? (await this.governance.retentionUntil(me.companyId, doc.typeConfigId))
      : doc.retentionUntil;

    const updated = await this.prisma.$transaction(async (tx) => {
      await assertDocumentUnchanged(tx, me.companyId, doc);
      const version = await this.ensureLatestVersionTx(tx, doc, me.sub);
      const item = await tx.document.update({ where: { id }, data: { status: to, retentionUntil }, include: this.include() });
      await tx.documentVersion.update({ where: { id: version.id }, data: { status: to === DocumentStatus.PERIODIC_REVIEW ? version.status : to } });
      if (to === DocumentStatus.APPROVED) {
        await tx.documentVersion.update({ where: { id: version.id }, data: { status: DocumentStatus.APPROVED, publicationDate: null } });
      }
      await this.recordStatusTx(tx, me, doc.id, doc.status, to, comment, { versionId: version.id });
      await this.auditTx(tx, me, doc.id, 'STATUS_CHANGE', { status: doc.status }, { status: to }, comment ?? 'Transição de status');
      return item;
    });
    if (to === DocumentStatus.OBSOLETE || to === DocumentStatus.ARCHIVED) {
      // Leituras pendentes da revisão retirada de uso perdem o sentido.
      await this.prisma.documentReadConfirmation.updateMany({ where: { companyId: me.companyId, documentId: id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
      this.workItems.markDirty(me.companyId, [me.sub], 'document-retired');
    }

    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: updated.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.STATUS_CHANGED,
      entityType: TraceEntityType.DOCUMENT,
      entityId: updated.id,
      title: `Status do documento ${updated.code ?? `#${updated.number}`} alterado`,
      description: updated.title,
      statusFrom: doc.status,
      statusTo: updated.status,
    });

    return this.getById(me, updated.id);
  }

  async setParticipants(me: AuthPayload, id: string, body: any) {
    const doc = await this.loadVisible(me, id);
    const caps = await this.capabilities(me, doc);
    if (!caps.canConfigure) throw new ForbiddenException('Só o responsável ou o gestor do GED define revisores e aprovadores.');
    await this.workflow.setParticipants(me, doc, body);
    return this.getById(me, id);
  }

  async submit(me: AuthPayload, id: string, body: any = {}) {
    const doc = await this.loadVisible(me, id);
    await this.assertWriteArea(me, this.areaOf(doc), 'edit');
    const caps = await this.capabilities(me, doc);
    if (!caps.canSubmit) throw new ForbiddenException('Você não pode enviar este documento para análise.');
    if (doc.contentFormat === DocumentContentFormat.FILE) {
      const pdf = await this.prisma.documentFile.findFirst({ where: { documentId: id, companyId: me.companyId, kind: DocumentFileKind.ATTACHMENT, mimeType: PDF_MIME, protected: true, deletedAt: null } });
      if (!pdf) throw new BadRequestException('Anexe o PDF do documento antes de enviar.');
    }
    const result = await this.workflow.submit(me, doc, body);
    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: doc.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.STATUS_CHANGED,
      entityType: TraceEntityType.DOCUMENT,
      entityId: doc.id,
      title: `Documento ${doc.code ?? `#${doc.number}`} enviado para análise`,
      description: doc.title,
      statusFrom: doc.status,
      statusTo: result.status,
    });
    return this.getById(me, id);
  }

  async decide(me: AuthPayload, id: string, body: any = {}, context: { ip?: string; userAgent?: string } = {}) {
    const doc = await this.loadVisible(me, id);
    const result = await this.workflow.decide(me, doc, body, context);
    if (result.approved && body?.publishNow) {
      const fresh = await this.loadScoped(id, me.companyId);
      const caps = await this.capabilities(me, fresh);
      if (caps.canPublish) {
        await this.publish(me, id, { comment: body?.comment, validUntil: body?.validUntil }, context, { preSigned: true });
      }
    }
    return { ...(await this.getById(me, id)), decision: { signature: result.signature, status: result.status } };
  }

  async delegate(me: AuthPayload, id: string, body: any) {
    const doc = await this.loadVisible(me, id);
    await this.workflow.delegate(me, doc, body);
    return this.getById(me, id);
  }

  async cancelFlow(me: AuthPayload, id: string, body: any) {
    const doc = await this.loadVisible(me, id);
    const caps = await this.capabilities(me, doc);
    if (!caps.canConfigure && !caps.isManager) throw new ForbiddenException('Só o responsável ou o gestor do GED retira o documento do fluxo.');
    await this.workflow.cancel(me, doc, body);
    return this.getById(me, id);
  }

  /**
   * Publicação oficial: gera o PDF fiel (com registro das assinaturas), torna a
   * revisão vigente, substitui a anterior, distribui a leitura obrigatória e
   * avisa os envolvidos. Com `publishAt` futuro, apenas agenda.
   */
  async publish(me: AuthPayload, id: string, body: any = {}, context: { ip?: string; userAgent?: string } = {}, options: { preSigned?: boolean; system?: boolean } = {}) {
    const doc = await this.loadScoped(id, me.companyId);
    if (!options.system) await this.assertViewArea(me, doc);
    if (doc.status !== DocumentStatus.APPROVED && doc.status !== DocumentStatus.SCHEDULED_PUBLICATION) {
      throw new ConflictException('Somente documentos aprovados podem ser publicados.');
    }
    if (!options.system) {
      const caps = await this.capabilities(me, doc);
      if (!caps.canPublish) throw new ForbiddenException('Publica o aprovador final ou quem tem a permissão de publicar documentos.');
      if (!options.preSigned) await this.workflow.verifySignature(me, body?.password);
    }
    const version = await this.ensureLatestVersion(doc, me.sub);
    const publishAt = this.optionalDate(body?.publishAt, 'Data de publicação');
    if (publishAt && publishAt.getTime() > Date.now() + 60_000) {
      await this.prisma.$transaction(async (tx) => {
        await assertDocumentUnchanged(tx, me.companyId, doc);
        await tx.document.update({ where: { id }, data: { status: DocumentStatus.SCHEDULED_PUBLICATION } });
        await tx.documentVersion.update({ where: { id: version.id }, data: { status: DocumentStatus.SCHEDULED_PUBLICATION, publicationDate: publishAt, publishedById: me.sub } });
        await this.recordStatusTx(tx, me, doc.id, doc.status, DocumentStatus.SCHEDULED_PUBLICATION, `Publicação agendada para ${publishAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, { versionId: version.id });
        await this.auditTx(tx, me, doc.id, 'PUBLISH_SCHEDULED', { status: doc.status }, { publishAt }, this.nullableText(body?.comment) ?? 'Publicação agendada');
      });
      return this.getById(me, id);
    }

    const now = new Date();
    let publicationSignature: Prisma.DocumentApprovalUncheckedCreateInput | null = null;
    if (!options.system) {
      const signatureHash = this.workflow.signatureHash([doc.id, version.id, me.sub, 'PUBLISHER', 'APPROVED', version.contentHash ?? '', now.toISOString()]);
      publicationSignature = {
        companyId: me.companyId,
        documentId: doc.id,
        versionId: version.id,
        approverUserId: me.sub,
        approverRole: 'PUBLISHER',
        approvalOrder: 99,
        decision: DocumentApprovalDecision.APPROVED,
        statusFrom: doc.status,
        statusTo: DocumentStatus.PUBLISHED,
        comment: this.nullableText(body?.comment) ?? null,
        decidedAt: now,
        ip: context.ip ?? null,
        userAgent: context.userAgent?.slice(0, 500) ?? null,
        signatureMethod: options.preSigned ? 'APPROVAL_SIGNATURE' : 'PASSWORD',
        signatureHash,
        contentHash: version.contentHash,
      };
    }

    const validUntil = this.optionalDate(body?.validUntil, 'Validade')
      ?? (doc.typeConfig?.defaultValidityDays ? addDays(now, doc.typeConfig.defaultValidityDays) : doc.validUntil && doc.validUntil > now ? doc.validUntil : null);
    const docForPdf = { ...doc, status: DocumentStatus.PUBLISHED, publishedAt: now, validUntil };
    const signatures = await this.render.signatures(me.companyId, doc.id, version.id);
    if (publicationSignature) signatures.push({
      stage: 'Publicação', name: me.name, decision: 'Aprovado',
      at: formatDateTimeBr(now) ?? '', verification: String(publicationSignature.signatureHash).slice(0, 12).toUpperCase(),
    });
    const official = await this.render.officialPdf({ doc: docForPdf, version, signatures });
    const stored = await this.storage.putBinary(
      me.companyId,
      `documents/${doc.id}/${version.versionLabel}`,
      `${doc.code ?? doc.number}-${version.versionLabel}.pdf`,
      official.buffer,
      PDF_MIME,
    );

    const published = await this.prisma.$transaction(async (tx) => {
      await assertDocumentUnchanged(tx, me.companyId, doc);
      if (publicationSignature) await tx.documentApproval.create({ data: publicationSignature });
      const pdf = await tx.documentFile.create({
        data: {
          companyId: me.companyId,
          documentId: doc.id,
          versionId: version.id,
          kind: DocumentFileKind.PDF,
          protected: true,
          createdById: me.sub,
          contentText: null,
          ...stored,
        },
      });
      await tx.documentVersion.updateMany({
        where: { documentId: doc.id, companyId: me.companyId, id: { not: version.id }, status: { in: [DocumentStatus.PUBLISHED] } },
        data: { status: DocumentStatus.REPLACED },
      });
      await tx.documentVersion.update({
        where: { id: version.id },
        data: {
          status: DocumentStatus.PUBLISHED,
          pdfFileId: pdf.id,
          pdfSource: official.source,
          publicationDate: now,
          expirationDate: validUntil,
          publishedById: version.publishedById ?? me.sub,
        },
      });
      const item = await tx.document.update({
        where: { id },
        data: {
          status: DocumentStatus.PUBLISHED,
          approvedAt: doc.approvedAt ?? now,
          publishedAt: now,
          validFrom: doc.validFrom && doc.version === 1 ? doc.validFrom : now,
          validUntil,
          retentionUntil: null,
        },
        include: this.include(),
      });
      await this.recordStatusTx(tx, me, doc.id, doc.status, DocumentStatus.PUBLISHED, this.nullableText(body?.comment), { versionId: version.id, pdfFileId: pdf.id, pdfSource: official.source });
      await this.auditTx(tx, me, doc.id, 'PUBLISH', { status: doc.status }, { status: DocumentStatus.PUBLISHED, pdfFileId: pdf.id, pdfSource: official.source }, this.nullableText(body?.comment) ?? 'Publicação oficial', context);
      return item;
    });

    await this.afterPublish(me, published, version);
    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: published.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.STATUS_CHANGED,
      entityType: TraceEntityType.DOCUMENT,
      entityId: published.id,
      title: `Documento ${published.code ?? `#${published.number}`} publicado (${version.versionLabel})`,
      description: published.title,
      statusFrom: doc.status,
      statusTo: DocumentStatus.PUBLISHED,
    });
    return options.system ? this.enrich(published) : this.getById(me, published.id);
  }

  /** Efeitos da publicação (nunca derrubam a publicação em si). */
  private async afterPublish(me: AuthPayload, doc: any, version: { id: string; versionLabel: string }) {
    const tasks: Array<Promise<unknown>> = [
      this.content.syncText(doc.id),
      this.distribution.syncAssignments(me.companyId, doc.id),
      this.changeRequests.markImplemented(me.companyId, doc.id, version.id, label(doc)),
      this.retireReplaced(me, doc),
      this.notifyPublication(me, doc, version.versionLabel),
    ];
    for (const result of await Promise.allSettled(tasks)) {
      if (result.status === 'rejected') this.logger.warn(`Efeito da publicação falhou (${doc.id}): ${(result.reason as Error)?.message ?? result.reason}`);
    }
    const config = await this.workflow.config(me.companyId, doc);
    this.workItems.markDirty(me.companyId, [authorOf(doc), ...config.reviewers, ...config.approvers, me.sub].filter(Boolean) as string[], 'document-published');
  }

  /** Documentos marcados como "substituído por este" saem de uso. */
  private async retireReplaced(me: AuthPayload, doc: any) {
    const relations = await this.prisma.documentRelation.findMany({ where: { companyId: me.companyId, documentId: doc.id, relatedEntityType: 'DOCUMENT', relationKind: 'REPLACES' } });
    for (const relation of relations) {
      const target = await this.prisma.document.findFirst({ where: { id: relation.relatedEntityId, companyId: me.companyId, deletedAt: null } });
      if (!target || !PUBLISHED_LIKE.includes(target.status)) continue;
      await this.prisma.$transaction(async (tx) => {
        await tx.document.update({ where: { id: target.id }, data: { status: DocumentStatus.REPLACED, retentionUntil: await this.governance.retentionUntil(me.companyId, target.typeConfigId) } });
        await tx.documentReadConfirmation.updateMany({ where: { documentId: target.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
        await this.recordStatusTx(tx, me, target.id, target.status, DocumentStatus.REPLACED, `Substituído por ${label(doc)}`, { replacedBy: doc.id });
      });
    }
  }

  private async notifyPublication(me: AuthPayload, doc: any, versionLabel: string) {
    const links = await this.prisma.processIntegration.findMany({
      where: { documentId: doc.id, process: { companyId: me.companyId, deletedAt: null } },
      include: { process: { select: { id: true, name: true, ownerUserId: true } } },
    });
    const owners = new Map<string, string[]>();
    for (const link of links) {
      if (!link.process.ownerUserId) continue;
      owners.set(link.process.ownerUserId, [...(owners.get(link.process.ownerUserId) ?? []), link.process.name]);
    }
    const author = authorOf(doc);
    const recipients = new Map<string, string>();
    if (author && author !== me.sub) recipients.set(author, `A ${versionLabel} de "${doc.title}" foi publicada e já é a versão vigente.`);
    for (const [userId, processes] of owners) {
      if (userId === me.sub) continue;
      recipients.set(userId, `Nova revisão (${versionLabel}) de "${doc.title}", vinculado ao processo ${[...new Set(processes)].join(', ')}. Confira as atividades que dependem dele.`);
    }
    for (const [userId, body] of recipients) {
      try {
        await this.notifications.create(me.companyId, userId, NotificationKind.MESSAGE, `Documento publicado: ${label(doc)}`.slice(0, 180), body, `/documents/${doc.id}`);
      } catch {
        // best-effort
      }
    }
  }

  /** Publica as revisões agendadas cuja data chegou (rotina de manutenção). */
  async publishScheduled(companyId: string) {
    const due = await this.prisma.documentVersion.findMany({
      where: { companyId, status: DocumentStatus.SCHEDULED_PUBLICATION, publicationDate: { lte: new Date() }, document: { status: DocumentStatus.SCHEDULED_PUBLICATION, deletedAt: null } },
      select: { documentId: true, publishedById: true },
      take: 50,
    });
    let published = 0;
    for (const item of due) {
      const actor = item.publishedById ? await this.prisma.user.findFirst({ where: { id: item.publishedById }, select: { id: true, name: true, email: true, role: true } }) : null;
      const me = { sub: actor?.id ?? null, companyId, name: actor?.name ?? 'Sistema', email: actor?.email ?? '', role: actor?.role ?? 'COLLABORATOR' } as unknown as AuthPayload;
      try {
        await this.publish(me, item.documentId, { comment: 'Publicação agendada' }, {}, { system: true });
        published++;
      } catch (error) {
        this.logger.warn(`Publicação agendada falhou (${item.documentId}): ${(error as Error).message}`);
      }
    }
    return published;
  }

  async createRevision(me: AuthPayload, id: string, body: any = {}) {
    const doc = await this.loadVisible(me, id);
    await this.assertWriteArea(me, this.areaOf(doc), 'edit');
    if (!PUBLISHED_LIKE.includes(doc.status)) throw new ConflictException('Nova revisão só pode partir de um documento vigente.');
    const reason = this.requiredText(body?.reason, 'Motivo da nova revisão');
    const changeRequestId = this.id(body?.changeRequestId);
    const created = await this.prisma.$transaction(async (tx) => {
      const { document } = await this.newRevisionTx(tx, me, doc, reason, this.nullableText(body?.summary) ?? null, 'NEW_REVISION');
      return document;
    });
    if (changeRequestId) {
      await this.prisma.documentChangeRequest.updateMany({ where: { id: changeRequestId, companyId: me.companyId, documentId: id, status: 'OPEN' }, data: { status: 'ACCEPTED', decidedById: me.sub, decidedAt: new Date(), decisionNote: reason } });
    }
    await this.content.syncText(id);
    return this.getById(me, created.id);
  }

  /**
   * Abre a próxima revisão a partir da vigente: copia o conteúdo (editor visual
   * ou Word) sem alterar o texto; o motivo fica registrado na própria revisão.
   */
  private async newRevisionTx(tx: Tx, me: AuthPayload, doc: any, reason: string, summary: string | null, source: string) {
    await assertDocumentUnchanged(tx, me.companyId, doc);
    const latest = await this.ensureLatestVersionTx(tx, doc, me.sub);
    const nextRevisionNumber = latest.revisionNumber + 1;
    const versionLabel = `Rev. ${String(nextRevisionNumber).padStart(2, '0')}`;
    const version = await tx.documentVersion.create({
      data: {
        companyId: me.companyId,
        documentId: doc.id,
        revisionNumber: nextRevisionNumber,
        versionLabel,
        status: DocumentStatus.IN_DEVELOPMENT,
        changeReason: reason,
        changeSummary: summary,
        expirationDate: doc.validUntil,
        createdById: me.sub,
      },
    });
    let file: any = null;
    if (doc.contentFormat === DocumentContentFormat.DOCX || doc.contentFormat === DocumentContentFormat.TEXT) {
      const sourceFile = latest.docxFileId
        ? await tx.documentFile.findFirst({ where: { id: latest.docxFileId, companyId: me.companyId, deletedAt: null } })
        : await tx.documentFile.findFirst({ where: { documentId: doc.id, companyId: me.companyId, kind: DocumentFileKind.DOCX, deletedAt: null }, orderBy: { createdAt: 'desc' } });
      let binarySeed: Buffer | null = null;
      if (sourceFile && sourceFile.contentText == null && sourceFile.storageKey) {
        try {
          binarySeed = await this.storage.readBinary(sourceFile.storageKey);
        } catch {
          binarySeed = null;
        }
      }
      const textSeed = sourceFile?.contentText ?? doc.content ?? generatedDocumentBody(doc.title, doc.code ?? `#${doc.number}`, versionLabel);
      const stored = binarySeed
        ? await this.storage.putBinary(me.companyId, `documents/${doc.id}/rev-${nextRevisionNumber}`, `${doc.code ?? doc.number}-${versionLabel}.docx`, binarySeed, DOCX_MIME)
        : await this.storage.putText(me.companyId, `documents/${doc.id}/rev-${nextRevisionNumber}`, `${doc.code ?? doc.number}-${versionLabel}.docx`, textSeed, DOCX_MIME);
      file = await tx.documentFile.create({
        data: {
          companyId: me.companyId,
          documentId: doc.id,
          versionId: version.id,
          kind: DocumentFileKind.DOCX,
          protected: false,
          createdById: me.sub,
          contentText: binarySeed ? null : textSeed,
          ...stored,
        },
      });
      await tx.documentVersion.update({ where: { id: version.id }, data: { docxFileId: file.id } });
    }
    if (doc.contentFormat === DocumentContentFormat.FILE) {
      // PDF anexado: a nova revisão começa com o mesmo arquivo, que pode ser trocado.
      const previous = await tx.documentFile.findFirst({ where: { documentId: doc.id, companyId: me.companyId, kind: DocumentFileKind.ATTACHMENT, mimeType: PDF_MIME, protected: true, deletedAt: null }, orderBy: { createdAt: 'desc' } });
      if (previous) {
        await tx.documentFile.create({
          data: {
            companyId: me.companyId, documentId: doc.id, versionId: version.id, kind: DocumentFileKind.ATTACHMENT, storageProvider: previous.storageProvider,
            storageKey: previous.storageKey, fileName: previous.fileName, mimeType: previous.mimeType, sizeBytes: previous.sizeBytes, hashSha256: previous.hashSha256, protected: true, createdById: me.sub,
          },
        });
      }
    }
    const lastStructured = isDocNode(doc.contentJson)
      ? doc.contentJson
      : await tx.documentVersion.findFirst({ where: { documentId: doc.id, contentJson: { not: Prisma.DbNull } }, orderBy: { revisionNumber: 'desc' }, select: { contentJson: true } }).then((row) => row?.contentJson ?? null);
    const document = await tx.document.update({
      where: { id: doc.id },
      data: {
        version: doc.version + 1,
        status: DocumentStatus.IN_DEVELOPMENT,
        changeNote: reason,
        approvedAt: null,
        ...(doc.contentFormat === DocumentContentFormat.STRUCTURED && lastStructured ? { contentJson: lastStructured as Prisma.InputJsonValue } : {}),
      },
      include: this.include(),
    });
    await this.recordStatusTx(tx, me, doc.id, doc.status, DocumentStatus.IN_DEVELOPMENT, reason, { versionId: version.id, source });
    await this.auditTx(tx, me, doc.id, source === 'NEW_REVISION' ? 'CREATE_REVISION' : 'CREATE_REVISION_FOR_EDIT_REQUEST', { latestVersionId: latest.id }, { versionId: version.id, revisionNumber: nextRevisionNumber }, reason);
    return { document, version, file };
  }

  // ------------------------------------------------------- liberação de edição

  async requestEdit(me: AuthPayload, id: string, body: any = {}) {
    const doc = await this.loadVisible(me, id);
    const existing = await this.prisma.documentEditRequest.findFirst({
      where: {
        companyId: me.companyId,
        documentId: id,
        requesterUserId: me.sub,
        status: { in: ACTIVE_EDIT_REQUEST_STATUSES },
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        operator: { select: { id: true, name: true, email: true } },
        decidedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing;

    const operatorUserId = await this.resolveEditOperator(me, doc, body?.operatorUserId);
    const latest = await this.prisma.documentVersion.findFirst({
      where: { companyId: me.companyId, documentId: id, deletedAt: null },
      orderBy: { revisionNumber: 'desc' },
    });
    const reason = this.nullableText(body?.reason) ?? 'Solicitação de liberação para revisão/edição do documento.';
    const expiresAt = this.optionalDate(body?.expiresAt, 'Prazo da liberação') ?? null;
    const request = await this.prisma.documentEditRequest.create({
      data: {
        companyId: me.companyId,
        documentId: id,
        versionId: latest?.id ?? null,
        requesterUserId: me.sub,
        operatorUserId,
        reason,
        expiresAt,
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        operator: { select: { id: true, name: true, email: true } },
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    });
    await this.audit(me, id, 'EDIT_REQUESTED', null, { requestId: request.id, operatorUserId }, reason);
    if (operatorUserId !== me.sub) {
      try {
        await this.notifications.create(me.companyId, operatorUserId, NotificationKind.MESSAGE, `Liberar edição: ${label(doc)}`.slice(0, 180), `${me.name} pediu para editar "${doc.title}". Motivo: ${reason}`, `/documents/${doc.id}`);
      } catch {
        // best-effort
      }
    }
    this.workItems.markDirty(me.companyId, [operatorUserId, me.sub], 'document-edit-requested');
    return request;
  }

  async grantEditRequest(me: AuthPayload, id: string, body: any = {}) {
    const doc = await this.loadVisible(me, id);
    await this.assertCanOperateDocumentEdit(me, doc);

    const requesterUserId = this.requiredText(body?.requesterUserId, 'Usuário para edição');
    const requester = await this.prisma.user.findFirst({
      where: { id: requesterUserId, companyId: me.companyId, deletedAt: null, active: true, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!requester) throw new NotFoundException('Usuário solicitante não encontrado ou inativo.');

    const note = this.nullableText(body?.note ?? body?.reason) ?? 'Liberação direta de edição pelo operador.';
    const expiresAt = this.optionalDate(body?.expiresAt, 'Prazo da liberação') ?? null;
    const existing = await this.prisma.documentEditRequest.findFirst({
      where: {
        companyId: me.companyId,
        documentId: id,
        requesterUserId,
        status: { in: ACTIVE_EDIT_REQUEST_STATUSES },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing?.status === 'APPROVED' || existing?.status === 'IN_PROGRESS') {
      return this.loadEditRequest(me.companyId, existing.id);
    }

    const granted = await this.prisma.$transaction(async (tx) => {
      let versionId = existing?.versionId ?? null;
      let document = doc;
      if (!EDITABLE_STATUSES.has(document.status as DocumentStatus)) {
        const revision = await this.newRevisionTx(tx, me, document, note, null, 'EDIT_REQUEST');
        versionId = revision.version.id;
        document = revision.document;
      } else if (!versionId) {
        const latest = await this.ensureLatestVersionTx(tx, document, me.sub);
        versionId = latest.id;
      }

      const include = {
        requester: { select: { id: true, name: true, email: true } },
        operator: { select: { id: true, name: true, email: true } },
        decidedBy: { select: { id: true, name: true, email: true } },
      };

      const request = existing
        ? await tx.documentEditRequest.update({
            where: { id: existing.id },
            data: {
              status: 'APPROVED',
              versionId,
              operatorUserId: me.sub,
              decidedById: me.sub,
              decisionNote: note,
              approvedAt: new Date(),
              expiresAt,
            },
            include,
          })
        : await tx.documentEditRequest.create({
            data: {
              companyId: me.companyId,
              documentId: id,
              versionId,
              requesterUserId,
              operatorUserId: me.sub,
              decidedById: me.sub,
              status: 'APPROVED',
              reason: note,
              decisionNote: note,
              approvedAt: new Date(),
              expiresAt,
            },
            include,
          });

      await this.auditTx(
        tx,
        me,
        document.id,
        'EDIT_REQUEST_GRANTED',
        existing ? { requestId: existing.id, status: existing.status } : null,
        { requestId: request.id, status: 'APPROVED', requesterUserId, versionId },
        note,
      );
      return request;
    });

    this.workItems.markDirty(me.companyId, [requesterUserId, me.sub], 'document-edit-granted');
    return granted;
  }

  async approveEditRequest(me: AuthPayload, requestId: string, body: any = {}) {
    const request = await this.loadEditRequest(me.companyId, requestId);
    await this.assertCanDecideEditRequest(me, request);
    if (request.status !== 'REQUESTED') throw new ConflictException('Esta solicitação não está pendente.');

    const note = this.nullableText(body?.note ?? body?.comment);
    const approved = await this.prisma.$transaction(async (tx) => {
      let versionId = request.versionId;
      let document = request.document;
      if (!EDITABLE_STATUSES.has(document.status as DocumentStatus)) {
        const revision = await this.newRevisionTx(tx, me, document, note ?? request.reason ?? 'Liberação de edição', null, 'EDIT_REQUEST');
        versionId = revision.version.id;
        document = revision.document;
      } else if (!versionId) {
        const latest = await this.ensureLatestVersionTx(tx, document, me.sub);
        versionId = latest.id;
      }

      const updated = await tx.documentEditRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          versionId,
          decidedById: me.sub,
          decisionNote: note,
          approvedAt: new Date(),
        },
        include: {
          requester: { select: { id: true, name: true, email: true } },
          operator: { select: { id: true, name: true, email: true } },
          decidedBy: { select: { id: true, name: true, email: true } },
        },
      });
      await this.auditTx(
        tx,
        me,
        document.id,
        'EDIT_REQUEST_APPROVED',
        { requestId: request.id, status: request.status },
        { requestId: request.id, status: 'APPROVED', versionId },
        note ?? 'Liberação de edição',
      );
      return updated;
    });
    this.workItems.markDirty(me.companyId, [request.operatorUserId, request.requesterUserId, me.sub], 'document-edit-approved');
    return approved;
  }

  async rejectEditRequest(me: AuthPayload, requestId: string, body: any = {}) {
    const request = await this.loadEditRequest(me.companyId, requestId);
    await this.assertCanDecideEditRequest(me, request);
    if (request.status !== 'REQUESTED') throw new ConflictException('Esta solicitação não está pendente.');
    const note = this.requiredText(body?.note ?? body?.comment, 'Justificativa');
    const rejected = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.documentEditRequest.update({
        where: { id: request.id },
        data: { status: 'REJECTED', decidedById: me.sub, decisionNote: note, rejectedAt: new Date() },
        include: {
          requester: { select: { id: true, name: true, email: true } },
          operator: { select: { id: true, name: true, email: true } },
          decidedBy: { select: { id: true, name: true, email: true } },
        },
      });
      await this.auditTx(tx, me, request.documentId, 'EDIT_REQUEST_REJECTED', { requestId: request.id }, { requestId: request.id, status: 'REJECTED' }, note);
      return updated;
    });
    this.workItems.markDirty(me.companyId, [request.operatorUserId, request.requesterUserId, me.sub], 'document-edit-rejected');
    return rejected;
  }

  async completeEditRequest(me: AuthPayload, requestId: string, body: any = {}) {
    const request = await this.loadEditRequest(me.companyId, requestId);
    const canClose =
      request.requesterUserId === me.sub ||
      request.operatorUserId === me.sub ||
      ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(String(me.role));
    if (!canClose) throw new ForbiddenException('Somente o solicitante ou operador pode concluir esta edição.');
    if (request.status === 'COMPLETED') return request;
    if (!APPROVED_EDIT_REQUEST_STATUSES.includes(request.status)) {
      throw new ConflictException('Somente solicitações liberadas podem ser concluídas.');
    }
    const note = this.nullableText(body?.note ?? body?.comment);
    const completed = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.documentEditRequest.update({
        where: { id: request.id },
        data: { status: 'COMPLETED', decisionNote: note ?? request.decisionNote, completedAt: new Date() },
        include: {
          requester: { select: { id: true, name: true, email: true } },
          operator: { select: { id: true, name: true, email: true } },
          decidedBy: { select: { id: true, name: true, email: true } },
        },
      });
      await this.auditTx(tx, me, request.documentId, 'EDIT_REQUEST_COMPLETED', { requestId: request.id }, { requestId: request.id }, note ?? 'Edição concluída');
      return updated;
    });
    this.workItems.markDirty(me.companyId, [request.operatorUserId, request.requesterUserId, me.sub], 'document-edit-completed');
    return completed;
  }

  /** Conteúdo em texto simples (documentos legados). */
  async autosave(me: AuthPayload, id: string, body: any = {}) {
    const doc = await this.loadVisible(me, id);
    await this.assertCanEditContent(me, doc);
    const content = this.requiredText(body?.content, 'Conteúdo');
    const saved = await this.prisma.$transaction(async (tx) => {
      await assertDocumentUnchanged(tx, me.companyId, doc);
      const version = await this.ensureLatestVersionTx(tx, doc, me.sub);
      const checksum = sha256(content);
      const item = await tx.document.update({ where: { id }, data: { content, changeNote: this.nullableText(body?.changeNote) ?? doc.changeNote }, include: this.include() });
      await tx.documentAutosaveCheckpoint.create({
        data: { companyId: me.companyId, documentId: id, versionId: version.id, userId: me.sub, content, checksum },
      });
      await this.auditTx(tx, me, id, 'AUTOSAVE', { checksum: sha256(doc.content ?? '') }, { checksum }, 'Autosave');
      return item;
    });
    await this.content.syncText(id);
    return { savedAt: new Date().toISOString(), checksum: sha256(content), document: this.enrich(saved) };
  }

  // ---------------------------------------------------- editores de Word

  /** Edição direta: responsável/criador/gestor com escrita; os demais pedem liberação. */
  private async editAuthorization(me: AuthPayload, doc: any) {
    const approvedRequest = await this.findApprovedEditRequest(me, doc.id);
    if (approvedRequest) return { approvedRequest, direct: false };
    const caps = await this.capabilities(me, doc);
    if (caps.canEditContent) return { approvedRequest: null, direct: true };
    throw new ForbiddenException('A edição precisa de liberação do responsável pelo documento.');
  }

  async openEditor(me: AuthPayload, id: string) {
    const doc = await this.loadVisible(me, id);
    const { approvedRequest } = await this.editAuthorization(me, doc);

    // Sem provedor online configurado: mantém o fluxo manual (download/upload).
    if (!this.editor.isOnline()) {
      const latestDocx = await this.prisma.documentFile.findFirst({
        where: { companyId: me.companyId, documentId: id, kind: DocumentFileKind.DOCX, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      return this.editor.buildSession({
        documentId: id,
        fileId: latestDocx?.id ?? '',
        fileName: latestDocx?.fileName ?? `${doc.code ?? doc.number}.docx`,
        companyId: me.companyId,
        userId: me.sub,
        userName: me.name,
        canWrite: true,
      });
    }

    let editableDoc = doc;
    if (approvedRequest && !EDITABLE_STATUSES.has(doc.status)) {
      editableDoc = await this.prisma.$transaction(async (tx) => {
        const revision = await this.newRevisionTx(tx, me, doc, approvedRequest.reason ?? 'Liberação de edição online', null, 'EDIT_REQUEST');
        await tx.documentEditRequest.update({ where: { id: approvedRequest.id }, data: { versionId: revision.version.id } });
        return revision.document;
      });
    }
    if (!EDITABLE_STATUSES.has(editableDoc.status)) throw new ConflictException('Crie uma nova revisão para editar um documento vigente.');
    const file = await this.ensureEditableDocxFile(me, editableDoc);
    const session = await this.editor.buildSession({
      documentId: id,
      fileId: file.id,
      fileName: file.fileName,
      companyId: me.companyId,
      userId: me.sub,
      userName: me.name,
      canWrite: true,
    });
    await this.prisma.documentEditorSession.create({
      data: {
        companyId: me.companyId,
        documentId: id,
        versionId: file.versionId ?? null,
        userId: me.sub,
        provider: this.editor.provider,
        status: 'OPEN',
        metadata: jsonOrNull({ fileId: file.id, mode: session.mode, online: Boolean(session.editorUrl), editRequestId: approvedRequest?.id ?? null }),
      },
    });
    if (editableDoc.contentFormat !== DocumentContentFormat.DOCX) {
      await this.prisma.document.update({ where: { id }, data: { contentFormat: DocumentContentFormat.DOCX } });
    }
    if (approvedRequest?.status === 'APPROVED') {
      await this.prisma.documentEditRequest.update({ where: { id: approvedRequest.id }, data: { status: 'IN_PROGRESS' } });
      this.workItems.markDirty(me.companyId, [approvedRequest.requesterUserId, approvedRequest.operatorUserId], 'document-edit-started');
    }
    return session;
  }

  async openViewer(me: AuthPayload, id: string) {
    const doc = await this.loadVisible(me, id);

    const latestDocx = await this.prisma.documentFile.findFirst({
      where: { companyId: me.companyId, documentId: id, kind: DocumentFileKind.DOCX, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const file = latestDocx ?? (await this.ensureEditableDocxFile(me, doc));
    const session = await this.editor.buildSession({
      documentId: id,
      fileId: file.id,
      fileName: file.fileName,
      companyId: me.companyId,
      userId: me.sub,
      userName: me.name,
      canWrite: false,
    });

    await this.prisma.documentEditorSession.create({
      data: {
        companyId: me.companyId,
        documentId: id,
        versionId: file.versionId ?? null,
        userId: me.sub,
        provider: this.editor.provider,
        status: 'OPEN',
        metadata: jsonOrNull({ fileId: file.id, mode: session.mode, online: Boolean(session.editorUrl), readOnly: true }),
      },
    });
    return session;
  }

  async openWordDesktopEditor(me: AuthPayload, id: string) {
    const doc = await this.loadVisible(me, id);
    const { approvedRequest } = await this.editAuthorization(me, doc);

    let editableDoc = doc;
    if (approvedRequest && !EDITABLE_STATUSES.has(doc.status)) {
      editableDoc = await this.prisma.$transaction(async (tx) => {
        const revision = await this.newRevisionTx(tx, me, doc, approvedRequest.reason ?? 'Liberação de edição no Word instalado', null, 'EDIT_REQUEST');
        await tx.documentEditRequest.update({ where: { id: approvedRequest.id }, data: { versionId: revision.version.id } });
        return revision.document;
      });
    }
    if (!EDITABLE_STATUSES.has(editableDoc.status)) throw new ConflictException('Crie uma nova revisão para editar um documento vigente.');

    const file = await this.ensureEditableDocxFile(me, editableDoc);
    const session = this.editor.buildDesktopSession({
      documentId: id,
      fileId: file.id,
      fileName: file.fileName,
      companyId: me.companyId,
      userId: me.sub,
      userName: me.name,
      canWrite: true,
    });

    await this.prisma.documentEditorSession.create({
      data: {
        companyId: me.companyId,
        documentId: id,
        versionId: file.versionId ?? null,
        userId: me.sub,
        provider: 'word_desktop',
        status: 'OPEN',
        metadata: jsonOrNull({ fileId: file.id, mode: session.mode, dav: Boolean(session.davUrl), editRequestId: approvedRequest?.id ?? null }),
      },
    });
    if (editableDoc.contentFormat !== DocumentContentFormat.DOCX) {
      await this.prisma.document.update({ where: { id }, data: { contentFormat: DocumentContentFormat.DOCX } });
    }
    if (approvedRequest?.status === 'APPROVED') {
      await this.prisma.documentEditRequest.update({ where: { id: approvedRequest.id }, data: { status: 'IN_PROGRESS' } });
      this.workItems.markDirty(me.companyId, [approvedRequest.requesterUserId, approvedRequest.operatorUserId], 'document-edit-started-word');
    }
    return session;
  }

  /**
   * Garante um DOCX binario real (OOXML) para o editor de Word. Se o documento
   * só tinha conteúdo textual ou do editor visual, gera um .docx válido com o
   * conteúdo atual e o vincula à revisão corrente.
   */
  private async ensureEditableDocxFile(me: AuthPayload, doc: any) {
    const existing = await this.prisma.documentFile.findFirst({
      where: { companyId: me.companyId, documentId: doc.id, kind: DocumentFileKind.DOCX, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    // DOCX binario real = sem contentText e com chave de storage.
    if (existing && existing.contentText == null && existing.storageKey) return existing;
    const buffer = isDocNode(doc.contentJson) ? buildDocxFromDoc(doc.contentJson as any) : buildDocx(doc.content ?? existing?.contentText ?? '');
    const stored = await this.storage.putBinary(me.companyId, `documents/${doc.id}/editor`, `${doc.code ?? doc.number}.docx`, buffer, DOCX_MIME);
    return this.prisma.$transaction(async (tx) => {
      await assertDocumentUnchanged(tx, me.companyId, doc);
      const version = await this.ensureLatestVersionTx(tx, doc, me.sub);
      const item = await tx.documentFile.create({
        data: {
          companyId: me.companyId,
          documentId: doc.id,
          versionId: version.id,
          kind: DocumentFileKind.DOCX,
          protected: false,
          createdById: me.sub,
          contentText: null,
          ...stored,
        },
      });
      await tx.documentVersion.update({ where: { id: version.id }, data: { docxFileId: item.id } });
      await tx.document.update({ where: { id: doc.id }, data: { updatedAt: new Date() } });
      await this.auditTx(tx, me, doc.id, 'EDITOR_SEED', null, { fileId: item.id }, 'Geração de DOCX editável para o editor de Word');
      return item;
    });
  }

  // --------------------------- Host WOPI (editor online) e WebDAV (Word local)
  // Endpoints públicos validados pelo access_token assinado (sem JWT de usuário).

  private async wopiResolveFile(token: WopiTokenPayload) {
    const file = await this.prisma.documentFile.findFirst({
      where: { id: token.fileId, companyId: token.companyId, deletedAt: null },
    });
    if (!file) throw new NotFoundException('Arquivo não encontrado.');
    const doc = await this.prisma.document.findFirst({
      where: { id: file.documentId ?? token.documentId, companyId: token.companyId, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado.');
    return { file, doc };
  }

  /** WOPI CheckFileInfo: metadados que o editor usa para abrir o arquivo. */
  async wopiCheckFileInfo(token: WopiTokenPayload) {
    const { file, doc } = await this.wopiResolveFile(token);
    const editable = EDITABLE_STATUSES.has(doc.status) && token.canWrite;
    return {
      BaseFileName: file.fileName,
      Size: file.sizeBytes ?? 0,
      Version: file.hashSha256 ?? String(file.createdAt.getTime()),
      OwnerId: doc.ownerUserId ?? doc.createdById ?? 'system',
      UserId: token.userId,
      UserFriendlyName: token.userName || 'Usuário',
      UserCanWrite: editable,
      UserCanNotWriteRelative: true,
      SupportsUpdate: true,
      SupportsLocks: true,
      SupportsGetLock: true,
      LastModifiedTime: file.createdAt.toISOString(),
    };
  }

  /** WOPI GetFile: bytes do DOCX. Converte conteúdo legado em DOCX on-the-fly. */
  async wopiGetFile(token: WopiTokenPayload): Promise<Buffer> {
    const { file } = await this.wopiResolveFile(token);
    if (file.contentText != null) return buildDocx(file.contentText);
    return this.storage.readBinary(file.storageKey);
  }

  /** WOPI PutFile: persiste a nova versão binária salva no editor. */
  async wopiPutFile(token: WopiTokenPayload, content: Buffer) {
    return this.saveEditedBinary(token, content, `Salvo via editor online (${this.editor.provider})`);
  }

  /** WebDAV PutFile: persiste a nova versão binária salva pelo Word instalado. */
  async webDavPutFile(token: WopiTokenPayload, content: Buffer) {
    return this.saveEditedBinary(token, content, 'Salvo via Word instalado (WebDAV)');
  }

  private async saveEditedBinary(token: WopiTokenPayload, content: Buffer, reason: string) {
    const { file, doc } = await this.wopiResolveFile(token);
    if (!token.canWrite || !EDITABLE_STATUSES.has(doc.status)) {
      throw new ConflictException('Documento bloqueado para edição.');
    }
    if (!isDocxBuffer(content)) throw new ConflictException('O arquivo salvo não é um .docx válido.');
    if (docxHasMacros(content)) throw new ConflictException('Arquivos com macros não são aceitos.');
    const stored = await this.storage.putBinary(token.companyId, `documents/${doc.id}/editor`, file.fileName, content, DOCX_MIME);
    await this.prisma.$transaction(async (tx) => {
      await assertDocumentUnchanged(tx, token.companyId, doc);
      await tx.documentFile.update({
        where: { id: file.id },
        data: {
          storageProvider: stored.storageProvider,
          storageKey: stored.storageKey,
          sizeBytes: stored.sizeBytes,
          hashSha256: stored.hashSha256,
          mimeType: DOCX_MIME,
          contentText: null,
        },
      });
      await tx.documentAutosaveCheckpoint.create({
        data: { companyId: token.companyId, documentId: doc.id, versionId: file.versionId, userId: token.userId, fileId: file.id, checksum: stored.hashSha256 },
      });
      await tx.documentAuditLog.create({
        data: {
          companyId: token.companyId,
          documentId: doc.id,
          userId: token.userId,
          action: 'EDITOR_SAVE',
          afterValue: jsonOrNull({ fileId: file.id, size: stored.sizeBytes, hash: stored.hashSha256 }),
          reason,
        },
      });
      await tx.documentEditRequest.updateMany({
        where: {
          companyId: token.companyId,
          documentId: doc.id,
          requesterUserId: token.userId,
          status: { in: ['APPROVED', 'IN_PROGRESS'] },
        },
        data: { status: 'IN_PROGRESS' },
      });
      await tx.document.update({ where: { id: doc.id }, data: { contentFormat: DocumentContentFormat.DOCX, updatedAt: new Date() } });
    });
    await this.content.syncText(doc.id);
    this.workItems.markDirty(token.companyId, [token.userId], 'document-editor-save');
    return { version: stored.hashSha256 };
  }

  // ------------------------------------------------------------------ arquivos

  /** Upload legado (base64 no JSON). */
  async uploadFile(me: AuthPayload, id: string, body: any) {
    const base64 = this.nullableText(body?.contentBase64);
    const kind = this.parseFileKind(body?.kind);
    if (!base64) {
      // Modo texto: mantido por retrocompatibilidade.
      const doc = await this.loadVisible(me, id);
      await this.assertWriteArea(me, this.areaOf(doc), 'edit');
      const fileName = this.requiredText(body?.fileName, 'Nome do arquivo');
      const contentText = this.requiredText(body?.content, 'Conteúdo do arquivo');
      const latest = await this.ensureLatestVersion(doc, me.sub);
      const stored = await this.storage.putText(me.companyId, `documents/${doc.id}/uploads`, fileName, contentText, this.nullableText(body?.mimeType) ?? mimeFor(kind));
      return this.prisma.documentFile.create({ data: { companyId: me.companyId, documentId: doc.id, versionId: latest.id, kind, protected: false, createdById: me.sub, contentText, ...stored } });
    }
    const buffer = decodeBase64(base64);
    if (buffer.length > MAX_BASE64_BYTES) throw new BadRequestException('Arquivo excede o limite de 8 MB. Use o envio de arquivo.');
    const purpose = kind === DocumentFileKind.DOCX ? 'MAIN_DOCX' : kind === DocumentFileKind.PDF ? 'MAIN_PDF' : kind;
    return this.uploadBuffer(me, id, { purpose, fileName: this.requiredText(body?.fileName, 'Nome do arquivo'), mimeType: this.nullableText(body?.mimeType), buffer, reason: this.nullableText(body?.reason) });
  }

  /** Upload por arquivo (multipart), validado pelo conteúdo e guardado no banco. */
  async uploadBuffer(me: AuthPayload, id: string, input: UploadInput) {
    const doc = await this.loadVisible(me, id);
    await this.assertWriteArea(me, this.areaOf(doc), 'edit');
    const purpose = String(input.purpose ?? 'ATTACHMENT').toUpperCase();
    if (!UPLOAD_PURPOSES.has(purpose)) throw new BadRequestException('Finalidade do arquivo inválida.');
    const buffer = input.buffer;
    if (!buffer?.length) throw new BadRequestException('Arquivo vazio.');
    if (buffer.length > MAX_UPLOAD_BYTES) throw new BadRequestException('Arquivo excede o limite de 20 MB.');
    const fileName = this.requiredText(input.fileName, 'Nome do arquivo');
    const isPdf = buffer.subarray(0, 5).toString('latin1') === '%PDF-';
    const isPng = buffer.length > 8 && buffer.readUInt32BE(0) === 0x89504e47;
    const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    let kind: DocumentFileKind = DocumentFileKind.ATTACHMENT;
    let mimeType = input.mimeType || 'application/octet-stream';
    if (purpose === 'MAIN_DOCX') {
      if (!EDITABLE_STATUSES.has(doc.status)) throw new ConflictException('O Word editável só pode ser trocado em elaboração ou ajustes.');
      await this.assertCanEditContent(me, doc);
      if (!isDocxBuffer(buffer)) throw new BadRequestException('Arquivo inválido: envie um .docx (Word/LibreOffice) válido.');
      if (docxHasMacros(buffer)) throw new BadRequestException('Arquivos com macros não são aceitos. Salve como .docx comum e envie de novo.');
      kind = DocumentFileKind.DOCX;
      mimeType = DOCX_MIME;
    } else if (purpose === 'MAIN_PDF') {
      if (!EDITABLE_STATUSES.has(doc.status)) throw new ConflictException('O PDF principal só pode ser trocado em elaboração ou ajustes.');
      await this.assertCanEditContent(me, doc);
      if (!isPdf) throw new BadRequestException('Arquivo inválido: envie um PDF válido.');
      kind = DocumentFileKind.ATTACHMENT;
      mimeType = PDF_MIME;
    } else if (purpose === 'IMAGE') {
      if (!isPng && !isJpeg) throw new BadRequestException('Envie uma imagem PNG ou JPEG.');
      kind = DocumentFileKind.IMAGE;
      mimeType = isPng ? 'image/png' : 'image/jpeg';
    } else {
      const allowed = isPdf || isPng || isJpeg || isDocxBuffer(buffer) || /\.(txt|csv|xlsx|pptx)$/i.test(fileName);
      if (!allowed) throw new BadRequestException('Tipo de arquivo não aceito. Envie PDF, imagem, Word, planilha ou texto.');
      if (isDocxBuffer(buffer) && docxHasMacros(buffer)) throw new BadRequestException('Arquivos com macros não são aceitos.');
      kind = purpose === 'EVIDENCE' ? DocumentFileKind.EVIDENCE : DocumentFileKind.ATTACHMENT;
      if (isPdf) mimeType = PDF_MIME;
      else if (isPng) mimeType = 'image/png';
      else if (isJpeg) mimeType = 'image/jpeg';
    }
    const latest = await this.ensureLatestVersion(doc, me.sub);
    const stored = await this.storage.putBinary(me.companyId, `documents/${doc.id}/uploads`, fileName, buffer, mimeType);
    // O PDF principal ("PDF pronto") fica marcado como protegido para não se
    // confundir com anexos em PDF comuns.
    const isMainPdf = purpose === 'MAIN_PDF';
    const file = await this.prisma.$transaction(async (tx) => {
      await assertDocumentUnchanged(tx, me.companyId, doc);
      const item = await tx.documentFile.create({
        data: { companyId: me.companyId, documentId: doc.id, versionId: latest.id, kind, protected: isMainPdf, createdById: me.sub, contentText: null, ...stored },
      });
      if (purpose === 'MAIN_DOCX') {
        await tx.documentVersion.update({ where: { id: latest.id }, data: { docxFileId: item.id } });
        await tx.document.update({ where: { id: doc.id }, data: { contentFormat: DocumentContentFormat.DOCX } });
      }
      if (isMainPdf) {
        await tx.documentFile.updateMany({ where: { documentId: doc.id, versionId: latest.id, kind: DocumentFileKind.ATTACHMENT, mimeType: PDF_MIME, protected: true, id: { not: item.id }, deletedAt: null }, data: { deletedAt: new Date() } });
        await tx.document.update({ where: { id: doc.id }, data: { contentFormat: DocumentContentFormat.FILE } });
      }
      await this.auditTx(tx, me, doc.id, 'UPLOAD_FILE', null, { fileId: item.id, kind, purpose, size: buffer.length }, input.reason ?? 'Upload de arquivo');
      return item;
    });
    if (purpose === 'MAIN_DOCX' || purpose === 'MAIN_PDF') await this.content.syncText(doc.id);
    return file;
  }

  async downloadFile(me: AuthPayload, id: string, fileId: string, context?: { ip?: string; userAgent?: string }, options: { inline?: boolean } = {}) {
    const doc = await this.loadVisible(me, id);
    const file = await this.prisma.documentFile.findFirst({ where: { id: fileId, documentId: id, companyId: me.companyId, deletedAt: null } });
    if (!file) throw new NotFoundException('Arquivo não encontrado.');
    if (file.kind === DocumentFileKind.DOCX) {
      const caps = await this.capabilities(me, doc);
      if (!caps.canDownloadDocx) throw new ForbiddenException('O Word editável é restrito a quem trabalha no documento. Baixe o PDF oficial.');
    }
    // Arquivos legados guardam o texto em contentText; arquivos binarios ficam
    // no storage. Para DOCX e PDF legados, converte o texto em arquivo real.
    let content: Buffer;
    if (file.contentText != null && file.kind === DocumentFileKind.DOCX) {
      content = buildDocx(file.contentText);
    } else if (file.contentText != null && file.kind === DocumentFileKind.PDF) {
      content = buildPdf(file.contentText);
    } else if (file.contentText != null) {
      content = Buffer.from(file.contentText, 'utf8');
    } else {
      content = await this.storage.readBinary(file.storageKey);
    }
    const isPdf = (file.mimeType ?? '').includes('pdf') || file.kind === DocumentFileKind.PDF;
    if (isPdf && !options.inline) content = await this.render.downloadCopy(content, me.name || me.email || 'Usuário');
    await this.prisma.$transaction(async (tx) => {
      if (options.inline) {
        await tx.documentViewLog.create({ data: { companyId: me.companyId, documentId: id, versionId: file.versionId, fileId: file.id, userId: me.sub, origin: 'VIEWER', ip: context?.ip, userAgent: context?.userAgent?.slice(0, 500) } });
      } else {
        await tx.documentDownloadLog.create({
          data: { companyId: me.companyId, documentId: id, versionId: file.versionId, fileId: file.id, userId: me.sub, ip: context?.ip, userAgent: context?.userAgent?.slice(0, 500) },
        });
        await this.auditTx(tx, me, id, 'DOWNLOAD', null, { fileId: file.id, kind: file.kind }, 'Download controlado', context);
      }
    });
    return { file, content, mimeType: file.mimeType ?? mimeFor(file.kind) };
  }

  /** PDF oficial da revisão vigente (ou da revisão em análise, para quem participa). */
  async officialPdf(me: AuthPayload, id: string, context: { ip?: string; userAgent?: string } = {}, options: { inline?: boolean } = {}) {
    const doc = await this.loadVisible(me, id);
    const version = await this.prisma.documentVersion.findFirst({
      where: { documentId: id, companyId: me.companyId, deletedAt: null, pdfFileId: { not: null } },
      orderBy: { revisionNumber: 'desc' },
    });
    if (!version?.pdfFileId) throw new NotFoundException('Este documento ainda não tem PDF oficial publicado.');
    return this.downloadFile(me, doc.id, version.pdfFileId, context, options);
  }

  /** Prévia em PDF do conteúdo atual (sem valor oficial). */
  async previewPdf(me: AuthPayload, id: string) {
    const doc = await this.loadVisible(me, id);
    const version = await this.ensureLatestVersion(doc, me.sub);
    const signatures = await this.render.signatures(me.companyId, doc.id, version.id);
    const result = await this.render.officialPdf({ doc: { ...doc, status: doc.status }, version: { ...version, contentJson: null }, signatures });
    const content = await this.render.downloadCopy(result.buffer, `PRÉVIA · ${me.name || 'Usuário'}`);
    return { content, fileName: `${doc.code ?? doc.number}-previa.pdf`, mimeType: PDF_MIME };
  }

  async exportDocx(me: AuthPayload, id: string, context: { ip?: string; userAgent?: string } = {}) {
    const doc = await this.loadVisible(me, id);
    const caps = await this.capabilities(me, doc);
    if (!caps.canDownloadDocx) throw new ForbiddenException('O Word editável é restrito a quem trabalha no documento. Baixe o PDF oficial.');
    const version = await this.ensureLatestVersion(doc, me.sub);
    const result = await this.render.exportDocx(doc, version);
    await this.prisma.documentDownloadLog.create({ data: { companyId: me.companyId, documentId: id, versionId: version.id, userId: me.sub, action: 'EXPORT_DOCX', ip: context.ip, userAgent: context.userAgent?.slice(0, 500) } });
    return { ...result, mimeType: DOCX_MIME };
  }

  /** Modo leitura: revisão vigente para o chão de fábrica (QR Code). */
  async reader(me: AuthPayload, id: string, context: { ip?: string; userAgent?: string } = {}) {
    const doc = await this.loadVisible(me, id);
    const version = await this.distribution.currentPublishedVersion(me.companyId, id);
    const participant = (await this.capabilities(me, doc)).canEditMetadata;
    if (!version && !participant) throw new NotFoundException('Este documento ainda não tem revisão vigente.');
    const source = version ?? (await this.ensureLatestVersion(doc, me.sub));
    const structured = isDocNode(source.contentJson) ? source.contentJson : doc.contentFormat === DocumentContentFormat.STRUCTURED && !version ? doc.contentJson : null;
    await this.prisma.documentViewLog.create({ data: { companyId: me.companyId, documentId: id, versionId: source.id, userId: me.sub, origin: 'READER', ip: context.ip, userAgent: context.userAgent?.slice(0, 500) } });
    const distribution = await this.distribution.summary(me.companyId, doc, me.sub);
    return {
      id: doc.id,
      code: doc.code,
      number: doc.number,
      title: doc.title,
      description: doc.description,
      status: doc.status,
      confidentiality: doc.confidentiality,
      contentFormat: doc.contentFormat,
      typeConfig: doc.typeConfig,
      orgNode: doc.orgNode,
      owner: doc.owner,
      validUntil: doc.validUntil,
      publishedAt: doc.publishedAt,
      current: Boolean(version),
      version: { id: source.id, label: source.versionLabel, publicationDate: source.publicationDate, changeSummary: source.changeSummary, pdfFileId: source.pdfFileId },
      contentJson: structured,
      bodyText: structured ? null : source.bodyText ?? doc.bodyText ?? doc.content,
      readRequired: doc.readRequired,
      myRead: distribution.mine,
    };
  }

  /** Texto de duas revisões para a comparação (a do meio pode ser a em elaboração). */
  async compare(me: AuthPayload, id: string, fromId?: string, toId?: string) {
    const doc = await this.loadVisible(me, id);
    const versions = await this.prisma.documentVersion.findMany({ where: { documentId: id, companyId: me.companyId, deletedAt: null }, orderBy: { revisionNumber: 'desc' } });
    if (!versions.length) throw new NotFoundException('Documento sem revisões.');
    const textOf = async (version: (typeof versions)[number], isLatest: boolean) => {
      if (version.bodyText) return version.bodyText;
      if (isLatest) return this.content.currentBodyText(doc);
      if (isDocNode(version.contentJson)) return docToPlainText(version.contentJson as DocNode);
      return '';
    };
    const to = toId ? versions.find((item) => item.id === toId) : versions[0];
    const from = fromId ? versions.find((item) => item.id === fromId) : versions.find((item) => to && item.revisionNumber < to.revisionNumber);
    if (!to) throw new NotFoundException('Revisão não encontrada.');
    return {
      from: from ? { id: from.id, label: from.versionLabel, text: await textOf(from, from.id === versions[0].id) } : null,
      to: { id: to.id, label: to.versionLabel, text: await textOf(to, to.id === versions[0].id), changeSummary: to.changeSummary },
      versions: versions.map((item) => ({ id: item.id, label: item.versionLabel, status: item.status, publicationDate: item.publicationDate })),
    };
  }

  async aiSummary(me: AuthPayload, id: string, body: any = {}) {
    const doc = await this.loadVisible(me, id);
    const data = await this.compare(me, id, this.id(body?.fromId) ?? undefined, this.id(body?.toId) ?? undefined);
    if (!data.from) return { summary: 'Esta é a primeira revisão do documento: não há revisão anterior para comparar.', usedAi: false, stats: { inserted: 0, deleted: 0, unchanged: 0 } };
    return this.ai.summarizeChanges(doc, data.from.text, data.to.text, { from: data.from.label, to: data.to.label });
  }

  async aiCheck(me: AuthPayload, id: string) {
    const doc = await this.loadVisible(me, id);
    const json = isDocNode(doc.contentJson) ? (doc.contentJson as DocNode) : markdownToDoc(await this.content.currentBodyText(doc));
    const text = docToPlainText(json);
    return this.ai.qualityCheck(doc, doc.typeConfig?.sigla ?? null, json, text);
  }

  async aiDraft(me: AuthPayload, body: any) {
    if (!(await this.accessPolicy.has(me, 'doc:create'))) throw new ForbiddenException('Você não pode criar documentos.');
    return this.ai.draftFromProcess(me, body);
  }

  // --------------------------------------------------------- leitura/comentário

  async addComment(me: AuthPayload, id: string, body: any) {
    const doc = await this.loadVisible(me, id);
    const mentionIds = this.ids(body?.mentionUserIds).slice(0, 20);
    if (mentionIds.length) await this.validateAudience(me.companyId, { userIds: mentionIds });
    const comment = await this.prisma.documentComment.create({
      data: {
        companyId: me.companyId,
        documentId: id,
        versionId: this.id(body?.versionId),
        parentId: this.id(body?.parentId),
        userId: me.sub,
        body: this.requiredText(body?.body, 'Comentário').slice(0, 5000),
      },
    });
    if (mentionIds.length) {
      await this.prisma.documentCommentMention.createMany({ data: mentionIds.map((userId) => ({ commentId: comment.id, userId })), skipDuplicates: true });
      for (const userId of mentionIds.filter((item) => item !== me.sub)) {
        try {
          await this.notifications.create(me.companyId, userId, NotificationKind.MENTION, `${me.name} mencionou você em ${label(doc)}`.slice(0, 180), comment.body.slice(0, 300), `/documents/${doc.id}`);
        } catch {
          // best-effort
        }
      }
    }
    await this.audit(me, id, 'COMMENT', null, { commentId: comment.id, mentions: mentionIds.length }, 'Comentário interno');
    return comment;
  }

  async confirmRead(me: AuthPayload, id: string, _body: any = {}, context: { ip?: string; userAgent?: string } = {}) {
    const doc = await this.loadVisible(me, id);
    return this.distribution.confirm(me, doc, context);
  }

  // ---------------------------------------------------------------- vencimento

  async runExpirationJob(me: AuthPayload) {
    return this.expirationSweep(me.companyId, me.sub);
  }

  /**
   * Rotina de vencimento (manual ou pela manutenção): PUBLISHED ->
   * NEAR_EXPIRATION (dentro do prazo de alerta do tipo) -> EXPIRED, avisando
   * responsável e aprovador. `actorUserId` null = execução automática.
   */
  async expirationSweep(companyId: string, actorUserId: string | null = null) {
    const now = new Date();
    const actor = { companyId, sub: actorUserId } as unknown as AuthPayload;
    const docs = await this.prisma.document.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: [DocumentStatus.PUBLISHED, DocumentStatus.NEAR_EXPIRATION] },
        validUntil: { not: null },
      },
      include: this.include(),
      take: 1000,
    });
    let processed = 0;
    for (const doc of docs) {
      const validUntil = doc.validUntil!;
      const alertDays = doc.typeConfig?.alertDays ?? 30;
      const to = validUntil < now ? DocumentStatus.EXPIRED : validUntil <= addDays(now, alertDays) ? DocumentStatus.NEAR_EXPIRATION : null;
      if (!to || doc.status === to) continue;
      await this.prisma.$transaction(async (tx) => {
        await tx.document.update({ where: { id: doc.id }, data: { status: to } });
        await this.recordStatusTx(tx, actor, doc.id, doc.status, to, 'Atualização automática de vencimento');
        await this.auditTx(tx, actor, doc.id, 'EXPIRATION_JOB', { status: doc.status }, { status: to }, 'Rotina de vencimento');
      });
      await this.notifyExpiration(doc, to, validUntil);
      processed++;
    }
    return { processed, checked: docs.length, startedAt: now, finishedAt: new Date() };
  }

  /** Avisa responsável e aprovador na transição de vencimento (best-effort). */
  private async notifyExpiration(doc: any, to: DocumentStatus, validUntil: Date) {
    const code = doc.code ?? `#${doc.number}`;
    const date = validUntil.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const title = to === DocumentStatus.EXPIRED ? `Documento vencido: ${code}` : `Documento próximo do vencimento: ${code}`;
    const body =
      to === DocumentStatus.EXPIRED
        ? `"${doc.title}" venceu em ${date}. Inicie a revisão periódica ou torne-o obsoleto.`
        : `"${doc.title}" vence em ${date}. Planeje a revisão periódica.`;
    const recipients = [...new Set([doc.ownerUserId, doc.createdById, doc.approverUserId].filter(Boolean))] as string[];
    for (const userId of recipients) {
      try {
        await this.notifications.create(doc.companyId, userId, NotificationKind.MESSAGE, title, body, `/documents/${doc.id}`);
      } catch {
        // Notificação é best-effort: a transição de status não pode falhar por causa dela.
      }
    }
  }

  async diagnostics(me: AuthPayload) {
    const [documents, withoutFiles, pendingPdfs, files, usage] = await Promise.all([
      this.prisma.document.count({ where: { companyId: me.companyId, deletedAt: null } }),
      this.prisma.document.count({
        where: { companyId: me.companyId, deletedAt: null, contentFormat: { in: [DocumentContentFormat.DOCX, DocumentContentFormat.FILE] }, files: { none: { deletedAt: null } } },
      }),
      this.prisma.documentVersion.count({
        where: { companyId: me.companyId, deletedAt: null, status: DocumentStatus.PUBLISHED, pdfFileId: null },
      }),
      this.prisma.documentFile.count({ where: { companyId: me.companyId, deletedAt: null } }),
      this.storage.usage(me.companyId),
    ]);
    return {
      documents,
      files,
      withoutFiles,
      pendingPdfs,
      storage: { ...usage, configured: true },
      editor: this.editor.status(),
      converter: { available: Boolean(this.render.converterUrl()) },
      generatedAt: new Date(),
    };
  }

  // ------------------------------------------------------------ edição: apoio

  private async loadEditRequest(companyId: string, requestId: string) {
    const request = await this.prisma.documentEditRequest.findFirst({
      where: { id: requestId, companyId },
      include: {
        document: { include: this.include() },
        requester: { select: { id: true, name: true, email: true } },
        operator: { select: { id: true, name: true, email: true } },
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!request) throw new NotFoundException('Solicitação de edição não encontrada.');
    return request;
  }

  private async resolveEditOperator(me: AuthPayload, doc: any, explicitUserId: unknown): Promise<string> {
    const requested = this.id(explicitUserId);
    const candidate = requested ?? [doc.ownerUserId, doc.createdById, doc.approverUserId, me.sub].find(Boolean);
    if (!candidate) throw new BadRequestException('Defina um operador para liberar a edição.');
    const user = await this.prisma.user.findFirst({
      where: { id: candidate, companyId: me.companyId, deletedAt: null, active: true, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Operador não encontrado ou inativo.');
    return user.id;
  }

  private async assertCanOperateDocumentEdit(me: AuthPayload, doc: any) {
    if (doc.ownerUserId === me.sub || doc.createdById === me.sub) return;
    if (await this.accessPolicy.isManager(me)) return;
    const area = this.areaOf(doc);
    if (area) {
      try {
        await this.access.assertCanWrite(me.sub, area, MODULE, 'edit');
        if (await this.accessPolicy.has(me, 'doc:update')) return;
      } catch {
        // segue para Forbidden abaixo
      }
    }
    throw new ForbiddenException('Você não pode liberar edição deste documento.');
  }

  private async assertCanDecideEditRequest(me: AuthPayload, request: any) {
    if (request.operatorUserId === me.sub) return;
    await this.assertCanOperateDocumentEdit(me, request.document);
  }

  private async findApprovedEditRequest(me: AuthPayload, documentId: string) {
    return this.prisma.documentEditRequest.findFirst({
      where: {
        companyId: me.companyId,
        documentId,
        requesterUserId: me.sub,
        status: { in: APPROVED_EDIT_REQUEST_STATUSES },
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      orderBy: { approvedAt: 'desc' },
    });
  }

  private assertEditableMetadata(doc: any, patch: any) {
    if (EDITABLE_STATUSES.has(doc.status)) return;
    // Bloqueia apenas mudanças reais: o formulário envia todos os campos e
    // reenviar o valor atual (ex.: só trocar validade) é permitido.
    const restricted = ['title', 'code', 'description', 'type', 'content', 'externalUrl'];
    const normalize = (value: unknown) => {
      const text = String(value ?? '').trim();
      return text || null;
    };
    const changed = restricted.some(
      (field) => field in (patch ?? {}) && normalize(patch[field]) !== normalize(doc[field]),
    );
    if (changed) {
      throw new ConflictException('Documento bloqueado. Crie uma nova revisão para alterar conteúdo ou metadados principais.');
    }
  }

  private async validateLinks(companyId: string, input: LinkInput) {
    const ids = {
      orgNodeId: input.orgNodeId ?? null,
      indicatorId: input.indicatorId ?? null,
      ownerUserId: input.ownerUserId ?? null,
      approverUserId: input.approverUserId ?? null,
    };
    const areas: string[] = [];

    if (ids.orgNodeId) {
      const orgNode = await this.prisma.orgNode.findFirst({ where: { id: ids.orgNodeId, companyId, deletedAt: null }, select: { id: true } });
      if (!orgNode) throw new NotFoundException('Área ou processo não encontrado');
      areas.push(orgNode.id);
    }
    if (ids.indicatorId) {
      const indicator = await this.prisma.indicator.findFirst({ where: { id: ids.indicatorId, companyId, deletedAt: null }, select: { ownerNodeId: true } });
      if (!indicator) throw new NotFoundException('Indicador não encontrado');
      if (indicator.ownerNodeId) areas.push(indicator.ownerNodeId);
    }
    for (const userId of [ids.ownerUserId, ids.approverUserId]) {
      if (!userId) continue;
      const user = await this.prisma.user.findFirst({ where: { id: userId, companyId, deletedAt: null, active: true }, select: { id: true } });
      if (!user) throw new NotFoundException('Usuário (responsável/aprovador) não encontrado');
    }

    const uniqueAreas = Array.from(new Set(areas.filter(Boolean)));
    if (uniqueAreas.length > 1) {
      throw new ConflictException('Vínculos do documento pertencem a áreas diferentes.');
    }
    return { ids, area: uniqueAreas[0] ?? null };
  }

  private async ensureLatestVersion(doc: any, userId: string) {
    return this.prisma.$transaction((tx) => this.ensureLatestVersionTx(tx, doc, userId));
  }

  private async ensureLatestVersionTx(tx: Tx, doc: any, userId: string) {
    const version = await tx.documentVersion.findFirst({
      where: { documentId: doc.id, companyId: doc.companyId, deletedAt: null },
      orderBy: { revisionNumber: 'desc' },
    });
    if (version) return version;
    return tx.documentVersion.create({
      data: {
        companyId: doc.companyId,
        documentId: doc.id,
        revisionNumber: 0,
        versionLabel: 'Rev. 00',
        status: doc.status,
        changeReason: doc.changeNote ?? 'Registro legado',
        changeSummary: doc.changeNote,
        expirationDate: doc.validUntil,
        createdById: userId,
      },
    });
  }

  private async recordStatusTx(
    tx: Tx,
    me: AuthPayload,
    documentId: string,
    from: DocumentStatus | string | null,
    to: DocumentStatus | string,
    comment?: string | null,
    metadata?: Record<string, unknown>,
  ) {
    await tx.documentStatusHistory.create({
      data: {
        companyId: me.companyId,
        documentId,
        userId: me.sub,
        statusFrom: from,
        statusTo: to,
        comment,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  private async audit(me: AuthPayload, documentId: string, action: string, beforeValue: unknown, afterValue: unknown, reason?: string | null) {
    await this.prisma.documentAuditLog.create({
      data: {
        companyId: me.companyId,
        documentId,
        userId: me.sub,
        action,
        beforeValue: jsonOrNull(beforeValue),
        afterValue: jsonOrNull(afterValue),
        reason,
      },
    });
  }

  private async auditTx(
    tx: Tx,
    me: AuthPayload,
    documentId: string,
    action: string,
    beforeValue: unknown,
    afterValue: unknown,
    reason?: string | null,
    context?: { ip?: string; userAgent?: string },
  ) {
    await tx.documentAuditLog.create({
      data: {
        companyId: me.companyId,
        documentId,
        userId: me.sub,
        action,
        beforeValue: jsonOrNull(beforeValue),
        afterValue: jsonOrNull(afterValue),
        reason,
        ip: context?.ip,
        userAgent: context?.userAgent,
      },
    });
  }
}

export { summarize };

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function renderDocxText(doc: any, revision: string) {
  return generatedDocumentBody(doc.title, doc.code ?? `#${doc.number}`, revision, doc.description ?? '', doc.content ?? '');
}

function generatedDocumentBody(title: string, code: string, revision: string, description = '', content = '') {
  return [
    `Código: ${code}`,
    `Título: ${title}`,
    `Revisão: ${revision}`,
    `Data: ${new Date().toISOString().slice(0, 10)}`,
    '',
    description,
    '',
    content || 'Conteúdo inicial do documento.',
  ].join('\n');
}

function defaultTemplateContent() {
  return [
    '{{company_name}}',
    '{{document_code}} - {{document_title}}',
    'Revisão: {{revision}}',
    'Autor: {{author_name}}',
    'Responsável: {{responsible_name}}',
    '',
    '{{revision_history}}',
    '',
    'Conteúdo do documento...',
  ].join('\n');
}

function defaultPlaceholders() {
  return [
    '{{document_code}}',
    '{{document_title}}',
    '{{document_type}}',
    '{{revision}}',
    '{{company_name}}',
    '{{company_logo}}',
    '{{unit_name}}',
    '{{area_name}}',
    '{{process_name}}',
    '{{author_name}}',
    '{{responsible_name}}',
    '{{approver_name}}',
    '{{publication_date}}',
    '{{expiration_date}}',
    '{{page_number}}',
    '{{total_pages}}',
    '{{qr_code}}',
    '{{revision_history}}',
  ];
}

function mimeFor(kind: DocumentFileKind) {
  if (kind === DocumentFileKind.DOCX || kind === DocumentFileKind.TEMPLATE) return DOCX_MIME;
  if (kind === DocumentFileKind.PDF) return PDF_MIME;
  return 'text/plain';
}

/**
 * DocumentTemplate nao tem a coluna storageProvider (so DocumentFile tem);
 * espalhar o StoredDocumentFile inteiro no create/update do template causava
 * PrismaClientValidationError (500 visto em producao no import de .docx).
 */
function templateStorage(stored: StoredDocumentFile) {
  return {
    storageKey: stored.storageKey,
    fileName: stored.fileName,
    mimeType: stored.mimeType,
    sizeBytes: stored.sizeBytes,
    hashSha256: stored.hashSha256,
  };
}

/** Decodifica base64 (aceita data URL) validando o formato. */
function decodeBase64(value: string): Buffer {
  const clean = value.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  if (!clean || !/^[A-Za-z0-9+/]+=*$/.test(clean)) {
    throw new BadRequestException('Arquivo em base64 inválido.');
  }
  return Buffer.from(clean, 'base64');
}

function jsonOrNull(value: unknown) {
  if (value === null || value === undefined) return Prisma.JsonNull;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return { value: String(value) };
  }
}
