import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrizeAuditService } from './prize-audit.service';

/** Dashboard do módulo, consultando os dados reais de todas as fases. */
@Injectable()
export class PrizeOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PrizeAuditService,
  ) {}

  async overview(companyId: string, query: { programId?: string } = {}) {
    const programFilter = query.programId ? { programId: query.programId } : {};

    const competenceFilter = query.programId ? { competenceId: { in: (await this.prisma.prizeCompetence.findMany({ where: { companyId, programId: query.programId }, select: { id: true } })).map(row => row.id) } } : {};
    const [
      programsActive,
      competencesFilling,
      competencesValidation,
      competencesClosed,
      annexesPendingApproval,
      annexesEffective,
      indicators, eligibleEmployees, divergences, calculationsProcessed, payrollBatches, payslipsPublished,
    ] = await Promise.all([
      this.prisma.prizeProgram.count({ where: { companyId, deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.prizeCompetence.count({ where: { companyId, ...programFilter, status: { in: ['OPEN', 'FILLING'] } } }),
      this.prisma.prizeCompetence.count({ where: { companyId, ...programFilter, status: { in: ['IN_VALIDATION', 'PRE_CLOSE'] } } }),
      this.prisma.prizeCompetence.count({ where: { companyId, ...programFilter, status: { in: ['CLOSED_FOR_CALC', 'APPROVED', 'PAYSLIPS_PUBLISHED', 'CLOSED'] } } }),
      this.prisma.prizeAnnexVersion.count({ where: { annex: { companyId, ...programFilter }, status: { in: ['IN_VALIDATION', 'IN_APPROVAL'] } } }),
      this.prisma.prizeAnnexVersion.count({ where: { annex: { companyId, ...programFilter }, status: 'EFFECTIVE' } }),
      this.prisma.prizeIndicator.count({ where: { companyId, ...programFilter, deletedAt: null } }),
      this.prisma.prizeEmployeeSnapshot.count({ where: { companyId, ...competenceFilter, current: true, eligible: true } }),
      this.prisma.prizeEmployeeSnapshot.count({ where: { companyId, ...competenceFilter, current: true, OR: [{ blocked: true }, { eligible: false }] } }),
      this.prisma.prizeCalculationRun.count({ where: { companyId, ...competenceFilter, status: 'SUCCESS' } }),
      this.prisma.prizePayrollBatch.count({ where: { companyId, ...competenceFilter } }),
      this.prisma.prizePayslip.count({ where: { companyId, ...competenceFilter, status: 'PUBLISHED' } }),
    ]);

    const recentAudit = await this.audit.list(companyId);

    return {
      cards: {
        programsActive,
        competencesFilling,
        competencesValidation,
        competencesClosed,
        annexesPendingApproval,
        annexesEffective,
        indicators,
        eligibleEmployees, divergences, calculationsProcessed, payrollBatches, payslipsPublished,
      },
      recentActivity: recentAudit.slice(0, 15),
    };
  }
}
