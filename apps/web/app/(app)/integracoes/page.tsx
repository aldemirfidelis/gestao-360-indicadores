'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Plug, RefreshCcw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface IntegrationRow {
  id: string;
  code: string;
  name: string;
  type: string;
  status: 'enabled' | 'disabled';
  lastRunAt: string | null;
  lastError: string | null;
  lastLatencyMs: number | null;
  recentFailures: number;
  userEnabled: boolean;
  updatedAt: string;
}

export default function IntegrationsPage() {
  const qc = useQueryClient();
  const query = useQuery<IntegrationRow[]>({
    queryKey: ['integrations'],
    queryFn: () => api('/integrations'),
    refetchOnWindowFocus: false,
  });

  const toggle = useMutation({
    mutationFn: (item: IntegrationRow) =>
      api(`/integrations/${item.code}/preference`, {
        method: 'PUT',
        json: { enabled: !item.userEnabled, config: {} },
      }),
    onSuccess: () => {
      toast.success('Preferencia atualizada.');
      qc.invalidateQueries({ queryKey: ['integrations'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível salvar a preferencia'),
  });

  const rows = query.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Integrações"
        description="Conectores internos do sistema, status operacional e preferências do usuário."
        eyebrow="Sistema"
        actions={
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCcw className={cn('mr-2 h-4 w-4', query.isFetching && 'animate-spin')} />
            Atualizar
          </Button>
        }
      />

      {query.isLoading && <LoadingState label="Lendo integrações..." />}

      {!query.isLoading && rows.length === 0 && (
        <SectionCard title="Integrações" description="Nenhum conector registrado.">
          <div className="py-10 text-center text-sm text-muted-foreground">O catálogo será criado quando a API sincronizar as integrações.</div>
        </SectionCard>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((item) => {
          const portalEnabled = item.status === 'enabled';
          const userEnabled = item.userEnabled && portalEnabled;
          return (
            <SectionCard
              key={item.code}
              title={item.name}
              description={`Tipo: ${item.type}`}
              actions={
                <Badge variant="outline" className={cn(portalEnabled ? 'border-status-green/30 text-status-green' : 'border-status-red/30 text-status-red')}>
                  {portalEnabled ? 'Ativo' : 'Desativado'}
                </Badge>
              }
            >
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Plug className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Uso pessoal</span>
                  </div>
                  <Button
                    size="sm"
                    variant={userEnabled ? 'default' : 'outline'}
                    onClick={() => toggle.mutate(item)}
                    disabled={!portalEnabled || toggle.isPending}
                  >
                    {userEnabled ? 'Habilitado' : 'Habilitar'}
                  </Button>
                </div>

                <div className="grid gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Último teste</span>
                    <span className="font-medium text-foreground">{item.lastRunAt ? new Date(item.lastRunAt).toLocaleString() : 'Nunca'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Latência</span>
                    <span className="inline-flex items-center gap-1 font-medium text-foreground">
                      <Activity className="h-3.5 w-3.5" />
                      {item.lastLatencyMs != null ? `${item.lastLatencyMs}ms` : '-'}
                    </span>
                  </div>
                </div>

                {item.lastError ? (
                  <div className="flex items-start gap-2 rounded-md border border-status-red/25 bg-status-red/5 p-2 text-xs text-status-red">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{item.lastError}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-md border border-status-green/25 bg-status-green/5 p-2 text-xs text-status-green">
                    <ShieldCheck className="h-4 w-4" />
                    <span>{portalEnabled ? 'Sem falhas recentes registradas.' : 'Desativado pelo superadministrador.'}</span>
                  </div>
                )}
              </div>
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}
