import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { calcStatus } from '@g360/shared';
import { IndicatorResultUpsertInput } from '@g360/shared';
import {
  Direction,
  NotificationKind,
  ResultStatus,
  TraceEntityType,
  TraceEventType,
  TrafficLight,
  TreatmentStatus,
} from '@prisma/client';
import { lastNPeriodRefs, periodRefToDate, periodRefsForYear } from '../indicators/period.util';
import { TraceabilityService } from '../traceability/traceability.service';
import { PeriodsService } from '../periods/periods.service';
import { ClosedMonthsService } from '../closed-months/closed-months.service';

interface ResultSaveOutcome {
  result: any;
  shouldOpenDeviation: boolean;
  treatment?: { id: string; status: TreatmentStatus } | null;
}

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
    private readonly periods: PeriodsService,
    private readonly closedMonths: ClosedMonthsService,
  ) {}

  /**
   * Lista lançamentos pendentes/preenchidos para um conjunto de indicadores,
   * agrupados por período. Quando `year` esta definido (caso padrão), lista
   * todos os períodos daquele ano civil para a periodicidade do indicador.
   * Quando `points` esta definido, lista apenas os N períodos mais recentes
   * (compatível com a versão antiga).
   */
  async pendingByCompany(
    companyId: string,
    opts: { year?: number; points?: number; ownerNodeId?: string; indicatorId?: string } = {},
  ) {
    const { ownerNodeId, indicatorId } = opts;
    const indicators = await this.prisma.indicator.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: 'ACTIVE',
        ...(ownerNodeId ? { ownerNodeId } : {}),
        ...(indicatorId ? { id: indicatorId } : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        unit: true,
        unitLabel: true,
        periodicity: true,
        direction: true,
        ownerNode: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const out: Array<{
      indicator: (typeof indicators)[number];
      cells: Array<{
        periodRef: string;
        target: number | null;
        value: number | null;
        status: ResultStatus | 'NONE';
        light: TrafficLight;
        isClosed: boolean;
      }>;
    }> = [];

    const usePoints = opts.points !== undefined && opts.year === undefined;
    const currentPeriod = await this.periods.current(companyId);
    const targetYear = opts.year ?? currentPeriod.year;
    const anchor = await this.periods.currentAnchorDate(companyId);
    const closed = await this.prisma.closedMonth.findMany({
      where: { companyId, deletedAt: null, reopenedAt: null },
      select: { periodRef: true },
    });
    const closedSet = new Set(closed.map((c) => c.periodRef));
    for (const ind of indicators) {
      const refs = usePoints
        ? lastNPeriodRefs(ind.periodicity, opts.points ?? 6, anchor)
        : periodRefsForYear(ind.periodicity, targetYear);
      const [targets, results] = await Promise.all([
        this.prisma.indicatorTarget.findMany({
          where: { indicatorId: ind.id, periodRef: { in: refs } },
        }),
        this.prisma.indicatorResult.findMany({
          where: { indicatorId: ind.id, periodRef: { in: refs } },
        }),
      ]);
      const tMap = new Map(targets.map((t) => [t.periodRef, t]));
      const rMap = new Map(results.map((r) => [r.periodRef, r]));
      out.push({
        indicator: ind,
        cells: refs.map((ref) => {
          const r = rMap.get(ref);
          return {
            periodRef: ref,
            target: tMap.get(ref)?.target ?? null,
            value: r?.value ?? null,
            status: (r?.status ?? 'NONE') as ResultStatus | 'NONE',
            light: (r?.light ?? 'GRAY') as TrafficLight,
            isClosed: closedSet.has(ref),
          };
        }),
      });
    }
    return out;
  }

  async upsert(input: IndicatorResultUpsertInput, userId: string): Promise<ResultSaveOutcome> {
    const indicator = await this.prisma.indicator.findUnique({
      where: { id: input.indicatorId },
    });
    if (!indicator) throw new NotFoundException('Indicador nao encontrado');

    if (await this.closedMonths.isMonthClosed(indicator.companyId, input.periodRef)) {
      throw new ConflictException(
        `O período ${input.periodRef} esta fechado para lançamentos. Solicite a reabertura ao administrador.`,
      );
    }

    const target = await this.prisma.indicatorTarget.findUnique({
      where: {
        indicatorId_periodRef: { indicatorId: indicator.id, periodRef: input.periodRef },
      },
    });

    const status = calcStatus({
      value: input.value,
      target: target?.target ?? null,
      direction: indicator.direction as Direction,
      lowerBound: target?.lowerBound ?? null,
      upperBound: target?.upperBound ?? null,
      yellowToleranceP: indicator.yellowToleranceP,
    });

    const periodDate = periodRefToDate(input.periodRef, indicator.periodicity);

    const result = await this.prisma.indicatorResult.upsert({
      where: {
        indicatorId_periodRef: { indicatorId: indicator.id, periodRef: input.periodRef },
      },
      create: {
        indicatorId: indicator.id,
        periodRef: input.periodRef,
        periodDate,
        value: input.value,
        note: input.note ?? null,
        status: ResultStatus.FILLED,
        light: status.light as TrafficLight,
        attainment: status.attainment,
        deviationAbs: status.deviationAbs,
        deviationPct: status.deviationPct,
        createdById: userId,
      },
      update: {
        value: input.value,
        note: input.note ?? null,
        status: ResultStatus.FILLED,
        light: status.light as TrafficLight,
        attainment: status.attainment,
        deviationAbs: status.deviationAbs,
        deviationPct: status.deviationPct,
        createdById: userId,
      },
    });

    await this.traceability.record({
      companyId: indicator.companyId,
      indicatorId: indicator.id,
      userId,
      eventType: status.light === 'RED' ? TraceEventType.OFF_TARGET_ALERT : TraceEventType.RESULT_RECORDED,
      entityType: TraceEntityType.INDICATOR_RESULT,
      entityId: result.id,
      title: status.light === 'RED' ? 'Indicador fora da meta' : 'Resultado do indicador registrado',
      description: `${indicator.name} - ${input.periodRef}: realizado ${input.value}`,
      statusTo: status.light,
      metadata: {
        periodRef: input.periodRef,
        value: input.value,
        target: target?.target ?? null,
        attainment: status.attainment,
        deviationAbs: status.deviationAbs,
        deviationPct: status.deviationPct,
      },
    });

    let treatment: { id: string; status: TreatmentStatus } | null = null;
    if (status.light === 'RED') {
      const nextTreatmentStatus = TreatmentStatus.AWAITING_CAUSE_ANALYSIS;
      const existing = await this.prisma.treatmentCase.findUnique({
        where: { indicatorId_periodRef: { indicatorId: indicator.id, periodRef: input.periodRef } },
      });
      treatment = await this.prisma.treatmentCase.upsert({
        where: { indicatorId_periodRef: { indicatorId: indicator.id, periodRef: input.periodRef } },
        create: {
          companyId: indicator.companyId,
          indicatorId: indicator.id,
          resultId: result.id,
          periodRef: input.periodRef,
          title: `Tratativa - ${indicator.name} (${input.periodRef})`,
          problem: `Resultado ${input.value} fora da meta ${target?.target ?? 'nao definida'}.`,
          status: nextTreatmentStatus,
          createdById: userId,
        },
        update: {
          resultId: result.id,
          problem: `Resultado ${input.value} fora da meta ${target?.target ?? 'nao definida'}.`,
          status: existing?.status === TreatmentStatus.IGNORED_TEMPORARILY ? existing.status : nextTreatmentStatus,
        },
        select: { id: true, status: true },
      });

      await this.traceability.record({
        companyId: indicator.companyId,
        indicatorId: indicator.id,
        userId,
        eventType: TraceEventType.TREATMENT_STARTED,
        entityType: TraceEntityType.INDICATOR,
        entityId: indicator.id,
        relatedType: TraceEntityType.INDICATOR_RESULT,
        relatedId: result.id,
        title: 'Tratativa automática iniciada',
        description: `O indicador ficou fora da meta no período ${input.periodRef}.`,
        statusTo: treatment.status,
        metadata: { treatmentId: treatment.id, periodRef: input.periodRef, target: target?.target ?? null, value: input.value },
      });

      if (indicator.responsibleUserId) {
        await this.prisma.notification.create({
          data: {
            companyId: indicator.companyId,
            userId: indicator.responsibleUserId,
            kind: NotificationKind.INDICATOR_OFF_TARGET,
            title: 'Indicador fora da meta',
            body: `${indicator.name} ficou fora da meta em ${input.periodRef}. Inicie a tratativa.`,
            link: `/treatments/${treatment.id}`,
          },
        });
      }
    } else if (status.light === 'GREEN') {
      const openCases = await this.prisma.treatmentCase.findMany({
        where: {
          indicatorId: indicator.id,
          status: {
            in: [
              TreatmentStatus.AWAITING_REEVALUATION,
              TreatmentStatus.ACTIONS_IN_PROGRESS,
              TreatmentStatus.ACTION_PLAN_CREATED,
              TreatmentStatus.ACTIONS_OVERDUE,
            ],
          },
        },
      });
      for (const item of openCases) {
        await this.prisma.treatmentCase.update({
          where: { id: item.id },
          data: { status: TreatmentStatus.RESOLVED, resolvedAt: new Date() },
        });
        await this.traceability.record({
          companyId: indicator.companyId,
          indicatorId: indicator.id,
          userId,
          eventType: TraceEventType.INDICATOR_RESOLVED,
          entityType: TraceEntityType.INDICATOR,
          entityId: indicator.id,
          title: 'Indicador voltou para a meta',
          description: `${indicator.name} voltou para a meta em ${input.periodRef}.`,
          statusFrom: item.status,
          statusTo: TreatmentStatus.RESOLVED,
          metadata: { treatmentId: item.id, periodRef: input.periodRef, value: input.value },
        });
      }
    }

    return {
      result,
      shouldOpenDeviation: status.light === 'RED',
      treatment,
    };
  }

  async approve(id: string, approve: boolean) {
    return this.prisma.indicatorResult.update({
      where: { id },
      data: { status: approve ? ResultStatus.APPROVED : ResultStatus.REJECTED },
    });
  }
}
