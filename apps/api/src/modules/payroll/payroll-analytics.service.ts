import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { computeKpis, detectPayrollAnomalies, type WorkerSnapshot } from './payroll-analytics.logic';

@Injectable()
export class PayrollAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Gestão à Vista: KPIs da última competência fechada + evolução recente. */
  async dashboard(me: AuthPayload) {
    const runs = await this.prisma.payrollRun.findMany({
      where: { companyId: me.companyId, kind: 'MENSAL', status: 'CLOSED' },
      orderBy: [{ competence: { year: 'desc' } }, { competence: { month: 'desc' } }],
      take: 12,
      select: { id: true, totals: true, competence: { select: { year: true, month: true } } },
    });
    const cents = (v: unknown) => Math.round(Number(String(v ?? '0')) * 100);
    const series = runs
      .map((run) => {
        const t = (run.totals ?? {}) as Record<string, unknown>;
        const agg = {
          periodRef: `${run.competence.year}-${String(run.competence.month).padStart(2, '0')}`,
          workers: Number(t.workers ?? 0),
          earningsCents: cents(t.gross),
          deductionsCents: cents(t.deductions),
          netCents: cents(t.net),
          inssCents: cents(t.inss),
          irrfCents: cents(t.irrf),
          fgtsCents: cents(t.fgts),
        };
        return { ...agg, kpis: computeKpis(agg) };
      })
      .reverse(); // cronológico crescente para gráficos
    const latest = series[series.length - 1] ?? null;
    return { latest, series };
  }

  /** Anomalias do processamento vs o processamento fechado anterior (mesma natureza). */
  async anomalies(me: AuthPayload, runId: string, variationPct?: number) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, companyId: me.companyId },
      select: { id: true, kind: true, competence: { select: { year: true, month: true } } },
    });
    if (!run) throw new NotFoundException('Processamento não encontrado.');
    // Processamento anterior (mesma natureza, competência imediatamente menor).
    const previousRun = await this.prisma.payrollRun.findFirst({
      where: {
        companyId: me.companyId,
        kind: run.kind,
        id: { not: run.id },
        OR: [
          { competence: { year: run.competence.year, month: { lt: run.competence.month } } },
          { competence: { year: { lt: run.competence.year } } },
        ],
      },
      orderBy: [{ competence: { year: 'desc' } }, { competence: { month: 'desc' } }],
      select: { id: true, competence: { select: { year: true, month: true } } },
    });

    const [current, previous] = await Promise.all([
      this.snapshots(me.companyId, run.id),
      previousRun ? this.snapshots(me.companyId, previousRun.id) : Promise.resolve([]),
    ]);
    const anomalies = detectPayrollAnomalies(current, previous, { variationPct });
    return {
      runId: run.id,
      previousPeriodRef: previousRun ? `${previousRun.competence.year}-${String(previousRun.competence.month).padStart(2, '0')}` : null,
      count: anomalies.length,
      high: anomalies.filter((a) => a.severity === 'HIGH').length,
      anomalies,
    };
  }

  private async snapshots(companyId: string, runId: string): Promise<WorkerSnapshot[]> {
    const workers = await this.prisma.payrollRunWorker.findMany({
      where: { companyId, runId, status: 'CALCULATED' },
      select: { employeeId: true, netPay: true, totalEarnings: true },
    });
    const employees = await this.prisma.orgEmployee.findMany({
      where: { companyId, id: { in: workers.map((w) => w.employeeId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(employees.map((e) => [e.id, e.name]));
    return workers.map((w) => ({
      employeeId: w.employeeId,
      name: nameById.get(w.employeeId) ?? '—',
      netCents: Math.round(Number(w.netPay.toString()) * 100),
      earningsCents: Math.round(Number(w.totalEarnings.toString()) * 100),
    }));
  }
}
