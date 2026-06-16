'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
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
import { INCIDENT_SEVERITY_LABELS, INCIDENT_STATUS_LABELS, labelFor, statusTone, toOptions } from '@/lib/asset-security/labels';
import { formatDateTime } from '@/lib/asset-security/format';
import type { AnyRecord } from '@/lib/asset-security/types';

type Opt = Array<{ value: string; label: string }>;

const SEVERITY_OPTS = toOptions(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY'], INCIDENT_SEVERITY_LABELS);
// Status editáveis manualmente (CLOSED é feito pelo botão "Fechar", que também encerra o item no Meu Dia).
const STATUS_OPTS = toOptions(['OPEN', 'IN_PROGRESS', 'WAITING_ACTION', 'CANCELLED'], INCIDENT_STATUS_LABELS);

export function IncidentsSection({ gates, posts, users, canIncident }: { gates: Opt; posts: Opt; users: Opt; canIncident: boolean }) {
  const qc = useQueryClient();
  const incidents = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'incidents'], queryFn: () => api('/asset-security/incidents?take=200') });
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<AnyRecord | 'new' | null>(null);
  const userMap = useMemo(() => new Map(users.map((u) => [u.value, u.label])), [users]);

  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['asset-security', 'incidents'] }); void qc.invalidateQueries({ queryKey: ['asset-security', 'summary'] }); };

  const rows = (incidents.data ?? []).filter((it) => (severity ? it.severity === severity : true) && (status ? it.status === status : true));

  return (
    <SectionCard
      title={`Ocorrências (${rows.length})`}
      description="Registro, tratativa e encerramento de ocorrências de segurança."
      contentClassName="p-0"
      actions={canIncident && <Button size="sm" onClick={() => setEditing('new')}><Plus className="mr-2 h-4 w-4" />Ocorrência</Button>}
    >
      <div className="flex flex-col gap-2 border-b p-3 sm:flex-row">
        <NativeSelect className="sm:w-48" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">Todas as criticidades</option>
          {SEVERITY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </NativeSelect>
        <NativeSelect className="sm:w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {toOptions(['OPEN', 'IN_PROGRESS', 'WAITING_ACTION', 'CLOSED', 'CANCELLED'], INCIDENT_STATUS_LABELS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </NativeSelect>
      </div>

      {incidents.isPending ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Nenhuma ocorrência" description="Sem ocorrências para o filtro selecionado." className="border-0" />
      ) : (
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead><tr><th className="text-left">Código</th><th className="text-left">Título</th><th className="text-left">Criticidade</th><th className="text-left">Status</th><th className="text-left">Responsável</th><th className="text-left">Prazo</th><th className="text-right">Ações</th></tr></thead>
            <tbody>
              {rows.map((it) => (
                <tr key={it.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setEditing(it)}>
                  <td className="font-medium">{it.code ?? '—'}</td>
                  <td className="max-w-[280px] truncate">{it.title}</td>
                  <td><StatusBadge value={it.severity} label={labelFor(it.severity, INCIDENT_SEVERITY_LABELS)} tone={statusTone(it.severity)} /></td>
                  <td><StatusBadge value={it.status} label={labelFor(it.status, INCIDENT_STATUS_LABELS)} tone={statusTone(it.status)} /></td>
                  <td className="text-xs">{it.responsibleUserId ? (userMap.get(it.responsibleUserId) ?? '—') : '—'}</td>
                  <td className="text-xs">{it.dueAt ? formatDateTime(it.dueAt) : '—'}</td>
                  <td className="text-right"><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditing(it); }}>Detalhe</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <IncidentDialog
          incident={editing === 'new' ? null : editing}
          gates={gates}
          posts={posts}
          users={users}
          canIncident={canIncident}
          onClose={() => setEditing(null)}
          onSaved={() => { invalidate(); setEditing(null); }}
        />
      )}
    </SectionCard>
  );
}

