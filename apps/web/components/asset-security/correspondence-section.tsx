'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, Plus } from 'lucide-react';
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
import { formatDateTime } from '@/lib/asset-security/format';
import type { AnyRecord } from '@/lib/asset-security/types';

type Opt = Array<{ value: string; label: string }>;

export function CorrespondenceSection({ gates, users, canUpdate }: { gates: Opt; users: Opt; canUpdate: boolean }) {
  const qc = useQueryClient();
  const list = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'correspondences'], queryFn: () => api('/asset-security/correspondences?take=100') });
  const [creating, setCreating] = useState(false);
  const [pickup, setPickup] = useState<AnyRecord | null>(null);

  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['asset-security', 'correspondences'] }); void qc.invalidateQueries({ queryKey: ['asset-security', 'summary'] }); };
  const rows = list.data ?? [];

  return (
    <SectionCard
      title={`Correspondências e encomendas (${rows.length})`}
      description="Recebimento na portaria e registro de retirada com comprovante."
      contentClassName="p-0"
      actions={canUpdate && <Button size="sm" onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Registrar recebimento</Button>}
    >
      {list.isPending ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Nenhuma correspondência" description="Registre encomendas recebidas na portaria." className="border-0" />
      ) : (
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead><tr><th className="text-left">Destinatário</th><th className="text-left">Remetente / transportadora</th><th className="text-left">Rastreio</th><th className="text-left">Recebida</th><th className="text-left">Situação</th><th className="text-right">Ações</th></tr></thead>
            <tbody>
              {rows.map((c) => {
                const pickedUp = Boolean(c.pickedUpAt);
                return (
                  <tr key={c.id}>
                    <td className="font-medium">{c.recipient ?? '—'}<div className="text-xs text-muted-foreground">{c.type ?? ''}</div></td>
                    <td>{c.sender ?? '—'}<div className="text-xs text-muted-foreground">{c.carrierName ?? ''}</div></td>
                    <td className="text-xs">{c.trackingCode ?? '—'}</td>
                    <td className="text-xs">{formatDateTime(c.receivedAt)}</td>
                    <td>
                      {pickedUp
                        ? <StatusBadge value="DONE" label="Retirada" tone="green" />
                        : <StatusBadge value="PENDING" label="Aguardando" tone="yellow" />}
                      {pickedUp && <div className="mt-0.5 text-xs text-muted-foreground">{c.pickedUpByName} · {formatDateTime(c.pickedUpAt)}</div>}
                    </td>
                    <td className="text-right">{canUpdate && !pickedUp && <Button size="sm" variant="outline" onClick={() => setPickup(c)}>Retirada</Button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && <CreateCorrespondenceDialog gates={gates} users={users} onClose={() => setCreating(false)} onSaved={() => { invalidate(); setCreating(false); }} />}
      {pickup && <PickupDialog correspondence={pickup} onClose={() => setPickup(null)} onSaved={() => { invalidate(); setPickup(null); }} />}
    </SectionCard>
  );
}

function CreateCorrespondenceDialog({ gates, users, onClose, onSaved }: { gates: Opt; users: Opt; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<AnyRecord>({ recipient: '', recipientUserId: '', sender: '', carrierName: '', trackingCode: '', type: '', gateId: '', notes: '' });
  const save = useMutation({
    mutationFn: () => api('/asset-security/correspondences', {
      method: 'POST',
      json: {
        recipient: form.recipient,
        recipientUserId: form.recipientUserId || null,
        sender: form.sender || null,
        carrierName: form.carrierName || null,
        trackingCode: form.trackingCode || null,
        type: form.type || null,
        gateId: form.gateId || null,
        notes: form.notes || null,
      },
    }),
    onSuccess: () => { toast.success('Correspondência registrada'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao registrar'),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4" />Registrar recebimento</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><Label className="field-required">Destinatário</Label><Input value={form.recipient} onChange={(e) => setForm((f) => ({ ...f, recipient: e.target.value }))} /></div>
          <div><Label>Colaborador destinatário</Label><NativeSelect value={form.recipientUserId} onChange={(e) => setForm((f) => ({ ...f, recipientUserId: e.target.value }))}><option value="">—</option>{users.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}</NativeSelect></div>
          <div><Label>Remetente</Label><Input value={form.sender} onChange={(e) => setForm((f) => ({ ...f, sender: e.target.value }))} /></div>
          <div><Label>Transportadora</Label><Input value={form.carrierName} onChange={(e) => setForm((f) => ({ ...f, carrierName: e.target.value }))} /></div>
          <div><Label>Código de rastreio</Label><Input value={form.trackingCode} onChange={(e) => setForm((f) => ({ ...f, trackingCode: e.target.value }))} /></div>
          <div><Label>Tipo</Label><Input value={form.type} placeholder="Carta, encomenda, sedex…" onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} /></div>
          <div><Label>Portaria</Label><NativeSelect value={form.gateId} onChange={(e) => setForm((f) => ({ ...f, gateId: e.target.value }))}><option value="">—</option>{gates.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</NativeSelect></div>
          <div className="md:col-span-2"><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button disabled={!String(form.recipient).trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Salvando…' : 'Registrar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PickupDialog({ correspondence, onClose, onSaved }: { correspondence: AnyRecord; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<AnyRecord>({ pickedUpByName: '', acknowledgement: '' });
  const pickup = useMutation({
    mutationFn: () => api(`/asset-security/correspondences/${correspondence.id}/pickup`, { method: 'POST', json: { pickedUpByName: form.pickedUpByName, acknowledgement: form.acknowledgement || null } }),
    onSuccess: () => { toast.success('Retirada registrada'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao registrar retirada'),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Registrar retirada</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{correspondence.recipient} · {correspondence.trackingCode ?? 'sem rastreio'}</p>
          <div><Label className="field-required">Quem retirou</Label><Input value={form.pickedUpByName} onChange={(e) => setForm((f) => ({ ...f, pickedUpByName: e.target.value }))} /></div>
          <div><Label>Comprovante / observação</Label><Textarea rows={2} value={form.acknowledgement} onChange={(e) => setForm((f) => ({ ...f, acknowledgement: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button disabled={!String(form.pickedUpByName).trim() || pickup.isPending} onClick={() => pickup.mutate()}>{pickup.isPending ? 'Salvando…' : 'Confirmar retirada'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
