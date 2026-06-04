import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, DocumentType, Prisma, TraceEntityType, TraceEventType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TraceabilityService } from '../traceability/traceability.service';
import { AccessService } from '../access/access.service';
import type { AreaAction } from '../access/access.logic';
import { AuthPayload } from '../auth/auth.types';

// Gestao documental: politicas, procedimentos, instrucoes, manuais e registros com ciclo
// de vida (rascunho -> revisao -> aprovado -> publicado -> obsoleto), validade/vencimento e
// vinculo a area/processo e indicador. Isolamento empresa + area (espelha riscos/NC).
const MODULE = 'documents';

type DocFilters = {
  status?: string;
  type?: string;
  search?: string;
  orgNodeId?: string;
  indicatorId?: string;
};

type LinkInput = {
  orgNodeId?: string | null;
  indicatorId?: string | null;
  ownerUserId?: string | null;
  approverUserId?: string | null;
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
    private readonly access: AccessService,
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
    const isPublished = doc.status === DocumentStatus.PUBLISHED;
    const isExpired = Boolean(validUntil && validUntil < new Date() && isPublished);
    const daysToExpire = validUntil ? Math.ceil((validUntil.getTime() - Date.now()) / 86_400_000) : null;
    const needsReview = Boolean(isPublished && validUntil && !isExpired && daysToExpire !== null && daysToExpire <= 30);
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

  private async loadScoped(id: string, companyId: string) {
    const doc = await this.prisma.document.findFirst({
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

    const items = await this.prisma.document.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
        ...(filters.orgNodeId ? { orgNodeId: filters.orgNodeId } : {}),
        ...(filters.indicatorId ? { indicatorId: filters.indicatorId } : {}),
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
      draft: (byStatus[DocumentStatus.DRAFT] ?? 0) + (byStatus[DocumentStatus.REVIEW] ?? 0),
      expired: list.filter((doc: any) => doc.isExpired).length,
      needsReview: list.filter((doc: any) => doc.needsReview).length,
      byStatus,
      byType,
      expiringSoon,
    };
  }

  async getById(me: AuthPayload, id: string) {
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertViewArea(me, doc);
    return this.enrich(doc);
  }

  async options(me: AuthPayload) {
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const areaWhere = permitted ? { id: { in: permitted } } : {};
    const indicatorWhere = permitted ? { ownerNodeId: { in: permitted } } : {};
    const [orgNodes, indicators, users] = await Promise.all([
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
    ]);
    return { orgNodes, indicators, users, statuses: Object.values(DocumentStatus), types: Object.values(DocumentType) };
  }

  /** Carimba approvedAt/publishedAt ao mudar de status; null fora dos estados finais. */
  private statusTimestamps(status: DocumentStatus, before?: { approvedAt: Date | null; publishedAt: Date | null }) {
    const now = new Date();
    const approvedAt = status === DocumentStatus.APPROVED || status === DocumentStatus.PUBLISHED ? before?.approvedAt ?? now : null;
    const publishedAt = status === DocumentStatus.PUBLISHED ? before?.publishedAt ?? now : null;
    return { approvedAt, publishedAt };
  }

  async create(me: AuthPayload, body: any) {
    const title = this.requiredText(body?.title, 'Titulo');
    const type = this.parseType(body?.type) ?? DocumentType.PROCEDURE;
    const status = this.parseStatus(body?.status) ?? DocumentStatus.DRAFT;
    const links = await this.validateLinks(me.companyId, {
      orgNodeId: this.id(body?.orgNodeId),
      indicatorId: this.id(body?.indicatorId),
      ownerUserId: this.id(body?.ownerUserId),
      approverUserId: this.id(body?.approverUserId),
    });
    await this.assertWriteArea(me, links.area, 'create');
    const stamps = this.statusTimestamps(status);

    const doc = await this.prisma.$transaction(async (tx) => {
      const last = await tx.document.findFirst({ where: { companyId: me.companyId }, orderBy: { number: 'desc' }, select: { number: true } });
      return tx.document.create({
        data: {
          companyId: me.companyId,
          number: (last?.number ?? 0) + 1,
          code: this.nullableText(body?.code) ?? null,
          title,
          description: this.nullableText(body?.description) ?? null,
          type,
          status,
          version: this.optionalInt(body?.version) ?? 1,
          content: this.nullableText(body?.content) ?? null,
          externalUrl: this.nullableText(body?.externalUrl) ?? null,
          changeNote: this.nullableText(body?.changeNote) ?? null,
          validFrom: this.optionalDate(body?.validFrom, 'Inicio de vigencia') ?? null,
          validUntil: this.optionalDate(body?.validUntil, 'Validade') ?? null,
          reviewIntervalMonths: this.optionalInt(body?.reviewIntervalMonths) ?? null,
          approvedAt: stamps.approvedAt,
          publishedAt: stamps.publishedAt,
          createdById: me.sub,
          ...links.ids,
        },
        include: this.include(),
      });
    });

    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: doc.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.CREATED,
      entityType: TraceEntityType.DOCUMENT,
      entityId: doc.id,
      title: `Documento #${doc.number} criado`,
      description: doc.title,
      statusTo: doc.status,
      metadata: { type: doc.type, version: doc.version },
    });

    return this.enrich(doc);
  }

  async update(me: AuthPayload, id: string, patch: any) {
    const before = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(before), 'edit');

    const links = await this.validateLinks(me.companyId, {
      orgNodeId: 'orgNodeId' in (patch ?? {}) ? this.id(patch.orgNodeId) : before.orgNodeId,
      indicatorId: 'indicatorId' in (patch ?? {}) ? this.id(patch.indicatorId) : before.indicatorId,
      ownerUserId: 'ownerUserId' in (patch ?? {}) ? this.id(patch.ownerUserId) : before.ownerUserId,
      approverUserId: 'approverUserId' in (patch ?? {}) ? this.id(patch.approverUserId) : before.approverUserId,
    });
    await this.assertWriteArea(me, links.area, 'edit');

    const data: any = { ...links.ids };
    if ('title' in (patch ?? {})) data.title = this.requiredText(patch.title, 'Titulo');
    if ('code' in (patch ?? {})) data.code = this.nullableText(patch.code);
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('type' in (patch ?? {})) data.type = this.parseType(patch.type) ?? before.type;
    if ('version' in (patch ?? {})) data.version = this.optionalInt(patch.version) ?? before.version;
    if ('content' in (patch ?? {})) data.content = this.nullableText(patch.content);
    if ('externalUrl' in (patch ?? {})) data.externalUrl = this.nullableText(patch.externalUrl);
    if ('changeNote' in (patch ?? {})) data.changeNote = this.nullableText(patch.changeNote);
    if ('validFrom' in (patch ?? {})) data.validFrom = this.optionalDate(patch.validFrom, 'Inicio de vigencia');
    if ('validUntil' in (patch ?? {})) data.validUntil = this.optionalDate(patch.validUntil, 'Validade');
    if ('reviewIntervalMonths' in (patch ?? {})) data.reviewIntervalMonths = this.optionalInt(patch.reviewIntervalMonths);
    const statusChanged = 'status' in (patch ?? {});
    if (statusChanged) {
      data.status = this.parseStatus(patch.status) ?? before.status;
      const stamps = this.statusTimestamps(data.status, before);
      data.approvedAt = stamps.approvedAt;
      data.publishedAt = stamps.publishedAt;
    }

    const updated = await this.prisma.document.update({ where: { id }, data, include: this.include() });

    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: updated.indicatorId,
      userId: me.sub,
      eventType: statusChanged && before.status !== updated.status ? TraceEventType.STATUS_CHANGED : TraceEventType.UPDATED,
      entityType: TraceEntityType.DOCUMENT,
      entityId: updated.id,
      title: statusChanged && before.status !== updated.status ? `Status do documento #${updated.number} alterado` : `Documento #${updated.number} atualizado`,
      description: updated.title,
      statusFrom: before.status,
      statusTo: updated.status,
      metadata: { type: updated.type, version: updated.version },
    });

    return this.enrich(updated);
  }

  async remove(me: AuthPayload, id: string) {
    const doc = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(doc), 'delete');
    const removed = await this.prisma.document.update({ where: { id }, data: { deletedAt: new Date() }, include: this.include() });
    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: doc.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.UPDATED,
      entityType: TraceEntityType.DOCUMENT,
      entityId: doc.id,
      title: `Documento #${doc.number} excluido`,
      description: doc.title,
      statusFrom: doc.status,
      statusTo: 'DELETED',
    });
    return this.enrich(removed);
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
}
