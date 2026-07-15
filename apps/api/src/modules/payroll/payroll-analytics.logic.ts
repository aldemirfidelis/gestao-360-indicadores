/**
 * Análise da folha (Fase 7): detecção de anomalias entre competências e
 * agregações para a Gestão à Vista. Tudo puro/determinístico e testável.
 */

export interface WorkerSnapshot {
  employeeId: string;
  name: string;
  netCents: number;
  earningsCents: number;
}

export interface PayrollAnomaly {
  severity: 'HIGH' | 'MEDIUM' | 'INFO';
  code: 'NEW' | 'REMOVED' | 'NET_VARIATION' | 'NET_ZERO' | 'NET_SPIKE';
  employeeId?: string;
  name: string;
  message: string;
  currentCents?: number;
  previousCents?: number;
}

/**
 * Compara o processamento atual com o anterior (mesma natureza) por colaborador
 * e aponta anomalias: entradas/saídas da folha e variações de líquido acima do
 * limite (padrão 30%). Serve de revisão antes de aprovar/pagar.
 */
export function detectPayrollAnomalies(
  current: WorkerSnapshot[],
  previous: WorkerSnapshot[],
  opts: { variationPct?: number } = {},
): PayrollAnomaly[] {
  const threshold = (opts.variationPct ?? 30) / 100;
  const prevById = new Map(previous.map((w) => [w.employeeId, w]));
  const currById = new Map(current.map((w) => [w.employeeId, w]));
  const anomalies: PayrollAnomaly[] = [];

  for (const worker of current) {
    const prev = prevById.get(worker.employeeId);
    if (!prev) {
      anomalies.push({ severity: 'INFO', code: 'NEW', employeeId: worker.employeeId, name: worker.name, message: 'Entrou na folha nesta competência.', currentCents: worker.netCents });
      continue;
    }
    if (worker.netCents <= 0 && prev.netCents > 0) {
      anomalies.push({ severity: 'HIGH', code: 'NET_ZERO', employeeId: worker.employeeId, name: worker.name, message: 'Líquido zerou em relação ao mês anterior.', currentCents: worker.netCents, previousCents: prev.netCents });
      continue;
    }
    if (prev.netCents > 0) {
      const variation = (worker.netCents - prev.netCents) / prev.netCents;
      if (Math.abs(variation) >= threshold) {
        const up = variation > 0;
        anomalies.push({
          severity: up && variation >= 1 ? 'HIGH' : 'MEDIUM',
          code: up && variation >= 1 ? 'NET_SPIKE' : 'NET_VARIATION',
          employeeId: worker.employeeId,
          name: worker.name,
          message: `Líquido ${up ? 'subiu' : 'caiu'} ${Math.round(Math.abs(variation) * 100)}% vs mês anterior.`,
          currentCents: worker.netCents,
          previousCents: prev.netCents,
        });
      }
    }
  }
  for (const worker of previous) {
    if (!currById.has(worker.employeeId)) {
      anomalies.push({ severity: 'MEDIUM', code: 'REMOVED', employeeId: worker.employeeId, name: worker.name, message: 'Estava na folha do mês anterior e saiu.', previousCents: worker.netCents });
    }
  }
  const rank = { HIGH: 0, MEDIUM: 1, INFO: 2 };
  return anomalies.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

// ------------------------------ agregações (Gestão à Vista) ------------------------------

export interface RunAggregateInput {
  periodRef: string;
  workers: number;
  earningsCents: number;
  deductionsCents: number;
  netCents: number;
  inssCents: number;
  irrfCents: number;
  fgtsCents: number;
}

export interface PayrollKpis {
  totalCostCents: number; // custo do empregador: bruto + FGTS (+ encargos patronais quando houver)
  netCents: number;
  avgCostCents: number;
  workers: number;
  chargesCents: number; // FGTS (encargos rastreados)
  chargesPct: number; // encargos / bruto
}

/** KPIs de uma competência (custo total, médio, encargos). */
export function computeKpis(run: RunAggregateInput): PayrollKpis {
  const totalCost = run.earningsCents + run.fgtsCents;
  const workers = run.workers || 0;
  return {
    totalCostCents: totalCost,
    netCents: run.netCents,
    avgCostCents: workers ? Math.round(totalCost / workers) : 0,
    workers,
    chargesCents: run.fgtsCents,
    chargesPct: run.earningsCents ? Math.round((run.fgtsCents / run.earningsCents) * 1000) / 10 : 0,
  };
}
