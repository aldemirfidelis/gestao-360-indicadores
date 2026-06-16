'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shell/page-header';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  RefreshCw,
  Clock,
  Layers,
  Search,
  Eye,
  CheckCircle,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DeadLetter {
  id: string;
  workflowInstanceId: string;
  nodeExecutionId: string | null;
  errorType: string;
  errorMessage: string;
  payload: string;
  attempts: number;
  status: 'UNRESOLVED' | 'RESOLVED' | 'IGNORED';
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
  workflowInstance: {
    id: string;
    workflowDefinition: { name: string };
  };
}

export default function FailuresPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNRESOLVED' | 'RESOLVED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Load dead-letters list
  const { data: deadLetters = [], isLoading } = useQuery<DeadLetter[]>({
    queryKey: ['automations', 'dead-letters'],
    queryFn: () => api<DeadLetter[]>('/automations/dead-letters'),
  });

  // Resolve dead-letter mutation (retry processing)
  const resolveMutation = useMutation({
    mutationFn: (id: string) => api(`/automations/dead-letters/${id}/resolve`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations', 'dead-letters'] });
      queryClient.invalidateQueries({ queryKey: ['automations', 'instances'] });
      queryClient.invalidateQueries({ queryKey: ['automations', 'overview-stats'] });
      toast.success('Fila liberada e execução reiniciada!');
      setSelectedId(null);
    },
    onError: (err: any) => {
      toast.error(`Falha ao reprocessar: ${err.message}`);
    },
  });

  // Filter dead letters
  const filtered = deadLetters.filter((dl) => {
    const matchesStatus = statusFilter === 'ALL' ? true : dl.status === statusFilter;
    const matchesSearch =
      dl.workflowInstance.workflowDefinition.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dl.errorType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dl.errorMessage.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dl.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dl.workflowInstanceId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const selectedItem = deadLetters.find((dl) => dl.id === selectedId);

  return (
    <div className="p-6 space-y-6 flex-1 flex flex-col min-h-0">
      <PageHeader
        eyebrow="Central de Automações"
        title="Falhas e Pendências Técnicas"
        description="Gerencie erros operacionais retidos na fila de mensagens com falha (DLQ), com análise dos dados de entrada e reprocessamento manual."
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr,420px] gap-6 min-h-0 w-full overflow-hidden">
        {/* Left Side: Table & List of Failures */}
        <div className="flex flex-col min-h-0 border bg-card rounded-xl overflow-hidden">
          {/* Filters Bar */}
          <div className="p-4 border-b bg-muted/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <Button
                variant={statusFilter === 'ALL' ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setStatusFilter('ALL')}
              >
                Todos
              </Button>
              <Button
                variant={statusFilter === 'UNRESOLVED' ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setStatusFilter('UNRESOLVED')}
              >
                Pendente
              </Button>
              <Button
                variant={statusFilter === 'RESOLVED' ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setStatusFilter('RESOLVED')}
              >
                Resolvido
              </Button>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por fluxo, erro ou ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border rounded-lg focus:outline-none"
              />
            </div>
          </div>

          {/* List content */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="text-center text-xs py-16 text-muted-foreground animate-pulse">
                Carregando incidentes de falha...
              </div>
            ) : filtered.length > 0 ? (
              <div className="divide-y">
                {filtered.map((item) => {
                  const isSelected = selectedId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        'p-4 hover:bg-muted/10 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden',
                        isSelected && 'bg-primary/5 border-l-2 border-primary'
                      )}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            ID: {item.id.slice(0, 8)}...
                          </span>
                          <span
                            className={cn(
                              'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                              item.status === 'UNRESOLVED' && 'bg-status-red/10 text-status-red',
                              item.status === 'RESOLVED' && 'bg-status-green/10 text-status-green',
                              item.status === 'IGNORED' && 'bg-muted text-muted-foreground'
                            )}
                          >
                            {item.status === 'UNRESOLVED' ? 'Pendente' : item.status === 'RESOLVED' ? 'Resolvido' : 'Ignorado'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Tentativas: {item.attempts}
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-foreground truncate">
                          {item.workflowInstance.workflowDefinition.name}
                        </h4>
                        <div className="text-[10px] text-destructive bg-destructive/5 px-2 py-1 rounded border border-destructive/10 inline-block max-w-full truncate">
                          {item.errorType}: {item.errorMessage}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                        <div className="text-[10px] text-muted-foreground text-right">
                          <span className="block font-medium">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                          <span className="block text-[9px] opacity-70">
                            {new Date(item.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(item.id);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-xs text-muted-foreground">
                <CheckCircle className="h-8 w-8 text-status-green opacity-80 mb-2 animate-bounce" />
                <span>Nenhum erro retido na DLQ. Tudo rodando perfeitamente!</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Failure Details Panel */}
        <div className="flex flex-col min-h-0 border bg-card rounded-xl overflow-hidden">
          {selectedItem ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Detail Header */}
              <div className="p-4 border-b bg-muted/10 shrink-0 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-status-red" />
                    Inspecionar Falha
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">DLQ ID: {selectedItem.id}</p>
                </div>

                {selectedItem.status === 'UNRESOLVED' && (
                  <Button
                    size="sm"
                    className="h-8 text-xs flex items-center gap-1.5 bg-primary hover:bg-primary/90"
                    disabled={resolveMutation.isPending}
                    onClick={() => resolveMutation.mutate(selectedItem.id)}
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', resolveMutation.isPending && 'animate-spin')} />
                    Reprocessar
                  </Button>
                )}
              </div>

              {/* Detail Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Meta details cards */}
                <div className="grid grid-cols-2 gap-2 text-[10px] bg-muted/20 p-3 rounded-lg border">
                  <div>
                    <span className="block text-muted-foreground">Tipo do Erro</span>
                    <span className="font-semibold text-foreground truncate block">{selectedItem.errorType}</span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground">Criado em</span>
                    <span className="font-semibold text-foreground block">
                      {new Date(selectedItem.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="col-span-2 border-t pt-2 mt-1">
                    <span className="block text-muted-foreground">Fluxo de trabalho Instance ID</span>
                    <span className="font-mono text-foreground select-all break-all block">{selectedItem.workflowInstanceId}</span>
                  </div>
                  {selectedItem.nodeExecutionId && (
                    <div className="col-span-2 border-t pt-2 mt-1">
                      <span className="block text-muted-foreground">Node Execution ID</span>
                      <span className="font-mono text-foreground select-all break-all block">{selectedItem.nodeExecutionId}</span>
                    </div>
                  )}
                  {selectedItem.status === 'RESOLVED' && selectedItem.resolvedAt && (
                    <div className="col-span-2 border-t pt-2 mt-1 text-status-green bg-status-green/5 p-2 rounded">
                      <span className="block font-bold">Resolvido via Central</span>
                      <span>Processado novamente em {new Date(selectedItem.resolvedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Error Message */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Mensagem de Erro
                  </label>
                  <div className="p-3 bg-destructive/5 text-destructive rounded-lg border border-destructive/15 text-xs font-medium leading-relaxed whitespace-pre-wrap">
                    {selectedItem.errorMessage}
                  </div>
                </div>

                {/* Contexto de execução */}
                <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>Contexto de execução (dados técnicos)</span>
                    <span className="text-[9px] font-normal lowercase text-muted-foreground">(estado das variáveis)</span>
                  </label>
                  <pre className="flex-1 p-3 bg-muted/40 border border-dashed rounded-lg text-[10px] font-mono overflow-auto leading-relaxed text-foreground select-all max-h-[300px]">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedItem.payload), null, 2);
                      } catch {
                        return selectedItem.payload;
                      }
                    })()}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-xs text-muted-foreground">
              <Layers className="h-8 w-8 opacity-40 mb-2" />
              Selecione um incidente de falha para inspecionar seu contexto e liberar a fila.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
