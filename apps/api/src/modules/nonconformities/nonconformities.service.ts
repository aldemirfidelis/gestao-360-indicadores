import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NonConformitySeverity, NonConformitySource, NonConformityStatus, Prisma, TraceEntityType, TraceEventType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TraceabilityService } from '../traceability/traceability.service';
import { AccessService } from '../access/access.service';
import type { AreaAction } from '../access/access.logic';
import { AuthPayload } from '../auth/auth.types';

// A nao conformidade (NC) estende o fluxo de melhoria: nasce de indicador/desvio/auditoria,
// recebe contencao, analise de causa, acao corretiva e verificacao de eficacia.
// Area derivada do vinculo (orgNode/indicador/desvio/acao). Isolamento espelha o de riscos.
const MODULE = 'nonconformities';
const CLOSED_STATUSES = new Set<NonConformityStatus>([NonConformityStatus.CLOSED, NonConformityStatus.CANCELLED]);

type NcFilters = {
  status?: string;
  source?: string;
  severity?: string;
  search?: string;
  orgNodeId?: string;
  indicatorId?: string;
  deviationId?: string;
  actionId?: string;
};

type LinkInput = {
  orgNodeId?: string | null;
  indicatorId?: string | null;
  deviationId?: string | null;
  correctiveActionId?: string | null;
  responsibleUserId?: string | null;
};

