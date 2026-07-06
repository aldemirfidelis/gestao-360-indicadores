import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionStatus, DeviationStatus, Direction, IndicatorType, TrafficLight, TreatmentStatus } from '@prisma/client';
import { calcStatus } from '@g360/shared';
import { lastNPeriodRefs } from '../indicators/period.util';
import { PeriodsService } from '../periods/periods.service';
import { AccessService } from '../access/access.service';
import { AuthPayload } from '../auth/auth.types';

// O dashboard agrega dados dos indicadores/ações/desvios: para usuários restritos por
// área, os números refletem apenas as áreas visíveis (não vaza agregado de outras áreas).
const MODULE = 'dashboard';
const EXECUTIVE_CONCLUSION_KEY_PREFIX = 'dashboard.executive_conclusion.';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periods: PeriodsService,
    private readonly access: AccessService,
  ) {}

  /** Conjunto de fragmentos de `where` por área (vazios quando não há restrição). */
  private async areaFilters(me: AuthPayload) {
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    return {
      /** Para queries diretas sobre Indicator / ActionPlan (têm ownerNodeId). */
      ownerArea: permitted ? { ownerNodeId: { in: permitted } } : {},
      /** Para queries cujo escopo de área vem do indicador relacionado. */
      viaIndicator: permitted ? { indicator: { ownerNodeId: { in: permitted } } } : {},
      /** Para reuniões (gerais sem vínculo + área permitida). */
      meeting: permitted
        ? {
            OR: [
              { indicatorId: null, deviationId: null },
              { indicator: { ownerNodeId: { in: permitted } } },
              { deviation: { indicator: { ownerNodeId: { in: permitted } } } },
            ],
          }
        : {},
    };
  }

  async overview(me: AuthPayload) {
    const companyId = me.companyId;
    const { ownerArea, viaIndicator, meeting } = await this.areaFilters(me);
    const totalIndicators = await this.prisma.indicator.count({
      where: { companyId, deletedAt: null, status: 'ACTIVE', ...ownerArea },
    });

    const lastResults = await this.prisma.indicatorResult.findMany({
      where: { indicator: { companyId, deletedAt: null, status: 'ACTIVE', ...ownerArea } },
      orderBy: { periodDate: 'desc' },
      distinct: ['indicatorId'],
      select: { indicatorId: true, light: true, attainment: true },
    });
    const seenIds = new Set(lastResults.map((r) => r.indicatorId));

    const counts: Record<TrafficLight, number> = {
      GREEN: 0,
      YELLOW: 0,
      RED: 0,
      GRAY: 0,
    };
    let attainmentSum = 0;
    let attainmentN = 0;
    for (const r of lastResults) {
      counts[r.light]++;
      if (r.attainment !== null && r.attainment !== undefined) {
        attainmentSum += Math.max(0, Math.min(1.5, r.attainment));
        attainmentN++;
      }
    }
    counts.GRAY += totalIndicators - seenIds.size;
    const generalAttainment = attainmentN > 0 ? attainmentSum / attainmentN : null;

    const now = new Date();
    const soon = new Date(now);
    soon.setDate(now.getDate() + 7);

    const [
      openActions,
      overdueActions,
      doneActions,
      criticalDeviations,
      openDeviations,
      pendingMeetings,
      dueSoonActions,
      openTreatmentCases,
      treatmentAlerts,
    ] = await Promise.all([
      this.prisma.actionPlan.count({
        where: {
          companyId,
          deletedAt: null,
          status: { notIn: [ActionStatus.DONE, ActionStatus.DONE_LATE, ActionStatus.CANCELLED] },
          ...ownerArea,
        },
      }),
      this.prisma.actionPlan.count({
        where: {
          companyId,
          deletedAt: null,
          dueDate: { lt: new Date() },
          status: { notIn: [ActionStatus.DONE, ActionStatus.DONE_LATE, ActionStatus.CANCELLED] },
          ...ownerArea,
        },
      }),
      this.prisma.actionPlan.count({
        where: {
          companyId,
          deletedAt: null,
          status: { in: [ActionStatus.DONE, ActionStatus.DONE_LATE] },
          ...ownerArea,
        },
      }),
      this.prisma.deviation.count({
        where: {
          companyId,
          deletedAt: null,
          severity: 'CRITICAL',
          status: {
            notIn: [DeviationStatus.CLOSED, DeviationStatus.CLOSED_LATE, DeviationStatus.CANCELLED],
          },
          ...viaIndicator,
        },
      }),
      this.prisma.deviation.count({
        where: {
          companyId,
          deletedAt: null,
          status: { notIn: [DeviationStatus.CLOSED, DeviationStatus.CLOSED_LATE, DeviationStatus.CANCELLED] },
          ...viaIndicator,
        },
      }),
      this.prisma.meeting.count({
        where: {
          companyId,
          deletedAt: null,
          startsAt: { gte: now, lte: soon },
          ...meeting,
        },
      }),
      this.prisma.actionPlan.findMany({
        where: {
          companyId,
          deletedAt: null,
          dueDate: { gte: now, lte: soon },
          status: { notIn: [ActionStatus.DONE, ActionStatus.DONE_LATE, ActionStatus.CANCELLED] },
          ...ownerArea,
        },
        include: { responsibleUser: { select: { id: true, name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 8,
      }),
      this.prisma.treatmentCase.count({
        where: {
          companyId,
          status: { notIn: [TreatmentStatus.RESOLVED, TreatmentStatus.CONCLUDED, TreatmentStatus.IGNORED_TEMPORARILY] },
          ...viaIndicator,
        },
      }),
      this.prisma.treatmentCase.findMany({
        where: {
          companyId,
          status: {
            in: [
              TreatmentStatus.AWAITING_CAUSE_ANALYSIS,
              TreatmentStatus.CAUSE_ANALYSIS_CREATED,
              TreatmentStatus.MEETING_SCHEDULED,
              TreatmentStatus.ACTION_PLAN_CREATED,
              TreatmentStatus.ACTIONS_OVERDUE,
              TreatmentStatus.UNRESOLVED,
            ],
          },
          ...viaIndicator,
        },
        include: { indicator: { select: { id: true, name: true, ownerNode: { select: { name: true } } } } },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
    ]);

    const deviationsBySector = await this.prisma.deviation.groupBy({
      by: ['indicatorId'],
      where: {
        companyId,
        deletedAt: null,
        status: { notIn: [DeviationStatus.CLOSED, DeviationStatus.CLOSED_LATE, DeviationStatus.CANCELLED] },
        ...viaIndicator,
      },
      _count: { indicatorId: true },
      orderBy: { _count: { indicatorId: 'desc' } },
      take: 50,
    });
    const indicatorsForDeviations = await this.prisma.indicator.findMany({
      where: { id: { in: deviationsBySector.map((d) => d.indicatorId) } },
      select: {
        id: true,
        ownerNode: { select: { id: true, name: true, type: true } },
        results: { orderBy: { periodDate: 'desc' }, take: 1, select: { light: true } },
      },
    });
    const indOwner = new Map(indicatorsForDeviations.map((i) => [i.id, i.ownerNode]));
    const latestLight = new Map(indicatorsForDeviations.map((i) => [i.id, i.results[0]?.light ?? 'GRAY']));
    const sectorBuckets = new Map<
      string,
      {
        nodeId: string;
        nodeName: string;
        nodeType: string;
        deviations: number;
        indicatorCount: number;
        criticalIndicators: number;
        attentionIndicators: number;
      }
    >();
    deviationsBySector.forEach((row) => {
      const owner = indOwner.get(row.indicatorId);
      if (!owner) return;
      const bucket = sectorBuckets.get(owner.id) ?? {
        nodeId: owner.id,
        nodeName: owner.name,
        nodeType: owner.type,
        deviations: 0,
        indicatorCount: 0,
        criticalIndicators: 0,
        attentionIndicators: 0,
      };
      bucket.deviations += row._count.indicatorId;
      bucket.indicatorCount++;
      const light = latestLight.get(row.indicatorId);
      if (light === 'RED') bucket.criticalIndicators++;
      if (light === 'YELLOW') bucket.attentionIndicators++;
      sectorBuckets.set(owner.id, bucket);
    });

    return {
      totalIndicators,
      counts,
      generalAttainment,
      openActions,
      overdueActions,
      doneActions,
      criticalDeviations,
      openDeviations,
      pendingMeetings,
      dueSoonActions,
      openTreatmentCases,
      treatmentAlerts,
      sectorsWithDeviation: Array.from(sectorBuckets.values())
        .sort((a, b) => b.deviations - a.deviations)
        .slice(0, 5),
    };
  }

  async areas(me: AuthPayload) {
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    return this.prisma.orgNode.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        active: true,
        ...(permitted ? { id: { in: permitted } } : {}),
      },
      select: {
        id: true,
        parentId: true,
        name: true,
        code: true,
        type: true,
        _count: { select: { children: true, indicatorsOwned: true } },
      },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
  }

  async areaIndicators(me: AuthPayload, ownerNodeId?: string, types?: string[], periodRef?: string, mode?: string) {
    const companyId = me.companyId;
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const selectedIds = ownerNodeId ? await this.descendantNodeIds(companyId, ownerNodeId) : null;
    const ownerNodeIds = this.intersectAreaScopes(selectedIds, permitted);
    if (ownerNodeIds && ownerNodeIds.length === 0) return [];

    // Filtro por tipo (Operacional/Estratégico) escolhido pelo usuário. Sem trava:
    // o Painel Executivo passa a exibir também operacionais quando o usuário quiser.
    const wantedTypes = (types ?? []).filter((t) => t === 'STRATEGIC' || t === 'OPERATIONAL') as IndicatorType[];

    const anchor = await this.periods.currentAnchorDate(companyId);
    const indicators = await this.prisma.indicator.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: 'ACTIVE',
        ...(wantedTypes.length ? { type: { in: wantedTypes } } : {}),
        ...(ownerNodeIds ? { ownerNodeId: { in: ownerNodeIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        unit: true,
        unitLabel: true,
        direction: true,
        periodicity: true,
        yellowToleranceP: true,
        ownerNode: { select: { id: true, name: true, type: true, parentId: true } },
      },
      orderBy: [{ name: 'asc' }],
    });
    if (indicators.length === 0) return [];

    const ids = indicators.map((indicator) => indicator.id);
    const currentRefs = new Map<string, string>();
    for (const indicator of indicators) {
      const currentRef = lastNPeriodRefs(indicator.periodicity, 1, anchor)[0];
      if (currentRef) currentRefs.set(indicator.id, currentRef);
    }

    // Sem mes escolhido: usa o resultado mais recente de cada indicador (comportamento padrao).
    // Com mes escolhido: usa exatamente aquele periodo (pode nao existir lancamento ainda).
    const results = periodRef
      ? await this.prisma.indicatorResult.findMany({
          where: { indicatorId: { in: ids }, periodRef },
          select: { indicatorId: true, periodRef: true, value: true, light: true, attainment: true, deviationPct: true },
        })
      : await this.prisma.indicatorResult.findMany({
          where: { indicatorId: { in: ids } },
          orderBy: { periodDate: 'desc' },
          distinct: ['indicatorId'],
          select: { indicatorId: true, periodRef: true, value: true, light: true, attainment: true, deviationPct: true },
        });

    const resultMap = new Map(results.map((result) => [result.indicatorId, result]));

    // Coletar as referências de períodos necessárias para buscar as metas correspondentes ao período
    // escolhido (quando ha mes selecionado), ao período do resultado, ou ao período atual como último recurso.
    const neededRefs = new Set<string>();
    for (const indicator of indicators) {
      const last = resultMap.get(indicator.id);
      const ref = periodRef ?? last?.periodRef ?? currentRefs.get(indicator.id);
      if (ref) {
        neededRefs.add(`${indicator.id}:${ref}`);
      }
    }

    // Buscar as metas apenas para os pares (indicatorId, periodRef) correspondentes
    const targets = neededRefs.size > 0
      ? await this.prisma.indicatorTarget.findMany({
          where: {
            OR: Array.from(neededRefs).map((key) => {
              const [indicatorId, periodRef] = key.split(':');
              return { indicatorId, periodRef };
            }),
          },
          select: { indicatorId: true, periodRef: true, target: true, lowerBound: true, upperBound: true },
        })
      : [];

    const targetMap = new Map(targets.map((target) => [`${target.indicatorId}:${target.periodRef}`, target]));

    // Visão "Acumulado" (YTD): média do ano até o mês em foco, para realizado e
    // meta separadamente (mesma semântica do detalhe), com o farol recalculado
    // sobre os acumulados. Só se aplica a períodos mensais (YYYY-MM); indicadores
    // sem YTD mensal caem no valor do período (comportamento mensal).
    const cumulative = mode === 'cumulative';
    const cumMap = new Map<
      string,
      { value: number | null; target: number | null; light: TrafficLight; attainment: number | null; lower: number | null; upper: number | null }
    >();
    if (cumulative) {
      const boundaryRef = periodRef ?? (await this.periods.currentMonthlyRef(companyId));
      const year = Number(boundaryRef.slice(0, 4));
      const upToMonth = Number(boundaryRef.slice(5, 7));
      const ytdRefs: string[] = [];
      if (Number.isFinite(year) && upToMonth >= 1 && upToMonth <= 12) {
        for (let m = 1; m <= upToMonth; m += 1) ytdRefs.push(`${year}-${String(m).padStart(2, '0')}`);
      }
      if (ytdRefs.length) {
        const [ytdResults, ytdTargets] = await Promise.all([
          this.prisma.indicatorResult.findMany({
            where: { indicatorId: { in: ids }, periodRef: { in: ytdRefs } },
            select: { indicatorId: true, value: true },
          }),
          this.prisma.indicatorTarget.findMany({
            where: { indicatorId: { in: ids }, periodRef: { in: ytdRefs } },
            select: { indicatorId: true, periodRef: true, target: true, lowerBound: true, upperBound: true },
          }),
        ]);
        const valAgg = new Map<string, { sum: number; n: number }>();
        for (const r of ytdResults) {
          if (r.value === null || r.value === undefined) continue;
          const a = valAgg.get(r.indicatorId) ?? { sum: 0, n: 0 };
          a.sum += r.value;
          a.n += 1;
          valAgg.set(r.indicatorId, a);
        }
        const tgtAgg = new Map<string, { sum: number; n: number }>();
        const boundaryBounds = new Map<string, { lower: number | null; upper: number | null }>();
        for (const t of ytdTargets) {
          if (t.target !== null && t.target !== undefined) {
            const a = tgtAgg.get(t.indicatorId) ?? { sum: 0, n: 0 };
            a.sum += t.target;
            a.n += 1;
            tgtAgg.set(t.indicatorId, a);
          }
          if (t.periodRef === boundaryRef) boundaryBounds.set(t.indicatorId, { lower: t.lowerBound, upper: t.upperBound });
        }
        for (const indicator of indicators) {
          const v = valAgg.get(indicator.id);
          const g = tgtAgg.get(indicator.id);
          const cumValue = v && v.n > 0 ? v.sum / v.n : null;
          const cumTarget = g && g.n > 0 ? g.sum / g.n : null;
          const bounds = boundaryBounds.get(indicator.id) ?? { lower: null, upper: null };
          const status = calcStatus({
            value: cumValue,
            target: cumTarget,
            direction: indicator.direction as Direction,
            lowerBound: bounds.lower,
            upperBound: bounds.upper,
            yellowToleranceP: indicator.yellowToleranceP,
          });
          cumMap.set(indicator.id, {
            value: cumValue,
            target: cumTarget,
            light: status.light as TrafficLight,
            attainment: status.attainment,
            lower: bounds.lower,
            upper: bounds.upper,
          });
        }
      }
    }

    return indicators.map((indicator) => {
      const last = resultMap.get(indicator.id) ?? null;
      const refToUse = periodRef ?? last?.periodRef ?? currentRefs.get(indicator.id);
      const target = refToUse ? targetMap.get(`${indicator.id}:${refToUse}`) : null;
      // Acumulado só substitui o card quando há de fato dado YTD; senão mantém o mês.
      const cum = cumulative ? cumMap.get(indicator.id) : null;
      const useCum = Boolean(cum && cum.value !== null);
      return {
        id: indicator.id,
        name: indicator.name,
        code: indicator.code,
        unit: indicator.unit,
        unitLabel: indicator.unitLabel,
        direction: indicator.direction,
        ownerNode: indicator.ownerNode,
        currentTarget: useCum
          ? cum!.target !== null
            ? { target: cum!.target, lowerBound: cum!.lower, upperBound: cum!.upper }
            : null
          : target
            ? {
                target: target.target,
                lowerBound: target.lowerBound,
                upperBound: target.upperBound,
              }
            : null,
        last: useCum
          ? {
              value: cum!.value as number,
              light: cum!.light,
              attainment: cum!.attainment,
              deviationPct: null,
            }
          : last
          ? {
              value: last.value,
              light: last.light,
              attainment: last.attainment,
              deviationPct: last.deviationPct,
            }
          : null,
      };
    });
  }

  async areaConclusion(me: AuthPayload, ownerNodeId?: string) {
    const node = await this.resolveConclusionArea(me, ownerNodeId);
    const key = `${EXECUTIVE_CONCLUSION_KEY_PREFIX}${node.id}`;
    const record = await this.prisma.appSetting.findUnique({
      where: { companyId_key: { companyId: me.companyId, key } },
      select: { value: true, updatedAt: true },
    });
    return {
      ownerNodeId: node.id,
      conclusion: record?.value ?? '',
      updatedAt: record?.updatedAt ?? null,
    };
  }

  async saveAreaConclusion(me: AuthPayload, ownerNodeId: string | undefined, body: { conclusion?: string }) {
    const node = await this.resolveConclusionArea(me, ownerNodeId);
    const key = `${EXECUTIVE_CONCLUSION_KEY_PREFIX}${node.id}`;
    const conclusion = String(body?.conclusion ?? '').trim();
    const saved = await this.prisma.appSetting.upsert({
      where: { companyId_key: { companyId: me.companyId, key } },
      create: {
        companyId: me.companyId,
        key,
        value: conclusion,
        valueType: 'text',
        group: 'Dashboard',
        description: `Conclusao executiva mensal da area ${node.name}`,
      },
      update: {
        value: conclusion,
        valueType: 'text',
        group: 'Dashboard',
        description: `Conclusao executiva mensal da area ${node.name}`,
        active: true,
      },
      select: { value: true, updatedAt: true },
    });
    return {
      ownerNodeId: node.id,
      conclusion: saved.value,
      updatedAt: saved.updatedAt,
    };
  }

  /**
   * Ranking de areas por % medio de atingimento (últimos resultados).
   */
  async ranking(me: AuthPayload, limit = 10) {
    const { ownerArea } = await this.areaFilters(me);
    const indicators = await this.prisma.indicator.findMany({
      where: { companyId: me.companyId, deletedAt: null, status: 'ACTIVE', ...ownerArea },
      select: { id: true, ownerNodeId: true, weight: true },
    });
    if (indicators.length === 0) return [];
    const ids = indicators.map((i) => i.id);
    const lastResults = await this.prisma.indicatorResult.findMany({
      where: { indicatorId: { in: ids } },
      orderBy: { periodDate: 'desc' },
      distinct: ['indicatorId'],
      select: { indicatorId: true, attainment: true, light: true },
    });
    const resMap = new Map(lastResults.map((r) => [r.indicatorId, r]));
    const buckets = new Map<
      string,
      { sum: number; count: number; green: number; yellow: number; red: number; gray: number }
    >();

    for (const ind of indicators) {
      const r = resMap.get(ind.id);
      const node = ind.ownerNodeId;
      if (!buckets.has(node)) {
        buckets.set(node, { sum: 0, count: 0, green: 0, yellow: 0, red: 0, gray: 0 });
      }
      const b = buckets.get(node)!;
      if (r?.attainment !== null && r?.attainment !== undefined) {
        b.sum += Math.max(0, Math.min(1.5, r.attainment));
        b.count++;
      }
      switch (r?.light ?? 'GRAY') {
        case 'GREEN':
          b.green++;
          break;
        case 'YELLOW':
          b.yellow++;
          break;
        case 'RED':
          b.red++;
          break;
        default:
          b.gray++;
      }
    }

    const nodes = await this.prisma.orgNode.findMany({
      where: { id: { in: Array.from(buckets.keys()) } },
      select: { id: true, name: true, type: true, color: true },
    });
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    return Array.from(buckets.entries())
      .map(([nodeId, b]) => {
        const node = nodeMap.get(nodeId);
        return {
          nodeId,
          nodeName: node?.name ?? '?',
          nodeType: node?.type,
          attainment: b.count ? b.sum / b.count : null,
          green: b.green,
          yellow: b.yellow,
          red: b.red,
          gray: b.gray,
        };
      })
      .sort((a, b) => (b.attainment ?? 0) - (a.attainment ?? 0))
      .slice(0, limit);
  }

  /**
   * Evolucao mensal: media de atingimento por mes nos últimos N meses.
   */
  async evolution(me: AuthPayload, months = 12) {
    const companyId = me.companyId;
    const { ownerArea } = await this.areaFilters(me);
    const anchor = await this.periods.currentAnchorDate(companyId);
    const refs = lastNPeriodRefs('MONTHLY', months, anchor);
    const results = await this.prisma.indicatorResult.findMany({
      where: {
        indicator: { companyId, deletedAt: null, ...ownerArea },
        periodRef: { in: refs },
      },
      select: { periodRef: true, attainment: true, light: true },
    });
    const map = new Map<string, { sum: number; n: number; green: number; total: number }>();
    for (const ref of refs) map.set(ref, { sum: 0, n: 0, green: 0, total: 0 });
    for (const r of results) {
      const m = map.get(r.periodRef);
      if (!m) continue;
      m.total++;
      if (r.light === 'GREEN') m.green++;
      if (r.attainment !== null && r.attainment !== undefined) {
        m.sum += Math.max(0, Math.min(1.5, r.attainment));
        m.n++;
      }
    }
    return refs.map((ref) => {
      const m = map.get(ref)!;
      return {
        periodRef: ref,
        attainment: m.n > 0 ? m.sum / m.n : null,
        greenRate: m.total > 0 ? m.green / m.total : null,
        total: m.total,
      };
    });
  }

  /**
   * Lista resumida dos piores indicadores no momento (vermelhos).
   */
  async worst(me: AuthPayload, limit = 8) {
    const { ownerArea } = await this.areaFilters(me);
    const reds = await this.prisma.indicatorResult.findMany({
      where: {
        indicator: { companyId: me.companyId, deletedAt: null, status: 'ACTIVE', ...ownerArea },
        light: 'RED',
      },
      orderBy: { periodDate: 'desc' },
      distinct: ['indicatorId'],
      take: limit * 3,
      include: {
        indicator: {
          select: {
            id: true,
            name: true,
            code: true,
            unit: true,
            unitLabel: true,
            ownerNode: { select: { id: true, name: true } },
          },
        },
      },
    });
    return reds
      .sort((a, b) => (a.attainment ?? 0) - (b.attainment ?? 0))
      .slice(0, limit)
      .map((r) => ({
        indicator: r.indicator,
        periodRef: r.periodRef,
        value: r.value,
        attainment: r.attainment,
        deviationPct: r.deviationPct,
        light: r.light,
      }));
  }

  async pendingFillCount(me: AuthPayload) {
    const companyId = me.companyId;
    const { ownerArea } = await this.areaFilters(me);
    const periodRef = await this.periods.currentMonthlyRef(companyId);
    const active = await this.prisma.indicator.count({
      where: { companyId, deletedAt: null, status: 'ACTIVE', periodicity: 'MONTHLY', ...ownerArea },
    });
    const filled = await this.prisma.indicatorResult.count({
      where: {
        periodRef,
        indicator: { companyId, deletedAt: null, status: 'ACTIVE', periodicity: 'MONTHLY', ...ownerArea },
      },
    });
    return { periodRef, total: active, filled, pending: Math.max(0, active - filled) };
  }

  private async descendantNodeIds(companyId: string, ownerNodeId: string) {
    const nodes = await this.prisma.orgNode.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    if (!nodes.some((node) => node.id === ownerNodeId)) return [];
    const children = new Map<string, string[]>();
    for (const node of nodes) {
      if (!node.parentId) continue;
      const list = children.get(node.parentId) ?? [];
      list.push(node.id);
      children.set(node.parentId, list);
    }
    const out = new Set<string>([ownerNodeId]);
    const queue = [ownerNodeId];
    while (queue.length) {
      const parentId = queue.shift()!;
      for (const childId of children.get(parentId) ?? []) {
        if (out.has(childId)) continue;
        out.add(childId);
        queue.push(childId);
      }
    }
    return Array.from(out);
  }

  private intersectAreaScopes(selectedIds: string[] | null, permittedIds: string[] | null) {
    if (!selectedIds && !permittedIds) return null;
    if (!selectedIds) return permittedIds;
    if (!permittedIds) return selectedIds;
    const permitted = new Set(permittedIds);
    return selectedIds.filter((id) => permitted.has(id));
  }

  private async resolveConclusionArea(me: AuthPayload, ownerNodeId?: string) {
    if (!ownerNodeId) throw new BadRequestException('Selecione uma area para registrar a conclusao executiva.');
    const node = await this.prisma.orgNode.findFirst({
      where: { id: ownerNodeId, companyId: me.companyId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!node) throw new BadRequestException('Area invalida para esta empresa.');
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    if (permitted && !permitted.includes(node.id)) {
      throw new ForbiddenException('Voce nao tem acesso ao painel executivo desta area.');
    }
    return node;
  }
}
