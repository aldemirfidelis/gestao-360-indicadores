import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Direction,
  FeedKind,
  IndicatorStatus,
  IndicatorType,
  IndicatorUnit,
  Periodicity,
  Prisma,
  TrafficLight,
  UserRoleEnum,
} from '@prisma/client';
import { calcStatus, IndicatorTargetUpsertInput } from '@g360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PeriodsService } from '../periods/periods.service';
import { ResultsService } from '../results/results.service';
import { lastNPeriodRefs, periodRefToDate } from './period.util';

export interface IndicatorFilter {
  companyId: string;
  ownerNodeId?: string;
  areaMacroId?: string;
  areaMicroId?: string;
  type?: string;
  periodicity?: string;
  responsibleUserId?: string;
  status?: string;
  search?: string;
  light?: TrafficLight;
  year?: string;
}

type IndicatorWriteInput = {
  companyId?: string | null;
  ownerNodeId?: string | null;
  guidelineNodeId?: string | null;
  strategicObjectiveId?: string | null;
  responsibleUserId?: string | null;
  feederUserId?: string | null;
  parentIndicatorId?: string | null;
  name?: string | null;
  code?: string | null;
  description?: string | null;
  type?: string | null;
  category?: string | null;
  unit?: string | null;
  unitLabel?: string | null;
  periodicity?: string | null;
  direction?: string | null;
  formula?: string | null;
  source?: string | null;
  feedKind?: string | null;
  status?: string | null;
  weight?: number | string | null;
  yellowToleranceP?: number | string | null;
  initialTarget?: number | string | null;
  initialResult?: number | string | null;
  initialPeriodRef?: string | null;
  note?: string | null;
};

type TargetWriteInput = {
  periodRef?: string | null;
  target?: number | string | null;
  lowerBound?: number | string | null;
  upperBound?: number | string | null;
  weight?: number | string | null;
  justification?: string | null;
};

type ResultWriteInput = {
  periodRef?: string | null;
  value?: number | string | null;
  note?: string | null;
  justification?: string | null;
};

