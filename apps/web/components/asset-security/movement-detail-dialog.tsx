'use client';

import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/platform/status-badge';
import { api } from '@/lib/api';
import { MOVEMENT_STATUS_LABELS, MOVEMENT_TYPE_LABELS, labelFor, statusTone } from '@/lib/asset-security/labels';
import { dwellMinutes, formatDateTime, formatDuration } from '@/lib/asset-security/format';
import type { SecurityMovement } from '@/lib/asset-security/types';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate text-sm">{children ?? '—'}</div>
    </div>
  );
}

/** Detalhe (drill-down) de uma movimentação + histórico recente da pessoa/veículo. */
export function MovementDetailDialog({ movement, onClose }: { movement: SecurityMovement | null; onClose: () => void }) {
  const personId = movement?.person?.id ?? null;
  const vehicleId = movement?.vehicle?.id ?? null;
  const historyKey = personId ? `personId=${personId}` : vehicleId ? `vehicleId=${vehicleId}` : null;

  const history = useQuery<SecurityMovement[]>({
    queryKey: ['asset-security', 'movement-history', historyKey],
    queryFn: () => api(`/asset-security/movements?${historyKey}&take=10`),
    enabled: Boolean(movement && historyKey),
  });

  if (!movement) return null;
  const present = !movement.exitAt;
  const dwell = dwellMinutes(movement.entryAt, movement.exitAt);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>{movement.code ?? 'Movimentação'}</span>
            <StatusBadge value={movement.status} label={labelFor(movement.status, MOVEMENT_STATUS_LABELS)} tone={movement.overdue ? 'red' : statusTone(movement.status)} />
            {movement.overdue && <StatusBadge value="OVERDUE" label="Permanência excedida" tone="red" />}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Tipo">{labelFor(movement.movementType, MOVEMENT_TYPE_LABELS)}</Field>
          <Field label="Pessoa">{movement.person?.name}</Field>
          <Field label="Documento">{movement.person?.documentMasked}</Field>
          <Field label="Empresa / origem">{movement.contractorCompany?.tradeName ?? movement.originCompanyName}</Field>
          <Field label="Veículo / placa">{movement.plate ?? movement.vehicle?.plate}</Field>
          <Field label="Motorista">{movement.driver?.name}</Field>
          <Field label="Portaria">{movement.gate?.name}</Field>
          <Field label="Posto">{movement.post?.name}</Field>
          <Field label="Motivo">{movement.reason}</Field>
          <Field label="Entrada">{formatDateTime(movement.entryAt)}</Field>
          <Field label="Previsão de saída">{formatDateTime(movement.expectedExitAt)}</Field>
          <Field label="Saída">{movement.exitAt ? formatDateTime(movement.exitAt) : 'Em aberto'}</Field>
          <Field label="Permanência">{formatDuration(dwell)}{present ? ' (em curso)' : ''}</Field>
        </div>

        <div className="mt-2">
          <div className="mb-2 text-[13px] font-semibold uppercase tracking-[0.06em]">Histórico recente</div>
          {!historyKey ? (
            <p className="text-sm text-muted-foreground">Sem pessoa/veículo vinculado para histórico.</p>
          ) : history.isPending ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (history.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro anterior.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(history.data ?? []).map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="truncate">
                    {labelFor(h.movementType, MOVEMENT_TYPE_LABELS)} · {h.gate?.name ?? '—'}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(h.entryAt)} → {h.exitAt ? formatDateTime(h.exitAt) : 'aberto'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
