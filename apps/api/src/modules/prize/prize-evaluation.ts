/**
 * Avaliacao Previsto x Realizado (pura, sem banco — testavel isoladamente).
 * Dado o realizado, o parametro vigente (meta/zero) e as faixas do indicador,
 * calcula desvio, percentual de atingimento, faixa alcancada e percentual de
 * ganho. O impacto financeiro no premio e responsabilidade do motor de calculo
 * (Fase 4); aqui produzimos apenas a leitura de desempenho.
 */
export interface EvalParam {
  target?: number | null;
  zero?: number | null;
}
export interface EvalRange {
  orderIndex?: number;
  minLimit?: number | null;
  maxLimit?: number | null;
  achievementPercent?: number | null;
  gainPercent?: number | null;
}
export interface EvalResult {
  hasActual: boolean;
  realized: number | null;
  target: number | null;
  zero: number | null;
  deviation: number | null;
  deviationPercent: number | null;
  achievementPercent: number | null;
  gainPercent: number | null;
  rangeLabel: string | null;
  onTarget: boolean | null;
}

function round2(n: number | null | undefined): number | null {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function rangeLabel(r: EvalRange): string {
  const lo = r.minLimit === null || r.minLimit === undefined ? '-∞' : String(r.minLimit);
  const hi = r.maxLimit === null || r.maxLimit === undefined ? '+∞' : String(r.maxLimit);
  return `[${lo} a ${hi}]`;
}

export function evaluateActual(
  realized: number | null | undefined,
  param: EvalParam | null | undefined,
  ranges: EvalRange[] = [],
): EvalResult {
  const target = param?.target ?? null;
  const zero = param?.zero ?? null;

  if (realized === null || realized === undefined) {
    return { hasActual: false, realized: null, target, zero, deviation: null, deviationPercent: null, achievementPercent: null, gainPercent: null, rangeLabel: null, onTarget: null };
  }

  const deviation = target !== null ? realized - target : null;
  const deviationPercent = target !== null && target !== 0 ? (realized - target) / Math.abs(target) * 100 : null;

  // Faixa: primeira (por orderIndex) cujos limites contem o realizado.
  const sorted = [...ranges].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  const matched = sorted.find(
    (r) =>
      (r.minLimit === null || r.minLimit === undefined || realized >= r.minLimit) &&
      (r.maxLimit === null || r.maxLimit === undefined || realized <= r.maxLimit),
  );

  let achievementPercent: number | null = null;
  let gainPercent: number | null = null;
  let label: string | null = null;

  if (matched) {
    achievementPercent = matched.achievementPercent ?? null;
    gainPercent = matched.gainPercent ?? null;
    label = rangeLabel(matched);
  }

  // Sem faixa explicita: interpolacao linear entre zero (0%) e meta (100%).
  if (achievementPercent === null && target !== null && zero !== null && target !== zero) {
    const pct = ((realized - zero) / (target - zero)) * 100;
    achievementPercent = Math.max(0, pct);
  }

  const onTarget = achievementPercent !== null ? achievementPercent >= 100 : null;

  return {
    hasActual: true,
    realized: round2(realized),
    target: round2(target),
    zero: round2(zero),
    deviation: round2(deviation),
    deviationPercent: round2(deviationPercent),
    achievementPercent: round2(achievementPercent),
    gainPercent: round2(gainPercent),
    rangeLabel: label,
    onTarget,
  };
}
