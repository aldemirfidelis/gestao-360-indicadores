'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  FileText,
  GripVertical,
  Lightbulb,
  Link2,
  ListChecks,
  ListTodo,
  MessageSquare,
  Paperclip,
  PlayCircle,
  Plus,
  ScanSearch,
  ShieldAlert,
  Sparkles,
  Target,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn, formatDate } from '@/lib/utils';
import type { TaskBoardData, TaskColumn, TaskRecord } from './task-types';
import {
  checklistProgress,
  initials,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  STICKY_CLASS,
  taskIsOverdue,
} from './task-utils';

interface Props {
  board: TaskBoardData;
  tasks: TaskRecord[];
  moving: boolean;
  onOpen: (task: TaskRecord) => void;
  onMove: (task: TaskRecord, columnId: string, position?: number) => void;
  onAdd: (columnId: string) => void;
}

export function TaskKanbanBoard({ board, tasks, moving, onOpen, onMove, onAdd }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const activeTask = tasks.find((task) => task.id === activeId) ?? null;
  const tasksByColumn = useMemo(
    () => new Map(board.columns.map((column) => [column.id, tasks.filter((task) => task.columnId === column.id)])),
    [board.columns, tasks],
  );

  function drop(columnId: string, position?: number) {
    const task = activeTask;
    setActiveId(null);
    setOverColumnId(null);
    if (!task || (columnId === task.columnId && position === undefined)) return;
    onMove(task, columnId, position);
  }

  return (
    <div className="pb-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-3.5">
        {board.columns.map((column) => (
          <TaskBoardColumn
            key={column.id}
            column={column}
            tasks={tasksByColumn.get(column.id) ?? []}
            activeTask={activeTask}
            over={overColumnId === column.id}
            moving={moving}
            onOpen={onOpen}
            onAdd={onAdd}
            onDragStart={(task) => setActiveId(task.id)}
            onDragEnd={() => {
              setActiveId(null);
              setOverColumnId(null);
            }}
            onDragOver={() => setOverColumnId(column.id)}
            onDrop={(position) => drop(column.id, position)}
          />
        ))}
      </div>
    </div>
  );
}

function TaskBoardColumn({
  column,
  tasks,
  activeTask,
  over,
  moving,
  onOpen,
  onAdd,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  column: TaskColumn;
  tasks: TaskRecord[];
  activeTask: TaskRecord | null;
  over: boolean;
  moving: boolean;
  onOpen: (task: TaskRecord) => void;
  onAdd: (columnId: string) => void;
  onDragStart: (task: TaskRecord) => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: (position?: number) => void;
}) {
  const Icon = columnIcon(column.statusKey);
  const doneTarget = column.isDoneColumn && Boolean(activeTask) && over;

  return (
    <section
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        onDragOver();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      className={cn(
        'flex min-h-[460px] flex-col rounded-2xl border bg-muted/25 p-2 transition-all',
        over && 'border-primary/50 bg-primary/[0.04] shadow-md',
        doneTarget && 'border-2 border-dashed border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30',
      )}
    >
      <header className="mb-2.5 rounded-xl border bg-card p-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-1 rounded-full" style={{ backgroundColor: column.color }} />
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-muted">
            <Icon className="h-4 w-4" style={{ color: column.color }} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">{column.name}</h2>
            <p className="text-[10px] text-muted-foreground">{tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}</p>
          </div>
        </div>
      </header>

      {doneTarget && (
        <div className="mb-2 rounded-xl border border-dashed border-emerald-500 bg-emerald-100/80 px-3 py-5 text-center text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="mx-auto mb-2 h-6 w-6" />
          Solte aqui para marcar como concluída!
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            draggable={!moving}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDragOver();
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDrop(task.position - 0.5);
            }}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', task.id);
              onDragStart(task);
            }}
            onDragEnd={onDragEnd}
            className={cn('transition', activeTask?.id === task.id && 'rotate-2 scale-[1.02] opacity-40')}
          >
            <TaskStickyCard task={task} onOpen={() => onOpen(task)} />
          </div>
        ))}
        {!tasks.length && !doneTarget && (
          <div className={cn('grid min-h-32 flex-1 place-items-center rounded-xl border border-dashed px-5 text-center', activeTask && 'border-primary/40 bg-background/50')}>
            <div>
              <Sparkles className="mx-auto mb-2 h-5 w-5 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground">{activeTask ? 'Solte o post-it nesta coluna' : 'Nenhuma tarefa nesta etapa'}</p>
            </div>
          </div>
        )}
      </div>
      <Button variant="ghost" size="sm" className="mt-2 w-full border border-dashed bg-background/50 text-xs" onClick={() => onAdd(column.id)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />Adicionar tarefa
      </Button>
    </section>
  );
}

