import { Injectable, Logger } from '@nestjs/common';
import { DocumentConfidentiality, DocumentContentFormat, DocumentStatus, DocumentType, Prisma } from '@prisma/client';
import {
  buildPlainSearchQuery,
  buildPrefixTsQuery,
  docToPlainText,
  extractSnippet,
  isDocNode,
  normalizeSearchText,
} from '@g360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { DocumentAccessService } from './document-access.service';
import { DocumentRenderService } from './document-render.service';
import { docxToText } from './document-text';

export const PUBLISHED_LIKE: DocumentStatus[] = [DocumentStatus.PUBLISHED, DocumentStatus.NEAR_EXPIRATION, DocumentStatus.EXPIRED, DocumentStatus.PERIODIC_REVIEW];
export const STATUS_GROUPS: Record<string, DocumentStatus[]> = {
  published: [DocumentStatus.PUBLISHED, DocumentStatus.NEAR_EXPIRATION, DocumentStatus.PERIODIC_REVIEW],
  development: [DocumentStatus.DRAFT, DocumentStatus.IN_DEVELOPMENT, DocumentStatus.ADJUSTMENTS_REQUESTED, DocumentStatus.REJECTED],
  review: [DocumentStatus.WAITING_REVIEW, DocumentStatus.IN_REVIEW, DocumentStatus.REVIEW, DocumentStatus.REVIEWED],
  approval: [DocumentStatus.WAITING_APPROVAL, DocumentStatus.IN_APPROVAL, DocumentStatus.APPROVED, DocumentStatus.SCHEDULED_PUBLICATION],
  obsolete: [DocumentStatus.REPLACED, DocumentStatus.OBSOLETE, DocumentStatus.ARCHIVED, DocumentStatus.CANCELLED],
};

export interface DocumentSearchQuery {
  q?: string;
  group?: string;
  status?: string;
  type?: string;
  typeConfigId?: string;
  orgNodeId?: string;
  confidentiality?: string;
  ownerUserId?: string;
  expiring?: string;
  readRequired?: string;
  sort?: string;
  page?: string | number;
  pageSize?: string | number;
}

const LIST_INCLUDE = {
  orgNode: { select: { id: true, name: true, type: true } },
  owner: { select: { id: true, name: true } },
  approver: { select: { id: true, name: true } },
  typeConfig: { select: { id: true, name: true, sigla: true, alertDays: true } },
} satisfies Prisma.DocumentInclude;

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Conteúdo pesquisável do GED: mantém `bodyText`/`searchText` em dia com o
 * formato principal (editor visual, Word ou texto), faz a busca de texto
 * completo (Postgres) e calcula os indicadores direto no banco.
 */
@Injectable()
export class DocumentContentService {
  private readonly logger = new Logger(DocumentContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: DocumentAccessService,
    private readonly render: DocumentRenderService,
  ) {}

  /** Texto plano do conteúdo em elaboração/vigente, a partir do formato principal. */
  async currentBodyText(doc: any): Promise<string> {
    if (doc.contentFormat === DocumentContentFormat.STRUCTURED && isDocNode(doc.contentJson)) return docToPlainText(doc.contentJson);
    if (doc.contentFormat === DocumentContentFormat.DOCX) {
      const version = await this.prisma.documentVersion.findFirst({ where: { documentId: doc.id, deletedAt: null }, orderBy: { revisionNumber: 'desc' } });
      const docx = await this.render.latestDocx(doc, version);
      if (docx) return docxToText(docx.buffer);
    }
    if (doc.contentFormat === DocumentContentFormat.FILE) return [doc.description, doc.content].filter(Boolean).join('\n');
    return doc.content ?? '';
  }

  buildSearchText(doc: { code?: string | null; title?: string | null; description?: string | null }, bodyText: string, tags: string[] = []): string {
    const code = doc.code ?? '';
    return normalizeSearchText([code, code.replace(/[^\p{L}\p{N}]+/gu, ' '), doc.title, doc.description, tags.join(' '), bodyText].filter(Boolean).join(' ')).slice(0, 500_000);
  }

