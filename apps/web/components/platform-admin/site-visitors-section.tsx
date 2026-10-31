'use client';

import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Info } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Input } from '@/components/ui/input';
import { platformAdminApi } from '@/lib/platform-admin-api';
import { setTrackingDisabled, trackingDisabled } from '@/lib/site-analytics';
import {
  type BreakdownRow,
  clickLabel,
  countryName,
  DEMO_AREA_LABEL,
  DEMO_DEPTH_BUCKETS,
  DEMO_SOURCE_LABEL,
  DEMO_TIME_BUCKETS,
  demoPageLabel,
  DEVICE_LABEL,
  fmtDay,
  fmtDuration,
  fmtNumber,
  fmtPct,
  pctOf,
  SCROLL_BUCKETS,
  SECTION_LABEL,
  type SiteOverview,
  sitePageLabel,
  SOURCE_LABEL,
  stateName,
  TIME_BUCKETS,
} from '@/lib/site-visits';
import { cn } from '@/lib/utils';
import { NO_VISIT_FILTERS, SiteVisitsList, type VisitFilters } from './site-visits-list';

// Cores dos gráficos (paleta de referência validada para a superfície branca dos painéis do portal,
// que só tem tema claro): séries do gráfico diário, rampa ordinal das etapas e rampa sequencial do mapa.
const VIZ = {
  surface: '#ffffff',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  muted: '#898781',
  track: '#cde2fb',
  series: ['#2a78d6', '#eb6834', '#1baf7a'],
  ordinal: ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'],
  sequential: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'],
  empty: '#f0efec',
};

/** n passos da rampa ordinal, do mais claro ao mais escuro, sempre espaçados. */
function ordinalSteps(n: number) {
  if (n <= 1) return [VIZ.ordinal[2]];
  return Array.from({ length: n }, (_, i) => VIZ.ordinal[Math.round((i * (VIZ.ordinal.length - 1)) / (n - 1))]);
}

type RangeKey = 'today' | '7' | '30' | '90' | 'custom';
const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: '7', label: '7 dias' },
  { key: '30', label: '30 dias' },
  { key: '90', label: '90 dias' },
  { key: 'custom', label: 'Período' },
];

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
const toDateInput = (date: Date) => dayFormat.format(date);
/** Soma dias a uma data AAAA-MM-DD (horário de Brasília). */
const shiftDay = (day: string, delta: number) => toDateInput(new Date(new Date(`${day}T12:00:00-03:00`).getTime() + delta * 86_400_000));

/** Do início do 1º dia ao fim do último, em Brasília: estável durante o dia (a consulta não muda a cada render). */
function rangeOf(key: RangeKey, custom: { from: string; to: string }) {
  const today = toDateInput(new Date());
  let [first, last] = key === 'custom' ? [custom.from || today, custom.to || today] : [key === 'today' ? today : shiftDay(today, -(Number(key) - 1)), today];
  if (first > last) [first, last] = [last, first];
  return { from: new Date(`${first}T00:00:00-03:00`).toISOString(), to: new Date(`${shiftDay(last, 1)}T00:00:00-03:00`).toISOString() };
}

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
/** Setas no mapa de horários: [dias, horas]. */
const HEATMAP_MOVES: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };

function Card({ title, subtitle, actions, children, className }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('border bg-white', className)}>
      <div className="flex min-h-12 items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="border bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 text-xs font-medium text-cyan-700 hover:underline">
      {children}
    </button>
  );
}

