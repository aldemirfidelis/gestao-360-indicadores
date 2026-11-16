'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BarChart3, FolderKanban, Link2, Plus } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { ConfirmDialog } from '@/components/platform/confirm-dialog';
import { EmptyState } from '@/components/platform/empty-state';
import { Stat } from '@/components/projects/project-costs';
import { ProjectFormDialog } from '@/components/projects/project-form-dialog';
import { PortfolioAgenda, PortfolioCurveCard, usePortfolioExecution } from '@/components/projects/portfolio-execution';
import { PortfolioGantt } from '@/components/projects/portfolio-gantt';
import {
  PMO_CLASS,
  PMO_LABEL,
  STATUS_LABEL,
  STATUS_PILL,
  formatDay,
  formatMoney,
  isOverdue,
  type PortfolioSummary,
  type ProjectSummary,
} from '@/components/projects/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { EntityPicker } from './entity-picker';
import type { ProcessContext } from './types';

type Integration = ProcessContext['integrations'][number];

/**
 * PMO integrado ao processo: os projetos de melhoria são projetos do módulo Projetos
 * vinculados a este processo, com portfólio, Gantt, curva S, marcos e tarefas.
 */
export function ProcessImprovement({
  context,
  canEditProcess,
  onLinksChanged,
  onOpenLinks,
}: {
  context: ProcessContext;
  /** Pode alterar o processo (permissão, fora da demonstração e processo não arquivado). */
  canEditProcess: boolean;
  onLinksChanged: () => void;
  /** Abre a aba de registros relacionados, onde ficam os vínculos por atividade. */
  onOpenLinks: () => void;
}) {
  const processId = context.process.id;
  const qc = useQueryClient();
  const { user, hasPermission } = useAuth();
  const canView = hasPermission(['projects:view']);
  const canCreate = canEditProcess && !user?.isDemo && hasPermission(['projects:create']);
  const canEditProjects = !user?.isDemo && hasPermission(['projects:update']);
  const [createOpen, setCreateOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [toUnlink, setToUnlink] = useState<{ integration: Integration; name: string } | null>(null);

  const filter = { processId };
  const list = useQuery<ProjectSummary[]>({
    queryKey: ['projects', filter],
    queryFn: () => api<ProjectSummary[]>(`/projects?processId=${encodeURIComponent(processId)}`),
    enabled: canView,
  });
  const portfolio = useQuery<PortfolioSummary>({
    queryKey: ['projects', 'portfolio', filter],
    queryFn: () => api<PortfolioSummary>(`/projects/portfolio?processId=${encodeURIComponent(processId)}`),
    enabled: canView,
  });
  const execution = usePortfolioExecution(filter, canView);

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['projects'] });
    qc.invalidateQueries({ queryKey: ['processes', 'pmo'] });
    onLinksChanged();
  };

  const unlink = useMutation({
    mutationFn: (integrationId: string) => api(`/processes/governance/integrations/${integrationId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Projeto desvinculado do processo. O projeto continua no portfólio.');
      refreshAll();
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível desvincular o projeto.'),
  });

  if (!canView) {
    return (
      <EmptyState
        icon={<FolderKanban className="h-5 w-5" strokeWidth={1.5} />}
        title="Sem acesso ao módulo Projetos"
        description="Os projetos de melhoria usam o módulo Projetos. Peça acesso de consulta a projetos para acompanhar o portfólio deste processo."
      />
    );
  }

  const projects = list.data ?? [];
  const summary = portfolio.data;
  const linksByProject = new Map<string, Integration[]>();
  for (const link of context.integrations) {
    if (link.type !== 'PROJECT') continue;
    linksByProject.set(link.target.id, [...(linksByProject.get(link.target.id) ?? []), link]);
  }
  const critical = projects.filter((project) => project.pmoStatus === 'CRITICAL').length;
  const atRisk = projects.filter((project) => project.pmoStatus === 'AT_RISK').length;
  const done = projects.filter((project) => project.status === 'DONE').length;

  const actions = (
    <div className="flex flex-wrap gap-2">
      {canEditProcess && (
        <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
          <Link2 className="mr-2 h-4 w-4" /> Vincular projeto existente
        </Button>
      )}
      {canCreate && (
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Novo projeto de melhoria
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="font-semibold">Projetos de melhoria (PMO)</h2>
          <p className="text-sm text-muted-foreground">
            Portfólio dos projetos que melhoram este processo, com cronograma Gantt, curva S de avanço, marcos e tarefas.
            Os projetos ficam no módulo Projetos; aqui você acompanha e cria já vinculado.
          </p>
        </div>
        {actions}
      </div>

      {list.isLoading && <p className="text-sm text-muted-foreground">Carregando projetos de melhoria...</p>}
      {list.isError && (
        <div role="alert" className="space-y-2 rounded-lg border border-status-red/30 p-4 text-sm">
          <p>Não foi possível carregar os projetos de melhoria: {list.error.message}</p>
          <Button variant="outline" size="sm" onClick={() => list.refetch()}>Tentar novamente</Button>
        </div>
      )}

      {!list.isLoading && !list.isError && projects.length === 0 && (
        <EmptyState
          icon={<FolderKanban className="h-5 w-5" strokeWidth={1.5} />}
          title="Nenhum projeto de melhoria vinculado"
          description={canEditProcess
            ? 'Crie um projeto já vinculado a este processo ou vincule um projeto que já existe no portfólio.'
            : 'Quando houver projetos vinculados a este processo, o portfólio, o Gantt e a curva S aparecem aqui.'}
          action={canEditProcess ? actions : undefined}
        />
      )}

      {projects.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Stat label="Projetos ativos" value={String(summary?.activeProjects ?? 0)} hint={`${projects.length} vinculado(s) · ${done} concluído(s)`} />
            <Stat
              label="Avanço médio"
              value={`${summary?.avgProgress ?? 0}%`}
              hint={execution.data?.curve.expectedProgress != null ? `Planejado até hoje: ${execution.data.curve.expectedProgress}%` : undefined}
            />
            <Stat label="Críticos" value={String(critical)} hint={`${atRisk} em risco`} tone={critical > 0 ? 'text-status-red' : undefined} />
            <Stat
              label="Pendências vencidas"
              value={String((summary?.tasksOverdue ?? 0) + (summary?.milestonesOverdue ?? 0))}
              hint={`${summary?.tasksOverdue ?? 0} tarefa(s) · ${summary?.milestonesOverdue ?? 0} marco(s)`}
              tone={(summary?.tasksOverdue ?? 0) + (summary?.milestonesOverdue ?? 0) > 0 ? 'text-status-red' : undefined}
            />
            <Stat
              label="Orçamento"
              value={formatMoney(summary?.budgetTotal ?? 0)}
              hint={`Realizado ${formatMoney(summary?.actualCost ?? 0)}`}
              tone={(summary?.overBudget ?? 0) > 0 ? 'text-status-red' : undefined}
            />
            <Stat
              label="Riscos abertos"
              value={String((summary?.openRisks ?? 0) + (summary?.openIssues ?? 0))}
              hint={`${summary?.openIssues ?? 0} impedimento(s)`}
              tone={(summary?.openIssues ?? 0) > 0 ? 'text-status-red' : undefined}
            />
          </div>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FolderKanban className="h-4 w-4" /> Portfólio do processo</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Projeto</th>
                    <th className="px-3 py-2 font-medium">Situação</th>
                    <th className="w-44 px-3 py-2 font-medium">Avanço</th>
                    <th className="px-3 py-2 font-medium">Prazo</th>
                    <th className="px-3 py-2 font-medium">Gerente</th>
                    <th className="px-3 py-2 text-right font-medium">Orçamento</th>
                    <th className="px-4 py-2 text-right font-medium">Vínculo</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => {
                    const links = linksByProject.get(project.id) ?? [];
                    const direct = links.length === 1 && !links[0].activityId && !links[0].artifactId ? links[0] : null;
                    const late = project.status !== 'DONE' && project.status !== 'CANCELLED' && isOverdue(project.endsAt);
                    return (
                      <tr key={project.id} className="border-b align-top last:border-0">
                        <td className="px-4 py-2">
                          <Link href={`/projects/${project.id}`} className="font-medium text-primary hover:underline">{project.name}</Link>
                          <div className="text-xs text-muted-foreground">{[project.code, project.category].filter(Boolean).join(' · ') || '—'}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col items-start gap-1">
                            <span className={cn('pill text-[10px]', STATUS_PILL[project.status])}>{STATUS_LABEL[project.status]}</span>
                            <span className={cn('pill text-[10px]', PMO_CLASS[project.pmoStatus])}>{PMO_LABEL[project.pmoStatus]}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Progress value={project.progressOverall} className="h-1.5" />
                            <span className="w-9 text-right text-xs tabular-nums">{project.progressOverall}%</span>
                          </div>
                          {project.expectedProgress !== null && (
                            <div className="mt-0.5 text-[11px] text-muted-foreground">Planejado {project.expectedProgress}%</div>
                          )}
                        </td>
                        <td className={cn('whitespace-nowrap px-3 py-2 text-xs', late && 'font-semibold text-status-red')}>
                          {formatDay(project.startsAt)} a {formatDay(project.endsAt)}
                        </td>
                        <td className="px-3 py-2 text-xs">{project.responsible ?? '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums">
                          <div>{formatMoney(project.budget)}</div>
                          <div className={cn('text-muted-foreground', project.finance?.overBudget && 'font-semibold text-status-red')}>
                            Realizado {formatMoney(project.finance?.actualCost ?? 0)}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {direct && canEditProcess ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={unlink.isPending}
                              onClick={() => setToUnlink({ integration: direct, name: project.name })}
                            >
                              Desvincular
                            </Button>
                          ) : links.some((link) => link.activityId || link.artifactId) ? (
                            <button type="button" onClick={onOpenLinks} className="text-xs text-primary hover:underline">
                              Vínculo pelo BPMN, SIPOC ou RACI
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Processo</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Cronograma dos projetos (Gantt)</CardTitle></CardHeader>
            <CardContent>
              <PortfolioGantt projects={projects} />
            </CardContent>
          </Card>

          {execution.isError && (
            <p role="alert" className="text-sm text-muted-foreground">Não foi possível carregar a curva S e a agenda: {execution.error.message}</p>
          )}
          {execution.data && (
            <>
              <PortfolioCurveCard curve={execution.data.curve} title="Curva S da melhoria do processo" fileName="curva-s-melhoria-processo.csv" />
              <PortfolioAgenda data={execution.data} canEdit={canEditProjects} />
            </>
          )}
        </>
      )}

      {canCreate && (
        <ProjectFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          title="Novo projeto de melhoria"
          createPath={`/processes/${processId}/projects`}
          defaults={{ category: 'Melhoria de processo', indicatorId: context.process.indicatorId ?? '' }}
          onSaved={refreshAll}
        />
      )}
      <LinkProjectDialog open={linkOpen} onOpenChange={setLinkOpen} processId={processId} onLinked={refreshAll} />
      <ConfirmDialog
        open={Boolean(toUnlink)}
        onOpenChange={(open) => !open && setToUnlink(null)}
        title="Desvincular projeto"
        description={toUnlink ? `“${toUnlink.name}” deixa de ser projeto de melhoria deste processo. O projeto, o cronograma e o histórico continuam no módulo Projetos.` : undefined}
        confirmLabel="Desvincular"
        onConfirm={async () => {
          if (toUnlink) await unlink.mutateAsync(toUnlink.integration.id).catch(() => undefined);
        }}
      />
    </div>
  );
}

function LinkProjectDialog({
  open,
  onOpenChange,
  processId,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processId: string;
  onLinked: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const link = useMutation({
    mutationFn: () => api(`/processes/${processId}/integrations`, { method: 'POST', json: { type: 'PROJECT', targetId: selected[0] } }),
    onSuccess: () => {
      toast.success('Projeto vinculado ao processo');
      setSelected([]);
      onOpenChange(false);
      onLinked();
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível vincular o projeto.'),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!link.isPending) { onOpenChange(next); if (!next) setSelected([]); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular projeto existente</DialogTitle>
          <DialogDescription>
            O projeto passa a fazer parte do portfólio de melhoria deste processo. Nada muda no cadastro do projeto.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Projeto</Label>
          <EntityPicker type="PROJECT" label="Projeto" selected={selected} onChange={setSelected} multiple={false} />
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={link.isPending} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!selected[0] || link.isPending} onClick={() => link.mutate()}>
            {link.isPending ? 'Vinculando...' : 'Vincular'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