  /** Recalcula o texto de busca do documento (nunca derruba a operação principal). */
  async syncText(documentId: string): Promise<void> {
    try {
      const doc = await this.prisma.document.findUnique({ where: { id: documentId }, include: { tagRelations: { include: { tag: true } } } });
      if (!doc) return;
      const body = (await this.currentBodyText(doc)).slice(0, 500_000);
      await this.prisma.document.updateMany({
        where: { id: documentId, updatedAt: doc.updatedAt },
        // Atualizar o índice não altera o conteúdo/revisão, nem sobrescreve um
        // índice calculado a partir de uma edição mais recente.
        data: { bodyText: body || null, searchText: this.buildSearchText(doc, body, doc.tagRelations.map((relation) => relation.tag.name)), updatedAt: doc.updatedAt },
      });
    } catch (error) {
      this.logger.warn(`Texto de busca do documento ${documentId} não atualizado: ${(error as Error).message}`);
    }
  }

  /** Reprocessa documentos ainda sem texto de busca (pós-migração). */
  async reindexMissing(companyId?: string, limit = 200): Promise<number> {
    const rows = await this.prisma.document.findMany({
      where: { deletedAt: null, searchText: null, ...(companyId ? { companyId } : {}) },
      select: { id: true },
      take: limit,
    });
    for (const row of rows) await this.syncText(row.id);
    return rows.length;
  }

  /** Candidatos da busca de texto completo, com relevância. */
  async ftsCandidates(companyId: string, term: string, limit = 500): Promise<Array<{ id: string; rank: number }>> {
    const prefix = buildPrefixTsQuery(term);
    const plain = buildPlainSearchQuery(term);
    const like = normalizeSearchText(term);
    if (!prefix && like.length < 3) return [];
    const prefixMatch = prefix ? Prisma.sql`to_tsvector('simple', COALESCE(d."searchText", '')) @@ to_tsquery('simple', ${prefix})` : Prisma.sql`FALSE`;
    const stemMatch = plain ? Prisma.sql`to_tsvector('portuguese', COALESCE(d."searchText", '')) @@ plainto_tsquery('portuguese', ${plain})` : Prisma.sql`FALSE`;
    const likeMatch = like.length >= 3 ? Prisma.sql`d."searchText" LIKE ${`%${escapeLike(like)}%`}` : Prisma.sql`FALSE`;
    const rankExpr = prefix ? Prisma.sql`ts_rank(to_tsvector('simple', COALESCE(d."searchText", '')), to_tsquery('simple', ${prefix}))` : Prisma.sql`0`;
    const rows = await this.prisma.$queryRaw<Array<{ id: string; rank: number }>>`
      SELECT d."id",
        (${rankExpr}
          + CASE WHEN lower(COALESCE(d."code", '')) = ${like} THEN 3 ELSE 0 END
          + CASE WHEN d."searchText" LIKE ${`${escapeLike(like)}%`} THEN 0.5 ELSE 0 END)::float8 AS rank
      FROM "Document" d
      WHERE d."companyId" = ${companyId} AND d."deletedAt" IS NULL AND (${prefixMatch} OR ${stemMatch} OR ${likeMatch})
      ORDER BY rank DESC
      LIMIT ${limit}`;
    return rows.map((row) => ({ id: row.id, rank: Number(row.rank) || 0 }));
  }

