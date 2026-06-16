'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, Plus } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { EmptyState } from '@/components/platform/empty-state';
import { StatusBadge } from '@/components/platform/status-badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { INCIDENT_SEVERITY_LABELS, RECORD_STATUS_LABELS, labelFor, statusTone, toOptions } from '@/lib/asset-security/labels';
import { formatDateTime } from '@/lib/asset-security/format';
import type { AnyRecord } from '@/lib/asset-security/types';

type Opt = Array<{ value: string; label: string }>;
const SEVERITY_OPTS = toOptions(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY'], INCIDENT_SEVERITY_LABELS);

function toLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function BlocklistSection({ people, vehicles, canBlock }: { people: Opt; vehicles: Opt; canBlock: boolean }) {
  const qc = useQueryClient();
  const list = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'blocklist'], queryFn: () => api('/asset-security/blocklist') });
  const [editing, setEditing] = useState<AnyRecord | 'new' | null>(null);
  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['asset-security', 'blocklist'] }); void qc.invalidateQueries({ queryKey: ['asset-security', 'summary'] }); };
  const rows = list.data ?? [];

  return (
    <SectionCard
      title={`Lista de bloqueio (${rows.length})`}
      description="Pessoas, veículos, documentos ou placas impedidos de acessar."
      contentClassName="p-0"
      actions={canBlock && <Button size="sm" onClick={() => setEditing('new')}><Plus className="mr-2 h-4 w-4" />Bloqueio</Button>}
    >
      {list.isPending ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Ban className="h-5 w-5" />} title="Nenhum bloqueio" description="Nenhuma pessoa ou veículo bloqueado." className="border-0" />
      ) : (
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead><tr><th className="text-left">Alvo</th><th className="text-left">Motivo</th><th className="text-left">Severidade</th><th className="text-left">Vigência</th><th className="text-left">Status</th>{canBlock && <th />}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.documentNumber || r.plate || r.personId || r.vehicleId || '—'}</td>
                  <td className="max-w-[260px] truncate">{r.reason}</td>
                  <td><StatusBadge value={r.severity} label={labelFor(r.severity, INCIDENT_SEVERITY_LABELS)} tone={statusTone(r.severity)} /></td>
                  <td className="text-xs">{formatDateTime(r.startsAt)}{r.endsAt ? ` → ${formatDateTime(r.endsAt)}` : ' → indeterminado'}</td>
                  <td><StatusBadge value={r.status} label={labelFor(r.status, RECORD_STATUS_LABELS)} tone={statusTone(r.status)} /></td>
                  {canBlock && <td className="text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(r)}>Editar</Button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <BlockDialog block={editing === 'new' ? null : editing} people={people} vehicles={vehicles} onClose={() => setEditing(null)} onSaved={() => { invalidate(); setEditing(null); }} />}
    </SectionCard>
  );
}

function BlockDialog({ block, people, vehicles, onClose, onSaved }: { block: AnyRecord | null; people: Opt; vehicles: Opt; onClose: () => void; onSaved: () => void }) {
  const editing = Boolean(block?.id);
  const [form, setForm] = useState<AnyRecord>(() => ({
    reason: block?.reason ?? '',
    severity: block?.severity ?? 'HIGH',
    personId: block?.personId ?? '',
    vehicleId: block?.vehicleId ?? '',
    documentNumber: block?.documentNumber ?? '',
    plate: block?.plate ?? '',
    startsAt: toLocalInput(block?.startsAt),
    endsAt: toLocalInput(block?.endsAt),
    status: block?.status ?? 'ACTIVE',
  }));
  const save = useMutation({
    mutationFn: () => api(editing ? `/asset-security/blocklist/${block!.id}` : '/asset-security/blocklist', {
      method: editing ? 'PATCH' : 'POST',
      json: {
        reason: form.reason,
        severity: form.severity,
        personId: form.personId || null,
        vehicleId: form.vehicleId || null,
        documentNumber: form.documentNumber || null,
        plate: form.plate || null,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        status: form.status,
      },
    }),
    onSuccess: () => { toast.success(editing ? 'Bloqueio atualizado' : 'Bloqueio criado'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar'),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Editar bloqueio' : 'Novo bloqueio'}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Identifique o alvo por pessoa/veículo cadastrado ou, para externos, por documento/placa.</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><Label className="field-required">Motivo</Label><Textarea rows={2} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></div>
          <div><Label>Pessoa cadastrada</Label><NativeSelect value={form.personId} onChange={(e) => setForm((f) => ({ ...f, personId: e.target.value }))}><option value="">—</option>{people.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></div>
          <div><Label>Veículo cadastrado</Label><NativeSelect value={form.vehicleId} onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}><option value="">—</option>{vehicles.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></div>
          <div><Label>Documento (externo)</Label><Input value={form.documentNumber} onChange={(e) => setForm((f) => ({ ...f, documentNumber: e.target.value }))} /></div>
          <div><Label>Placa (externa)</Label><Input value={form.plate} onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value }))} /></div>
          <div><Label>Severidade</Label><NativeSelect value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>{SEVERITY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></div>
          <div><Label>Status</Label><NativeSelect value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>{toOptions(['ACTIVE', 'INACTIVE'], RECORD_STATUS_LABELS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></div>
          <div><Label>Início</Label><Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} /></div>
          <div><Label>Fim (opcional)</Label><Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button disabled={!String(form.reason).trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Salvando…' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
