'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  LayoutDashboard,
  LineChart,
  Target,
  Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { productAreas } from '@/components/shell/navigation';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { StatusBadge } from '@/components/platform/status-badge';
import { Button } from '@/components/ui/button';
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

interface Pending {
  periodRef: string;
  total: number;
  filled: number;
  pending: number;
}

interface WorstRow {
  indicator: {
    id: string;
    name: string;
    code: string | null;
    ownerNode: { id: string; name: string };
  };
  periodRef: string;
  deviationPct: number | null;
  light: string;
}

export default function HomePage() {
  const overview = useQuery<Overview>({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => api<Overview>('/dashboard/overview'),
  });
  const pending = useQuery<Pending>({
    queryKey: ['dashboard', 'pending'],
    queryFn: () => api<Pending>('/dashboard/pending'),
  });
  const worst = useQuery<WorstRow[]>({
    queryKey: ['dashboard', 'worst'],
    queryFn: () => api<WorstRow[]>('/dashboard/worst?limit=5'),
  });

  const ov = overview.data;

  return (
    <div>
      <PageHeader
        eyebrow="Inicio"
        title="Visao geral do Gestao 360"
        description="Resumo executivo, pendencias operacionais e atalhos para lancar dados ou analisar desempenho."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/launches">
                <Zap className="mr-2 h-4 w-4" />
                Lancamentos
              </Link>
            </Button>
            <Button asChild>
              <Link href="/visualization">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Visualizacao
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {productAreas.map((area) => {
          const Icon = area.icon;
          return (
            <Link key={area.href} href={area.href} className="panel panel-hover flex items-start gap-4 p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">{area.title}</h2>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{area.description}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Indicadores ativos"
          value={formatNumber(ov?.totalIndicators)}
          description={`${formatPercent(ov?.generalAttainment)} de atingimento`}
          icon={<Target className="h-4 w-4" />}
          tone="blue"
          href="/indicators"
        />
        <MetricCard
          title="Dentro da meta"
          value={formatNumber(ov?.counts.GREEN)}
          description="Farois verdes"
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="green"
          href="/visualization"
        />
        <MetricCard
          title="Criticos"
          value={formatNumber((ov?.counts.RED ?? 0) + (ov?.criticalDeviations ?? 0))}
          description="Indicadores e desvios"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="red"
          href="/visualization"
        />
        <MetricCard
          title="Pendencias"
          value={formatNumber((pending.data?.pending ?? 0) + (ov?.overdueActions ?? 0))}
          description="Lancamentos e acoes"
          icon={<ClipboardList className="h-4 w-4" />}
          tone="yellow"
          href="/launches"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,380px]">
        <SectionCard title="Atalhos rapidos" description="Acoes frequentes da rotina corporativa." contentClassName="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            { href: '/results', label: 'Lancar resultado', icon: LineChart, tone: 'blue' },
            { href: '/indicators/new', label: 'Cadastrar indicador', icon: Target, tone: 'green' },
            { href: '/actions', label: 'Planos de acao', icon: ClipboardList, tone: 'purple' },
            { href: '/reports', label: 'Exportar relatorio', icon: LayoutDashboard, tone: 'yellow' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Button key={item.href} variant="outline" className="h-14 justify-start gap-3 bg-background" asChild>
                <Link href={item.href}>
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-muted">
                    <Icon className="h-4 w-4" />
                  </span>
                  {item.label}
                </Link>
              </Button>
            );
          })}
        </SectionCard>

        <SectionCard title="Alertas importantes" description="Itens que merecem acompanhamento.">
          <div className="mb-4 rounded-lg border bg-muted/35 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Lancamentos pendentes</div>
                <div className="text-xs text-muted-foreground">
                  {pending.data ? periodRefLabel(pending.data.periodRef) : 'Periodo atual'}
                </div>
              </div>
              <div className="text-2xl font-semibold">{formatNumber(pending.data?.pending)}</div>
            </div>
          </div>
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
                <StatusBadge value={w.light} label={w.light === 'RED' ? 'Critico' : w.light} />
              </Link>
            ))}
            {!worst.isLoading && (worst.data?.length ?? 0) === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                Nenhum alerta critico no momento.
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
