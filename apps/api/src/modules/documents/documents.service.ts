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
import { DocumentEditorService } from './document-editor.service';
import { DocumentStorageService, sha256 } from './document-storage.service';

const MODULE = 'documents';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME = 'application/pdf';

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
      throw new ForbiddenException('Voce nao tem acesso aos documentos desta area.');
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
      throw new BadRequestException('Status de documento invalido.');
    }
    return value as DocumentStatus;
  }

  private parseType(value?: string): DocumentType | undefined {
    if (!value) return undefined;
    if (!Object.values(DocumentType).includes(value as DocumentType)) {
      throw new BadRequestException('Tipo de documento invalido.');
    }
    return value as DocumentType;
  }

  private parseFileKind(value?: string): DocumentFileKind {
    if (!value) return DocumentFileKind.ATTACHMENT;
    if (!Object.values(DocumentFileKind).includes(value as DocumentFileKind)) {
      throw new BadRequestException('Tipo de arquivo invalido.');
    }
    return value as DocumentFileKind;
  }

  private requiredText(value: unknown, field: string) {
    const text = String(value ?? '').trim();
    if (!text) throw new BadRequestException(`${field} e obrigatorio.`);
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
    if (!Number.isFinite(n)) throw new BadRequestException('Valor numerico invalido.');
    return Math.max(min, Math.round(n));
  }

  private optionalDate(value: unknown, field: string): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`${field} invalido.`);
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
    if (!doc) throw new NotFoundException('Documento nao encontrado');
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
      const key = doc.orgNode?.name ?? 'Sem area';
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
    const [versions, files, statusHistory, approvals, reviewRequests, comments, auditLogs, externalMetadata, tagRelations] =
      await Promise.all([
        this.prisma.documentVersion.findMany({ where: { documentId: id, companyId: me.companyId, deletedAt: null }, orderBy: { revisionNumber: 'desc' } }),
        this.prisma.documentFile.findMany({ where: { documentId: id, companyId: me.companyId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
        this.prisma.documentStatusHistory.findMany({ where: { documentId: id, companyId: me.companyId }, orderBy: { createdAt: 'desc' }, take: 100 }),
        this.prisma.documentApproval.findMany({ where: { documentId: id, companyId: me.companyId }, orderBy: [{ approvalOrder: 'asc' }, { createdAt: 'asc' }] }),
        this.prisma.documentReviewRequest.findMany({ where: { documentId: id, companyId: me.companyId }, orderBy: { createdAt: 'desc' } }),
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
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async createTemplate(me: AuthPayload, body: any) {
    const name = this.requiredText(body?.name, 'Nome do template');
    const content = this.nullableText(body?.content) ?? defaultTemplateContent();
    const typeConfigId = this.id(body?.typeConfigId);
    if (typeConfigId) {
      const exists = await this.prisma.documentTypeConfig.findFirst({ where: { id: typeConfigId, companyId: me.companyId, deletedAt: null } });
      if (!exists) throw new NotFoundException('Tipo de documento nao encontrado.');
    }
    const stored = await this.storage.putText(me.companyId, 'templates', `${name}.docx`, content, DOCX_MIME);
    return this.prisma.documentTemplate.create({
      data: {
        companyId: me.companyId,
        typeConfigId,
        name,
        description: this.nullableText(body?.description),
        content,
        isDefault: Boolean(body?.isDefault),
        active: body?.active ?? true,
        placeholders: body?.placeholders ?? defaultPlaceholders(),
        createdById: me.sub,
        ...stored,
      },
    });
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
        if (duplicate) throw new ConflictException('Ja existe documento com este codigo nesta empresa.');
      }
      const validFrom = this.optionalDate(body?.validFrom, 'Inicio de vigencia') ?? null;
      const validUntil =
        this.optionalDate(body?.validUntil, 'Validade') ??
        (codeResult.typeConfig.defaultValidityDays ? addDays(validFrom ?? new Date(), codeResult.typeConfig.defaultValidityDays) : null);
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
          content: this.nullableText(body?.content) ?? generatedDocumentBody(title, codeResult.code, 'Rev. 00'),
          externalUrl: this.nullableText(body?.externalUrl) ?? null,
          changeNote: this.nullableText(body?.changeNote) ?? 'Criacao inicial',
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
          changeReason: 'Criacao inicial',
          changeSummary: doc.changeNote,
          expirationDate: validUntil,
          createdById: me.sub,
        },
      });
      const content = renderDocxText(doc, version.versionLabel);
      const stored = await this.storage.putText(me.companyId, `documents/${doc.id}/rev-00`, `${doc.code ?? doc.number}-rev-00.docx`, content, DOCX_MIME);
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
      await this.recordStatusTx(tx, me, doc.id, null, DocumentStatus.DRAFT, 'Documento criado', { versionId: version.id });
      await this.auditTx(tx, me, doc.id, 'CREATE', null, { code: doc.code, title: doc.title, type: doc.type }, 'Criacao do documento');
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
        if (duplicate) throw new ConflictException('Ja existe documento com este codigo nesta empresa.');
      }
      data.code = code;
    }
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('type' in (patch ?? {})) data.type = this.parseType(patch.type) ?? before.type;
    if ('content' in (patch ?? {})) data.content = this.nullableText(patch.content);
    if ('externalUrl' in (patch ?? {})) data.externalUrl = this.nullableText(patch.externalUrl);
    if ('changeNote' in (patch ?? {})) data.changeNote = this.nullableText(patch.changeNote);
    if ('validFrom' in (patch ?? {})) data.validFrom = this.optionalDate(patch.validFrom, 'Inicio de vigencia');
    if ('validUntil' in (patch ?? {})) data.validUntil = this.optionalDate(patch.validUntil, 'Validade');
    if ('reviewIntervalMonths' in (patch ?? {})) data.reviewIntervalMonths = this.optionalInt(patch.reviewIntervalMonths);

    const updated = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.update({ where: { id }, data, include: this.include() });
      await this.auditTx(tx, me, doc.id, 'UPDATE_METADATA', before, data, this.nullableText(patch?.reason) ?? 'Atualizacao de metadados');
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
    if (COMMENT_REQUIRED.has(to) && !comment) throw new BadRequestException('Comentario obrigatorio para esta transicao.');
    if (!TRANSITIONS[doc.status]?.includes(to)) {
      throw new ConflictException(`Transicao de ${doc.status} para ${to} nao permitida.`);
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
      await this.auditTx(tx, me, doc.id, 'STATUS_CHANGE', { status: doc.status }, { status: to }, comment ?? 'Transicao de status');
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
      const stored = await this.storage.putText(me.companyId, `documents/${doc.id}/${version.versionLabel}`, `${doc.code ?? doc.number}-${version.versionLabel}.pdf`, pdfContent, PDF_MIME);
      const pdf = await tx.documentFile.create({
        data: {
          companyId: me.companyId,
          documentId: doc.id,
          versionId: version.id,
          kind: DocumentFileKind.PDF,
          protected: true,
          createdById: me.sub,
          contentText: pdfContent,
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
      await this.auditTx(tx, me, doc.id, 'PUBLISH', { status: doc.status }, { status: DocumentStatus.PUBLISHED, pdfFileId: pdf.id }, this.nullableText(body?.comment) ?? 'Publicacao oficial');
      return item;
    });
    return this.getById(me, published.id);
  }

  async createRevision(me: AuthPayload, id: string, body: any = {}) {
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(doc), 'edit');
    const reason = this.requiredText(body?.reason, 'Motivo da nova revisao');
    const created = await this.prisma.$transaction(async (tx) => {
      const latest = await this.ensureLatestVersionTx(tx, doc, me.sub);
      const nextRevisionNumber = latest.revisionNumber + 1;
      const versionLabel = `Rev. ${String(nextRevisionNumber).padStart(2, '0')}`;
      const sourceFile = latest.docxFileId
        ? await tx.documentFile.findFirst({ where: { id: latest.docxFileId, companyId: me.companyId, deletedAt: null } })
        : await tx.documentFile.findFirst({ where: { documentId: doc.id, companyId: me.companyId, kind: DocumentFileKind.DOCX, deletedAt: null }, orderBy: { createdAt: 'desc' } });
      const sourceContent = sourceFile?.contentText ?? doc.content ?? generatedDocumentBody(doc.title, doc.code ?? `#${doc.number}`, versionLabel);
      const content = `${sourceContent}\n\nHistorico da nova revisao: ${reason}\n`;
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

  async autosave(me: AuthPayload, id: string, body: any = {}) {
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(doc), 'edit');
    if (!EDITABLE_STATUSES.has(doc.status)) {
      throw new ConflictException('Documento bloqueado para edicao. Crie uma nova revisao para alterar uma versao publicada/aprovada.');
    }
    const content = this.requiredText(body?.content, 'Conteudo');
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
    const latestDocx = await this.prisma.documentFile.findFirst({
      where: { companyId: me.companyId, documentId: id, kind: DocumentFileKind.DOCX, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    await this.prisma.documentEditorSession.create({
      data: {
        companyId: me.companyId,
        documentId: id,
        versionId: latestDocx?.versionId ?? null,
        userId: me.sub,
        provider: this.editor.status().provider,
        status: 'OPEN',
        metadata: this.editor.openPayload(id, latestDocx?.id ?? null),
      },
    });
    return this.editor.openPayload(id, latestDocx?.id ?? null);
  }

  async uploadFile(me: AuthPayload, id: string, body: any) {
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(doc), 'edit');
    const kind = this.parseFileKind(body?.kind);
    if (kind === DocumentFileKind.DOCX && !EDITABLE_STATUSES.has(doc.status)) {
      throw new ConflictException('DOCX editavel so pode ser substituido em rascunho/elaboracao/ajustes.');
    }
    const content = this.requiredText(body?.content, 'Conteudo do arquivo');
    const fileName = this.requiredText(body?.fileName, 'Nome do arquivo');
    const mimeType = this.nullableText(body?.mimeType) ?? mimeFor(kind);
    const latest = await this.ensureLatestVersion(doc, me.sub);
    const stored = await this.storage.putText(me.companyId, `documents/${doc.id}/uploads`, fileName, content, mimeType);
    const file = await this.prisma.$transaction(async (tx) => {
      const item = await tx.documentFile.create({
        data: {
          companyId: me.companyId,
          documentId: doc.id,
          versionId: latest.id,
          kind,
          protected: kind === DocumentFileKind.PDF,
          createdById: me.sub,
          contentText: content,
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
    if (!file) throw new NotFoundException('Arquivo nao encontrado.');
    const content = file.contentText ?? (await this.storage.readText(file.storageKey));
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
    return { file, content: Buffer.from(content, 'utf8'), mimeType: file.mimeType ?? mimeFor(file.kind) };
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
        body: this.requiredText(body?.body, 'Comentario'),
      },
    });
    await this.audit(me, id, 'COMMENT', null, { commentId: comment.id }, 'Comentario interno');
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
    const now = new Date();
    const limit30 = addDays(now, 30);
    const docs = await this.prisma.document.findMany({
      where: {
        companyId: me.companyId,
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
        await this.recordStatusTx(tx, me, doc.id, doc.status, to, 'Atualizacao automatica de vencimento');
        await this.auditTx(tx, me, doc.id, 'EXPIRATION_JOB', { status: doc.status }, { status: to }, 'Rotina de vencimento');
      });
      processed++;
    }
    return { processed, checked: docs.length, startedAt: now, finishedAt: new Date() };
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

  private assertEditableMetadata(doc: any, patch: any) {
    if (EDITABLE_STATUSES.has(doc.status)) return;
    const restricted = ['title', 'code', 'description', 'type', 'content', 'externalUrl'];
    if (restricted.some((field) => field in (patch ?? {}))) {
      throw new ConflictException('Documento bloqueado. Crie uma nova revisao para alterar conteudo ou metadados principais.');
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
      if (!orgNode) throw new NotFoundException('Area ou processo nao encontrado');
      areas.push(orgNode.id);
    }
    if (ids.indicatorId) {
      const indicator = await this.prisma.indicator.findFirst({ where: { id: ids.indicatorId, companyId, deletedAt: null }, select: { ownerNodeId: true } });
      if (!indicator) throw new NotFoundException('Indicador nao encontrado');
      if (indicator.ownerNodeId) areas.push(indicator.ownerNodeId);
    }
    for (const userId of [ids.ownerUserId, ids.approverUserId]) {
      if (!userId) continue;
      const user = await this.prisma.user.findFirst({ where: { id: userId, companyId, deletedAt: null, active: true }, select: { id: true } });
      if (!user) throw new NotFoundException('Usuario (dono/aprovador) nao encontrado');
    }

    const uniqueAreas = Array.from(new Set(areas.filter(Boolean)));
    if (uniqueAreas.length > 1) {
      throw new ConflictException('Vinculos do documento pertencem a areas diferentes.');
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
    `Codigo: ${code}`,
    `Titulo: ${title}`,
    `Revisao: ${revision}`,
    `Data: ${new Date().toISOString().slice(0, 10)}`,
    '',
    description,
    '',
    content || 'Conteudo inicial do documento.',
  ].join('\n');
}

function renderPdfText(doc: any, revision: string, watermark?: string | null) {
  return [
    '%PDF-1.4',
    `% Gestao 360 - PDF oficial controlado`,
    `Codigo: ${doc.code ?? `#${doc.number}`}`,
    `Titulo: ${doc.title}`,
    `Revisao: ${revision}`,
    `Publicado em: ${new Date().toISOString()}`,
    doc.validUntil ? `Validade: ${new Date(doc.validUntil).toISOString().slice(0, 10)}` : 'Validade: nao definida',
    watermark ? `Marca d'agua: ${watermark}` : '',
    '',
    doc.content ?? '',
    '%%EOF',
  ].filter(Boolean).join('\n');
}

function defaultTemplateContent() {
  return [
    '{{company_name}}',
    '{{document_code}} - {{document_title}}',
    'Revisao: {{revision}}',
    'Autor: {{author_name}}',
    'Responsavel: {{responsible_name}}',
    '',
    '{{revision_history}}',
    '',
    'Conteudo do documento...',
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

function jsonOrNull(value: unknown) {
  if (value === null || value === undefined) return Prisma.JsonNull;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return { value: String(value) };
  }
}
