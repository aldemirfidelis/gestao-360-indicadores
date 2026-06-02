'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCcw, Activity, ShieldCheck, ShieldAlert, Play } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Integration {
  id: string;
  code: string;
  name: string;
  type: string;
  status: 'enabled' | 'disabled';
  environment: string | null;
  lastRunAt: string | null;
  lastError: string | null;
  lastLatencyMs: number | null;
  recentFailures: number;
  configMasked: string;
  updatedAt: string;
}

export function IntegrationsTab() {
  const qc = useQueryClient();

  const query = useQuery<Integration[]>({
    queryKey: ['portal', 'integrations'],
    queryFn: () => api('/admin/portal/integrations'),
    refetchOnWindowFocus: false,
  });

  const statusMut = useMutation({
    mutationFn: (v: { code: string; status: 'enabled' | 'disabled' }) =>
      api(`/admin/portal/integrations/${v.code}/status`, { method: 'POST', json: { status: v.status } }),
    onSuccess: () => {
      toast.success('Status da integração atualizado.');
      qc.invalidateQueries({ queryKey: ['portal', 'integrations'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: (code: string) => api<{ ok: boolean; latencyMs: number; note: string }>(`/admin/portal/integrations/${code}/test`, { method: 'POST' }),
    onSuccess: (res, code) => {
      if (res.ok) {
        toast.success(`Conexão com "${code}" estabelecida com sucesso! (${res.latencyMs}ms)`);
      } else {
        toast.error(`Falha na conexão com "${code}": ${res.note}`);
      }
      qc.invalidateQueries({ queryKey: ['portal', 'integrations'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const rows = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Monitore integrações do sistema, verifique latência e execute testes de conectividade básicos.
        </p>
        <Button variant="ghost" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCcw className={cn('mr-2 h-4 w-4', query.isFetching && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {query.isLoading && <LoadingState label="Lendo integrações..." />}

      {!query.isLoading && rows.length === 0 && (
        <div className="p-8 text-center text-xs text-muted-foreground">Nenhuma integração registrada.</div>
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((item) => {
            const isEnabled = item.status === 'enabled';
            let configObj: Record<string, string> = {};
            try {
              configObj = JSON.parse(item.configMasked);
            } catch {
              configObj = {};
            }

            return (
              <SectionCard
                key={item.code}
                title={item.name}
                description={`Tipo: ${item.type}`}
                className={cn(!isEnabled && 'opacity-60 bg-muted/15')}
                actions={
                  <Badge variant="outline" className={cn(isEnabled ? 'border-status-green/30 text-status-green bg-status-green/5' : 'border-status-red/30 text-status-red bg-status-red/5')}>
                    {isEnabled ? 'Ativo' : 'Desativado'}
                  </Badge>
                }
              >
                <div className="space-y-3 text-xs pt-1">
                  {/* Status / Testes */}
                  <div className="flex justify-between items-center bg-muted/20 border rounded px-2.5 py-1.5">
                    <span className="font-semibold">Painel de Ação</span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => statusMut.mutate({ code: item.code, status: isEnabled ? 'disabled' : 'enabled' })}
                        disabled={statusMut.isPending}
                        className="text-[10px] h-7 px-2 font-medium"
                      >
                        {isEnabled ? 'Desativar' : 'Habilitar'}
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => testMut.mutate(item.code)}
                        disabled={testMut.isPending || !isEnabled}
                        className="text-[10px] h-7 px-2 font-semibold flex items-center gap-1"
                      >
                        <Play className="h-3 w-3 fill-current" /> Testar
                      </Button>
                    </div>
                  </div>

                  {/* Configurações mascaradas */}
                  <div>
                    <span className="font-semibold text-muted-foreground block mb-1">Configuração (Ambiente)</span>
                    <div className="border rounded p-2 bg-muted/10 font-mono text-[10px] space-y-1">
                      {Object.entries(configObj).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2 overflow-hidden truncate">
                          <span className="text-muted-foreground">{k}:</span>
                          <span className="font-semibold text-foreground">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Monitoramento de Saúde */}
                  <div className="space-y-1.5 border-t border-border/60 pt-2.5">
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Execução:</span>
                      <span className="text-foreground font-medium">
                        {item.lastRunAt ? new Date(item.lastRunAt).toLocaleString() : 'Nunca'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Latência de Teste:</span>
                      <span className="text-foreground font-medium flex items-center gap-1">
                        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                        {item.lastLatencyMs !== null && item.lastLatencyMs !== undefined ? `${item.lastLatencyMs}ms` : '-'}
                      </span>
                    </div>

                    {item.lastError ? (
                      <div className="text-status-red mt-1 border border-status-red/20 bg-status-red/5 p-2 rounded text-[10px] whitespace-pre-wrap leading-normal flex items-start gap-1">
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{item.lastError}</span>
                      </div>
                    ) : (
                      item.lastRunAt && (
                        <div className="text-status-green mt-1 border border-status-green/20 bg-status-green/5 p-1.5 rounded text-[10px] flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>Conexão Saudável</span>
                        </div>
                      )
                    )}

                    {item.recentFailures > 0 && (
                      <div className="text-status-red font-semibold text-[10px] text-right mt-1">
                        ⚠️ {item.recentFailures} falhas recentes
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
