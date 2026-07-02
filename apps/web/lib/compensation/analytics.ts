// Funcoes puras de analise do modulo Cargos e Salarios.
// Tudo composto no cliente a partir dos endpoints existentes (salaryFit, salary-tables,
// salary-surveys). Sem dependencia de React para serem facilmente testaveis.

import type { FitRow, SalaryRange, SalarySurvey } from './types';
import { toNumber } from './format';

// ---------------------------------------------------------------------------
// Faixas de compa-ratio (usadas na distribuicao e nas colunas da matriz de merito)
// ---------------------------------------------------------------------------

export interface CompaBand {
  key: string;
  label: string;
  min: number; // inclusivo
  max: number; // exclusivo (Infinity no ultimo)
}

export const COMPA_BANDS: CompaBand[] = [
  { key: 'b1', label: '< 0,80', min: -Infinity, max: 0.8 },
  { key: 'b2', label: '0,80 – 0,90', min: 0.8, max: 0.9 },
  { key: 'b3', label: '0,90 – 1,00', min: 0.9, max: 1.0 },
  { key: 'b4', label: '1,00 – 1,10', min: 1.0, max: 1.1 },
  { key: 'b5', label: '> 1,10', min: 1.1, max: Infinity },
];

export function compaBandIndex(compaRatio: number): number {
  return COMPA_BANDS.findIndex((band) => compaRatio >= band.min && compaRatio < band.max);
}

// ---------------------------------------------------------------------------
// KPIs e distribuicoes de enquadramento
// ---------------------------------------------------------------------------

export interface FitKpis {
  total: number;
  withRange: number; // colaboradores com faixa/tabela definida
  belowPct: number;
  inRangePct: number;
  abovePct: number;
  avgCompaRatio: number | null;
  avgPenetration: number | null;
  hasSalaryData: boolean;
}

export function computeFitKpis(rows: FitRow[]): FitKpis {
  const total = rows.length;
  const withRange = rows.filter((r) => r.situation !== 'SEM_TABELA' && r.situation !== 'PENDENTE_ANALISE').length;
  const below = rows.filter((r) => r.situation === 'ABAIXO_DA_FAIXA' || r.situation === 'PROXIMO_AO_MINIMO').length;
  const above = rows.filter((r) => r.situation === 'ACIMA_DA_FAIXA' || r.situation === 'PROXIMO_AO_TETO').length;
  const inRange = withRange - below - above;
  const compas = rows.map((r) => r.compaRatio).filter((v): v is number => v !== null);
  const pens = rows.map((r) => r.positioningPercent).filter((v): v is number => v !== null);
  return {
    total,
    withRange,
    belowPct: withRange ? (below / withRange) * 100 : 0,
    inRangePct: withRange ? (Math.max(inRange, 0) / withRange) * 100 : 0,
    abovePct: withRange ? (above / withRange) * 100 : 0,
    avgCompaRatio: compas.length ? compas.reduce((a, b) => a + b, 0) / compas.length : null,
    avgPenetration: pens.length ? pens.reduce((a, b) => a + b, 0) / pens.length : null,
    hasSalaryData: compas.length > 0,
  };
}

/** Distribuicao de colaboradores por faixa de compa-ratio (grafico de barras). */
export function compaRatioDistribution(rows: FitRow[]): Array<{ name: string; value: number }> {
  const counts = COMPA_BANDS.map(() => 0);
  for (const row of rows) {
    if (row.compaRatio === null) continue;
    const idx = compaBandIndex(row.compaRatio);
    if (idx >= 0) counts[idx] += 1;
  }
  return COMPA_BANDS.map((band, idx) => ({ name: band.label, value: counts[idx] }));
}

