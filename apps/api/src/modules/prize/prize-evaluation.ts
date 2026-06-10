/**
 * Avaliacao Previsto x Realizado (pura, sem banco — testavel isoladamente).
 * Dado o realizado, o parametro vigente (meta/zero) e as faixas do indicador,
 * calcula desvio, percentual de atingimento, faixa alcancada e percentual de
 * ganho. O impacto financeiro no premio e responsabilidade do motor de calculo;
 * aqui produzimos apenas a leitura de desempenho.
 *
 * Semantica das faixas CALIBRADA pelas planilhas oficiais (Bases_calculo —
 * modulos VBA FaixaAtingida/modRealizadosFaixas):
 *  - limites INCLUSIVOS nos dois extremos (realizado >= min E <= max);
 *  - faixas sao DEGRAUS discretos (sem interpolacao entre faixas);
 *  - EXTRAPOLACAO por sentido do indicador: realizado acima de todas as faixas
 *    atinge a faixa TOPO quando "quanto maior, melhor" (e a faixa ZERO quando
 *    "quanto menor, melhor"); abaixo de todas, o inverso;
 *  - interpolacao linear zero->meta APENAS quando o indicador nao tem faixas.
 */
export type EvalDirection = 'HIGHER_BETTER' | 'LOWER_BETTER' | 'TARGET';

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

/**
 * Seleciona as faixas aplicaveis a um parametro (competencia/mes). Indicadores
 * cujas metas/faixas MUDAM por mes (ex.: "Chamado Problema" do anexo 0561) tem
 * faixas vinculadas ao parametro vigente (parameterId). Regra:
 *  - se ha faixas vinculadas ao parametro ativo, usa SO essas;
 *  - senao, usa as faixas globais (parameterId nulo) — modelo de indicador fixo;
 *  - fallback: todas (compatibilidade com dados sem parameterId).
 * 100% compativel com indicadores de faixa unica (sem parameterId).
 */
export function selectRangesForParameter<T extends { parameterId?: string | null }>(
  ranges: T[],
  parameterId: string | null | undefined,
): T[] {
  if (parameterId) {
    const scoped = ranges.filter((r) => r.parameterId === parameterId);
    if (scoped.length) return scoped;
  }
  const globals = ranges.filter((r) => !r.parameterId);
  return globals.length ? globals : ranges;
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
  direction: EvalDirection = 'HIGHER_BETTER',
): EvalResult {
  const target = param?.target ?? null;
  const zero = param?.zero ?? null;

  if (realized === null || realized === undefined) {
    return { hasActual: false, realized: null, target, zero, deviation: null, deviationPercent: null, achievementPercent: null, gainPercent: null, rangeLabel: null, onTarget: null };
  }

  const deviation = target !== null ? realized - target : null;
  const deviationPercent = target !== null && target !== 0 ? (realized - target) / Math.abs(target) * 100 : null;

  // Faixa: primeira (por orderIndex) cujos limites contem o realizado (inclusivo).
  const sorted = [...ranges].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  let matched = sorted.find(
    (r) =>
      (r.minLimit === null || r.minLimit === undefined || realized >= r.minLimit) &&
      (r.maxLimit === null || r.maxLimit === undefined || realized <= r.maxLimit),
  );

  // Extrapolacao (regra das planilhas): fora de todas as faixas, o realizado
  // cai na faixa TOPO ou na faixa ZERO conforme o sentido do indicador.
  if (!matched && sorted.length > 0 && direction !== 'TARGET') {
    const zeroRange = sorted[0];
    const topRange = sorted[sorted.length - 1];
    const mins = sorted.map((r) => r.minLimit).filter((v): v is number => v !== null && v !== undefined);
    const maxs = sorted.map((r) => r.maxLimit).filter((v): v is number => v !== null && v !== undefined);
    const globalMin = mins.length ? Math.min(...mins) : null;
    const globalMax = maxs.length ? Math.max(...maxs) : null;
    const aboveAll = globalMax !== null && realized > globalMax;
    const belowAll = globalMin !== null && realized < globalMin;
    if (direction === 'HIGHER_BETTER') {
      if (aboveAll) matched = topRange;
      else if (belowAll) matched = zeroRange;
    } else {
      // LOWER_BETTER: extrapolar para baixo e MELHOR (topo); para cima e pior (zero).
      if (belowAll) matched = topRange;
      else if (aboveAll) matched = zeroRange;
    }
  }

  let achievementPercent: number | null = null;
  let gainPercent: number | null = null;
  let label: string | null = null;

  if (matched) {
    achievementPercent = matched.achievementPercent ?? matched.gainPercent ?? null;
    gainPercent = matched.gainPercent ?? null;
    label = rangeLabel(matched);
  }

  // Interpolacao linear zero->meta SOMENTE quando o indicador nao tem faixas
  // (com faixas, o modelo e degrau — planilha oficial nao interpola).
  if (ranges.length === 0 && achievementPercent === null && target !== null && zero !== null && target !== zero) {
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
