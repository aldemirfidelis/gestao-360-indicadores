'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shell/page-header';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Play,
  XCircle,
  CheckCircle,
  AlertCircle,
  Search,
  RefreshCw,
  Clock,
  Layers,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

interface Execution {
  id: string;
  workflowDefinition: { name: string; module: string };
  workflowVersion: { versionNumber: number };
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  currentState: string;
}

export default function ExecutionsTracker() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Load executions list
  const { data: executions = [], isLoading } = useQuery<Execution[]>({
    queryKey: ['automations', 'instances'],
    queryFn: () => api<Execution[]>('/automations/workflow-instances'),
  });

  // Load selected execution details
  const { data: details, isLoading: isLoadingDetails } = useQuery<any>({
    queryKey: ['automations', 'instances', selectedId],
    queryFn: () => api<any>(`/automations/workflow-instances/${selectedId}`),
    enabled: !!selectedId,
  });

  // Retry failed instance mutation
  const retryMutation = useMutation({
    mutationFn: (id: string) => api(`/automations/workflow-instances/${id}/retry`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations', 'instances'] });
      if (selectedId) {
        queryClient.invalidateQueries({ queryKey: ['automations', 'instances', selectedId] });
      }
      toast.success('Execução re-iniciada de onde falhou.');
    },
    onError: (err: any) => {
      toast.error(`Falha ao reprocessar: ${err.message}`);
    },
  });

  // Cancel execution mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => api(`/automations/workflow-instances/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations', 'instances'] });
      if (selectedId) {
        queryClient.invalidateQueries({ queryKey: ['automations', 'instances', selectedId] });
      }
      toast.success('Execução cancelada.');
    },
    onError: (err: any) => {
      toast.error(`Falha ao cancelar: ${err.message}`);
    },
  });

  const filtered = executions.filter(e =>
    statusFilter ? e.status === statusFilter : true
  );

  return (
    <div className="p-6 space-y-6 flex-1 flex flex-col min-h-0">
      <PageHeader
        eyebrow="Central de Automações"
        title="Histórico de Execuções"
        description="Monitore as instâncias de fluxos de trabalho disparadas pelos eventos do sistema e inspecione registros técnicos passo a passo."
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[380px,1fr] gap-6 min-h-0 w-full overflow-hidden">
        {/* Left Side: List */}
        <div className="flex flex-col min-h-0 border bg-card rounded-xl overflow-hidden">
          <div className="p-4 border-b space-y-3 shrink-0 bg-muted/10">
            <label className="text-[10px] font-bold text-muted-foreground uppercase block">Filtros de Execuções</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background border rounded-lg focus:outline-none"
            >
              <option value="">Status: Todos</option>
              <option value="RUNNING">Em Andamento</option>
              <option value="COMPLETED">Concluído</option>
              <option value="FAILED">Falha</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoading ? (
              <div className="text-center text-xs py-8 text-muted-foreground animate-pulse">Carregando execuções...</div>
            ) : filtered.length > 0 ? (
              filtered.map((item) => {
                const isActive = selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-colors flex flex-col gap-2 relative overflow-hidden',
                      isActive ? 'border-primary bg-primary/5' : 'hover:bg-muted/30 bg-card'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {item.workflowDefinition.module}
                      </span>
                      <span className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                        item.status === 'COMPLETED' && 'bg-status-green/10 text-status-green',
                        item.status === 'RUNNING' && 'bg-status-blue/10 text-status-blue',
                        item.status === 'FAILED' && 'bg-status-red/10 text-status-red',
                        item.status === 'CANCELLED' && 'bg-muted text-muted-foreground'
                      )}>
                        {item.status}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-foreground truncate">{item.workflowDefinition.name}</div>
                    
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                      <span>Versão: v{item.workflowVersion.versionNumber}</span>
                      <span>{new Date(item.startedAt).toLocaleTimeString()} {new Date(item.startedAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-12 text-xs text-muted-foreground">Nenhuma execução encontrada.</div>
            )}
          </div>
        </div>

        {/* Right Side: Details */}
        <div className="flex flex-col min-h-0 border bg-card rounded-xl overflow-hidden">
          {selectedId ? (
            isLoadingDetails ? (
              <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Carregando detalhes da execução...</div>
            ) : details ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Detail Header */}
                <div className="p-4 border-b bg-muted/10 shrink-0 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold">{details.workflowDefinition.name}</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Instance ID: {details.id}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {details.status === 'FAILED' && (
                      <Button size="sm" className="h-8 text-xs flex items-center gap-1" onClick={() => retryMutation.mutate(details.id)}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Tentar Novamente
                      </Button>
                    )}
                    {details.status === 'RUNNING' && (
                      <Button variant="outline" size="sm" className="h-8 text-xs text-status-red border-status-red/20 hover:bg-status-red/5" onClick={() => cancelMutation.mutate(details.id)}>
                        <XCircle className="h-3.5 w-3.5" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>

                {/* Detail Body tabs */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  {/* Variables inspect */}
                  <div>
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Variáveis de Contexto</h4>
                    <pre className="p-3 bg-muted/40 border border-dashed rounded-lg text-[10px] font-mono overflow-x-auto leading-relaxed text-foreground">
                      {JSON.stringify(JSON.parse(details.currentState || '{}'), null, 2)}
                    </pre>
                  </div>

                  {/* Flow steps executed */}
                  <div>
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Histórico das Etapas Executadas</h4>
                    <div className="space-y-3">
                      {details.nodeExecutions.map((exec: any) => (
                        <div key={exec.id} className={cn(
                          'p-3 border rounded-lg relative overflow-hidden flex flex-col gap-1',
                          exec.status === 'COMPLETED' && 'bg-status-green/5 border-status-green/20',
                          exec.status === 'FAILED' && 'bg-status-red/5 border-status-red/20',
                          exec.status === 'RUNNING' && 'bg-status-blue/5 border-status-blue/20'
                        )}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">{exec.nodeKey}</span>
                            <span className={cn(
                              'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                              exec.status === 'COMPLETED' && 'bg-status-green/10 text-status-green',
                              exec.status === 'FAILED' && 'bg-status-red/10 text-status-red',
                              exec.status === 'RUNNING' && 'bg-status-blue/10 text-status-blue'
                            )}>
                              {exec.status}
                            </span>
                          </div>
                          {exec.errorMessage && (
                            <div className="text-[10px] text-status-red font-medium mt-1 leading-relaxed bg-status-red/5 p-2 rounded">
                              Erro: {exec.errorMessage}
                            </div>
                          )}
                          <div className="text-[9px] text-muted-foreground mt-1">
                            Iniciado: {new Date(exec.startedAt).toLocaleTimeString()} 
                            {exec.completedAt && ` | Concluído: ${new Date(exec.completedAt).toLocaleTimeString()}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Execution Audit logs */}
                  <div>
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Registros Técnicos da Engine</h4>
                    <div className="border rounded-lg overflow-hidden bg-background text-[10px] font-mono divide-y">
                      {details.logs.map((log: any) => (
                        <div key={log.id} className="p-2.5 flex items-start gap-3 hover:bg-muted/10">
                          <span className={cn(
                            'font-bold px-1 rounded shrink-0',
                            log.level === 'INFO' && 'text-status-green bg-status-green/10',
                            log.level === 'WARNING' && 'text-status-yellow bg-status-yellow/10',
                            log.level === 'ERROR' && 'text-status-red bg-status-red/10'
                          )}>
                            {log.level}
                          </span>
                          <span className="text-muted-foreground shrink-0">{new Date(log.createdAt).toLocaleTimeString()}</span>
                          <span className="font-semibold text-foreground shrink-0">[{log.eventType}]</span>
                          <span className="text-foreground leading-relaxed flex-1">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-xs text-muted-foreground">Erro ao carregar detalhes.</div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-xs text-muted-foreground">
              <Layers className="h-8 w-8 opacity-40 mb-2" />
              Selecione uma execução na lista lateral para inspecionar seu progresso e variáveis.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
