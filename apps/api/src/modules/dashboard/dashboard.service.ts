import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionStatus, DeviationStatus, TrafficLight, TreatmentStatus } from '@prisma/client';
import { lastNPeriodRefs } from '../indicators/period.util';
import { PeriodsService } from '../periods/periods.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periods: PeriodsService,
  ) {}

  async overview(companyId: string) {
    const totalIndicators = await this.prisma.indicator.count({
      where: { companyId, deletedAt: null, status: 'ACTIVE' },
    });

    const lastResults = await this.prisma.indicatorResult.findMany({
      where: { indicator: { companyId, deletedAt: null, status: 'ACTIVE' } },
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
        },
      }),
      this.prisma.actionPlan.count({
        where: {
          companyId,
          deletedAt: null,
          dueDate: { lt: new Date() },
          status: { notIn: [ActionStatus.DONE, ActionStatus.DONE_LATE, ActionStatus.CANCELLED] },
        },
      }),
      this.prisma.actionPlan.count({
        where: {
          companyId,
          deletedAt: null,
          status: { in: [ActionStatus.DONE, ActionStatus.DONE_LATE] },
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
        },
      }),
      this.prisma.deviation.count({
        where: {
          companyId,
          deletedAt: null,
          status: { notIn: [DeviationStatus.CLOSED, DeviationStatus.CLOSED_LATE, DeviationStatus.CANCELLED] },
        },
      }),
      this.prisma.meeting.count({
        where: {
          companyId,
          deletedAt: null,
          startsAt: { gte: now, lte: soon },
        },
      }),
      this.prisma.actionPlan.findMany({
        where: {
          companyId,
          deletedAt: null,
          dueDate: { gte: now, lte: soon },
          status: { notIn: [ActionStatus.DONE, ActionStatus.DONE_LATE, ActionStatus.CANCELLED] },
        },
        include: { responsibleUser: { select: { id: true, name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 8,
      }),
      this.prisma.treatmentCase.count({
        where: {
          companyId,
          status: { notIn: [TreatmentStatus.RESOLVED, TreatmentStatus.CONCLUDED, TreatmentStatus.IGNORED_TEMPORARILY] },
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

  /**
   * Ranking de areas por % medio de atingimento (últimos resultados).
   */
  async ranking(companyId: string, limit = 10) {
    const indicators = await this.prisma.indicator.findMany({
      where: { companyId, deletedAt: null, status: 'ACTIVE' },
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
  async evolution(companyId: string, months = 12) {
    const anchor = await this.periods.currentAnchorDate(companyId);
    const refs = lastNPeriodRefs('MONTHLY', months, anchor);
    const results = await this.prisma.indicatorResult.findMany({
      where: {
        indicator: { companyId, deletedAt: null },
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
  async worst(companyId: string, limit = 8) {
    const reds = await this.prisma.indicatorResult.findMany({
      where: {
        indicator: { companyId, deletedAt: null, status: 'ACTIVE' },
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

  async pendingFillCount(companyId: string) {
    const periodRef = await this.periods.currentMonthlyRef(companyId);
    const active = await this.prisma.indicator.count({
      where: { companyId, deletedAt: null, status: 'ACTIVE', periodicity: 'MONTHLY' },
    });
    const filled = await this.prisma.indicatorResult.count({
      where: {
        periodRef,
        indicator: { companyId, deletedAt: null, status: 'ACTIVE', periodicity: 'MONTHLY' },
      },
    });
    return { periodRef, total: active, filled, pending: Math.max(0, active - filled) };
  }
}
