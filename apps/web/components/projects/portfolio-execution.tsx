'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Flag, ListChecks, TrendingUp } from 'lucide-react';
import type { PortfolioCurve } from '@g360/shared';
import { ProjectCurve } from '@/components/platform/project-curve';
import { EmptyState } from '@/components/platform/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDay } from './types';

interface ProjectRef {
  id: string;
  code: string | null;
  name: string;
}

export interface PortfolioExecution {
  curve: PortfolioCurve;
  milestones: Array<{ id: string; name: string; dueDate: string; overdue: boolean; project: ProjectRef }>;
  tasks: Array<{
    id: string;
    name: string;
    phase: string | null;
    progress: number;
    startDate: string | null;
    endDate: string | null;
    responsible: string | null;
    overdue: boolean;
    project: ProjectRef;
  }>;
  totals: { openMilestones: number; overdueMilestones: number; openTasks: number; overdueTasks: number; dueSoonTasks: number };
}

function toQueryString(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** Curva S e agenda do portfólio com os mesmos filtros da lista de projetos. */
export function usePortfolioExecution(params: Record<string, string | undefined>, enabled = true) {
  return useQuery<PortfolioExecution>({
    queryKey: ['projects', 'execution', params],
    queryFn: () => api<PortfolioExecution>(`/projects/portfolio/execution${toQueryString(params)}`),
    enabled,
  });
}

/** Curva S consolidada do portfólio (média simples dos projetos com cronograma). */
export function PortfolioCurveCard({ curve, title = 'Curva S do portfólio', fileName = 'curva-s-portfolio.csv' }: {
  curve: PortfolioCurve;
  title?: string;
  fileName?: string;
}) {
  if (!curve.hasSchedule || curve.progress === null) {
    return (
      <Card className="mb-6">
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> {title}</CardTitle></CardHeader>
        <CardContent>
          <EmptyState
            title="Sem cronograma para comparar"
            description="Preencha as datas dos projetos ou de todas as tarefas para comparar o avanço realizado com o planejado."
          />
        </CardContent>
      </Card>
    );
  }
  return (
    <ProjectCurve
      id="curva-s-portfolio"
      curve={curve}
      progress={curve.progress}
      expectedProgress={curve.expectedProgress}
      title={title}
      fileName={fileName}
      note={(
        <p className="text-xs text-muted-foreground">
          Média simples de {curve.projects} projeto(s) com cronograma; projetos cancelados ficam de fora
          {curve.withoutSchedule > 0 ? ` e ${curve.withoutSchedule} projeto(s) sem datas não entram na curva` : ''}.
          {' '}Cada projeto conta zero enquanto nada estava planejado; depois disso, o realizado do portfólio só aparece
          nos dias em que todos os projetos têm medição, sem estimar valores.
          {curve.historyStartsOn ? ` Medições disponíveis desde ${formatDay(curve.historyStartsOn)}.` : ''}
        </p>
      )}
    />
  );
}

/** Marcos e tarefas em aberto do portfólio, com conclusão direta para quem pode editar projetos. */
export function PortfolioAgenda({ data, canEdit }: { data: PortfolioExecution; canEdit: boolean }) {
  const qc = useQueryClient();
  const update = useMutation({
    mutationFn: (input: { path: string; json: unknown; projectId: string; success: string }) =>
      api(input.path, { method: 'PATCH', json: input.json }),
    onSuccess: (_result, input) => {
      toast.success(input.success);
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project', input.projectId] });
      qc.invalidateQueries({ queryKey: ['processes', 'pmo'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível atualizar.'),
  });
  const { totals } = data;

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2"><Flag className="h-4 w-4" /> Marcos em aberto</CardTitle>
          <p className="text-xs text-muted-foreground">
            {totals.openMilestones} em aberto · <span className={cn(totals.overdueMilestones > 0 && 'font-semibold text-status-red')}>{totals.overdueMilestones} vencido(s)</span>
            {totals.openMilestones > data.milestones.length ? ` · mostrando os ${data.milestones.length} mais próximos` : ''}
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {!data.milestones.length && <p className="text-sm text-muted-foreground">Nenhum marco em aberto nos projetos em andamento.</p>}
          {data.milestones.map((milestone) => (
            <div key={milestone.id} className={cn('flex items-start gap-3 rounded-md border p-2.5 text-sm', milestone.overdue && 'border-status-red/40')}>
              {canEdit && (
                <input
                  type="checkbox"
                  className="mt-1"
                  aria-label={`Concluir marco ${milestone.name}`}
                  disabled={update.isPending}
                  onChange={() => update.mutate({
                    path: `/projects/milestones/${milestone.id}`,
                    json: { done: true },
                    projectId: milestone.project.id,
                    success: 'Marco concluído',
                  })}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-medium">{milestone.name}</div>
                <Link href={`/projects/${milestone.project.id}#milestones`} className="text-xs text-primary hover:underline">
                  {milestone.project.code ? `${milestone.project.code} · ` : ''}{milestone.project.name}
                </Link>
              </div>
              <span className={cn('whitespace-nowrap text-xs text-muted-foreground', milestone.overdue && 'font-semibold text-status-red')}>
                {milestone.overdue ? 'Venceu em ' : ''}{formatDay(milestone.dueDate)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2"><ListChecks className="h-4 w-4" /> Tarefas para acompanhar</CardTitle>
          <p className="text-xs text-muted-foreground">
            <span className={cn(totals.overdueTasks > 0 && 'font-semibold text-status-red')}>{totals.overdueTasks} vencida(s)</span>
            {' '}· {totals.dueSoonTasks} vencem em até 14 dias · {totals.openTasks} em aberto no total
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {!data.tasks.length && <p className="text-sm text-muted-foreground">Nenhuma tarefa vencida, em andamento ou com prazo próximo.</p>}
          {data.tasks.map((task) => (
            <div key={task.id} className={cn('flex items-start gap-3 rounded-md border p-2.5 text-sm', task.overdue && 'border-status-red/40')}>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{task.name}</div>
                <div className="text-xs text-muted-foreground">
                  <Link href={`/projects/${task.project.id}#cronograma`} className="text-primary hover:underline">
                    {task.project.code ? `${task.project.code} · ` : ''}{task.project.name}
                  </Link>
                  {task.phase ? ` · ${task.phase}` : ''}
                  {task.responsible ? ` · ${task.responsible}` : ''}
                </div>
                <div className={cn('text-xs text-muted-foreground', task.overdue && 'font-semibold text-status-red')}>
                  {task.endDate ? `${task.overdue ? 'Venceu em' : 'Prazo'} ${formatDay(task.endDate)}` : 'Sem prazo'} · {Math.round(task.progress)}%
                </div>
              </div>
              {canEdit && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={update.isPending}
                  onClick={() => update.mutate({
                    path: `/projects/tasks/${task.id}`,
                    json: { progress: 100 },
                    projectId: task.project.id,
                    success: 'Tarefa concluída',
                  })}
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Concluir
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