function IncidentDialog({ incident, gates, posts, users, canIncident, onClose, onSaved }: { incident: AnyRecord | null; gates: Opt; posts: Opt; users: Opt; canIncident: boolean; onClose: () => void; onSaved: () => void }) {
  const editing = Boolean(incident?.id);
  const closed = incident?.status === 'CLOSED' || incident?.status === 'CANCELLED';
  const [form, setForm] = useState<AnyRecord>(() => ({
    title: incident?.title ?? '',
    type: incident?.type ?? '',
    severity: incident?.severity ?? 'MEDIUM',
    status: incident?.status ?? 'OPEN',
    gateId: incident?.gateId ?? '',
    postId: incident?.postId ?? '',
    responsibleUserId: incident?.responsibleUserId ?? '',
    dueAt: toLocalInput(incident?.dueAt),
    description: incident?.description ?? '',
    immediateAction: incident?.immediateAction ?? '',
    rootCauseHypothesis: incident?.rootCauseHypothesis ?? '',
  }));

  function payload() {
    return {
      title: form.title,
      type: form.type || null,
      severity: form.severity,
      ...(editing ? { status: form.status } : {}),
      gateId: form.gateId || null,
      postId: form.postId || null,
      responsibleUserId: form.responsibleUserId || null,
      dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      description: form.description || null,
      immediateAction: form.immediateAction || null,
      rootCauseHypothesis: form.rootCauseHypothesis || null,
    };
  }

  const save = useMutation({
    mutationFn: () => editing
      ? api(`/asset-security/incidents/${incident!.id}`, { method: 'PATCH', json: payload() })
      : api('/asset-security/incidents', { method: 'POST', json: payload() }),
    onSuccess: () => { toast.success(editing ? 'Ocorrência atualizada' : 'Ocorrência registrada'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar'),
  });
  const close = useMutation({
    mutationFn: () => api(`/asset-security/incidents/${incident!.id}/close`, { method: 'POST', json: { immediateAction: form.immediateAction || null } }),
    onSuccess: () => { toast.success('Ocorrência encerrada'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao encerrar'),
  });

  const readOnly = !canIncident || closed;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {editing ? (incident!.code ?? 'Ocorrência') : 'Registrar ocorrência'}
            {editing && <StatusBadge value={incident!.status} label={labelFor(incident!.status, INCIDENT_STATUS_LABELS)} tone={statusTone(incident!.status)} />}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><Label className="field-required">Título</Label><Input value={form.title} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
          <div><Label>Tipo</Label><Input value={form.type} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} /></div>
          <div><Label className="field-required">Criticidade</Label><NativeSelect value={form.severity} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>{SEVERITY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></div>
          {editing && <div><Label>Status</Label><NativeSelect value={form.status} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>{STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}{closed && <option value={incident!.status}>{labelFor(incident!.status, INCIDENT_STATUS_LABELS)}</option>}</NativeSelect></div>}
          <div><Label>Portaria</Label><NativeSelect value={form.gateId} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, gateId: e.target.value }))}><option value="">—</option>{gates.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</NativeSelect></div>
          <div><Label>Posto</Label><NativeSelect value={form.postId} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, postId: e.target.value }))}><option value="">—</option>{posts.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</NativeSelect></div>
          <div><Label>Responsável</Label><NativeSelect value={form.responsibleUserId} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, responsibleUserId: e.target.value }))}><option value="">—</option>{users.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}</NativeSelect></div>
          <div><Label>Prazo</Label><Input type="datetime-local" value={form.dueAt} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))} /></div>
          <div className="md:col-span-2"><Label>Descrição</Label><Textarea rows={2} value={form.description} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
          <div className="md:col-span-2"><Label>Ação imediata</Label><Textarea rows={2} value={form.immediateAction} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, immediateAction: e.target.value }))} /></div>
          <div className="md:col-span-2"><Label>Hipótese de causa raiz</Label><Textarea rows={2} value={form.rootCauseHypothesis} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, rootCauseHypothesis: e.target.value }))} /></div>
        </div>

        {editing && incident!.closedAt && <p className="text-xs text-muted-foreground">Encerrada em {formatDateTime(incident!.closedAt)}.</p>}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {canIncident && editing && !closed && <Button variant="outline" className="border-status-green/40 text-status-green hover:bg-status-green/5" disabled={close.isPending} onClick={() => close.mutate()}>{close.isPending ? 'Encerrando…' : 'Encerrar ocorrência'}</Button>}
          {canIncident && !closed && <Button disabled={!String(form.title).trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Salvando…' : 'Salvar'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}
