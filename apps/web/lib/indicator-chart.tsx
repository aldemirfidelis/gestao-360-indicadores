// Cores, regra de faixa de ganho e legenda compartilhadas pelos gráficos de
// indicador (detalhe + lista), para as barras Meta / Meta Secundária /
// Realizado / Realizado na faixa de ganho / Realizado sem valor.

export const CHART_COLORS = {
  meta: '#1e3a8a',
  secondary: '#6366f1',
  realizadoIn: '#10b981',
  realizadoOut: '#ef4444',
  gain: '#14b8a6',
  noValue: '#facc15',
};

// Realizado dentro da faixa de ganho [gainLower, gainUpper] (quando ambos definidos).
export function isWithinGain(
  value: number | null | undefined,
  lower: number | null | undefined,
  upper: number | null | undefined,
) {
  if (value === null || value === undefined) return false;
  if (lower === null || lower === undefined || upper === null || upper === undefined) return false;
  const lo = Math.min(lower, upper);
  const hi = Math.max(lower, upper);
  return value >= lo && value <= hi;
}

// Cor da barra Realizado por período: faixa de ganho tem prioridade; depois
// verde/vermelho conforme atingimento da meta; cinza quando não há realizado.
export function realizadoBarColor(
  realizado: number | null | undefined,
  meta: number | null | undefined,
  gainLower: number | null | undefined,
  gainUpper: number | null | undefined,
  direction: string,
) {
  if (realizado === null || realizado === undefined) return 'hsl(var(--status-gray))';
  if (isWithinGain(realizado, gainLower, gainUpper)) return CHART_COLORS.gain;
  const within = direction === 'LOWER_BETTER' ? realizado <= (meta ?? 0) : realizado >= (meta ?? 0);
  return within ? CHART_COLORS.realizadoIn : CHART_COLORS.realizadoOut;
}

// Altura da mini-barra amarela de "sem valor": ~3% do maior valor plotado.
export function computeStubValue(values: Array<number | null | undefined>) {
  const nums = values.filter((v): v is number => v !== null && v !== undefined);
  const max = nums.length ? Math.max(...nums) : 0;
  return max > 0 ? max * 0.03 : 1;
}

// Legenda das séries. Itens condicionais só aparecem quando a barra/cor foi de
// fato lançada ou aplicada em algum período.
export function ChartLegend({
  hasSecondary,
  hasGainHit,
  hasNoValue,
}: {
  hasSecondary: boolean;
  hasGainHit: boolean;
  hasNoValue: boolean;
}) {
  const items: { color: string; label: string }[] = [
    { color: CHART_COLORS.meta, label: 'Meta' },
    ...(hasSecondary ? [{ color: CHART_COLORS.secondary, label: 'Meta Secundária' }] : []),
    { color: CHART_COLORS.realizadoIn, label: 'Realizado na meta' },
    { color: CHART_COLORS.realizadoOut, label: 'Realizado fora da meta' },
    ...(hasGainHit ? [{ color: CHART_COLORS.gain, label: 'Realizado na Faixa de Ganho' }] : []),
    ...(hasNoValue ? [{ color: CHART_COLORS.noValue, label: 'Realizado sem valor' }] : []),
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
