'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileCheck2, Plus } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { EmptyState } from '@/components/platform/empty-state';
import { StatusBadge } from '@/components/platform/status-badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { PERSON_TYPE_LABELS, RECORD_STATUS_LABELS, labelFor, statusTone, toOptions } from '@/lib/asset-security/labels';
import type { AnyRecord } from '@/lib/asset-security/types';

const SCOPE_OPTS = [
  { value: 'PERSON', label: 'Pessoa' },
  { value: 'VEHICLE', label: 'Veículo' },
  { value: 'CONTRACTOR', label: 'Empresa prestadora' },
  { value: 'SERVICE', label: 'Tipo de serviço' },
  { value: 'CARGO', label: 'Carga' },
  { value: 'GATE', label: 'Portaria' },
  { value: 'GLOBAL', label: 'Geral' },
];
const SCOPE_LABELS: Record<string, string> = Object.fromEntries(SCOPE_OPTS.map((o) => [o.value, o.label]));
const PERSON_TYPE_OPTS = toOptions(['VISITOR', 'CONTRACTOR', 'DRIVER', 'EMPLOYEE', 'THIRD_PARTY', 'SUPPLIER'], PERSON_TYPE_LABELS);

export function DocumentRequirementsSection({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const list = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'document-requirements'], queryFn: () => api('/asset-security/document-requirements') });
  const [editing, setEditing] = useState<AnyRecord | 'new' | null>(null);
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['asset-security', 'document-requirements'] });
  const rows = list.data ?? [];

  return (
    <SectionCard
      title={`Exigência documental (${rows.length})`}
      description="Matriz de documentos obrigatórios por escopo, com bloqueio e alerta de validade."
      contentClassName="p-0"
      actions={canManage && <Button size="sm" onClick={() => setEditing('new')}><Plus className="mr-2 h-4 w-4" />Exigência</Button>}
    >
      {list.isPending ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<FileCheck2 className="h-5 w-5" />} title="Nenhuma exigência" description="Defina os documentos obrigatórios por escopo." className="border-0" />
      ) : (
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead><tr><th className="text-left">Documento</th><th className="text-left">Escopo</th><th className="text-left">Aplicação</th><th className="text-left">Regra</th><th className="text-left">Alerta</th><th className="text-left">Status</th>{canManage && <th />}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.name}<div className="text-xs text-muted-foreground">{r.documentKind}</div></td>
                  <td>{SCOPE_LABELS[r.scopeType] ?? r.scopeType}</td>
                  <td className="text-xs">{[r.personType ? labelFor(r.personType, PERSON_TYPE_LABELS) : null, r.vehicleType, r.serviceType, r.cargoType].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="text-xs">{r.required ? 'Obrigatório' : 'Opcional'}{r.blockOnMissing ? ' · bloqueia' : ''}</td>
                  <td className="text-xs">{r.warningDays} dia(s)</td>
                  <td><StatusBadge value={r.status} label={labelFor(r.status, RECORD_STATUS_LABELS)} tone={statusTone(r.status)} /></td>
                  {canManage && <td className="text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(r)}>Editar</Button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <RequirementDialog requirement={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { invalidate(); setEditing(null); }} />}
    </SectionCard>
  );
}

function RequirementDialog({ requirement, onClose, onSaved }: { requirement: AnyRecord | null; onClose: () => void; onSaved: () => void }) {
  const editing = Boolean(requirement?.id);
  const [form, setForm] = useState<AnyRecord>(() => ({
    name: requirement?.name ?? '',
    documentKind: requirement?.documentKind ?? '',
    scopeType: requirement?.scopeType ?? 'PERSON',
    personType: requirement?.personType ?? '',
    vehicleType: requirement?.vehicleType ?? '',
    serviceType: requirement?.serviceType ?? '',
    criticality: requirement?.criticality ?? '',
    required: requirement?.required ?? true,
    blockOnMissing: requirement?.blockOnMissing ?? false,
    warningDays: requirement?.warningDays ?? 30,
    status: requirement?.status ?? 'ACTIVE',
  }));
  const save = useMutation({
    mutationFn: () => api(editing ? `/asset-security/document-requirements/${requirement!.id}` : '/asset-security/document-requirements', {
      method: editing ? 'PATCH' : 'POST',
      json: {
        name: form.name,
        documentKind: form.documentKind,
        scopeType: form.scopeType,
        personType: form.personType || null,
        vehicleType: form.vehicleType || null,
        serviceType: form.serviceType || null,
        criticality: form.criticality || null,
        required: Boolean(form.required),
        blockOnMissing: Boolean(form.blockOnMissing),
        warningDays: form.warningDays === '' ? 30 : Number(form.warningDays),
        status: form.status,
      },
    }),
    onSuccess: () => { toast.success(editing ? 'Exigência atualizada' : 'Exigência criada'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar'),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Editar exigência documental' : 'Nova exigência documental'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><Label className="field-required">Documento</Label><Input value={form.name} placeholder="Ex.: ASO, NR-10, CRLV" onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
          <div><Label className="field-required">Tipo / categoria</Label><Input value={form.documentKind} placeholder="Ex.: Saúde, Treinamento, Veicular" onChange={(e) => setForm((f) => ({ ...f, documentKind: e.target.value }))} /></div>
          <div><Label className="field-required">Escopo</Label><NativeSelect value={form.scopeType} onChange={(e) => setForm((f) => ({ ...f, scopeType: e.target.value }))}>{SCOPE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></div>
          <div><Label>Tipo de pessoa</Label><NativeSelect value={form.personType} onChange={(e) => setForm((f) => ({ ...f, personType: e.target.value }))}><option value="">—</option>{PERSON_TYPE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></div>
          <div><Label>Tipo de veículo</Label><Input value={form.vehicleType} onChange={(e) => setForm((f) => ({ ...f, vehicleType: e.target.value }))} /></div>
          <div><Label>Tipo de serviço</Label><Input value={form.serviceType} onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))} /></div>
          <div><Label>Dias de alerta antes do vencimento</Label><Input type="number" value={form.warningDays} onChange={(e) => setForm((f) => ({ ...f, warningDays: e.target.value }))} /></div>
          <div><Label>Status</Label><NativeSelect value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>{toOptions(['ACTIVE', 'INACTIVE'], RECORD_STATUS_LABELS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></div>
          <label className="flex items-center gap-2 pt-1 text-sm"><input type="checkbox" checked={Boolean(form.required)} onChange={(e) => setForm((f) => ({ ...f, required: e.target.checked }))} />Documento obrigatório</label>
          <label className="flex items-center gap-2 pt-1 text-sm"><input type="checkbox" checked={Boolean(form.blockOnMissing)} onChange={(e) => setForm((f) => ({ ...f, blockOnMissing: e.target.checked }))} />Bloquear acesso se ausente/vencido</label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button disabled={!String(form.name).trim() || !String(form.documentKind).trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Salvando…' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
