'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { EmptyState } from '@/components/platform/empty-state';
import { StatusBadge } from '@/components/platform/status-badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { OFFLINE_STATUS_LABELS, labelFor, statusTone } from '@/lib/asset-security/labels';
import { formatDateTime } from '@/lib/asset-security/format';
import { cn } from '@/lib/utils';
import type { AnyRecord } from '@/lib/asset-security/types';

/** Diagnóstico da fila de sincronização do app de portaria offline (somente leitura). */
export function OfflineSyncSection() {
  const list = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'offline-sync'], queryFn: () => api('/asset-security/offline-sync?take=200') });
  const rows = list.data ?? [];
  const pending = rows.filter((r) => ['PENDING', 'CONFLICT', 'ERROR'].includes(r.status)).length;

  return (
    <SectionCard
      title={`Sincronização sem conexão (${pending} pendente${pending === 1 ? '' : 's'})`}
      description="Fila de registros capturados pelo app de portaria em modo sem conexão."
      contentClassName="p-0"
      actions={<Button size="sm" variant="outline" onClick={() => list.refetch()}><RefreshCw className={cn('mr-2 h-4 w-4', list.isFetching && 'animate-spin')} />Atualizar</Button>}
    >
      {list.isPending ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Fila vazia" description="Nenhum registro sem conexão pendente de sincronização." className="border-0" />
      ) : (
        <div className="max-h-[60vh] overflow-auto">
          <table className="table-modern">
            <thead><tr><th className="text-left">Entidade</th><th className="text-left">Operação</th><th className="text-left">Status</th><th className="text-left">Dispositivo</th><th className="text-left">Capturado</th><th className="text-left">Sincronizado</th><th className="text-left">Detalhe</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-xs font-medium">{r.entityType}</td>
                  <td className="text-xs">{r.operation}</td>
                  <td><StatusBadge value={r.status} label={labelFor(r.status, OFFLINE_STATUS_LABELS)} tone={statusTone(r.status)} /></td>
                  <td className="text-xs">{r.deviceId ?? '—'}</td>
                  <td className="text-xs">{formatDateTime(r.localCreatedAt ?? r.createdAt)}</td>
                  <td className="text-xs">{r.syncedAt ? formatDateTime(r.syncedAt) : '—'}</td>
                  <td className="max-w-[240px] truncate text-xs text-status-red">{r.errorMessage ?? r.conflictReason ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
