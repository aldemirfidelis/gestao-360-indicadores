import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrizeAuditService } from './prize-audit.service';

/**
 * Dashboard executivo do modulo. Os cards de fases futuras (apuracao, folha,
 * espelhos) retornam 0 ate serem implementados, mas ja aparecem na UI para dar
 * a visao completa do ciclo.
 */
@Injectable()
export class PrizeOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PrizeAuditService,
  ) {}

  async overview(companyId: string, query: { programId?: string } = {}) {
    const programFilter = query.programId ? { programId: query.programId } : {};

    const [
      programsActive,
      competencesFilling,
      competencesValidation,
      competencesClosed,
      annexesPendingApproval,
      annexesEffective,
      indicators,
    ] = await Promise.all([
      this.prisma.prizeProgram.count({ where: { companyId, deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.prizeCompetence.count({ where: { companyId, ...programFilter, status: { in: ['OPEN', 'FILLING'] } } }),
      this.prisma.prizeCompetence.count({ where: { companyId, ...programFilter, status: { in: ['IN_VALIDATION', 'PRE_CLOSE'] } } }),
      this.prisma.prizeCompetence.count({ where: { companyId, ...programFilter, status: { in: ['CLOSED_FOR_CALC', 'APPROVED', 'PAYSLIPS_PUBLISHED', 'CLOSED'] } } }),
      this.prisma.prizeAnnexVersion.count({ where: { annex: { companyId, ...programFilter }, status: { in: ['IN_VALIDATION', 'IN_APPROVAL'] } } }),
      this.prisma.prizeAnnexVersion.count({ where: { annex: { companyId, ...programFilter }, status: 'EFFECTIVE' } }),
      this.prisma.prizeIndicator.count({ where: { companyId, ...programFilter, deletedAt: null } }),
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
        // Fases futuras (placeholder visivel)
        eligibleEmployees: 0,
        divergences: 0,
        calculationsProcessed: 0,
        payrollBatches: 0,
        payslipsPublished: 0,
      },
      recentActivity: recentAudit.slice(0, 15),
    };
  }
}
