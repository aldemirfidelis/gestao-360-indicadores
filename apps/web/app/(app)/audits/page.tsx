'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, ClipboardCheck, ClipboardList, Edit, FileWarning, Filter, ListChecks, Plus, Trash2, X } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';

type AuditType = 'INTERNAL' | 'EXTERNAL' | 'PROCESS' | 'SUPPLIER' | 'LEGAL' | 'SAFETY' | 'QUALITY';
type AuditStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type FindingType = 'CONFORMITY' | 'NONCONFORMITY' | 'OBSERVATION' | 'OPPORTUNITY';
type FindingStatus = 'OPEN' | 'IN_TREATMENT' | 'CLOSED';
type Severity = 'MINOR' | 'MAJOR' | 'CRITICAL';

interface Finding {
  id: string;
  type: FindingType;
  severity: Severity | null;
  status: FindingStatus;
  requirement: string | null;
  description: string;
  evidence: string | null;
  recommendation: string | null;
  dueDate: string | null;
  nonConformityId: string | null;
  nonConformity: { id: string; number: number; title: string; status: string } | null;
}

interface Audit {
  id: string;
  number: number;
  title: string;
  scope: string | null;
  type: AuditType;
  status: AuditStatus;
  plannedDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  summary: string | null;
  orgNodeId: string | null;
  leadAuditorUserId: string | null;
  orgNode: { id: string; name: string; type: string } | null;
  leadAuditor: { id: string; name: string; email: string } | null;
  findings: Finding[];
  findingsCount: number;
  openFindings: number;
  ncCount: number;
  pendingNc: number;
}

interface AuditSummary {
  total: number;
  open: number;
  completed: number;
  openFindings: number;
  ncFindings: number;
  pendingNc: number;
  upcoming: Array<Pick<Audit, 'id' | 'number' | 'title' | 'type' | 'status' | 'plannedDate' | 'orgNode' | 'leadAuditor'>>;
}

interface AuditOptions {
  orgNodes: Array<{ id: string; name: string; type: string }>;
  users: Array<{ id: string; name: string; email: string }>;
  types: AuditType[];
  statuses: AuditStatus[];
  findingTypes: FindingType[];
  findingStatuses: FindingStatus[];
  severities: Severity[];
}

const TYPE_LABEL: Record<AuditType, string> = { INTERNAL: 'Interna', EXTERNAL: 'Externa', PROCESS: 'Processo', SUPPLIER: 'Fornecedor', LEGAL: 'Legal', SAFETY: 'Seguranca', QUALITY: 'Qualidade' };
const STATUS_LABEL: Record<AuditStatus, string> = { PLANNED: 'Planejada', IN_PROGRESS: 'Em andamento', COMPLETED: 'Concluida', CANCELLED: 'Cancelada' };
const FTYPE_LABEL: Record<FindingType, string> = { CONFORMITY: 'Conforme', NONCONFORMITY: 'Nao conformidade', OBSERVATION: 'Observacao', OPPORTUNITY: 'Oportunidade' };
const FSTATUS_LABEL: Record<FindingStatus, string> = { OPEN: 'Aberta', IN_TREATMENT: 'Em tratamento', CLOSED: 'Encerrada' };
const SEV_LABEL: Record<Severity, string> = { MINOR: 'Menor', MAJOR: 'Maior', CRITICAL: 'Critica' };

const STATUS_CLASS: Record<AuditStatus, string> = {
  PLANNED: 'border-status-blue/30 text-status-blue',
  IN_PROGRESS: 'border-status-yellow/40 text-status-yellow',
  COMPLETED: 'border-status-green/30 text-status-green',
  CANCELLED: 'border-border text-muted-foreground',
};
const FTYPE_CLASS: Record<FindingType, string> = {
  CONFORMITY: 'border-status-green/30 text-status-green',
  NONCONFORMITY: 'border-status-red/40 text-status-red',
  OBSERVATION: 'border-status-blue/30 text-status-blue',
  OPPORTUNITY: 'border-status-purple/30 text-status-purple',
};

interface AuditForm {
  title: string;
  scope: string;
  type: AuditType;
  status: AuditStatus;
  orgNodeId: string;
  leadAuditorUserId: string;
  plannedDate: string;
  summary: string;
}
const EMPTY_AUDIT: AuditForm = { title: '', scope: '', type: 'INTERNAL', status: 'PLANNED', orgNodeId: '', leadAuditorUserId: '', plannedDate: '', summary: '' };

