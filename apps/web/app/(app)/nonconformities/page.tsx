'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CalendarClock, CheckCircle2, Edit, FileWarning, Filter, Plus, Trash2, X } from 'lucide-react';
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

type NcStatus = 'OPEN' | 'TRIAGE' | 'ANALYSIS' | 'ACTION' | 'VERIFICATION' | 'CLOSED' | 'CANCELLED';
type NcSource = 'INDICATOR' | 'AUDIT' | 'PROCESS' | 'CUSTOMER' | 'SUPPLIER' | 'PROJECT' | 'CHECKLIST' | 'INSPECTION' | 'DOCUMENT' | 'MANUAL' | 'OTHER';
type NcSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';

interface NonConformity {
  id: string;
  number: number;
  title: string;
  description: string | null;
  source: NcSource;
  severity: NcSeverity;
  status: NcStatus;
  immediateAction: string | null;
  rootCause: string | null;
  correctivePlan: string | null;
  effectivenessCheck: string | null;
  effectivenessOk: boolean | null;
  isOverdue: boolean;
  dueDate: string | null;
  identifiedAt: string;
  orgNodeId: string | null;
  indicatorId: string | null;
  deviationId: string | null;
  correctiveActionId: string | null;
  responsibleUserId: string | null;
  orgNode: { id: string; name: string; type: string } | null;
  indicator: { id: string; name: string; code: string | null; ownerNodeId: string } | null;
  deviation: { id: string; number: number; title: string; status: string } | null;
  correctiveAction: { id: string; title: string; status: string; dueDate: string | null; effectivenessStatus: string | null } | null;
  responsibleUser: { id: string; name: string; email: string } | null;
}

interface NcSummary {
  total: number;
  open: number;
  critical: number;
  overdue: number;
  effective: number;
  topOpen: Array<Pick<NonConformity, 'id' | 'number' | 'title' | 'status' | 'source' | 'severity' | 'dueDate' | 'isOverdue' | 'responsibleUser' | 'orgNode' | 'indicator'>>;
}

interface NcOptions {
  orgNodes: Array<{ id: string; name: string; type: string }>;
  indicators: Array<{ id: string; name: string; code: string | null; ownerNodeId: string }>;
  deviations: Array<{ id: string; number: number; title: string; status: string }>;
  actions: Array<{ id: string; title: string; status: string; dueDate: string | null; ownerNodeId: string | null; indicatorId: string | null }>;
  users: Array<{ id: string; name: string; email: string; defaultNodeId: string | null }>;
  statuses: NcStatus[];
  sources: NcSource[];
  severities: NcSeverity[];
}

interface NcForm {
  title: string;
  description: string;
  source: NcSource;
  severity: NcSeverity;
  status: NcStatus;
  orgNodeId: string;
  indicatorId: string;
  deviationId: string;
  correctiveActionId: string;
  responsibleUserId: string;
  dueDate: string;
  immediateAction: string;
  rootCause: string;
  correctivePlan: string;
  effectivenessCheck: string;
  effectivenessOk: string; // '', 'true', 'false'
}

const STATUS_LABEL: Record<NcStatus, string> = {
  OPEN: 'Registrada',
  TRIAGE: 'Triagem',
  ANALYSIS: 'Análise de causa',
  ACTION: 'Ação corretiva',
  VERIFICATION: 'Verificação',
  CLOSED: 'Encerrada',
  CANCELLED: 'Cancelada',
};

const SOURCE_LABEL: Record<NcSource, string> = {
  INDICATOR: 'Indicador',
  AUDIT: 'Auditoria',
  PROCESS: 'Processo',
  CUSTOMER: 'Cliente',
  SUPPLIER: 'Fornecedor',
  PROJECT: 'Projeto',
  CHECKLIST: 'Lista de verificação',
  INSPECTION: 'Inspecao',
  DOCUMENT: 'Documento',
  MANUAL: 'Manual',
  OTHER: 'Outro',
};

const SEVERITY_LABEL: Record<NcSeverity, string> = {
  MINOR: 'Menor',
  MAJOR: 'Maior',
  CRITICAL: 'Crítica',
};

const SEVERITY_CLASS: Record<NcSeverity, string> = {
  MINOR: 'border-status-blue/30 text-status-blue',
  MAJOR: 'border-status-yellow/40 text-status-yellow',
  CRITICAL: 'border-status-red/40 text-status-red',
};

