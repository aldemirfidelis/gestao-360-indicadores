'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  FileBarChart,
  Gauge,
  LayoutDashboard,
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
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { EmptyState } from '@/components/platform/empty-state';
import { Button } from '@/components/ui/button';
import { StatusLight } from '@/components/ui/status-light';
import { api } from '@/lib/api';
import { formatNumber, formatPercent, periodRefLabel } from '@/lib/utils';

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
  indicator: {
    id: string;
    name: string;
    code: string | null;
    ownerNode: { id: string; name: string };
  };
  periodRef: string;
  value: number;
  attainment: number | null;
  deviationPct: number | null;
  light: string;
}

export default function VisualizationPage() {
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
    queryFn: () => api<WorstRow[]>('/dashboard/worst?limit=7'),
  });

  const ov = overview.data;
  const evRows = (evolution.data ?? []).map((e) => ({
    ...e,
    label: periodRefLabel(e.periodRef),
    attainmentPct: e.attainment !== null ? Math.round(e.attainment * 1000) / 10 : null,
    greenPct: e.greenRate !== null ? Math.round(e.greenRate * 1000) / 10 : null,
  }));
  const rankRows = (ranking.data ?? []).map((r) => ({
    ...r,
    attainmentPct: r.attainment !== null ? Math.round(r.attainment * 1000) / 10 : 0,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Visualização"
        tone="view"
        title="Dashboard Executivo Gestão 360"
        description="Panorama de desempenho, farois, planos de ação, rankings e alertas para tomada de decisão."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/reports">
                <FileBarChart className="mr-2 h-4 w-4" />
                Relatorios
              </Link>
            </Button>
            <Button asChild>
              <Link href="/reports">
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Link>
            </Button>
          </>
        }
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Visualização' }]}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Desempenho geral"
          value={formatPercent(ov?.generalAttainment)}
          description="Atingimento médio"
          icon={<Gauge className="h-4 w-4" />}
          tone="blue"
        />
        <MetricCard
          title="Dentro da meta"
          value={formatNumber(ov?.counts.GREEN)}
          description="Indicadores verdes"
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="green"
          href="/indicators"
        />
        <MetricCard
          title="Fora da meta"
          value={formatNumber(ov?.counts.RED)}
          description="Indicadores vermelhos"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="red"
          href="/indicators"
        />
        <MetricCard
          title="Planos em aberto"
          value={formatNumber(ov?.openActions)}
          description={`${formatNumber(ov?.overdueActions)} atrasados`}
          icon={<ListChecks className="h-4 w-4" />}
          tone="purple"
          href="/actions"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr,0.8fr]">
        <SectionCard title="Evolução mensal dos indicadores" description="Atingimento médio e taxa de farol verde.">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evRows}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit="%" />
                <Tooltip
                  formatter={(v: number) => `${v}%`}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Line type="monotone" dataKey="attainmentPct" name="Atingimento" stroke="hsl(var(--status-blue))" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="greenPct" name="Farol verde" stroke="hsl(var(--status-green))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Indicadores críticos" description="Itens com maior desvio no período.">
          {worst.data && worst.data.length === 0 && (
            <EmptyState title="Nenhum indicador crítico" description="Os alertas de desempenho aparecem nesta lista." className="border-0 bg-transparent" />
          )}
          <div className="space-y-3">
            {worst.data?.map((w) => (
              <Link key={`${w.indicator.id}-${w.periodRef}`} href={`/indicators/${w.indicator.id}`} className="flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/35">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{w.indicator.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{w.indicator.ownerNode.name} - {periodRefLabel(w.periodRef)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <StatusLight light={w.light} />
                  <div className="mt-1 text-xs text-muted-foreground">
                    {w.deviationPct !== null ? `${w.deviationPct > 0 ? '+' : ''}${formatNumber(w.deviationPct, { maximumFractionDigits: 1 })}%` : '-'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr,360px]">
        <SectionCard title="Ranking de áreas" description="Atingimento médio por estrutura organizacional.">
          <div className="h-80">
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
          </div>
        </SectionCard>

        <SectionCard title="Farois consolidados" description="Distribuição atual por status.">
          <div className="space-y-4">
            {[
              ['GREEN', 'Dentro da meta', ov?.counts.GREEN ?? 0],
              ['YELLOW', 'Atenção', ov?.counts.YELLOW ?? 0],
              ['RED', 'Fora da meta', ov?.counts.RED ?? 0],
              ['GRAY', 'Sem lançamento', ov?.counts.GRAY ?? 0],
            ].map(([light, label, value]) => (
              <div key={light} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <StatusLight light={String(light)} />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <span className="text-lg font-semibold">{formatNumber(Number(value))}</span>
              </div>
            ))}
          </div>
          <Button className="mt-4 w-full" variant="outline" asChild>
            <Link href="/indicators">
              <BarChart3 className="mr-2 h-4 w-4" />
              Abrir indicadores
            </Link>
          </Button>
        </SectionCard>
      </div>
    </div>
  );
}
