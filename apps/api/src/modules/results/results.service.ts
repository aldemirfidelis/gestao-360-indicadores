import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { calcStatus } from '@g360/shared';
import { IndicatorResultUpsertInput } from '@g360/shared';
import { Direction, ResultStatus, TrafficLight } from '@prisma/client';
import { lastNPeriodRefs, periodRefToDate } from '../indicators/period.util';

interface ResultSaveOutcome {
  result: any;
  shouldOpenDeviation: boolean;
}

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista lancamentos pendentes/preenchidos para um conjunto de indicadores
   * relativos aos N ultimos periodos, agrupados.
   */
  async pendingByCompany(companyId: string, points = 6, ownerNodeId?: string) {
    const indicators = await this.prisma.indicator.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: 'ACTIVE',
        ...(ownerNodeId ? { ownerNodeId } : {}),
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
      }>;
    }> = [];

    for (const ind of indicators) {
      const refs = lastNPeriodRefs(ind.periodicity, points);
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

    return {
      result,
      shouldOpenDeviation: status.light === 'RED',
    };
  }

  async approve(id: string, approve: boolean) {
    return this.prisma.indicatorResult.update({
      where: { id },
      data: { status: approve ? ResultStatus.APPROVED : ResultStatus.REJECTED },
    });
  }
}