function Empty({ children = 'Sem dados no período.' }: { children?: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** Lista com barra fina: rótulo, número e participação no total. Faixas ordenadas usam a rampa ordinal. */
function BarList({ rows, total, ordinal = false, empty }: { rows: { key: string; label: ReactNode; value: number }[]; total: number; ordinal?: boolean; empty?: string }) {
  if (!rows.some((r) => r.value > 0)) return <Empty>{empty}</Empty>;
  const colors = ordinal ? ordinalSteps(rows.length) : null;
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums">
              <strong>{fmtNumber(r.value)}</strong> <span className="text-xs text-muted-foreground">· {fmtPct(pctOf(r.value, total))}</span>
            </span>
          </div>
          <div className="h-2 w-full" style={{ background: VIZ.track }} aria-hidden>
            <div className="h-2 rounded-r-[4px]" style={{ width: `${Math.min(100, pctOf(r.value, total))}%`, background: colors ? colors[i] : VIZ.series[0] }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Funnel({ t }: { t: SiteOverview['totals'] }) {
  const steps = [
    { label: 'Entraram no site', value: t.visits },
    { label: 'Se interessaram (2+ páginas, metade da página inicial ou 30 s)', value: t.engaged },
    { label: 'Clicaram em "Acesse a Demonstração"', value: t.demoClicked },
    { label: 'Entraram na demonstração', value: t.demoStarted },
    { label: 'Navegaram na demonstração (2+ páginas)', value: t.demoNavigated },
  ];
  return (
    <ol className="space-y-3.5">
      {steps.map((s, i) => {
        const lost = i > 0 ? steps[i - 1].value - s.value : 0;
        return (
          <li key={s.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0">{s.label}</span>
              <span className="shrink-0 tabular-nums">
                <strong>{fmtNumber(s.value)}</strong> <span className="text-xs text-muted-foreground">· {fmtPct(pctOf(s.value, t.visits))}</span>
              </span>
            </div>
            <div className="h-2.5 w-full" style={{ background: VIZ.track }} aria-hidden>
              <div className="h-2.5 rounded-r-[4px]" style={{ width: `${pctOf(s.value, t.visits)}%`, background: VIZ.ordinal[i] }} />
            </div>
            {lost > 0 && <p className="mt-0.5 text-xs text-muted-foreground">{fmtNumber(lost)} pararam aqui ({fmtPct(pctOf(lost, steps[i - 1].value))} da etapa anterior)</p>}
          </li>
        );
      })}
    </ol>
  );
}

const DAILY_SERIES = [
  { key: 'visitors', label: 'Visitantes únicos', color: VIZ.series[0] },
  { key: 'demo', label: 'Entraram na demo', color: VIZ.series[1] },
  { key: 'contacts', label: 'Contatos', color: VIZ.series[2] },
] as const;

function LineKey({ color }: { color: string }) {
  return <span className="inline-block h-0.5 w-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden />;
}

function DailyTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey?: string | number; value?: number | string }[]; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="border bg-white px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 text-muted-foreground">{fmtDay(label)}</div>
      {DAILY_SERIES.map((s) => (
        <div key={s.key} className="flex items-center gap-2">
          <LineKey color={s.color} />
          <strong className="tabular-nums">{fmtNumber(Number(payload.find((p) => p.dataKey === s.key)?.value ?? 0))}</strong>
          <span className="text-muted-foreground">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function DailyChart({ rows }: { rows: SiteOverview['daily'] }) {
  const [table, setTable] = useState(false);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-label="Legenda">
          {DAILY_SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <LineKey color={s.color} />
              {s.label}
            </li>
          ))}
        </ul>
        <LinkButton onClick={() => setTable((v) => !v)}>{table ? 'Ver gráfico' : 'Ver tabela'}</LinkButton>
      </div>
      {table ? (
        <div className="max-h-72 overflow-auto border">
          <table className="table-modern tabular-nums">
            <thead>
              <tr>
                <th>Dia</th>
                <th className="text-right">Visitas</th>
                <th className="text-right">Visitantes únicos</th>
                <th className="text-right">Entraram na demo</th>
                <th className="text-right">Contatos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.day}>
                  <td>{fmtDay(r.day)}</td>
                  <td className="text-right">{fmtNumber(r.visits)}</td>
                  <td className="text-right">{fmtNumber(r.visitors)}</td>
                  <td className="text-right">{fmtNumber(r.demo)}</td>
                  <td className="text-right">{fmtNumber(r.contacts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-64" role="img" aria-label="Visitantes únicos, entradas na demonstração e contatos por dia">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={VIZ.grid} />
              <XAxis dataKey="day" tickFormatter={fmtDay} tick={{ fontSize: 11, fill: VIZ.muted }} tickLine={false} axisLine={{ stroke: VIZ.axis }} minTickGap={24} />
              <YAxis allowDecimals={false} width={36} tick={{ fontSize: 11, fill: VIZ.muted }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ stroke: VIZ.axis, strokeWidth: 1 }} content={<DailyTooltip />} isAnimationActive={false} />
              {DAILY_SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  dot={rows.length === 1 ? { r: 4, fill: s.color, stroke: VIZ.surface, strokeWidth: 2 } : false}
                  activeDot={{ r: 4, fill: s.color, stroke: VIZ.surface, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/** Dias da semana × horas (Brasília): quanto mais escuro, mais visitas. Setas do teclado percorrem as células. */
function Heatmap({ cells }: { cells: SiteOverview['heatmap'] }) {
  const [table, setTable] = useState(false);
  const [cursor, setCursor] = useState({ dow: 1, hour: 9 });
  const [tip, setTip] = useState<{ dow: number; hour: number; x: number; y: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const value = useMemo(() => {
    const map = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.visits]));
    return (dow: number, hour: number) => map.get(`${dow}-${hour}`) ?? 0;
  }, [cells]);
  const max = Math.max(1, ...cells.map((c) => c.visits));
  const color = (v: number) => (v <= 0 ? VIZ.empty : VIZ.sequential[Math.min(VIZ.sequential.length - 1, Math.floor((v / max) * VIZ.sequential.length))]);
  const byHour = Array.from({ length: 24 }, (_, h) => cells.filter((c) => c.hour === h).reduce((a, c) => a + c.visits, 0));
  const byDay = Array.from({ length: 7 }, (_, d) => cells.filter((c) => c.dow === d + 1).reduce((a, c) => a + c.visits, 0));
  const peak = cells.reduce<SiteOverview['heatmap'][number] | null>((a, c) => (!a || c.visits > a.visits ? c : a), null);

  const show = (dow: number, hour: number, el: HTMLElement) => {
    const box = boxRef.current?.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    if (box) setTip({ dow, hour, x: rect.left - box.left + rect.width / 2, y: rect.top - box.top });
  };
  const move = (event: KeyboardEvent<HTMLDivElement>, dow: number, hour: number) => {
    const delta = HEATMAP_MOVES[event.key];
    if (!delta) return;
    event.preventDefault();
    const next = { dow: Math.min(7, Math.max(1, dow + delta[0])), hour: Math.min(23, Math.max(0, hour + delta[1])) };
    setCursor(next);
    boxRef.current?.querySelector<HTMLElement>(`[data-cell="${next.dow}-${next.hour}"]`)?.focus();
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        {peak && peak.visits > 0 ? (
          <p>
            Pico: <strong className="text-foreground">{WEEKDAYS[peak.dow - 1]}, {peak.hour}h</strong> · dia mais forte:{' '}
            <strong className="text-foreground">{WEEKDAYS[byDay.indexOf(Math.max(...byDay))]}</strong> · hora mais forte:{' '}
            <strong className="text-foreground">{byHour.indexOf(Math.max(...byHour))}h</strong>
          </p>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs" aria-label="Escala: quanto mais escuro, mais visitas">
            <span>Menos</span>
            {[VIZ.empty, ...VIZ.sequential].map((c) => (
              <span key={c} className="h-3 w-3" style={{ background: c }} aria-hidden />
            ))}
            <span>Mais ({fmtNumber(max)})</span>
          </div>
          <LinkButton onClick={() => setTable((v) => !v)}>{table ? 'Ver mapa' : 'Ver tabela'}</LinkButton>
        </div>
      </div>
      {table ? (
        <div className="overflow-x-auto border">
          <table className="table-modern tabular-nums text-xs">
            <thead>
              <tr>
                <th>Dia</th>
                {Array.from({ length: 24 }, (_, h) => (
                  <th key={h} className="px-1.5 text-right">{h}h</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((d, i) => (
                <tr key={d}>
                  <td className="font-medium">{d}</td>
                  {Array.from({ length: 24 }, (_, h) => (
                    <td key={h} className="px-1.5 text-right">{value(i + 1, h) || ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div ref={boxRef} className="relative min-w-[640px]" role="grid" aria-label="Visitas por dia da semana e hora" onMouseLeave={() => setTip(null)}>
            <div className="grid gap-[2px] text-[10px] text-muted-foreground" style={{ gridTemplateColumns: '2.25rem repeat(24, minmax(0, 1fr))' }} role="row">
              <span />
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="text-center" role="columnheader">{h % 3 === 0 ? `${h}h` : ''}</span>
              ))}
            </div>
            {WEEKDAYS.map((d, i) => (
              <div key={d} className="mt-[2px] grid gap-[2px]" style={{ gridTemplateColumns: '2.25rem repeat(24, minmax(0, 1fr))' }} role="row">
                <span className="self-center text-[10px] text-muted-foreground" role="rowheader">{d}</span>
                {Array.from({ length: 24 }, (_, h) => {
                  const v = value(i + 1, h);
                  const dow = i + 1;
                  return (
                    <div
                      key={h}
                      role="gridcell"
                      data-cell={`${dow}-${h}`}
                      tabIndex={cursor.dow === dow && cursor.hour === h ? 0 : -1}
                      aria-label={`${d}, ${h}h: ${fmtNumber(v)} visita(s)`}
                      className="h-6 rounded-[2px] outline-none ring-[#101820] focus-visible:ring-2 hover:opacity-80"
                      style={{ background: color(v) }}
                      onMouseEnter={(e) => show(dow, h, e.currentTarget)}
                      onFocus={(e) => {
                        setCursor({ dow, hour: h });
                        show(dow, h, e.currentTarget);
                      }}
                      onBlur={() => setTip(null)}
                      onKeyDown={(e) => move(e, dow, h)}
                    />
                  );
                })}
              </div>
            ))}
            {tip && (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap border bg-white px-2 py-1 text-xs shadow-sm"
                style={{ left: tip.x, top: tip.y - 4 }}
                role="status"
              >
                <strong className="tabular-nums">{fmtNumber(value(tip.dow, tip.hour))}</strong>{' '}
                <span className="text-muted-foreground">
                  visita(s) · {WEEKDAYS[tip.dow - 1]}, {tip.hour}h
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Quadro "por origem / estado / aparelho...": visitas, quantas entraram na demo e quantas chamaram a equipe. */
function BreakdownCard({ title, subtitle, rows, format, onSelect, empty }: { title: string; subtitle?: string; rows: BreakdownRow[]; format: (r: BreakdownRow) => ReactNode; onSelect?: (r: BreakdownRow) => void; empty?: string }) {
  return (
    <section className="border bg-white">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {!rows.length ? (
        <p className="p-4 text-sm text-muted-foreground">{empty ?? 'Sem dados no período.'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-modern tabular-nums">
            <thead>
              <tr>
                <th>{title}</th>
                <th className="text-right">Visitas</th>
                <th className="text-right">Na demo</th>
                <th className="text-right">Contatos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.label}-${r.sub}-${i}`}>
                  <td className="max-w-[15rem]">
                    {onSelect && r.label ? (
                      <button type="button" onClick={() => onSelect(r)} className="block max-w-full truncate text-left hover:text-cyan-700 hover:underline" title="Ver estas visitas na lista">
                        {format(r)}
                      </button>
                    ) : (
                      <span className="block truncate">{format(r)}</span>
                    )}
                  </td>
                  <td className="text-right">{fmtNumber(r.visits)}</td>
                  <td className="text-right">
                    {fmtNumber(r.demo)} <span className="text-xs text-muted-foreground">({fmtPct(pctOf(r.demo, r.visits))})</span>
                  </td>
                  <td className="text-right">{fmtNumber(r.contacts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function SiteVisitorsSection() {
  const today = toDateInput(new Date());
  const [range, setRange] = useState<RangeKey>('30');
  const [custom, setCustom] = useState({ from: shiftDay(today, -29), to: today });
  const [filters, setFilters] = useState<VisitFilters>(NO_VISIT_FILTERS);
  const [optOut, setOptOut] = useState(trackingDisabled);
  const listRef = useRef<HTMLDivElement>(null);
  const period = useMemo(() => rangeOf(range, custom), [range, custom]);
  const overview = useQuery({
    queryKey: ['platform-admin', 'site-analytics', 'overview', period.from, period.to],
    queryFn: () => platformAdminApi<SiteOverview>(`/site-analytics/overview?${new URLSearchParams(period)}`),
    refetchInterval: 60_000,
    placeholderData: (previous) => previous,
  });
  const showVisits = (patch: Partial<VisitFilters>) => {
    setFilters({ ...NO_VISIT_FILTERS, ...patch });
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const d = overview.data;
  const t = d?.totals;
  const days = d?.daily.length || 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Visitantes do site e da demonstração</h1>
          <p className="text-sm text-muted-foreground">Quem entra no site, de onde vem, de qual cidade, se abre a demonstração, por onde navega nela e se chama a equipe.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {d && <span className={cn('pill', d.liveNow ? 'pill-green' : 'pill-gray')}>{fmtNumber(d.liveNow)} no site agora</span>}
          <div className="flex border bg-white p-0.5 text-xs" role="group" aria-label="Período">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                aria-pressed={range === r.key}
                className={cn('px-2.5 py-1.5 font-medium', range === r.key ? 'bg-[#101820] text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
              >
                {r.label}
              </button>
            ))}
          </div>
          {range === 'custom' && (
            <div className="flex items-center gap-2">
              <Input type="date" aria-label="De" className="h-9 w-40" value={custom.from} max={today} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              <Input type="date" aria-label="Até" className="h-9 w-40" value={custom.to} max={today} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </div>
          )}
        </div>
      </div>

      {overview.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse border bg-white" />
          ))}
        </div>
      ) : overview.isError || !d || !t ? (
        <div className="grid min-h-24 place-items-center border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {overview.error instanceof Error ? overview.error.message : 'Não foi possível carregar os visitantes.'}
          </div>
        </div>
      ) : (
        <div className={cn('space-y-5 transition-opacity', overview.isFetching && overview.isPlaceholderData && 'opacity-60')}>
          {t.visits === 0 && (
            <div className="flex items-start gap-2 border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                <strong>Nenhuma visita no período.</strong> A contagem começa quando esta versão do site está no ar. Quem está logado no Gestão 360 ou no Portal Admin e os robôs não entram nos números.
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <StatTile label="Visitantes únicos" value={fmtNumber(t.visitors)} hint={`${fmtNumber(t.newVisitors)} novos · ${fmtNumber(t.returningVisitors)} voltaram`} />
            <StatTile label="Visitas" value={fmtNumber(t.visits)} hint={`média de ${fmtNumber(Math.round(t.visits / days))} por dia · ${fmtDuration(t.avgActiveMs)} em média`} />
            <StatTile label="Clicaram na demonstração" value={fmtPct(pctOf(t.demoClicked, t.visits))} hint={`${fmtNumber(t.demoClicked)} visitas`} />
            <StatTile
              label="Entraram na demonstração"
              value={fmtNumber(t.demoStarted)}
              hint={t.demoFailed > 0 ? `${fmtPct(pctOf(t.demoStarted, t.visits))} das visitas · ${fmtNumber(t.demoFailed)} não conseguiram abrir` : `${fmtPct(pctOf(t.demoStarted, t.visits))} das visitas`}
            />
            <StatTile label="Navegaram na demonstração" value={fmtNumber(t.demoNavigated)} hint={`média de ${String(t.avgDemoPages).replace('.', ',')} páginas · ${fmtDuration(t.avgDemoMs)} na demo`} />
            <StatTile label="Entraram em contato" value={fmtNumber(t.contacted)} hint={`${fmtNumber(t.whatsapp)} WhatsApp · ${fmtNumber(t.forms)} formulário · ${fmtNumber(t.contactedAfterDemo)} depois da demo`} />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2" title="Visitas por dia" subtitle={`${fmtNumber(t.visits)} visitas de ${fmtNumber(t.visitors)} visitantes no período (horário de Brasília)`}>
              {t.visits === 0 ? <Empty /> : <DailyChart rows={d.daily} />}
            </Card>
            <Card title="Do acesso à demonstração" subtitle="Cada etapa conta quem chegou até ela">
              <Funnel t={t} />
            </Card>
          </div>

          {t.visits > 0 && (
            <>
              <Card
                title="Na demonstração"
                subtitle={`${fmtNumber(t.demoStarted)} visitas entraram na Empresa Demonstração · tempo médio ${fmtDuration(t.avgDemoMs)} (mediana ${fmtDuration(t.medianDemoMs)})`}
                actions={t.demoStarted > 0 ? <LinkButton onClick={() => showVisits({ status: 'demo_navigated' })}>Ver quem navegou</LinkButton> : undefined}
              >
                {t.demoStarted === 0 && !d.demo.sources.length ? (
                  <Empty>Ninguém entrou na demonstração no período.</Empty>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <h3 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Áreas abertas</h3>
                      <BarList total={t.demoStarted} rows={d.demo.areas.map((a) => ({ key: a.area, label: DEMO_AREA_LABEL[a.area] ?? a.area, value: a.visits }))} />
                    </div>
                    <div>
                      <h3 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Páginas mais abertas</h3>
                      <BarList total={t.demoStarted} rows={d.demo.pages.slice(0, 10).map((p) => ({ key: p.path, label: demoPageLabel(p.path), value: p.visits }))} />
                    </div>
                    <div className="space-y-6">
                      <div>
                        <h3 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Páginas por visita</h3>
                        <BarList ordinal total={t.demoStarted} rows={d.demo.depth.map((r) => ({ key: String(r.bucket), label: DEMO_DEPTH_BUCKETS[r.bucket] ?? r.bucket, value: r.visits }))} />
                      </div>
                      <div>
                        <h3 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Tempo na demonstração</h3>
                        <BarList ordinal total={t.demoStarted} rows={d.demo.time.map((r) => ({ key: String(r.bucket), label: DEMO_TIME_BUCKETS[r.bucket] ?? r.bucket, value: r.visits }))} />
                      </div>
                    </div>
                    <div>
                      <h3 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Botões que levaram à demo</h3>
                      <BarList
                        total={d.demo.sources.reduce((a, s) => a + s.clicks, 0)}
                        empty="Nenhum clique no botão no período."
                        rows={d.demo.sources.map((s) => ({ key: s.label, label: DEMO_SOURCE_LABEL[s.label] ?? (s.label || 'sem local'), value: s.clicks }))}
                      />
                      {d.demo.errors.length > 0 && (
                        <div className="mt-5 border-t pt-4">
                          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">A demonstração não abriu</h3>
                          <ul className="space-y-1.5 text-sm">
                            {d.demo.errors.map((e) => (
                              <li key={e.message} className="flex justify-between gap-3">
                                <span className="min-w-0 text-muted-foreground">{e.message}</span>
                                <span className="shrink-0 tabular-nums">{fmtNumber(e.times)}×</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>

              <Card
                title="Quem não abriu a demonstração"
                subtitle={`${fmtNumber(d.noDemo.total)} visitas (${fmtPct(pctOf(d.noDemo.total, t.visits))}) saíram sem clicar em "Acesse a Demonstração". Onde pararam:`}
                actions={d.noDemo.total > 0 ? <LinkButton onClick={() => showVisits({ status: 'no_demo' })}>Ver essas visitas</LinkButton> : undefined}
              >
                <div className="grid gap-6 md:grid-cols-3">
                  <div>
                    <h3 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Última seção da página inicial</h3>
                    <BarList
                      ordinal
                      total={d.noDemo.deepest.reduce((a, r) => a + r.visits, 0)}
                      empty="Ninguém sem clique chegou a ver a página inicial."
                      rows={Object.keys(SECTION_LABEL)
                        .map((s) => ({ key: s, label: SECTION_LABEL[s], value: d.noDemo.deepest.find((r) => r.section === s)?.visits ?? 0 }))}
                    />
                  </div>
                  <div>
                    <h3 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Quanto rolaram a página inicial</h3>
                    <BarList ordinal total={d.noDemo.scroll.reduce((a, r) => a + r.visits, 0)} rows={d.noDemo.scroll.map((r) => ({ key: String(r.bucket), label: SCROLL_BUCKETS[r.bucket] ?? `${r.bucket}%`, value: r.visits }))} />
                  </div>
                  <div>
                    <h3 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Quanto tempo ficaram</h3>
                    <BarList ordinal total={d.noDemo.time.reduce((a, r) => a + r.visits, 0)} rows={d.noDemo.time.map((r) => ({ key: String(r.bucket), label: TIME_BUCKETS[r.bucket] ?? `${r.bucket} s`, value: r.visits }))} />
                  </div>
                </div>
              </Card>

              <div className="grid gap-5 xl:grid-cols-3">
                <Card title="Páginas do site mais vistas" subtitle="Visitas que abriram cada página">
                  <BarList total={t.visits} rows={d.pages.map((p) => ({ key: p.path, label: sitePageLabel(p.path), value: p.visits }))} />
                </Card>
                <Card title="Até onde rolam a página inicial" subtitle={`Das ${fmtNumber(t.homeVisits)} visitas que abriram a página inicial, quantas viram cada seção · rolagem média ${t.avgScrollPct}%`}>
                  <BarList ordinal total={t.homeVisits} rows={d.sections.map((s) => ({ key: s.section, label: SECTION_LABEL[s.section] ?? s.section, value: s.visits }))} />
                </Card>
                <Card title="Cliques e contatos" subtitle="Entrar no sistema, trial, WhatsApp e formulários enviados">
                  {!d.clicks.length ? (
                    <Empty>Nenhum clique no período.</Empty>
                  ) : (
                    <div className="-m-4 max-h-96 overflow-y-auto">
                      <table className="table-modern tabular-nums">
                        <thead>
                          <tr>
                            <th>Onde</th>
                            <th className="text-right">Cliques</th>
                            <th className="text-right">Visitas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.clicks.map((c) => (
                            <tr key={`${c.type}-${c.label}`}>
                              <td className={cn('max-w-[15rem] truncate', ['whatsapp_click', 'form_submit'].includes(c.type) && 'font-medium')} title={clickLabel(c.type, c.label)}>
                                {clickLabel(c.type, c.label)}
                              </td>
                              <td className="text-right">{fmtNumber(c.clicks)}</td>
                              <td className="text-right">{fmtNumber(c.visits)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>

              <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                <BreakdownCard title="Origem" rows={d.breakdowns.sources} format={(r) => SOURCE_LABEL[r.label ?? ''] ?? r.label} onSelect={(r) => showVisits({ source: r.label ?? '' })} />
                <BreakdownCard title="Página de entrada" rows={d.breakdowns.entryPages} format={(r) => sitePageLabel(r.label)} />
                <BreakdownCard title="Estado" subtitle="Visitas do Brasil" rows={d.breakdowns.states} format={(r) => stateName(r.label)} onSelect={(r) => showVisits({ region: r.label ?? '' })} />
                <BreakdownCard title="Cidade" rows={d.breakdowns.cities} format={(r) => [r.label, r.sub].filter(Boolean).join(' · ')} />
                <BreakdownCard title="Campanha (UTM)" subtitle="Links com utm_campaign" rows={d.breakdowns.campaigns} format={(r) => `${r.label}${r.sub ? ` · ${r.sub}` : ''}`} empty="Nenhum link com utm_campaign no período." />
                <BreakdownCard title="Site de origem" rows={d.breakdowns.referrers} format={(r) => r.label} empty="Nenhuma visita veio de outro site." />
                <BreakdownCard title="País" rows={d.breakdowns.countries} format={(r) => countryName(r.label)} />
                <BreakdownCard title="Aparelho" rows={d.breakdowns.devices} format={(r) => DEVICE_LABEL[r.label ?? ''] ?? r.label} onSelect={(r) => showVisits({ device: r.label ?? '' })} />
                <BreakdownCard title="Navegador" rows={d.breakdowns.browsers} format={(r) => r.label ?? 'Não identificado'} />
                <BreakdownCard title="Sistema" rows={d.breakdowns.systems} format={(r) => r.label ?? 'Não identificado'} />
              </div>

              <Card title="Quando visitam" subtitle="Dias da semana e horas (horário de Brasília); quanto mais escuro, mais visitas">
                <Heatmap cells={d.heatmap} />
              </Card>
            </>
          )}

          <SiteVisitsList ref={listRef} period={period} filters={filters} onFilters={setFilters} />

          <div className="flex flex-col gap-4 border bg-white p-4 text-xs leading-relaxed text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
            <p className="max-w-3xl">
              Localização aproximada pelo IP, calculada no servidor sem enviar o IP a terceiros (
              <a href="https://db-ip.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                IP Geolocation by DB-IP
              </a>
              , CC BY 4.0); em celular a cidade costuma ser a da operadora.
              {t.pendingGeo > 0 && <> {fmtNumber(t.pendingGeo)} visita(s) aguardando localização (atualiza a cada 5 minutos).</>} Ficam fora dos números quem está logado no Gestão 360
              (inclusive a equipe com sessão no Portal Admin) e os robôs ({fmtNumber(t.bots)} no período). As visitas ficam guardadas por 12 meses.
            </p>
            <label className="flex shrink-0 items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={optOut}
                onChange={(e) => {
                  setTrackingDisabled(e.target.checked);
                  setOptOut(e.target.checked);
                }}
              />
              <span>
                Não contar este navegador
                <span className="block text-xs text-muted-foreground">Para testar o site e a demonstração sem entrar nas estatísticas.</span>
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