interface FindingForm {
  type: FindingType;
  severity: string;
  status: FindingStatus;
  requirement: string;
  description: string;
  evidence: string;
  recommendation: string;
  dueDate: string;
}
const EMPTY_FINDING: FindingForm = { type: 'OBSERVATION', severity: '', status: 'OPEN', requirement: '', description: '', evidence: '', recommendation: '', dueDate: '' };

export default function AuditsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['audits:create']);
  const canUpdate = hasPermission(['audits:update']);
  const canDelete = hasPermission(['audits:delete']);
  const [filters, setFilters] = useState({ search: '', status: '', type: '' });
  const [auditOpen, setAuditOpen] = useState(false);
  const [editing, setEditing] = useState<Audit | null>(null);
  const [form, setForm] = useState<AuditForm>(EMPTY_AUDIT);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [findingForm, setFindingForm] = useState<FindingForm>(EMPTY_FINDING);

  const listQuery = useQuery<Audit[]>({ queryKey: ['audits', filters], queryFn: () => api<Audit[]>(`/audits${toQueryString(filters)}`) });
  const summaryQuery = useQuery<AuditSummary>({ queryKey: ['audits', 'summary'], queryFn: () => api<AuditSummary>('/audits/summary') });
  const optionsQuery = useQuery<AuditOptions>({ queryKey: ['audits', 'options'], queryFn: () => api<AuditOptions>('/audits/options'), staleTime: 60_000 });

  const audits = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const summary = summaryQuery.data;
  const options = optionsQuery.data;
  const selected = useMemo(() => audits.find((a) => a.id === selectedId) ?? null, [audits, selectedId]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['audits'] });

  const saveAudit = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        scope: form.scope || null,
        type: form.type,
        status: form.status,
        orgNodeId: form.orgNodeId || null,
        leadAuditorUserId: form.leadAuditorUserId || null,
        plannedDate: form.plannedDate || null,
        summary: form.summary || null,
      };
      return editing ? api<Audit>(`/audits/${editing.id}`, { method: 'PATCH', json: payload }) : api<Audit>('/audits', { method: 'POST', json: payload });
    },
    onSuccess: () => { toast.success(editing ? 'Auditoria atualizada' : 'Auditoria criada'); setAuditOpen(false); setEditing(null); setForm(EMPTY_AUDIT); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel salvar a auditoria'),
  });

  const deleteAudit = useMutation({
    mutationFn: (id: string) => api<Audit>(`/audits/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Auditoria excluida'); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel excluir'),
  });

  const addFinding = useMutation({
    mutationFn: () => api<Finding>(`/audits/${selectedId}/findings`, {
      method: 'POST',
      json: { ...findingForm, severity: findingForm.severity || null, dueDate: findingForm.dueDate || null },
    }),
    onSuccess: () => { toast.success('Constatacao registrada'); setFindingForm(EMPTY_FINDING); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel registrar a constatacao'),
  });

  const updateFinding = useMutation({
    mutationFn: ({ id, status }: { id: string; status: FindingStatus }) => api<Finding>(`/audits/findings/${id}`, { method: 'PATCH', json: { status } }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao atualizar constatacao'),
  });

  const removeFinding = useMutation({
    mutationFn: (id: string) => api<Finding>(`/audits/findings/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Constatacao removida'); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao remover'),
  });

  const generateNc = useMutation({
    mutationFn: (id: string) => api<Finding>(`/audits/findings/${id}/nonconformity`, { method: 'POST', json: {} }),
    onSuccess: () => { toast.success('Nao conformidade gerada'); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao gerar NC'),
  });

  const openCreate = () => { setEditing(null); setForm(EMPTY_AUDIT); setAuditOpen(true); };
  const openEdit = (a: Audit) => {
    setEditing(a);
    setForm({ title: a.title, scope: a.scope ?? '', type: a.type, status: a.status, orgNodeId: a.orgNodeId ?? '', leadAuditorUserId: a.leadAuditorUserId ?? '', plannedDate: toInputDate(a.plannedDate), summary: a.summary ?? '' });
    setAuditOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Auditorias"
        description="Auditorias internas/externas, constatacoes e geracao de nao conformidades."
        actions={canCreate ? <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nova auditoria</Button> : null}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Em aberto" value={formatNumber(summary?.open)} description={`${formatNumber(summary?.total)} no total`} icon={<ClipboardCheck className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Concluidas" value={formatNumber(summary?.completed)} description="Auditorias finalizadas" icon={<ListChecks className="h-4 w-4" />} tone="green" />
        <MetricCard title="Constatacoes abertas" value={formatNumber(summary?.openFindings)} description={`${formatNumber(summary?.ncFindings)} nao conformidades`} icon={<ClipboardList className="h-4 w-4" />} tone="yellow" />
        <MetricCard title="NCs a gerar" value={formatNumber(summary?.pendingNc)} description="Constatacoes de NC sem registro" icon={<FileWarning className="h-4 w-4" />} tone={(summary?.pendingNc ?? 0) > 0 ? 'red' : 'green'} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr,360px]">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Proximas auditorias</div>
                <div className="text-xs text-muted-foreground">Planejadas / em andamento por data.</div>
              </div>
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              {(summary?.upcoming ?? []).length === 0 && <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Nenhuma auditoria em aberto.</div>}
              {(summary?.upcoming ?? []).map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">#{a.number} {a.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{TYPE_LABEL[a.type]} - {a.leadAuditor?.name ?? 'Sem auditor'} - {formatDate(a.plannedDate)}</div>
                  </div>
                  <Badge variant="outline" className={STATUS_CLASS[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Filter className="h-4 w-4" />Filtros</div>
            <div className="space-y-3">
              <Input placeholder="Buscar por titulo, escopo, constatacao..." value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
              <NativeSelect value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                <option value="">Todos os status</option>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </NativeSelect>
              <NativeSelect value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
                <option value="">Todos os tipos</option>
                {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </NativeSelect>
              {(filters.search || filters.status || filters.type) && (
                <Button variant="ghost" size="sm" onClick={() => setFilters({ search: '', status: '', type: '' })}><X className="mr-2 h-4 w-4" />Limpar filtros</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {audits.length === 0 && (
          <Card className="xl:col-span-2"><CardContent className="p-8 text-center text-sm text-muted-foreground">{listQuery.isLoading ? 'Carregando auditorias...' : 'Nenhuma auditoria encontrada.'}</CardContent></Card>
        )}
        {audits.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">#{a.number}</Badge>
                    <Badge variant="outline" className={STATUS_CLASS[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                    <Badge variant="secondary">{TYPE_LABEL[a.type]}</Badge>
                  </div>
                  <h2 className="mt-3 truncate text-base font-semibold">{a.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.scope || 'Sem escopo registrado.'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {canUpdate && <Button variant="ghost" size="icon" onClick={() => openEdit(a)} title="Editar"><Edit className="h-4 w-4" /></Button>}
                  {canDelete && <Button variant="ghost" size="icon" onClick={() => window.confirm('Excluir esta auditoria?') && deleteAudit.mutate(a.id)} disabled={deleteAudit.isPending} title="Excluir"><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                <div>Area: <span className="text-foreground">{a.orgNode?.name ?? '-'}</span></div>
                <div>Auditor: <span className="text-foreground">{a.leadAuditor?.name ?? '-'}</span></div>
                <div>Constatacoes: <span className="text-foreground">{a.findingsCount}</span></div>
                <div>NCs: <span className={cn('text-foreground', a.pendingNc > 0 && 'text-status-red')}>{a.ncCount}{a.pendingNc > 0 ? ` (${a.pendingNc} a gerar)` : ''}</span></div>
              </div>
              <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => { setSelectedId(a.id); setFindingForm(EMPTY_FINDING); }}>
                <ClipboardList className="mr-2 h-4 w-4" />Constatacoes ({a.findingsCount})
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog: criar/editar auditoria */}
      <Dialog open={auditOpen} onOpenChange={(v) => { setAuditOpen(v); if (!v) { setEditing(null); setForm(EMPTY_AUDIT); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? `Editar auditoria #${editing.number}` : 'Nova auditoria'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><Label>Titulo</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Tipo</Label><NativeSelect value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AuditType }))}>{Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect></div>
            <div><Label>Status</Label><NativeSelect value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AuditStatus }))}>{Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect></div>
            <div><Label>Area/processo</Label><NativeSelect value={form.orgNodeId} onChange={(e) => setForm((f) => ({ ...f, orgNodeId: e.target.value }))}><option value="">Sem area direta</option>{(options?.orgNodes ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</NativeSelect></div>
            <div><Label>Auditor lider</Label><NativeSelect value={form.leadAuditorUserId} onChange={(e) => setForm((f) => ({ ...f, leadAuditorUserId: e.target.value }))}><option value="">Sem auditor</option>{(options?.users ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</NativeSelect></div>
            <div><Label>Data planejada</Label><Input type="date" value={form.plannedDate} onChange={(e) => setForm((f) => ({ ...f, plannedDate: e.target.value }))} /></div>
            <div className="md:col-span-2"><Label>Escopo</Label><Textarea rows={2} value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))} /></div>
            <div className="md:col-span-2"><Label>Relatorio / conclusao</Label><Textarea rows={3} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuditOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveAudit.mutate()} disabled={saveAudit.isPending || !form.title.trim()}>{saveAudit.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: constatacoes da auditoria selecionada */}
      <Dialog open={!!selectedId} onOpenChange={(v) => { if (!v) setSelectedId(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Constatacoes {selected ? `- Auditoria #${selected.number}` : ''}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {(selected?.findings ?? []).length === 0 && <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Nenhuma constatacao registrada.</div>}
            {(selected?.findings ?? []).map((f) => (
              <div key={f.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={FTYPE_CLASS[f.type]}>{FTYPE_LABEL[f.type]}</Badge>
                    {f.severity && <Badge variant="secondary">{SEV_LABEL[f.severity]}</Badge>}
                    <Badge variant="outline">{FSTATUS_LABEL[f.status]}</Badge>
                  </div>
                  {canUpdate && <Button variant="ghost" size="icon" onClick={() => removeFinding.mutate(f.id)} disabled={removeFinding.isPending} title="Remover"><Trash2 className="h-4 w-4" /></Button>}
                </div>
                <div className="mt-2 text-sm">{f.description}</div>
                {f.requirement && <div className="mt-1 text-xs text-muted-foreground">Requisito: {f.requirement}</div>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {f.nonConformity ? (
                    <a href={`/nonconformities?focus=${f.nonConformity.id}`} className="text-xs text-primary hover:underline">NC #{f.nonConformity.number} vinculada</a>
                  ) : f.type === 'NONCONFORMITY' && canUpdate ? (
                    <Button size="sm" variant="outline" onClick={() => generateNc.mutate(f.id)} disabled={generateNc.isPending}><FileWarning className="mr-2 h-4 w-4" />Gerar NC</Button>
                  ) : null}
                  {canUpdate && f.status !== 'CLOSED' && (
                    <Button size="sm" variant="ghost" onClick={() => updateFinding.mutate({ id: f.id, status: 'CLOSED' })}>Encerrar constatacao</Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {canUpdate && (
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="mb-2 text-sm font-semibold">Nova constatacao</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div><Label>Tipo</Label><NativeSelect value={findingForm.type} onChange={(e) => setFindingForm((f) => ({ ...f, type: e.target.value as FindingType }))}>{Object.entries(FTYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect></div>
                <div><Label>Severidade</Label><NativeSelect value={findingForm.severity} onChange={(e) => setFindingForm((f) => ({ ...f, severity: e.target.value }))}><option value="">-</option>{Object.entries(SEV_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect></div>
                <div><Label>Prazo</Label><Input type="date" value={findingForm.dueDate} onChange={(e) => setFindingForm((f) => ({ ...f, dueDate: e.target.value }))} /></div>
                <div className="md:col-span-3"><Label>Requisito / clausula</Label><Input value={findingForm.requirement} onChange={(e) => setFindingForm((f) => ({ ...f, requirement: e.target.value }))} /></div>
                <div className="md:col-span-3"><Label>Descricao</Label><Textarea rows={2} value={findingForm.description} onChange={(e) => setFindingForm((f) => ({ ...f, description: e.target.value }))} /></div>
                <div className="md:col-span-3"><Label>Evidencia</Label><Textarea rows={2} value={findingForm.evidence} onChange={(e) => setFindingForm((f) => ({ ...f, evidence: e.target.value }))} /></div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={() => addFinding.mutate()} disabled={addFinding.isPending || !findingForm.description.trim()}>{addFinding.isPending ? 'Adicionando...' : 'Adicionar constatacao'}</Button>
              </div>
            </div>
          )}

          <DialogFooter><Button variant="outline" onClick={() => setSelectedId(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toQueryString(filters: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  const query = params.toString();
  return query ? `?${query}` : '';
}

function toInputDate(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}
