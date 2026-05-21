'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Activity,
  CheckCircle2,
  Clock,
  ListChecks,
  Target,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shell/page-header';
import { StatusLight } from '@/components/ui/status-light';
import { api } from '@/lib/api';
import { cn, formatNumber, formatPercent, periodRefLabel } from '@/lib/utils';

interface Overview {
  totalIndicators: number;
  counts: { GREEN: number; YELLOW: number; RED: number; GRAY: number };
  generalAttainment: number | null;
  openActions: number;
  overdueActions: number;
  criticalDeviations: number;
}

interface RankingRow {
  nodeId: string;
  nodeName: string;
  attainment: number | null;
  green: number;
  yellow: number;
  red: number;
  gray: number;
}

interface EvolutionRow {
  periodRef: string;
  attainment: number | null;
  greenRate: number | null;
  total: number;
}

interface WorstRow {
  indicator: { id: string; name: string; code: string | null; unit: string; unitLabel: string | null; ownerNode: { id: string; name: string } };
  periodRef: string;
  value: number;
  attainment: number | null;
  deviationPct: number | null;
  light: string;
}

export default function DashboardPage() {
  const overview = useQuery<Overview>({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => api<Overview>('/dashboard/overview'),
  });
  const ranking = useQuery<RankingRow[]>({
    queryKey: ['dashboard', 'ranking'],
    queryFn: () => api<RankingRow[]>('/dashboard/ranking?limit=8'),
  });
  const evolution = useQuery<EvolutionRow[]>({
    queryKey: ['dashboard', 'evolution'],
    queryFn: () => api<EvolutionRow[]>('/dashboard/evolution?months=12'),
  });
  const worst = useQuery<WorstRow[]>({
    queryKey: ['dashboard', 'worst'],
    queryFn: () => api<WorstRow[]>('/dashboard/worst?limit=6'),
  });
  const pending = useQuery<{ periodRef: string; total: number; filled: number; pending: number }>({
    queryKey: ['dashboard', 'pending'],
    queryFn: () => api('/dashboard/pending'),
  });

  const ov = overview.data;
  const evRows = (evolution.data ?? []).map((e) => ({
    ...e,
    attainmentPct: e.attainment !== null ? Math.round(e.attainment * 1000) / 10 : null,
    label: periodRefLabel(e.periodRef),
  }));

  const rankRows = (ranking.data ?? []).map((r) => ({
    ...r,
    attainmentPct: r.attainment !== null ? Math.round(r.attainment * 1000) / 10 : 0,
  }));

  return (
    <div>
      <PageHeader
        title="Dashboard Executivo"
        description="Visao geral dos indicadores, acoes e desvios da operacao."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={<Target className="h-4 w-4" />}
          label="Indicadores ativos"
          value={formatNumber(ov?.totalIndicators)}
          hint={ov ? `${formatPercent(ov.generalAttainment)} atingimento medio` : '—'}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4 text-status-green" />}
          label="No alvo"
          value={formatNumber(ov?.counts.GREEN)}
          accent="green"
        />
        <KpiCard
          icon={<Activity className="h-4 w-4 text-status-yellow" />}
          label="Em atencao"
          value={formatNumber(ov?.counts.YELLOW)}
          accent="yellow"
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4 text-status-red" />}
          label="Criticos"
          value={formatNumber(ov?.counts.RED)}
          accent="red"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={<ListChecks className="h-4 w-4" />}
          label="Acoes abertas"
          value={formatNumber(ov?.openActions)}
        />
        <KpiCard
          icon={<Clock className="h-4 w-4 text-status-red" />}
          label="Acoes atrasadas"
          value={formatNumber(ov?.overdueActions)}
          accent="red"
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4 text-status-red" />}
          label="Desvios criticos"
          value={formatNumber(ov?.criticalDeviations)}
          accent="red"
        />
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label="Lancamentos pendentes"
          value={formatNumber(pending.data?.pending)}
          hint={pending.data ? `${pending.data.filled}/${pending.data.total} preenchidos em ${periodRefLabel(pending.data.periodRef)}` : '—'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evolucao do atingimento (12m)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evRows}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit="%" />
                <Tooltip
                  formatter={(v: number) => `${v}%`}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Line
                  type="monotone"
                  dataKey="attainmentPct"
                  stroke="hsl(var(--status-blue))"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Indicadores mais criticos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {worst.data && worst.data.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum indicador critico no momento.</p>
            )}
            {worst.data?.map((w) => (
              <div key={w.indicator.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{w.indicator.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {w.indicator.ownerNode.name} - {periodRefLabel(w.periodRef)}
                  </div>
                </div>
                <div className="text-right">
                  <StatusLight light={w.light} />
                  {w.deviationPct !== null && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {w.deviationPct > 0 ? '+' : ''}
                      {formatNumber(w.deviationPct, { maximumFractionDigits: 1 })}%
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ranking de areas por atingimento</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rankRows} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tick={{ fontSize: 12 }} unit="%" />
              <YAxis type="category" dataKey="nodeName" width={150} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v: number) => `${v}%`}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              />
              <Bar dataKey="attainmentPct" fill="hsl(var(--status-blue))" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: 'green' | 'yellow' | 'red';
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
          <span
            className={cn(
              'grid place-items-center h-7 w-7 rounded-md bg-muted text-muted-foreground',
              accent === 'green' && 'bg-status-green/15 text-status-green',
              accent === 'yellow' && 'bg-status-yellow/15 text-status-yellow',
              accent === 'red' && 'bg-status-red/15 text-status-red',
            )}
          >
            {icon}
          </span>
        </div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}
