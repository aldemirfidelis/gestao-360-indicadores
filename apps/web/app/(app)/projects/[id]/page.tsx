'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Gantt } from '@/components/gantt';
import { api } from '@/lib/api';
import { formatDate, formatNumber, cn } from '@/lib/utils';

interface Milestone {
  id: string;
  name: string;
  dueDate: string;
  done: boolean;
}

interface Task {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  progress: number;
  responsible: string | null;
  dependencyId: string | null;
  dependency: { id: string; name: string } | null;
}

interface LinkedIndicator {
  id: string;
  name: string;
  code: string | null;
  unit: string;
  unitLabel: string | null;
  direction: 'HIGHER_BETTER' | 'LOWER_BETTER';
  ownerNode: { id: string; name: string } | null;
  results: { id: string; periodRef: string; value: number; light: string; attainment: number | null }[];
}

interface IndicatorOption {
  id: string;
  name: string;
  code: string | null;
  unit: string;
  unitLabel: string | null;
  direction: 'HIGHER_BETTER' | 'LOWER_BETTER';
}

interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  responsible: string | null;
  budget: number | null;
  progressOverall: number;
  indicatorId: string | null;
  indicator: LinkedIndicator | null;
  milestones: Milestone[];
  tasks: Task[];
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const query = useQuery<ProjectDetail>({
    queryKey: ['project', id],
    queryFn: () => api<ProjectDetail>(`/projects/${id}`),
  });

  const indicatorsQuery = useQuery<IndicatorOption[]>({
    queryKey: ['projects', 'indicators'],
    queryFn: () => api<IndicatorOption[]>('/projects/indicators'),
    staleTime: 60_000,
  });

  const [milestone, setMilestone] = useState({ name: '', dueDate: '' });
  const [task, setTask] = useState({ name: '', startDate: '', endDate: '', responsible: '', dependencyId: '' });

  const linkIndicator = useMutation({
    mutationFn: (indicatorId: string) => api(`/projects/${id}`, { method: 'PATCH', json: { indicatorId } }),
    onSuccess: () => {
      toast.success('Indicador atualizado');
      qc.invalidateQueries({ queryKey: ['project', id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao vincular indicador'),
  });

  const addMilestone = useMutation({
    mutationFn: () => api(`/projects/${id}/milestones`, { method: 'POST', json: milestone }),
    onSuccess: () => {
      setMilestone({ name: '', dueDate: '' });
      qc.invalidateQueries({ queryKey: ['project', id] });
    },
  });

  const toggleMilestone = useMutation({
    mutationFn: ({ msId, done }: { msId: string; done: boolean }) =>
      api(`/projects/milestones/${msId}`, { method: 'PATCH', json: { done } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', id] }),
  });

  const addTask = useMutation({
    mutationFn: () => api(`/projects/${id}/tasks`, { method: 'POST', json: { ...task, dependencyId: task.dependencyId || undefined } }),
    onSuccess: () => {
      setTask({ name: '', startDate: '', endDate: '', responsible: '', dependencyId: '' });
      qc.invalidateQueries({ queryKey: ['project', id] });
    },
  });

  const updateTask = useMutation({
    mutationFn: ({ taskId, patch }: { taskId: string; patch: any }) =>
      api(`/projects/tasks/${taskId}`, { method: 'PATCH', json: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', id] }),
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!query.data) return null;
  const p = query.data;

  return (
    <div>
      <Link href="/projects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Projetos
      </Link>

      <PageHeader title={p.name} description={p.description ?? undefined} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] uppercase text-muted-foreground">Início</div>
            <div className="font-semibold">{formatDate(p.startsAt)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] uppercase text-muted-foreground">Fim previsto</div>
            <div className="font-semibold">{formatDate(p.endsAt)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] uppercase text-muted-foreground">Responsável</div>
            <div className="font-semibold">{p.responsible ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] uppercase text-muted-foreground">Progresso</div>
            <div className="font-semibold">{p.progressOverall}%</div>
            <Progress value={p.progressOverall} className="mt-1" />
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-4 w-4" /> Indicador vinculado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[280px,1fr]">
            <div className="space-y-2">
              <Label>Selecionar indicador</Label>
              <NativeSelect
                value={p.indicatorId ?? ''}
                onChange={(e) => linkIndicator.mutate(e.target.value)}
                disabled={linkIndicator.isPending}
              >
                <option value="">Sem indicador</option>
                {(indicatorsQuery.data ?? []).map((ind) => (
                  <option key={ind.id} value={ind.id}>
                    {ind.code ? `[${ind.code}] ` : ''}{ind.name}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                Vincule um KPI para acompanhar o impacto do projeto.
              </p>
            </div>
            {p.indicator ? (
              <IndicatorImpactPanel indicator={p.indicator} />
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum indicador vinculado. Escolha um KPI ao lado para ver tendência e atingimento.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Cronograma (Gantt)</CardTitle>
        </CardHeader>
        <CardContent>
          <Gantt tasks={p.tasks} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Marcos ({p.milestones.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-[1fr,140px,auto] gap-2">
              <Input
                placeholder="Nome do marco"
                value={milestone.name}
                onChange={(e) => setMilestone({ ...milestone, name: e.target.value })}
              />
              <Input
                type="date"
                value={milestone.dueDate}
                onChange={(e) => setMilestone({ ...milestone, dueDate: e.target.value })}
              />
              <Button onClick={() => addMilestone.mutate()} disabled={!milestone.name || !milestone.dueDate}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {p.milestones.map((m) => {
              const late = !m.done && new Date(m.dueDate) < new Date();
              return (
                <label
                  key={m.id}
                  className={cn(
                    'flex items-center gap-3 rounded-md border p-2 text-sm cursor-pointer',
                    m.done && 'opacity-60',
                    late && 'border-status-red/40',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={m.done}
                    onChange={(e) => toggleMilestone.mutate({ msId: m.id, done: e.target.checked })}
                  />
                  <span className={cn('flex-1', m.done && 'line-through')}>{m.name}</span>
                  <span className={cn('text-xs text-muted-foreground', late && 'text-status-red')}>
                    {formatDate(m.dueDate)}
                  </span>
                </label>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tarefas ({p.tasks.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Nome da tarefa"
                className="col-span-2"
                value={task.name}
                onChange={(e) => setTask({ ...task, name: e.target.value })}
              />
              <Input
                type="date"
                value={task.startDate}
                onChange={(e) => setTask({ ...task, startDate: e.target.value })}
              />
              <Input
                type="date"
                value={task.endDate}
                onChange={(e) => setTask({ ...task, endDate: e.target.value })}
              />
              <Input
                placeholder="Responsável"
                value={task.responsible}
                onChange={(e) => setTask({ ...task, responsible: e.target.value })}
              />
              <select
                value={task.dependencyId}
                onChange={(e) => setTask({ ...task, dependencyId: e.target.value })}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Sem dependência</option>
                {p.tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Button
                className="col-span-2"
                onClick={() => addTask.mutate()}
                disabled={!task.name || !task.startDate || !task.endDate}
              >
                <Plus className="h-4 w-4 mr-2" /> Adicionar tarefa
              </Button>
            </div>
            <div className="space-y-1.5">
              {p.tasks.map((t) => (
                <div key={t.id} className="grid grid-cols-[1fr,80px,auto] gap-2 items-center rounded-md border p-2 text-sm">
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(t.startDate)} - {formatDate(t.endDate)}
                      {t.dependency && ` - depois de ${t.dependency.name}`}
                    </div>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={t.progress}
                    className="h-8 text-right"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isFinite(v) || v === t.progress) return;
                      updateTask.mutate({ taskId: t.id, patch: { progress: v } });
                    }}
                  />
                  <span className="text-xs text-muted-foreground w-8">%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function IndicatorImpactPanel({ indicator }: { indicator: LinkedIndicator }) {
  const latest = indicator.results[0];
  const previous = indicator.results[1];
  const trendUp = latest && previous ? latest.value > previous.value : null;
  const onTarget = latest?.light === 'GREEN' || latest?.light === 'BLUE';
  const unitLabel = indicator.unitLabel ?? (indicator.unit === 'PERCENT' ? '%' : '');
  const valueColor = !latest
    ? 'text-muted-foreground'
    : onTarget
      ? 'text-[hsl(var(--status-green))]'
      : latest.light === 'YELLOW'
        ? 'text-[hsl(var(--status-yellow))]'
        : 'text-[hsl(var(--status-red))]';

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase text-muted-foreground">
            {indicator.code && <span className="mr-2 font-mono">[{indicator.code}]</span>}
            {indicator.ownerNode?.name ?? 'KPI'}
          </div>
          <div className="font-semibold truncate">{indicator.name}</div>
        </div>
        <Link
          href={`/indicators/${indicator.id}`}
          className="shrink-0 text-xs text-primary hover:underline"
        >
          Ver detalhes →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Atual</div>
          <div className={cn('text-xl font-bold', valueColor)}>
            {latest ? `${formatNumber(latest.value)}${unitLabel}` : '—'}
          </div>
          {latest && (
            <div className="text-[10px] text-muted-foreground">{latest.periodRef}</div>
          )}
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Atingimento</div>
          <div className="text-xl font-bold">
            {latest?.attainment != null ? `${Math.round(latest.attainment)}%` : '—'}
          </div>
          <Progress value={Math.min(100, Math.max(0, latest?.attainment ?? 0))} className="mt-1 h-1.5" />
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Tendência</div>
          <div className="text-xl font-bold flex items-center gap-1.5">
            {trendUp === null ? (
              '—'
            ) : trendUp ? (
              <>
                <TrendingUp className="h-5 w-5 text-[hsl(var(--status-green))]" />
                <span className="text-[hsl(var(--status-green))]">Subindo</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-5 w-5 text-[hsl(var(--status-red))]" />
                <span className="text-[hsl(var(--status-red))]">Caindo</span>
              </>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {indicator.direction === 'HIGHER_BETTER' ? 'Maior é melhor' : 'Menor é melhor'}
          </div>
        </div>
      </div>
    </div>
  );
}
