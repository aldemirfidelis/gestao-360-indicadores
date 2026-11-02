'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
import { findContainer, moveItem, placement, type Containers } from '@/lib/board-order';
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
  onOpen: (task: TaskRecord) => void;
  onMove: (task: TaskRecord, columnId: string, position: number) => void;
  onAdd: (columnId: string) => void;
}

/** Ids das tarefas por coluna, na ordem do servidor: posição crescente, empates na ordem recebida. */
function columnsOf(board: TaskBoardData, tasks: TaskRecord[]): Containers {
  const containers: Containers = Object.fromEntries(board.columns.map((column) => [column.id, [] as string[]]));
  const ordered = tasks.map((task, index) => ({ task, index })).sort((a, b) => a.task.position - b.task.position || a.index - b.index);
  for (const { task } of ordered) containers[task.columnId]?.push(task.id);
  return containers;
}

const SCREEN_READER_INSTRUCTIONS = {
  draggable: 'Para mover a tarefa, pressione espaço, use as setas para escolher a etapa e a posição e pressione espaço de novo para soltar. Esc cancela.',
};

/**
 * Kanban com arraste por ponteiro (@dnd-kit): mouse, toque (tocar e segurar) e
 * teclado. Enquanto arrasta, a ordem exibida é local; ao soltar, só a posição
 * final vai para o servidor e a ordem local segue até o cache refletir a mudança.
 */