/** Histograma de penetração na faixa em blocos de 20%. */
export function penetrationHistogram(rows: FitRow[]): Array<{ name: string; value: number }> {
  const buckets = [
    { name: '0–20%', min: -Infinity, max: 20 },
    { name: '20–40%', min: 20, max: 40 },
    { name: '40–60%', min: 40, max: 60 },
    { name: '60–80%', min: 60, max: 80 },
    { name: '80–100%+', min: 80, max: Infinity },
  ];
  return buckets.map((bucket) => ({
    name: bucket.name,
    value: rows.filter((r) => r.positioningPercent !== null && r.positioningPercent >= bucket.min && r.positioningPercent < bucket.max).length,
  }));
}

// ---------------------------------------------------------------------------
// Equidade: dispersao de compa-ratio por dimensao (area / cargo / faixa)
// ---------------------------------------------------------------------------

export type EquityDimension = 'area' | 'job' | 'band';

export interface EquityRow {
  key: string;
  label: string;
  count: number;
  avgCompaRatio: number | null;
  avgSalary: number | null;
  gap: number | null; // diferenca da media do grupo vs media geral (pontos percentuais de compa-ratio)
}

export function equityByDimension(rows: FitRow[], dimension: EquityDimension): EquityRow[] {
  const keyOf = (r: FitRow) => {
    if (dimension === 'area') return r.orgNode?.name ?? 'Sem área';
    if (dimension === 'job') return r.job?.name ?? 'Sem cargo';
    return r.band ?? 'Sem faixa';
  };
  const groups = new Map<string, FitRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const allCompas = rows.map((r) => r.compaRatio).filter((v): v is number => v !== null);
  const overallAvg = allCompas.length ? allCompas.reduce((a, b) => a + b, 0) / allCompas.length : null;

  const result: EquityRow[] = [];
  for (const [key, list] of groups) {
    const compas = list.map((r) => r.compaRatio).filter((v): v is number => v !== null);
    const salaries = list.map((r) => r.currentSalary).filter((v): v is number => v !== null);
    const avgCompaRatio = compas.length ? compas.reduce((a, b) => a + b, 0) / compas.length : null;
    const avgSalary = salaries.length ? salaries.reduce((a, b) => a + b, 0) / salaries.length : null;
    result.push({
      key,
      label: key,
      count: list.length,
      avgCompaRatio,
      avgSalary,
      gap: avgCompaRatio !== null && overallAvg !== null ? avgCompaRatio - overallAvg : null,
    });
  }
  return result.sort((a, b) => (a.avgCompaRatio ?? 0) - (b.avgCompaRatio ?? 0));
}

// ---------------------------------------------------------------------------
// Posicionamento de mercado: pesquisa salarial x ponto medio interno
// ---------------------------------------------------------------------------

export interface MarketPositionRow {
  jobCatalogId: string;
  marketJobName: string;
  source: string;
  internalMidpoint: number | null;
  marketMedian: number | null;
  p25: number | null;
  p75: number | null;
  positioning: number | null; // interno / mediana de mercado (1 = na mediana)
  classification: 'LAG' | 'MATCH' | 'LEAD' | 'UNKNOWN';
}

/**
 * Junta pesquisas salariais (com internalJobCatalogId) ao ponto medio interno do cargo,
 * obtido das faixas das tabelas salariais publicadas. Classifica como abaixo (LAG),
 * alinhado (MATCH) ou acima (LEAD) do mercado conforme P25/P75.
 */
