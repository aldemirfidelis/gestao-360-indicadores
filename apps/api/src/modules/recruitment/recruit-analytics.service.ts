import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { average, buildFunnelByStageType, countStale, diffDays, groupCount } from './recruit-analytics.logic';

const OPEN_REQUISITION_STATUSES = ['SUBMITTED', 'APPROVED', 'SENT_TO_RECRUITMENT', 'IN_RECRUITMENT'];
const DEFAULT_REQUISITION_SLA_DAYS = 30;
const DEFAULT_STAGE_AGING_DAYS = 14;

/**
 * Dashboard de Analytics do funil (F-B): time-to-hire, time-to-fill, funil por tipo de
 * etapa (cross-vaga), origem da candidatura, motivo/estágio de rejeição e aging (vaga e
 * candidato parados). Tudo derivado de dados que já existem — nenhuma tabela nova.
 * O funil por status ATIVO é sempre um snapshot atual (não filtra por período); as
 * métricas de volume/tempo respeitam o período informado.
 */
@Injectable()
export class RecruitAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFunnel(me: AuthPayload, filters: { from?: string; to?: string } = {}) {
    const companyId = me.companyId;
    const now = new Date();
    const to = filters.to ? new Date(filters.to) : now;
    const from = filters.from ? new Date(filters.from) : new Date(to.getTime() - 90 * 86_400_000);
    const appliedRange = { gte: from, lte: to };

    const [totalApplications, totalHired, totalRejected, totalWithdrawn, activeApplications, sourceRows, hiredSourceRows, admissions, filledOpenings, openRequisitions, rejectedWithStage] =
      await Promise.all([
        this.prisma.recruitApplication.count({ where: { companyId, appliedAt: appliedRange } }),
        this.prisma.recruitApplication.count({ where: { companyId, status: 'HIRED', appliedAt: appliedRange } }),
        this.prisma.recruitApplication.count({ where: { companyId, status: 'REJECTED', appliedAt: appliedRange } }),
        this.prisma.recruitApplication.count({ where: { companyId, status: 'WITHDRAWN', appliedAt: appliedRange } }),
        this.prisma.recruitApplication.findMany({
          where: { companyId, status: 'ACTIVE' },
          select: { updatedAt: true, stage: { select: { type: true } } },
        }),
        this.prisma.recruitApplication.groupBy({ by: ['source'], where: { companyId, appliedAt: appliedRange }, _count: { _all: true } }),
        this.prisma.recruitApplication.groupBy({ by: ['source'], where: { companyId, status: 'HIRED', appliedAt: appliedRange }, _count: { _all: true } }),
        this.prisma.recruitAdmission.findMany({
          where: { companyId, createdAt: appliedRange },
          select: { createdAt: true, application: { select: { appliedAt: true } } },
        }),
        this.prisma.recruitRequisitionOpening.findMany({
          where: { companyId, status: 'FILLED', filledAt: appliedRange },
          select: { filledAt: true, requisition: { select: { createdAt: true } } },
        }),
        this.prisma.recruitRequisition.findMany({
          where: { companyId, deletedAt: null, status: { in: OPEN_REQUISITION_STATUSES } },
          select: { id: true, code: true, createdAt: true, slaDays: true, priority: true },
        }),
        this.prisma.recruitApplication.findMany({
          where: { companyId, status: 'REJECTED', rejectedAt: appliedRange },
          select: { stage: { select: { name: true } } },
        }),
      ]);

    const funnel = buildFunnelByStageType(activeApplications.map((a) => ({ stageType: a.stage?.type ?? null })));
    const staleCandidatesCount = countStale(
      activeApplications.map((a) => ({ referenceDate: a.updatedAt, limitDays: DEFAULT_STAGE_AGING_DAYS })),
      now,
      DEFAULT_STAGE_AGING_DAYS,
    );
    const staleRequisitions = openRequisitions
      .filter((r) => diffDays(now, r.createdAt) > (r.slaDays ?? DEFAULT_REQUISITION_SLA_DAYS))
      .map((r) => ({ id: r.id, code: r.code, daysOpen: Math.round(diffDays(now, r.createdAt)), slaDays: r.slaDays ?? DEFAULT_REQUISITION_SLA_DAYS, priority: r.priority }));

    const hiredBySource = new Map(hiredSourceRows.map((r) => [r.source, r._count._all]));
    const bySource = sourceRows
      .map((r) => ({ source: r.source, count: r._count._all, hired: hiredBySource.get(r.source) ?? 0 }))
      .sort((a, b) => b.count - a.count);

    const rejectionByStage = groupCount(rejectedWithStage, (r) => r.stage?.name ?? '');

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      overview: {
        totalApplications,
        totalHired,
        totalRejected,
        totalWithdrawn,
        activeApplications: activeApplications.length,
        openRequisitions: openRequisitions.length,
        avgTimeToHireDays: average(admissions.map((a) => diffDays(a.createdAt, a.application.appliedAt))),
        avgTimeToFillDays: average(filledOpenings.filter((o) => o.filledAt).map((o) => diffDays(o.filledAt as Date, o.requisition.createdAt))),
      },
      funnel,
      bySource,
      rejectionByStage: rejectionByStage.map((r) => ({ stageName: r.key === 'OUTROS' ? 'Sem etapa registrada' : r.key, count: r.count })),
      aging: {
        staleCandidates: staleCandidatesCount,
        staleCandidatesThresholdDays: DEFAULT_STAGE_AGING_DAYS,
        staleRequisitions,
      },
    };
  }
}
