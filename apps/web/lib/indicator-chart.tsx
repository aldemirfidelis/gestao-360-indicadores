'use client';

// Cores, regra de faixa de ganho e legenda compartilhadas pelos gráficos de
// indicador (detalhe + lista), para as barras Meta / Meta Secundária /
// Realizado / Realizado na faixa de ganho / Realizado sem valor.

import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { Tag } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';

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

// ---------------------------------------------------------------------------
// Rótulos de dados: abreviação e anticolisão
// ---------------------------------------------------------------------------
// Com 3 séries por período (Meta / Meta Secundária / Realizado) a barra fica
// com poucos pixels de largura e os rótulos vizinhos se sobrepõem — pior ainda
// com valores na casa dos milhares. O plano abaixo mede o texto contra o espaço
// real de cada rótulo e degrada em etapas: completo → abreviado → girado 90° →
// corpo menor.

/** Como o usuário quer ver os rótulos de dados. `auto` = decide pelo espaço. */
export type ChartLabelMode = 'auto' | 'full' | 'compact' | 'hidden';

export const CHART_LABEL_MODES: ChartLabelMode[] = ['auto', 'full', 'compact', 'hidden'];

export const CHART_LABEL_MODE_LABEL: Record<ChartLabelMode, string> = {
  auto: 'Rótulo: automático',
  full: 'Rótulo: completo',
  compact: 'Rótulo: abreviado',
  hidden: 'Rótulo: oculto',
};

const compactFormatter = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1,
});

/** 30.000 → "30 mil"; 1.234.567 → "1,2 mi"; 94,38 → "94,4". */
export function formatCompactNumber(value: number) {
  return compactFormatter.format(value);
}

export function formatChartLabelValue(value: number, compact: boolean) {
  return compact ? formatCompactNumber(value) : formatNumber(value);
}

/** Eixo Y: abrevia sozinho quando a escala passa da casa dos milhares. */
export function chartAxisTickFormatter(value: number) {
  return Math.abs(value) >= 10000 ? formatCompactNumber(value) : formatNumber(value);
}

// Largura aproximada do texto em px. Dígitos ocupam ~0,58em na fonte da UI;
// separadores e espaço são bem mais estreitos. Evita medir no DOM a cada render.
function estimateTextWidth(text: string, fontSize: number) {
  let em = 0;
  for (const ch of text) {
    if (ch === ',' || ch === '.' || ch === ' ') em += 0.3;
    else if (ch === '1') em += 0.48;
    else em += 0.58;
  }
  return em * fontSize;
}

export interface ChartLabelPlan {
  hidden: boolean;
  compact: boolean;
  /** Rótulo girado -90° (vertical): a restrição passa a ser a altura, que sobra. */
  rotated: boolean;
  fontSize: number;
  /** Maior largura de texto do plano, em px (para reservar margem no topo). */
  textWidth: number;
}

const MIN_LABEL_FONT_SIZE = 7;

/**
 * Decide como desenhar os rótulos de uma série.
 *
 * `slotWidth` é o espaço horizontal (px) que cada rótulo tem antes de encostar
 * no vizinho — ver `barLabelSlotWidth` / `pointLabelSlotWidth`.
 */
export function planChartLabels({
  values,
  mode,
  fontSize,
  slotWidth,
}: {
  values: Array<number | null | undefined>;
  mode: ChartLabelMode;
  fontSize: number;
  slotWidth: number;
}): ChartLabelPlan {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const widest = (compact: boolean) =>
    nums.reduce((max, v) => Math.max(max, estimateTextWidth(formatChartLabelValue(v, compact), fontSize)), 0);

  if (mode === 'hidden' || !nums.length) {
    return { hidden: mode === 'hidden', compact: false, rotated: false, fontSize, textWidth: 0 };
  }
  // Sem largura medida ainda (primeiro render): não gira, só respeita a escolha.
  if (slotWidth <= 0) {
    const compact = mode === 'compact';
    return { hidden: false, compact, rotated: false, fontSize, textWidth: widest(compact) };
  }

  // `auto` abrevia só quando o número completo não cabe; os modos manuais
  // mandam no formato, mas ainda giram o texto em vez de deixar sobrepor.
  const compact = mode === 'compact' ? true : mode === 'full' ? false : widest(false) > slotWidth;
  const textWidth = widest(compact);
  const rotated = textWidth > slotWidth;
  const size = rotated && slotWidth < fontSize + 1
    ? Math.max(MIN_LABEL_FONT_SIZE, Math.floor(slotWidth))
    : fontSize;
  return { hidden: false, compact, rotated, fontSize: size, textWidth };
}

