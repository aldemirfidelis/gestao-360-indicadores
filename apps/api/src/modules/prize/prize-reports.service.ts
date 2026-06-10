import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function num(v: any): number { const n = Number(v ?? 0); return Number.isNaN(n) ? 0 : n; }
function csvCell(v: unknown): string { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

/**
 * Relatorios gerenciais e operacionais do premio (apuracao, pendencias) + CSV.
 * Previsto x Realizado tem servico proprio (PrizePrevistoRealizadoService).
 */
@Injectable()
export class PrizeReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Relatorio de apuracao: por colaborador + agregacoes por area/cargo/centro de custo. */
  async apuracao(companyId: string, competenceId: string) {
    const competence = await this.prisma.prizeCompetence.findFirst({ where: { id: competenceId, companyId } });
    if (!competence) throw new NotFoundException('Competência não encontrada');
    const run = await this.prisma.prizeCalculationRun.findFirst({
      where: { companyId, competenceId, status: { in: ['SUCCESS', 'PARTIAL'] } },
      orderBy: { version: 'desc' },
    });
    if (!run) return { run: null, rows: [], groups: { byArea: [], byPosition: [], byCostCenter: [] }, totals: { gross: 0, reductions: 0, final: 0, blocked: 0 } };

    const [results, snapshots] = await Promise.all([
      this.prisma.prizeCalculationResult.findMany({ where: { runId: run.id }, orderBy: { name: 'asc' } }),
      this.prisma.prizeEmployeeSnapshot.findMany({ where: { companyId, competenceId, current: true } }),
    ]);
    const empByReg = new Map(snapshots.map((s) => [s.registration, s]));

    const rows = results.map((r) => {
      const e = empByReg.get(r.registration);
      return {
        registration: r.registration, name: r.name, area: e?.areaRef ?? null, position: e?.positionRef ?? null, costCenter: e?.costCenterRef ?? null,
        gross: num(r.grossValue), reductions: num(r.totalReductions), adjustments: num(r.adjustments), gratification: num(r.gratification),
        final: num(r.finalValue), blocked: r.blocked, exceptionType: r.exceptionType,
      };
    });

    const group = (key: 'area' | 'position' | 'costCenter') => {
      const m = new Map<string, { key: string; count: number; final: number; gross: number; reductions: number }>();
      for (const r of rows) {
        const k = (r as any)[key] ?? '—';
        const g = m.get(k) ?? { key: k, count: 0, final: 0, gross: 0, reductions: 0 };
        g.count++; g.final += r.final; g.gross += r.gross; g.reductions += r.reductions;
        m.set(k, g);
      }
      return [...m.values()].sort((a, b) => b.final - a.final);
    };

    const totals = rows.reduce((t, r) => ({ gross: t.gross + r.gross, reductions: t.reductions + r.reductions, final: t.final + r.final, blocked: t.blocked + (r.blocked ? 1 : 0) }), { gross: 0, reductions: 0, final: 0, blocked: 0 });

    return {
      run: { version: run.version, totalEmployees: run.totalEmployees, engineVersion: run.engineVersion },
      rows,
      groups: { byArea: group('area'), byPosition: group('position'), byCostCenter: group('costCenter') },
      totals,
    };
  }

  async apuracaoCsv(companyId: string, competenceId: string): Promise<string> {
    const rep = await this.apuracao(companyId, competenceId);
    const header = ['matricula', 'nome', 'area', 'cargo', 'centro_custo', 'bruto', 'reducoes', 'ajustes', 'gratificacao', 'final', 'bloqueado', 'excecao'];
    const lines = [header.join(';')];
    for (const r of rep.rows) {
      lines.push([r.registration, r.name, r.area ?? '', r.position ?? '', r.costCenter ?? '', r.gross.toFixed(2), r.reductions.toFixed(2), num(r.adjustments).toFixed(2), num(r.gratification).toFixed(2), r.final.toFixed(2), r.blocked ? 'SIM' : 'NAO', r.exceptionType ?? ''].map(csvCell).join(';'));
    }
    return lines.join('\n');
  }

  /** Relatorio operacional: pendencias do ciclo. */
  async operational(companyId: string, competenceId?: string) {
    const compFilter = competenceId ? { competenceId } : {};
    const [annexesPending, openCompetences, payrollRejected, payslipsUnpublished, ackPending, indicatorsTotal, actualsDistinct] = await Promise.all([
      this.prisma.prizeAnnexVersion.count({ where: { annex: { companyId }, status: { in: ['IN_VALIDATION', 'IN_APPROVAL'] } } }),
      this.prisma.prizeCompetence.count({ where: { companyId, status: { in: ['OPEN', 'FILLING', 'IN_VALIDATION'] } } }),
      this.prisma.prizePayrollBatch.count({ where: { companyId, ...compFilter, rejectedCount: { gt: 0 } } }),
      this.prisma.prizePayslip.count({ where: { companyId, ...compFilter, status: 'GENERATED' } }),
      this.prisma.prizePayslip.count({ where: { companyId, ...compFilter, status: 'PUBLISHED', acknowledgedAt: null } }),
      competenceId ? this.indicatorsForCompetence(companyId, competenceId) : Promise.resolve(0),
      competenceId ? this.prisma.prizeActualResult.findMany({ where: { companyId, competenceId, realized: { not: null } }, select: { indicatorId: true }, distinct: ['indicatorId'] }).then((a) => a.length) : Promise.resolve(0),
    ]);
    return {
      items: [
        { key: 'annexes_pending', label: 'Anexos aguardando aprovação', value: annexesPending },
        { key: 'indicators_without_actual', label: 'Indicadores sem realizado', value: Math.max(0, indicatorsTotal - actualsDistinct) },
        { key: 'open_competences', label: 'Competências abertas', value: openCompetences },
        { key: 'payroll_rejected', label: 'Lotes de folha com rejeições', value: payrollRejected },
        { key: 'payslips_unpublished', label: 'Espelhos não publicados', value: payslipsUnpublished },
        { key: 'ack_pending', label: 'Ciência pendente', value: ackPending },
      ],
    };
  }

  private async indicatorsForCompetence(companyId: string, competenceId: string) {
    const comp = await this.prisma.prizeCompetence.findFirst({ where: { id: competenceId, companyId }, select: { programId: true } });
    if (!comp) return 0;
    return this.prisma.prizeIndicator.count({ where: { companyId, programId: comp.programId, deletedAt: null } });
  }
}
