'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

type ComplianceResult = 'PENDING' | 'MET' | 'PARTIAL' | 'NOT_MET' | 'NOT_APPLICABLE';
type VersionStatus = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED';
type Criticality = 'LOW' | 'MEDIUM' | 'HIGH';
interface UserRef { id: string; name: string; email?: string }

interface StandardVersion { id: string; versionLabel: string; status: VersionStatus; effectiveDate: string | null; _count?: { requirements: number } }
interface Standard { id: string; code: string | null; name: string; origin: string | null; description: string | null; active: boolean; versions: StandardVersion[] }
interface Assessment { id: string; result: ComplianceResult; evidence: string | null; notes: string | null; assessedAt: string | null; nextAssessmentAt: string | null; responsible: { id: string; name: string } | null }
interface Requirement {
  id: string;
  code: string | null;
  chapter: string | null;
  item: string | null;
  subitem: string | null;
  title: string;
  description: string | null;
  applicability: string | null;
  evidenceRequired: string | null;
  criticality: Criticality;
  periodicityDays: number | null;
  responsibleUserId: string | null;
  standardVersionId: string;
  responsible: { id: string; name: string } | null;
  assessments: Assessment[];
}
interface ComplianceSummary { requirements: number; met: number; partial: number; notMet: number; notApplicable: number; pending: number; applicable: number; compliancePct: number }

const RESULT_LABEL: Record<ComplianceResult, string> = { PENDING: 'Pendente', MET: 'Atendido', PARTIAL: 'Parcial', NOT_MET: 'Não atendido', NOT_APPLICABLE: 'Não aplicável' };
const RESULT_CLASS: Record<ComplianceResult, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  MET: 'bg-emerald-100 text-emerald-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  NOT_MET: 'bg-rose-100 text-rose-700',
  NOT_APPLICABLE: 'bg-slate-100 text-slate-500',
};
const CRIT_LABEL: Record<Criticality, string> = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta' };
const VERSION_STATUS_LABEL: Record<VersionStatus, string> = { DRAFT: 'Rascunho', ACTIVE: 'Vigente', SUPERSEDED: 'Substituída' };

