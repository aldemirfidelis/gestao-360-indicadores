import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentApprovalDecision,
  DocumentFileKind,
  DocumentStatus,
  DocumentType,
  NotificationKind,
  Prisma,
  TraceEntityType,
  TraceEventType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TraceabilityService } from '../traceability/traceability.service';
import { AccessService } from '../access/access.service';
import type { AreaAction } from '../access/access.logic';
import { AuthPayload } from '../auth/auth.types';
import { DocumentCodeService } from './document-code.service';
import { DocumentEditorService, WopiTokenPayload } from './document-editor.service';
import { DocumentStorageService, sha256 } from './document-storage.service';
import {
  applyDocxPlaceholders,
  applyTextPlaceholders,
  buildDocx,
  detectPlaceholders,
  extractDocxText,
  isDocxBuffer,
} from './docx.util';
import { buildPdf } from './pdf.util';
import { TEMPLATE_LIBRARY, findLibraryTemplate } from './template-library';
import { WorkItemEventBus } from '../my-day/work-item-event-bus';
import { NotificationsService } from '../notifications/notifications.service';

const MODULE = 'documents';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME = 'application/pdf';
// Uploads chegam em base64 no JSON (limite do body: 10mb); ~8MB decodificados.
const MAX_FILE_BYTES = 8 * 1024 * 1024;

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
};

type LinkInput = {
  orgNodeId?: string | null;
  indicatorId?: string | null;
  ownerUserId?: string | null;
  approverUserId?: string | null;
};

const DIRECT_STATUS_MESSAGE = 'Use as acoes de workflow para alterar o status do documento.';

const EDITABLE_STATUSES = new Set<DocumentStatus>([
  DocumentStatus.DRAFT,
  DocumentStatus.IN_DEVELOPMENT,
  DocumentStatus.ADJUSTMENTS_REQUESTED,
  DocumentStatus.REJECTED,
]);

const ACTIVE_EDIT_REQUEST_STATUSES = ['REQUESTED', 'APPROVED', 'IN_PROGRESS'];
const APPROVED_EDIT_REQUEST_STATUSES = ['APPROVED', 'IN_PROGRESS'];

const COMMENT_REQUIRED = new Set<DocumentStatus>([
  DocumentStatus.ADJUSTMENTS_REQUESTED,
  DocumentStatus.REJECTED,
  DocumentStatus.CANCELLED,
  DocumentStatus.ARCHIVED,
  DocumentStatus.OBSOLETE,
]);

const TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  [DocumentStatus.DRAFT]: [DocumentStatus.IN_DEVELOPMENT, DocumentStatus.WAITING_REVIEW, DocumentStatus.CANCELLED],
  [DocumentStatus.IN_DEVELOPMENT]: [DocumentStatus.WAITING_REVIEW, DocumentStatus.CANCELLED],
  [DocumentStatus.WAITING_REVIEW]: [DocumentStatus.IN_REVIEW, DocumentStatus.ADJUSTMENTS_REQUESTED, DocumentStatus.CANCELLED],
  [DocumentStatus.REVIEW]: [DocumentStatus.ADJUSTMENTS_REQUESTED, DocumentStatus.REVIEWED, DocumentStatus.REJECTED],
  [DocumentStatus.IN_REVIEW]: [DocumentStatus.ADJUSTMENTS_REQUESTED, DocumentStatus.REVIEWED, DocumentStatus.REJECTED],
  [DocumentStatus.ADJUSTMENTS_REQUESTED]: [DocumentStatus.IN_DEVELOPMENT, DocumentStatus.WAITING_REVIEW, DocumentStatus.CANCELLED],
  [DocumentStatus.REVIEWED]: [DocumentStatus.WAITING_APPROVAL, DocumentStatus.IN_APPROVAL],
  [DocumentStatus.WAITING_APPROVAL]: [DocumentStatus.IN_APPROVAL, DocumentStatus.REJECTED],
  [DocumentStatus.IN_APPROVAL]: [DocumentStatus.APPROVED, DocumentStatus.REJECTED],
  [DocumentStatus.REJECTED]: [DocumentStatus.IN_DEVELOPMENT, DocumentStatus.CANCELLED],
  [DocumentStatus.APPROVED]: [DocumentStatus.SCHEDULED_PUBLICATION, DocumentStatus.PUBLISHED],
  [DocumentStatus.SCHEDULED_PUBLICATION]: [DocumentStatus.PUBLISHED, DocumentStatus.CANCELLED],
  [DocumentStatus.PUBLISHED]: [
    DocumentStatus.NEAR_EXPIRATION,
    DocumentStatus.EXPIRED,
    DocumentStatus.PERIODIC_REVIEW,
    DocumentStatus.OBSOLETE,
    DocumentStatus.ARCHIVED,
  ],
  [DocumentStatus.NEAR_EXPIRATION]: [DocumentStatus.PERIODIC_REVIEW, DocumentStatus.EXPIRED, DocumentStatus.OBSOLETE],
  [DocumentStatus.EXPIRED]: [DocumentStatus.PERIODIC_REVIEW, DocumentStatus.OBSOLETE, DocumentStatus.ARCHIVED],
  [DocumentStatus.PERIODIC_REVIEW]: [DocumentStatus.IN_DEVELOPMENT, DocumentStatus.REPLACED, DocumentStatus.OBSOLETE],
  [DocumentStatus.REPLACED]: [DocumentStatus.OBSOLETE, DocumentStatus.ARCHIVED],
  [DocumentStatus.OBSOLETE]: [DocumentStatus.ARCHIVED],
  [DocumentStatus.ARCHIVED]: [],
  [DocumentStatus.CANCELLED]: [],
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
    private readonly access: AccessService,
    private readonly codes: DocumentCodeService,
    private readonly editor: DocumentEditorService,
    private readonly storage: DocumentStorageService,
    private readonly workItems: WorkItemEventBus,
    private readonly notifications: NotificationsService,
  ) {}

  private include() {
    return {
      orgNode: { select: { id: true, name: true, type: true } },
      indicator: { select: { id: true, name: true, code: true, ownerNodeId: true } },
      owner: { select: { id: true, name: true, email: true } },
      approver: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    };
  }

  private areaOf(doc: any): string | null {
    return doc.orgNodeId ?? doc.orgNode?.id ?? doc.indicator?.ownerNodeId ?? null;
  }

  private async assertWriteArea(me: AuthPayload, area: string | null, action: AreaAction) {
    if (area) await this.access.assertCanWrite(me.sub, area, MODULE, action);
  }

  private async assertViewArea(me: AuthPayload, doc: any) {
    const area = this.areaOf(doc);
    if (!area) return;
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    if (permitted && !permitted.includes(area)) {
      throw new ForbiddenException('Você não tem acesso aos documentos desta área.');
    }
  }

  private enrich(doc: any) {
    const validUntil = doc.validUntil ? new Date(doc.validUntil) : null;
    const isPublishedLike = [
      DocumentStatus.PUBLISHED,
      DocumentStatus.NEAR_EXPIRATION,
      DocumentStatus.EXPIRED,
      DocumentStatus.PERIODIC_REVIEW,
    ].includes(doc.status);
    const isExpired = Boolean(validUntil && validUntil < new Date() && isPublishedLike);
    const daysToExpire = validUntil ? Math.ceil((validUntil.getTime() - Date.now()) / 86_400_000) : null;
    const alertWindow = doc.typeConfig?.alertDays ?? 30;
    const needsReview = Boolean(isPublishedLike && validUntil && !isExpired && daysToExpire !== null && daysToExpire <= alertWindow);
    return { ...doc, isExpired, needsReview, daysToExpire, areaId: this.areaOf(doc) };
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

  private requiredText(value: unknown, field: string) {
    const text = String(value ?? '').trim();
    if (!text) throw new BadRequestException(`${field} e obrigatório.`);
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

  private visibilityWhere(permitted: string[] | null) {
    if (!permitted) return undefined;
    return {
      OR: [
        { orgNodeId: null, indicatorId: null },
        { orgNodeId: { in: permitted } },
        { indicator: { ownerNodeId: { in: permitted } } },
      ],
    };
  }

  private async loadScoped(id: string, companyId: string, tx: Tx | PrismaService = this.prisma) {
    const doc = await tx.document.findFirst({
      where: { id, companyId, deletedAt: null },
      include: this.include(),
    });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    return doc;
  }

  async list(me: AuthPayload, filters: DocFilters = {}) {
    const status = this.parseStatus(filters.status);
    const type = this.parseType(filters.type);
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const and: Prisma.DocumentWhereInput[] = [];
    const areaFilter = this.visibilityWhere(permitted);
    if (areaFilter) and.push(areaFilter as Prisma.DocumentWhereInput);

    const term = filters.search?.trim();
    if (term) {
      and.push({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { code: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { content: { contains: term, mode: 'insensitive' } },
          { indicator: { name: { contains: term, mode: 'insensitive' } } },
        ],
      });
    }

    if (filters.expiring === 'expired') {
      and.push({ validUntil: { lt: new Date() }, status: { in: publishedLikeStatuses() } });
    }
    if (filters.expiring === 'soon') {
      const limit = new Date(Date.now() + 90 * 86_400_000);
      and.push({ validUntil: { gte: new Date(), lte: limit }, status: { in: publishedLikeStatuses() } });
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
        ...(and.length ? { AND: and } : {}),
      },
      include: this.include(),
      orderBy: [{ status: 'asc' }, { validUntil: 'asc' }, { number: 'desc' }],
    });

    return items.map((doc) => this.enrich(doc));
  }

  async summary(me: AuthPayload) {
    const list = await this.list(me);
    const byStatus = Object.fromEntries(Object.values(DocumentStatus).map((s) => [s, 0])) as Record<DocumentStatus, number>;
    const byType = Object.fromEntries(Object.values(DocumentType).map((t) => [t, 0])) as Record<DocumentType, number>;
    for (const doc of list as any[]) {
      byStatus[doc.status as DocumentStatus]++;
      byType[doc.type as DocumentType]++;
    }
    const expiringSoon = [...list]
      .filter((doc: any) => doc.needsReview || doc.isExpired)
      .sort((a: any, b: any) => {
        const ad = a.validUntil ? new Date(a.validUntil).getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b.validUntil ? new Date(b.validUntil).getTime() : Number.MAX_SAFE_INTEGER;
        return ad - bd;
      })
      .slice(0, 8)
      .map((doc: any) => ({
        id: doc.id,
        number: doc.number,
        code: doc.code,
        title: doc.title,
        type: doc.type,
        status: doc.status,
        validUntil: doc.validUntil,
        isExpired: doc.isExpired,
        daysToExpire: doc.daysToExpire,
        orgNode: doc.orgNode,
        owner: doc.owner,
      }));

    return {
      total: list.length,
      published: byStatus[DocumentStatus.PUBLISHED] ?? 0,
      draft:
        (byStatus[DocumentStatus.DRAFT] ?? 0) +
        (byStatus[DocumentStatus.IN_DEVELOPMENT] ?? 0) +
        (byStatus[DocumentStatus.REVIEW] ?? 0) +
        (byStatus[DocumentStatus.IN_REVIEW] ?? 0),
      waitingApproval: (byStatus[DocumentStatus.WAITING_APPROVAL] ?? 0) + (byStatus[DocumentStatus.IN_APPROVAL] ?? 0),
      obsolete: (byStatus[DocumentStatus.OBSOLETE] ?? 0) + (byStatus[DocumentStatus.ARCHIVED] ?? 0),
      expired: list.filter((doc: any) => doc.isExpired).length,
      needsReview: list.filter((doc: any) => doc.needsReview).length,
      byStatus,
      byType,
      expiringSoon,
    };
  }

  async dashboard(me: AuthPayload) {
    const items = (await this.list(me)) as any[];
    const byArea = new Map<string, number>();
    for (const doc of items) {
      const key = doc.orgNode?.name ?? 'Sem área';
      byArea.set(key, (byArea.get(key) ?? 0) + 1);
    }
    return {
      summary: await this.summary(me),
      byArea: [...byArea.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
      recent: items.slice(0, 10),
    };
  }

  async matrix(me: AuthPayload, filters: DocFilters = {}) {
    const docs = (await this.list(me, filters)) as any[];
    return docs.map((doc) => ({
      id: doc.id,
      code: doc.code ?? `#${doc.number}`,
      title: doc.title,
      type: doc.type,
      status: doc.status,
      companyId: doc.companyId,
      orgNode: doc.orgNode,
      indicator: doc.indicator,
      owner: doc.owner,
      approver: doc.approver,
      version: doc.version,
      validFrom: doc.validFrom,
      validUntil: doc.validUntil,
      daysToExpire: doc.daysToExpire,
      isExpired: doc.isExpired,
      needsReview: doc.needsReview,
    }));
  }

  async getById(me: AuthPayload, id: string) {
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertViewArea(me, doc);
    const [versions, files, statusHistory, approvals, reviewRequests, editRequests, comments, auditLogs, externalMetadata, tagRelations] =
      await Promise.all([
        this.prisma.documentVersion.findMany({ where: { documentId: id, companyId: me.companyId, deletedAt: null }, orderBy: { revisionNumber: 'desc' } }),
        this.prisma.documentFile.findMany({ where: { documentId: id, companyId: me.companyId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
        this.prisma.documentStatusHistory.findMany({ where: { documentId: id, companyId: me.companyId }, orderBy: { createdAt: 'desc' }, take: 100 }),
        this.prisma.documentApproval.findMany({ where: { documentId: id, companyId: me.companyId }, orderBy: [{ approvalOrder: 'asc' }, { createdAt: 'asc' }] }),
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
        this.prisma.documentComment.findMany({ where: { documentId: id, companyId: me.companyId }, orderBy: { createdAt: 'desc' } }),
        this.prisma.documentAuditLog.findMany({ where: { documentId: id, companyId: me.companyId }, orderBy: { createdAt: 'desc' }, take: 100 }),
        this.prisma.documentExternalMetadata.findUnique({ where: { documentId: id } }),
        this.prisma.documentTagRelation.findMany({ where: { documentId: id, companyId: me.companyId }, include: { tag: true } }),
      ]);
    return {
      ...this.enrich(doc),
      editor: this.editor.openPayload(id, files.find((file) => file.kind === DocumentFileKind.DOCX)?.id ?? null),
      versions,
      files,
      statusHistory,
      approvals,
      reviewRequests,
      editRequests,
      comments,
      auditLogs,
      externalMetadata,
      tags: tagRelations.map((relation) => relation.tag),
    };
  }

  async options(me: AuthPayload) {
    await this.codes.ensureDefaultTypes(me.companyId, me.sub);
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const areaWhere = permitted ? { id: { in: permitted } } : {};
    const indicatorWhere = permitted ? { ownerNodeId: { in: permitted } } : {};
    const [orgNodes, indicators, users, typeConfigs, templates] = await Promise.all([
      this.prisma.orgNode.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true, ...areaWhere },
        select: { id: true, name: true, type: true },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      }),
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
      }),
    ]);
    return {
      orgNodes,
      indicators,
      users,
      typeConfigs,
      templates,
      placeholders: defaultPlaceholders(),
      editor: this.editor.status(),
      statuses: Object.values(DocumentStatus),
      types: Object.values(DocumentType),
    };
  }

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
          ...stored,
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
        Object.assign(data, stored, { content, placeholders: detectPlaceholders(content), version: before.version + 1 });
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
        ...stored,
      },
    });
  }

  /** Importa um .docx real enviado pela empresa como modelo. */
  async importTemplate(me: AuthPayload, body: any) {
    const name = this.requiredText(body?.name, 'Nome do modelo');
    const fileName = this.nullableText(body?.fileName) ?? `${name}.docx`;
    const buffer = decodeBase64(this.requiredText(body?.contentBase64, 'Arquivo do modelo'));
    if (!buffer.length) throw new BadRequestException('Arquivo vazio.');
    if (buffer.length > MAX_FILE_BYTES) throw new BadRequestException('Arquivo excede o limite de 8 MB.');
    if (!isDocxBuffer(buffer)) throw new BadRequestException('Arquivo inválido: envie um .docx (Word/LibreOffice) válido.');
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
          ...stored,
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
          ...stored,
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

  private statusTimestamps(status: DocumentStatus, before?: { approvedAt: Date | null; publishedAt: Date | null }) {
    const now = new Date();
    const approvedStates = new Set<DocumentStatus>([
      DocumentStatus.APPROVED,
      DocumentStatus.SCHEDULED_PUBLICATION,
      DocumentStatus.PUBLISHED,
      DocumentStatus.NEAR_EXPIRATION,
      DocumentStatus.EXPIRED,
      DocumentStatus.PERIODIC_REVIEW,
      DocumentStatus.REPLACED,
      DocumentStatus.OBSOLETE,
      DocumentStatus.ARCHIVED,
    ]);
    const publishedStates = new Set<DocumentStatus>([
      DocumentStatus.PUBLISHED,
      DocumentStatus.NEAR_EXPIRATION,
      DocumentStatus.EXPIRED,
      DocumentStatus.PERIODIC_REVIEW,
      DocumentStatus.REPLACED,
      DocumentStatus.OBSOLETE,
      DocumentStatus.ARCHIVED,
    ]);
    return {
      approvedAt: approvedStates.has(status) ? before?.approvedAt ?? now : before?.approvedAt ?? null,
      publishedAt: publishedStates.has(status) ? before?.publishedAt ?? now : before?.publishedAt ?? null,
    };
  }

  async create(me: AuthPayload, body: any) {
    const title = this.requiredText(body?.title, 'Titulo');
    const type = this.parseType(body?.type) ?? DocumentType.PROCEDURE;
    if (body?.status && this.parseStatus(body.status) !== DocumentStatus.DRAFT) {
      throw new BadRequestException(DIRECT_STATUS_MESSAGE);
    }
    const links = await this.validateLinks(me.companyId, {
      orgNodeId: this.id(body?.orgNodeId),
      indicatorId: this.id(body?.indicatorId),
      ownerUserId: this.id(body?.ownerUserId),
      approverUserId: this.id(body?.approverUserId),
    });
    await this.assertWriteArea(me, links.area, 'create');
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
      const templateId = this.id(body?.templateId);
      let template: any = null;
      if (templateId) {
        template = await tx.documentTemplate.findFirst({ where: { id: templateId, companyId: me.companyId, deletedAt: null, active: true } });
        if (!template) throw new NotFoundException('Modelo não encontrado.');
      } else if (!explicitContent) {
        template = await tx.documentTemplate.findFirst({
          where: codeResult.typeConfig.defaultTemplateId
            ? { id: codeResult.typeConfig.defaultTemplateId, companyId: me.companyId, deletedAt: null, active: true }
            : { companyId: me.companyId, typeConfigId: codeResult.typeConfig.id, isDefault: true, deletedAt: null, active: true },
        });
      }

      let content = explicitContent ?? generatedDocumentBody(title, codeResult.code, 'Rev. 00');
      let templateDocx: Buffer | null = null;
      if (template) {
        const values = await this.buildPlaceholderValuesTx(tx, me, {
          code: codeResult.code,
          title,
          typeName: codeResult.typeConfig.name ?? codeResult.typeConfig.category,
          orgNodeId: links.ids.orgNodeId,
          ownerUserId: links.ids.ownerUserId,
          approverUserId: links.ids.approverUserId,
          validUntil,
        });
        if (!explicitContent && template.content) content = applyTextPlaceholders(template.content, values);
        if (template.storageKey) {
          try {
            const raw = await this.storage.readBinary(template.storageKey);
            if (isDocxBuffer(raw)) templateDocx = applyDocxPlaceholders(raw, values);
          } catch {
            templateDocx = null; // arquivo do modelo indisponivel: cai no texto
          }
        }
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
          status: DocumentStatus.DRAFT,
          version: 1,
          content,
          externalUrl: this.nullableText(body?.externalUrl) ?? null,
          changeNote: this.nullableText(body?.changeNote) ?? 'Criação inicial',
          validFrom,
          validUntil,
          reviewIntervalMonths: this.optionalInt(body?.reviewIntervalMonths) ?? null,
          approvedAt: null,
          publishedAt: null,
          createdById: me.sub,
          ...links.ids,
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
      // Semente do DOCX editavel: binario real do modelo (com placeholders
      // resolvidos) quando existir; senao, texto que o WOPI converte on-the-fly.
      let stored: Awaited<ReturnType<DocumentStorageService['putText']>>;
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
      await this.recordStatusTx(tx, me, doc.id, null, DocumentStatus.DRAFT, 'Documento criado', { versionId: version.id });
      await this.auditTx(
        tx,
        me,
        doc.id,
        'CREATE',
        null,
        { code: doc.code, title: doc.title, type: doc.type, templateId: template?.id ?? null },
        'Criação do documento',
      );
      return doc;
    });

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
    const before = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(before), 'edit');
    if ('status' in (patch ?? {}) && this.parseStatus(patch.status) !== before.status) {
      throw new BadRequestException(DIRECT_STATUS_MESSAGE);
    }
    this.assertEditableMetadata(before, patch);

    const links = await this.validateLinks(me.companyId, {
      orgNodeId: 'orgNodeId' in (patch ?? {}) ? this.id(patch.orgNodeId) : before.orgNodeId,
      indicatorId: 'indicatorId' in (patch ?? {}) ? this.id(patch.indicatorId) : before.indicatorId,
      ownerUserId: 'ownerUserId' in (patch ?? {}) ? this.id(patch.ownerUserId) : before.ownerUserId,
      approverUserId: 'approverUserId' in (patch ?? {}) ? this.id(patch.approverUserId) : before.approverUserId,
    });
    await this.assertWriteArea(me, links.area, 'edit');

    const data: any = { ...links.ids };
    if ('title' in (patch ?? {})) data.title = this.requiredText(patch.title, 'Titulo');
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
      const doc = await tx.document.update({ where: { id }, data, include: this.include() });
      await this.auditTx(tx, me, doc.id, 'UPDATE_METADATA', before, data, this.nullableText(patch?.reason) ?? 'Atualização de metadados');
      return doc;
    });

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
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(doc), 'delete');
    const removed = await this.prisma.$transaction(async (tx) => {
      const item = await tx.document.update({ where: { id }, data: { deletedAt: new Date() }, include: this.include() });
      await this.auditTx(tx, me, doc.id, 'SOFT_DELETE', doc, { deletedAt: item.deletedAt }, 'Exclusao logica');
      return item;
    });
    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: doc.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.UPDATED,
      entityType: TraceEntityType.DOCUMENT,
      entityId: doc.id,
      title: `Documento ${doc.code ?? `#${doc.number}`} excluido`,
      description: doc.title,
      statusFrom: doc.status,
      statusTo: 'DELETED',
    });
    return this.enrich(removed);
  }

  async transition(me: AuthPayload, id: string, to: DocumentStatus, body: any = {}) {
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(doc), 'edit');
    const comment = this.nullableText(body?.comment);
    if (COMMENT_REQUIRED.has(to) && !comment) throw new BadRequestException('Comentário obrigatório para esta transição.');
    if (!TRANSITIONS[doc.status]?.includes(to)) {
      throw new ConflictException(`Transição de ${doc.status} para ${to} não permitida.`);
    }
    if (to === DocumentStatus.PUBLISHED) return this.publish(me, id, body);

    const updated = await this.prisma.$transaction(async (tx) => {
      const stamps = this.statusTimestamps(to, doc);
      const version = await this.ensureLatestVersionTx(tx, doc, me.sub);
      const item = await tx.document.update({
        where: { id },
        data: { status: to, approvedAt: stamps.approvedAt, publishedAt: stamps.publishedAt },
        include: this.include(),
      });
      await tx.documentVersion.update({ where: { id: version.id }, data: { status: to } });
      await this.recordWorkflowArtifactsTx(tx, me, doc, version.id, to, body, comment);
      await this.recordStatusTx(tx, me, doc.id, doc.status, to, comment, { versionId: version.id });
      await this.auditTx(tx, me, doc.id, 'STATUS_CHANGE', { status: doc.status }, { status: to }, comment ?? 'Transição de status');
      return item;
    });

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

  async publish(me: AuthPayload, id: string, body: any = {}) {
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(doc), 'edit');
    if (doc.status !== DocumentStatus.APPROVED && doc.status !== DocumentStatus.SCHEDULED_PUBLICATION) {
      throw new ConflictException('Somente documentos aprovados podem ser publicados.');
    }
    const published = await this.prisma.$transaction(async (tx) => {
      const version = await this.ensureLatestVersionTx(tx, doc, me.sub);
      const pdfContent = renderPdfText(doc, version.versionLabel, this.nullableText(body?.watermark));
      // PDF oficial controlado: binario real (abre em qualquer leitor).
      const stored = await this.storage.putBinary(
        me.companyId,
        `documents/${doc.id}/${version.versionLabel}`,
        `${doc.code ?? doc.number}-${version.versionLabel}.pdf`,
        buildPdf(pdfContent),
        PDF_MIME,
      );
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
        where: { documentId: doc.id, companyId: me.companyId, id: { not: version.id }, status: DocumentStatus.PUBLISHED },
        data: { status: DocumentStatus.REPLACED },
      });
      await tx.documentVersion.update({
        where: { id: version.id },
        data: {
          status: DocumentStatus.PUBLISHED,
          pdfFileId: pdf.id,
          publicationDate: new Date(),
          expirationDate: doc.validUntil,
          publishedById: me.sub,
        },
      });
      const stamps = this.statusTimestamps(DocumentStatus.PUBLISHED, doc);
      const item = await tx.document.update({
        where: { id },
        data: { status: DocumentStatus.PUBLISHED, approvedAt: stamps.approvedAt, publishedAt: stamps.publishedAt },
        include: this.include(),
      });
      await this.recordStatusTx(tx, me, doc.id, doc.status, DocumentStatus.PUBLISHED, this.nullableText(body?.comment), { versionId: version.id, pdfFileId: pdf.id });
      await this.auditTx(tx, me, doc.id, 'PUBLISH', { status: doc.status }, { status: DocumentStatus.PUBLISHED, pdfFileId: pdf.id }, this.nullableText(body?.comment) ?? 'Publicação oficial');
      return item;
    });
    return this.getById(me, published.id);
  }

  async createRevision(me: AuthPayload, id: string, body: any = {}) {
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(doc), 'edit');
    const reason = this.requiredText(body?.reason, 'Motivo da nova revisão');
    const created = await this.prisma.$transaction(async (tx) => {
      const latest = await this.ensureLatestVersionTx(tx, doc, me.sub);
      const nextRevisionNumber = latest.revisionNumber + 1;
      const versionLabel = `Rev. ${String(nextRevisionNumber).padStart(2, '0')}`;
      const sourceFile = latest.docxFileId
        ? await tx.documentFile.findFirst({ where: { id: latest.docxFileId, companyId: me.companyId, deletedAt: null } })
        : await tx.documentFile.findFirst({ where: { documentId: doc.id, companyId: me.companyId, kind: DocumentFileKind.DOCX, deletedAt: null }, orderBy: { createdAt: 'desc' } });
      const sourceContent = sourceFile?.contentText ?? doc.content ?? generatedDocumentBody(doc.title, doc.code ?? `#${doc.number}`, versionLabel);
      const content = `${sourceContent}\n\nHistórico da nova revisão: ${reason}\n`;
      const version = await tx.documentVersion.create({
        data: {
          companyId: me.companyId,
          documentId: doc.id,
          revisionNumber: nextRevisionNumber,
          versionLabel,
          status: DocumentStatus.IN_DEVELOPMENT,
          changeReason: reason,
          changeSummary: this.nullableText(body?.summary),
          expirationDate: doc.validUntil,
          createdById: me.sub,
        },
      });
      const stored = await this.storage.putText(me.companyId, `documents/${doc.id}/rev-${nextRevisionNumber}`, `${doc.code ?? doc.number}-${versionLabel}.docx`, content, DOCX_MIME);
      const file = await tx.documentFile.create({
        data: {
          companyId: me.companyId,
          documentId: doc.id,
          versionId: version.id,
          kind: DocumentFileKind.DOCX,
          protected: false,
          createdById: me.sub,
          contentText: content,
          ...stored,
        },
      });
      await tx.documentVersion.update({ where: { id: version.id }, data: { docxFileId: file.id } });
      const updated = await tx.document.update({
        where: { id },
        data: { version: doc.version + 1, status: DocumentStatus.IN_DEVELOPMENT, content, changeNote: reason },
        include: this.include(),
      });
      await this.recordStatusTx(tx, me, doc.id, doc.status, DocumentStatus.IN_DEVELOPMENT, reason, { versionId: version.id });
      await this.auditTx(tx, me, doc.id, 'CREATE_REVISION', { latestVersionId: latest.id }, { versionId: version.id, revisionNumber: nextRevisionNumber }, reason);
      return updated;
    });
    return this.getById(me, created.id);
  }

  async requestEdit(me: AuthPayload, id: string, body: any = {}) {
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertViewArea(me, doc);
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
    this.workItems.markDirty(me.companyId, [operatorUserId, me.sub], 'document-edit-requested');
    return request;
  }

  async grantEditRequest(me: AuthPayload, id: string, body: any = {}) {
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertViewArea(me, doc);
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
        const revision = await this.createRevisionForEditRequestTx(tx, me, document, note);
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
        const revision = await this.createRevisionForEditRequestTx(tx, me, document, note ?? request.reason ?? 'Liberação de edição online');
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
        note ?? 'Liberação de edição online',
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

  async autosave(me: AuthPayload, id: string, body: any = {}) {
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(doc), 'edit');
    if (!EDITABLE_STATUSES.has(doc.status)) {
      throw new ConflictException('Documento bloqueado para edição. Crie uma nova revisão para alterar uma versão publicada/aprovada.');
    }
    const content = this.requiredText(body?.content, 'Conteúdo');
    const saved = await this.prisma.$transaction(async (tx) => {
      const version = await this.ensureLatestVersionTx(tx, doc, me.sub);
      const checksum = sha256(content);
      const item = await tx.document.update({ where: { id }, data: { content, changeNote: this.nullableText(body?.changeNote) ?? doc.changeNote }, include: this.include() });
      await tx.documentAutosaveCheckpoint.create({
        data: { companyId: me.companyId, documentId: id, versionId: version.id, userId: me.sub, content, checksum },
      });
      await this.auditTx(tx, me, id, 'AUTOSAVE', { checksum: sha256(doc.content ?? '') }, { checksum }, 'Autosave');
      return item;
    });
    return { savedAt: new Date().toISOString(), checksum: sha256(content), document: this.enrich(saved) };
  }

  async openEditor(me: AuthPayload, id: string) {
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertViewArea(me, doc);
    const approvedRequest = await this.findApprovedEditRequest(me, doc.id);
    if (!approvedRequest) {
      throw new ForbiddenException('Edição online precisa de liberação do operador.');
    }

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
      const updated = await this.prisma.$transaction(async (tx) => {
        const revision = await this.createRevisionForEditRequestTx(tx, me, doc, approvedRequest.reason ?? 'Liberação de edição online');
        await tx.documentEditRequest.update({ where: { id: approvedRequest.id }, data: { versionId: revision.version.id } });
        return revision.document;
      });
      editableDoc = updated;
    }
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
    if (approvedRequest?.status === 'APPROVED') {
      await this.prisma.documentEditRequest.update({ where: { id: approvedRequest.id }, data: { status: 'IN_PROGRESS' } });
      this.workItems.markDirty(me.companyId, [approvedRequest.requesterUserId, approvedRequest.operatorUserId], 'document-edit-started');
    }
    return session;
  }

  async openWordDesktopEditor(me: AuthPayload, id: string) {
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertViewArea(me, doc);
    const approvedRequest = await this.findApprovedEditRequest(me, doc.id);
    if (!approvedRequest) {
      throw new ForbiddenException('Edição no Word instalado precisa de liberação do operador.');
    }

    let editableDoc = doc;
    if (!EDITABLE_STATUSES.has(doc.status)) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const revision = await this.createRevisionForEditRequestTx(tx, me, doc, approvedRequest.reason ?? 'Liberação de edição no Word instalado');
        await tx.documentEditRequest.update({ where: { id: approvedRequest.id }, data: { versionId: revision.version.id } });
        return revision.document;
      });
      editableDoc = updated;
    }

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
        metadata: jsonOrNull({ fileId: file.id, mode: session.mode, dav: Boolean(session.davUrl), editRequestId: approvedRequest.id }),
      },
    });
    if (approvedRequest.status === 'APPROVED') {
      await this.prisma.documentEditRequest.update({ where: { id: approvedRequest.id }, data: { status: 'IN_PROGRESS' } });
      this.workItems.markDirty(me.companyId, [approvedRequest.requesterUserId, approvedRequest.operatorUserId], 'document-edit-started-word');
    }
    return session;
  }

  /** Indica se o usuário pode editar o documento (status editável + escopo de área). */
  private async canWriteDoc(me: AuthPayload, doc: any): Promise<boolean> {
    if (!EDITABLE_STATUSES.has(doc.status)) return false;
    const area = this.areaOf(doc);
    if (!area) return true;
    try {
      await this.access.assertCanWrite(me.sub, area, MODULE, 'edit');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Garante um DOCX binario real (OOXML) para o editor online. Se o documento
   * só tinha conteúdo textual (fundação GED) ou não tinha DOCX, gera um .docx
   * válido semeado com o texto atual e o vincula a revisão corrente.
   */
  private async ensureEditableDocxFile(me: AuthPayload, doc: any) {
    const existing = await this.prisma.documentFile.findFirst({
      where: { companyId: me.companyId, documentId: doc.id, kind: DocumentFileKind.DOCX, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    // DOCX binario real = sem contentText e com chave de storage.
    if (existing && existing.contentText == null && existing.storageKey) return existing;

    const seedText = doc.content ?? existing?.contentText ?? '';
    const buffer = buildDocx(seedText);
    const version = await this.ensureLatestVersion(doc, me.sub);
    const stored = await this.storage.putBinary(
      me.companyId,
      `documents/${doc.id}/editor`,
      `${doc.code ?? doc.number}.docx`,
      buffer,
      DOCX_MIME,
    );
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.documentFile.create({
        data: {
          companyId: me.companyId,
          documentId: doc.id,
          versionId: version.id,
          kind: DocumentFileKind.DOCX,
          createdById: me.sub,
          contentText: null,
          ...stored,
        },
      });
      await tx.documentVersion.update({ where: { id: version.id }, data: { docxFileId: item.id } });
      await this.auditTx(tx, me, doc.id, 'EDITOR_SEED', null, { fileId: item.id }, 'Geração de DOCX editável para o editor online');
      return item;
    });
  }

  // --------------------------- Host WOPI (editor online) --------------------
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
    const stored = await this.storage.putBinary(token.companyId, `documents/${doc.id}/editor`, file.fileName, content, DOCX_MIME);
    await this.prisma.$transaction(async (tx) => {
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
    });
    this.workItems.markDirty(token.companyId, [token.userId], 'document-editor-save');
    return { version: stored.hashSha256 };
  }

  async uploadFile(me: AuthPayload, id: string, body: any) {
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(doc), 'edit');
    const kind = this.parseFileKind(body?.kind);
    if (kind === DocumentFileKind.DOCX && !EDITABLE_STATUSES.has(doc.status)) {
      throw new ConflictException('DOCX editável só pode ser substituído em rascunho/elaboração/ajustes.');
    }
    const fileName = this.requiredText(body?.fileName, 'Nome do arquivo');
    const mimeType = this.nullableText(body?.mimeType) ?? mimeFor(kind);
    const latest = await this.ensureLatestVersion(doc, me.sub);

    // Upload binario (base64) preserva o arquivo original; o modo texto segue
    // aceito por retrocompatibilidade.
    const base64 = this.nullableText(body?.contentBase64);
    let stored: Awaited<ReturnType<DocumentStorageService['putText']>>;
    let contentText: string | null = null;
    if (base64) {
      const buffer = decodeBase64(base64);
      if (!buffer.length) throw new BadRequestException('Arquivo vazio.');
      if (buffer.length > MAX_FILE_BYTES) throw new BadRequestException('Arquivo excede o limite de 8 MB.');
      if (kind === DocumentFileKind.DOCX && !isDocxBuffer(buffer)) {
        throw new BadRequestException('Arquivo inválido: envie um .docx (Word/LibreOffice) válido.');
      }
      if (kind === DocumentFileKind.PDF && buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
        throw new BadRequestException('Arquivo inválido: envie um PDF válido.');
      }
      stored = await this.storage.putBinary(me.companyId, `documents/${doc.id}/uploads`, fileName, buffer, mimeType);
    } else {
      contentText = this.requiredText(body?.content, 'Conteúdo do arquivo');
      stored = await this.storage.putText(me.companyId, `documents/${doc.id}/uploads`, fileName, contentText, mimeType);
    }
    const file = await this.prisma.$transaction(async (tx) => {
      const item = await tx.documentFile.create({
        data: {
          companyId: me.companyId,
          documentId: doc.id,
          versionId: latest.id,
          kind,
          protected: kind === DocumentFileKind.PDF,
          createdById: me.sub,
          contentText,
          ...stored,
        },
      });
      if (kind === DocumentFileKind.DOCX) await tx.documentVersion.update({ where: { id: latest.id }, data: { docxFileId: item.id } });
      if (kind === DocumentFileKind.PDF) await tx.documentVersion.update({ where: { id: latest.id }, data: { pdfFileId: item.id } });
      await this.auditTx(tx, me, doc.id, 'UPLOAD_FILE', null, { fileId: item.id, kind }, this.nullableText(body?.reason) ?? 'Upload de arquivo');
      return item;
    });
    return file;
  }

  async downloadFile(me: AuthPayload, id: string, fileId: string, context?: { ip?: string; userAgent?: string }) {
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertViewArea(me, doc);
    const file = await this.prisma.documentFile.findFirst({ where: { id: fileId, documentId: id, companyId: me.companyId, deletedAt: null } });
    if (!file) throw new NotFoundException('Arquivo não encontrado.');
    // Arquivos legados guardam o texto em contentText; arquivos binarios
    // (ex.: DOCX salvo por editor WOPI) ficam apenas no storage. Para DOCX e
    // PDF legados, converte o texto em arquivo real para o download abrir
    // corretamente no Word/leitor de PDF.
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
    await this.prisma.$transaction(async (tx) => {
      await tx.documentDownloadLog.create({
        data: {
          companyId: me.companyId,
          documentId: id,
          versionId: file.versionId,
          fileId: file.id,
          userId: me.sub,
          ip: context?.ip,
          userAgent: context?.userAgent,
        },
      });
      await this.auditTx(tx, me, id, 'DOWNLOAD', null, { fileId: file.id, kind: file.kind }, 'Download controlado', context);
    });
    return { file, content, mimeType: file.mimeType ?? mimeFor(file.kind) };
  }

  async addComment(me: AuthPayload, id: string, body: any) {
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertViewArea(me, doc);
    const comment = await this.prisma.documentComment.create({
      data: {
        companyId: me.companyId,
        documentId: id,
        versionId: this.id(body?.versionId),
        parentId: this.id(body?.parentId),
        userId: me.sub,
        body: this.requiredText(body?.body, 'Comentário'),
      },
    });
    await this.audit(me, id, 'COMMENT', null, { commentId: comment.id }, 'Comentário interno');
    return comment;
  }

  async confirmRead(me: AuthPayload, id: string, body: any = {}) {
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertViewArea(me, doc);
    const version = await this.ensureLatestVersion(doc, me.sub);
    return this.prisma.documentReadConfirmation.create({
      data: {
        companyId: me.companyId,
        documentId: id,
        versionId: version.id,
        distributionId: this.id(body?.distributionId),
        userId: me.sub,
        confirmedAt: new Date(),
        status: 'CONFIRMED',
      },
    });
  }

  async runExpirationJob(me: AuthPayload) {
    return this.expirationSweep(me.companyId, me.sub);
  }

  /**
   * Rotina de vencimento (acionável manualmente ou pelo MaintenanceScheduler):
   * move PUBLISHED -> NEAR_EXPIRATION -> EXPIRED conforme a validade e
   * notifica responsável e aprovador a cada transição. `actorUserId` null =
   * execução automática do sistema (histórico/auditoria ficam sem usuário).
   */
  async expirationSweep(companyId: string, actorUserId: string | null = null) {
    const now = new Date();
    const limit30 = addDays(now, 30);
    // Ator para trilha de status/auditoria; userId é nullable em ambas as tabelas.
    const actor = { companyId, sub: actorUserId } as unknown as AuthPayload;
    const docs = await this.prisma.document.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: [DocumentStatus.PUBLISHED, DocumentStatus.NEAR_EXPIRATION] },
        validUntil: { not: null },
      },
      include: this.include(),
      take: 500,
    });
    let processed = 0;
    for (const doc of docs) {
      const validUntil = doc.validUntil!;
      const to = validUntil < now ? DocumentStatus.EXPIRED : validUntil <= limit30 ? DocumentStatus.NEAR_EXPIRATION : null;
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
    const date = validUntil.toLocaleDateString('pt-BR');
    const title = to === DocumentStatus.EXPIRED ? `Documento vencido: ${code}` : `Documento próximo do vencimento: ${code}`;
    const body =
      to === DocumentStatus.EXPIRED
        ? `"${doc.title}" venceu em ${date}. Inicie a revisão periódica ou torne-o obsoleto.`
        : `"${doc.title}" vence em ${date}. Planeje a revisão periódica.`;
    const recipients = [...new Set([doc.ownerUserId, doc.approverUserId].filter(Boolean))] as string[];
    for (const userId of recipients) {
      try {
        await this.notifications.create(doc.companyId, userId, NotificationKind.MESSAGE, title, body, `/documents?focus=${doc.id}`);
      } catch {
        // Notificação é best-effort: a transição de status não pode falhar por causa dela.
      }
    }
  }

  async diagnostics(me: AuthPayload) {
    const [documents, withoutFiles, pendingPdfs, files] = await Promise.all([
      this.prisma.document.count({ where: { companyId: me.companyId, deletedAt: null } }),
      this.prisma.document.count({
        where: { companyId: me.companyId, deletedAt: null, files: { none: { deletedAt: null } } },
      }),
      this.prisma.documentVersion.count({
        where: { companyId: me.companyId, deletedAt: null, status: DocumentStatus.PUBLISHED, pdfFileId: null },
      }),
      this.prisma.documentFile.count({ where: { companyId: me.companyId, deletedAt: null } }),
    ]);
    return {
      documents,
      files,
      withoutFiles,
      pendingPdfs,
      storage: { provider: process.env.DOCUMENT_STORAGE_PROVIDER ?? 'LOCAL', configured: true },
      editor: this.editor.status(),
      generatedAt: new Date(),
    };
  }

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
    const candidate = requested ?? [doc.ownerUserId, doc.approverUserId, doc.createdById, me.sub].find(Boolean);
    if (!candidate) throw new BadRequestException('Defina um operador para liberar a edição.');
    const user = await this.prisma.user.findFirst({
      where: { id: candidate, companyId: me.companyId, deletedAt: null, active: true, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Operador não encontrado ou inativo.');
    return user.id;
  }

  private async assertCanOperateDocumentEdit(me: AuthPayload, doc: any) {
    if (doc.ownerUserId === me.sub || doc.approverUserId === me.sub || doc.createdById === me.sub) return;
    if (['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(String(me.role))) return;
    const area = this.areaOf(doc);
    if (area) {
      try {
        await this.access.assertCanWrite(me.sub, area, MODULE, 'edit');
        return;
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

  private async createRevisionForEditRequestTx(tx: Tx, me: AuthPayload, doc: any, reason: string) {
    const latest = await this.ensureLatestVersionTx(tx, doc, me.sub);
    const nextRevisionNumber = latest.revisionNumber + 1;
    const versionLabel = `Rev. ${String(nextRevisionNumber).padStart(2, '0')}`;
    const sourceFile = latest.docxFileId
      ? await tx.documentFile.findFirst({ where: { id: latest.docxFileId, companyId: me.companyId, deletedAt: null } })
      : await tx.documentFile.findFirst({ where: { documentId: doc.id, companyId: me.companyId, kind: DocumentFileKind.DOCX, deletedAt: null }, orderBy: { createdAt: 'desc' } });
    const sourceContent = sourceFile?.contentText ?? doc.content ?? generatedDocumentBody(doc.title, doc.code ?? `#${doc.number}`, versionLabel);
    const content = `${sourceContent}\n\nHistórico da revisão liberada: ${reason}\n`;
    const version = await tx.documentVersion.create({
      data: {
        companyId: me.companyId,
        documentId: doc.id,
        revisionNumber: nextRevisionNumber,
        versionLabel,
        status: DocumentStatus.IN_DEVELOPMENT,
        changeReason: reason,
        expirationDate: doc.validUntil,
        createdById: me.sub,
      },
    });
    // Arquivo binario (editado no Word/Collabora): copia o DOCX real para a
    // nova revisao, preservando a formatacao. Senao, segue o caminho textual.
    let binarySeed: Buffer | null = null;
    if (sourceFile && sourceFile.contentText == null && sourceFile.storageKey) {
      try {
        binarySeed = await this.storage.readBinary(sourceFile.storageKey);
      } catch {
        binarySeed = null;
      }
    }
    const stored = binarySeed
      ? await this.storage.putBinary(me.companyId, `documents/${doc.id}/rev-${nextRevisionNumber}`, `${doc.code ?? doc.number}-${versionLabel}.docx`, binarySeed, DOCX_MIME)
      : await this.storage.putText(me.companyId, `documents/${doc.id}/rev-${nextRevisionNumber}`, `${doc.code ?? doc.number}-${versionLabel}.docx`, content, DOCX_MIME);
    const file = await tx.documentFile.create({
      data: {
        companyId: me.companyId,
        documentId: doc.id,
        versionId: version.id,
        kind: DocumentFileKind.DOCX,
        protected: false,
        createdById: me.sub,
        contentText: binarySeed ? null : content,
        ...stored,
      },
    });
    await tx.documentVersion.update({ where: { id: version.id }, data: { docxFileId: file.id } });
    const document = await tx.document.update({
      where: { id: doc.id },
      data: { version: doc.version + 1, status: DocumentStatus.IN_DEVELOPMENT, content, changeNote: reason },
      include: this.include(),
    });
    await this.recordStatusTx(tx, me, doc.id, doc.status, DocumentStatus.IN_DEVELOPMENT, reason, { versionId: version.id, source: 'EDIT_REQUEST' });
    await this.auditTx(tx, me, doc.id, 'CREATE_REVISION_FOR_EDIT_REQUEST', { latestVersionId: latest.id }, { versionId: version.id, revisionNumber: nextRevisionNumber }, reason);
    return { document, version, file };
  }

  private assertEditableMetadata(doc: any, patch: any) {
    if (EDITABLE_STATUSES.has(doc.status)) return;
    const restricted = ['title', 'code', 'description', 'type', 'content', 'externalUrl'];
    if (restricted.some((field) => field in (patch ?? {}))) {
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

  private async recordWorkflowArtifactsTx(
    tx: Tx,
    me: AuthPayload,
    doc: any,
    versionId: string,
    to: DocumentStatus,
    body: any,
    comment: string | null | undefined,
  ) {
    if (to === DocumentStatus.ADJUSTMENTS_REQUESTED) {
      await tx.documentReviewRequest.create({
        data: {
          companyId: me.companyId,
          documentId: doc.id,
          versionId,
          reviewerUserId: me.sub,
          authorUserId: doc.ownerUserId,
          comment: comment!,
          dueAt: this.optionalDate(body?.dueAt, 'Prazo de ajuste') ?? null,
        },
      });
    }
    if (to === DocumentStatus.WAITING_APPROVAL || to === DocumentStatus.IN_APPROVAL) {
      await tx.documentApproval.create({
        data: {
          companyId: me.companyId,
          documentId: doc.id,
          versionId,
          approverUserId: this.id(body?.approverUserId) ?? doc.approverUserId,
          approverRole: 'APPROVER',
          approvalOrder: 1,
          decision: DocumentApprovalDecision.PENDING,
          statusFrom: doc.status,
          statusTo: to,
          comment,
        },
      });
    }
    if (to === DocumentStatus.APPROVED || to === DocumentStatus.REJECTED) {
      await tx.documentApproval.create({
        data: {
          companyId: me.companyId,
          documentId: doc.id,
          versionId,
          approverUserId: me.sub,
          approverRole: 'APPROVER',
          approvalOrder: 1,
          decision: to === DocumentStatus.APPROVED ? DocumentApprovalDecision.APPROVED : DocumentApprovalDecision.REJECTED,
          statusFrom: doc.status,
          statusTo: to,
          comment,
          decidedAt: new Date(),
        },
      });
    }
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

function publishedLikeStatuses() {
  return [DocumentStatus.PUBLISHED, DocumentStatus.NEAR_EXPIRATION, DocumentStatus.EXPIRED, DocumentStatus.PERIODIC_REVIEW];
}

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
    `Titulo: ${title}`,
    `Revisão: ${revision}`,
    `Data: ${new Date().toISOString().slice(0, 10)}`,
    '',
    description,
    '',
    content || 'Conteúdo inicial do documento.',
  ].join('\n');
}

/** Corpo (markdown enxuto) do PDF oficial controlado; vira PDF real via buildPdf. */
function renderPdfText(doc: any, revision: string, watermark?: string | null) {
  const validade = doc.validUntil ? new Date(doc.validUntil).toLocaleDateString('pt-BR') : 'não definida';
  return [
    `# ${doc.code ?? `#${doc.number}`} - ${doc.title}`,
    '',
    `**Revisão:** ${revision} | **Publicado em:** ${new Date().toLocaleDateString('pt-BR')} | **Validade:** ${validade}`,
    watermark ? `Marca d'água: ${watermark}` : null,
    'Documento controlado - cópia impressa não controlada.',
    '',
    '---',
    '',
    doc.content ?? '',
  ]
    .filter((line) => line !== null)
    .join('\n');
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
