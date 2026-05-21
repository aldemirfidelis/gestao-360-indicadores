'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

interface ActionDetail {
  id: string;
  title: string;
  description: string | null;
  origin: string;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  progress: number;
  estimatedCost: number | null;
  actualCost: number | null;
  responsibleUser: { id: string; name: string } | null;
  ownerNode: { id: string; name: string } | null;
  deviation: { id: string; number: number; title: string } | null;
  tasks: { id: string; title: string; done: boolean; dueDate: string | null }[];
}

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Nao iniciada',
  IN_PROGRESS: 'Em andamento',
  WAITING_THIRD: 'Aguardando terceiros',
  PAUSED: 'Pausada',
  DONE: 'Concluida',
  DONE_LATE: 'Concluida fora do prazo',
  CANCELLED: 'Cancelada',
};

const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Critica',
};

export default function ActionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const query = useQuery<ActionDetail>({
    queryKey: ['action', id],
    queryFn: () => api<ActionDetail>(`/actions/${id}`),
  });

  const [newTask, setNewTask] = useState('');

  const update = useMutation({
    mutationFn: (patch: any) => api(`/actions/${id}`, { method: 'PATCH', json: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['action', id] }),
  });
  const changeStatus = useMutation({
    mutationFn: (status: string) => api(`/actions/${id}/status`, { method: 'PATCH', json: { status } }),
    onSuccess: () => {
      toast.success('Status atualizado');
      qc.invalidateQueries({ queryKey: ['action', id] });
    },
  });
  const addTask = useMutation({
    mutationFn: () => api(`/actions/${id}/tasks`, { method: 'POST', json: { title: newTask } }),
    onSuccess: () => {
      setNewTask('');
      qc.invalidateQueries({ queryKey: ['action', id] });
    },
  });
  const toggleTask = useMutation({
    mutationFn: ({ taskId, done }: { taskId: string; done: boolean }) =>
      api(`/actions/tasks/${taskId}`, { method: 'PATCH', json: { done } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['action', id] }),
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!query.data) return null;
  const a = query.data;
  const isOverdue = a.dueDate && new Date(a.dueDate) < new Date() && a.status !== 'DONE' && a.status !== 'DONE_LATE';

  return (
    <div>
      <Link href="/actions" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Planos de acao
      </Link>

      <PageHeader title={a.title} description={a.description ?? undefined} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] uppercase text-muted-foreground">Status</div>
            <NativeSelect
              value={a.status}
              onChange={(e) => changeStatus.mutate(e.target.value)}
              className="h-9 mt-1"
            >
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </NativeSelect>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] uppercase text-muted-foreground">Prioridade</div>
            <NativeSelect
              value={a.priority}
              onChange={(e) => update.mutate({ priority: e.target.value })}
              className="h-9 mt-1"
            >
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </NativeSelect>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] uppercase text-muted-foreground">Prazo</div>
            <div className={cn('text-base font-semibold mt-1', isOverdue && 'text-status-red')}>
              {formatDate(a.dueDate)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] uppercase text-muted-foreground">Progresso</div>
            <div className="text-base font-semibold mt-1">{a.progress}%</div>
            <Progress value={a.progress} className="mt-1" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Subtarefas ({a.tasks.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar subtarefa..."
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTask) addTask.mutate();
                  }}
                />
                <Button onClick={() => addTask.mutate()} disabled={!newTask || addTask.isPending}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1.5">
                {a.tasks.map((t) => (
                  <label
                    key={t.id}
                    className={cn(
                      'flex items-center gap-3 rounded-md border p-2 text-sm hover:bg-accent/40 cursor-pointer',
                      t.done && 'opacity-60',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={(e) => toggleTask.mutate({ taskId: t.id, done: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <span className={cn('flex-1', t.done && 'line-through')}>{t.title}</span>
                    {t.dueDate && (
                      <span className="text-xs text-muted-foreground">{formatDate(t.dueDate)}</span>
                    )}
                  </label>
                ))}
                {a.tasks.length === 0 && (
                  <p className="text-xs text-muted-foreground py-3 text-center">
                    Nenhuma subtarefa. Adicione algumas para acompanhar o progresso automaticamente.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Descricao</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                defaultValue={a.description ?? ''}
                rows={6}
                onBlur={(e) => {
                  if (e.target.value !== (a.description ?? '')) {
                    update.mutate({ description: e.target.value });
                  }
                }}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Origem</div>
                <Badge variant="outline">{a.origin}</Badge>
              </div>
              {a.deviation && (
                <div>
                  <div className="text-xs text-muted-foreground">Desvio vinculado</div>
                  <Link href={`/deviations/${a.deviation.id}`} className="text-primary hover:underline">
                    #{a.deviation.number} - {a.deviation.title}
                  </Link>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground">Responsavel</div>
                <div>{a.responsibleUser?.name ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Area</div>
                <div>{a.ownerNode?.name ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Inicio</div>
                <div>{formatDate(a.startDate)}</div>
              </div>
              {a.completedAt && (
                <div>
                  <div className="text-xs text-muted-foreground">Concluida em</div>
                  <div>{formatDate(a.completedAt)}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Custo estimado</Label>
                  <Input
                    type="number"
                    defaultValue={a.estimatedCost ?? ''}
                    className="h-8"
                    onBlur={(e) => {
                      const v = e.target.value ? Number(e.target.value) : null;
                      if (v !== a.estimatedCost) update.mutate({ estimatedCost: v });
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Custo real</Label>
                  <Input
                    type="number"
                    defaultValue={a.actualCost ?? ''}
                    className="h-8"
                    onBlur={(e) => {
                      const v = e.target.value ? Number(e.target.value) : null;
                      if (v !== a.actualCost) update.mutate({ actualCost: v });
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