@Injectable()
export class NonConformitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
    private readonly access: AccessService,
  ) {}

  private include() {
    return {
      orgNode: { select: { id: true, name: true, type: true } },
      indicator: { select: { id: true, name: true, code: true, ownerNodeId: true } },
      deviation: {
        select: { id: true, number: true, title: true, status: true, indicator: { select: { id: true, ownerNodeId: true } } },
      },
      correctiveAction: {
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          ownerNodeId: true,
          effectivenessStatus: true,
          indicator: { select: { id: true, name: true, code: true, ownerNodeId: true } },
        },
      },
      responsibleUser: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    };
  }

  private areaOf(nc: any): string | null {
    return (
      nc.orgNodeId ??
      nc.orgNode?.id ??
      nc.indicator?.ownerNodeId ??
      nc.deviation?.indicator?.ownerNodeId ??
      nc.correctiveAction?.ownerNodeId ??
      nc.correctiveAction?.indicator?.ownerNodeId ??
      null
    );
  }

  private async assertWriteArea(me: AuthPayload, area: string | null, action: AreaAction) {
    if (area) await this.access.assertCanWrite(me.sub, area, MODULE, action);
  }

  private async assertViewArea(me: AuthPayload, nc: any) {
    const area = this.areaOf(nc);
    if (!area) return;
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    if (permitted && !permitted.includes(area)) {
      throw new ForbiddenException('Voce nao tem acesso as nao conformidades desta area.');
    }
  }

  private enrich(nc: any) {
    const dueDate = nc.dueDate ? new Date(nc.dueDate) : null;
    const isClosed = CLOSED_STATUSES.has(nc.status);
    const isOverdue = Boolean(dueDate && dueDate < new Date() && !isClosed);
    return { ...nc, isOverdue, areaId: this.areaOf(nc) };
  }

  private parseStatus(value?: string): NonConformityStatus | undefined {
    if (!value) return undefined;
    if (!Object.values(NonConformityStatus).includes(value as NonConformityStatus)) {
      throw new BadRequestException('Status de nao conformidade invalido.');
    }
    return value as NonConformityStatus;
  }

  private parseSource(value?: string): NonConformitySource | undefined {
    if (!value) return undefined;
    if (!Object.values(NonConformitySource).includes(value as NonConformitySource)) {
      throw new BadRequestException('Origem de nao conformidade invalida.');
    }
    return value as NonConformitySource;
  }

  private parseSeverity(value?: string): NonConformitySeverity | undefined {
    if (!value) return undefined;
    if (!Object.values(NonConformitySeverity).includes(value as NonConformitySeverity)) {
      throw new BadRequestException('Severidade de nao conformidade invalida.');
    }
    return value as NonConformitySeverity;
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

  private optionalDate(value: unknown, field: string): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`${field} invalido.`);
    return d;
  }

  private optionalBool(value: unknown): boolean | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    return value === true || value === 'true' || value === 1 || value === '1';
  }

  /** Filtro de visibilidade por area (null = sem restricao). NCs gerais sao sempre visiveis. */
  private visibilityWhere(permitted: string[] | null) {
    if (!permitted) return undefined;
    return {
      OR: [
        { orgNodeId: null, indicatorId: null, deviationId: null, correctiveActionId: null },
        { orgNodeId: { in: permitted } },
        { indicator: { ownerNodeId: { in: permitted } } },
        { deviation: { indicator: { ownerNodeId: { in: permitted } } } },
        { correctiveAction: { ownerNodeId: { in: permitted } } },
        { correctiveAction: { indicator: { ownerNodeId: { in: permitted } } } },
      ],
    };
  }

  private async loadScoped(id: string, companyId: string) {
    const nc = await this.prisma.nonConformity.findFirst({
      where: { id, companyId, deletedAt: null },
      include: this.include(),
    });
    if (!nc) throw new NotFoundException('Nao conformidade nao encontrada');
    return nc;
  }

  async list(me: AuthPayload, filters: NcFilters = {}) {
    const status = this.parseStatus(filters.status);
    const source = this.parseSource(filters.source);
    const severity = this.parseSeverity(filters.severity);
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const and: Prisma.NonConformityWhereInput[] = [];
    const areaFilter = this.visibilityWhere(permitted);
    if (areaFilter) and.push(areaFilter as Prisma.NonConformityWhereInput);

    const term = filters.search?.trim();
    if (term) {
      and.push({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { rootCause: { contains: term, mode: 'insensitive' } },
          { correctivePlan: { contains: term, mode: 'insensitive' } },
          { indicator: { name: { contains: term, mode: 'insensitive' } } },
          { indicator: { code: { contains: term, mode: 'insensitive' } } },
          { deviation: { title: { contains: term, mode: 'insensitive' } } },
          { responsibleUser: { name: { contains: term, mode: 'insensitive' } } },
        ],
      });
    }

    const items = await this.prisma.nonConformity.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(source ? { source } : {}),
        ...(severity ? { severity } : {}),
        ...(filters.orgNodeId ? { orgNodeId: filters.orgNodeId } : {}),
        ...(filters.indicatorId ? { indicatorId: filters.indicatorId } : {}),
        ...(filters.deviationId ? { deviationId: filters.deviationId } : {}),
        ...(filters.actionId ? { correctiveActionId: filters.actionId } : {}),
        ...(and.length ? { AND: and } : {}),
      },
      include: this.include(),
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { number: 'desc' }],
    });

    return items.map((nc) => this.enrich(nc));
  }

  async summary(me: AuthPayload) {
    const list = await this.list(me);
    const open = list.filter((nc: any) => !CLOSED_STATUSES.has(nc.status));
    const byStatus = Object.fromEntries(Object.values(NonConformityStatus).map((s) => [s, 0])) as Record<NonConformityStatus, number>;
    const bySeverity = Object.fromEntries(Object.values(NonConformitySeverity).map((s) => [s, 0])) as Record<NonConformitySeverity, number>;
    const bySource = Object.fromEntries(Object.values(NonConformitySource).map((s) => [s, 0])) as Record<NonConformitySource, number>;
    for (const nc of list as any[]) {
      byStatus[nc.status as NonConformityStatus]++;
      bySeverity[nc.severity as NonConformitySeverity]++;
      bySource[nc.source as NonConformitySource]++;
    }
    const topOpen = [...open]
      .sort((a: any, b: any) => {
        const sev = { CRITICAL: 0, MAJOR: 1, MINOR: 2 } as Record<string, number>;
        if (sev[a.severity] !== sev[b.severity]) return sev[a.severity] - sev[b.severity];
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return ad - bd;
      })
      .slice(0, 8)
      .map((nc: any) => ({
        id: nc.id,
        number: nc.number,
        title: nc.title,
        status: nc.status,
        source: nc.source,
        severity: nc.severity,
        dueDate: nc.dueDate,
        isOverdue: nc.isOverdue,
        responsibleUser: nc.responsibleUser,
        orgNode: nc.orgNode,
        indicator: nc.indicator ? { id: nc.indicator.id, name: nc.indicator.name, code: nc.indicator.code } : null,
      }));

    return {
      total: list.length,
      open: open.length,
      critical: open.filter((nc: any) => nc.severity === NonConformitySeverity.CRITICAL).length,
      overdue: open.filter((nc: any) => nc.isOverdue).length,
      effective: list.filter((nc: any) => nc.effectivenessOk === true).length,
      byStatus,
      bySeverity,
      bySource,
      topOpen,
    };
  }

  async getById(me: AuthPayload, id: string) {
    const nc = await this.loadScoped(id, me.companyId);
    await this.assertViewArea(me, nc);
    return this.enrich(nc);
  }

  async options(me: AuthPayload) {
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const areaWhere = permitted ? { id: { in: permitted } } : {};
    const indicatorWhere = permitted ? { ownerNodeId: { in: permitted } } : {};
    const deviationWhere: any = permitted ? { indicator: { ownerNodeId: { in: permitted } } } : {};
    const actionWhere: any = permitted
      ? { OR: [{ ownerNodeId: null, indicatorId: null }, { ownerNodeId: { in: permitted } }, { indicator: { ownerNodeId: { in: permitted } } }] }
      : {};

    const [orgNodes, indicators, deviations, actions, users] = await Promise.all([
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
      this.prisma.deviation.findMany({
        where: { companyId: me.companyId, deletedAt: null, ...deviationWhere },
        select: { id: true, number: true, title: true, status: true },
        orderBy: { number: 'desc' },
        take: 250,
      }),
      this.prisma.actionPlan.findMany({
        where: { companyId: me.companyId, deletedAt: null, ...actionWhere },
        select: { id: true, title: true, status: true, dueDate: true, ownerNodeId: true, indicatorId: true },
        orderBy: [{ dueDate: 'asc' }, { title: 'asc' }],
        take: 250,
      }),
      this.prisma.user.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true },
        select: { id: true, name: true, email: true, defaultNodeId: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      orgNodes,
      indicators,
      deviations,
      actions,
      users,
      statuses: Object.values(NonConformityStatus),
      sources: Object.values(NonConformitySource),
      severities: Object.values(NonConformitySeverity),
    };
  }

  async create(me: AuthPayload, body: any) {
    const title = this.requiredText(body?.title, 'Titulo');
    const source = this.parseSource(body?.source) ?? NonConformitySource.INDICATOR;
    const severity = this.parseSeverity(body?.severity) ?? NonConformitySeverity.MAJOR;
    const status = this.parseStatus(body?.status) ?? NonConformityStatus.OPEN;
    const links = await this.validateLinks(me.companyId, {
      orgNodeId: this.id(body?.orgNodeId),
      indicatorId: this.id(body?.indicatorId),
      deviationId: this.id(body?.deviationId),
      correctiveActionId: this.id(body?.correctiveActionId ?? body?.actionId),
      responsibleUserId: this.id(body?.responsibleUserId),
    });

    await this.assertWriteArea(me, links.area, 'create');

    const nc = await this.prisma.$transaction(async (tx) => {
      const last = await tx.nonConformity.findFirst({
        where: { companyId: me.companyId },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      return tx.nonConformity.create({
        data: {
          companyId: me.companyId,
          number: (last?.number ?? 0) + 1,
          title,
          description: this.nullableText(body?.description) ?? null,
          source,
          severity,
          status,
          immediateAction: this.nullableText(body?.immediateAction) ?? null,
          rootCause: this.nullableText(body?.rootCause) ?? null,
          correctivePlan: this.nullableText(body?.correctivePlan) ?? null,
          effectivenessCheck: this.nullableText(body?.effectivenessCheck) ?? null,
          effectivenessOk: this.optionalBool(body?.effectivenessOk) ?? null,
          dueDate: this.optionalDate(body?.dueDate, 'Prazo') ?? null,
          identifiedAt: this.optionalDate(body?.identifiedAt, 'Data de identificacao') ?? new Date(),
          closedAt: CLOSED_STATUSES.has(status) ? new Date() : null,
          createdById: me.sub,
          ...links.ids,
        },
        include: this.include(),
      });
    });

    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: nc.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.CREATED,
      entityType: TraceEntityType.NON_CONFORMITY,
      entityId: nc.id,
      title: `Nao conformidade #${nc.number} registrada`,
      description: nc.title,
      statusTo: nc.status,
      metadata: { source: nc.source, severity: nc.severity },
    });

    return this.enrich(nc);
  }

  async update(me: AuthPayload, id: string, patch: any) {
    const before = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(before), 'edit');

    const links = await this.validateLinks(me.companyId, {
      orgNodeId: 'orgNodeId' in (patch ?? {}) ? this.id(patch.orgNodeId) : before.orgNodeId,
      indicatorId: 'indicatorId' in (patch ?? {}) ? this.id(patch.indicatorId) : before.indicatorId,
      deviationId: 'deviationId' in (patch ?? {}) ? this.id(patch.deviationId) : before.deviationId,
      correctiveActionId:
        'correctiveActionId' in (patch ?? {}) || 'actionId' in (patch ?? {})
          ? this.id(patch.correctiveActionId ?? patch.actionId)
          : before.correctiveActionId,
      responsibleUserId: 'responsibleUserId' in (patch ?? {}) ? this.id(patch.responsibleUserId) : before.responsibleUserId,
    });
    await this.assertWriteArea(me, links.area, 'edit');

    const data: any = { ...links.ids };
    if ('title' in (patch ?? {})) data.title = this.requiredText(patch.title, 'Titulo');
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('source' in (patch ?? {})) data.source = this.parseSource(patch.source) ?? before.source;
    if ('severity' in (patch ?? {})) data.severity = this.parseSeverity(patch.severity) ?? before.severity;
    const statusChanged = 'status' in (patch ?? {});
    if (statusChanged) {
      data.status = this.parseStatus(patch.status) ?? before.status;
      data.closedAt = CLOSED_STATUSES.has(data.status) ? before.closedAt ?? new Date() : null;
    }
    if ('immediateAction' in (patch ?? {})) data.immediateAction = this.nullableText(patch.immediateAction);
    if ('rootCause' in (patch ?? {})) data.rootCause = this.nullableText(patch.rootCause);
    if ('correctivePlan' in (patch ?? {})) data.correctivePlan = this.nullableText(patch.correctivePlan);
    if ('effectivenessCheck' in (patch ?? {})) data.effectivenessCheck = this.nullableText(patch.effectivenessCheck);
    if ('effectivenessOk' in (patch ?? {})) data.effectivenessOk = this.optionalBool(patch.effectivenessOk);
    if ('dueDate' in (patch ?? {})) data.dueDate = this.optionalDate(patch.dueDate, 'Prazo');
    if ('identifiedAt' in (patch ?? {})) data.identifiedAt = this.optionalDate(patch.identifiedAt, 'Data de identificacao') ?? before.identifiedAt;

    const updated = await this.prisma.nonConformity.update({ where: { id }, data, include: this.include() });

    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: updated.indicatorId,
      userId: me.sub,
      eventType: statusChanged && before.status !== updated.status ? TraceEventType.STATUS_CHANGED : TraceEventType.UPDATED,
      entityType: TraceEntityType.NON_CONFORMITY,
      entityId: updated.id,
      title: statusChanged && before.status !== updated.status ? `Status da NC #${updated.number} alterado` : `NC #${updated.number} atualizada`,
      description: updated.title,
      statusFrom: before.status,
      statusTo: updated.status,
      metadata: { source: updated.source, severity: updated.severity },
    });

    return this.enrich(updated);
  }

  async remove(me: AuthPayload, id: string) {
    const nc = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(nc), 'delete');
    const removed = await this.prisma.nonConformity.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: this.include(),
    });
    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: nc.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.UPDATED,
      entityType: TraceEntityType.NON_CONFORMITY,
      entityId: nc.id,
      title: `Nao conformidade #${nc.number} excluida`,
      description: nc.title,
      statusFrom: nc.status,
      statusTo: 'DELETED',
    });
    return this.enrich(removed);
  }

  private async validateLinks(companyId: string, input: LinkInput) {
    const ids = {
      orgNodeId: input.orgNodeId ?? null,
      indicatorId: input.indicatorId ?? null,
      deviationId: input.deviationId ?? null,
      correctiveActionId: input.correctiveActionId ?? null,
      responsibleUserId: input.responsibleUserId ?? null,
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
    if (ids.deviationId) {
      const deviation = await this.prisma.deviation.findFirst({
        where: { id: ids.deviationId, companyId, deletedAt: null },
        select: { indicator: { select: { ownerNodeId: true } } },
      });
      if (!deviation) throw new NotFoundException('Desvio nao encontrado');
      if (deviation.indicator?.ownerNodeId) areas.push(deviation.indicator.ownerNodeId);
    }
    if (ids.correctiveActionId) {
      const action = await this.prisma.actionPlan.findFirst({
        where: { id: ids.correctiveActionId, companyId, deletedAt: null },
        select: { ownerNodeId: true, indicator: { select: { ownerNodeId: true } } },
      });
      if (!action) throw new NotFoundException('Acao corretiva nao encontrada');
      const area = action.ownerNodeId ?? action.indicator?.ownerNodeId ?? null;
      if (area) areas.push(area);
    }
    if (ids.responsibleUserId) {
      const user = await this.prisma.user.findFirst({ where: { id: ids.responsibleUserId, companyId, deletedAt: null, active: true }, select: { id: true } });
      if (!user) throw new NotFoundException('Responsavel nao encontrado');
    }

    const uniqueAreas = Array.from(new Set(areas.filter(Boolean)));
    if (uniqueAreas.length > 1) {
      throw new ConflictException('Vinculos da nao conformidade pertencem a areas diferentes.');
    }
    return { ids, area: uniqueAreas[0] ?? null };
  }
}