/** Espaço por rótulo num gráfico de barras agrupadas. */
export function barLabelSlotWidth({
  plotWidth,
  pointCount,
  seriesCount,
  barGap = 2,
}: {
  plotWidth: number;
  pointCount: number;
  seriesCount: number;
  barGap?: number;
}) {
  if (plotWidth <= 0 || pointCount <= 0 || seriesCount <= 0) return 0;
  // Recharts reserva ~10% da banda como respiro entre categorias.
  const band = (plotWidth / pointCount) * 0.9;
  return Math.max(0, band / seriesCount + barGap);
}

/** Espaço por rótulo num gráfico de linhas (a colisão é entre pontos vizinhos). */
export function pointLabelSlotWidth({ plotWidth, pointCount }: { plotWidth: number; pointCount: number }) {
  if (plotWidth <= 0 || pointCount <= 0) return 0;
  return (plotWidth / pointCount) * 0.95;
}

/** Largura útil do plot = container − eixo Y − margens laterais − padding. */
export function plotWidthFrom(containerWidth: number, { axisWidth = 48, sideMargins = 28 } = {}) {
  return Math.max(0, containerWidth - axisWidth - sideMargins);
}

/** Margem superior necessária para o rótulo mais alto não ser cortado. */
export function chartLabelTopMargin(plan: ChartLabelPlan, base = 40) {
  if (plan.hidden) return base;
  if (!plan.rotated) return Math.max(base, plan.fontSize * 2);
  return Math.max(base, Math.round(plan.textWidth + plan.fontSize + 8));
}

/**
 * Rótulo de valor (barra ou ponto de linha) desenhado conforme o plano.
 * Use como `content` do `<LabelList>` para que o giro/abreviação valham também
 * nas linhas, onde o `formatter` nativo não permite transformar o `<text>`.
 */
export function renderChartValueLabel(
  props: any,
  {
    fill,
    plan,
    placement = 'top',
  }: { fill: string; plan: ChartLabelPlan; placement?: 'top' | 'bottom' },
) {
  const { x, y, width = 0, value } = props;
  if (plan.hidden) return null;
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return null;

  const text = formatChartLabelValue(Number(value), plan.compact);
  const cx = x + width / 2;
  // Afasta o rótulo do corpo proporcionalmente à fonte: 6px fixos deixavam o
  // número encostado no topo da barra quando o corpo é grande (apresentação).
  const gap = Math.max(6, Math.round(plan.fontSize * 0.7));
  const cy = placement === 'bottom' ? y + gap + plan.fontSize : y - gap;

  if (plan.rotated) {
    return (
      <text
        x={cx}
        y={cy}
        fill={fill}
        fontSize={plan.fontSize}
        fontWeight={600}
        textAnchor={placement === 'bottom' ? 'end' : 'start'}
        dominantBaseline="central"
        transform={`rotate(-90, ${cx}, ${cy})`}
      >
        {text}
      </text>
    );
  }

  return (
    <text x={cx} y={cy} fill={fill} textAnchor="middle" fontSize={plan.fontSize} fontWeight={600}>
      {text}
    </text>
  );
}

const LABEL_MODE_STORAGE_KEY = 'g360:indicator-chart-label-mode';

/** Preferência de rótulo do usuário, compartilhada por todos os gráficos de indicador. */
export function useChartLabelMode() {
  const [mode, setMode] = useState<ChartLabelMode>('auto');

  useEffect(() => {
    const saved = window.localStorage.getItem(LABEL_MODE_STORAGE_KEY) as ChartLabelMode | null;
    if (saved && CHART_LABEL_MODES.includes(saved)) setMode(saved);
  }, []);

  const update = useCallback((next: ChartLabelMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(LABEL_MODE_STORAGE_KEY, next);
    } catch {
      // Modo privativo/quota cheia: a escolha vale só nesta sessão.
    }
  }, []);

  return [mode, update] as const;
}

/** Mede a largura do container do gráfico para planejar os rótulos. */
export function useChartWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

/** Botão que alterna o modo do rótulo (automático → completo → abreviado → oculto). */
export function ChartLabelModeButton({
  mode,
  onChange,
  className,
}: {
  mode: ChartLabelMode;
  onChange: (mode: ChartLabelMode) => void;
  className?: string;
}) {
  const next = CHART_LABEL_MODES[(CHART_LABEL_MODES.indexOf(mode) + 1) % CHART_LABEL_MODES.length];
  const short: Record<ChartLabelMode, string> = {
    auto: 'Auto',
    full: 'Completo',
    compact: 'Abreviado',
    hidden: 'Oculto',
  };
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange(next);
      }}
      title={`${CHART_LABEL_MODE_LABEL[mode]} — clique para ${CHART_LABEL_MODE_LABEL[next].toLowerCase()}`}
      aria-label={CHART_LABEL_MODE_LABEL[mode]}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border bg-card/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
        className,
      )}
    >
      <Tag className="h-3.5 w-3.5" />
      {short[mode]}
    </button>
  );
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
