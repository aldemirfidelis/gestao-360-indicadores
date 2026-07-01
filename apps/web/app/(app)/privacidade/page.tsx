'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Database, Globe2, Plus, Pencil, ShieldCheck, Trash2, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface Overview {
  records: number;
  subprocessors: number;
  intlSubprocessors: number;
  openIncidents: number;
}
interface ProcessingRecord {
  id: string;
  name: string;
  area: string | null;
  purpose: string;
  legalBasis: string;
  dataSubjects: string[];
  dataCategories: string[];
  hasSensitiveData: boolean;
  sharedWith: string[];
  retentionPeriod: string | null;
  securityMeasures: string | null;
  internationalTransfer: boolean;
  status: string;
}
interface Subprocessor {
  id: string;
  name: string;
  service: string;
  country: string | null;
  internationalTransfer: boolean;
  transferSafeguard: string | null;
  contractRef: string | null;
  status: string;
  notes: string | null;
}
interface DataIncident {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  affectedData: string[];
  affectedSubjects: number | null;
  detectedAt: string;
  containedAt: string | null;
  resolvedAt: string | null;
  anpdNotified: boolean;
  subjectsNotified: boolean;
  measures: string | null;
}

const LEGAL_BASIS = [
  ['LEGAL_OBLIGATION', 'Obrigação legal/regulatória'],
  ['CONTRACT', 'Execução de contrato'],
  ['CONSENT', 'Consentimento'],
  ['LEGITIMATE_INTEREST', 'Legítimo interesse'],
  ['VITAL_INTEREST', 'Proteção da vida'],
  ['PUBLIC_POLICY', 'Política pública'],
  ['LEGAL_PROCESS', 'Exercício de direitos'],
] as const;
const RECORD_STATUS = [['ACTIVE', 'Ativa'], ['UNDER_REVIEW', 'Em revisão'], ['DISCONTINUED', 'Descontinuada']] as const;
const SUB_STATUS = [['ACTIVE', 'Ativo'], ['SUSPENDED', 'Suspenso'], ['TERMINATED', 'Encerrado']] as const;
const SEVERITY = [['CRITICAL', 'Crítico'], ['HIGH', 'Alto'], ['MEDIUM', 'Médio'], ['LOW', 'Baixo']] as const;
const INCIDENT_STATUS = [['OPEN', 'Aberto'], ['CONTAINED', 'Contido'], ['INVESTIGATING', 'Investigando'], ['RESOLVED', 'Resolvido'], ['CLOSED', 'Encerrado']] as const;

function labelOf(map: readonly (readonly [string, string])[], key: string) {
  return map.find(([k]) => k === key)?.[1] ?? key;
}
function toList(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

type Tab = 'overview' | 'ropa' | 'subprocessors' | 'incidents';

export default function PrivacidadePage() {
  const [tab, setTab] = useState<Tab>('overview');
  const overview = useQuery<Overview>({ queryKey: ['lgpd', 'overview'], queryFn: () => api<Overview>('/lgpd/overview') });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Visão geral' },
    { key: 'ropa', label: 'Registro de Tratamento (RoPA)' },
    { key: 'subprocessors', label: 'Suboperadores' },
    { key: 'incidents', label: 'Incidentes de dados' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Privacidade e LGPD"
        description="Registro das operações de tratamento (RoPA), suboperadores e incidentes de dados pessoais. Restrito a administradores."
      />

      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewCard icon={Database} label="Operações de tratamento" value={overview.data?.records ?? 0} />
          <OverviewCard icon={Users} label="Suboperadores" value={overview.data?.subprocessors ?? 0} />
          <OverviewCard icon={Globe2} label="Transferência internacional" value={overview.data?.intlSubprocessors ?? 0} />
          <OverviewCard icon={AlertTriangle} label="Incidentes em aberto" value={overview.data?.openIncidents ?? 0} highlight={(overview.data?.openIncidents ?? 0) > 0} />
        </div>
      )}

      {tab === 'ropa' && <RopaTab />}
      {tab === 'subprocessors' && <SubprocessorsTab />}
      {tab === 'incidents' && <IncidentsTab />}
    </div>
  );
}

