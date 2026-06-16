'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeftRight, Plus } from 'lucide-react';
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
import { HANDOVER_STATUS_LABELS, labelFor, statusTone } from '@/lib/asset-security/labels';
import { formatDateTime } from '@/lib/asset-security/format';
import type { AnyRecord } from '@/lib/asset-security/types';

type Opt = Array<{ value: string; label: string }>;

const OPEN_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'WAITING_REVIEW', 'WAITING_ACCEPTANCE'];

function splitLines(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

export function ShiftHandoverSection({ gates, posts, users, canHandover }: { gates: Opt; posts: Opt; users: Opt; canHandover: boolean }) {
  const qc = useQueryClient();
  const handovers = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'shift-handovers'], queryFn: () => api('/asset-security/shift-handovers?take=100') });
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState<AnyRecord | null>(null);
  const userMap = useMemo(() => new Map(users.map((u) => [u.value, u.label])), [users]);

  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['asset-security', 'shift-handovers'] }); void qc.invalidateQueries({ queryKey: ['asset-security', 'summary'] }); };
  const rows = handovers.data ?? [];

  return (
    <SectionCard
      title={`Passagem de turno (${rows.length})`}
      description="Registro e aceite de troca de turno, com pendências repassadas."
      contentClassName="p-0"
      actions={canHandover && <Button size="sm" onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Abrir passagem</Button>}
    >
      {handovers.isPending ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Nenhuma passagem de turno" description="Abra uma passagem ao encerrar o turno." className="border-0" />
      ) : (
        <div className="divide-y">
          {rows.map((h) => {
            const pending = Array.isArray(h.pendingItems) ? h.pendingItems.length : 0;
            const canComplete = canHandover && OPEN_STATUSES.includes(h.status);
            return (
              <div key={h.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                    {h.shiftName || 'Turno'}
                    <StatusBadge value={h.status} label={labelFor(h.status, HANDOVER_STATUS_LABELS)} tone={statusTone(h.status)} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {userMap.get(h.outgoingUserId) ?? '—'} → {h.incomingUserId ? (userMap.get(h.incomingUserId) ?? '—') : '—'} · {formatDateTime(h.startedAt)}
                    {pending > 0 && <span className="text-status-yellow"> · {pending} pendência(s)</span>}
                  </div>
                  {h.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{h.summary}</p>}
                </div>
                {canComplete && <Button size="sm" variant="outline" className="shrink-0" onClick={() => setCompleting(h)}>Concluir</Button>}
              </div>
            );
          })}
        </div>
      )}

      {creating && <CreateHandoverDialog gates={gates} posts={posts} users={users} onClose={() => setCreating(false)} onSaved={() => { invalidate(); setCreating(false); }} />}
      {completing && <CompleteHandoverDialog handover={completing} onClose={() => setCompleting(null)} onSaved={() => { invalidate(); setCompleting(null); }} />}
    </SectionCard>
  );
}

function CreateHandoverDialog({ gates, posts, users, onClose, onSaved }: { gates: Opt; posts: Opt; users: Opt; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<AnyRecord>({ shiftName: '', gateId: '', postId: '', incomingUserId: '', summary: '', pendingItems: '' });
  const save = useMutation({
    mutationFn: () => api('/asset-security/shift-handovers', {
      method: 'POST',
      json: {
        shiftName: form.shiftName || null,
        gateId: form.gateId || null,
        postId: form.postId || null,
        incomingUserId: form.incomingUserId || null,
        summary: form.summary || null,
        pendingItems: splitLines(String(form.pendingItems ?? '')),
      },
    }),
    onSuccess: () => { toast.success('Passagem aberta'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao abrir passagem'),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Abrir passagem de turno</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><Label>Turno</Label><Input value={form.shiftName} placeholder="Ex.: Noturno A" onChange={(e) => setForm((f) => ({ ...f, shiftName: e.target.value }))} /></div>
          <div><Label>Recebido por</Label><NativeSelect value={form.incomingUserId} onChange={(e) => setForm((f) => ({ ...f, incomingUserId: e.target.value }))}><option value="">—</option>{users.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}</NativeSelect></div>
          <div><Label>Portaria</Label><NativeSelect value={form.gateId} onChange={(e) => setForm((f) => ({ ...f, gateId: e.target.value }))}><option value="">—</option>{gates.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</NativeSelect></div>
          <div><Label>Posto</Label><NativeSelect value={form.postId} onChange={(e) => setForm((f) => ({ ...f, postId: e.target.value }))}><option value="">—</option>{posts.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</NativeSelect></div>
          <div className="md:col-span-2"><Label>Resumo do turno</Label><Textarea rows={2} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} /></div>
          <div className="md:col-span-2"><Label>Pendências (uma por linha)</Label><Textarea rows={3} value={form.pendingItems} placeholder={'Chave da doca 2 não devolvida\nCâmera 4 sem sinal'} onChange={(e) => setForm((f) => ({ ...f, pendingItems: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Salvando…' : 'Abrir passagem'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompleteHandoverDialog({ handover, onClose, onSaved }: { handover: AnyRecord; onClose: () => void; onSaved: () => void }) {
  const [summary, setSummary] = useState<string>(handover.summary ?? '');
  const [pending, setPending] = useState<string>(Array.isArray(handover.pendingItems) ? handover.pendingItems.join('\n') : '');
  const complete = useMutation({
    mutationFn: () => api(`/asset-security/shift-handovers/${handover.id}/complete`, { method: 'POST', json: { summary: summary || null, pendingItems: splitLines(pending) } }),
    onSuccess: () => { toast.success('Passagem concluída'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao concluir'),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Concluir passagem de turno</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Resumo</Label><Textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
          <div><Label>Pendências remanescentes (uma por linha)</Label><Textarea rows={3} value={pending} onChange={(e) => setPending(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">Com pendências, a passagem é concluída como “Concluída com pendências” e gera item no Meu Dia.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button disabled={complete.isPending} onClick={() => complete.mutate()}>{complete.isPending ? 'Concluindo…' : 'Concluir'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
