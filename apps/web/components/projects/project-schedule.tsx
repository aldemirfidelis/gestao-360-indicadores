'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, CheckCircle2, Download, Flag, Pencil, Plus, Trash2 } from 'lucide-react';
import { Gantt } from '@/components/gantt';
import { ConfirmDialog } from '@/components/platform/confirm-dialog';
import { EmptyState } from '@/components/platform/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { downloadCsv } from '@/lib/compensation/format';
import { cn } from '@/lib/utils';
import {
  formatDay,
  isOverdue,
  taskStatusLabel,
  toDateInput,
  type PersonOption,
  type ProjectDetail,
  type ProjectMilestone,
  type ProjectTask,
} from './types';
import { settle, type ProjectAction } from './use-project';

const EXTERNAL = '__external__';

const EMPTY_TASK = {
  name: '',
  phase: '',
  startDate: '',
  endDate: '',
  assigneeId: '',
  responsible: '',
  dependencyId: '',
  progress: '0',
  description: '',
};

const EMPTY_MILESTONE = { name: '', dueDate: '', description: '' };

/** Cronograma do projeto: Gantt, tarefas (com fases, responsáveis e dependências) e marcos. */
export function ProjectSchedule({
  project,
  canEdit,
  action,
  people,
}: {
  project: ProjectDetail;
  canEdit: boolean;
  action: ProjectAction;
  people: PersonOption[];
}) {
  const [taskDialog, setTaskDialog] = useState<{ open: boolean; task: ProjectTask | null }>({ open: false, task: null });
  const [milestoneDialog, setMilestoneDialog] = useState<{ open: boolean; milestone: ProjectMilestone | null }>({ open: false, milestone: null });
  const [taskToDelete, setTaskToDelete] = useState<ProjectTask | null>(null);
  const [milestoneToDelete, setMilestoneToDelete] = useState<ProjectMilestone | null>(null);
  const [phaseFilter, setPhaseFilter] = useState('');

  const phases = useMemo(
    () => [...new Set(project.tasks.map((task) => task.phase).filter((phase): phase is string => Boolean(phase)))],
    [project.tasks],
  );
  const visibleTasks = phaseFilter ? project.tasks.filter((task) => task.phase === phaseFilter) : project.tasks;
  const busy = action.isPending;

  function moveTask(task: ProjectTask, direction: -1 | 1) {
    const ids = project.tasks.map((item) => item.id);
    const index = ids.indexOf(task.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    action.mutate({ path: `/projects/${project.id}/tasks/reorder`, method: 'POST', json: { ids } });
  }

  function setProgress(task: ProjectTask, progress: number) {
    if (progress === task.progress) return;
    action.mutate({ path: `/projects/tasks/${task.id}`, method: 'PATCH', json: { progress } });
  }

  function exportSchedule() {
    downloadCsv(`cronograma-${project.code ?? 'projeto'}.csv`, [
      ['Tipo', 'Nome', 'Fase', 'Início', 'Fim / prazo', 'Responsável', 'Depende de', 'Progresso (%)', 'Situação'],
      ...project.tasks.map((task) => [
        'Tarefa',
        task.name,
        task.phase ?? '',
        toDateInput(task.startDate),
        toDateInput(task.endDate),
        task.responsible ?? '',
        task.dependency?.name ?? '',
        task.progress,
        task.progress < 100 && isOverdue(task.endDate) ? 'Vencida' : taskStatusLabel(task.progress),
      ]),
      ...project.milestones.map((milestone) => [
        'Marco',
        milestone.name,
        '',
        '',
        toDateInput(milestone.dueDate),
        '',
        '',
        milestone.done ? 100 : 0,
        milestone.done ? 'Concluído' : isOverdue(milestone.dueDate) ? 'Vencido' : 'Pendente',
      ]),
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {project.tasks.length} tarefa(s) e {project.milestones.length} marco(s). O avanço do projeto é calculado a partir deles.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportSchedule} disabled={project.tasks.length + project.milestones.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Exportar cronograma
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => setMilestoneDialog({ open: true, milestone: null })}>
                <Flag className="mr-2 h-4 w-4" /> Novo marco
              </Button>
              <Button size="sm" onClick={() => setTaskDialog({ open: true, task: null })}>
                <Plus className="mr-2 h-4 w-4" /> Nova tarefa
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gantt</CardTitle>
        </CardHeader>
        <CardContent>
          <Gantt tasks={project.tasks} milestones={project.milestones} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle>Tarefas ({project.tasks.length})</CardTitle>
          {phases.length > 0 && (
            <NativeSelect
              aria-label="Filtrar por fase"
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="h-9 w-auto text-xs"
            >
              <option value="">Todas as fases</option>
              {phases.map((phase) => <option key={phase} value={phase}>{phase}</option>)}
            </NativeSelect>
          )}
        </CardHeader>
        <CardContent>
          {project.tasks.length === 0 ? (
            <EmptyState
              title="Nenhuma tarefa no cronograma"
              description="Cadastre as tarefas com início, fim e responsável para montar o Gantt e a curva S."
              action={canEdit ? <Button size="sm" onClick={() => setTaskDialog({ open: true, task: null })}><Plus className="mr-2 h-4 w-4" /> Nova tarefa</Button> : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Tarefa</th>
                    <th className="py-2 pr-3 font-medium">Período</th>
                    <th className="py-2 pr-3 font-medium">Responsável</th>
                    <th className="py-2 pr-3 font-medium">Situação</th>
                    <th className="w-28 py-2 pr-3 font-medium">Progresso</th>
                    {canEdit && <th className="py-2 text-right font-medium">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {visibleTasks.map((task) => {
                    const late = task.progress < 100 && isOverdue(task.endDate);
                    const index = project.tasks.findIndex((item) => item.id === task.id);
                    return (
                      <tr key={task.id} className="border-b last:border-0 align-top">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{task.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {task.phase && <span className="mr-2 rounded bg-muted px-1.5 py-0.5">{task.phase}</span>}
                            {task.dependency && <span>Depois de {task.dependency.name}</span>}
                          </div>
                          {task.description && <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{task.description}</p>}
                        </td>
                        <td className={cn('whitespace-nowrap py-2 pr-3 text-xs', late && 'font-semibold text-status-red')}>
                          {formatDay(task.startDate)} a {formatDay(task.endDate)}
                        </td>
                        <td className="py-2 pr-3 text-xs">{task.responsible ?? '—'}</td>
                        <td className="py-2 pr-3">
                          <span className={cn('pill text-[10px]', late ? 'pill-red' : task.progress >= 100 ? 'pill-green' : task.progress > 0 ? 'pill-blue' : 'pill-gray')}>
                            {late ? 'Vencida' : taskStatusLabel(task.progress)}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1">
                            <Input
                              key={`${task.id}:${task.progress}`}
                              type="number"
                              aria-label={`Progresso de ${task.name} (%)`}
                              disabled={!canEdit || busy}
                              min={0}
                              max={100}
                              defaultValue={task.progress}
                              className="h-8 w-16 text-right"
                              onBlur={(e) => {
                                const value = Number(e.target.value);
                                if (e.target.value === '' || !Number.isFinite(value) || value < 0 || value > 100) {
                                  e.target.value = String(task.progress);
                                  toast.error('Informe um progresso entre 0 e 100.');
                                  return;
                                }
                                setProgress(task, value);
                              }}
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </td>
                        {canEdit && (
                          <td className="py-2">
                            <div className="flex justify-end gap-0.5">
                              <IconButton label={`Concluir ${task.name}`} disabled={busy || task.progress >= 100} onClick={() => setProgress(task, 100)}>
                                <CheckCircle2 className="h-4 w-4" />
                              </IconButton>
                              <IconButton label={`Mover ${task.name} para cima`} disabled={busy || index <= 0} onClick={() => moveTask(task, -1)}>
                                <ArrowUp className="h-4 w-4" />
                              </IconButton>
                              <IconButton label={`Mover ${task.name} para baixo`} disabled={busy || index === project.tasks.length - 1} onClick={() => moveTask(task, 1)}>
                                <ArrowDown className="h-4 w-4" />
                              </IconButton>
                              <IconButton label={`Editar ${task.name}`} disabled={busy} onClick={() => setTaskDialog({ open: true, task })}>
                                <Pencil className="h-4 w-4" />
                              </IconButton>
                              <IconButton label={`Excluir ${task.name}`} disabled={busy} onClick={() => setTaskToDelete(task)}>
                                <Trash2 className="h-4 w-4" />
                              </IconButton>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="milestones" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Marcos ({project.milestones.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {project.milestones.length === 0 && (
            <EmptyState
              title="Nenhum marco cadastrado"
              description="Marcos são as entregas e pontos de controle do projeto."
              action={canEdit ? <Button size="sm" variant="outline" onClick={() => setMilestoneDialog({ open: true, milestone: null })}><Flag className="mr-2 h-4 w-4" /> Novo marco</Button> : undefined}
            />
          )}
          {project.milestones.map((milestone) => {
            const late = !milestone.done && isOverdue(milestone.dueDate);
            return (
              <div key={milestone.id} className={cn('flex items-start gap-3 rounded-md border p-3 text-sm', late && 'border-status-red/40')}>
                <input
                  type="checkbox"
                  className="mt-1"
                  aria-label={`Marco ${milestone.name} concluído`}
                  checked={milestone.done}
                  disabled={!canEdit || busy}
                  onChange={(e) => action.mutate({ path: `/projects/milestones/${milestone.id}`, method: 'PATCH', json: { done: e.target.checked } })}
                />
                <div className="min-w-0 flex-1">
                  <div className={cn('font-medium', milestone.done && 'text-muted-foreground line-through')}>{milestone.name}</div>
                  {milestone.description && <p className="whitespace-pre-line text-xs text-muted-foreground">{milestone.description}</p>}
                  {milestone.done && milestone.completedAt && (
                    <p className="text-xs text-muted-foreground">Concluído em {formatDay(milestone.completedAt)}</p>
                  )}
                </div>
                <span className={cn('whitespace-nowrap text-xs text-muted-foreground', late && 'font-semibold text-status-red')}>
                  {late ? 'Vencido em ' : ''}{formatDay(milestone.dueDate)}
                </span>
                {canEdit && (
                  <div className="flex gap-0.5">
                    <IconButton label={`Editar marco ${milestone.name}`} disabled={busy} onClick={() => setMilestoneDialog({ open: true, milestone })}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={`Excluir marco ${milestone.name}`} disabled={busy} onClick={() => setMilestoneToDelete(milestone)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <TaskDialog
        open={taskDialog.open}
        task={taskDialog.task}
        project={project}
        people={people}
        phases={phases}
        action={action}
        onOpenChange={(open) => setTaskDialog((prev) => ({ ...prev, open }))}
      />
      <MilestoneDialog
        open={milestoneDialog.open}
        milestone={milestoneDialog.milestone}
        projectId={project.id}
        action={action}
        onOpenChange={(open) => setMilestoneDialog((prev) => ({ ...prev, open }))}
      />
      <ConfirmDialog
        open={Boolean(taskToDelete)}
        onOpenChange={(open) => !open && setTaskToDelete(null)}
        title="Excluir tarefa"
        description={taskToDelete ? `A tarefa “${taskToDelete.name}” será removida do cronograma e o avanço do projeto será recalculado.` : undefined}
        confirmLabel="Excluir"
        destructive
        onConfirm={async () => {
          if (taskToDelete) await settle(action, { path: `/projects/tasks/${taskToDelete.id}`, method: 'DELETE', success: 'Tarefa excluída' });
        }}
      />
      <ConfirmDialog
        open={Boolean(milestoneToDelete)}
        onOpenChange={(open) => !open && setMilestoneToDelete(null)}
        title="Excluir marco"
        description={milestoneToDelete ? `O marco “${milestoneToDelete.name}” será removido e o avanço do projeto será recalculado.` : undefined}
        confirmLabel="Excluir"
        destructive
        onConfirm={async () => {
          if (milestoneToDelete) await settle(action, { path: `/projects/milestones/${milestoneToDelete.id}`, method: 'DELETE', success: 'Marco excluído' });
        }}
      />
    </div>
  );
}

export function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}

function TaskDialog({
  open,
  task,
  project,
  people,
  phases,
  action,
  onOpenChange,
}: {
  open: boolean;
  task: ProjectTask | null;
  project: ProjectDetail;
  people: PersonOption[];
  phases: string[];
  action: ProjectAction;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState(EMPTY_TASK);

  useEffect(() => {
    if (!open) return;
    setForm(task
      ? {
          name: task.name,
          phase: task.phase ?? '',
          startDate: toDateInput(task.startDate),
          endDate: toDateInput(task.endDate),
          assigneeId: task.assigneeId ?? (task.responsible ? EXTERNAL : ''),
          responsible: task.assigneeId ? '' : task.responsible ?? '',
          dependencyId: task.dependencyId ?? '',
          progress: String(task.progress),
          description: task.description ?? '',
        }
      : { ...EMPTY_TASK, startDate: toDateInput(project.startsAt) });
  }, [open, task, project.startsAt]);

  const set = (key: keyof typeof EMPTY_TASK, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const candidates = project.tasks.filter((item) => item.id !== task?.id);

  async function submit() {
    if (!form.name.trim()) {
      toast.error('Informe o nome da tarefa.');
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      toast.error('O fim da tarefa não pode ser anterior ao início.');
      return;
    }
    const progress = Number(form.progress);
    if (task && (form.progress === '' || !Number.isFinite(progress) || progress < 0 || progress > 100)) {
      toast.error('Informe um progresso entre 0 e 100.');
      return;
    }
    const json: Record<string, unknown> = {
      name: form.name.trim(),
      phase: form.phase.trim() || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      dependencyId: form.dependencyId || null,
      description: form.description.trim() || null,
    };
    if (form.assigneeId === EXTERNAL) {
      json.assigneeId = null;
      json.responsible = form.responsible.trim() || null;
    } else if (form.assigneeId) {
      json.assigneeId = form.assigneeId;
    } else {
      json.assigneeId = null;
      json.responsible = null;
    }
    if (task) json.progress = progress;
    const saved = await settle(action, task
      ? { path: `/projects/tasks/${task.id}`, method: 'PATCH', json, success: 'Tarefa atualizada' }
      : { path: `/projects/${project.id}/tasks`, method: 'POST', json, success: 'Tarefa adicionada' });
    // Em caso de erro o diálogo permanece aberto para correção.
    if (saved) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !action.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? 'Editar tarefa' : 'Nova tarefa'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr,200px]">
            <div className="space-y-2">
              <Label htmlFor="task-name">Nome da tarefa *</Label>
              <Input id="task-name" value={form.name} maxLength={180} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-phase">Fase</Label>
              <Input id="task-phase" list="task-phases" value={form.phase} maxLength={120} onChange={(e) => set('phase', e.target.value)} placeholder="Ex.: Planejamento" />
              <datalist id="task-phases">
                {phases.map((phase) => <option key={phase} value={phase} />)}
              </datalist>
            </div>
          </div>
          <div className={cn('grid gap-3', task ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
            <div className="space-y-2">
              <Label htmlFor="task-start">Início</Label>
              <Input id="task-start" type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-end">Fim</Label>
              <Input id="task-end" type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => set('endDate', e.target.value)} />
            </div>
            {task && (
              <div className="space-y-2">
                <Label htmlFor="task-progress">Progresso (%)</Label>
                <Input id="task-progress" type="number" min={0} max={100} value={form.progress} onChange={(e) => set('progress', e.target.value)} />
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-assignee">Responsável</Label>
              <NativeSelect id="task-assignee" value={form.assigneeId} onChange={(e) => set('assigneeId', e.target.value)}>
                <option value="">Não definido</option>
                {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                <option value={EXTERNAL}>Outra pessoa (sem usuário no sistema)</option>
              </NativeSelect>
              {form.assigneeId === EXTERNAL && (
                <Input aria-label="Nome do responsável" value={form.responsible} maxLength={180} onChange={(e) => set('responsible', e.target.value)} placeholder="Nome do responsável" />
              )}
              <p className="text-xs text-muted-foreground">Tarefas atribuídas a um usuário aparecem no Meu Dia dele.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-dependency">Depende de</Label>
              <NativeSelect id="task-dependency" value={form.dependencyId} onChange={(e) => set('dependencyId', e.target.value)}>
                <option value="">Sem dependência</option>
                {candidates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-description">Descrição</Label>
            <Textarea id="task-description" rows={3} value={form.description} maxLength={2000} onChange={(e) => set('description', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={action.isPending} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!form.name.trim() || action.isPending}>
            {action.isPending ? 'Salvando...' : task ? 'Salvar alterações' : 'Adicionar tarefa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MilestoneDialog({
  open,
  milestone,
  projectId,
  action,
  onOpenChange,
}: {
  open: boolean;
  milestone: ProjectMilestone | null;
  projectId: string;
  action: ProjectAction;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState(EMPTY_MILESTONE);

  useEffect(() => {
    if (!open) return;
    setForm(milestone
      ? { name: milestone.name, dueDate: toDateInput(milestone.dueDate), description: milestone.description ?? '' }
      : EMPTY_MILESTONE);
  }, [open, milestone]);

  async function submit() {
    if (!form.name.trim() || !form.dueDate) {
      toast.error('Informe o nome e a data do marco.');
      return;
    }
    const json = { name: form.name.trim(), dueDate: form.dueDate, description: form.description.trim() || null };
    const saved = await settle(action, milestone
      ? { path: `/projects/milestones/${milestone.id}`, method: 'PATCH', json, success: 'Marco atualizado' }
      : { path: `/projects/${projectId}/milestones`, method: 'POST', json, success: 'Marco adicionado' });
    if (saved) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !action.isPending && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{milestone ? 'Editar marco' : 'Novo marco'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr,170px]">
            <div className="space-y-2">
              <Label htmlFor="milestone-name">Nome do marco *</Label>
              <Input id="milestone-name" value={form.name} maxLength={180} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-date">Data *</Label>
              <Input id="milestone-date" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="milestone-description">Descrição</Label>
            <Textarea id="milestone-description" rows={3} value={form.description} maxLength={2000} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Critério de aceite ou entrega esperada" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={action.isPending} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!form.name.trim() || !form.dueDate || action.isPending}>
            {action.isPending ? 'Salvando...' : milestone ? 'Salvar alterações' : 'Adicionar marco'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
