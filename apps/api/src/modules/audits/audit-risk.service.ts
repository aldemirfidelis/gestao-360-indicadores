import { Injectable } from '@nestjs/common';
import { AuditRiskLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class AuditRiskService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(companyId: string, criteriaValues: Record<string, unknown> = {}, tx: Tx | PrismaService = this.prisma) {
    const criteria = await tx.auditRiskCriterion.findMany({
      where: { companyId, active: true, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    if (criteria.length === 0) {
      const value = number(criteriaValues.manual ?? criteriaValues.score ?? 0, 0);
      return this.fromPercent(value);
    }

    let weighted = 0;
    let maxWeighted = 0;
    const normalized: Record<string, number> = {};
    for (const criterion of criteria) {
      const raw = criteriaValues[criterion.key] ?? criteriaValues[criterion.formulaVariable ?? ''] ?? criterion.defaultScore;
      const score = clamp(number(raw, criterion.defaultScore), criterion.minScore, criterion.maxScore);
      normalized[criterion.key] = score;
      weighted += score * criterion.weight;
      maxWeighted += criterion.maxScore * criterion.weight;
    }

    const percent = maxWeighted > 0 ? (weighted / maxWeighted) * 100 : 0;
    return {
      ...this.fromPercent(percent),
      criteriaValues: normalized,
      formulaSnapshot: 'weighted_average(company criteria)',
    };
  }

  async scoreUniverseItem(tx: Tx, companyId: string, universeItemId: string, criteriaValues: Record<string, unknown>, justification?: string | null, changedById?: string) {
    const result = await this.calculate(companyId, criteriaValues, tx);
    const history = await tx.auditRiskScore.create({
      data: {
        companyId,
        universeItemId,
        calculatedScore: result.score,
        level: result.level,
        criteriaValues: result.criteriaValues as Prisma.InputJsonValue,
        formulaSnapshot: result.formulaSnapshot,
        recommendedFrequencyDays: result.recommendedFrequencyDays,
        justification,
        changedById,
      },
    });
    await tx.auditUniverseItem.update({
      where: { id: universeItemId },
      data: {
        riskScore: result.score,
        riskLevel: result.level,
        recommendedFrequencyDays: result.recommendedFrequencyDays,
        nextSuggestedAuditAt: addDays(new Date(), result.recommendedFrequencyDays),
      },
    });
    return { result, history };
  }

  private fromPercent(value: number) {
    const score = clamp(value, 0, 100);
    const level =
      score >= 80 ? AuditRiskLevel.CRITICAL :
      score >= 60 ? AuditRiskLevel.HIGH :
      score >= 35 ? AuditRiskLevel.MODERATE :
      AuditRiskLevel.LOW;
    const recommendedFrequencyDays =
      level === AuditRiskLevel.CRITICAL ? 90 :
      level === AuditRiskLevel.HIGH ? 180 :
      level === AuditRiskLevel.MODERATE ? 365 :
      730;
    return { score, level, recommendedFrequencyDays, criteriaValues: {}, formulaSnapshot: 'manual_percent' };
  }
}

function number(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
