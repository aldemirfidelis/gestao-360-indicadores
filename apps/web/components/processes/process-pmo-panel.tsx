'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { Stat } from '@/components/projects/project-costs';
import { PMO_CLASS, PMO_LABEL, formatDay, formatMoney, type PmoStatus } from '@/components/projects/types';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface PmoFigures {
  projects: number;
  active: number;
  done: number;
  avgProgress: number | null;
  expectedProgress: number | null;
  critical: number;
  atRisk: number;
  tasksOverdue: number;
  milestonesOverdue: number;
  openRisks: number;
  openIssues: number;
  budget: number;
  actualCost: number;
  pmoStatus: PmoStatus | null;
  nextMilestone: { name: string; dueDate: string; project: { id: string; code: string | null; name: string } } | null;
}

export interface ProcessPmoRow extends PmoFigures {
  process: {
    id: string;
    number: number;
    code: string | null;
    name: string;
    status: string;
    orgNode: { id: string; name: string } | null;
    owner: { id: string; name: string } | null;
  };
}

export type ProcessPmo =
  | { available: false; canCreate: boolean }
  | { available: true; canCreate: boolean; totals: PmoFigures & { processes: number; withProjects: number; hiddenProjects: number }; processes: ProcessPmoRow[] };

/** Painel PMO dos processos visíveis; sem acesso ao módulo Projetos, nada é exibido. */
export function useProcessPmo() {
  const { hasPermission } = useAuth();
  return useQuery<ProcessPmo>({
    queryKey: ['processes', 'pmo'],
    queryFn: () => api<ProcessPmo>('/processes/governance/pmo'),
    enabled: hasPermission(['processes:view']) && hasPermission(['projects:view']),
    staleTime: 30_000,
  });
}

export function ProcessPmoPanel() {
  const query = useProcessPmo();
  if (query.isError) return <p className="text-xs text-muted-foreground">Painel de projetos de melhoria indisponível no momento.</p>;
  if (!query.data) return null;
  const data = query.data;
  if (!data.available) return null;
  const { totals } = data;
  const pending = totals.tasksOverdue + totals.milestonesOverdue;

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><FolderKanban className="h-4 w-4" /> Melhoria de processos (PMO)</h2>
          <p className="text-xs text-muted-foreground">
            Projetos vinculados aos processos: avanço, prazos, custos e riscos. Abra um processo para ver o Gantt, a curva S, os marcos e as tarefas.
          </p>
        </div>
        <Link href="/projects/cronograma" className="text-sm text-primary hover:underline">Portfólio completo de projetos</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Processos com projetos" value={`${totals.withProjects}/${totals.processes}`} />
        <Stat label="Projetos ativos" value={String(totals.active)} hint={`${totals.projects} vinculado(s) · ${totals.done} concluído(s)`} />
        <Stat
          label="Avanço médio"
          value={totals.avgProgress === null ? '—' : `${totals.avgProgress}%`}
          hint={totals.expectedProgress === null ? undefined : `Planejado ${totals.expectedProgress}%`}
        />
        <Stat label="Críticos" value={String(totals.critical)} hint={`${totals.atRisk} em risco`} tone={totals.critical > 0 ? 'text-status-red' : undefined} />
        <Stat
          label="Pendências vencidas"
          value={String(pending)}
          hint={`${totals.tasksOverdue} tarefa(s) · ${totals.milestonesOverdue} marco(s)`}
          tone={pending > 0 ? 'text-status-red' : undefined}
        />
        <Stat
          label="Orçamento"
          value={formatMoney(totals.budget)}
          hint={`Realizado ${formatMoney(totals.actualCost)}`}
          tone={totals.actualCost > totals.budget && totals.budget > 0 ? 'text-status-red' : undefined}
        />
      </div>

      {data.processes.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Nenhum processo tem projeto de melhoria vinculado. Abra um processo e use a aba “Melhoria (PMO)” para criar ou vincular projetos.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase text-muted-foreground">
                <th className="px-3 py-2 font-medium">Processo</th>
                <th className="px-3 py-2 font-medium">Projetos</th>
                <th className="w-40 px-3 py-2 font-medium">Avanço</th>
                <th className="px-3 py-2 font-medium">Situação</th>
                <th className="px-3 py-2 font-medium">Pendências</th>
                <th className="px-3 py-2 font-medium">Próximo marco</th>
                <th className="px-3 py-2 text-right font-medium">Orçamento</th>
              </tr>
            </thead>
            <tbody>
              {data.processes.map((row) => (
                <tr key={row.process.id} className="border-b align-top last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/processes/${row.process.id}?tab=pmo`} className="font-medium text-primary hover:underline">
                      {row.process.code ? `${row.process.code} - ` : ''}{row.process.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{[row.process.orgNode?.name, row.process.owner?.name].filter(Boolean).join(' · ') || 'Processo geral'}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{row.active} ativo(s) de {row.projects}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Progress value={row.avgProgress ?? 0} className="h-1.5" />
                      <span className="w-9 text-right text-xs tabular-nums">{row.avgProgress ?? 0}%</span>
                    </div>
                    {row.expectedProgress !== null && <div className="mt-0.5 text-[11px] text-muted-foreground">Planejado {row.expectedProgress}%</div>}
                  </td>
                  <td className="px-3 py-2">
                    {row.pmoStatus ? <span className={cn('pill text-[10px]', PMO_CLASS[row.pmoStatus])}>{PMO_LABEL[row.pmoStatus]}</span> : '—'}
                    {row.critical + row.atRisk > 0 && <div className="mt-0.5 text-[11px] text-muted-foreground">{row.critical} crítico(s) · {row.atRisk} em risco</div>}
                  </td>
                  <td className={cn('px-3 py-2 text-xs', row.tasksOverdue + row.milestonesOverdue > 0 && 'font-semibold text-status-red')}>
                    {row.tasksOverdue} tarefa(s) · {row.milestonesOverdue} marco(s)
                    {row.openIssues > 0 && <div>{row.openIssues} impedimento(s)</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {row.nextMilestone ? (
                      <>
                        <div className="font-medium">{row.nextMilestone.name}</div>
                        <div className="text-muted-foreground">{formatDay(row.nextMilestone.dueDate)} · {row.nextMilestone.project.name}</div>
                      </>
                    ) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums">
                    <div>{formatMoney(row.budget)}</div>
                    <div className={cn('text-muted-foreground', row.budget > 0 && row.actualCost > row.budget && 'font-semibold text-status-red')}>
                      Realizado {formatMoney(row.actualCost)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totals.hiddenProjects > 0 && (
        <p className="text-xs text-muted-foreground">{totals.hiddenProjects} projeto(s) vinculado(s) a processos ficam fora deste painel por restrição de área no módulo Projetos.</p>
      )}
    </section>
  );
}
