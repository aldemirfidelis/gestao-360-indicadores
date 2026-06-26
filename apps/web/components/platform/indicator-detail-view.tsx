'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  CalendarClock,
  ChevronRight,
  Download,
  FileText,
  Lightbulb,
  Minus,
  Network,
  ScrollText,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/select';
import { PageHeader } from '@/components/shell/page-header';
import { StatusLight } from '@/components/ui/status-light';
import { StatusBadge } from '@/components/platform/status-badge';
import { api } from '@/lib/api';
import { cn, formatNumber, formatPercent, periodRefLabel } from '@/lib/utils';
import { ACTION_STATUS_LABEL, MEETING_STATUS_LABEL, TRACE_EVENT_LABEL, TRAFFIC_LIGHT_LABEL } from '@/lib/labels';
import { useVision360 } from '@/components/ui/vision360-context';
import { useAuth } from '@/components/auth/auth-provider';

interface IndicatorDetail {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  type: string;
  unit: string;
  unitLabel: string | null;
  periodicity: string;
  direction: string;
  status: string;
  company?: { id: string; name: string } | null;
  ownerNode: { id: string; name: string; type: string; parent?: { id: string; name: string; type: string } | null };
  areaMacro?: { id: string; name: string; type: string } | null;
  areaMicro?: { id: string; name: string; type: string } | null;
  guidelineNode?: { id: string; name: string; type: string } | null;
  responsibleUser: { id: string; name: string } | null;
  strategicObjective?: { id: string; name: string; perspective?: { id: string; name: string; color: string } | null } | null;
  targets: { periodRef: string; target: number }[];
  results: {
    id: string;
    periodRef: string;
    value: number;
    light: string;
    attainment: number | null;
    deviationPct: number | null;
    note: string | null;
    createdAt: string;
    updatedAt: string;
    createdBy?: { id: string; name: string } | null;
  }[];
  actions?: LinkedAction[] | null;
  meetings?: { id: string; title: string; status: string; startsAt: string | null }[] | null;
}

interface SeriesPoint {
  periodRef: string;
  target: number | null;
  value: number | null;
  light: string;
  attainment?: number | null;
}

type IndicatorViewMode = 'monthly' | 'cumulative' | 'weekly' | 'daily';
type IndicatorChartType = 'bar' | 's-curve';

interface ChartPoint {
  periodRef: string;
  month: string;
  meta: number | null;
  realizado: number | null;
  attainment: number | null;
  status: string;
  displayMeta: number | null;
  displayRealizado: number | null;
}

interface GrainCell {
  periodRef: string;
  target: number | null;
  value: number | null;
  status: string;
  light: string;
  isClosed?: boolean;
}

interface GrainResponse {
  indicator: { id: string; name: string };
  granularity: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  monthRef: string;
  cells: GrainCell[];
}

interface TraceEvent {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  relatedType?: string | null;
  relatedId?: string | null;
  title: string;
  description: string | null;
  statusFrom?: string | null;
  statusTo?: string | null;
  occurredAt: string;
  user: { id: string; name: string; email?: string } | null;
  metadata?: unknown;
}

interface TraceabilityTimeline {
  events: TraceEvent[];
}