export function marketPositioning(surveys: SalarySurvey[], ranges: SalaryRange[]): MarketPositionRow[] {
  // Ponto medio interno por cargo: media dos midpoints das faixas vinculadas ao cargo.
  const midByJob = new Map<string, number[]>();
  for (const range of ranges) {
    const jobId = range.jobCatalog?.id;
    const mid = toNumber(range.midpointSalary);
    if (!jobId || mid === null) continue;
    const list = midByJob.get(jobId) ?? [];
    list.push(mid);
    midByJob.set(jobId, list);
  }

  const rows: MarketPositionRow[] = [];
  for (const survey of surveys) {
    if (!survey.internalJobCatalogId) continue;
    const mids = midByJob.get(survey.internalJobCatalogId);
    const internalMidpoint = mids && mids.length ? mids.reduce((a, b) => a + b, 0) / mids.length : null;
    const marketMedian = toNumber(survey.percentile50) ?? toNumber(survey.medianSalary);
    const p25 = toNumber(survey.percentile25);
    const p75 = toNumber(survey.percentile75);

    let classification: MarketPositionRow['classification'] = 'UNKNOWN';
    if (internalMidpoint !== null) {
      if (p25 !== null && internalMidpoint < p25) classification = 'LAG';
      else if (p75 !== null && internalMidpoint > p75) classification = 'LEAD';
      else if (p25 !== null || p75 !== null || marketMedian !== null) classification = 'MATCH';
    }

    rows.push({
      jobCatalogId: survey.internalJobCatalogId,
      marketJobName: survey.marketJobName,
      source: survey.source,
      internalMidpoint,
      marketMedian,
      p25,
      p75,
      positioning: internalMidpoint !== null && marketMedian ? internalMidpoint / marketMedian : null,
      classification,
    });
  }
  return rows.sort((a, b) => (a.positioning ?? 99) - (b.positioning ?? 99));
}

// ---------------------------------------------------------------------------
// Estrutura salarial: amplitude, progressao de ponto medio e sobreposicao
// ---------------------------------------------------------------------------

export interface StructureRow {
  id: string;
  label: string;
  min: number;
  mid: number;
  max: number;
  rangeSpread: number; // (max - min) / min  *100
  midpointProgression: number | null; // vs faixa anterior, em %
  overlapWithPrevious: number | null; // % de sobreposicao com a faixa anterior
}

/** Deriva metricas da estrutura a partir das faixas, ordenadas por ponto medio. */
export function salaryStructure(ranges: SalaryRange[]): StructureRow[] {
  const valid = ranges
    .map((range) => ({
      id: range.id,
      label: [range.band, range.grade].filter(Boolean).join(' / ') || range.band,
      min: toNumber(range.minSalary),
      mid: toNumber(range.midpointSalary),
      max: toNumber(range.maxSalary),
    }))
    .filter((r): r is { id: string; label: string; min: number; mid: number; max: number } => r.min !== null && r.mid !== null && r.max !== null)
    .sort((a, b) => a.mid - b.mid);

  return valid.map((range, idx) => {
    const prev = idx > 0 ? valid[idx - 1] : null;
    const overlap =
      prev && prev.max > range.min && prev.max - prev.min > 0
        ? ((prev.max - range.min) / (prev.max - prev.min)) * 100
        : prev
          ? 0
          : null;
    return {
      ...range,
      rangeSpread: range.min > 0 ? ((range.max - range.min) / range.min) * 100 : 0,
      midpointProgression: prev && prev.mid > 0 ? ((range.mid - prev.mid) / prev.mid) * 100 : null,
      overlapWithPrevious: overlap,
    };
  });
}

// ---------------------------------------------------------------------------
// Matriz de merito: desempenho x faixa de compa-ratio -> % de aumento sugerido
// ---------------------------------------------------------------------------

export interface PerformanceLevel {
  key: string;
  label: string;
}

export const PERFORMANCE_LEVELS: PerformanceLevel[] = [
  { key: 'p1', label: 'Abaixo do esperado' },
  { key: 'p2', label: 'Atende' },
  { key: 'p3', label: 'Supera' },
  { key: 'p4', label: 'Excepcional' },
];

// Matriz padrão (em %): linhas = desempenho, colunas = COMPA_BANDS.
// Quem esta abaixo da faixa (compa baixo) e tem bom desempenho recebe o maior aumento.
export const DEFAULT_MERIT_MATRIX: number[][] = [
  [0, 0, 0, 0, 0], // Abaixo do esperado
  [5, 4, 3, 2, 0], // Atende
  [7, 6, 5, 3, 1], // Supera
  [9, 8, 6, 4, 2], // Excepcional
];

/**
 * Distribuicao REAL de desempenho a partir dos ratings dos colaboradores
 * (rows do enquadramento). Retorna percentuais por nivel (soma 1) e a
 * cobertura (fracao do quadro com rating informado).
 */