  private filters(query: DocumentSearchQuery): Prisma.DocumentWhereInput[] {
    const and: Prisma.DocumentWhereInput[] = [];
    const now = new Date();
    if (query.group && STATUS_GROUPS[query.group]) and.push({ status: { in: STATUS_GROUPS[query.group] } });
    if (query.group === 'expired') and.push({ status: { in: PUBLISHED_LIKE }, validUntil: { lt: now } });
    if (query.status && (Object.values(DocumentStatus) as string[]).includes(query.status)) and.push({ status: query.status as DocumentStatus });
    if (query.type && (Object.values(DocumentType) as string[]).includes(query.type)) and.push({ type: query.type as DocumentType });
    if (query.typeConfigId) and.push({ typeConfigId: query.typeConfigId });
    if (query.orgNodeId) and.push({ orgNodeId: query.orgNodeId });
    if (query.ownerUserId) and.push({ ownerUserId: query.ownerUserId });
    if (query.confidentiality && (Object.values(DocumentConfidentiality) as string[]).includes(query.confidentiality)) {
      and.push({ confidentiality: query.confidentiality as DocumentConfidentiality });
    }
    if (query.readRequired === 'true') and.push({ readRequired: true });
    if (query.expiring === 'expired') and.push({ status: { in: PUBLISHED_LIKE }, validUntil: { lt: now } });
    if (query.expiring === 'soon') and.push({ status: { in: PUBLISHED_LIKE }, validUntil: { gte: now, lte: new Date(now.getTime() + 90 * 86_400_000) } });
    return and;
  }

  private orderBy(sort?: string): Prisma.DocumentOrderByWithRelationInput[] {
    switch (sort) {
      case 'code':
        return [{ code: 'asc' }, { number: 'asc' }];
      case 'title':
        return [{ title: 'asc' }];
      case 'validity':
        return [{ validUntil: { sort: 'asc', nulls: 'last' } }, { number: 'desc' }];
      case 'recent':
      default:
        return [{ updatedAt: 'desc' }];
    }
  }

  /** Acervo paginado com filtros, relevância e trecho encontrado. */
  async search(me: AuthPayload, query: DocumentSearchQuery) {
    const pageSize = Math.min(100, Math.max(5, Number(query.pageSize) || 25));
    const page = Math.max(1, Number(query.page) || 1);
    const term = (query.q ?? '').trim().slice(0, 200);
    const visibility = await this.accessPolicy.visibilityWhere(me);
    const and = [visibility, ...this.filters(query)];
    let ranked: Map<string, number> | null = null;
    if (term) {
      const candidates = await this.ftsCandidates(me.companyId, term);
      if (!candidates.length) return { items: [], total: 0, page, pageSize, query: term };
      ranked = new Map(candidates.map((candidate) => [candidate.id, candidate.rank]));
      and.push({ id: { in: candidates.map((candidate) => candidate.id) } });
    }
    const where: Prisma.DocumentWhereInput = { companyId: me.companyId, deletedAt: null, AND: and };
    const total = await this.prisma.document.count({ where });
    let rows: any[];
    if (ranked) {
      const visible = await this.prisma.document.findMany({ where, select: { id: true } });
      const ordered = visible.map((item) => item.id).sort((a, b) => (ranked!.get(b) ?? 0) - (ranked!.get(a) ?? 0));
      const pageIds = ordered.slice((page - 1) * pageSize, page * pageSize);
      const found = await this.prisma.document.findMany({ where: { id: { in: pageIds } }, include: LIST_INCLUDE });
      const byId = new Map(found.map((item) => [item.id, item]));
      rows = pageIds.map((id) => byId.get(id)).filter(Boolean);
    } else {
      rows = await this.prisma.document.findMany({ where, include: LIST_INCLUDE, orderBy: this.orderBy(query.sort), skip: (page - 1) * pageSize, take: pageSize });
    }
    return {
      items: rows.map((doc) => ({ ...summarize(doc), snippet: term ? extractSnippet(doc.bodyText ?? doc.description, term) : null })),
      total,
      page,
      pageSize,
      query: term,
    };
  }