export function TaskKanbanBoard({ board, tasks, onOpen, onMove, onAdd }: Props) {
  const { user } = useAuth();
  const readOnly = Boolean(user?.isDemo);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const columnById = useMemo(() => new Map(board.columns.map((column) => [column.id, column])), [board.columns]);
  const base = useMemo(() => columnsOf(board, tasks), [board, tasks]);
  const [draft, setDraftState] = useState<Containers | null>(null);
  const draftRef = useRef<Containers | null>(null);
  const startRef = useRef<Containers | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const containers = draft ?? base;
  const activeTask = activeId ? taskById.get(activeId) ?? null : null;
  const activeColumnId = activeId ? findContainer(containers, activeId) ?? null : null;
  const startColumnId = activeId && startRef.current ? findContainer(startRef.current, activeId) ?? null : null;

  function setDraft(next: Containers | null) {
    draftRef.current = next;
    setDraftState(next);
  }

  // O cache mudou (movimento otimista, desfeito ou dados novos): volta a seguir o servidor.
  useEffect(() => {
    if (!startRef.current) setDraft(null);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    // Enter abre a tarefa; espaço pega e solta.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  const titleOf = (id: UniqueIdentifier) => taskById.get(String(id))?.title ?? 'tarefa';
  const placeOf = (id: UniqueIdentifier) => {
    const current = draftRef.current ?? base;
    const columnId = findContainer(current, String(id));
    const column = columnId ? columnById.get(columnId) : undefined;
    if (!column || !columnId) return 'fora das etapas';
    const index = current[columnId].indexOf(String(id));
    return index >= 0 ? `${column.name}, posição ${index + 1} de ${current[columnId].length}` : column.name;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Tarefa "${titleOf(active.id)}" pega em ${placeOf(active.id)}.`,
    onDragOver: ({ active }) => `Tarefa "${titleOf(active.id)}" em ${placeOf(active.id)}.`,
    onDragEnd: ({ active, over }) => (over ? `Tarefa "${titleOf(active.id)}" solta em ${placeOf(active.id)}.` : `Tarefa "${titleOf(active.id)}" voltou ao lugar.`),
    onDragCancel: ({ active }) => `Movimento cancelado. A tarefa "${titleOf(active.id)}" voltou ao lugar.`,
  };

  function handleDragStart({ active }: DragStartEvent) {
    startRef.current = containers;
    setDraft(containers);
    setActiveId(String(active.id));
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    const current = draftRef.current;
    if (!over || !current) return;
    const from = findContainer(current, String(active.id));
    const to = findContainer(current, String(over.id));
    // Dentro da coluna quem anima é o SortableContext; aqui só a troca de etapa.
    if (!from || !to || from === to) return;
    setDraft(moveItem(current, String(active.id), String(over.id)));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    const start = startRef.current;
    const current = draftRef.current ?? base;
    startRef.current = null;
    setActiveId(null);
    const final = over ? moveItem(current, id, String(over.id)) : current;
    const task = taskById.get(id);
    const result = task && start ? placement(start, final, id, (otherId) => taskById.get(otherId)?.position) : null;
    if (!task || !result) {
      setDraft(null);
      return;
    }
    setDraft(final);
    onMove(task, result.container, result.position);
  }

  function handleDragCancel() {
    startRef.current = null;
    setActiveId(null);
    setDraft(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="pb-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-3.5">
          {board.columns.map((column) => (
            <TaskBoardColumn
              key={column.id}
              column={column}
              taskIds={containers[column.id] ?? []}
              taskById={taskById}
              dragging={Boolean(activeTask)}
              over={activeColumnId === column.id}
              doneTarget={column.isDoneColumn && activeColumnId === column.id && startColumnId !== column.id}
              readOnly={readOnly}
              onOpen={onOpen}
              onAdd={onAdd}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' }}>
        {activeTask ? (
          <div className="rotate-2 scale-[1.03] cursor-grabbing drop-shadow-2xl">
            <TaskStickyCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function TaskBoardColumn({
  column,
  taskIds,
  taskById,
  dragging,
  over,
  doneTarget,
  readOnly,
  onOpen,
  onAdd,
}: {
  column: TaskColumn;
  taskIds: string[];
  taskById: Map<string, TaskRecord>;
  dragging: boolean;
  over: boolean;
  doneTarget: boolean;
  readOnly: boolean;
  onOpen: (task: TaskRecord) => void;
  onAdd: (columnId: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: column.id, disabled: readOnly });
  const Icon = columnIcon(column.statusKey);
  const tasks = taskIds.flatMap((id) => {
    const task = taskById.get(id);
    return task ? [task] : [];
  });

  return (
    <section
      ref={setNodeRef}
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

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-3">
          {tasks.map((task) => (
            <SortableTask key={task.id} task={task} disabled={readOnly} onOpen={onOpen} />
          ))}
          {!tasks.length && !doneTarget && (
            <div className={cn('grid min-h-32 flex-1 place-items-center rounded-xl border border-dashed px-5 text-center', dragging && 'border-primary/40 bg-background/50')}>
              <div>
                <Sparkles className="mx-auto mb-2 h-5 w-5 text-muted-foreground/60" />
                <p className="text-xs text-muted-foreground">{dragging ? 'Solte o post-it nesta coluna' : 'Nenhuma tarefa nesta etapa'}</p>
              </div>
            </div>
          )}
        </div>
      </SortableContext>
      <Button variant="ghost" size="sm" className="mt-2 w-full border border-dashed bg-background/50 text-xs" disabled={readOnly} onClick={() => onAdd(column.id)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />Adicionar tarefa
      </Button>
    </section>
  );
}

function SortableTask({ task, disabled, onOpen }: { task: TaskRecord; disabled: boolean; onOpen: (task: TaskRecord) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // O lugar onde o card vai cair fica marcado enquanto a cópia flutua com o ponteiro.
      className={cn('touch-manipulation rounded-[14px]', isDragging && 'opacity-40 outline-dashed outline-2 outline-offset-2 outline-primary/60')}
    >
      <TaskStickyCard task={task} onOpen={() => onOpen(task)} dragAttributes={disabled ? undefined : attributes} dragListeners={disabled ? undefined : listeners} />
    </div>
  );
}

export function TaskStickyCard({
  task,
  onOpen,
  dragAttributes,
  dragListeners,
}: {
  task: TaskRecord;
  onOpen?: () => void;
  dragAttributes?: DraggableAttributes;
  dragListeners?: DraggableSyntheticListeners;
}) {
  const overdue = taskIsOverdue(task);
  const checklist = checklistProgress(task);
  const rotation = ((task.id.charCodeAt(0) + task.id.charCodeAt(task.id.length - 1)) % 5) - 2;
  const SourceIcon = sourceIcon(task.sourceType);
  const counts = task._count ?? { comments: 0, attachments: 0, checklistItems: 0, links: 0 };
  const draggable = Boolean(dragListeners);

  return (
    <article
      role="button"
      tabIndex={0}
      {...dragAttributes}
      {...dragListeners}
      aria-roledescription={draggable ? 'tarefa arrastável' : undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && onOpen) {
          event.preventDefault();
          onOpen();
          return;
        }
        dragListeners?.onKeyDown?.(event);
      }}
      className={cn(
        'group relative overflow-hidden rounded-[14px] border p-3 shadow-[0_5px_14px_rgba(15,23,42,.10)] outline-none transition duration-200 hover:-translate-y-1 hover:rotate-0 hover:shadow-[0_12px_26px_rgba(15,23,42,.16)] focus:ring-2 focus:ring-primary',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
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
        {draggable && <GripVertical className="h-4 w-4 text-foreground/30 opacity-0 transition group-hover:opacity-100" />}
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
