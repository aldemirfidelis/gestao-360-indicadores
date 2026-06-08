'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import {
  FolderLock,
  Check,
  X,
  FileQuestion,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Approval {
  id: string;
  approvalType: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'CANCELLED';
  comments: string | null;
  dueAt: string | null;
  createdAt: string;
  workflowInstance: {
    id: string;
    workflowDefinition: { name: string };
  };
}

export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [comments, setComments] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load approvals list
  const { data: approvals = [], isLoading } = useQuery<Approval[]>({
    queryKey: ['automations', 'approvals'],
    queryFn: () => api<Approval[]>('/automations/workflow-approvals'),
  });

  const pending = approvals.filter(a => a.status === 'PENDING');
  const history = approvals.filter(a => a.status !== 'PENDING');

  // Decision mutation
  const decisionMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
      api(`/automations/workflow-approvals/${id}/${decision}`, {
        method: 'POST',
        json: { comments },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations', 'approvals'] });
      toast.success('Decisão enviada com sucesso!');
      setComments('');
      setSelectedId(null);
    },
    onError: (err: any) => {
      toast.error(`Falha ao registrar: ${err.message}`);
    },
  });

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        eyebrow="Central de Automações"
        title="Aprovações Pendentes"
        description="Avalie e decida sobre as etapas de fluxos de trabalho que exigem validação humana."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-6 items-start">
        {/* Approvals List */}
        <div className="border bg-card rounded-xl overflow-hidden divide-y">
          <div className="p-4 bg-muted/10">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <FolderLock className="h-4 w-4 text-primary" />
              Solicitações Aguardando Resposta ({pending.length})
            </h3>
          </div>

          <div className="p-2 space-y-2">
            {isLoading ? (
              <div className="text-center text-xs py-8 text-muted-foreground animate-pulse">Carregando aprovações...</div>
            ) : pending.length > 0 ? (
              pending.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'p-4 border rounded-xl bg-card hover:bg-muted/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden',
                    selectedId === item.id && 'border-primary bg-primary/5'
                  )}
                >
                  <div>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase">
                      Workflow: {item.workflowInstance.workflowDefinition.name}
                    </div>
                    <h4 className="text-xs font-semibold text-foreground mt-1">Aprovação de Etapa ({item.approvalType})</h4>
                    <div className="text-[10px] text-muted-foreground mt-2">
                      Solicitado em {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {selectedId === item.id ? (
                      <div className="flex flex-col gap-2 w-full sm:w-auto">
                        <input
                          type="text"
                          placeholder="Adicionar comentário / justificativa..."
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
                          className="px-2 py-1 text-xs border rounded w-48 focus:outline-none"
                        />
                        <div className="flex items-center gap-1.5 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setSelectedId(null)}>
                            Cancelar
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-[10px] text-status-red" onClick={() => decisionMutation.mutate({ id: item.id, decision: 'reject' })}>
                            Reprovar
                          </Button>
                          <Button size="sm" className="h-7 text-[10px]" onClick={() => decisionMutation.mutate({ id: item.id, decision: 'approve' })}>
                            Aprovar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" className="h-8 text-xs" onClick={() => setSelectedId(item.id)}>
                        Responder
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-xs text-muted-foreground">
                Não há solicitações de aprovação pendentes para você no momento.
              </div>
            )}
          </div>
        </div>

        {/* History Sidebar */}
        <div className="border bg-card rounded-xl overflow-hidden">
          <div className="p-4 bg-muted/10 border-b">
            <h3 className="text-xs font-bold text-foreground">Histórico de Decisões</h3>
          </div>
          <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
            {history.length > 0 ? (
              history.map((item) => (
                <div key={item.id} className="text-[11px] border-b pb-3 last:border-0 last:pb-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold truncate text-foreground">{item.workflowInstance.workflowDefinition.name}</span>
                    <span className={cn(
                      'font-bold uppercase text-[9px] px-1 rounded',
                      item.status === 'APPROVED' && 'bg-status-green/10 text-status-green',
                      item.status === 'REJECTED' && 'bg-status-red/10 text-status-red',
                      item.status === 'CHANGES_REQUESTED' && 'bg-status-yellow/10 text-status-yellow'
                    )}>
                      {item.status}
                    </span>
                  </div>
                  <div className="text-muted-foreground leading-relaxed">
                    {item.comments || 'Sem justificativa.'}
                  </div>
                  <div className="text-[9px] text-muted-foreground font-medium">
                    Resposto {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground">Histórico vazio.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
