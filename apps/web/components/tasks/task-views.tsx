'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Save,
  UserRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { cn, formatDate } from '@/lib/utils';
import type { TaskBoardData, TaskRecord } from './task-types';
import {
  checklistProgress,
  initials,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  STATUS_LABEL,
  taskIsOverdue,
} from './task-utils';

export function TaskListView({ tasks, onOpen }: { tasks: TaskRecord[]; onOpen: (task: TaskRecord) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              {['Tarefa', 'Tipo', 'Origem', 'Status', 'Prioridade', 'Responsável', 'Área', 'Prazo', 'Progresso', 'Atualização'].map((title) => (
                <th key={title} className="px-4 py-3 font-semibold">{title}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {tasks.map((task) => {
              const progress = checklistProgress(task);
              return (
                <tr key={task.id} className="cursor-pointer transition hover:bg-muted/35" onClick={() => onOpen(task)}>
                  <td className="max-w-[280px] px-4 py-3">
                    <div className="font-medium">{task.title}</div>
                    {task.description && <div className="mt-0.5 truncate text-xs text-muted-foreground">{task.description}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={task.isAutomatic ? 'default' : 'outline'} className="whitespace-nowrap">{task.isAutomatic ? '⚡ Automática' : 'Manual'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">{task.sourceModule ?? '—'}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{STATUS_LABEL[task.status] ?? task.status}</Badge></td>
                  <td className="px-4 py-3"><Badge variant="outline" className={PRIORITY_CLASS[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">{initials(task.assignee?.name)}</span>
                      {task.assignee?.name ?? 'Sem responsável'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">{task.area?.name ?? '—'}</td>
                  <td className={cn('px-4 py-3 text-xs whitespace-nowrap', taskIsOverdue(task) && 'font-semibold text-rose-600')}>
                    {task.dueDate ? formatDate(task.dueDate) : 'Sem prazo'}
                  </td>
                  <td className="w-28 px-4 py-3">
                    <div className="flex items-center gap-2"><Progress value={progress} className="h-1.5" /><span className="text-[10px]">{progress}%</span></div>
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">{formatDate(task.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!tasks.length && <Empty title="Nenhuma tarefa encontrada" description="Ajuste os filtros ou crie uma nova tarefa." />}
    </div>
  );
}

export function TaskCalendarView({ tasks, onOpen }: { tasks: TaskRecord[]; onOpen: (task: TaskRecord) => void }) {
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  });

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="font-semibold capitalize">{format(month, 'MMMM yyyy', { locale: ptBR })}</h2>
          <p className="text-xs text-muted-foreground">Tarefas organizadas pela data de prazo</p>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setMonth(subMonths(month, 1))}><ArrowLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setMonth(startOfMonth(new Date()))}>Hoje</Button>
          <Button size="sm" variant="outline" onClick={() => setMonth(addMonths(month, 1))}><ArrowRight className="h-4 w-4" /></Button>
        </div>
      </header>
      <div className="grid grid-cols-7 border-b bg-muted/30 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => <div key={day} className="border-r px-2 py-2 last:border-r-0">{day}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayTasks = tasks.filter((task) => task.dueDate && isSameDay(new Date(task.dueDate), day));
          return (
            <div key={day.toISOString()} className={cn('min-h-32 border-b border-r p-1.5 last:border-r-0', !isSameMonth(day, month) && 'bg-muted/20 text-muted-foreground')}>
              <span className={cn('mb-1 grid h-6 w-6 place-items-center rounded-full text-[11px]', isToday(day) && 'bg-primary font-semibold text-primary-foreground')}>
                {format(day, 'd')}
              </span>
              <div className="space-y-1">
                {dayTasks.slice(0, 4).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onOpen(task)}
                    className={cn(
                      'block w-full truncate rounded-md border-l-2 bg-muted/60 px-1.5 py-1 text-left text-[10px] transition hover:bg-muted',
                      taskIsOverdue(task) && 'border-l-rose-500 bg-rose-50 text-rose-800',
                      task.status === 'DONE' && 'border-l-emerald-500 bg-emerald-50 text-emerald-800 line-through',
                    )}
                    style={!taskIsOverdue(task) && task.status !== 'DONE' ? { borderLeftColor: task.priority === 'CRITICAL' ? '#e11d48' : '#3b82f6' } : undefined}
                  >
                    {task.title}
                  </button>
                ))}
                {dayTasks.length > 4 && <p className="px-1 text-[9px] text-muted-foreground">+{dayTasks.length - 4} tarefas</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TaskTimelineView({ tasks, onOpen }: { tasks: TaskRecord[]; onOpen: (task: TaskRecord) => void }) {
  const dated = tasks.filter((task) => task.startDate || task.dueDate);
  const range = useMemo(() => {
    const dates = dated.flatMap((task) => [task.startDate, task.dueDate].filter(Boolean).map((value) => new Date(value as string).getTime()));
    const now = Date.now();
    const min = dates.length ? Math.min(...dates, now) : now;
    const max = dates.length ? Math.max(...dates, now + 30 * 86_400_000) : now + 30 * 86_400_000;
    return { start: new Date(min - 2 * 86_400_000), end: new Date(max + 2 * 86_400_000) };
  }, [dated]);
  const totalDays = Math.max(1, differenceInCalendarDays(range.end, range.start));

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <header className="border-b px-4 py-3">
        <h2 className="font-semibold">Cronograma da equipe</h2>
        <p className="text-xs text-muted-foreground">{formatDate(range.start)} a {formatDate(range.end)} · baseado no início e prazo das tarefas</p>
      </header>
      <div className="overflow-x-auto">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[300px_1fr] border-b bg-muted/30 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <div className="border-r px-4 py-2">Tarefa</div>
            <div className="relative px-4 py-2">
              <span>{formatDate(range.start)}</span><span className="float-right">{formatDate(range.end)}</span>
            </div>
          </div>
          {dated.map((task) => {
            const start = task.startDate ? new Date(task.startDate) : task.dueDate ? new Date(task.dueDate) : range.start;
            const end = task.dueDate ? new Date(task.dueDate) : start;
            const left = Math.max(0, (differenceInCalendarDays(start, range.start) / totalDays) * 100);
            const width = Math.max(1.5, (Math.max(1, differenceInCalendarDays(end, start) + 1) / totalDays) * 100);
            return (
              <button key={task.id} type="button" onClick={() => onOpen(task)} className="grid w-full grid-cols-[300px_1fr] border-b text-left transition hover:bg-muted/30">
                <div className="border-r px-4 py-3">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><UserRound className="h-3 w-3" />{task.assignee?.name ?? 'Sem responsável'}</p>
                </div>
                <div className="relative my-3 min-h-8 overflow-hidden bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px)] bg-[size:10%_100%]">
                  <span
                    className={cn(
                      'absolute top-1 h-6 rounded-full px-2 py-1 text-[9px] font-semibold text-white shadow-sm',
                      task.status === 'DONE' ? 'bg-emerald-500' : taskIsOverdue(task) ? 'bg-rose-500' : task.priority === 'CRITICAL' ? 'bg-orange-500' : 'bg-blue-500',
                    )}
                    style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                  >
                    <span className="block truncate">{STATUS_LABEL[task.status]}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {!dated.length && <Empty title="Sem tarefas com datas" description="Defina data inicial ou prazo para visualizar o cronograma." />}
    </div>
  );
}

export function TaskWikiView({
  board,
  tasks,
  saving,
  onSave,
  onOpen,
}: {
  board: TaskBoardData;
  tasks: TaskRecord[];
  saving: boolean;
  onSave: (content: string) => void;
  onOpen: (task: TaskRecord) => void;
}) {
  const [content, setContent] = useState(board.wikiContent ?? '');
  useEffect(() => setContent(board.wikiContent ?? ''), [board.wikiContent]);
  const active = tasks.filter((task) => task.status !== 'DONE').slice(0, 8);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
      <section className="rounded-xl border bg-card">
        <header className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700"><BookOpenText className="h-5 w-5" /></div>
            <div><h2 className="font-semibold">Wiki / Página do projeto</h2><p className="text-xs text-muted-foreground">Contexto compartilhado do quadro</p></div>
          </div>
          <Button size="sm" onClick={() => onSave(content)} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? 'Salvando...' : 'Salvar página'}</Button>
        </header>
        <div className="p-5">
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="min-h-[520px] resize-y border-0 bg-muted/20 p-5 text-sm leading-7 shadow-inner focus-visible:ring-1"
            placeholder={'# Objetivo\n\nDescreva o projeto, a rotina ou o contexto desta equipe.\n\n## Responsáveis\n\n## Links úteis\n\n## Observações'}
          />
          <p className="mt-2 text-[10px] text-muted-foreground">Editor textual simples nesta primeira versão. O conteúdo é salvo para toda a empresa.</p>
        </div>
      </section>
      <aside className="space-y-4">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-primary" />Tarefas em destaque</h3>
          <div className="mt-3 space-y-2">
            {active.map((task) => (
              <button key={task.id} type="button" onClick={() => onOpen(task)} className="flex w-full items-center gap-2 rounded-lg border p-2.5 text-left transition hover:bg-muted/40">
                {task.status === 'DONE' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Clock3 className="h-4 w-4 text-amber-500" />}
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{task.title}</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ))}
            {!active.length && <p className="py-4 text-center text-xs text-muted-foreground">Sem tarefas ativas.</p>}
          </div>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-violet-500/5 p-4">
          <h3 className="text-sm font-semibold">Visão do quadro</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Metric label="Ativas" value={tasks.filter((task) => task.status !== 'DONE').length} />
            <Metric label="Concluídas" value={tasks.filter((task) => task.status === 'DONE').length} />
            <Metric label="Automáticas" value={tasks.filter((task) => task.isAutomatic).length} />
            <Metric label="Atrasadas" value={tasks.filter(taskIsOverdue).length} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border bg-background/80 p-3"><div className="text-xl font-semibold">{value}</div><div className="text-[10px] text-muted-foreground">{label}</div></div>;
}

function Empty({ title, description }: { title: string; description: string }) {
  return <div className="grid min-h-56 place-items-center p-8 text-center"><div><CalendarDays className="mx-auto mb-3 h-7 w-7 text-muted-foreground/50" /><p className="font-medium">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></div>;
}
