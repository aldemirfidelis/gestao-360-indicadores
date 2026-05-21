'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { Clock, User } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

interface Action {
  id: string;
  title: string;
  description: string | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'WAITING_THIRD' | 'PAUSED' | 'DONE' | 'DONE_LATE' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  origin: string;
  dueDate: string | null;
  progress: number;
  responsibleUser: { id: string; name: string } | null;
  ownerNode: { id: string; name: string } | null;
}

const STATUS_LABEL: Record<Action['status'], string> = {
  NOT_STARTED: 'Nao iniciada',
  IN_PROGRESS: 'Em andamento',
  WAITING_THIRD: 'Aguardando terceiros',
  PAUSED: 'Pausada',
  DONE: 'Concluida',
  DONE_LATE: 'Concluida fora do prazo',
  CANCELLED: 'Cancelada',
};

const COLUMNS: Action['status'][] = ['NOT_STARTED', 'IN_PROGRESS', 'WAITING_THIRD', 'DONE'];

const PRI: Record<Action['priority'], string> = {
  LOW: 'border-l-status-gray',
  MEDIUM: 'border-l-status-blue',
  HIGH: 'border-l-status-yellow',
  CRITICAL: 'border-l-status-red',
};

export default function ActionsPage() {
  const qc = useQueryClient();
  const query = useQuery<Action[]>({
    queryKey: ['actions'],
    queryFn: () => api<Action[]>('/actions'),
  });

  const byCol = useMemo(() => {
    const map = new Map<Action['status'], Action[]>();
    COLUMNS.forEach((c) => map.set(c, []));
    (query.data ?? []).forEach((a) => {
      if (!map.has(a.status)) map.set(a.status, []);
      map.get(a.status)!.push(a);
    });
    return map;
  }, [query.data]);

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Action['status'] }) =>
      api(`/actions/${id}/status`, { method: 'PATCH', json: { status } }),
    onSuccess: () => {
      toast.success('Status atualizado');
      qc.invalidateQueries({ queryKey: ['actions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return (
    <div>
      <PageHeader
        title="Planos de Acao"
        description="Kanban de acoes geradas de desvios, indicadores e iniciativas estrategicas."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const items = byCol.get(col) ?? [];
          return (
            <div key={col} className="bg-muted/40 rounded-lg p-3 min-h-[300px]">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-sm font-semibold">{STATUS_LABEL[col]}</span>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              <div className="space-y-3">
                {items.map((a) => {
                  const isOverdue =
                    a.dueDate &&
                    new Date(a.dueDate) < new Date() &&
                    a.status !== 'DONE' &&
                    a.status !== 'DONE_LATE';
                  return (
                    <Card
                      key={a.id}
                      className={cn('border-l-4 hover:shadow-md transition-shadow', PRI[a.priority])}
                    >
                      <CardContent className="p-3">
                        <div className="text-sm font-medium leading-tight mb-2">{a.title}</div>
                        {a.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{a.description}</p>
                        )}
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mb-2">
                          <div
                            className={cn(
                              'h-full',
                              a.progress >= 100
                                ? 'bg-status-green'
                                : a.progress >= 50
                                  ? 'bg-status-blue'
                                  : 'bg-status-yellow',
                            )}
                            style={{ width: `${Math.min(100, a.progress)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1 truncate">
                            <User className="h-3 w-3" />
                            {a.responsibleUser?.name ?? 'Sem responsavel'}
                          </span>
                          <span
                            className={cn(
                              'flex items-center gap-1',
                              isOverdue && 'text-status-red font-medium',
                            )}
                          >
                            <Clock className="h-3 w-3" />
                            {formatDate(a.dueDate)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(['NOT_STARTED', 'IN_PROGRESS', 'WAITING_THIRD', 'DONE'] as const)
                            .filter((s) => s !== a.status)
                            .map((s) => (
                              <button
                                key={s}
                                onClick={() => changeStatus.mutate({ id: a.id, status: s })}
                                className="text-[10px] px-2 py-0.5 rounded bg-background hover:bg-accent border"
                              >
                                {'> '}
                                {STATUS_LABEL[s]}
                              </button>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">Vazio</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
