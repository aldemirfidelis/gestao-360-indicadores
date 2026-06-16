'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SectionCard } from '@/components/platform/section-card';
import { EmptyState } from '@/components/platform/empty-state';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/asset-security/format';
import type { AnyRecord } from '@/lib/asset-security/types';

type Opt = Array<{ value: string; label: string }>;

const ENTITY_OPTS = [
  { value: '', label: 'Todas as entidades' },
  { value: 'SecurityAccessMovement', label: 'Movimentações' },
  { value: 'SecurityAuthorization', label: 'Autorizações' },
  { value: 'SecurityPerson', label: 'Pessoas' },
  { value: 'SecurityVehicle', label: 'Veículos' },
  { value: 'SecurityIncident', label: 'Ocorrências' },
  { value: 'SecurityBlocklist', label: 'Bloqueios' },
  { value: 'SecurityCustodyItem', label: 'Chaves/crachás' },
  { value: 'SecurityRoundExecution', label: 'Rondas' },
  { value: 'SecurityShiftHandover', label: 'Passagem de turno' },
];

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Criação',
  UPDATE: 'Edição',
  REGISTER_ENTRY: 'Entrada',
  REGISTER_EXIT: 'Saída',
  APPROVE: 'Aprovação',
  REJECT: 'Reprovação',
  BLOCK: 'Bloqueio',
  LOAN: 'Empréstimo',
  RETURN: 'Devolução',
  CLOSE: 'Encerramento',
  PICKUP: 'Retirada',
  ROUND_FINISH: 'Ronda finalizada',
  ROUND_CHECKPOINT_VISIT: 'Ponto de ronda',
  COMPLETE: 'Conclusão',
};

/** Trilha de auditoria do módulo (somente leitura). Requer permissão de gestão. */
export function AuditLogSection({ users }: { users: Opt }) {
  const [entity, setEntity] = useState('');
  const userMap = useMemo(() => new Map(users.map((u) => [u.value, u.label])), [users]);
  const logs = useQuery<AnyRecord[]>({
    queryKey: ['asset-security', 'audit-logs', entity],
    queryFn: () => api(`/asset-security/audit-logs?take=200${entity ? `&entity=${entity}` : ''}`),
  });
  const rows = logs.data ?? [];

  return (
    <SectionCard
      title="Trilha de auditoria"
      description="Histórico de ações registradas no módulo (somente leitura)."
      contentClassName="p-0"
      actions={
        <NativeSelect className="w-56" value={entity} onChange={(e) => setEntity(e.target.value)}>
          {ENTITY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </NativeSelect>
      }
    >
      {logs.isPending ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Sem registros" description="Nenhuma ação auditada para o filtro." className="border-0" />
      ) : (
        <div className="max-h-[60vh] overflow-auto">
          <table className="table-modern">
            <thead><tr><th className="text-left">Data</th><th className="text-left">Ação</th><th className="text-left">Registro</th><th className="text-left">Usuário</th><th className="text-left">Origem</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</td>
                  <td className="text-xs font-medium">{ACTION_LABELS[r.action] ?? r.action}</td>
                  <td className="max-w-[280px] truncate text-xs">{r.recordLabel ?? r.entityId ?? r.entity}</td>
                  <td className="text-xs">{r.userId ? (userMap.get(r.userId) ?? '—') : (r.offline ? 'Sem conexão' : '—')}</td>
                  <td className="text-xs text-muted-foreground">{r.origin ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