export function ComplianceTab({ canManage, users }: { canManage: boolean; users: UserRef[] }) {
  const qc = useQueryClient();
  const [standardId, setStandardId] = useState('');
  const [versionId, setVersionId] = useState('');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [reqDialog, setReqDialog] = useState<Requirement | 'new' | null>(null);
  const [assessReq, setAssessReq] = useState<Requirement | null>(null);

  const standards = useQuery<Standard[]>({ queryKey: ['fsms', 'standards'], queryFn: () => api('/food-safety/standards') });

  useEffect(() => {
    const rows = standards.data ?? [];
    if (rows.length === 0) return;
    const std = rows.find((s) => s.id === standardId) ?? rows[0];
    if (std.id !== standardId) setStandardId(std.id);
    const versions = std.versions ?? [];
    if (versions.length && !versions.some((v) => v.id === versionId)) {
      setVersionId((versions.find((v) => v.status === 'ACTIVE') ?? versions[0]).id);
    }
  }, [standards.data, standardId, versionId]);

  const standard = (standards.data ?? []).find((s) => s.id === standardId) ?? null;
  const versions = standard?.versions ?? [];

  const requirements = useQuery<Requirement[]>({ queryKey: ['fsms', 'requirements', versionId], queryFn: () => api(`/food-safety/requirements?standardVersionId=${versionId}`), enabled: !!versionId });
  const summary = useQuery<ComplianceSummary>({ queryKey: ['fsms', 'compliance-summary', versionId], queryFn: () => api(`/food-safety/compliance-summary?standardVersionId=${versionId}`), enabled: !!versionId });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ['fsms', 'standards'] });
    void qc.invalidateQueries({ queryKey: ['fsms', 'requirements'] });
    void qc.invalidateQueries({ queryKey: ['fsms', 'compliance-summary'] });
  }

  if ((standards.data ?? []).length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-base font-semibold">Catálogo normativo vazio</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Cadastre as normas e regulamentos aplicáveis (ISO 22000, BRCGS, SQF, RDC Anvisa, requisitos internos/clientes...) e suas versões para avaliar a conformidade.
          </p>
          {canManage && <Button className="mt-4" onClick={() => setCatalogOpen(true)}><Plus className="mr-2 h-4 w-4" />Gerenciar catálogo</Button>}
        </CardContent>
        {catalogOpen && <CatalogDialog standards={standards.data ?? []} canManage={canManage} onClose={() => setCatalogOpen(false)} onChanged={invalidate} />}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <Label>Norma</Label>
            <NativeSelect className="w-64" value={standardId} onChange={(e) => { setStandardId(e.target.value); setVersionId(''); }}>
              {(standards.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.code ? `${s.code} · ` : ''}{s.name}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label>Versão</Label>
            <NativeSelect className="w-48" value={versionId} onChange={(e) => setVersionId(e.target.value)}>
              {versions.map((v) => <option key={v.id} value={v.id}>{v.versionLabel} ({VERSION_STATUS_LABEL[v.status]})</option>)}
            </NativeSelect>
          </div>
          <div className="ml-auto flex gap-2">
            {canManage && <Button variant="outline" onClick={() => setCatalogOpen(true)}>Gerenciar catálogo</Button>}
            {canManage && versionId && <Button onClick={() => setReqDialog('new')}><Plus className="mr-2 h-4 w-4" />Novo requisito</Button>}
          </div>
        </CardContent>
      </Card>

      {summary.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryCard label="Conformidade" value={`${summary.data.compliancePct}%`} highlight />
          <SummaryCard label="Atendidos" value={summary.data.met} />
          <SummaryCard label="Parciais" value={summary.data.partial} />
          <SummaryCard label="Não atendidos" value={summary.data.notMet} />
          <SummaryCard label="Pendentes" value={summary.data.pending} />
          <SummaryCard label="N/A" value={summary.data.notApplicable} />
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="border-b p-3 text-sm font-semibold">Matriz de requisitos</div>
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th className="text-left">Cap./Item</th>
                  <th className="text-left">Requisito</th>
                  <th className="text-left">Criticidade</th>
                  <th className="text-left">Resultado</th>
                  <th className="text-left">Responsável</th>
                  <th className="text-left">Próx. avaliação</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {requirements.isPending ? (
                  <tr><td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">Carregando...</td></tr>
                ) : (requirements.data ?? []).length === 0 ? (
                  <tr><td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">Nenhum requisito nesta versão. Use &quot;Novo requisito&quot;.</td></tr>
                ) : (
                  (requirements.data ?? []).map((r) => {
                    const last = r.assessments[0];
                    const result = last?.result ?? 'PENDING';
                    return (
                      <tr key={r.id}>
                        <td className="text-xs">{[r.chapter, r.item, r.subitem].filter(Boolean).join('.') || r.code || '—'}</td>
                        <td><div className="font-medium">{r.title}</div>{r.code ? <div className="text-xs text-muted-foreground">{r.code}</div> : null}</td>
                        <td>{CRIT_LABEL[r.criticality]}</td>
                        <td><span className={cn('rounded px-2 py-0.5 text-xs font-medium', RESULT_CLASS[result])}>{RESULT_LABEL[result]}</span></td>
                        <td className="text-sm">{r.responsible?.name ?? '—'}</td>
                        <td className="text-xs">{last?.nextAssessmentAt ? formatDate(last.nextAssessmentAt) : '—'}</td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2">
                            {canManage && <Button size="sm" onClick={() => setAssessReq(r)}>Avaliar</Button>}
                            <Button variant="outline" size="sm" onClick={() => setReqDialog(r)}>{canManage ? 'Editar' : 'Ver'}</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {catalogOpen && <CatalogDialog standards={standards.data ?? []} canManage={canManage} onClose={() => setCatalogOpen(false)} onChanged={invalidate} />}
      {reqDialog && versionId && (
        <RequirementDialog record={reqDialog === 'new' ? null : reqDialog} standardVersionId={versionId} users={users} canManage={canManage} onClose={() => setReqDialog(null)} onSaved={() => { setReqDialog(null); invalidate(); }} />
      )}
      {assessReq && (
        <AssessDialog requirement={assessReq} users={users} canManage={canManage} onClose={() => setAssessReq(null)} onSaved={() => { setAssessReq(null); invalidate(); }} />
      )}
    </div>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={cn('rounded-lg border bg-card p-3', highlight && 'border-primary/40 bg-primary/5')}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-2xl font-semibold', highlight && 'text-primary')}>{value}</div>
    </div>
  );
}

function CatalogDialog({ standards, canManage, onClose, onChanged }: { standards: Standard[]; canManage: boolean; onClose: () => void; onChanged: () => void }) {
  const [selectedId, setSelectedId] = useState(standards[0]?.id ?? '');
  const [stdForm, setStdForm] = useState<{ name: string; code: string; origin: string } | null>(null);
  const [verLabel, setVerLabel] = useState('');
  const selected = standards.find((s) => s.id === selectedId) ?? null;

  const saveStd = useMutation({
    mutationFn: (payload: { id?: string; name: string; code: string | null; origin: string | null }) =>
      payload.id ? api(`/food-safety/standards/${payload.id}`, { method: 'PATCH', json: payload }) : api('/food-safety/standards', { method: 'POST', json: payload }),
    onSuccess: () => { toast.success('Norma salva'); setStdForm(null); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar'),
  });
  const addVersion = useMutation({
    mutationFn: () => api('/food-safety/standard-versions', { method: 'POST', json: { standardId: selectedId, versionLabel: verLabel } }),
    onSuccess: () => { toast.success('Versão criada'); setVerLabel(''); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao criar versão'),
  });
  const setActive = useMutation({
    mutationFn: (id: string) => api(`/food-safety/standard-versions/${id}`, { method: 'PATCH', json: { status: 'ACTIVE' } }),
    onSuccess: () => { toast.success('Versão vigente atualizada'); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Catálogo normativo</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">Normas</div>
              {canManage && <Button size="sm" variant="outline" onClick={() => setStdForm({ name: '', code: '', origin: '' })}><Plus className="mr-1 h-3.5 w-3.5" />Nova</Button>}
            </div>
            <div className="space-y-1">
              {standards.map((s) => (
                <button key={s.id} type="button" onClick={() => setSelectedId(s.id)} className={cn('w-full rounded-md border p-2 text-left text-sm', selectedId === s.id && 'border-primary/40 bg-primary/5')}>
                  <div className="font-medium">{s.code ? `${s.code} · ` : ''}{s.name}</div>
                  {s.origin ? <div className="text-xs text-muted-foreground">{s.origin}</div> : null}
                </button>
              ))}
            </div>
            {stdForm && (
              <div className="mt-3 space-y-2 rounded-md border p-2">
                <Input placeholder="Nome (ex.: ISO 22000)" value={stdForm.name} onChange={(e) => setStdForm({ ...stdForm, name: e.target.value })} />
                <Input placeholder="Código" value={stdForm.code} onChange={(e) => setStdForm({ ...stdForm, code: e.target.value })} />
                <Input placeholder="Origem (ISO, BRCGS, Anvisa, interno...)" value={stdForm.origin} onChange={(e) => setStdForm({ ...stdForm, origin: e.target.value })} />
                <div className="flex gap-2">
                  <Button size="sm" disabled={!stdForm.name.trim() || saveStd.isPending} onClick={() => saveStd.mutate({ name: stdForm.name, code: stdForm.code || null, origin: stdForm.origin || null })}>Salvar norma</Button>
                  <Button size="sm" variant="ghost" onClick={() => setStdForm(null)}>Cancelar</Button>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold">Versões {selected ? `· ${selected.name}` : ''}</div>
            {!selected ? (
              <p className="text-xs text-muted-foreground">Selecione uma norma.</p>
            ) : (
              <>
                <div className="space-y-1">
                  {(selected.versions ?? []).map((v) => (
                    <div key={v.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                      <span className="font-medium">{v.versionLabel}</span>
                      <Badge variant="outline">{VERSION_STATUS_LABEL[v.status]}</Badge>
                      <span className="text-xs text-muted-foreground">{v._count?.requirements ?? 0} req.</span>
                      {canManage && v.status !== 'ACTIVE' && <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => setActive.mutate(v.id)}>Tornar vigente</Button>}
                    </div>
                  ))}
                  {(selected.versions ?? []).length === 0 && <div className="text-xs text-muted-foreground">Nenhuma versão.</div>}
                </div>
                {canManage && (
                  <div className="mt-3 flex gap-2">
                    <Input placeholder="Nova versão (ex.: 2018 / Issue 9)" value={verLabel} onChange={(e) => setVerLabel(e.target.value)} />
                    <Button size="sm" disabled={!verLabel.trim() || addVersion.isPending} onClick={() => addVersion.mutate()}>Adicionar</Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequirementDialog({ record, standardVersionId, users, canManage, onClose, onSaved }: { record: Requirement | null; standardVersionId: string; users: UserRef[]; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: record?.title ?? '',
    code: record?.code ?? '',
    chapter: record?.chapter ?? '',
    item: record?.item ?? '',
    subitem: record?.subitem ?? '',
    description: record?.description ?? '',
    applicability: record?.applicability ?? '',
    evidenceRequired: record?.evidenceRequired ?? '',
    criticality: record?.criticality ?? ('MEDIUM' as Criticality),
    periodicityDays: record?.periodicityDays != null ? String(record.periodicityDays) : '',
    responsibleUserId: record?.responsibleUserId ?? '',
  });
  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, standardVersionId, code: form.code || null, chapter: form.chapter || null, item: form.item || null, subitem: form.subitem || null, description: form.description || null, applicability: form.applicability || null, evidenceRequired: form.evidenceRequired || null, periodicityDays: form.periodicityDays || null, responsibleUserId: form.responsibleUserId || null };
      return record ? api(`/food-safety/requirements/${record.id}`, { method: 'PATCH', json: payload }) : api('/food-safety/requirements', { method: 'POST', json: payload });
    },
    onSuccess: () => { toast.success('Requisito salvo'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar'),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{record ? 'Requisito' : 'Novo requisito'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div><Label>Capítulo</Label><Input value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Item</Label><Input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Subitem</Label><Input value={form.subitem} onChange={(e) => setForm({ ...form, subitem: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-3"><Label className="field-required">Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!canManage} /></div>
          <div>
            <Label>Criticidade</Label>
            <NativeSelect value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value as Criticality })} disabled={!canManage}>
              <option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option>
            </NativeSelect>
          </div>
          <div><Label>Periodicidade (dias)</Label><Input type="number" value={form.periodicityDays} onChange={(e) => setForm({ ...form, periodicityDays: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-3"><Label>Descrição</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-3"><Label>Aplicabilidade</Label><Textarea rows={2} value={form.applicability} onChange={(e) => setForm({ ...form, applicability: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-2"><Label>Evidências exigidas</Label><Input value={form.evidenceRequired} onChange={(e) => setForm({ ...form, evidenceRequired: e.target.value })} disabled={!canManage} /></div>
          <div>
            <Label>Responsável</Label>
            <NativeSelect value={form.responsibleUserId} onChange={(e) => setForm({ ...form, responsibleUserId: e.target.value })} disabled={!canManage}>
              <option value="">—</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </NativeSelect>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {canManage && <Button disabled={!form.title.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Salvando...' : 'Salvar'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssessDialog({ requirement, users, canManage, onClose, onSaved }: { requirement: Requirement; users: UserRef[]; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const last = requirement.assessments[0];
  const [form, setForm] = useState({
    result: (last?.result ?? 'MET') as ComplianceResult,
    evidence: '',
    notes: '',
    assessedAt: new Date().toISOString().slice(0, 10),
    responsibleUserId: requirement.responsibleUserId ?? '',
  });
  const save = useMutation({
    mutationFn: () => api(`/food-safety/requirements/${requirement.id}/assess`, { method: 'POST', json: { result: form.result, evidence: form.evidence || null, notes: form.notes || null, assessedAt: form.assessedAt, responsibleUserId: form.responsibleUserId || null } }),
    onSuccess: () => { toast.success('Avaliação registrada'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao avaliar'),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Avaliar requisito</DialogTitle></DialogHeader>
        <div className="rounded-md border bg-muted/20 p-2 text-sm">{requirement.title}</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>Resultado</Label>
            <NativeSelect value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value as ComplianceResult })} disabled={!canManage}>
              <option value="MET">Atendido</option>
              <option value="PARTIAL">Parcial</option>
              <option value="NOT_MET">Não atendido</option>
              <option value="NOT_APPLICABLE">Não aplicável</option>
              <option value="PENDING">Pendente</option>
            </NativeSelect>
          </div>
          <div><Label>Data</Label><Input type="date" value={form.assessedAt} onChange={(e) => setForm({ ...form, assessedAt: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-2">
            <Label>Responsável</Label>
            <NativeSelect value={form.responsibleUserId} onChange={(e) => setForm({ ...form, responsibleUserId: e.target.value })} disabled={!canManage}>
              <option value="">—</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </NativeSelect>
          </div>
          <div className="md:col-span-2"><Label>Evidência</Label><Textarea rows={2} value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-2"><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} disabled={!canManage} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {canManage && <Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Salvando...' : 'Registrar'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