function OverviewCard({ icon: Icon, label, value, highlight }: { icon: typeof Database; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card'}`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RoPA
// ---------------------------------------------------------------------------
const EMPTY_RECORD: ProcessingRecord = {
  id: '', name: '', area: '', purpose: '', legalBasis: 'LEGAL_OBLIGATION', dataSubjects: [], dataCategories: [],
  hasSensitiveData: false, sharedWith: [], retentionPeriod: '', securityMeasures: '', internationalTransfer: false, status: 'ACTIVE',
};

function RopaTab() {
  const qc = useQueryClient();
  const query = useQuery<ProcessingRecord[]>({ queryKey: ['lgpd', 'records'], queryFn: () => api<ProcessingRecord[]>('/lgpd/processing-records') });
  const [editing, setEditing] = useState<ProcessingRecord | null>(null);

  const save = useMutation({
    mutationFn: (r: ProcessingRecord) => {
      const body = {
        name: r.name, area: r.area || undefined, purpose: r.purpose, legalBasis: r.legalBasis,
        dataSubjects: r.dataSubjects, dataCategories: r.dataCategories, hasSensitiveData: r.hasSensitiveData,
        sharedWith: r.sharedWith, retentionPeriod: r.retentionPeriod || undefined, securityMeasures: r.securityMeasures || undefined,
        internationalTransfer: r.internationalTransfer, status: r.status,
      };
      return r.id
        ? api(`/lgpd/processing-records/${r.id}`, { method: 'PATCH', json: body })
        : api('/lgpd/processing-records', { method: 'POST', json: body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lgpd'] }); setEditing(null); toast.success('Registro salvo'); },
    onError: () => toast.error('Falha ao salvar'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/lgpd/processing-records/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lgpd'] }); toast.success('Registro excluído'); },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ ...EMPTY_RECORD })}><Plus className="mr-1.5 h-4 w-4" />Nova operação</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Operação</th>
              <th className="px-3 py-2">Base legal</th>
              <th className="px-3 py-2">Sensíveis</th>
              <th className="px-3 py-2">Transf. intl.</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {query.data?.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.area || r.purpose.slice(0, 60)}</div>
                </td>
                <td className="px-3 py-2">{labelOf(LEGAL_BASIS, r.legalBasis)}</td>
                <td className="px-3 py-2">{r.hasSensitiveData ? <Badge variant="destructive">Sim</Badge> : <Badge variant="secondary">Não</Badge>}</td>
                <td className="px-3 py-2">{r.internationalTransfer ? <Badge variant="outline">Sim</Badge> : '—'}</td>
                <td className="px-3 py-2"><Badge variant="secondary">{labelOf(RECORD_STATUS, r.status)}</Badge></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm('Excluir este registro?')) remove.mutate(r.id); }}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
            {query.data && query.data.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Nenhuma operação de tratamento registrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar operação' : 'Nova operação de tratamento'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              <Field label="Nome da operação" className="sm:col-span-2"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Área/processo"><Input value={editing.area ?? ''} onChange={(e) => setEditing({ ...editing, area: e.target.value })} /></Field>
              <Field label="Base legal">
                <NativeSelect value={editing.legalBasis} onChange={(e) => setEditing({ ...editing, legalBasis: e.target.value })}>
                  {LEGAL_BASIS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Finalidade" className="sm:col-span-2"><Textarea value={editing.purpose} onChange={(e) => setEditing({ ...editing, purpose: e.target.value })} /></Field>
              <Field label="Categorias de titulares (separe por vírgula)"><Input value={editing.dataSubjects.join(', ')} onChange={(e) => setEditing({ ...editing, dataSubjects: toList(e.target.value) })} /></Field>
              <Field label="Categorias de dados (separe por vírgula)"><Input value={editing.dataCategories.join(', ')} onChange={(e) => setEditing({ ...editing, dataCategories: toList(e.target.value) })} /></Field>
              <Field label="Compartilhado com (separe por vírgula)" className="sm:col-span-2"><Input value={editing.sharedWith.join(', ')} onChange={(e) => setEditing({ ...editing, sharedWith: toList(e.target.value) })} /></Field>
              <Field label="Prazo de retenção"><Input value={editing.retentionPeriod ?? ''} onChange={(e) => setEditing({ ...editing, retentionPeriod: e.target.value })} /></Field>
              <Field label="Status">
                <NativeSelect value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  {RECORD_STATUS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Medidas de segurança" className="sm:col-span-2"><Textarea value={editing.securityMeasures ?? ''} onChange={(e) => setEditing({ ...editing, securityMeasures: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.hasSensitiveData} onChange={(e) => setEditing({ ...editing, hasSensitiveData: e.target.checked })} />Trata dados sensíveis</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.internationalTransfer} onChange={(e) => setEditing({ ...editing, internationalTransfer: e.target.checked })} />Transferência internacional</label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={!editing?.name || !editing?.purpose || save.isPending} onClick={() => editing && save.mutate(editing)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suboperadores
// ---------------------------------------------------------------------------
const EMPTY_SUB: Subprocessor = { id: '', name: '', service: '', country: '', internationalTransfer: false, transferSafeguard: '', contractRef: '', status: 'ACTIVE', notes: '' };

function SubprocessorsTab() {
  const qc = useQueryClient();
  const query = useQuery<Subprocessor[]>({ queryKey: ['lgpd', 'subprocessors'], queryFn: () => api<Subprocessor[]>('/lgpd/subprocessors') });
  const [editing, setEditing] = useState<Subprocessor | null>(null);

  const save = useMutation({
    mutationFn: (s: Subprocessor) => {
      const body = {
        name: s.name, service: s.service, country: s.country || undefined, internationalTransfer: s.internationalTransfer,
        transferSafeguard: s.transferSafeguard || undefined, contractRef: s.contractRef || undefined, status: s.status, notes: s.notes || undefined,
      };
      return s.id ? api(`/lgpd/subprocessors/${s.id}`, { method: 'PATCH', json: body }) : api('/lgpd/subprocessors', { method: 'POST', json: body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lgpd'] }); setEditing(null); toast.success('Suboperador salvo'); },
    onError: () => toast.error('Falha ao salvar'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/lgpd/subprocessors/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lgpd'] }); toast.success('Suboperador excluído'); },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ ...EMPTY_SUB })}><Plus className="mr-1.5 h-4 w-4" />Novo suboperador</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2">Suboperador</th><th className="px-3 py-2">Serviço</th><th className="px-3 py-2">País</th><th className="px-3 py-2">Transf. intl.</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {query.data?.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2">{s.service}</td>
                <td className="px-3 py-2">{s.country || '—'}</td>
                <td className="px-3 py-2">{s.internationalTransfer ? <Badge variant="outline">Sim</Badge> : '—'}</td>
                <td className="px-3 py-2"><Badge variant="secondary">{labelOf(SUB_STATUS, s.status)}</Badge></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm('Excluir este suboperador?')) remove.mutate(s.id); }}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
            {query.data && query.data.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Nenhum suboperador registrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar suboperador' : 'Novo suboperador'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Serviço prestado"><Input value={editing.service} onChange={(e) => setEditing({ ...editing, service: e.target.value })} /></Field>
              <Field label="País/região"><Input value={editing.country ?? ''} onChange={(e) => setEditing({ ...editing, country: e.target.value })} /></Field>
              <Field label="Status">
                <NativeSelect value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  {SUB_STATUS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Instrumento/salvaguarda (DPA, cláusulas)" className="sm:col-span-2"><Input value={editing.transferSafeguard ?? ''} onChange={(e) => setEditing({ ...editing, transferSafeguard: e.target.value })} /></Field>
              <Field label="Referência do contrato/DPA" className="sm:col-span-2"><Input value={editing.contractRef ?? ''} onChange={(e) => setEditing({ ...editing, contractRef: e.target.value })} /></Field>
              <Field label="Observações" className="sm:col-span-2"><Textarea value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.internationalTransfer} onChange={(e) => setEditing({ ...editing, internationalTransfer: e.target.checked })} />Transferência internacional</label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={!editing?.name || !editing?.service || save.isPending} onClick={() => editing && save.mutate(editing)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Incidentes
// ---------------------------------------------------------------------------
const EMPTY_INCIDENT: DataIncident = {
  id: '', title: '', description: '', severity: 'MEDIUM', status: 'OPEN', affectedData: [], affectedSubjects: null,
  detectedAt: new Date().toISOString().slice(0, 10), containedAt: null, resolvedAt: null, anpdNotified: false, subjectsNotified: false, measures: '',
};

function IncidentsTab() {
  const qc = useQueryClient();
  const query = useQuery<DataIncident[]>({ queryKey: ['lgpd', 'incidents'], queryFn: () => api<DataIncident[]>('/lgpd/incidents') });
  const [editing, setEditing] = useState<DataIncident | null>(null);

  const save = useMutation({
    mutationFn: (i: DataIncident) => {
      const body = {
        title: i.title, description: i.description || undefined, severity: i.severity, status: i.status,
        affectedData: i.affectedData, affectedSubjects: i.affectedSubjects ?? undefined,
        detectedAt: i.detectedAt || undefined, anpdNotified: i.anpdNotified, subjectsNotified: i.subjectsNotified, measures: i.measures || undefined,
      };
      return i.id ? api(`/lgpd/incidents/${i.id}`, { method: 'PATCH', json: body }) : api('/lgpd/incidents', { method: 'POST', json: body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lgpd'] }); setEditing(null); toast.success('Incidente salvo'); },
    onError: () => toast.error('Falha ao salvar'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/lgpd/incidents/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lgpd'] }); toast.success('Incidente excluído'); },
  });

  const sevVariant = (s: string) => (s === 'CRITICAL' || s === 'HIGH' ? 'destructive' : 'secondary');

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ ...EMPTY_INCIDENT })}><Plus className="mr-1.5 h-4 w-4" />Novo incidente</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2">Incidente</th><th className="px-3 py-2">Severidade</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">ANPD</th><th className="px-3 py-2">Detectado</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {query.data?.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="px-3 py-2 font-medium">{i.title}</td>
                <td className="px-3 py-2"><Badge variant={sevVariant(i.severity)}>{labelOf(SEVERITY, i.severity)}</Badge></td>
                <td className="px-3 py-2"><Badge variant="secondary">{labelOf(INCIDENT_STATUS, i.status)}</Badge></td>
                <td className="px-3 py-2">{i.anpdNotified ? 'Comunicada' : '—'}</td>
                <td className="px-3 py-2">{i.detectedAt ? new Date(i.detectedAt).toLocaleDateString('pt-BR') : '—'}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ ...i, detectedAt: i.detectedAt ? i.detectedAt.slice(0, 10) : '' })}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm('Excluir este incidente?')) remove.mutate(i.id); }}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
            {query.data && query.data.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Nenhum incidente registrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar incidente' : 'Novo incidente de dados'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              <Field label="Título" className="sm:col-span-2"><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
              <Field label="Severidade">
                <NativeSelect value={editing.severity} onChange={(e) => setEditing({ ...editing, severity: e.target.value })}>
                  {SEVERITY.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Status">
                <NativeSelect value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  {INCIDENT_STATUS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Detectado em"><Input type="date" value={editing.detectedAt ?? ''} onChange={(e) => setEditing({ ...editing, detectedAt: e.target.value })} /></Field>
              <Field label="Titulares afetados (estimativa)"><Input type="number" value={editing.affectedSubjects ?? ''} onChange={(e) => setEditing({ ...editing, affectedSubjects: e.target.value ? Number(e.target.value) : null })} /></Field>
              <Field label="Dados afetados (separe por vírgula)" className="sm:col-span-2"><Input value={editing.affectedData.join(', ')} onChange={(e) => setEditing({ ...editing, affectedData: toList(e.target.value) })} /></Field>
              <Field label="Descrição" className="sm:col-span-2"><Textarea value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
              <Field label="Medidas adotadas" className="sm:col-span-2"><Textarea value={editing.measures ?? ''} onChange={(e) => setEditing({ ...editing, measures: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.anpdNotified} onChange={(e) => setEditing({ ...editing, anpdNotified: e.target.checked })} />Comunicado à ANPD</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.subjectsNotified} onChange={(e) => setEditing({ ...editing, subjectsNotified: e.target.checked })} />Titulares comunicados</label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={!editing?.title || save.isPending} onClick={() => editing && save.mutate(editing)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs">{label}</Label>
      {children}
    </div>
  );
}
