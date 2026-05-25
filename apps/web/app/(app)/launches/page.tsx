'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  FileUp,
  FolderKanban,
  LineChart,
  Plus,
  Target,
  UsersRound,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { EmptyState } from '@/components/platform/empty-state';
import { LoadingState } from '@/components/platform/loading-state';
import { StatusBadge } from '@/components/platform/status-badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatDate, formatNumber, periodRefLabel } from '@/lib/utils';

interface Overview {
  totalIndicators: number;
  counts: { GREEN: number; YELLOW: number; RED: number; GRAY: number };
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

interface ActionRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  responsibleUser: { id: string; name: string } | null;
  ownerNode: { id: string; name: string } | null;
}

const launchCards = [
  {
    title: 'Cadastro de Indicadores',
    description: 'KPIs, metas, áreas, formulas e responsáveis.',
    href: '/indicators/new',
    icon: Target,
    action: 'Novo indicador',
  },
  {
    title: 'Resultado de Indicadores',
    description: 'Realizado mensal, farol automático e desvios.',
    href: '/results',
    icon: LineChart,
    action: 'Lancar resultado',
  },
  {
    title: 'Planos de Ação',
    description: 'Prazos, prioridades, progresso e evidencias.',
    href: '/actions',
    icon: ClipboardList,
    action: 'Abrir planos',
  },
  {
    title: 'Não Conformidades',
    description: 'FCA, causas, tratativas e responsáveis.',
    href: '/deviations',
    icon: AlertTriangle,
    action: 'Analisar desvios',
  },
  {
    title: 'Projetos e Cronogramas',
    description: 'Marcos, tarefas, prazos e execucao.',
    href: '/projects',
    icon: FolderKanban,
    action: 'Ver projetos',
  },
  {
    title: 'Arquivos e Evidencias',
    description: 'Uploads, CSV, modelos e histórico.',
    href: '/imports',
    icon: FileUp,
    action: 'Enviar arquivo',
  },
];

export default function LaunchesPage() {
  const overview = useQuery<Overview>({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => api<Overview>('/dashboard/overview'),
  });
  const pending = useQuery<Pending>({
    queryKey: ['dashboard', 'pending'],
    queryFn: () => api<Pending>('/dashboard/pending'),
  });
  const actions = useQuery<ActionRow[]>({
    queryKey: ['actions'],
    queryFn: () => api<ActionRow[]>('/actions'),
  });

  const overdue = (actions.data ?? [])
    .filter((a) => a.dueDate && new Date(a.dueDate) < new Date() && !['DONE', 'DONE_LATE', 'CANCELLED'].includes(a.status))
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        eyebrow="Lançamentos"
        tone="launch"
        title="Central operacional"
        description="Cadastros, alimentacao de resultados, registros de ações, evidencias e rotinas de execucao."
        actions={
          <Button asChild>
            <Link href="/results">
              <Plus className="mr-2 h-4 w-4" />
              Novo lançamento
            </Link>
          </Button>
        }
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Lançamentos' }]}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Indicadores ativos"
          value={formatNumber(overview.data?.totalIndicators)}
          description="Base operacional"
          icon={<Target className="h-4 w-4" />}
          tone="blue"
          href="/indicators/new"
        />
        <MetricCard
          title="Resultados pendentes"
          value={formatNumber(pending.data?.pending)}
          description={pending.data ? periodRefLabel(pending.data.periodRef) : 'Período atual'}
          icon={<CalendarClock className="h-4 w-4" />}
          tone="yellow"
          href="/results"
        />
        <MetricCard
          title="Ações abertas"
          value={formatNumber(overview.data?.openActions)}
          description="Em execucao"
          icon={<ClipboardList className="h-4 w-4" />}
          tone="purple"
          href="/actions"
        />
        <MetricCard
          title="Ações atrasadas"
          value={formatNumber(overview.data?.overdueActions)}
          description="Requerem tratativa"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="red"
          href="/actions"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,360px]">
        <SectionCard title="Rotinas de lançamento" description="Fluxos mais usados pela operação." contentClassName="p-0">
          <div className="grid grid-cols-1 divide-y md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3">
            {launchCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.href} href={card.href} className="group p-5 transition-colors hover:bg-accent/35">
                  <div className="flex h-full flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-status-blue/10 text-status-blue">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        {card.action}
                      </span>
                    </div>
                    <h3 className="mt-4 text-sm font-semibold">{card.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="Fila operacional"
          description="Prazos vencidos e pendências abertas."
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link href="/actions">Ver tudo</Link>
            </Button>
          }
        >
          {actions.isLoading && <LoadingState className="min-h-56 border-0" />}
          {!actions.isLoading && overdue.length === 0 && (
            <EmptyState
              title="Nenhum prazo vencido"
              description="As pendências críticas aparecem aqui quando exigem ação."
              className="border-0 bg-transparent py-8"
            />
          )}
          <div className="space-y-3">
            {overdue.map((a) => (
              <Link key={a.id} href={`/actions/${a.id}`} className="block rounded-lg border p-3 transition-colors hover:bg-accent/35">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{a.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <UsersRound className="h-3.5 w-3.5" />
                      <span className="truncate">{a.responsibleUser?.name ?? 'Sem responsável'}</span>
                    </div>
                  </div>
                  <StatusBadge value={a.priority} label={a.priority} />
                </div>
                <div className="mt-2 text-xs font-medium text-status-red">Prazo: {formatDate(a.dueDate)}</div>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
