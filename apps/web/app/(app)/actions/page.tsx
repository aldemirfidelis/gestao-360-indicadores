'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CalendarDays, ClipboardList, Columns3, List, Plus, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { ActionPlanCard, type ActionPlanCardData } from '@/components/platform/action-plan-card';
import { EmptyState } from '@/components/platform/empty-state';
import { LoadingState } from '@/components/platform/loading-state';
import { SectionCard } from '@/components/platform/section-card';
import { StatusBadge } from '@/components/platform/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';

interface Action extends ActionPlanCardData {
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'WAITING_THIRD' | 'PAUSED' | 'DONE' | 'DONE_LATE' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

const STATUS_LABEL: Record<Action['status'], string> = {
  NOT_STARTED: 'Nao iniciada',
  IN_PROGRESS: 'Em andamento',
  WAITING_THIRD: 'Aguardando terceiros',
  PAUSED: 'Pausada',
  DONE: 'Concluida',
  DONE_LATE: 'Concluida fora do prazo',
  CANCELLED: 'Cancelada',
};

const COLUMNS: Action['status'][] = ['NOT_STARTED', 'IN_PROGRESS', 'WAITING_THIRD', 'DONE'];

type ViewMode = 'kanban' | 'list' | 'timeline';

export default function ActionsPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<ViewMode>('kanban');

  const query = useQuery<Action[]>({
    queryKey: ['actions'],
    queryFn: () => api<Action[]>('/actions'),
  });

  const actions = useMemo(() => query.data ?? [], [query.data]);
  const byCol = useMemo(() => {
    const map = new Map<Action['status'], Action[]>();
    COLUMNS.forEach((c) => map.set(c, []));
    actions.forEach((a) => {
      if (!map.has(a.status)) map.set(a.status, []);
      map.get(a.status)!.push(a);
    });
    return map;
  }, [actions]);

  const overdue = actions.filter((a) => isOverdue(a)).length;
  const done = actions.filter((a) => ['DONE', 'DONE_LATE'].includes(a.status)).length;
  const critical = actions.filter((a) => a.priority === 'CRITICAL').length;
  const avgProgress = actions.length ? Math.round(actions.reduce((acc, a) => acc + a.progress, 0) / actions.length) : 0;

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Action['status'] }) =>
      api(`/actions/${id}/status`, { method: 'PATCH', json: { status } }),
    onSuccess: () => {
      toast.success('Status atualizado');
      qc.invalidateQueries({ queryKey: ['actions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Lancamentos"
        tone="launch"
        title="Planos de acao"
        description="Gestao operacional de acoes por status, responsavel, prazo, prioridade, progresso e origem."
        breadcrumbs={[{ label: 'Inicio', href: '/' }, { label: 'Lancamentos', href: '/launches' }, { label: 'Planos de acao' }]}
        actions={
          <>
            <div className="inline-flex rounded-lg border bg-card p-1">
              {[
                ['kanban', Columns3, 'Kanban'],
                ['list', List, 'Lista'],
                ['timeline', CalendarDays, 'Cronograma'],
              ].map(([key, Icon, label]) => {
                const I = Icon as typeof Columns3;
                return (
                  <Button
                    key={String(key)}
                    variant={view === key ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setView(key as ViewMode)}
                  >
                    <I className="mr-2 h-4 w-4" />
                    {String(label)}
                  </Button>
                );
              })}
            </div>
            <Button disabled>
              <Plus className="mr-2 h-4 w-4" />
              Nova acao
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Acoes abertas" value={formatNumber(actions.length - done)} description={`${formatNumber(done)} concluidas`} icon={<ClipboardList className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Atrasadas" value={formatNumber(overdue)} description="Prazos vencidos" icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <MetricCard title="Criticas" value={formatNumber(critical)} description="Prioridade critica" icon={<AlertTriangle className="h-4 w-4" />} tone="yellow" />
        <MetricCard title="Progresso medio" value={`${avgProgress}%`} description="Conclusao geral" icon={<ClipboardList className="h-4 w-4" />} tone="green" />
      </div>

      {query.isLoading && <LoadingState />}
      {!query.isLoading && actions.length === 0 && (
        <EmptyState title="Nenhum plano de acao" description="Os planos criados a partir de desvios e indicadores aparecem aqui." />
      )}

      {!query.isLoading && actions.length > 0 && view === 'kanban' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = byCol.get(col) ?? [];
            return (
              <section key={col} className="rounded-lg border bg-muted/45 p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="text-sm font-semibold">{STATUS_LABEL[col]}</span>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                <div className="space-y-3">
                  {items.map((a) => (
                    <div key={a.id} className="space-y-2">
                      <ActionPlanCard action={a} />
                      <div className="flex flex-wrap gap-1">
                        {COLUMNS.filter((s) => s !== a.status).map((s) => (
                          <button
                            key={s}
                            onClick={() => changeStatus.mutate({ id: a.id, status: s })}
                            className="rounded border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            {STATUS_LABEL[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <div className="rounded-lg border border-dashed bg-card/50 p-6 text-center text-xs text-muted-foreground">Sem acoes</div>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {!query.isLoading && actions.length > 0 && view === 'list' && (
        <SectionCard title="Lista de acoes" description="Visao tabular para conferencia e priorizacao." contentClassName="p-0">
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th className="text-left">Acao</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Responsavel</th>
                  <th className="text-left">Prazo</th>
                  <th className="text-left">Prioridade</th>
                  <th className="text-left">Progresso</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/actions/${a.id}`} className="font-medium hover:underline">{a.title}</Link>
                      <div className="text-xs text-muted-foreground">{a.ownerNode?.name ?? a.origin}</div>
                    </td>
                    <td><StatusBadge value={a.status} label={STATUS_LABEL[a.status]} /></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                        {a.responsibleUser?.name ?? 'Sem responsavel'}
                      </div>
                    </td>
                    <td className={cn(isOverdue(a) && 'font-medium text-status-red')}>{formatDate(a.dueDate)}</td>
                    <td><StatusBadge value={a.priority} label={a.priority} /></td>
                    <td>
                      <div className="min-w-32">
                        <div className="mb-1 text-xs font-medium">{a.progress}%</div>
                        <Progress value={a.progress} className="h-1.5" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {!query.isLoading && actions.length > 0 && view === 'timeline' && (
        <SectionCard title="Cronograma de acoes" description="Prazos ordenados para acompanhamento semanal.">
          <div className="space-y-3">
            {actions
              .slice()
              .sort((a, b) => new Date(a.dueDate ?? '2999-12-31').getTime() - new Date(b.dueDate ?? '2999-12-31').getTime())
              .map((a) => (
                <Link key={a.id} href={`/actions/${a.id}`} className="grid gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/35 md:grid-cols-[140px,1fr,160px] md:items-center">
                  <div className={cn('text-sm font-semibold', isOverdue(a) && 'text-status-red')}>{formatDate(a.dueDate)}</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{a.responsibleUser?.name ?? 'Sem responsavel'}</div>
                  </div>
                  <div>
                    <StatusBadge value={a.status} label={STATUS_LABEL[a.status]} />
                  </div>
                </Link>
              ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function isOverdue(action: Action) {
  return Boolean(
    action.dueDate &&
      new Date(action.dueDate) < new Date() &&
      !['DONE', 'DONE_LATE', 'CANCELLED'].includes(action.status),
  );
}
