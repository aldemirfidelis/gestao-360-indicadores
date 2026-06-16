'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, QrCode } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/platform/status-badge';
import { api } from '@/lib/api';
import { AUTH_STATUS_LABELS, labelFor, statusTone } from '@/lib/asset-security/labels';
import { formatDateTime } from '@/lib/asset-security/format';
import type { AnyRecord } from '@/lib/asset-security/types';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="break-words text-sm">{children ?? '—'}</div>
    </div>
  );
}

async function copy(text: string, message: string) {
  if (navigator.clipboard) await navigator.clipboard.writeText(text).catch(() => undefined);
  toast.success(message);
}

function refList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'string' ? v : v?.name ?? v?.description ?? JSON.stringify(v)));
  return [];
}

/** Detalhe completo de uma autorização: dados, período, passageiros, QR e convite externo. */
export function AuthorizationDetailDialog({
  authorization,
  peopleOptions,
  userOptions,
  canApprove,
  canCreate,
  onChanged,
  onClose,
}: {
  authorization: AnyRecord | null;
  peopleOptions: Array<{ value: string; label: string }>;
  userOptions: Array<{ value: string; label: string }>;
  canApprove: boolean;
  canCreate: boolean;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const peopleMap = useMemo(() => new Map(peopleOptions.map((o) => [o.value, o.label])), [peopleOptions]);
  const userMap = useMemo(() => new Map(userOptions.map((o) => [o.value, o.label])), [userOptions]);

  const decision = useMutation({
    mutationFn: ({ action }: { action: 'approve' | 'reject' }) => api(`/asset-security/authorizations/${authorization!.id}/${action}`, { method: 'POST', json: {} }),
    onSuccess: () => { toast.success('Autorização atualizada'); onChanged(); onClose(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao atualizar'),
  });
  const invite = useMutation({
    mutationFn: () => api<AnyRecord>(`/asset-security/authorizations/${authorization!.id}/external-invite`, { method: 'POST', json: {} }),
    onSuccess: async (data) => {
      const path = String(data.publicUrl ?? '');
      const url = path.startsWith('http') ? path : `${window.location.origin}${path}`;
      setInviteUrl(url);
      await copy(url, 'Convite gerado e link copiado');
      onChanged();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao gerar convite'),
  });

  if (!authorization) return null;
  const a = authorization;
  const pending = ['REQUESTED', 'WAITING_APPROVAL', 'WAITING_DOCUMENTS'].includes(a.status);
  const passengers = (a.passengerPersonIds ?? []).map((id: string) => peopleMap.get(id) ?? id);
  const documents = refList(a.documentRefs);
  const materials = refList(a.materialRefs);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>{a.code ?? 'Autorização'}</span>
            <StatusBadge value={a.status} label={labelFor(a.status, AUTH_STATUS_LABELS)} tone={statusTone(a.status)} />
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Pessoa">{a.person?.name}</Field>
          <Field label="Documento">{a.person?.documentMasked}</Field>
          <Field label="Veículo / placa">{a.vehicle?.plate}</Field>
          <Field label="Empresa prestadora">{a.contractorCompany?.tradeName ?? a.contractorCompany?.legalName}</Field>
          <Field label="Portaria">{a.gate?.name}</Field>
          <Field label="Responsável interno">{a.internalResponsibleId ? userMap.get(a.internalResponsibleId) : null}</Field>
          <Field label="Início previsto">{formatDateTime(a.scheduledStartAt)}</Field>
          <Field label="Fim previsto">{formatDateTime(a.scheduledEndAt)}</Field>
          <Field label="Permanência máx.">{a.maxStayMinutes ? `${a.maxStayMinutes} min` : null}</Field>
          <Field label="Período permitido">{a.allowedPeriodText}</Field>
          <Field label="Aprovado em">{formatDateTime(a.approvedAt)}</Field>
          <Field label="Reprovado em">{formatDateTime(a.rejectedAt)}</Field>
        </div>

        {(a.reason || a.notes) && (
          <div className="grid gap-3">
            {a.reason && <Field label="Motivo">{a.reason}</Field>}
            {a.notes && <Field label="Observações">{a.notes}</Field>}
            {a.cancelReason && <Field label="Motivo da reprovação">{a.cancelReason}</Field>}
          </div>
        )}

        {passengers.length > 0 && <Field label="Passageiros">{passengers.join(', ')}</Field>}
        {documents.length > 0 && <Field label="Documentos">{documents.join(', ')}</Field>}
        {materials.length > 0 && <Field label="Materiais">{materials.join(', ')}</Field>}

        <div className="rounded-md border bg-muted/20 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium"><QrCode className="h-4 w-4" />código QR de acesso</div>
          {a.qrCodeToken ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <code className="rounded bg-background px-2 py-1">{a.qrCodeToken}</code>
              <Button size="sm" variant="ghost" onClick={() => copy(a.qrCodeToken, 'Token copiado')}><Copy className="mr-1 h-3.5 w-3.5" />Copiar token</Button>
              {a.qrExpiresAt && <span>Expira em {formatDateTime(a.qrExpiresAt)}</span>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">QR gerado após a aprovação.</p>
          )}
        </div>

        {canCreate && (
          <div className="rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">Convite externo (autocadastro do visitante)</div>
              <Button size="sm" variant="outline" disabled={invite.isPending} onClick={() => invite.mutate()}>
                {invite.isPending ? 'Gerando…' : 'Gerar convite'}
              </Button>
            </div>
            {inviteUrl && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <code className="truncate rounded bg-muted px-2 py-1">{inviteUrl}</code>
                <Button size="sm" variant="ghost" onClick={() => copy(inviteUrl, 'Link copiado')}><Copy className="mr-1 h-3.5 w-3.5" />Copiar</Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {canApprove && pending && <Button variant="outline" disabled={decision.isPending} onClick={() => decision.mutate({ action: 'reject' })}>Reprovar</Button>}
          {canApprove && pending && <Button disabled={decision.isPending} onClick={() => decision.mutate({ action: 'approve' })}>Aprovar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
