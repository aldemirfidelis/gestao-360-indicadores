import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { evaluateActual } from './prize-evaluation';
import { PrizeActualsService } from './prize-actuals.service';

function num(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/**
 * Acompanhamento Previsto x Realizado de uma competencia: para cada indicador,
 * compara meta/zero (parametro vigente) com o realizado lancado e produz desvio,
 * percentual de atingimento e faixa alcancada. Permite gestao ativa antes do
 * fechamento (abrir tratativa/plano de acao quando fora da meta).
 */
@Injectable()
export class PrizePrevistoRealizadoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actuals: PrizeActualsService,
  ) {}

  async forCompetence(companyId: string, competenceId: string, scopeKey = '') {
    const competence = await this.prisma.prizeCompetence.findFirst({ where: { id: competenceId, companyId } });
    if (!competence) throw new NotFoundException('Competência não encontrada');

    const indicators = await this.prisma.prizeIndicator.findMany({
      where: { companyId, programId: competence.programId, deletedAt: null },
      include: { ranges: { orderBy: { orderIndex: 'asc' } } },
      orderBy: { name: 'asc' },
    });

    const actuals = await this.prisma.prizeActualResult.findMany({
      where: { companyId, competenceId, scopeKey },
    });
    const actualByIndicator = new Map(actuals.map((a) => [a.indicatorId, a]));

    const rows = [];
    for (const ind of indicators) {
      const param = await this.actuals.resolveParameter(ind.id, competence.year, competence.month, competenceId, scopeKey);
      const actual = actualByIndicator.get(ind.id);
      const evalResult = evaluateActual(
        num(actual?.realized),
        param ? { target: num(param.target), zero: num(param.zero) } : null,
        ind.ranges.map((r) => ({
          orderIndex: r.orderIndex,
          minLimit: num(r.minLimit),
          maxLimit: num(r.maxLimit),
          achievementPercent: num(r.achievementPercent),
          gainPercent: num(r.gainPercent),
        })),
      );
      rows.push({
        indicatorId: ind.id,
        code: ind.code,
        name: ind.name,
        unit: ind.unit,
        kind: ind.kind,
        weight: num(ind.weight),
        platformIndicatorId: ind.platformIndicatorId,
        actualId: actual?.id ?? null,
        actualStatus: actual?.status ?? null,
        ...evalResult,
      });
    }

    const withActual = rows.filter((r) => r.hasActual);
    return {
      competenceId,
      scopeKey,
      summary: {
        indicators: rows.length,
        withActual: withActual.length,
        missingActual: rows.length - withActual.length,
        offTarget: withActual.filter((r) => r.onTarget === false).length,
      },
      rows,
    };
  }
}