interface AuditLogEntry {
  id: string;
  action: string;
  recordLabel: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

interface DeviationSummary {
  id: string;
  number: number;
  title: string;
  status: string;
  severity: string;
  periodRef: string;
  fact?: string | null;
  rootCause?: string | null;
  impact?: string | null;
  immediateAction?: string | null;
  analyses?: { id: string; method: string; content: string; createdAt: string }[];
  actions?: LinkedAction[];
  _count?: { causes: number; actions: number; analyses: number };
}

interface LinkedAction {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  expectedResult?: string | null;
  responsibleUser?: { id: string; name: string } | null;
}

interface CurrentTreatment {
  id: string;
  status: string;
  periodRef: string;
  title: string;
}

const STATUS_LABEL = ACTION_STATUS_LABEL;

const renderCustomBarLabel = (props: any, fill: string) => {
  const { x, y, width, value } = props;
  if (value === null || value === undefined || value === '') return null;

  const formatted = formatNumber(value);
  const cx = x + width / 2;
  const cy = y - 6;
  const isShort = formatted.length <= 3;

  return (
    <text
      x={cx}
      y={cy}
      fill={fill}
      textAnchor={isShort ? 'middle' : 'start'}
      fontSize={9}
      fontWeight={600}
      transform={isShort ? undefined : `rotate(-90, ${cx}, ${cy})`}
    >
      {formatted}
    </text>
  );
};

export function IndicatorDetailView({ id, embedded = false }: { id: string; embedded?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [auditOpen, setAuditOpen] = useState(false);
  const [viewMode, setViewMode] = useState<IndicatorViewMode>('monthly');
  const [chartType, setChartType] = useState<IndicatorChartType>('bar');
  const [grainMonth, setGrainMonth] = useState(currentMonthRef());
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [detailTab, setDetailTab] = useState<'ANALISE' | 'HISTORICO' | 'ACOES'>('ANALISE');
  const { open: openVision360 } = useVision360();
  const { hasPermission } = useAuth();
  const canCreateDeviation = hasPermission(['deviations:create', 'deviations:update']);
  const canCreateAction = hasPermission(['actions:create']);
  const canScheduleMeeting = hasPermission(['meetings:create', 'meetings:update']);

  const detail = useQuery<IndicatorDetail>({
    queryKey: ['indicator', id],
    queryFn: () => api<IndicatorDetail>(`/indicators/${id}`),
  });

  const series = useQuery<SeriesPoint[]>({
    queryKey: ['indicator', id, 'series', 12],
    queryFn: () => api<SeriesPoint[]>(`/indicators/${id}/series?points=12`),
  });
  const isGrainMode = viewMode === 'weekly' || viewMode === 'daily';
  const grainGranularity = viewMode === 'weekly' ? 'WEEKLY' : 'DAILY';
  const grainQuery = useQuery<GrainResponse>({
    queryKey: ['indicator', id, 'grain', grainGranularity, grainMonth],
    enabled: isGrainMode,
    queryFn: () => api<GrainResponse>(`/results/grain?indicatorId=${id}&granularity=${grainGranularity}&month=${grainMonth}`),
  });
  const timeline = useQuery<TraceabilityTimeline>({
    queryKey: ['traceability', 'indicator', id],
    queryFn: () => api<TraceabilityTimeline>(`/traceability/indicators/${id}`),
  });
  const lastResult = detail.data?.results[detail.data.results.length - 1];
  const lastPeriodRef = lastResult?.periodRef;

  const deviations = useQuery<DeviationSummary[]>({
    queryKey: ['indicator', id, 'deviations'],
    queryFn: () => api<DeviationSummary[]>(`/deviations?indicatorId=${id}`),
  });

  const currentTreatment = useQuery<CurrentTreatment | null>({
    queryKey: ['indicator', id, 'current-treatment', lastPeriodRef],
    queryFn: () => api<CurrentTreatment | null>(`/treatments/indicators/${id}/current${lastPeriodRef ? `?periodRef=${encodeURIComponent(lastPeriodRef)}` : ''}`),
  });

  const auditLog = useQuery<{ logs: AuditLogEntry[] }>({
    queryKey: ['indicator', id, 'history'],
    enabled: auditOpen,
    queryFn: () => api<{ logs: AuditLogEntry[] }>(`/indicators/${id}/history`),
  });

  const last = lastResult;

  const openDeviation = useMutation({
    mutationFn: () =>
      api<{ id: string; number: number }>('/deviations', {
        method: 'POST',
        json: {
          indicatorId: id,
          periodRef: last?.periodRef,
          severity: 'CRITICAL',
        },
      }),
    onSuccess: (d) => {
      toast.success(`Desvio #${d.number} aberto`);
      queryClient.invalidateQueries({ queryKey: ['indicator', id, 'deviations'] });
      queryClient.invalidateQueries({ queryKey: ['traceability', 'indicator', id] });
      router.push(`/deviations/${d.id}`);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao abrir desvio'),
  });

  if (detail.isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!detail.data) return null;
  const ind = detail.data;

  const monthlyHistory = (series.data ?? []).map((p) => ({
    periodRef: p.periodRef,
    month: shortMonthLabel(p.periodRef),
    meta: p.target,
    realizado: p.value,
    attainment: p.attainment ?? (p.target !== null && p.value !== null && p.target !== 0 ? p.value / p.target : null),
    status: p.light,
  }));
  const chartData: ChartPoint[] = isGrainMode
    ? (grainQuery.data?.cells ?? []).map((c) => ({
        periodRef: c.periodRef,
        month: grainPeriodLabel(c.periodRef),
        meta: c.target,
        realizado: c.value,
        attainment: c.target !== null && c.value !== null && c.target !== 0 ? c.value / c.target : null,
        status: c.light,
        displayMeta: c.target,
        displayRealizado: c.value,
      }))
    : viewMode === 'monthly'
      ? monthlyHistory.map((p) => ({
          ...p,
          displayMeta: p.meta,
          displayRealizado: p.realizado,
        }))
      : monthlyHistory.map((p, idx) => {
          const cumMeta = buildCumulativeAvg(monthlyHistory.map((point) => point.meta));
          const cumReal = buildCumulativeAvg(monthlyHistory.map((point) => point.realizado));
          return {
            ...p,
            displayMeta: cumMeta[idx],
            displayRealizado: cumReal[idx],
          };
        });
  const hasChartData = isGrainMode
    ? (grainQuery.data?.cells ?? []).some((c) => c.target !== null || c.value !== null)
    : monthlyHistory.some((p) => p.meta !== null || p.realizado !== null);
  const safeSelectedIdx = Math.min(selectedIdx, Math.max(0, chartData.length - 1));
  const chartLineColor = realizadoSeriesColor(chartData, ind.direction);
  const onChartClick = (state: any) => {
    const idx = state?.activeTooltipIndex;
    if (typeof idx === 'number' && idx >= 0 && idx < chartData.length) setSelectedIdx(idx);
  };
  const deviationRows = deviations.data ?? [];
  const principalDeviation = getPrincipalDeviation(ind);
  const linkedPrincipalDeviation = principalDeviation
    ? deviationRows.find((d) => d.periodRef === principalDeviation.result.periodRef) ?? null
    : deviationRows[0] ?? null;
  const openOrCreateDeviation = (targetDeviation?: DeviationSummary | null) => {
    const existing = targetDeviation ?? linkedPrincipalDeviation ?? deviationRows[0] ?? null;
    if (existing) {
      router.push(`/deviations/${existing.id}`);
      return;
    }
    if (!last?.periodRef) {
      toast.error('Registre um resultado do indicador antes de abrir um desvio.');
      return;
    }
    openDeviation.mutate();
  };

  const prev = ind.results[ind.results.length - 2] ?? null;
  const unit = ind.unitLabel || ind.unit || '';
  const ppOrUnit = unit === '%' || unit.toUpperCase() === 'PERCENT' ? 'p.p.' : unit || 'pontos';
  const metaValue = ind.targets.find((t) => t.periodRef === last?.periodRef)?.target ?? ind.targets[ind.targets.length - 1]?.target ?? null;
  const momDelta = last && prev ? last.value - prev.value : null;
  const indicatorActionsHref = `/actions?indicatorId=${encodeURIComponent(ind.id)}`;
  const insights = buildInsights(ind, last ?? null, prev, ppOrUnit);
  const risks = buildRisks(deviationRows, last ?? null);
  const planStats = buildPlanStats(ind.actions ?? [], deviationRows);
  const upcomingMeetings = (ind.meetings ?? [])
    .filter((meeting) => !meeting.startsAt || new Date(meeting.startsAt).getTime() >= Date.now())
    .sort((a, b) => new Date(a.startsAt ?? 0).getTime() - new Date(b.startsAt ?? 0).getTime());

  return (
    <div>
      {!embedded && (
      <nav className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/strategy" className="hover:text-foreground">Estratégia</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/indicators" className="hover:text-foreground">Indicadores</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-foreground">Detalhes do indicador</span>
      </nav>
      )}

      {!embedded && (
      <PageHeader
        title={ind.name}
        description={ind.description ?? `${ind.ownerNode?.name ?? '-'} - ${ind.code ?? '-'}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="gap-1.5" onClick={() => openVision360('INDICATOR', ind.id)}>
              <Network className="h-4 w-4 text-primary" /> Visão 360°
            </Button>
            <Button
              variant={last?.light === 'RED' ? 'destructive' : 'outline'}
              onClick={() => openOrCreateDeviation(linkedPrincipalDeviation)}
              disabled={openDeviation.isPending || (!canCreateDeviation && !linkedPrincipalDeviation && deviationRows.length === 0)}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              {openDeviation.isPending ? 'Abrindo...' : linkedPrincipalDeviation || deviationRows.length ? 'Abrir desvio' : 'Registrar desvio'}
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={() => window.print()}>
              <Download className="h-4 w-4" /> Exportar
            </Button>
          </div>
        }
      />
      )}

      {/* Fluxo Lógico e Rastreabilidade Superior */}
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border bg-card/45 p-3 text-xs shadow-sm backdrop-blur-sm">
        <span className="font-semibold text-muted-foreground">Hierarquia integrada:</span>
        <span className="font-medium text-foreground">{ind.company?.name ?? 'Empresa'}</span>
        <span className="text-muted-foreground/60">&rarr;</span>
        <span className="font-medium text-foreground">{ind.areaMacro?.name ?? 'Sem Área'}</span>
        {ind.areaMicro && (
          <>
            <span className="text-muted-foreground/60">&rarr;</span>
            <span className="font-medium text-foreground">{ind.areaMicro.name}</span>
          </>
        )}
        {ind.ownerNode?.type === 'UNIT' && (
          <>
            <span className="text-muted-foreground/60">&rarr;</span>
            <span className="font-medium text-foreground">Pilar: {ind.ownerNode.name}</span>
          </>
        )}
        {ind.guidelineNode && (
          <>
            <span className="text-muted-foreground/60">&rarr;</span>
            <span className="font-medium text-foreground">Diretriz: {ind.guidelineNode.name}</span>
          </>
        )}
        {ind.strategicObjective && (
          <>
            <span className="text-muted-foreground/60">&rarr;</span>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
              Objetivo Estratégico: {ind.strategicObjective.name}
            </span>
          </>
        )}
      </div>

      <div className="mb-6 max-w-sm">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase text-muted-foreground">Realizado atual</div>
              <span
                className={cn(
                  'h-4 w-4 rounded-full ring-2 ring-offset-1 ring-offset-background',
                  last?.light === 'RED'
                    ? 'bg-status-red ring-status-red/30 status-red-pulse'
                    : last?.light === 'YELLOW'
                      ? 'bg-status-yellow ring-status-yellow/30'
                      : last?.light === 'GREEN'
                        ? 'bg-status-green ring-status-green/30'
                        : 'bg-muted-foreground/40 ring-muted-foreground/20',
                )}
                title={statusHint(last?.light, ind.direction)}
                aria-label={`Farol: ${last?.light ?? 'sem dado'}`}
              />
            </div>
            <div className="mt-1 text-2xl font-semibold">{last ? formatNumber(last.value) : '-'}</div>
            <div className="text-xs text-muted-foreground">
              {last ? periodRefLabel(last.periodRef) : 'Sem lançamento'}
              {metaValue !== null && <> · Meta {formatNumber(metaValue)}</>}
              {last?.attainment !== null && last?.attainment !== undefined && <> · {formatPercent(last.attainment)}</>}
            </div>
            {momDelta !== null && (
              <div className={cn('mt-1.5 inline-flex items-center gap-1 text-xs font-medium', momDelta < 0 ? 'text-status-red' : momDelta > 0 ? 'text-status-green' : 'text-muted-foreground')}>
                {momDelta < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : momDelta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                {momDelta > 0 ? '+' : ''}{formatNumber(momDelta, { maximumFractionDigits: 2 })} {ppOrUnit} vs período anterior
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <IndicatorDecisionCards
          indicator={ind}
          principal={principalDeviation}
          principalDeviation={linkedPrincipalDeviation}
          deviations={deviationRows}
          currentTreatment={currentTreatment.data ?? null}
          onOpenDeviation={openOrCreateDeviation}
          openingDeviation={openDeviation.isPending}
          canCreateDeviation={Boolean(last?.periodRef) && canCreateDeviation}
          actionsHref={indicatorActionsHref}
        />

        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-md border bg-card/60 p-0.5">
                {(['monthly', 'cumulative', 'weekly', 'daily'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => { setViewMode(mode); setSelectedIdx(0); }}
                    className={cn(
                      'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                      viewMode === mode ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {mode === 'monthly' && 'Mensal'}
                    {mode === 'cumulative' && 'Acumulado'}
                    {mode === 'weekly' && 'Semanal'}
                    {mode === 'daily' && 'Diário'}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {false && (
                  <>
                <option value="6">6 períodos</option>
                <option value="12">12 períodos</option>
                <option value="24">24 períodos</option>
                  </>
                )}
                {isGrainMode && (
                  <NativeSelect
                    value={grainMonth}
                    onChange={(e) => { setGrainMonth(e.target.value); setSelectedIdx(0); }}
                    className="h-8 text-xs"
                  >
                    {monthOptionsForYear(new Date().getFullYear()).map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </NativeSelect>
                )}
                <div className="inline-flex rounded-md border bg-card/60 p-0.5">
                  <button
                    type="button"
                    onClick={() => setChartType('bar')}
                    className={cn('inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors', chartType === 'bar' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    Barras
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType('s-curve')}
                    className={cn('inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors', chartType === 's-curve' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    Curva S
                  </button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {hasChartData ? (
              <>
                <div className="h-[17rem] border border-border/60 bg-card/60 p-2 sm:h-[23rem]">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                      <BarChart data={chartData} barGap={2} margin={{ top: 40, right: 12, left: 0, bottom: 8 }} onClick={onChartClick} style={{ cursor: 'pointer' }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="month"
                          tick={({ x, y, payload, index }: any) => (
                            <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fontWeight={index === safeSelectedIdx ? 700 : 400} fill={index === safeSelectedIdx ? 'hsl(var(--primary))' : 'currentColor'}>
                              {payload.value}
                            </text>
                          )}
                          axisLine={false}
                          tickLine={false}
                          interval={0}
                        />
                        <YAxis tick={{ fontSize: 11 }} width={48} />
                        <Tooltip content={<DetailChartTooltip viewMode={viewMode} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.35 }} />
                        <Bar dataKey="displayMeta" name="Meta" fill="#1e3a8a" radius={[3, 3, 0, 0]}>
                          <LabelList dataKey="displayMeta" content={(props) => renderCustomBarLabel(props, '#1e3a8a')} />
                        </Bar>
                        <Bar dataKey="displayRealizado" name="Realizado" radius={[3, 3, 0, 0]}>
                          {chartData.map((entry, index) => {
                            let color = 'hsl(var(--status-gray))';
                            const r = entry.displayRealizado;
                            const m = entry.displayMeta;
                            if (r !== null && r !== undefined) {
                              const isWithin = ind.direction === 'LOWER_BETTER'
                                ? (r ?? 0) <= (m ?? 0)
                                : (r ?? 0) >= (m ?? 0);
                              color = isWithin ? '#10b981' : '#ef4444';
                            }
                            return <Cell key={`cell-${index}`} fill={color} />;
                          })}
                          <LabelList dataKey="displayRealizado" content={(props) => renderCustomBarLabel(props, 'hsl(var(--foreground))')} />
                        </Bar>
                      </BarChart>
                    ) : (
                      <LineChart data={chartData} margin={{ top: 24, right: 12, left: 0, bottom: 8 }} onClick={onChartClick} style={{ cursor: 'pointer' }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="month"
                          tick={({ x, y, payload, index }: any) => (
                            <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fontWeight={index === safeSelectedIdx ? 700 : 400} fill={index === safeSelectedIdx ? 'hsl(var(--primary))' : 'currentColor'}>
                              {payload.value}
                            </text>
                          )}
                          axisLine={false}
                          tickLine={false}
                          interval={0}
                        />
                        <YAxis tick={{ fontSize: 11 }} width={48} />
                        <Tooltip content={<DetailChartTooltip viewMode={viewMode} />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }} />
                        <Line type="monotone" dataKey="displayMeta" name="Meta" stroke="#1e3a8a" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3, fill: '#1e3a8a' }} activeDot={{ r: 5 }}>
                          <LabelList dataKey="displayMeta" position="top" fontSize={10} fill="#1e3a8a" formatter={(v: any) => (v === null || v === undefined ? '' : formatNumber(v))} />
                        </Line>
                        <Line type="monotone" dataKey="displayRealizado" name="Realizado" stroke={chartLineColor} strokeWidth={2.5} dot={{ r: 3, fill: chartLineColor }} activeDot={{ r: 5 }}>
                          <LabelList dataKey="displayRealizado" position="top" fontSize={10} fill={chartLineColor} formatter={(v: any) => (v === null || v === undefined ? '' : formatNumber(v))} />
                        </Line>
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <Lightbulb className="h-3.5 w-3.5 text-status-blue" />
                  Dados atualizados até {last ? periodRefLabel(last.periodRef) : '-'}. Projeção baseada no desempenho atual.
                </div>
                <div className="mt-4 border-t pt-4">
                  <div className="mb-3 flex flex-wrap gap-1">
                    {(['ANALISE', 'HISTORICO', 'ACOES'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setDetailTab(tab)}
                        className={cn(
                          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                          detailTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {CHART_TAB_LABEL[tab]}
                      </button>
                    ))}
                  </div>
                  {detailTab === 'ANALISE' && <AnalysisTab series={series.data ?? []} last={last ?? null} prev={prev} metaValue={metaValue} ppOrUnit={ppOrUnit} />}
                  {detailTab === 'HISTORICO' && <MiniHistory results={ind.results} targets={ind.targets} />}
                  {detailTab === 'ACOES' && <LinkedActionsTab actions={ind.actions ?? []} />}
                </div>
              </>
            ) : (
              <div className="flex h-[17rem] items-center justify-center border border-border/60 bg-card/60 p-2 text-xs text-muted-foreground sm:h-[23rem]">
                Sem dados para o período
              </div>
            )}
          </CardContent>
        </Card>

        <div className="hidden">
          <RailCard icon={Lightbulb} iconClass="text-status-blue" title="Insights automáticos">
            {insights.length === 0 ? (
              <RailEmpty>Sem insights para o período.</RailEmpty>
            ) : (
              <ul className="space-y-2">
                {insights.map((insight, index) => (
                  <li key={index} className="flex gap-2 text-xs leading-relaxed text-foreground">
                    <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', insight.tone === 'red' ? 'bg-status-red' : insight.tone === 'yellow' ? 'bg-status-yellow' : insight.tone === 'green' ? 'bg-status-green' : 'bg-status-blue')} />
                    <span>{insight.text}</span>
                  </li>
                ))}
              </ul>
            )}
            <RailLink onClick={() => openVision360('INDICATOR', ind.id)}>Ver todos os insights</RailLink>
          </RailCard>

          <RailCard icon={ShieldAlert} iconClass="text-status-yellow" title="Riscos relacionados">
            {risks.length === 0 ? (
              <RailEmpty>Nenhum risco vinculado a este indicador.</RailEmpty>
            ) : (
              <ul className="space-y-2">
                {risks.map((risk, index) => (
                  <li key={index} className="flex gap-2 text-xs leading-relaxed text-foreground">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-status-yellow" />
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            )}
            <RailLinkTo href="/risks">Ver todos os riscos</RailLinkTo>
          </RailCard>

          <RailCard icon={FileText} iconClass="text-status-blue" title="Planos vinculados">
            <div className="space-y-1.5 text-xs">
              <RailStat label="Total de planos" value={planStats.total} />
              <RailStat label="Planos ativos" value={planStats.active} />
              <RailStat label="Aguardando aprovação" value={planStats.waiting} />
              <RailStat label="Planos atrasados" value={planStats.overdue} tone={planStats.overdue > 0 ? 'red' : undefined} />
            </div>
            <RailLinkTo href={indicatorActionsHref}>Ver planos</RailLinkTo>
          </RailCard>

          <RailCard icon={CalendarClock} iconClass="text-primary" title="Próximas reuniões">
            {upcomingMeetings.length === 0 ? (
              <RailEmpty>Nenhuma reunião vinculada a este indicador.</RailEmpty>
            ) : (
              <ul className="space-y-2">
                {upcomingMeetings.slice(0, 3).map((meeting) => (
                  <li key={meeting.id} className="text-xs">
                    <Link href={`/meetings/${meeting.id}`} className="font-medium text-foreground hover:underline">{meeting.title}</Link>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-muted-foreground">
                      <span>{meeting.startsAt ? new Date(meeting.startsAt).toLocaleString('pt-BR') : 'Sem data'}</span>
                      <StatusBadge value={meeting.status} label={MEETING_STATUS_LABEL[meeting.status] ?? meeting.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <RailLinkTo href="/meetings">Ver agenda</RailLinkTo>
          </RailCard>
        </div>
      </div>

      {/* Blocos de Ações e Reuniões Relacionados */}
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b">
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-primary" />
              Planos de Ação Relacionados ({ind.actions?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {(!ind.actions || ind.actions.length === 0) ? (
              <p className="text-xs text-muted-foreground py-2">Nenhum plano de ação vinculado a este indicador.</p>
            ) : (
              <div className="divide-y divide-border">
                {ind.actions.map((act) => (
                  <div key={act.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                    <div className="min-w-0">
                      <Link href={`/actions/${act.id}`} className="font-semibold hover:underline block truncate text-foreground">
                        {act.title}
                      </Link>
                      <span className="text-muted-foreground block mt-0.5">Prazo: {act.dueDate ? new Date(act.dueDate).toLocaleDateString('pt-BR') : 'Sem prazo'}</span>
                    </div>
                    <StatusBadge value={act.status} label={STATUS_LABEL[act.status] ?? act.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b">
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Reuniões de Alinhamento ({ind.meetings?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {(!ind.meetings || ind.meetings.length === 0) ? (
              <p className="text-xs text-muted-foreground py-2">Nenhuma reunião vinculada a este indicador.</p>
            ) : (
              <div className="divide-y divide-border">
                {ind.meetings.map((meet) => (
                  <div key={meet.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                    <div className="min-w-0">
                      <Link href={`/meetings/${meet.id}`} className="font-semibold hover:underline block truncate text-foreground">
                        {meet.title}
                      </Link>
                      <span className="text-muted-foreground block mt-0.5">Agendada para: {meet.startsAt ? new Date(meet.startsAt).toLocaleString('pt-BR') : 'Sem data'}</span>
                    </div>
                    <StatusBadge value={meet.status} label={MEETING_STATUS_LABEL[meet.status] ?? meet.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr,420px]">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Próximos passos sugeridos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <p className="text-xs text-muted-foreground">{nextStepsHint(last?.light)}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={last?.light === 'RED' ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => openOrCreateDeviation(linkedPrincipalDeviation)}
                disabled={openDeviation.isPending || (!linkedPrincipalDeviation && deviationRows.length === 0 && (!last?.periodRef || !canCreateDeviation))}
              >
                <AlertTriangle className="mr-1.5 h-4 w-4" />
                {openDeviation.isPending ? 'Abrindo...' : 'Abrir desvio'}
              </Button>
              {canCreateAction && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={linkedPrincipalDeviation ? `/deviations/${linkedPrincipalDeviation.id}` : indicatorActionsHref}>
                    <ScrollText className="mr-1.5 h-4 w-4" />
                    Criar plano de ação
                  </Link>
                </Button>
              )}
              {last?.light === 'RED' && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={linkedPrincipalDeviation ? `/deviations/${linkedPrincipalDeviation.id}` : '/deviations'}>
                    <ShieldAlert className="mr-1.5 h-4 w-4" />
                    Solicitar análise de causa
                  </Link>
                </Button>
              )}
              {canScheduleMeeting && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/meetings">
                    <ScrollText className="mr-1.5 h-4 w-4" />
                    Registrar reunião
                  </Link>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => openVision360('INDICATOR', ind.id)}>
                <Network className="mr-1.5 h-4 w-4" />
                Recomendação com IA
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
            <CardTitle className="text-sm">Linha de rastreabilidade</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setAuditOpen(true)}>
              <ScrollText className="mr-1.5 h-3.5 w-3.5" />
              Auditoria completa
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {timeline.isLoading && <p className="text-sm text-muted-foreground">Carregando histórico...</p>}
            {!timeline.isLoading && (timeline.data?.events.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum evento registrado para este indicador.</p>
            )}
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {timeline.data?.events.map((event) => (
                <Link
                  key={event.id}
                  href={eventHref(event)}
                  className="block rounded-lg border p-3 transition-colors hover:bg-accent/35"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{event.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(event.occurredAt).toLocaleString('pt-BR')} - {event.user?.name ?? 'Sistema'}
                      </div>
                    </div>
                    <StatusBadge value={event.statusTo ?? event.eventType} label={shortEventLabel(event.eventType)} />
                  </div>
                  {event.description && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{event.description}</p>
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-row items-center justify-between">
            <CardTitle>Histórico de lançamentos</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setAuditOpen(true)}>
              <ScrollText className="mr-1.5 h-3.5 w-3.5" />
              Auditoria completa
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase">
                  <th className="px-4 py-2 font-medium">Período</th>
                  <th className="px-4 py-2 font-medium text-right">Meta</th>
                  <th className="px-4 py-2 font-medium text-right">Realizado</th>
                  <th className="px-4 py-2 font-medium text-right">Desvio %</th>
                  <th className="px-4 py-2 font-medium text-right">Atingim.</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Lançado por</th>
                  <th className="px-4 py-2 font-medium">Atualizado em</th>
                  <th className="px-4 py-2 font-medium">Observação</th>
                </tr>
              </thead>
              <tbody>
                {ind.results
                  .slice()
                  .reverse()
                  .map((r) => {
                    const t = ind.targets.find((x) => x.periodRef === r.periodRef);
                    return (
                      <tr key={r.id} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-2 font-medium">{periodRefLabel(r.periodRef)}</td>
                        <td className="px-4 py-2 text-right">{t ? formatNumber(t.target) : '-'}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatNumber(r.value)}</td>
                        <td className="px-4 py-2 text-right">
                          {r.deviationPct !== null
                            ? `${r.deviationPct > 0 ? '+' : ''}${formatNumber(r.deviationPct, { maximumFractionDigits: 1 })}%`
                            : '-'}
                        </td>
                        <td className="px-4 py-2 text-right">{formatPercent(r.attainment)}</td>
                        <td className="px-4 py-2">
                          <StatusLight light={r.light} />
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{r.createdBy?.name ?? 'Sistema'}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {r.updatedAt ? new Date(r.updatedAt).toLocaleString('pt-BR') : '-'}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground max-w-[260px] truncate" title={r.note ?? ''}>
                          {r.note ?? '-'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Auditoria completa - {ind.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {auditLog.isLoading && <p className="text-sm text-muted-foreground">Carregando auditoria...</p>}
            {!auditLog.isLoading && (auditLog.data?.logs.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum registro de auditoria encontrado.</p>
            )}
            {auditLog.data?.logs.map((log) => (
              <div key={log.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{auditActionLabel(log.action)}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString('pt-BR')} - {log.user?.name ?? 'Sistema'}
                  </div>
                </div>
                {log.recordLabel && <p className="mt-1 text-sm text-muted-foreground">{log.recordLabel}</p>}
                {(log.beforeValue || log.afterValue) && (
                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                    {log.beforeValue && (
                      <div className="rounded border bg-muted/30 p-2">
                        <div className="font-semibold text-muted-foreground">Antes</div>
                        <pre className="mt-1 whitespace-pre-wrap break-words text-[11px]">{log.beforeValue}</pre>
                      </div>
                    )}
                    {log.afterValue && (
                      <div className="rounded border bg-muted/30 p-2">
                        <div className="font-semibold text-muted-foreground">Depois</div>
                        <pre className="mt-1 whitespace-pre-wrap break-words text-[11px]">{log.afterValue}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type PrincipalDeviation = {
  result: IndicatorDetail['results'][number];
  target: number | null;
  deviationAbs: number | null;
};

function IndicatorDecisionCards({
  indicator,
  principal,
  principalDeviation,
  deviations,
  currentTreatment,
  onOpenDeviation,
  openingDeviation,
  canCreateDeviation,
  actionsHref,
}: {
  indicator: IndicatorDetail;
  principal: PrincipalDeviation | null;
  principalDeviation: DeviationSummary | null;
  deviations: DeviationSummary[];
  currentTreatment: CurrentTreatment | null;
  onOpenDeviation: (deviation?: DeviationSummary | null) => void;
  openingDeviation: boolean;
  canCreateDeviation: boolean;
  actionsHref: string;
}) {
  const mainDeviation = principalDeviation ?? deviations[0] ?? null;
  const deviationHref = mainDeviation ? `/deviations/${mainDeviation.id}` : '/deviations';
  const treatmentHref = currentTreatment ? `/treatments/${currentTreatment.id}` : '/treatments';
  const latestAnalysis = mainDeviation?.analyses?.[0] ?? null;
  const linkedActions = uniqueActionRows(deviations.flatMap((deviation) => deviation.actions ?? []));
  const rootCause = mainDeviation?.rootCause?.trim();
  const immediateProvidence = mainDeviation?.immediateAction?.trim();

  return (
    <aside className="grid gap-3">
      <DecisionCard tone="red" title="Desvio principal">
        <div className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">Desvio da meta: </span>
            <span className="font-semibold text-foreground">{formatDeviationSummary(principal)}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Impacto financeiro/operacional estimado: </span>
            <span className="font-medium text-foreground">{formatOperationalImpact(indicator, principal)}</span>
          </p>
          {mainDeviation?.impact && (
            <p className="rounded-md bg-muted/35 p-2 text-xs leading-relaxed text-muted-foreground">
              Impacto registrado: {truncateText(mainDeviation.impact, 150)}
            </p>
          )}
          <Button
            variant={mainDeviation ? 'outline' : 'destructive'}
            size="sm"
            onClick={() => onOpenDeviation(mainDeviation)}
            disabled={openingDeviation || (!mainDeviation && !canCreateDeviation)}
          >
            <AlertTriangle className="mr-1.5 h-4 w-4" />
            {openingDeviation ? 'Abrindo...' : mainDeviation ? `Abrir desvio #${mainDeviation.number}` : 'Registrar Desvio'}
          </Button>
        </div>
      </DecisionCard>

      <DecisionCard tone="olive" title="Providências">
        <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
          {immediateProvidence || 'Nenhuma providência imediata registrada no desvio. Registre o que a área fez para conter ou sanar momentaneamente o problema.'}
        </p>
        <div className="mb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenDeviation(mainDeviation)}
            disabled={openingDeviation || (!mainDeviation && !canCreateDeviation)}
          >
            <AlertTriangle className="mr-1.5 h-4 w-4" />
            {mainDeviation ? 'Abrir desvio para análise' : 'Registrar Desvio'}
          </Button>
        </div>
        <DecisionList>
          <DecisionLink href={treatmentHref}>
            {currentTreatment ? 'Abrir tratativa em andamento' : 'Ver fila de tratativas do indicador'}
          </DecisionLink>
          <DecisionLink href="/meetings">Agendar ou consultar reunião de alinhamento</DecisionLink>
        </DecisionList>
      </DecisionCard>

      <DecisionCard tone="orange" title="Causa Raiz">
        <div className="mb-3 space-y-2 text-sm">
          <p className="leading-relaxed text-foreground">
            {rootCause
              ? rootCause
              : mainDeviation
                ? 'Causa raiz ainda não consolidada no desvio.'
                : 'Nenhum desvio registrado para consolidar causa raiz.'}
          </p>
          {latestAnalysis && (
            <p className="rounded-md bg-muted/35 p-2 text-xs leading-relaxed text-muted-foreground">
              Última análise: {truncateText(latestAnalysis.content, 170)}
            </p>
          )}
        </div>
        <div className="text-sm">
          <Link href={deviationHref} className="underline-offset-2 hover:underline">
            {mainDeviation ? 'Abrir desvio para consolidar causa raiz' : 'Registrar desvio para análise de causa'}
          </Link>
        </div>
      </DecisionCard>

      <DecisionCard tone="green" title="Plano de Ação">
        <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
          {summarizeActionPlan(linkedActions, linkedActions.length)}
        </p>
        <DecisionList>
          {linkedActions.slice(0, 3).map((action) => (
            <DecisionLink key={action.id} href={`/actions/${action.id}`}>
              {formatActionSummary(action)}
            </DecisionLink>
          ))}
          {linkedActions.length === 0 && (
            <DecisionLink href={deviationHref}>
              {mainDeviation ? 'Criar plano de ação a partir do desvio' : 'Registrar desvio antes do plano de ação'}
            </DecisionLink>
          )}
          <DecisionLink href={actionsHref}>Ver todos os planos vinculados</DecisionLink>
        </DecisionList>
      </DecisionCard>
    </aside>
  );
}

function DecisionCard({ tone, title, children }: { tone: 'red' | 'olive' | 'orange' | 'green'; title: string; children: ReactNode }) {
  const toneClass = {
    red: 'border-l-red-700 text-red-700',
    olive: 'border-l-[#8a8540] text-[#8a8540]',
    orange: 'border-l-orange-500 text-orange-600',
    green: 'border-l-emerald-700 text-emerald-800',
  }[tone];
  return (
    <Card className={`rounded-lg border-l-4 shadow-sm ${toneClass}`}>
      <CardContent className="p-5">
        <h3 className="mb-4 text-base font-bold">{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

function DecisionList({ children }: { children: ReactNode }) {
  return <ul className="list-[square] space-y-2 pl-4 text-sm text-foreground">{children}</ul>;
}

function DecisionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className="underline-offset-2 hover:underline">
        {children}
      </Link>
    </li>
  );
}

function uniqueActionRows(actions: LinkedAction[]) {
  const byId = new Map<string, LinkedAction>();
  for (const action of actions) byId.set(action.id, action);
  return Array.from(byId.values());
}

function summarizeActionPlan(actions: LinkedAction[], totalActions: number) {
  if (actions.length === 0) return 'Nenhum plano de ação vinculado ao desvio ainda. Crie o plano após consolidar a análise de causa.';
  const open = actions.filter((action) => !['DONE', 'DONE_LATE', 'CANCELLED', 'EFFECTIVE', 'INEFFECTIVE'].includes(action.status)).length;
  const done = totalActions - open;
  const next = actions[0];
  const owner = next.responsibleUser?.name ?? 'sem dono';
  const dueDate = next.dueDate ? new Date(next.dueDate).toLocaleDateString('pt-BR') : 'sem prazo';
  const expected = next.expectedResult ? truncateText(next.expectedResult, 100) : 'sem impacto esperado';
  return `${open} plano(s) em aberto e ${Math.max(done, 0)} concluído(s). Próxima ação: ${next.title}; dono ${owner}; prazo ${dueDate}; impacto esperado: ${expected}.`;
}

function formatActionSummary(action: LinkedAction) {
  const owner = action.responsibleUser?.name ?? 'sem dono';
  const dueDate = action.dueDate ? new Date(action.dueDate).toLocaleDateString('pt-BR') : 'sem prazo';
  const expected = action.expectedResult ? `; impacto: ${truncateText(action.expectedResult, 70)}` : '';
  return `${action.title} - ${owner}; prazo ${dueDate}; ${STATUS_LABEL[action.status] ?? action.status}${expected}`;
}

function truncateText(value: string, maxLength: number) {
  const clean = value.trim().replace(/\s+/g, ' ');
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
}

function getPrincipalDeviation(indicator: IndicatorDetail): PrincipalDeviation | null {
  const targetByRef = new Map(indicator.targets.map((target) => [target.periodRef, target.target]));
  const candidates = indicator.results
    .map((result) => {
      const target = targetByRef.get(result.periodRef) ?? null;
      const deviationAbs = target !== null ? Math.abs(result.value - target) : null;
      const deviationPctAbs = result.deviationPct !== null ? Math.abs(result.deviationPct) : null;
      const attentionWeight = result.light === 'RED' ? 1000000 : result.light === 'YELLOW' ? 500000 : 0;
      const score = attentionWeight + (deviationPctAbs ?? 0) * 1000 + (deviationAbs ?? 0);
      return { result, target, deviationAbs, score };
    })
    .filter((item) => item.result.light === 'RED' || item.result.light === 'YELLOW');

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  const { result, target, deviationAbs } = candidates[0];
  return { result, target, deviationAbs };
}

function formatDeviationSummary(principal: PrincipalDeviation | null) {
  if (!principal) return 'sem desvio crítico no último recorte';
  const pct = principal.result.deviationPct;
  const period = periodRefLabel(principal.result.periodRef);
  const pctText = pct !== null ? `${pct > 0 ? '+' : ''}${formatNumber(pct, { maximumFractionDigits: 1 })}%` : 'sem percentual calculado';
  if (principal.target === null) return `${period}: ${pctText}`;
  return `${period}: realizado ${formatNumber(principal.result.value)} vs meta ${formatNumber(principal.target)} (${pctText})`;
}

function formatOperationalImpact(indicator: IndicatorDetail, principal: PrincipalDeviation | null) {
  if (!principal) return 'sem impacto estimado para decisão imediata';
  if (principal.deviationAbs === null) return 'impacto pendente de meta lançada';
  const unit = indicator.unitLabel || indicator.unit || 'índice';
  if (unit === 'R$' || unit.toUpperCase() === 'CURRENCY') return `R$ ${formatNumber(principal.deviationAbs)}`;
  if (unit === '%' || unit.toUpperCase() === 'PERCENT') return `${formatNumber(principal.deviationAbs)} p.p.`;
  return `${formatNumber(principal.deviationAbs)} ${unit}`;
}

function eventHref(event: TraceEvent) {
  if (event.entityType === 'ACTION_PLAN') return `/actions/${event.entityId}`;
  if (event.entityType === 'DEVIATION') return `/deviations/${event.entityId}`;
  if (event.entityType === 'MEETING') return `/meetings/${event.entityId}`;
  if (event.entityType === 'RISK') return `/risks?focus=${event.entityId}`;
  if (event.entityType === 'NON_CONFORMITY') return `/nonconformities?focus=${event.entityId}`;
  if (event.entityType === 'DOCUMENT') return `/documents?focus=${event.entityId}`;
  if (event.entityType === 'PROCESS') return `/processes?focus=${event.entityId}`;
  if (event.entityType === 'PROCESS_STEP') return `/processes?focus=${event.relatedId ?? event.entityId}`;
  if (event.entityType === 'FORM_TEMPLATE') return `/forms?focus=${event.entityId}`;
  if (event.entityType === 'FORM_SUBMISSION') return `/forms?focus=${event.relatedId ?? event.entityId}`;
  return '#';
}

function shortEventLabel(type: string) {
  return TRACE_EVENT_LABEL[type] ?? type;
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    CREATE: 'Criação do indicador',
    UPDATE: 'Edição cadastral',
    DELETE: 'Exclusão lógica',
    CREATE_TARGET: 'Meta criada',
    UPDATE_TARGET: 'Meta alterada',
    CREATE_RESULT: 'Lançamento de realizado',
    UPDATE_RESULT: 'Alteração de realizado',
    PERMISSION_CHANGE: 'Alteração de permissão',
  };
  return labels[action] ?? action;
}

type InsightItem = { tone: 'red' | 'yellow' | 'green' | 'blue'; text: string };

const CHART_TAB_LABEL: Record<'EVOLUCAO' | 'ANALISE' | 'HISTORICO' | 'ACOES', string> = {
  EVOLUCAO: 'Evolução',
  ANALISE: 'Análise',
  HISTORICO: 'Histórico',
  ACOES: 'Ações',
};

const LIGHT_LABEL = TRAFFIC_LIGHT_LABEL;

function realizadoSeriesColor(
  points: Array<{ displayRealizado?: number | null; displayMeta?: number | null }>,
  direction?: string,
): string {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const r = points[i]?.displayRealizado;
    const m = points[i]?.displayMeta;
    if (r === null || r === undefined) continue;
    const within = direction === 'LOWER_BETTER' ? (r ?? 0) <= (m ?? 0) : (r ?? 0) >= (m ?? 0);
    return within ? '#10b981' : '#ef4444';
  }
  return '#10b981';
}

function grainPeriodLabel(periodRef: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(periodRef)) return periodRef.slice(8, 10);
  const weekMatch = /^\d{4}-W(\d{2})$/.exec(periodRef);
  if (weekMatch) return `S${weekMatch[1]}`;
  const biweekMatch = /^\d{4}-BW(\d+)$/.exec(periodRef);
  if (biweekMatch) return `Q${biweekMatch[1]}`;
  return periodRef;
}

function currentMonthRef(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function monthOptionsForYear(year: number): { value: string; label: string }[] {
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const pad = (value: number) => String(value).padStart(2, '0');
  return monthNames.map((label, index) => ({
    value: `${year}-${pad(index + 1)}`,
    label: `${label}/${String(year).slice(2)}`,
  }));
}

function buildCumulativeAvg(values: Array<number | null | undefined>): Array<number | null> {
  const out: Array<number | null> = [];
  let sum = 0;
  let count = 0;
  for (const value of values) {
    if (value !== null && value !== undefined && Number.isFinite(value)) {
      sum += value;
      count += 1;
    }
    out.push(count === 0 ? null : sum / count);
  }
  return out;
}

function shortMonthLabel(periodRef: string): string {
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const match = /^(\d{4})-(\d{2})/.exec(periodRef);
  if (!match) return periodRef;
  const index = Number(match[2]) - 1;
  return monthNames[index] ?? periodRef;
}

function DetailChartTooltip({ active, payload, label, viewMode }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as ChartPoint | undefined;
  const isCum = viewMode === 'cumulative';
  return (
    <div className="rounded-md border bg-background p-2 text-xs shadow-sm">
      <div className="font-semibold">{label}{isCum && ' (acumulado)'}</div>
      <div>Meta: {formatNumber(point?.displayMeta ?? point?.meta)}</div>
      <div>Realizado: {formatNumber(point?.displayRealizado ?? point?.realizado)}</div>
      {!isCum && <div>Atingimento: {formatPercent(point?.attainment)}</div>}
      <div>Status: {LIGHT_LABEL[point?.status ?? 'GRAY'] ?? point?.status ?? 'Sem dados'}</div>
    </div>
  );
}

function statusHint(light: string | undefined, direction: string) {
  if (light === 'GREEN') return 'Dentro da meta';
  if (light === 'YELLOW') return 'Próximo do limite';
  if (light === 'RED') return direction === 'LOWER_BETTER' ? 'Acima da meta' : 'Abaixo da meta';
  return 'Sem lançamento';
}

function nextStepsHint(light: string | undefined) {
  if (light === 'RED') return 'Indicador crítico: abra um desvio, solicite análise de causa e estruture um plano de ação.';
  if (light === 'YELLOW') return 'Indicador em atenção: agende uma reunião de alinhamento e reforce o monitoramento.';
  if (light === 'GREEN') return 'Indicador no alvo: registre boas práticas e mantenha o acompanhamento.';
  return 'Sem lançamento recente: registre o resultado do período para habilitar as tratativas.';
}

function buildInsights(
  indicator: IndicatorDetail,
  last: IndicatorDetail['results'][number] | null,
  prev: IndicatorDetail['results'][number] | null,
  ppOrUnit: string,
): InsightItem[] {
  const out: InsightItem[] = [];
  const higherBetter = indicator.direction !== 'LOWER_BETTER';
  if (last && prev) {
    const delta = last.value - prev.value;
    if (Math.abs(delta) >= 0.01) {
      const improved = higherBetter ? delta > 0 : delta < 0;
      out.push({
        tone: improved ? 'green' : 'red',
        text: `${delta < 0 ? 'Queda' : 'Alta'} de ${formatNumber(Math.abs(delta), { maximumFractionDigits: 2 })} ${ppOrUnit} em relação ao período anterior.`,
      });
    }
  }
  if (last?.attainment != null) {
    const gap = 100 - last.attainment;
    if (gap > 0.05) out.push({ tone: gap > 15 ? 'red' : 'yellow', text: `Atingimento atual abaixo da meta em ${formatNumber(gap, { maximumFractionDigits: 1 })} p.p.` });
    else if (gap < -0.05) out.push({ tone: 'green', text: `Atingimento atual acima da meta em ${formatNumber(-gap, { maximumFractionDigits: 1 })} p.p.` });
  }
  if (!last) out.push({ tone: 'blue', text: 'Sem lançamento no período atual.' });
  else if (last.light === 'RED') out.push({ tone: 'red', text: 'Indicador em status crítico no período atual.' });
  else if (last.light === 'YELLOW') out.push({ tone: 'yellow', text: 'Indicador em atenção no período atual.' });
  else if (last.light === 'GREEN') out.push({ tone: 'green', text: 'Indicador dentro da meta no período atual.' });
  return out;
}

function buildRisks(deviations: DeviationSummary[], last: IndicatorDetail['results'][number] | null): string[] {
  const out: string[] = [];
  const open = deviations.filter((d) => !['CLOSED', 'CLOSED_LATE', 'CANCELLED'].includes(d.status));
  for (const d of open.slice(0, 4)) out.push(`#${d.number} ${d.title}`);
  if (out.length === 0 && last?.light === 'RED') out.push('Resultado fora da meta sem desvio registrado — risco de não tratativa.');
  if (last?.light === 'YELLOW' && out.length < 4) out.push('Tendência de piora caso não haja acompanhamento.');
  return out;
}

function buildPlanStats(actions: NonNullable<IndicatorDetail['actions']>, deviations: DeviationSummary[]) {
  const FINAL = ['DONE', 'DONE_LATE', 'CANCELLED', 'EFFECTIVE', 'INEFFECTIVE'];
  const byId = new Map<string, LinkedAction>();
  for (const a of actions) byId.set(a.id, a);
  for (const d of deviations) for (const a of d.actions ?? []) byId.set(a.id, a);
  const all = Array.from(byId.values());
  const now = Date.now();
  return {
    total: all.length,
    active: all.filter((a) => !FINAL.includes(a.status)).length,
    waiting: all.filter((a) => a.status === 'WAITING_VALIDATION').length,
    overdue: all.filter((a) => a.dueDate && new Date(a.dueDate).getTime() < now && !FINAL.includes(a.status)).length,
  };
}

function RailCard({ icon: Icon, iconClass, title, children }: { icon: typeof Lightbulb; iconClass: string; title: string; children: ReactNode }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Icon className={cn('h-4 w-4', iconClass)} />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function RailEmpty({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function RailLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="mt-3 flex w-full items-center justify-between rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
      {children} <ChevronRight className="h-3.5 w-3.5" />
    </button>
  );
}

function RailLinkTo({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mt-3 flex items-center justify-between rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
      {children} <ChevronRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function RailStat({ label, value, tone }: { label: string; value: number; tone?: 'red' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-semibold', tone === 'red' ? 'text-status-red' : 'text-foreground')}>{value}</span>
    </div>
  );
}

function AnalysisTab({
  series,
  last,
  prev,
  metaValue,
  ppOrUnit,
}: {
  series: SeriesPoint[];
  last: IndicatorDetail['results'][number] | null;
  prev: IndicatorDetail['results'][number] | null;
  metaValue: number | null;
  ppOrUnit: string;
}) {
  const values = series.map((p) => p.value).filter((v): v is number => v !== null);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const best = values.length ? Math.max(...values) : null;
  const worst = values.length ? Math.min(...values) : null;
  const onTarget = series.filter((p) => p.light === 'GREEN').length;
  const delta = last && prev ? last.value - prev.value : null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <AnalysisStat label="Média do período" value={avg !== null ? formatNumber(avg, { maximumFractionDigits: 2 }) : '-'} />
      <AnalysisStat label="Meta" value={metaValue !== null ? formatNumber(metaValue) : '-'} />
      <AnalysisStat label="Períodos no alvo" value={`${onTarget}/${series.length}`} />
      <AnalysisStat label="Melhor resultado" value={best !== null ? formatNumber(best) : '-'} />
      <AnalysisStat label="Pior resultado" value={worst !== null ? formatNumber(worst) : '-'} />
      <AnalysisStat label="Variação último período" value={delta !== null ? `${delta > 0 ? '+' : ''}${formatNumber(delta, { maximumFractionDigits: 2 })} ${ppOrUnit}` : '-'} />
    </div>
  );
}

function AnalysisStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}

function MiniHistory({ results, targets }: { results: IndicatorDetail['results']; targets: IndicatorDetail['targets'] }) {
  const rows = results.slice().reverse().slice(0, 8);
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">Sem lançamentos registrados.</p>;
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const t = targets.find((x) => x.periodRef === r.periodRef);
        return (
          <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs">
            <span className="font-medium">{periodRefLabel(r.periodRef)}</span>
            <span className="text-muted-foreground">Meta {t ? formatNumber(t.target) : '-'} · Real {formatNumber(r.value)}</span>
            <StatusLight light={r.light} />
          </div>
        );
      })}
    </div>
  );
}

function LinkedActionsTab({ actions }: { actions: NonNullable<IndicatorDetail['actions']> }) {
  if (actions.length === 0) return <p className="text-xs text-muted-foreground">Nenhum plano de ação vinculado a este indicador.</p>;
  return (
    <div className="space-y-1.5">
      {actions.map((a) => (
        <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs">
          <Link href={`/actions/${a.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{a.title}</Link>
          <StatusBadge value={a.status} label={ACTION_STATUS_LABEL[a.status] ?? a.status} />
        </div>
      ))}
    </div>
  );
}
