'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BookOpenText,
  CalendarDays,
  Columns3,
  GanttChartSquare,
  LayoutList,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CreateTaskDialog } from './create-task-dialog';
import { TaskKanbanBoard } from './task-board';
import { TaskDetailsDrawer } from './task-details-drawer';
import { TaskFilters } from './task-filters';
import { TaskSummaryCards } from './task-summary-cards';
import {
  EMPTY_FILTERS,
  type TaskBoardResponse,
  type TaskContext,
  type TaskFiltersState,
  type TaskRecord,
  type TaskView,
} from './task-types';
import { TaskCalendarView, TaskListView, TaskTimelineView, TaskWikiView } from './task-views';
import { initials } from './task-utils';

const VIEWS: Array<{ value: TaskView; label: string; icon: typeof Columns3 }> = [
  { value: 'kanban', label: 'Kanban', icon: Columns3 },
  { value: 'list', label: 'Lista', icon: LayoutList },
  { value: 'calendar', label: 'Calendário', icon: CalendarDays },
  { value: 'timeline', label: 'Cronograma', icon: GanttChartSquare },
  { value: 'wiki', label: 'Wiki / Página do Projeto', icon: BookOpenText },
];

export function TasksWorkspace() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [view, setView] = useState<TaskView>('kanban');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [filters, setFilters] = useState<TaskFiltersState>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [initialColumnId, setInitialColumnId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [compactHeader, setCompactHeader] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setView(normalizeView(params.get('view')));
    setTaskId(params.get('task'));
    try {
      const saved = JSON.parse(window.localStorage.getItem('g360.tasks.preferences') ?? '{}') as { showSummary?: boolean; compactHeader?: boolean };
      if (typeof saved.showSummary === 'boolean') setShowSummary(saved.showSummary);
      if (typeof saved.compactHeader === 'boolean') setCompactHeader(saved.compactHeader);
    } catch {
      // Preferência local inválida: usa os padrões visuais.
    }
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (deferredSearch.trim()) params.set('q', deferredSearch.trim());
    if (filters.scope !== 'all') params.set('scope', filters.scope);
    if (filters.kind !== 'all') params.set('kind', filters.kind);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.status) params.set('status', filters.status);
    if (filters.origin) params.set('origin', filters.origin);
    if (filters.assigneeId) params.set('assigneeId', filters.assigneeId);
    if (filters.areaId) params.set('areaId', filters.areaId);
    if (filters.projectId) params.set('projectId', filters.projectId);
    if (filters.overdue) params.set('overdue', 'true');
    if (filters.linked) params.set('linked', filters.linked);
    if (filters.due) params.set('due', filters.due);
    return params.toString();
  }, [deferredSearch, filters]);
  const boardKey = useMemo(() => ['task-board', queryString] as const, [queryString]);

  const board = useQuery<TaskBoardResponse>({
    queryKey: boardKey,
    queryFn: () => api(`/tasks/board${queryString ? `?${queryString}` : ''}`),
  });
  const context = useQuery<TaskContext>({
    queryKey: ['task-context'],
    queryFn: () => api('/tasks/context'),
    staleTime: 5 * 60_000,
  });

  const refresh = useMutation({
    mutationFn: () => api('/my-day/refresh', { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['task-board'] });
      toast.success('Central de Trabalho atualizada');
    },
    onError: notifyError,
  });
  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api<TaskRecord>('/tasks', { method: 'POST', json: payload }),
    onSuccess: async (task) => {
      setCreateOpen(false);
      setInitialColumnId(null);
      await queryClient.invalidateQueries({ queryKey: ['task-board'] });
      toast.success('Tarefa criada no quadro');
      openTask(task);
    },
    onError: notifyError,
  });
  const move = useMutation({
    mutationFn: ({ task, columnId, position }: { task: TaskRecord; columnId: string; position?: number }) =>
      api(`/tasks/${task.id}/move`, { method: 'POST', json: { columnId, position } }),
    onMutate: async ({ task, columnId, position }) => {
      await queryClient.cancelQueries({ queryKey: boardKey });
      const previous = queryClient.getQueryData<TaskBoardResponse>(boardKey);
      queryClient.setQueryData<TaskBoardResponse>(boardKey, (current) => {
        if (!current) return current;
        const column = current.board.columns.find((item) => item.id === columnId);
        if (!column) return current;
        const tasks = current.tasks.map((item) =>
          item.id === task.id
            ? {
                ...item,
                columnId,
                status: column.statusKey,
                position: position ?? Math.max(0, ...current.tasks.filter((other) => other.columnId === columnId).map((other) => other.position)) + 1000,
                completedAt: column.isDoneColumn ? new Date().toISOString() : null,
              }
            : item,
        );
        const done = tasks.filter((item) => item.status === 'DONE').length;
        return { ...current, tasks, summary: { ...current.summary, done, progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0 } };
      });
      return { previous };
    },
    onSuccess: () => toast.success('Tarefa movida', { duration: 1400 }),
    onError: (error, _variables, contextValue) => {
      if (contextValue?.previous) queryClient.setQueryData(boardKey, contextValue.previous);
      notifyError(error);
    },
    onSettled: async (_data, _error, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['task-board'] }),
        queryClient.invalidateQueries({ queryKey: ['task-detail', variables.task.id] }),
      ]);
    },
  });
  const saveWiki = useMutation({
    mutationFn: (content: string) => api('/tasks/board/wiki', { method: 'PATCH', json: { content } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['task-board'] });
      toast.success('Página do projeto salva');
    },
    onError: notifyError,
  });

  function changeView(next: TaskView) {
    setView(next);
    updateLocation({ view: next, task: taskId });
  }

  function openTask(task: TaskRecord) {
    setTaskId(task.id);
    updateLocation({ view, task: task.id });
  }

  function closeTask() {
    setTaskId(null);
    updateLocation({ view, task: null });
  }

  function openCreate(columnId?: string) {
    setInitialColumnId(columnId ?? null);
    setCreateOpen(true);
  }

  function updateLocation(values: { view: TaskView; task: string | null }) {
    const params = new URLSearchParams(window.location.search);
    values.view === 'kanban' ? params.delete('view') : params.set('view', values.view);
    values.task ? params.set('task', values.task) : params.delete('task');
    const suffix = params.toString();
    window.history.replaceState(null, '', `/tarefas${suffix ? `?${suffix}` : ''}`);
  }

  function savePreferences() {
    window.localStorage.setItem('g360.tasks.preferences', JSON.stringify({ showSummary, compactHeader }));
    setPersonalizeOpen(false);
    toast.success('Preferências visuais salvas');
  }

  const data = board.data;

  return (
    <div className="space-y-4">
      <section className={cn('relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-primary/[0.045]', compactHeader ? 'p-4' : 'p-5 lg:p-6')}>
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.16em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />Tarefas — Central de Trabalho
            </div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Central de Trabalho da Equipe</h1>
            {!compactHeader && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Todas as tarefas manuais e automáticas da empresa organizadas em um quadro visual, simples e interativo.</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setFiltersOpen((open) => !open)}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />Filtros
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPersonalizeOpen(true)}>
              <Settings2 className="mr-2 h-4 w-4" />Personalizar
            </Button>
            <Button size="sm" onClick={() => openCreate()}>
              <Plus className="mr-2 h-4 w-4" />Nova tarefa
            </Button>
            <Button variant="ghost" size="icon" title="Abrir alertas" onClick={() => router.push('/meu-dia')}>
              <Bell className="h-4 w-4" />
            </Button>
            <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border-2 border-background bg-primary text-xs font-semibold text-primary-foreground shadow-sm" title={user?.name}>
              {user?.avatarUrl ? <Image src={user.avatarUrl} alt={user.name} width={36} height={36} unoptimized className="h-full w-full object-cover" /> : initials(user?.name)}
            </span>
          </div>
        </div>
        <div className="relative mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 bg-background/80 pl-10 shadow-sm"
              placeholder="Pesquisar tarefas, documentos, pessoas..."
            />
          </label>
          <div className="flex items-center gap-1 overflow-x-auto rounded-xl border bg-background/75 p-1">
            {VIEWS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => changeView(item.value)}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition',
                    view === item.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />{item.label}
                </button>
              );
            })}
          </div>
          <Button variant="ghost" size="icon" onClick={() => refresh.mutate()} disabled={refresh.isPending} title="Atualizar tarefas automáticas">
            <RefreshCw className={cn('h-4 w-4', refresh.isPending && 'animate-spin')} />
          </Button>
        </div>
      </section>

      <TaskFilters open={filtersOpen} filters={filters} context={context.data} onChange={setFilters} onClose={() => setFiltersOpen(false)} />

      {data && showSummary && <TaskSummaryCards summary={data.summary} />}

      {board.isLoading && (
        <div className="grid min-h-[520px] place-items-center rounded-2xl border bg-card">
          <div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Organizando a Central de Trabalho...</p></div>
        </div>
      )}
      {board.isError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
          Não foi possível carregar as tarefas. <button className="font-semibold underline" onClick={() => board.refetch()}>Tentar novamente</button>
        </div>
      )}
      {data && view === 'kanban' && (
        <TaskKanbanBoard
          board={data.board}
          tasks={data.tasks}
          moving={move.isPending}
          onOpen={openTask}
          onMove={(task, columnId, position) => move.mutate({ task, columnId, position })}
          onAdd={openCreate}
        />
      )}
      {data && view === 'list' && <TaskListView tasks={data.tasks} onOpen={openTask} />}
      {data && view === 'calendar' && <TaskCalendarView tasks={data.tasks} onOpen={openTask} />}
      {data && view === 'timeline' && <TaskTimelineView tasks={data.tasks} onOpen={openTask} />}
      {data && view === 'wiki' && <TaskWikiView board={data.board} tasks={data.tasks} saving={saveWiki.isPending} onSave={(content) => saveWiki.mutate(content)} onOpen={openTask} />}

      <CreateTaskDialog
        open={createOpen}
        board={data?.board}
        context={context.data}
        initialColumnId={initialColumnId}
        submitting={create.isPending}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setInitialColumnId(null);
        }}
        onSubmit={(payload) => create.mutate(payload)}
      />
      <TaskDetailsDrawer taskId={taskId} context={context.data} onClose={closeTask} />
      <Dialog open={personalizeOpen} onOpenChange={setPersonalizeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Personalizar Central de Trabalho</DialogTitle>
            <DialogDescription>Estas preferências ficam salvas neste navegador.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Preference checked={showSummary} onChange={setShowSummary} title="Exibir cards de resumo" description="Mostra totais, atrasos e progresso antes do quadro." />
            <Preference checked={compactHeader} onChange={setCompactHeader} title="Cabeçalho compacto" description="Reduz a altura da apresentação da página." />
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setPersonalizeOpen(false)}>Cancelar</Button><Button onClick={savePreferences}>Salvar preferências</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Preference({ checked, onChange, title, description }: { checked: boolean; onChange: (checked: boolean) => void; title: string; description: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition hover:bg-muted/30">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs text-muted-foreground">{description}</span></span>
    </label>
  );
}

function normalizeView(value: string | null): TaskView {
  return VIEWS.some((view) => view.value === value) ? (value as TaskView) : 'kanban';
}

function notifyError(error: unknown) {
  toast.error(error instanceof Error ? error.message : 'Não foi possível concluir a operação.');
}
