'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import {
  ClipboardList,
  CheckCircle,
  Clock,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface WorkflowTask {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' | 'OVERDUE';
  dueAt: string | null;
  createdAt: string;
  workflowInstance: {
    id: string;
    workflowDefinition: { name: string };
  };
}

export default function WorkflowTasksPage() {
  const queryClient = useQueryClient();
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load workflow tasks list
  const { data: tasks = [], isLoading } = useQuery<WorkflowTask[]>({
    queryKey: ['automations', 'tasks'],
    queryFn: () => api<WorkflowTask[]>('/automations/workflow-tasks'),
  });

  const pending = tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
  const history = tasks.filter(t => t.status === 'DONE' || t.status === 'CANCELLED');

  // Complete task mutation
  const completeMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api(`/automations/workflow-tasks/${id}/complete`, {
        method: 'POST',
        json: { evidenceNotes },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations', 'tasks'] });
      toast.success('Tarefa concluída com sucesso!');
      setEvidenceNotes('');
      setSelectedId(null);
    },
    onError: (err: any) => {
      toast.error(`Falha ao concluir tarefa: ${err.message}`);
    },
  });

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        eyebrow="Central de Automações"
        title="Tarefas Geradas"
        description="Acompanhe e execute as tarefas humanas delegadas para você por regras de workflows automáticos."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-6 items-start">
        {/* Tasks List */}
        <div className="border bg-card rounded-xl overflow-hidden divide-y">
          <div className="p-4 bg-muted/10">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <ClipboardList className="h-4 w-4 text-primary" />
              Minhas Atividades Pendentes ({pending.length})
            </h3>
          </div>

          <div className="p-2 space-y-2">
            {isLoading ? (
              <div className="text-center text-xs py-8 text-muted-foreground animate-pulse">Carregando tarefas...</div>
            ) : pending.length > 0 ? (
              pending.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'p-4 border rounded-xl bg-card hover:bg-muted/10 transition-colors flex flex-col gap-3',
                    selectedId === item.id && 'border-primary bg-primary/5'
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase">
                        Fluxo: {item.workflowInstance.workflowDefinition.name}
                      </div>
                      <h4 className="text-xs font-semibold text-foreground mt-1">{item.title}</h4>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                        {item.description || 'Nenhuma instrução adicional informada.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn(
                        'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                        item.priority === 'CRITICAL' && 'bg-status-red/10 text-status-red',
                        item.priority === 'HIGH' && 'bg-status-red/5 text-status-red/80',
                        item.priority === 'MEDIUM' && 'bg-status-blue/10 text-status-blue',
                        item.priority === 'LOW' && 'bg-muted text-muted-foreground'
                      )}>
                        {item.priority}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t pt-3 mt-1">
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Prazo: {item.dueAt ? new Date(item.dueAt).toLocaleDateString() : 'Sem data limite'}
                    </div>

                    <div>
                      {selectedId === item.id ? (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            placeholder="Descrever evidência de conclusão..."
                            value={evidenceNotes}
                            onChange={(e) => setEvidenceNotes(e.target.value)}
                            className="px-2 py-1 text-xs border rounded w-48 focus:outline-none"
                          />
                          <div className="flex items-center gap-1.5 justify-end">
                            <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setSelectedId(null)}>
                              Cancelar
                            </Button>
                            <Button size="sm" className="h-7 text-[10px]" onClick={() => completeMutation.mutate({ id: item.id })}>
                              Concluir Etapa
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" className="h-8 text-xs" onClick={() => setSelectedId(item.id)}>
                          Completar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-xs text-muted-foreground">
                Nenhuma tarefa operacional pendente atribuída a você no momento.
              </div>
            )}
          </div>
        </div>

        {/* History Sidebar */}
        <div className="border bg-card rounded-xl overflow-hidden">
          <div className="p-4 bg-muted/10 border-b">
            <h3 className="text-xs font-bold text-foreground">Concluídas Recentemente</h3>
          </div>
          <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
            {history.length > 0 ? (
              history.map((item) => (
                <div key={item.id} className="text-[11px] border-b pb-3 last:border-0 last:pb-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold truncate text-foreground">{item.title}</span>
                    <CheckCircle className="h-3.5 w-3.5 text-status-green shrink-0" />
                  </div>
                  <div className="text-muted-foreground leading-relaxed">
                    {item.description || 'Concluído via automação.'}
                  </div>
                  <div className="text-[9px] text-muted-foreground font-medium">
                    Concluída em {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground">Nenhuma atividade concluída no histórico.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
