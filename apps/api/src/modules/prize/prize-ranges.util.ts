/**
 * Gerador de faixas (PURO) — replica da "Ferramenta de Criação de Faixas por
 * Cargo e Área" (VBA SugerirFaixas/GerarFaixasOficial das Bases_calculo):
 *  - distribuicao LINEAR entre zero e meta em N faixas (N inclui a faixa 0);
 *  - faixa 0 paga 0% (abaixo do zero p/ "maior melhor"; acima p/ "menor melhor");
 *  - %pago linear: faixa f paga f/(N−1) (20%, 40%, ... 100% p/ N=6);
 *  - degraus separados por 1 unidade da precisao (gap = 10^-decimais);
 *  - limites INCLUSIVOS, casando com a avaliacao (prize-evaluation).
 */

export type RangeDirection = 'HIGHER_BETTER' | 'LOWER_BETTER';

export interface SuggestedRange {
  orderIndex: number;
  minLimit: number | null;
  maxLimit: number | null;
  achievementPercent: number;
  gainPercent: number;
}

export interface SuggestRangesInput {
  zero: number;
  target: number;
  direction: RangeDirection;
  count: number; // total de faixas INCLUINDO a faixa 0 (planilha: 2..6)
  decimals?: number; // precisao dos limites (default 2)
}

export const SUGGEST_COUNT_MIN = 2;
export const SUGGEST_COUNT_MAX = 6;

function round(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

export function suggestRanges(input: SuggestRangesInput): SuggestedRange[] {
  const { zero, target, direction } = input;
  const decimals = input.decimals ?? 2;
  const count = input.count;

  if (!Number.isInteger(count) || count < SUGGEST_COUNT_MIN || count > SUGGEST_COUNT_MAX) {
    throw new Error(`Quantidade de faixas deve ser inteira entre ${SUGGEST_COUNT_MIN} e ${SUGGEST_COUNT_MAX}`);
  }
  if (!Number.isFinite(zero) || !Number.isFinite(target)) throw new Error('Zero e Meta são obrigatórios');
  if (direction === 'HIGHER_BETTER' && target <= zero) throw new Error('Para "quanto maior, melhor", a Meta deve ser maior que o Zero');
  if (direction === 'LOWER_BETTER' && target >= zero) throw new Error('Para "quanto menor, melhor", a Meta deve ser menor que o Zero');

  const gap = 10 ** -decimals;
  const steps = count - 1; // faixas pagantes
  const pct = (f: number) => round((f / steps) * 100, 4);
  const out: SuggestedRange[] = [];

  if (direction === 'HIGHER_BETTER') {
    const passo = (target - zero) / steps;
    // Faixa 0: [0, zero] -> 0%
    out.push({ orderIndex: 0, minLimit: 0, maxLimit: round(zero, decimals), achievementPercent: 0, gainPercent: 0 });
    for (let f = 1; f <= steps; f++) {
      const min = f === 1 ? round(zero + gap, decimals) : round((out[f - 1].maxLimit as number) + gap, decimals);
      const max = f === steps ? round(target, decimals) : round(min + passo - gap, decimals);
      if (min > max) throw new Error('Diferença entre Zero e Meta insuficiente para a quantidade de faixas/precisão');
      out.push({ orderIndex: f, minLimit: min, maxLimit: max, achievementPercent: pct(f), gainPercent: pct(f) });
    }
    return out;
  }

  // LOWER_BETTER (zero > meta): faixa 0 = [zero, +∞) -> 0%; topo = [meta, ...].
  const passo = (zero - target) / steps;
  const byIndex: SuggestedRange[] = new Array(count);
  byIndex[0] = { orderIndex: 0, minLimit: round(zero, decimals), maxLimit: null, achievementPercent: 0, gainPercent: 0 };
  for (let f = steps; f >= 1; f--) {
    const min = f === steps ? round(target, decimals) : round((byIndex[f + 1].maxLimit as number) + gap, decimals);
    const max = f === 1 ? round(zero - gap, decimals) : round(min + passo - gap, decimals);
    if (min > max) throw new Error('Diferença entre Zero e Meta insuficiente para a quantidade de faixas/precisão');
    byIndex[f] = { orderIndex: f, minLimit: min, maxLimit: max, achievementPercent: pct(f), gainPercent: pct(f) };
  }
  return byIndex;
}
