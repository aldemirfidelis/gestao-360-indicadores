'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Archive,
  Bot,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FilePlus2,
  Link2,
  ListChecks,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Save,
  Send,
  Tag,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { TaskContext, TaskDetail } from './task-types';
import {
  formatDateTime,
  initials,
  inputDate,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  STATUS_LABEL,
  taskIsOverdue,
} from './task-utils';

interface Props {
  taskId: string | null;
  context?: TaskContext;
  onClose: () => void;
}

export function TaskDetailsDrawer({ taskId, context, onClose }: Props) {
  const queryClient = useQueryClient();
  const detail = useQuery<TaskDetail>({
    queryKey: ['task-detail', taskId],
    queryFn: () => api(`/tasks/${taskId}`),
    enabled: Boolean(taskId),
  });

  useEffect(() => {
    if (!taskId) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose, taskId]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['task-detail', taskId] }),
      queryClient.invalidateQueries({ queryKey: ['task-board'] }),
    ]);
  };
  const archive = useMutation({
    mutationFn: () => api(`/tasks/${taskId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success('Tarefa arquivada');
      await refresh();
      onClose();
    },
    onError: notifyError,
  });

  if (!taskId) return null;
  const task = detail.data;

  return (
    <div className="fixed inset-0 z-[70]">
      <button type="button" aria-label="Fechar detalhes" onClick={onClose} className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[720px] flex-col border-l bg-background shadow-2xl animate-in slide-in-from-right duration-300">
        <header className="flex items-start gap-3 border-b px-5 py-4">
          <div className={cn('mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl', task?.isAutomatic ? 'bg-violet-100 text-violet-700' : 'bg-primary/10 text-primary')}>
            {task?.isAutomatic ? <Bot className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={task?.isAutomatic ? 'default' : 'outline'}>{task?.isAutomatic ? '⚡ Automática' : 'Manual'}</Badge>
              {task && <Badge variant="outline" className={PRIORITY_CLASS[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>}
              {task && taskIsOverdue(task) && <Badge className="bg-rose-600">Atrasada</Badge>}
            </div>
            <h2 className="mt-2 pr-3 text-lg font-semibold leading-snug">{task?.title ?? 'Carregando tarefa...'}</h2>
          </div>
          <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => task && window.confirm('Arquivar esta tarefa?') && archive.mutate()} disabled={!task || archive.isPending}>
            <Archive className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={onClose}><X className="h-5 w-5" /></Button>
        </header>

        {detail.isLoading && <div className="grid flex-1 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>}
        {detail.isError && <div className="m-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Não foi possível carregar os detalhes desta tarefa.</div>}
        {task && (
          <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col">
            <div className="overflow-x-auto border-b px-4">
              <TabsList className="h-12 min-w-max bg-transparent p-0">
                <Tab value="details" label="Detalhes" />
                <Tab value="checklist" label="Subtarefas" count={task.checklistItems.length} />
                <Tab value="comments" label="Comentários" count={task.comments.length} />
                <Tab value="attachments" label="Anexos" count={task.attachments.length} />
                <Tab value="activity" label="Atividades" count={task.activities.length} />
                <Tab value="links" label="Vínculos" count={task.links.length} />
              </TabsList>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <TabsContent value="details" className="m-0"><DetailsTab task={task} context={context} onChanged={refresh} /></TabsContent>
              <TabsContent value="checklist" className="m-0"><ChecklistTab task={task} onChanged={refresh} /></TabsContent>
              <TabsContent value="comments" className="m-0"><CommentsTab task={task} onChanged={refresh} /></TabsContent>
              <TabsContent value="attachments" className="m-0"><AttachmentsTab task={task} onChanged={refresh} /></TabsContent>
              <TabsContent value="activity" className="m-0"><ActivityTab task={task} /></TabsContent>
              <TabsContent value="links" className="m-0"><LinksTab task={task} onChanged={refresh} /></TabsContent>
            </div>
          </Tabs>
        )}
      </aside>
    </div>
  );
}

function DetailsTab({ task, context, onChanged }: { task: TaskDetail; context?: TaskContext; onChanged: () => Promise<void> }) {
  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? '',
    priority: task.priority,
    assigneeId: task.assigneeId ?? '',
    areaId: task.areaId ?? '',
    projectId: task.projectId ?? '',
    startDate: inputDate(task.startDate),
    dueDate: inputDate(task.dueDate),
    tags: (task.tags ?? []).join(', '),
    color: task.color,
  });
  useEffect(() => {
    setForm({
      title: task.title,
      description: task.description ?? '',
      priority: task.priority,
      assigneeId: task.assigneeId ?? '',
      areaId: task.areaId ?? '',
      projectId: task.projectId ?? '',
      startDate: inputDate(task.startDate),
      dueDate: inputDate(task.dueDate),
      tags: (task.tags ?? []).join(', '),
      color: task.color,
    });
  }, [task]);
  const save = useMutation({
    mutationFn: () => api(`/tasks/${task.id}`, {
      method: 'PATCH',
      json: {
        ...form,
        assigneeId: form.assigneeId || null,
        areaId: form.areaId || null,
        projectId: form.projectId || null,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      },
    }),
    onSuccess: async () => {
      toast.success('Tarefa atualizada');
      await onChanged();
    },
    onError: notifyError,
  });
  const move = useMutation({
    mutationFn: (columnId: string) => api(`/tasks/${task.id}/move`, { method: 'POST', json: { columnId } }),
    onSuccess: async () => {
      toast.success('Etapa atualizada');
      await onChanged();
    },
    onError: notifyError,
  });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-5 p-5">
      {task.isAutomatic && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-4 dark:border-violet-800 dark:bg-violet-950/40">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-800 dark:text-violet-200"><Bot className="h-4 w-4" />Origem automática</div>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <Info label="Módulo" value={task.sourceModule ?? task.sourceType} />
            <Info label="Registro vinculado" value={task.sourceEntityLabel ?? task.sourceEntityId ?? '—'} />
            <Info label="Gerada em" value={formatDateTime(task.generatedAt)} />
            <Info label="Gerada por" value="Sistema" />
          </dl>
          {task.sourceUrl && (
            <Button size="sm" variant="outline" className="mt-3 bg-background" asChild>
              <a href={task.sourceUrl}><ExternalLink className="mr-2 h-4 w-4" />Abrir origem</a>
            </Button>
          )}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status">
          <NativeSelect value={task.columnId} onChange={(event) => move.mutate(event.target.value)} disabled={move.isPending}>
            {task.board.columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Prioridade">
          <NativeSelect value={form.priority} onChange={(event) => set('priority', event.target.value)}>
            <option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option>
          </NativeSelect>
        </Field>
      </div>
      <Field label="Título"><Input value={form.title} onChange={(event) => set('title', event.target.value)} /></Field>
      <Field label="Descrição"><Textarea rows={6} value={form.description} onChange={(event) => set('description', event.target.value)} placeholder="Adicione o contexto e o resultado esperado..." /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Responsável" icon={<UserRound className="h-3.5 w-3.5" />}>
          <NativeSelect value={form.assigneeId} onChange={(event) => set('assigneeId', event.target.value)}>
            <option value="">Sem responsável</option>
            {context?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Área">
          <NativeSelect value={form.areaId} onChange={(event) => set('areaId', event.target.value)}>
            <option value="">Sem área</option>
            {context?.areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Projeto">
          <NativeSelect value={form.projectId} onChange={(event) => set('projectId', event.target.value)}>
            <option value="">Sem projeto</option>
            {context?.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Etiquetas" icon={<Tag className="h-3.5 w-3.5" />}><Input value={form.tags} onChange={(event) => set('tags', event.target.value)} placeholder="qualidade, rotina" /></Field>
        <Field label="Data inicial"><Input type="date" value={form.startDate} onChange={(event) => set('startDate', event.target.value)} /></Field>
        <Field label="Prazo"><Input type="date" value={form.dueDate} onChange={(event) => set('dueDate', event.target.value)} /></Field>
      </div>
      <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim()}>
        <Save className="mr-2 h-4 w-4" />{save.isPending ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </div>
  );
}

function ChecklistTab({ task, onChanged }: { task: TaskDetail; onChanged: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const add = useMutation({
    mutationFn: () => api(`/tasks/${task.id}/checklist`, { method: 'POST', json: { title } }),
    onSuccess: async () => {
      setTitle('');
      await onChanged();
    },
    onError: notifyError,
  });
  const toggle = useMutation({
    mutationFn: ({ id, isDone }: { id: string; isDone: boolean }) => api(`/tasks/${task.id}/checklist/${id}`, { method: 'PATCH', json: { isDone } }),
    onSuccess: onChanged,
    onError: notifyError,
  });
  const completed = task.checklistItems.filter((item) => item.isDone).length;

  return (
    <div className="p-5">
      <SectionTitle icon={<ListChecks />} title="Subtarefas e checklist" description={`${completed} de ${task.checklistItems.length} concluídas`} />
      <div className="mt-4 flex gap-2">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Adicionar item..." onKeyDown={(event) => event.key === 'Enter' && title.trim() && add.mutate()} />
        <Button onClick={() => add.mutate()} disabled={!title.trim() || add.isPending}><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="mt-4 space-y-2">
        {task.checklistItems.map((item) => (
          <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition hover:bg-muted/35">
            <button
              type="button"
              onClick={() => toggle.mutate({ id: item.id, isDone: !item.isDone })}
              className={cn('grid h-5 w-5 place-items-center rounded border', item.isDone ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-muted-foreground/40')}
            >
              {item.isDone && <Check className="h-3.5 w-3.5" />}
            </button>
            <span className={cn('text-sm', item.isDone && 'text-muted-foreground line-through')}>{item.title}</span>
          </label>
        ))}
        {!task.checklistItems.length && <EmptyBlock icon={<ListChecks />} text="Nenhuma subtarefa criada." />}
      </div>
    </div>
  );
}

function CommentsTab({ task, onChanged }: { task: TaskDetail; onChanged: () => Promise<void> }) {
  const [content, setContent] = useState('');
  const add = useMutation({
    mutationFn: () => api(`/tasks/${task.id}/comments`, { method: 'POST', json: { content } }),
    onSuccess: async () => {
      setContent('');
      await onChanged();
    },
    onError: notifyError,
  });
  return (
    <div className="p-5">
      <SectionTitle icon={<MessageSquare />} title="Comentários" description="Converse com a equipe mantendo o contexto da tarefa." />
      <div className="mt-4 rounded-xl border bg-muted/20 p-3">
        <Textarea rows={3} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Escreva um comentário..." />
        <div className="mt-2 flex justify-end"><Button size="sm" onClick={() => add.mutate()} disabled={!content.trim() || add.isPending}><Send className="mr-2 h-3.5 w-3.5" />Comentar</Button></div>
      </div>
      <div className="mt-5 space-y-4">
        {task.comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">{initials(comment.user?.name)}</span>
            <div className="min-w-0 flex-1 rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold">{comment.user?.name ?? 'Usuário'}</span>
                <span className="text-[10px] text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{comment.content}</p>
            </div>
          </div>
        ))}
        {!task.comments.length && <EmptyBlock icon={<MessageSquare />} text="Seja a primeira pessoa a comentar." />}
      </div>
    </div>
  );
}

function AttachmentsTab({ task, onChanged }: { task: TaskDetail; onChanged: () => Promise<void> }) {
  const [form, setForm] = useState({ fileName: '', fileUrl: '' });
  const add = useMutation({
    mutationFn: () => api(`/tasks/${task.id}/attachments`, { method: 'POST', json: form }),
    onSuccess: async () => {
      setForm({ fileName: '', fileUrl: '' });
      await onChanged();
    },
    onError: notifyError,
  });
  return (
    <div className="p-5">
      <SectionTitle icon={<Paperclip />} title="Anexos" description="Vincule arquivos já armazenados no GED ou em uma URL autorizada." />
      <div className="mt-4 grid gap-2 rounded-xl border bg-muted/20 p-3 sm:grid-cols-[1fr_1.4fr_auto]">
        <Input placeholder="Nome do arquivo" value={form.fileName} onChange={(event) => setForm({ ...form, fileName: event.target.value })} />
        <Input placeholder="https://... ou /documents/..." value={form.fileUrl} onChange={(event) => setForm({ ...form, fileUrl: event.target.value })} />
        <Button onClick={() => add.mutate()} disabled={!form.fileName.trim() || !form.fileUrl.trim() || add.isPending}><FilePlus2 className="h-4 w-4" /></Button>
      </div>
      <div className="mt-4 space-y-2">
        {task.attachments.map((attachment) => (
          <a key={attachment.id} href={attachment.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border p-3 transition hover:bg-muted/35">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-100 text-blue-700"><Paperclip className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{attachment.fileName}</p><p className="text-[10px] text-muted-foreground">{formatDateTime(attachment.createdAt)}</p></div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
        ))}
        {!task.attachments.length && <EmptyBlock icon={<Paperclip />} text="Nenhum anexo vinculado." />}
      </div>
    </div>
  );
}

function ActivityTab({ task }: { task: TaskDetail }) {
  return (
    <div className="p-5">
      <SectionTitle icon={<Activity />} title="Histórico de atividades" description="Rastreabilidade das principais ações desta tarefa." />
      <div className="relative mt-5 space-y-0 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-border">
        {task.activities.map((activity) => (
          <div key={activity.id} className="relative flex gap-3 pb-5">
            <span className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-background"><Activity className="h-3.5 w-3.5 text-primary" /></span>
            <div className="pt-0.5">
              <p className="text-sm"><span className="font-semibold">{activity.user?.name ?? 'Sistema'}</span> {activityLabel(activity.action, activity.fromValue, activity.toValue)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(activity.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LinksTab({ task, onChanged }: { task: TaskDetail; onChanged: () => Promise<void> }) {
  const [form, setForm] = useState({ moduleName: '', entityType: '', entityId: '', entityLabel: '', url: '' });
  const add = useMutation({
    mutationFn: () => api(`/tasks/${task.id}/links`, { method: 'POST', json: form }),
    onSuccess: async () => {
      setForm({ moduleName: '', entityType: '', entityId: '', entityLabel: '', url: '' });
      await onChanged();
    },
    onError: notifyError,
  });
  return (
    <div className="p-5">
      <SectionTitle icon={<Link2 />} title="Vínculos com outros módulos" description="A origem automática é protegida; vínculos complementares podem ser adicionados." />
      <div className="mt-4 grid gap-2 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2">
        <Input placeholder="Módulo (ex.: Documentos)" value={form.moduleName} onChange={(event) => setForm({ ...form, moduleName: event.target.value })} />
        <Input placeholder="Tipo (ex.: DOCUMENT)" value={form.entityType} onChange={(event) => setForm({ ...form, entityType: event.target.value })} />
        <Input placeholder="ID do registro" value={form.entityId} onChange={(event) => setForm({ ...form, entityId: event.target.value })} />
        <Input placeholder="Nome do registro" value={form.entityLabel} onChange={(event) => setForm({ ...form, entityLabel: event.target.value })} />
        <Input className="sm:col-span-2" placeholder="Rota ou URL para abrir" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} />
        <Button className="sm:col-span-2" variant="outline" onClick={() => add.mutate()} disabled={!form.moduleName || !form.entityType || !form.entityId || !form.entityLabel || add.isPending}>
          <Plus className="mr-2 h-4 w-4" />Adicionar vínculo
        </Button>
      </div>
      <div className="mt-4 space-y-2">
        {task.links.map((link) => (
          <a key={link.id} href={link.url ?? '#'} className="flex items-center gap-3 rounded-lg border p-3 transition hover:bg-muted/35">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-100 text-violet-700"><Link2 className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{link.entityLabel}</p><p className="text-[10px] text-muted-foreground">{link.moduleName} · {link.entityType}</p></div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </a>
        ))}
        {!task.links.length && <EmptyBlock icon={<Link2 />} text="Nenhum vínculo cadastrado." />}
      </div>
    </div>
  );
}

function Tab({ value, label, count }: { value: string; label: string; count?: number }) {
  return <TabsTrigger value={value} className="h-12 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">{label}{count ? <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px]">{count}</span> : null}</TabsTrigger>;
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <label className="space-y-1.5"><span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{icon}{label}</span>{children}</label>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[9px] font-semibold uppercase tracking-wide text-violet-500">{label}</dt><dd className="mt-0.5 truncate text-violet-950 dark:text-violet-100">{value}</dd></div>;
}

function SectionTitle({ icon, title, description }: { icon: React.ReactElement; title: string; description: string }) {
  return <div className="flex items-start gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div></div>;
}

function EmptyBlock({ icon, text }: { icon: React.ReactElement; text: string }) {
  return <div className="grid min-h-36 place-items-center rounded-xl border border-dashed text-center text-sm text-muted-foreground"><div><span className="mx-auto mb-2 block [&>svg]:mx-auto [&>svg]:h-6 [&>svg]:w-6">{icon}</span>{text}</div></div>;
}

function activityLabel(action: string, from?: string | null, to?: string | null) {
  const labels: Record<string, string> = {
    TASK_CREATED: 'criou esta tarefa.',
    TASK_AUTOMATICALLY_CREATED: 'criou automaticamente esta tarefa.',
    TASK_MOVED: `moveu a tarefa de ${from ?? 'outra etapa'} para ${to ?? 'uma nova etapa'}.`,
    TASK_COMPLETED: `moveu a tarefa para ${to ?? 'Realizado'}.`,
    TASK_REOPENED: `reabriu a tarefa em ${to ?? 'uma nova etapa'}.`,
    COMMENT_ADDED: 'adicionou um comentário.',
    CHECKLIST_ITEM_ADDED: `adicionou a subtarefa “${to ?? ''}”.`,
    CHECKLIST_ITEM_COMPLETED: `concluiu a subtarefa “${to ?? ''}”.`,
    ATTACHMENT_ADDED: `anexou “${to ?? 'um arquivo'}”.`,
    LINK_CREATED: `vinculou “${to ?? 'um registro'}”.`,
  };
  return labels[action] ?? action.toLowerCase().replaceAll('_', ' ');
}

function notifyError(error: unknown) {
  toast.error(error instanceof Error ? error.message : 'Não foi possível concluir a operação.');
}