  /** Indicadores do acervo (contagens no banco, mesmo recorte de acesso da lista). */
  async overview(me: AuthPayload) {
    const visibility = await this.accessPolicy.visibilityWhere(me);
    const base: Prisma.DocumentWhereInput = { companyId: me.companyId, deletedAt: null, AND: [visibility] };
    const now = new Date();
    const horizon = new Date(now.getTime() + 120 * 86_400_000);
    const [byStatus, byType, expired, expiring, restricted, readRequired, myReads, mySteps, myChangeRequests] = await Promise.all([
      this.prisma.document.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
      this.prisma.document.groupBy({ by: ['type'], where: base, _count: { _all: true } }),
      this.prisma.document.count({ where: { ...base, status: { in: PUBLISHED_LIKE }, validUntil: { lt: now } } }),
      this.prisma.document.findMany({
        where: { ...base, status: { in: PUBLISHED_LIKE }, validUntil: { gte: now, lte: horizon } },
        include: LIST_INCLUDE,
        orderBy: { validUntil: 'asc' },
        take: 300,
      }),
      this.prisma.document.count({ where: { ...base, confidentiality: { not: DocumentConfidentiality.INTERNAL } } }),
      this.prisma.document.count({ where: { ...base, readRequired: true, status: { in: PUBLISHED_LIKE } } }),
      this.prisma.documentReadConfirmation.count({ where: { companyId: me.companyId, userId: me.sub, status: 'PENDING', document: { deletedAt: null } } }),
      this.prisma.documentWorkflowStep.count({
        where: { companyId: me.companyId, userId: me.sub, decision: 'PENDING', document: { deletedAt: null, status: { in: [...STATUS_GROUPS.review, DocumentStatus.WAITING_APPROVAL, DocumentStatus.IN_APPROVAL] } } },
      }),
      this.prisma.documentChangeRequest.count({ where: { companyId: me.companyId, ownerUserId: me.sub, status: 'OPEN' } }),
    ]);
    const statusCount = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])) as Record<string, number>;
    const sum = (statuses: DocumentStatus[]) => statuses.reduce((total, status) => total + (statusCount[status] ?? 0), 0);
    const needsReview = expiring.filter((doc) => {
      const days = Math.ceil((new Date(doc.validUntil!).getTime() - now.getTime()) / 86_400_000);
      return days <= (doc.typeConfig?.alertDays ?? 30);
    });
    return {
      total: byStatus.reduce((total, row) => total + row._count._all, 0),
      published: sum(STATUS_GROUPS.published),
      development: sum(STATUS_GROUPS.development),
      review: sum(STATUS_GROUPS.review),
      approval: sum(STATUS_GROUPS.approval),
      obsolete: sum(STATUS_GROUPS.obsolete),
      expired,
      needsReview: needsReview.length,
      restricted,
      readRequired,
      byStatus: statusCount,
      byType: Object.fromEntries(byType.map((row) => [row.type, row._count._all])),
      expiringSoon: needsReview.slice(0, 8).map(summarize),
      mine: { reads: myReads, steps: mySteps, changeRequests: myChangeRequests },
    };
  }
}

/** Formato enxuto do documento para listas (sem conteúdo nem texto de busca). */
export function summarize(doc: any) {
  const validUntil = doc.validUntil ? new Date(doc.validUntil) : null;
  const publishedLike = PUBLISHED_LIKE.includes(doc.status);
  const daysToExpire = validUntil ? Math.ceil((validUntil.getTime() - Date.now()) / 86_400_000) : null;
  const alertDays = doc.typeConfig?.alertDays ?? 30;
  return {
    id: doc.id,
    number: doc.number,
    code: doc.code,
    title: doc.title,
    description: doc.description,
    type: doc.type,
    typeConfig: doc.typeConfig ?? null,
    status: doc.status,
    version: doc.version,
    confidentiality: doc.confidentiality,
    contentFormat: doc.contentFormat,
    readRequired: doc.readRequired,
    validUntil: doc.validUntil,
    publishedAt: doc.publishedAt,
    updatedAt: doc.updatedAt,
    orgNode: doc.orgNode ?? null,
    owner: doc.owner ?? null,
    approver: doc.approver ?? null,
    isExpired: Boolean(validUntil && publishedLike && validUntil < new Date()),
    needsReview: Boolean(validUntil && publishedLike && daysToExpire !== null && daysToExpire >= 0 && daysToExpire <= alertDays),
    daysToExpire,
  };
}
