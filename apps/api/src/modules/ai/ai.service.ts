import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface IndicatorAiContext {
  indicator: {
    id: string;
    code: string | null;
    name: string;
    description: string | null;
    type: string;
    unit: string;
    unitLabel: string | null;
    periodicity: string;
    direction: string;
    weight: number;
    yellowToleranceP: number;
    formula: string | null;
    source: string | null;
    ownerNode: string | null;
    responsible: string | null;
    strategicObjective: string | null;
    perspective: string | null;
  };
  history: Array<{
    periodRef: string;
    target: number | null;
    value: number | null;
    attainment: number | null;
    deviationPct: number | null;
    light: string | null;
  }>;
  trend: {
    points: number;
    direction: 'IMPROVING' | 'WORSENING' | 'STABLE' | 'INSUFFICIENT';
    averageAttainment: number | null;
    lastLight: string | null;
    redStreak: number;
    summary: string;
  };
  recentEvents: Array<{
    occurredAt: string;
    eventType: string;
    title: string;
    description: string | null;
  }>;
  openDeviations: number;
  openActions: number;
}

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Monta o "dossier" que vai ser passado para a IA quando ela analisar este
   * indicador. Inclui histórico (12 períodos), cálculo determinístico de
   * tendência (3 períodos), eventos recentes de rastreabilidade e contagens
   * de ações/desvios abertos.
   */
  async buildIndicatorContext(indicatorId: string, companyId: string): Promise<IndicatorAiContext> {
    const indicator = await this.prisma.indicator.findFirst({
      where: { id: indicatorId, companyId, deletedAt: null },
      include: {
        ownerNode: { select: { id: true, name: true } },
        responsibleUser: { select: { id: true, name: true } },
        strategicObjective: {
          select: { id: true, name: true, perspective: { select: { name: true } } },
        },
        targets: { orderBy: { periodRef: 'asc' } },
        results: { orderBy: { periodDate: 'asc' }, take: 24 },
      },
    });
    if (!indicator) throw new NotFoundException('Indicador nao encontrado');

    const targetByRef = new Map(indicator.targets.map((t) => [t.periodRef, t.target]));
    const tail = indicator.results.slice(-12);
    const history = tail.map((r) => ({
      periodRef: r.periodRef,
      target: targetByRef.get(r.periodRef) ?? null,
      value: r.value,
      attainment: r.attainment,
      deviationPct: r.deviationPct,
      light: r.light,
    }));

    const trend = this.computeTrend(history, indicator.direction);
    const recentEvents = await this.prisma.traceabilityEvent.findMany({
      where: { indicatorId },
      orderBy: { occurredAt: 'desc' },
      take: 10,
      select: {
        occurredAt: true,
        eventType: true,
        title: true,
        description: true,
      },
    });

    const [openDeviations, openActions] = await Promise.all([
      this.prisma.deviation.count({
        where: {
          indicatorId,
          deletedAt: null,
          status: { in: ['OPEN', 'IN_ANALYSIS', 'WAITING_ACTION', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.actionPlan.count({
        where: {
          indicatorId,
          deletedAt: null,
          status: { notIn: ['DONE', 'DONE_LATE', 'CANCELLED', 'EFFECTIVE'] },
        },
      }),
    ]);

    return {
      indicator: {
        id: indicator.id,
        code: indicator.code,
        name: indicator.name,
        description: indicator.description,
        type: indicator.type,
        unit: indicator.unit,
        unitLabel: indicator.unitLabel,
        periodicity: indicator.periodicity,
        direction: indicator.direction,
        weight: indicator.weight,
        yellowToleranceP: indicator.yellowToleranceP,
        formula: indicator.formula,
        source: indicator.source,
        ownerNode: indicator.ownerNode?.name ?? null,
        responsible: indicator.responsibleUser?.name ?? null,
        strategicObjective: indicator.strategicObjective?.name ?? null,
        perspective: indicator.strategicObjective?.perspective?.name ?? null,
      },
      history,
      trend,
      recentEvents: recentEvents.map((e) => ({
        occurredAt: e.occurredAt.toISOString(),
        eventType: e.eventType,
        title: e.title,
        description: e.description,
      })),
      openDeviations,
      openActions,
    };
  }

  private computeTrend(
    history: Array<{ attainment: number | null; light: string | null }>,
    direction: string,
  ): IndicatorAiContext['trend'] {
    const valid = history.filter((p) => p.attainment !== null) as Array<{ attainment: number; light: string | null }>;
    const last3 = valid.slice(-3);
    let directionLabel: IndicatorAiContext['trend']['direction'] = 'INSUFFICIENT';
    if (last3.length === 3) {
      const [a, b, c] = last3;
      if (c.attainment > b.attainment && b.attainment > a.attainment) directionLabel = 'IMPROVING';
      else if (c.attainment < b.attainment && b.attainment < a.attainment) directionLabel = 'WORSENING';
      else directionLabel = 'STABLE';
    }
    const averageAttainment = valid.length ? valid.reduce((s, p) => s + p.attainment, 0) / valid.length : null;

    // streak de RED no fim do histórico (do mais recente para trás)
    let redStreak = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].light === 'RED') redStreak++;
      else break;
    }
    const lastLight = history.length ? history[history.length - 1].light : null;
    const pct = (v: number | null) => (v === null ? '-' : `${(v * 100).toFixed(1)}%`);
    const summary = `Direcao do indicador: ${direction}. Tendencia ${directionLabel} nos ultimos ${last3.length} periodos. Atingimento medio dos periodos com dado: ${pct(averageAttainment)}. ${redStreak > 0 ? `Sequencia atual de ${redStreak} periodo(s) em vermelho.` : 'Sem periodos em vermelho na ponta.'}`;
    return { points: last3.length, direction: directionLabel, averageAttainment, lastLight, redStreak, summary };
  }
}