export function TaskStickyCard({ task, onOpen }: { task: TaskRecord; onOpen?: () => void }) {
  const overdue = taskIsOverdue(task);
  const checklist = checklistProgress(task);
  const rotation = ((task.id.charCodeAt(0) + task.id.charCodeAt(task.id.length - 1)) % 5) - 2;
  const SourceIcon = sourceIcon(task.sourceType);
  const counts = task._count ?? { comments: 0, attachments: 0, checklistItems: 0, links: 0 };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && onOpen) onOpen();
      }}
      className={cn(
        'group relative cursor-grab overflow-hidden rounded-[14px] border p-3 shadow-[0_5px_14px_rgba(15,23,42,.10)] outline-none transition duration-200 hover:-translate-y-1 hover:rotate-0 hover:shadow-[0_12px_26px_rgba(15,23,42,.16)] focus:ring-2 focus:ring-primary active:cursor-grabbing',
        STICKY_CLASS[task.color] ?? STICKY_CLASS.yellow,
        task.priority === 'CRITICAL' && 'ring-1 ring-rose-400/80',
      )}
      style={{ rotate: `${rotation}deg` }}
    >
      <span className="absolute left-1/2 top-0 h-4 w-16 -translate-x-1/2 -translate-y-1/2 rotate-1 bg-white/55 shadow-sm dark:bg-white/20" aria-hidden />
      <span className="absolute right-3 top-2.5 h-2.5 w-2.5 rounded-full border border-black/10 bg-rose-400 shadow-sm" aria-hidden />
      <div className="mb-2.5 flex items-center gap-1.5">
        {task.isAutomatic ? (
          <Badge className="border-0 bg-violet-600 px-2 py-0.5 text-[9px] text-white hover:bg-violet-600"><Bot className="mr-1 h-3 w-3" />Automática</Badge>
        ) : (
          <Badge variant="outline" className="border-black/10 bg-white/45 px-2 py-0.5 text-[9px]">Manual</Badge>
        )}
        <Badge variant="outline" className={cn('ml-auto px-1.5 py-0.5 text-[9px]', PRIORITY_CLASS[task.priority])}>
          {task.priority === 'CRITICAL' && <ShieldAlert className="mr-1 h-3 w-3" />}
          {PRIORITY_LABEL[task.priority]}
        </Badge>
        <GripVertical className="h-4 w-4 text-foreground/30 opacity-0 transition group-hover:opacity-100" />
      </div>

      <h3 className="line-clamp-3 text-[14px] font-semibold leading-snug text-slate-900 dark:text-slate-50">{task.title}</h3>
      {task.isAutomatic && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-violet-700 dark:text-violet-200">
          <SourceIcon className="h-3.5 w-3.5" />
          <span className="truncate">Origem: {task.sourceModule ?? task.sourceType}</span>
        </div>
      )}
      {task.area && <p className="mt-1 truncate text-[10px] text-slate-600 dark:text-slate-300">Área: {task.area.name}</p>}

      <div className="mt-3 flex flex-wrap gap-1">
        {(task.tags ?? []).slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full border border-black/5 bg-white/40 px-2 py-0.5 text-[9px] font-medium dark:bg-white/10">{tag}</span>
        ))}
      </div>

      {counts.checklistItems > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[9px] text-muted-foreground">
            <span>Subtarefas</span><span>{checklist}%</span>
          </div>
          <Progress value={checklist} className="h-1.5 bg-white/50" />
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-black/[.07] pt-2.5 text-[10px] text-slate-600 dark:text-slate-300">
        <span className={cn('flex items-center gap-1', overdue && 'font-semibold text-rose-700 dark:text-rose-300')}>
          {overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
          {task.dueDate ? formatDate(task.dueDate) : 'Sem prazo'}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {counts.comments > 0 && <span className="flex items-center gap-0.5"><MessageSquare className="h-3.5 w-3.5" />{counts.comments}</span>}
          {counts.attachments > 0 && <span className="flex items-center gap-0.5"><Paperclip className="h-3.5 w-3.5" />{counts.attachments}</span>}
          {counts.links > 0 && <Link2 className="h-3.5 w-3.5" />}
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full border-2 border-white/70 bg-slate-800 text-[9px] font-bold text-white shadow-sm">
          {task.assignee?.avatarUrl ? <Image src={task.assignee.avatarUrl} alt="" width={28} height={28} unoptimized className="h-full w-full object-cover" /> : initials(task.assignee?.name)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[10px] font-medium">{task.assignee?.name ?? 'Sem responsável'}</span>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-white/50 opacity-0 transition group-hover:opacity-100">
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}

function columnIcon(status: string) {
  if (status === 'IDEA') return Lightbulb;
  if (status === 'TODO') return ListTodo;
  if (status === 'IN_PROGRESS') return PlayCircle;
  if (status === 'REVIEW') return ScanSearch;
  return CheckCircle2;
}

function sourceIcon(source: string) {
  if (source.includes('INDICATOR')) return Target;
  if (source.includes('DOCUMENT')) return FileText;
  if (source.includes('RISK') || source.includes('NONCONFORM')) return ShieldAlert;
  if (source.includes('CHECKLIST') || source.includes('FORM')) return ListChecks;
  if (source.includes('USER') || source === 'MANUAL') return CircleUserRound;
  return Bot;
}
