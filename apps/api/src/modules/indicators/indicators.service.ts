import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Direction,
  FeedKind,
  IndicatorStatus,
  IndicatorType,
  IndicatorUnit,
  Periodicity,
  Prisma,
  TrafficLight,
} from '@prisma/client';
import { calcStatus, IndicatorTargetUpsertInput } from '@g360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PeriodsService } from '../periods/periods.service';
import { ResultsService } from '../results/results.service';
import { AccessService } from '../access/access.service';
import { lastNPeriodRefs, periodRefToDate } from './period.util';

export interface IndicatorFilter {
  companyId: string;
  enforceUserId?: string; // quando presente, aplica restrição de visibilidade por área
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
    private readonly access: AccessService,
  ) {}

  async list(f: IndicatorFilter) {
    const filterNodeIds = await this.resolveOwnerFilter(f.companyId, f);
    // Restrição por área (visibilidade): intersecta o filtro escolhido com as
    // áreas que o usuário pode ver. null = sem restrição (admin/diretor/flag off).
    const ownerNodeIds = await this.applyAreaScope(f.enforceUserId, filterNodeIds);
    if (ownerNodeIds && ownerNodeIds.length === 0) {
      return []; // usuário sem áreas visíveis para o filtro atual
    }
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
        childRelations: {
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
            parentRelations: true,
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
      const parentIndicator = indicator.childRelations?.[0]?.parent ?? null;
      return {
        ...indicator,
        parentIndicator,
        isMacro: (indicator._count?.parentRelations ?? 0) > 0,
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
    // Apenas a empresa efetiva da sessão: o seletor de empresa nos filtros não pode
    // listar (nem permitir escolher) outras empresas. Isolamento total por empresa.
    const companyWhere = { id: me.companyId, deletedAt: null };
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
      where: { id, deletedAt: null, ...(me ? { companyId: me.companyId } : {}) },
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
        results: {
          orderBy: { periodDate: 'asc' },
          include: { createdBy: { select: { id: true, name: true } } },
        },
        actions: {
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
            expectedResult: true,
            responsibleUser: { select: { id: true, name: true } },
          },
        },
        meetings: { select: { id: true, title: true, status: true, startsAt: true } },
      },
    });
    if (!indicator) throw new NotFoundException('Indicador nao encontrado');
    const area = deriveArea(indicator.ownerNode);

    // Restrição por área: bloqueia acesso direto a indicador de área não permitida
    // e aplica projeção RESUMIDA quando o nível de visibilidade for SUMMARY.
    if (me?.sub) {
      const permitted = await this.access.listAreaFilter(me.sub, 'indicators', 'view');
      if (permitted && indicator.ownerNodeId && !permitted.includes(indicator.ownerNodeId)) {
        throw new ForbiddenException('Você não tem acesso aos indicadores desta área.');
      }
      const level = await this.access.visibilityLevel(me.sub, 'indicators', indicator.ownerNodeId);
      if (level === 'SUMMARY') {
        return summarizeIndicator(indicator, area);
      }
    }
    return { ...indicator, areaMacro: area.areaMacro, areaMicro: area.areaMicro };
  }

  async create(me: AuthPayload, input: IndicatorWriteInput) {
    const companyId = this.scopeCompany(me, input.companyId);
    const data = await this.buildCreateData(companyId, input);
    // Só pode criar indicador na própria área (ou área autorizada).
    await this.access.assertCanWrite(me.sub, data.ownerNodeId ?? null, 'indicators', 'create');
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
    // Só pode editar indicador da própria área (área atual). Se mover para outra
    // área, precisa também poder escrever na área de destino.
    await this.access.assertCanWrite(me.sub, current.ownerNodeId ?? null, 'indicators', 'edit');
    const data = await this.buildUpdateData(current.companyId, input);
    if (data.ownerNodeId !== undefined && data.ownerNodeId !== current.ownerNodeId) {
      await this.access.assertCanWrite(me.sub, (data.ownerNodeId as string) ?? null, 'indicators', 'edit');
    }
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

    const directionChanged = data.direction !== undefined && updated.direction !== current.direction;
    const toleranceChanged =
      data.yellowToleranceP !== undefined && updated.yellowToleranceP !== current.yellowToleranceP;
    if (directionChanged || toleranceChanged) {
      await this.recalcAllResults(id);
    }

    await this.audit(me, 'UPDATE', 'Indicator', id, current, updated, 'Indicador editado');
    return this.getById(id, me);
  }

  async recalcAllResults(indicatorId: string) {
    const results = await this.prisma.indicatorResult.findMany({
      where: { indicatorId },
      select: { periodRef: true },
    });
    for (const r of results) {
      await this.recalcResultStatus(indicatorId, r.periodRef);
    }
  }

  async remove(me: AuthPayload, id: string) {
    const current = await this.findScopedIndicator(id, me);
    await this.access.assertCanWrite(me.sub, current.ownerNodeId ?? null, 'indicators', 'delete');
    const updated = await this.prisma.indicator.update({
      where: { id },
      data: { deletedAt: new Date(), status: IndicatorStatus.INACTIVE },
    });
    await this.audit(me, 'DELETE', 'Indicator', id, current, updated, 'Exclusão lógica do indicador');
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
    const periodRef = requiredString(body.periodRef, 'Informe o período da meta');
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
      const periodRef = requiredString(item.periodRef, 'Informe o período da meta');
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
    const periodRef = requiredString(body.periodRef, 'Informe o período do realizado');
    const value = requiredNumber(body.value, 'Informe o valor realizado');
    const before = await this.prisma.indicatorResult.findUnique({
      where: { indicatorId_periodRef: { indicatorId: id, periodRef } },
    });
    const out = await this.results.upsert(me, { indicatorId: id, periodRef, value, note: cleanString(body.note) ?? null });
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
   * Aplica recomputo de status, atingimento e desvios. Útil quando meta muda.
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

  // --- relações (arvore de indicadores) ---

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
   * Inclui o último light de cada indicador.
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
   * ate profundidade max, com o peso acumulado da influência.
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

  private scopeCompany(_me: AuthPayload, _inputCompanyId?: string | null) {
    // Empresa SEMPRE da sessão (companyId efetivo). O Super Admin opera na empresa
    // em que está "dentro" (impersonação) — nunca cria/escreve em outra via payload.
    return _me.companyId;
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

  /** Intersecta o filtro de owner escolhido com as áreas visíveis ao usuário. */
  private async applyAreaScope(userId: string | undefined, filterNodeIds: string[] | null): Promise<string[] | null> {
    if (!userId) return filterNodeIds;
    const permitted = await this.access.listAreaFilter(userId, 'indicators', 'view');
    if (permitted === null) return filterNodeIds; // sem restrição (admin/diretor/flag off)
    if (!filterNodeIds) return permitted;
    const set = new Set(permitted);
    return filterNodeIds.filter((id) => set.has(id));
  }

  private async buildCreateData(companyId: string, input: IndicatorWriteInput): Promise<Prisma.IndicatorUncheckedCreateInput> {
    const ownerNodeId = requiredString(input.ownerNodeId, 'Selecione a area micro ou estrutura responsável');
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
      yellowToleranceP: optionalNumber(input.yellowToleranceP, 'Tolerância amarela') ?? 10,
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
    if (input.yellowToleranceP !== undefined) data.yellowToleranceP = optionalNumber(input.yellowToleranceP, 'Tolerância amarela') ?? 10;
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
      if (!node) throw new NotFoundException('Area responsável nao encontrada para a empresa');
    }
    if (links.guidelineNodeId) {
      const node = await this.prisma.orgNode.findFirst({ where: { id: links.guidelineNodeId, companyId, deletedAt: null }, select: { id: true } });
      if (!node) throw new NotFoundException('Diretriz nao encontrada para a empresa');
    }
    for (const userId of [links.responsibleUserId, links.feederUserId].filter(Boolean) as string[]) {
      const user = await this.prisma.user.findFirst({ where: { id: userId, companyId, deletedAt: null }, select: { id: true } });
      if (!user) throw new NotFoundException('Usuário responsável nao encontrado para a empresa');
    }
    if (links.strategicObjectiveId) {
      const objective = await this.prisma.strategicObjective.findFirst({
        where: { id: links.strategicObjectiveId, deletedAt: null, map: { companyId, deletedAt: null } },
        select: { id: true },
      });
      if (!objective) throw new NotFoundException('Objetivo estratégico nao encontrado para a empresa');
    }
  }

  private async ensureCodeAvailable(companyId: string, code: string | null, ignoreId?: string) {
    if (!code) return;
    const existing = await this.prisma.indicator.findFirst({
      where: { companyId, code, deletedAt: null, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Já existe indicador com este código nesta empresa');
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
        companyId: me.companyId,
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

  // ---- Anexos e comentarios de resultados lancados (armazenados no Neon, max 5 MB) ----

  private async assertIndicatorInCompany(companyId: string, indicatorId: string) {
    const ind = await this.prisma.indicator.findFirst({
      where: { id: indicatorId, companyId },
      select: { id: true },
    });
    if (!ind) throw new NotFoundException('Indicador nao encontrado');
  }

  async listResultNotes(companyId: string, indicatorId: string, periodRef: string) {
    await this.assertIndicatorInCompany(companyId, indicatorId);
    const [attachments, comments] = await Promise.all([
      this.prisma.indicatorResultAttachment.findMany({
        where: { companyId, indicatorId, periodRef },
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true, createdById: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.indicatorResultComment.findMany({
        where: { companyId, indicatorId, periodRef },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { attachments, comments };
  }

  async addResultAttachment(
    me: AuthPayload,
    indicatorId: string,
    periodRef: string,
    body: { fileName: string; mimeType?: string; dataBase64: string },
  ) {
    await this.assertIndicatorInCompany(me.companyId, indicatorId);
    if (!body?.fileName || !body?.dataBase64) throw new BadRequestException('Arquivo invalido');
    // aceita data URL ("data:...;base64,XXXX") ou base64 puro
    const base64 = body.dataBase64.includes(',') ? body.dataBase64.split(',').pop()! : body.dataBase64;
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length === 0) throw new BadRequestException('Arquivo vazio');
    const MAX_BYTES = 5 * 1024 * 1024;
    if (buffer.length > MAX_BYTES) throw new BadRequestException('Arquivo excede o limite de 5 MB');
    return this.prisma.indicatorResultAttachment.create({
      data: {
        companyId: me.companyId,
        indicatorId,
        periodRef,
        fileName: body.fileName.slice(0, 255),
        mimeType: body.mimeType ?? null,
        sizeBytes: buffer.length,
        data: buffer,
        createdById: me.sub,
      },
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
    });
  }

  async getResultAttachment(companyId: string, attachmentId: string) {
    const att = await this.prisma.indicatorResultAttachment.findFirst({
      where: { id: attachmentId, companyId },
    });
    if (!att) throw new NotFoundException('Anexo nao encontrado');
    return {
      id: att.id,
      fileName: att.fileName,
      mimeType: att.mimeType,
      dataBase64: Buffer.from(att.data).toString('base64'),
    };
  }

  async deleteResultAttachment(companyId: string, attachmentId: string) {
    const att = await this.prisma.indicatorResultAttachment.findFirst({
      where: { id: attachmentId, companyId },
      select: { id: true },
    });
    if (!att) throw new NotFoundException('Anexo nao encontrado');
    await this.prisma.indicatorResultAttachment.delete({ where: { id: attachmentId } });
    return { ok: true };
  }

  async addResultComment(me: AuthPayload, indicatorId: string, periodRef: string, body: { body: string }) {
    await this.assertIndicatorInCompany(me.companyId, indicatorId);
    const text = (body?.body ?? '').trim();
    if (!text) throw new BadRequestException('Comentario vazio');
    return this.prisma.indicatorResultComment.create({
      data: {
        companyId: me.companyId,
        indicatorId,
        periodRef,
        body: text.slice(0, 4000),
        authorId: me.sub,
        authorName: me.name,
      },
    });
  }
}

// Projeção RESUMIDA de um indicador (visibilidade SUMMARY entre áreas):
// expõe só status/meta/realizado/tendência/farol/% e nº de ações — sem evidências,
// causa-raiz, comentários, custos ou descrições sensíveis.
function summarizeIndicator(
  indicator: {
    id: string;
    name: string;
    code: string | null;
    status: string;
    unit: string | null;
    unitLabel: string | null;
    ownerNodeId: string | null;
    results?: Array<{ periodRef: string; value: unknown; light: string | null; attainment: unknown }>;
    targets?: Array<{ periodRef: string; target: unknown }>;
    actions?: Array<{ status: string }>;
  },
  area: { areaMacro: unknown; areaMicro: unknown },
) {
  const results = indicator.results ?? [];
  const targets = indicator.targets ?? [];
  const latest = results[results.length - 1] ?? null;
  const latestTarget = targets[targets.length - 1] ?? null;
  const closedStatuses = new Set(['DONE', 'DONE_LATE', 'CANCELLED']);
  const totalActions = (indicator.actions ?? []).length;
  const openActions = (indicator.actions ?? []).filter((a) => !closedStatuses.has(a.status)).length;
  return {
    id: indicator.id,
    name: indicator.name,
    code: indicator.code,
    status: indicator.status,
    unit: indicator.unit,
    unitLabel: indicator.unitLabel,
    ownerNodeId: indicator.ownerNodeId,
    areaMacro: area.areaMacro,
    areaMicro: area.areaMicro,
    summary: true, // sinaliza ao frontend que é visualização resumida
    light: latest?.light ?? 'GRAY',
    value: latest?.value ?? null,
    target: latestTarget?.target ?? null,
    attainment: latest?.attainment ?? null,
    periodRef: latest?.periodRef ?? null,
    totalActions,
    openActions,
  };
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
    throw new BadRequestException(`Valor inválido: ${clean}`);
  }
  return clean as T[keyof T];
}

function parseYear(value?: string) {
  if (!value) return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2026 || year > 2100) throw new BadRequestException('Ano inválido para indicadores');
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