const STATUS_CLASS: Record<NcStatus, string> = {
  OPEN: 'border-border text-muted-foreground',
  TRIAGE: 'border-status-blue/30 text-status-blue',
  ANALYSIS: 'border-status-purple/30 text-status-purple',
  ACTION: 'border-status-yellow/40 text-status-yellow',
  VERIFICATION: 'border-status-blue/30 text-status-blue',
  CLOSED: 'border-status-green/30 text-status-green',
  CANCELLED: 'border-border text-muted-foreground',
};

const EMPTY_FORM: NcForm = {
  title: '',
  description: '',
  source: 'INDICATOR',
  severity: 'MAJOR',
  status: 'OPEN',
  orgNodeId: '',
  indicatorId: '',
  deviationId: '',
  correctiveActionId: '',
  responsibleUserId: '',
  dueDate: '',
  immediateAction: '',
  rootCause: '',
  correctivePlan: '',
  effectivenessCheck: '',
  effectivenessOk: '',
};

export default function NonConformitiesPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['nc:create']);
  const canUpdate = hasPermission(['nc:update']);
  const canDelete = hasPermission(['nc:delete']);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NonConformity | null>(null);
  const [filters, setFilters] = useState({ search: '', status: '', severity: '' });
  const [form, setForm] = useState<NcForm>(EMPTY_FORM);

  const listQuery = useQuery<NonConformity[]>({
    queryKey: ['nonconformities', filters],
    queryFn: () => api<NonConformity[]>(`/nonconformities${toQueryString(filters)}`),
  });
  const summaryQuery = useQuery<NcSummary>({
    queryKey: ['nonconformities', 'summary'],
    queryFn: () => api<NcSummary>('/nonconformities/summary'),
  });
  const optionsQuery = useQuery<NcOptions>({
    queryKey: ['nonconformities', 'options'],
    queryFn: () => api<NcOptions>('/nonconformities/options'),
    staleTime: 60_000,
  });

  const items = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const summary = summaryQuery.data;
  const options = optionsQuery.data;

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        description: form.description || null,
        source: form.source,
        severity: form.severity,
        status: form.status,
        orgNodeId: form.orgNodeId || null,
        indicatorId: form.indicatorId || null,
        deviationId: form.deviationId || null,
        correctiveActionId: form.correctiveActionId || null,
        responsibleUserId: form.responsibleUserId || null,
        dueDate: form.dueDate || null,
        immediateAction: form.immediateAction || null,
        rootCause: form.rootCause || null,
        correctivePlan: form.correctivePlan || null,
        effectivenessCheck: form.effectivenessCheck || null,
        effectivenessOk: form.effectivenessOk === '' ? null : form.effectivenessOk === 'true',
      };
      return editing
        ? api<NonConformity>(`/nonconformities/${editing.id}`, { method: 'PATCH', json: payload })
        : api<NonConformity>('/nonconformities', { method: 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success(editing ? 'Não conformidade atualizada' : 'Não conformidade registrada');
      closeDialog();
      invalidate(qc);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível salvar a NC'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api<NonConformity>(`/nonconformities/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Não conformidade excluida');
      invalidate(qc);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível excluir a NC'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (nc: NonConformity) => {
    setEditing(nc);
    setForm({
      title: nc.title,
      description: nc.description ?? '',
      source: nc.source,
      severity: nc.severity,
      status: nc.status,
      orgNodeId: nc.orgNodeId ?? '',
      indicatorId: nc.indicatorId ?? '',
      deviationId: nc.deviationId ?? '',
      correctiveActionId: nc.correctiveActionId ?? '',
      responsibleUserId: nc.responsibleUserId ?? '',
      dueDate: toInputDate(nc.dueDate),
      immediateAction: nc.immediateAction ?? '',
      rootCause: nc.rootCause ?? '',
      correctivePlan: nc.correctivePlan ?? '',
      effectivenessCheck: nc.effectivenessCheck ?? '',
      effectivenessOk: nc.effectivenessOk === null || nc.effectivenessOk === undefined ? '' : String(nc.effectivenessOk),
    });
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  // Deep-link: /nonconformities?focus=<id> (ex.: vindo da timeline de um indicador).
  const focusId = searchParams.get('focus');
  const focusedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusId || focusedRef.current === focusId) return;
    const target = items.find((nc) => nc.id === focusId);
    if (target) {
      focusedRef.current = focusId;
      openEdit(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, items]);

  return (
    <div>
      <PageHeader
        title="Não Conformidades"
        description="Registro de NCs com contenção, análise de causa, ação corretiva e verificação de eficácia."
        actions={canCreate ? <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nova NC</Button> : null}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="NCs abertas" value={formatNumber(summary?.open)} description={`${formatNumber(summary?.total)} registradas`} icon={<FileWarning className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Críticas" value={formatNumber(summary?.critical)} description="Severidade crítica em aberto" icon={<AlertTriangle className="h-4 w-4" />} tone={(summary?.critical ?? 0) > 0 ? 'red' : 'green'} />
        <MetricCard title="Prazos vencidos" value={formatNumber(summary?.overdue)} description="NCs abertas fora do prazo" icon={<CalendarClock className="h-4 w-4" />} tone={(summary?.overdue ?? 0) > 0 ? 'yellow' : 'green'} />
        <MetricCard title="Eficazes" value={formatNumber(summary?.effective)} description="Ação corretiva verificada" icon={<CheckCircle2 className="h-4 w-4" />} tone="purple" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr,360px]">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">NCs prioritarias</div>
                <div className="text-xs text-muted-foreground">Maior severidade entre as NCs visiveis para você.</div>
              </div>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              {(summary?.topOpen ?? []).length === 0 && (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Nenhuma NC prioritaria no momento.</div>
              )}
              {(summary?.topOpen ?? []).map((nc) => (
                <div key={nc.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">#{nc.number} {nc.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {SOURCE_LABEL[nc.source]} - {nc.responsibleUser?.name ?? 'Sem responsável'} - prazo {formatDate(nc.dueDate)}
                    </div>
                    {nc.indicator && <div className="mt-1 text-[11px] text-primary">KPI {nc.indicator.code ? `[${nc.indicator.code}] ` : ''}{nc.indicator.name}</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant="outline" className={SEVERITY_CLASS[nc.severity]}>{SEVERITY_LABEL[nc.severity]}</Badge>
                    <div className="mt-1 text-xs text-muted-foreground">{STATUS_LABEL[nc.status]}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Filter className="h-4 w-4" />Filtros</div>
            <div className="space-y-3">
              <Input placeholder="Buscar por título, causa, KPI..." value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
              <NativeSelect value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                <option value="">Todos os status</option>
                {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
              <NativeSelect value={filters.severity} onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))}>
                <option value="">Todas as severidades</option>
                {Object.entries(SEVERITY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
              {(filters.search || filters.status || filters.severity) && (
                <Button variant="ghost" size="sm" onClick={() => setFilters({ search: '', status: '', severity: '' })}>
                  <X className="mr-2 h-4 w-4" />Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {items.length === 0 && (
          <Card className="xl:col-span-2">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {listQuery.isLoading ? 'Carregando não conformidades...' : 'Nenhuma NC encontrada para os filtros atuais.'}
            </CardContent>
          </Card>
        )}
        {items.map((nc) => (
          <Card key={nc.id} className={cn('overflow-hidden', nc.isOverdue && 'border-status-yellow/50')}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">#{nc.number}</Badge>
                    <Badge variant="outline" className={SEVERITY_CLASS[nc.severity]}>{SEVERITY_LABEL[nc.severity]}</Badge>
                    <Badge variant="outline" className={STATUS_CLASS[nc.status]}>{STATUS_LABEL[nc.status]}</Badge>
                    <Badge variant="secondary">{SOURCE_LABEL[nc.source]}</Badge>
                  </div>
                  <h2 className="mt-3 truncate text-base font-semibold">{nc.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{nc.description || 'Sem descrição registrada.'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {canUpdate && <Button variant="ghost" size="icon" onClick={() => openEdit(nc)} title="Editar NC"><Edit className="h-4 w-4" /></Button>}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.confirm('Excluir esta não conformidade?') && remove.mutate(nc.id)}
                      disabled={remove.isPending}
                      title="Excluir NC"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div>Área/processo: <span className="text-foreground">{nc.orgNode?.name ?? '-'}</span></div>
                <div>Responsável: <span className="text-foreground">{nc.responsibleUser?.name ?? '-'}</span></div>
                <div>KPI: <span className="text-foreground">{nc.indicator ? `${nc.indicator.code ? `[${nc.indicator.code}] ` : ''}${nc.indicator.name}` : '-'}</span></div>
                <div>Desvio: <span className="text-foreground">{nc.deviation ? `#${nc.deviation.number}` : '-'}</span></div>
                <div>Prazo: <span className={cn('text-foreground', nc.isOverdue && 'text-status-yellow')}>{formatDate(nc.dueDate)}</span></div>
                <div>Ação corretiva: <span className="text-foreground">{nc.correctiveAction?.title ?? '-'}</span></div>
              </div>

              {(nc.rootCause || nc.effectivenessOk !== null) && (
                <div className="mt-3 rounded-md border bg-muted/30 p-3 text-xs">
                  {nc.rootCause && <div><span className="text-muted-foreground">Causa raiz: </span>{nc.rootCause}</div>}
                  {nc.effectivenessOk !== null && (
                    <div className={cn('mt-1 font-medium', nc.effectivenessOk ? 'text-status-green' : 'text-status-red')}>
                      Eficácia: {nc.effectivenessOk ? 'verificada (eficaz)' : 'reprovada'}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar NC #${editing.number}` : 'Nova não conformidade'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>Origem</Label>
              <NativeSelect value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as NcSource }))}>
                {Object.entries(SOURCE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Severidade</Label>
              <NativeSelect value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as NcSeverity }))}>
                {Object.entries(SEVERITY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Status</Label>
              <NativeSelect value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as NcStatus }))}>
                {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div>
              <Label>Área/processo</Label>
              <NativeSelect value={form.orgNodeId} onChange={(e) => setForm((f) => ({ ...f, orgNodeId: e.target.value }))}>
                <option value="">Sem área direta</option>
                {(options?.orgNodes ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Responsável</Label>
              <NativeSelect value={form.responsibleUserId} onChange={(e) => setForm((f) => ({ ...f, responsibleUserId: e.target.value }))}>
                <option value="">Sem responsável</option>
                {(options?.users ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>KPI vinculado</Label>
              <NativeSelect value={form.indicatorId} onChange={(e) => setForm((f) => ({ ...f, indicatorId: e.target.value }))}>
                <option value="">Sem KPI</option>
                {(options?.indicators ?? []).map((item) => <option key={item.id} value={item.id}>{item.code ? `[${item.code}] ` : ''}{item.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Desvio de origem</Label>
              <NativeSelect value={form.deviationId} onChange={(e) => setForm((f) => ({ ...f, deviationId: e.target.value }))}>
                <option value="">Sem desvio</option>
                {(options?.deviations ?? []).map((item) => <option key={item.id} value={item.id}>#{item.number} {item.title}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Ação corretiva (plano)</Label>
              <NativeSelect value={form.correctiveActionId} onChange={(e) => setForm((f) => ({ ...f, correctiveActionId: e.target.value }))}>
                <option value="">Sem plano vinculado</option>
                {(options?.actions ?? []).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Eficácia verificada?</Label>
              <NativeSelect value={form.effectivenessOk} onChange={(e) => setForm((f) => ({ ...f, effectivenessOk: e.target.value }))}>
                <option value="">Não avaliada</option>
                <option value="true">Eficaz</option>
                <option value="false">Ineficaz</option>
              </NativeSelect>
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Ação imediata / contenção</Label>
              <Textarea rows={2} value={form.immediateAction} onChange={(e) => setForm((f) => ({ ...f, immediateAction: e.target.value }))} />
            </div>
            <div>
              <Label>Causa raiz</Label>
              <Textarea rows={3} value={form.rootCause} onChange={(e) => setForm((f) => ({ ...f, rootCause: e.target.value }))} />
            </div>
            <div>
              <Label>Plano corretivo</Label>
              <Textarea rows={3} value={form.correctivePlan} onChange={(e) => setForm((f) => ({ ...f, correctivePlan: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Verificação de eficácia</Label>
              <Textarea rows={2} value={form.effectivenessCheck} onChange={(e) => setForm((f) => ({ ...f, effectivenessCheck: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim()}>
              {save.isPending ? 'Salvando...' : 'Salvar NC'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toQueryString(filters: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

function toInputDate(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['nonconformities'] });
}