export function ratingDistribution(rows: FitRow[]): { distribution: number[]; rated: number; coveragePct: number } {
  const counts = PERFORMANCE_LEVELS.map(() => 0);
  let rated = 0;
  for (const row of rows) {
    const rating = row.performanceRating;
    if (rating != null && rating >= 1 && rating <= PERFORMANCE_LEVELS.length) {
      counts[rating - 1] += 1;
      rated += 1;
    }
  }
  return {
    distribution: rated ? counts.map((count) => count / rated) : PERFORMANCE_LEVELS.map(() => 0),
    rated,
    coveragePct: rows.length ? (rated / rows.length) * 100 : 0,
  };
}

export interface MeritSimulationResult {
  perBand: Array<{ band: string; headcount: number; avgIncreasePct: number; payroll: number | null; cost: number | null }>;
  totalHeadcount: number;
  weightedAvgIncreasePct: number;
  totalPayroll: number | null;
  totalCost: number | null;
  hasSalaryData: boolean;
}

/**
 * Aplica a matriz sobre a populacao do enquadramento, agrupada por faixa de compa-ratio,
 * usando uma distribuicao de desempenho assumida (percentuais por nivel, somando 1).
 * O custo so e calculado quando ha salarios disponiveis (nao mascarados).
 */
export function simulateMerit(
  rows: FitRow[],
  matrix: number[][],
  performanceDistribution: number[],
): MeritSimulationResult {
  const perBand = COMPA_BANDS.map((band, bandIdx) => {
    const members = rows.filter((r) => r.compaRatio !== null && compaBandIndex(r.compaRatio) === bandIdx);
    // % medio ponderado pela distribuicao de desempenho assumida
    const avgIncreasePct = matrix.reduce((sum, perfRow, perfIdx) => sum + (perfRow[bandIdx] ?? 0) * (performanceDistribution[perfIdx] ?? 0), 0);
    const salaries = members.map((r) => r.currentSalary).filter((v): v is number => v !== null);
    const payroll = salaries.length ? salaries.reduce((a, b) => a + b, 0) : null;
    const cost = payroll !== null ? payroll * (avgIncreasePct / 100) : null;
    return { band: band.label, headcount: members.length, avgIncreasePct, payroll, cost };
  });

  const totalHeadcount = perBand.reduce((sum, b) => sum + b.headcount, 0);
  const weightedAvgIncreasePct = totalHeadcount
    ? perBand.reduce((sum, b) => sum + b.avgIncreasePct * b.headcount, 0) / totalHeadcount
    : 0;
  const withPayroll = perBand.filter((b) => b.payroll !== null);
  const totalPayroll = withPayroll.length ? withPayroll.reduce((sum, b) => sum + (b.payroll ?? 0), 0) : null;
  const totalCost = withPayroll.length ? withPayroll.reduce((sum, b) => sum + (b.cost ?? 0), 0) : null;

  return {
    perBand,
    totalHeadcount,
    weightedAvgIncreasePct,
    totalPayroll,
    totalCost,
    hasSalaryData: withPayroll.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Arquitetura de cargos: matriz familia x grade (contagem de cargos)
// ---------------------------------------------------------------------------

export interface JobArchitecture {
  families: string[];
  grades: string[];
  counts: Record<string, Record<string, number>>; // counts[family][grade]
}

export function jobArchitecture(jobs: Array<{ family: string | null; grade: string | null }>): JobArchitecture {
  const familySet = new Set<string>();
  const gradeSet = new Set<string>();
  const counts: Record<string, Record<string, number>> = {};
  for (const job of jobs) {
    const family = job.family || 'Sem família';
    const grade = job.grade || 'Sem grade';
    familySet.add(family);
    gradeSet.add(grade);
    counts[family] = counts[family] ?? {};
    counts[family][grade] = (counts[family][grade] ?? 0) + 1;
  }
  return {
    families: Array.from(familySet).sort(),
    grades: Array.from(gradeSet).sort(),
    counts,
  };
}