@Injectable()
export class IndicatorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periods: PeriodsService,
    private readonly results: ResultsService,
  ) {}

  async list(f: IndicatorFilter) {
    const ownerNodeIds = await this.resolveOwnerFilter(f.companyId, f);
    const currentPeriod = await this.periods.current(f.companyId);
    const year = parseYear(f.year) ?? currentPeriod.year;
    const anchor = new Date(Date.UTC(year, 11, 31, 12, 0, 0, 0));

    const items = await this.prisma.indicator.findMany({
      where: {
        companyId: f.companyId,
        deletedAt: null,
        ...(ownerNodeIds ? { ownerNodeId: { in: ownerNodeIds } } : {}),
        ...(f.type ? { type: f.type as IndicatorType } : {}),
        ...(f.periodicity ? { periodicity: f.periodicity as Periodicity } : {}),
        ...(f.status ? { status: f.status as IndicatorStatus } : {}),
        ...(f.responsibleUserId ? { responsibleUserId: f.responsibleUserId } : {}),
        ...(f.search
          ? {
              OR: [
                { name: { contains: f.search, mode: 'insensitive' } },
                { code: { contains: f.search, mode: 'insensitive' } },
                { description: { contains: f.search, mode: 'insensitive' } },
                { ownerNode: { name: { contains: f.search, mode: 'insensitive' } } },
                { responsibleUser: { name: { contains: f.search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        company: { select: { id: true, name: true, tradeName: true } },
        ownerNode: {
          select: {
            id: true,
            name: true,
            type: true,
            parentId: true,
            parent: { select: { id: true, name: true, type: true, parentId: true } },
          },
        },
        guidelineNode: { select: { id: true, name: true, type: true } },
        responsibleUser: { select: { id: true, name: true } },
        strategicObjective: {
          select: {
            id: true,
            name: true,
            perspective: { select: { id: true, name: true, color: true } },
            map: { select: { id: true, name: true } },
          },
        },
        parentRelations: {
          select: {
            parent: { select: { id: true, name: true, code: true } },
          },
        },
        _count: {
          select: {
            actions: true,
            meetings: true,
            targets: true,
            results: true,
            childRelations: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    const ids = items.map((item) => item.id);
    const refsByIndicator = new Map<string, string[]>();
    const allRefs = new Set<string>();
    for (const item of items) {
      const refs = lastNPeriodRefs(item.periodicity, 12, anchor);
      refsByIndicator.set(item.id, refs);
      refs.forEach((ref) => allRefs.add(ref));
    }

    const [targets, results] = ids.length
      ? await Promise.all([
          this.prisma.indicatorTarget.findMany({
            where: { indicatorId: { in: ids }, periodRef: { in: [...allRefs] } },
          }),
          this.prisma.indicatorResult.findMany({
            where: { indicatorId: { in: ids }, periodRef: { in: [...allRefs] } },
            orderBy: { periodDate: 'desc' },
          }),
        ])
      : [[], []];

    const targetMap = new Map(targets.map((target) => [`${target.indicatorId}:${target.periodRef}`, target]));
    const resultMap = new Map(results.map((result) => [`${result.indicatorId}:${result.periodRef}`, result]));
    const lastByIndicator = new Map<string, (typeof results)[number]>();
    for (const result of results) {
      if (!lastByIndicator.has(result.indicatorId)) lastByIndicator.set(result.indicatorId, result);
    }

    const rows = items.map((indicator) => {
      const refs = refsByIndicator.get(indicator.id) ?? [];
      const currentRef = refs[refs.length - 1];
      const currentTarget = currentRef ? targetMap.get(`${indicator.id}:${currentRef}`) : null;
      const last = lastByIndicator.get(indicator.id) ?? null;
      const area = deriveArea(indicator.ownerNode);
      const parentIndicator = indicator.parentRelations?.[0]?.parent ?? null;
      return {
        ...indicator,
        parentIndicator,
        isMacro: (indicator._count?.childRelations ?? 0) > 0,
        areaMacro: area.areaMacro,
        areaMicro: area.areaMicro,
        currentTarget: currentTarget
          ? {
              periodRef: currentTarget.periodRef,
              target: currentTarget.target,
              lowerBound: currentTarget.lowerBound,
              upperBound: currentTarget.upperBound,
            }
          : null,
        last: last
          ? {
              id: last.id,
              periodRef: last.periodRef,
              value: last.value,
              light: last.light,
              attainment: last.attainment,
              deviationPct: last.deviationPct,
              note: last.note,
              createdAt: last.createdAt,
              updatedAt: last.updatedAt,
            }
          : null,
        monthlyHistory: refs.map((periodRef) => {
          const target = targetMap.get(`${indicator.id}:${periodRef}`);
          const result = resultMap.get(`${indicator.id}:${periodRef}`);
          return {
            periodRef,
            month: monthLabel(periodRef),
            meta: target?.target ?? null,
            target: target?.target ?? null,
            realizado: result?.value ?? null,
            value: result?.value ?? null,
            attainment: result?.attainment ?? null,
            status: result?.light ?? 'GRAY',
          };
        }),
      };
    });

    return f.light ? rows.filter((row) => row.last?.light === f.light) : rows;
  }

  async options(me: AuthPayload) {
    const companyWhere = me.role === UserRoleEnum.SUPER_ADMIN ? { deletedAt: null } : { id: me.companyId, deletedAt: null };
    const [companies, orgNodes, users, strategicObjectives, currentPeriod] = await Promise.all([
      this.prisma.company.findMany({
        where: companyWhere,
        select: { id: true, name: true, tradeName: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.orgNode.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true },
        select: {
          id: true,
          companyId: true,
          parentId: true,
          name: true,
          code: true,
          type: true,
          responsibleUserId: true,
          parent: { select: { id: true, name: true, type: true, parentId: true } },
          _count: { select: { children: true, indicatorsOwned: true } },
        },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.user.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.strategicObjective.findMany({
        where: { deletedAt: null, active: true, map: { companyId: me.companyId, deletedAt: null } },
        select: {
          id: true,
          name: true,
          perspective: { select: { id: true, name: true, color: true } },
          map: { select: { id: true, name: true } },
        },
        orderBy: [{ perspective: { position: 'asc' } }, { position: 'asc' }, { name: 'asc' }],
      }),
      this.periods.current(me.companyId),
    ]);

    return {
      companies,
      orgNodes,
      users,
      strategicObjectives,
      currentPeriod,
      indicatorTypes: Object.values(IndicatorType),
      units: Object.values(IndicatorUnit),
      periodicities: Object.values(Periodicity),
      directions: Object.values(Direction),
      statuses: Object.values(IndicatorStatus),
    };
  }

  async getById(id: string, me?: AuthPayload) {
    const indicator = await this.prisma.indicator.findFirst({
      where: { id, deletedAt: null, ...(me && me.role !== UserRoleEnum.SUPER_ADMIN ? { companyId: me.companyId } : {}) },
      include: {
        company: { select: { id: true, name: true, tradeName: true } },
        ownerNode: {
          include: {
            parent: { select: { id: true, name: true, type: true, parentId: true } },
          },
        },
        guidelineNode: { select: { id: true, name: true, type: true } },
        responsibleUser: true,
        feederUser: true,
        strategicObjective: {
          include: {
            perspective: { select: { id: true, name: true, color: true } },
            map: { select: { id: true, name: true } },
          },
        },
        targets: { orderBy: { periodRef: 'asc' } },
        results: { orderBy: { periodDate: 'asc' } },
        actions: { select: { id: true, title: true, status: true, dueDate: true } },
        meetings: { select: { id: true, title: true, status: true, startsAt: true } },
      },
    });
    if (!indicator) throw new NotFoundException('Indicador nao encontrado');
    const area = deriveArea(indicator.ownerNode);
    return { ...indicator, areaMacro: area.areaMacro, areaMicro: area.areaMicro };
  }

  async create(me: AuthPayload, input: IndicatorWriteInput) {
    const companyId = this.scopeCompany(me, input.companyId);
    const data = await this.buildCreateData(companyId, input);
    await this.ensureCodeAvailable(companyId, data.code ?? null);
    const parentIndicatorId = cleanString(input.parentIndicatorId);

    const created = await this.prisma.$transaction(async (tx) => {
      const indicator = await tx.indicator.create({ data });
      await this.syncObjectiveLink(tx, indicator.id, indicator.strategicObjectiveId, me.sub);
      if (parentIndicatorId) {
        await this.syncParentRelation(tx, companyId, indicator.id, parentIndicatorId);
      }
      return indicator;
    });

    const periodRef = cleanString(input.initialPeriodRef) ?? (await this.periods.currentMonthlyRef(companyId));
    const initialTarget = optionalNumber(input.initialTarget, 'Meta inicial');
    const initialResult = optionalNumber(input.initialResult, 'Realizado inicial');
    if (initialTarget !== undefined) {
      await this.upsertTarget({ indicatorId: created.id, periodRef, target: initialTarget, weight: 1 }, me);
    }
    if (initialResult !== undefined) {
      await this.upsertResult(me, created.id, { periodRef, value: initialResult, note: input.note ?? null });
    }

    await this.audit(me, 'CREATE', 'Indicator', created.id, null, created, 'Indicador criado');
    return this.getById(created.id, me);
  }

  async update(me: AuthPayload, id: string, input: IndicatorWriteInput) {
    const current = await this.findScopedIndicator(id, me);
    const data = await this.buildUpdateData(current.companyId, input);
    if (data.code !== undefined && data.code !== current.code) {
      await this.ensureCodeAvailable(current.companyId, data.code as string | null, id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const indicator = await tx.indicator.update({ where: { id }, data });
      if (data.strategicObjectiveId !== undefined) {
        await this.syncObjectiveLink(tx, indicator.id, indicator.strategicObjectiveId, me.sub);
      }
      if (input.parentIndicatorId !== undefined) {
        await this.syncParentRelation(tx, current.companyId, indicator.id, cleanString(input.parentIndicatorId) ?? null);
      }
      return indicator;
    });

    await this.audit(me, 'UPDATE', 'Indicator', id, current, updated, 'Indicador editado');
    return this.getById(id, me);
  }

  async remove(me: AuthPayload, id: string) {
    const current = await this.findScopedIndicator(id, me);
    const updated = await this.prisma.indicator.update({
      where: { id },
      data: { deletedAt: new Date(), status: IndicatorStatus.INACTIVE },
    });
    await this.audit(me, 'DELETE', 'Indicator', id, current, updated, 'Exclusao logica do indicador');
    return updated;
  }

  // --- targets ---

  async upsertTarget(input: IndicatorTargetUpsertInput & { justification?: string | null }, me?: AuthPayload) {
    const indicator = me ? await this.findScopedIndicator(input.indicatorId, me) : await this.findIndicatorOrThrow(input.indicatorId);
    const before = await this.prisma.indicatorTarget.findUnique({
      where: {
        indicatorId_periodRef: {
          indicatorId: input.indicatorId,
          periodRef: input.periodRef,
        },
      },
    });
    const t = await this.prisma.indicatorTarget.upsert({
      where: {
        indicatorId_periodRef: {
          indicatorId: input.indicatorId,
          periodRef: input.periodRef,
        },
      },
      create: {
        indicatorId: input.indicatorId,
        periodRef: input.periodRef,
        target: input.target,
        lowerBound: input.lowerBound ?? null,
        upperBound: input.upperBound ?? null,
        weight: input.weight ?? 1,
      },
      update: {
        target: input.target,
        lowerBound: input.lowerBound ?? null,
        upperBound: input.upperBound ?? null,
        weight: input.weight ?? 1,
      },
    });
    await this.recalcResultStatus(input.indicatorId, input.periodRef);
    if (me) {
      await this.audit(me, before ? 'UPDATE_TARGET' : 'CREATE_TARGET', 'IndicatorTarget', input.indicatorId, before, t, input.justification ?? 'Meta alterada');
    }
    return { ...t, indicator };
  }

  async listTargets(indicatorId: string, me?: AuthPayload) {
    if (me) await this.findScopedIndicator(indicatorId, me);
    return this.prisma.indicatorTarget.findMany({
      where: { indicatorId },
      orderBy: { periodRef: 'asc' },
    });
  }

  async upsertTargetForIndicator(me: AuthPayload, id: string, body: TargetWriteInput) {
    const periodRef = requiredString(body.periodRef, 'Informe o periodo da meta');
    const target = requiredNumber(body.target, 'Informe a meta');
    return this.upsertTarget(
      {
        indicatorId: id,
        periodRef,
        target,
        lowerBound: optionalNumber(body.lowerBound, 'Limite inferior') ?? null,
        upperBound: optionalNumber(body.upperBound, 'Limite superior') ?? null,
        weight: optionalNumber(body.weight, 'Peso') ?? 1,
        justification: cleanString(body.justification),
      },
      me,
    );
  }

  async upsertTargetsBatchForIndicator(
    me: AuthPayload,
    id: string,
    body: { items?: Array<TargetWriteInput & { periodRef?: string }>; justification?: string | null },
  ) {
    await this.findScopedIndicator(id, me);
    const items = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) return { count: 0 };
    const justification = cleanString(body?.justification) ?? null;
    let count = 0;
    for (const item of items) {
      const periodRef = requiredString(item.periodRef, 'Informe o periodo da meta');
      const target = requiredNumber(item.target, 'Informe a meta');
      await this.upsertTarget(
        {
          indicatorId: id,
          periodRef,
          target,
          lowerBound: optionalNumber(item.lowerBound, 'Limite inferior') ?? null,
          upperBound: optionalNumber(item.upperBound, 'Limite superior') ?? null,
          weight: optionalNumber(item.weight, 'Peso') ?? 1,
          justification,
        },
        me,
      );
      count++;
    }
    return { count };
  }

  async upsertResult(me: AuthPayload, id: string, body: ResultWriteInput) {
    const indicator = await this.findScopedIndicator(id, me);
    const periodRef = requiredString(body.periodRef, 'Informe o periodo do realizado');
    const value = requiredNumber(body.value, 'Informe o valor realizado');
    const before = await this.prisma.indicatorResult.findUnique({
      where: { indicatorId_periodRef: { indicatorId: id, periodRef } },
    });
    const out = await this.results.upsert({ indicatorId: id, periodRef, value, note: cleanString(body.note) ?? null }, me.sub);
    await this.audit(
      me,
      before ? 'UPDATE_RESULT' : 'CREATE_RESULT',
      'IndicatorResult',
      id,
      before,
      out.result,
      cleanString(body.justification) ?? 'Realizado alterado',
    );
    return { ...out, indicator };
  }

  async history(me: AuthPayload, id: string) {
    const indicator = await this.findScopedIndicator(id, me);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        companyId: indicator.companyId,
        module: 'Indicadores',
        OR: [
          { entityId: id },
          { payload: { contains: id } },
          { beforeValue: { contains: id } },
          { afterValue: { contains: id } },
        ],
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { logs };
  }

  /**
   * Aplica recomputo de status, atingimento e desvios. Util quando meta muda.
   */
  async recalcResultStatus(indicatorId: string, periodRef: string) {
    const result = await this.prisma.indicatorResult.findUnique({
      where: { indicatorId_periodRef: { indicatorId, periodRef } },
    });
    if (!result) return;
    const indicator = await this.prisma.indicator.findUnique({
      where: { id: indicatorId },
      select: { direction: true, yellowToleranceP: true },
    });
    const target = await this.prisma.indicatorTarget.findUnique({
      where: { indicatorId_periodRef: { indicatorId, periodRef } },
    });
    const status = calcStatus({
      value: result.value,
      target: target?.target ?? null,
      direction: indicator?.direction as Direction,
      lowerBound: target?.lowerBound ?? null,
      upperBound: target?.upperBound ?? null,
      yellowToleranceP: indicator?.yellowToleranceP ?? 10,
    });
    await this.prisma.indicatorResult.update({
      where: { id: result.id },
      data: {
        light: status.light as TrafficLight,
        attainment: status.attainment,
        deviationAbs: status.deviationAbs,
        deviationPct: status.deviationPct,
      },
    });
  }

  // --- relacoes (arvore de indicadores) ---

  async listChildren(parentId: string) {
    return this.prisma.indicatorTreeRelation.findMany({
      where: { parentId },
      include: { child: { select: { id: true, name: true, code: true } } },
    });
  }

  async addRelation(parentId: string, childId: string, kind: string, weight: number) {
    if (parentId === childId) throw new Error('Indicador nao pode se relacionar com ele mesmo');
    return this.prisma.indicatorTreeRelation.upsert({
      where: { parentId_childId: { parentId, childId } },
      create: { parentId, childId, kind: kind as any, weight },
      update: { kind: kind as any, weight },
    });
  }

  async removeRelation(parentId: string, childId: string) {
    return this.prisma.indicatorTreeRelation.deleteMany({ where: { parentId, childId } });
  }

  /**
   * Retorna grafo completo da arvore de indicadores (nodes + edges).
   * Inclui o ultimo light de cada indicador.
   */
  async treeGraph(companyId: string) {
    const indicators = await this.prisma.indicator.findMany({
      where: { companyId, deletedAt: null, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        ownerNode: { select: { name: true } },
        results: { orderBy: { periodDate: 'desc' }, take: 1, select: { light: true, attainment: true } },
      },
    });
    const ids = indicators.map((i) => i.id);
    const relations = await this.prisma.indicatorTreeRelation.findMany({
      where: { parentId: { in: ids } },
    });
    return {
      nodes: indicators.map((i) => ({
        id: i.id,
        label: i.name,
        code: i.code,
        type: i.type,
        owner: i.ownerNode.name,
        light: i.results[0]?.light ?? 'GRAY',
        attainment: i.results[0]?.attainment ?? null,
      })),
      edges: relations.map((r) => ({
        id: r.id,
        from: r.parentId,
        to: r.childId,
        kind: r.kind,
        weight: r.weight,
      })),
    };
  }

  /**
   * Simulacao: dado um indicador "fonte", encontra todos os descendentes
   * ate profundidade max, com o peso acumulado da influencia.
   */
  async simulateImpact(sourceId: string, maxDepth = 4) {
    const all = await this.prisma.indicatorTreeRelation.findMany();
    const map = new Map<string, typeof all>();
    all.forEach((r) => {
      if (!map.has(r.parentId)) map.set(r.parentId, []);
      map.get(r.parentId)!.push(r);
    });
    const impacted: Array<{ indicatorId: string; depth: number; accumulatedWeight: number; kind: string }> = [];
    const seen = new Set<string>([sourceId]);
    type Q = { id: string; depth: number; weight: number; kind: string };
    const queue: Q[] = (map.get(sourceId) ?? []).map((r) => ({
      id: r.childId,
      depth: 1,
      weight: r.weight,
      kind: r.kind,
    }));
    while (queue.length) {
      const n = queue.shift()!;
      if (seen.has(n.id) || n.depth > maxDepth) continue;
      seen.add(n.id);
      impacted.push({ indicatorId: n.id, depth: n.depth, accumulatedWeight: n.weight, kind: n.kind });
      for (const r of map.get(n.id) ?? []) {
        queue.push({ id: r.childId, depth: n.depth + 1, weight: n.weight * r.weight, kind: r.kind });
      }
    }
    const ids = impacted.map((i) => i.indicatorId);
    const indicators = await this.prisma.indicator.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, code: true, results: { orderBy: { periodDate: 'desc' }, take: 1, select: { light: true } } },
    });
    const byId = new Map(indicators.map((i) => [i.id, i]));
    return impacted.map((i) => ({
      ...i,
      name: byId.get(i.indicatorId)?.name ?? '?',
      code: byId.get(i.indicatorId)?.code ?? null,
      light: byId.get(i.indicatorId)?.results[0]?.light ?? 'GRAY',
    }));
  }

  // --- series historicas ---

  async series(indicatorId: string, points = 12) {
    const indicator = await this.prisma.indicator.findUnique({
      where: { id: indicatorId },
      select: { periodicity: true, companyId: true },
    });
    if (!indicator) throw new NotFoundException('Indicador nao encontrado');
    const anchor = await this.periods.currentAnchorDate(indicator.companyId);
    const refs = lastNPeriodRefs(indicator.periodicity, points, anchor);
    const [targets, results] = await Promise.all([
      this.prisma.indicatorTarget.findMany({
        where: { indicatorId, periodRef: { in: refs } },
      }),
      this.prisma.indicatorResult.findMany({
        where: { indicatorId, periodRef: { in: refs } },
      }),
    ]);
    const tMap = new Map(targets.map((t) => [t.periodRef, t]));
    const rMap = new Map(results.map((r) => [r.periodRef, r]));
    return refs.map((ref) => ({
      periodRef: ref,
      periodDate: periodRefToDate(ref, indicator.periodicity),
      target: tMap.get(ref)?.target ?? null,
      value: rMap.get(ref)?.value ?? null,
      light: rMap.get(ref)?.light ?? 'GRAY',
      attainment: rMap.get(ref)?.attainment ?? null,
    }));
  }

  private scopeCompany(me: AuthPayload, inputCompanyId?: string | null) {
    if (me.role === UserRoleEnum.SUPER_ADMIN && cleanString(inputCompanyId)) return cleanString(inputCompanyId)!;
    return me.companyId;
  }

  private async resolveOwnerFilter(companyId: string, f: IndicatorFilter) {
    const selected = f.areaMicroId ?? f.ownerNodeId;
    if (selected) return [selected];
    if (!f.areaMacroId) return null;
    const nodes = await this.prisma.orgNode.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    const children = new Map<string, string[]>();
    for (const node of nodes) {
      if (!node.parentId) continue;
      const list = children.get(node.parentId) ?? [];
      list.push(node.id);
      children.set(node.parentId, list);
    }
    const out = new Set<string>([f.areaMacroId]);
    const queue = [f.areaMacroId];
    while (queue.length) {
      const parentId = queue.shift()!;
      for (const childId of children.get(parentId) ?? []) {
        if (out.has(childId)) continue;
        out.add(childId);
        queue.push(childId);
      }
    }
    return [...out];
  }

  private async buildCreateData(companyId: string, input: IndicatorWriteInput): Promise<Prisma.IndicatorUncheckedCreateInput> {
    const ownerNodeId = requiredString(input.ownerNodeId, 'Selecione a area micro ou estrutura responsavel');
    await this.validateLinks(companyId, {
      ownerNodeId,
      guidelineNodeId: cleanString(input.guidelineNodeId),
      strategicObjectiveId: cleanString(input.strategicObjectiveId),
      responsibleUserId: cleanString(input.responsibleUserId),
      feederUserId: cleanString(input.feederUserId),
    });
    return {
      companyId,
      ownerNodeId,
      guidelineNodeId: cleanString(input.guidelineNodeId) ?? null,
      strategicObjectiveId: cleanString(input.strategicObjectiveId) ?? null,
      responsibleUserId: cleanString(input.responsibleUserId) ?? null,
      feederUserId: cleanString(input.feederUserId) ?? null,
      name: requiredString(input.name, 'Informe o nome do indicador'),
      code: cleanString(input.code) ?? null,
      description: cleanString(input.description) ?? null,
      type: enumOrDefault(IndicatorType, input.type, IndicatorType.OPERATIONAL),
      category: cleanString(input.category) ?? null,
      unit: enumOrDefault(IndicatorUnit, input.unit, IndicatorUnit.PERCENT),
      unitLabel: cleanString(input.unitLabel) ?? null,
      periodicity: enumOrDefault(Periodicity, input.periodicity, Periodicity.MONTHLY),
      direction: enumOrDefault(Direction, input.direction, Direction.HIGHER_BETTER),
      formula: cleanString(input.formula) ?? null,
      source: cleanString(input.source) ?? null,
      feedKind: enumOrDefault(FeedKind, input.feedKind, FeedKind.MANUAL),
      status: enumOrDefault(IndicatorStatus, input.status, IndicatorStatus.ACTIVE),
      weight: optionalNumber(input.weight, 'Peso') ?? 1,
      yellowToleranceP: optionalNumber(input.yellowToleranceP, 'Tolerancia amarela') ?? 10,
    };
  }

  private async buildUpdateData(companyId: string, input: IndicatorWriteInput): Promise<Prisma.IndicatorUncheckedUpdateInput> {
    const links = {
      ownerNodeId: cleanString(input.ownerNodeId),
      guidelineNodeId: cleanString(input.guidelineNodeId),
      strategicObjectiveId: cleanString(input.strategicObjectiveId),
      responsibleUserId: cleanString(input.responsibleUserId),
      feederUserId: cleanString(input.feederUserId),
    };
    await this.validateLinks(companyId, links);

    const data: Prisma.IndicatorUncheckedUpdateInput = {};
    if (input.ownerNodeId !== undefined) data.ownerNodeId = links.ownerNodeId ?? undefined;
    if (input.guidelineNodeId !== undefined) data.guidelineNodeId = links.guidelineNodeId ?? null;
    if (input.strategicObjectiveId !== undefined) data.strategicObjectiveId = links.strategicObjectiveId ?? null;
    if (input.responsibleUserId !== undefined) data.responsibleUserId = links.responsibleUserId ?? null;
    if (input.feederUserId !== undefined) data.feederUserId = links.feederUserId ?? null;
    if (input.name !== undefined) data.name = requiredString(input.name, 'Informe o nome do indicador');
    if (input.code !== undefined) data.code = cleanString(input.code) ?? null;
    if (input.description !== undefined) data.description = cleanString(input.description) ?? null;
    if (input.type !== undefined) data.type = enumOrDefault(IndicatorType, input.type, IndicatorType.OPERATIONAL);
    if (input.category !== undefined) data.category = cleanString(input.category) ?? null;
    if (input.unit !== undefined) data.unit = enumOrDefault(IndicatorUnit, input.unit, IndicatorUnit.PERCENT);
    if (input.unitLabel !== undefined) data.unitLabel = cleanString(input.unitLabel) ?? null;
    if (input.periodicity !== undefined) data.periodicity = enumOrDefault(Periodicity, input.periodicity, Periodicity.MONTHLY);
    if (input.direction !== undefined) data.direction = enumOrDefault(Direction, input.direction, Direction.HIGHER_BETTER);
    if (input.formula !== undefined) data.formula = cleanString(input.formula) ?? null;
    if (input.source !== undefined) data.source = cleanString(input.source) ?? null;
    if (input.feedKind !== undefined) data.feedKind = enumOrDefault(FeedKind, input.feedKind, FeedKind.MANUAL);
    if (input.status !== undefined) data.status = enumOrDefault(IndicatorStatus, input.status, IndicatorStatus.ACTIVE);
    if (input.weight !== undefined) data.weight = optionalNumber(input.weight, 'Peso') ?? 1;
    if (input.yellowToleranceP !== undefined) data.yellowToleranceP = optionalNumber(input.yellowToleranceP, 'Tolerancia amarela') ?? 10;
    return data;
  }

  private async validateLinks(
    companyId: string,
    links: {
      ownerNodeId?: string | null;
      guidelineNodeId?: string | null;
      strategicObjectiveId?: string | null;
      responsibleUserId?: string | null;
      feederUserId?: string | null;
    },
  ) {
    if (links.ownerNodeId) {
      const node = await this.prisma.orgNode.findFirst({ where: { id: links.ownerNodeId, companyId, deletedAt: null }, select: { id: true } });
      if (!node) throw new NotFoundException('Area responsavel nao encontrada para a empresa');
    }
    if (links.guidelineNodeId) {
      const node = await this.prisma.orgNode.findFirst({ where: { id: links.guidelineNodeId, companyId, deletedAt: null }, select: { id: true } });
      if (!node) throw new NotFoundException('Diretriz nao encontrada para a empresa');
    }
    for (const userId of [links.responsibleUserId, links.feederUserId].filter(Boolean) as string[]) {
      const user = await this.prisma.user.findFirst({ where: { id: userId, companyId, deletedAt: null }, select: { id: true } });
      if (!user) throw new NotFoundException('Usuario responsavel nao encontrado para a empresa');
    }
    if (links.strategicObjectiveId) {
      const objective = await this.prisma.strategicObjective.findFirst({
        where: { id: links.strategicObjectiveId, deletedAt: null, map: { companyId, deletedAt: null } },
        select: { id: true },
      });
      if (!objective) throw new NotFoundException('Objetivo estrategico nao encontrado para a empresa');
    }
  }

  private async ensureCodeAvailable(companyId: string, code: string | null, ignoreId?: string) {
    if (!code) return;
    const existing = await this.prisma.indicator.findFirst({
      where: { companyId, code, deletedAt: null, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Ja existe indicador com este codigo nesta empresa');
  }

  private async findIndicatorOrThrow(id: string) {
    const indicator = await this.prisma.indicator.findFirst({ where: { id, deletedAt: null } });
    if (!indicator) throw new NotFoundException('Indicador nao encontrado');
    return indicator;
  }

  private async findScopedIndicator(id: string, me: AuthPayload) {
    const indicator = await this.prisma.indicator.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(me.role !== UserRoleEnum.SUPER_ADMIN ? { companyId: me.companyId } : {}),
      },
    });
    if (!indicator) throw new NotFoundException('Indicador nao encontrado');
    return indicator;
  }

  private async syncParentRelation(
    tx: Prisma.TransactionClient,
    companyId: string,
    childId: string,
    parentId: string | null,
  ) {
    if (!parentId) {
      await tx.indicatorTreeRelation.deleteMany({ where: { childId } });
      return;
    }
    if (parentId === childId) {
      throw new BadRequestException('Indicador macro nao pode ser ele mesmo.');
    }
    const parent = await tx.indicator.findFirst({
      where: { id: parentId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!parent) {
      throw new NotFoundException('Indicador macro nao encontrado nesta empresa.');
    }
    await tx.indicatorTreeRelation.deleteMany({ where: { childId, NOT: { parentId } } });
    await tx.indicatorTreeRelation.upsert({
      where: { parentId_childId: { parentId, childId } },
      create: { parentId, childId },
      update: {},
    });
  }

  private async syncObjectiveLink(
    tx: Prisma.TransactionClient,
    indicatorId: string,
    objectiveId: string | null,
    userId: string,
  ) {
    if (!objectiveId) {
      await tx.strategicObjectiveIndicator.updateMany({
        where: { indicatorId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      return;
    }
    await tx.strategicObjectiveIndicator.updateMany({
      where: { indicatorId, deletedAt: null, NOT: { objectiveId } },
      data: { deletedAt: new Date() },
    });
    await tx.strategicObjectiveIndicator.upsert({
      where: { objectiveId_indicatorId: { objectiveId, indicatorId } },
      create: { objectiveId, indicatorId, createdById: userId },
      update: { deletedAt: null },
    });
  }

  private async audit(
    me: AuthPayload,
    action: string,
    entity: string,
    entityId: string,
    beforeValue: unknown,
    afterValue: unknown,
    message: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        companyId: me.companyId,
        userId: me.sub,
        action,
        module: 'Indicadores',
        entity,
        entityId,
        recordLabel: message,
        payload: JSON.stringify({ message }),
        beforeValue: stringifyAudit(beforeValue),
        afterValue: stringifyAudit(afterValue),
        result: 'SUCCESS',
      },
    });
  }
}

function deriveArea(ownerNode: { id: string; name: string; type?: string; parentId?: string | null; parent?: { id: string; name: string; type?: string; parentId?: string | null } | null }) {
  if (ownerNode.parent) {
    return {
      areaMacro: { id: ownerNode.parent.id, name: ownerNode.parent.name, type: ownerNode.parent.type ?? null },
      areaMicro: { id: ownerNode.id, name: ownerNode.name, type: ownerNode.type ?? null },
    };
  }
  return {
    areaMacro: { id: ownerNode.id, name: ownerNode.name, type: ownerNode.type ?? null },
    areaMicro: null,
  };
}

function cleanString(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function requiredString(value: unknown, message: string) {
  const out = cleanString(value);
  if (!out) throw new BadRequestException(message);
  return out;
}

function requiredNumber(value: unknown, message: string) {
  const out = optionalNumber(value, message);
  if (out === undefined) throw new BadRequestException(message);
  return out;
}

function optionalNumber(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(number)) throw new BadRequestException(`${field} deve ser numerico`);
  return number;
}

function enumOrDefault<T extends Record<string, string>>(values: T, value: unknown, fallback: T[keyof T]) {
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  const clean = value.trim();
  if (!Object.values(values).includes(clean)) {
    throw new BadRequestException(`Valor invalido: ${clean}`);
  }
  return clean as T[keyof T];
}

function parseYear(value?: string) {
  if (!value) return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2026 || year > 2100) throw new BadRequestException('Ano invalido para indicadores');
  return year;
}

function monthLabel(periodRef: string) {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const match = periodRef.match(/^\d{4}-(\d{2})$/);
  if (!match) return periodRef;
  const index = Number(match[1]) - 1;
  return months[index] ?? periodRef;
}

function stringifyAudit(value: unknown) {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value, (_key, inner) => (inner instanceof Date ? inner.toISOString() : inner));
}
