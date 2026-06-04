'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CalendarClock, CheckCircle2, Edit, Filter, Plus, ShieldAlert, Trash2, X } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';

type RiskStatus = 'IDENTIFIED' | 'ANALYZING' | 'MITIGATING' | 'MONITORING' | 'ACCEPTED' | 'CLOSED';
type RiskCategory = 'STRATEGIC' | 'OPERATIONAL' | 'FINANCIAL' | 'COMPLIANCE' | 'SAFETY' | 'ENVIRONMENTAL' | 'QUALITY' | 'PROJECT' | 'PROCESS' | 'OTHER';
type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

interface Risk {
  id: string;
  title: string;
  description: string | null;
  category: RiskCategory;
  status: RiskStatus;
  probability: number;
  impact: number;
  score: number;
  level: RiskLevel;
  isOverdue: boolean;
  mitigationPlan: string | null;
  contingencyPlan: string | null;
  dueDate: string | null;
  identifiedAt: string;
  orgNodeId: string | null;
  indicatorId: string | null;
  projectId: string | null;
  mitigationActionId: string | null;
  responsibleUserId: string | null;
  orgNode: { id: string; name: string; type: string } | null;
  indicator: { id: string; name: string; code: string | null; ownerNodeId: string } | null;
  project: { id: string; name: string; status: string; indicator: { id: string; name: string; code: string | null; ownerNodeId: string } | null } | null;
  mitigationAction: { id: string; title: string; status: string; dueDate: string | null; ownerNodeId: string | null } | null;
  responsibleUser: { id: string; name: string; email: string } | null;
}

interface RiskSummary {
  totalRisks: number;
  openRisks: number;
  criticalRisks: number;
  overdueMitigations: number;
  avgScore: number;
  topRisks: Array<Pick<Risk, 'id' | 'title' | 'status' | 'category' | 'probability' | 'impact' | 'score' | 'level' | 'dueDate' | 'responsibleUser' | 'orgNode' | 'indicator' | 'project'>>;
}

interface RiskOptions {
  orgNodes: Array<{ id: string; name: string; type: string }>;
  indicators: Array<{ id: string; name: string; code: string | null; ownerNodeId: string }>;
  projects: Array<{ id: string; name: string; status: string; indicator: { id: string; name: string; code: string | null; ownerNodeId: string } | null }>;
  actions: Array<{ id: string; title: string; status: string; dueDate: string | null; ownerNodeId: string | null; indicatorId: string | null }>;
  users: Array<{ id: string; name: string; email: string; defaultNodeId: string | null }>;
  statuses: RiskStatus[];
  categories: RiskCategory[];
}

interface RiskForm {
  title: string;
  description: string;
  category: RiskCategory;
  status: RiskStatus;
  probability: string;
  impact: string;
  orgNodeId: string;
  indicatorId: string;
  projectId: string;
  mitigationActionId: string;
  responsibleUserId: string;
  dueDate: string;
  mitigationPlan: string;
  contingencyPlan: string;
}

const STATUS_LABEL: Record<RiskStatus, string> = {
  IDENTIFIED: 'Identificado',
  ANALYZING: 'Em analise',
  MITIGATING: 'Mitigando',
  MONITORING: 'Monitorando',
  ACCEPTED: 'Aceito',
  CLOSED: 'Fechado',
};

const CATEGORY_LABEL: Record<RiskCategory, string> = {
  STRATEGIC: 'Estrategico',
  OPERATIONAL: 'Operacional',
  FINANCIAL: 'Financeiro',
  COMPLIANCE: 'Compliance',
  SAFETY: 'Seguranca',
  ENVIRONMENTAL: 'Ambiental',
  QUALITY: 'Qualidade',
  PROJECT: 'Projeto',
  PROCESS: 'Processo',
  OTHER: 'Outro',
};

const LEVEL_LABEL: Record<RiskLevel, string> = {
  LOW: 'Baixo',
  MODERATE: 'Moderado',
  HIGH: 'Alto',
  CRITICAL: 'Critico',
};

const LEVEL_CLASS: Record<RiskLevel, string> = {
  LOW: 'border-status-green/30 text-status-green',
  MODERATE: 'border-status-blue/30 text-status-blue',
  HIGH: 'border-status-yellow/40 text-status-yellow',
  CRITICAL: 'border-status-red/40 text-status-red',
};

const STATUS_CLASS: Record<RiskStatus, string> = {
  IDENTIFIED: 'border-border text-muted-foreground',
  ANALYZING: 'border-status-blue/30 text-status-blue',
  MITIGATING: 'border-status-yellow/40 text-status-yellow',
  MONITORING: 'border-status-purple/30 text-status-purple',
  ACCEPTED: 'border-status-green/30 text-status-green',
  CLOSED: 'border-border text-muted-foreground',
};

const EMPTY_FORM: RiskForm = {
  title: '',
  description: '',
  category: 'OPERATIONAL',
  status: 'IDENTIFIED',
  probability: '3',
  impact: '3',
  orgNodeId: '',
  indicatorId: '',
  projectId: '',
  mitigationActionId: '',
  responsibleUserId: '',
  dueDate: '',
  mitigationPlan: '',
  contingencyPlan: '',
};

export default function RisksPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['risks:create']);
  const canUpdate = hasPermission(['risks:update']);
  const canDelete = hasPermission(['risks:delete']);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Risk | null>(null);
  const [filters, setFilters] = useState({ search: '', status: '', category: '' });
  const [form, setForm] = useState<RiskForm>(EMPTY_FORM);

  const risksQuery = useQuery<Risk[]>({
    queryKey: ['risks', filters],
    queryFn: () => api<Risk[]>(`/risks${toQueryString(filters)}`),
  });

  const summaryQuery = useQuery<RiskSummary>({
    queryKey: ['risks', 'summary'],
    queryFn: () => api<RiskSummary>('/risks/summary'),
  });

  const optionsQuery = useQuery<RiskOptions>({
    queryKey: ['risks', 'options'],
    queryFn: () => api<RiskOptions>('/risks/options'),
    staleTime: 60_000,
  });

  const risks = useMemo(() => risksQuery.data ?? [], [risksQuery.data]);
  const summary = summaryQuery.data;
  const options = optionsQuery.data;

  const saveRisk = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        description: form.description || null,
        category: form.category,
        status: form.status,
        probability: Number(form.probability),
        impact: Number(form.impact),
        orgNodeId: form.orgNodeId || null,
        indicatorId: form.indicatorId || null,
        projectId: form.projectId || null,
        mitigationActionId: form.mitigationActionId || null,
        responsibleUserId: form.responsibleUserId || null,
        dueDate: form.dueDate || null,
        mitigationPlan: form.mitigationPlan || null,
        contingencyPlan: form.contingencyPlan || null,
      };
      return editing
        ? api<Risk>(`/risks/${editing.id}`, { method: 'PATCH', json: payload })
        : api<Risk>('/risks', { method: 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success(editing ? 'Risco atualizado' : 'Risco registrado');
      closeDialog();
      invalidateRisks(qc);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel salvar o risco'),
  });

  const deleteRisk = useMutation({
    mutationFn: (id: string) => api<Risk>(`/risks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Risco excluido');
      invalidateRisks(qc);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel excluir o risco'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (risk: Risk) => {
    setEditing(risk);
    setForm({
      title: risk.title,
      description: risk.description ?? '',
      category: risk.category,
      status: risk.status,
      probability: String(risk.probability),
      impact: String(risk.impact),
      orgNodeId: risk.orgNodeId ?? '',
      indicatorId: risk.indicatorId ?? '',
      projectId: risk.projectId ?? '',
      mitigationActionId: risk.mitigationActionId ?? '',
      responsibleUserId: risk.responsibleUserId ?? '',
      dueDate: toInputDate(risk.dueDate),
      mitigationPlan: risk.mitigationPlan ?? '',
      contingencyPlan: risk.contingencyPlan ?? '',
    });
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  return (
    <div>
      <PageHeader
        title="Riscos"
        description="Registro corporativo de riscos, impacto, probabilidade e planos de mitigacao."
        actions={canCreate ? <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo risco</Button> : null}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Riscos abertos" value={formatNumber(summary?.openRisks)} description={`${formatNumber(summary?.totalRisks)} registrados`} icon={<ShieldAlert className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Criticos" value={formatNumber(summary?.criticalRisks)} description="Score acima de 16" icon={<AlertTriangle className="h-4 w-4" />} tone={(summary?.criticalRisks ?? 0) > 0 ? 'red' : 'green'} />
        <MetricCard title="Mitigacoes vencidas" value={formatNumber(summary?.overdueMitigations)} description="Riscos abertos com prazo expirado" icon={<CalendarClock className="h-4 w-4" />} tone={(summary?.overdueMitigations ?? 0) > 0 ? 'yellow' : 'green'} />
        <MetricCard title="Score medio" value={formatNumber(summary?.avgScore, { maximumFractionDigits: 1 })} description="Probabilidade x impacto" icon={<CheckCircle2 className="h-4 w-4" />} tone="purple" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr,360px]">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Riscos prioritarios</div>
                <div className="text-xs text-muted-foreground">Maior severidade entre os riscos visiveis para voce.</div>
              </div>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              {(summary?.topRisks ?? []).length === 0 && (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Nenhum risco prioritario no momento.</div>
              )}
              {(summary?.topRisks ?? []).map((risk) => (
                <div key={risk.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{risk.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {CATEGORY_LABEL[risk.category]} - {risk.responsibleUser?.name ?? 'Sem responsavel'} - prazo {formatDate(risk.dueDate)}
                    </div>
                    {risk.indicator && <div className="mt-1 text-[11px] text-primary">KPI {risk.indicator.code ? `[${risk.indicator.code}] ` : ''}{risk.indicator.name}</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant="outline" className={LEVEL_CLASS[risk.level]}>{LEVEL_LABEL[risk.level]}</Badge>
                    <div className="mt-1 text-xs text-muted-foreground">{risk.score}/25</div>
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
              <Input placeholder="Buscar por titulo, plano, KPI..." value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
              <NativeSelect value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                <option value="">Todos os status</option>
                {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
              <NativeSelect value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
                <option value="">Todas as categorias</option>
                {Object.entries(CATEGORY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
              {(filters.search || filters.status || filters.category) && (
                <Button variant="ghost" size="sm" onClick={() => setFilters({ search: '', status: '', category: '' })}>
                  <X className="mr-2 h-4 w-4" />Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {risks.length === 0 && (
          <Card className="xl:col-span-2">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {risksQuery.isLoading ? 'Carregando riscos...' : 'Nenhum risco encontrado para os filtros atuais.'}
            </CardContent>
          </Card>
        )}
        {risks.map((risk) => (
          <Card key={risk.id} className={cn('overflow-hidden', risk.isOverdue && 'border-status-yellow/50')}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={LEVEL_CLASS[risk.level]}>{LEVEL_LABEL[risk.level]}</Badge>
                    <Badge variant="outline" className={STATUS_CLASS[risk.status]}>{STATUS_LABEL[risk.status]}</Badge>
                    <Badge variant="secondary">{CATEGORY_LABEL[risk.category]}</Badge>
                  </div>
                  <h2 className="mt-3 truncate text-base font-semibold">{risk.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{risk.description || 'Sem descricao registrada.'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {canUpdate && <Button variant="ghost" size="icon" onClick={() => openEdit(risk)} title="Editar risco"><Edit className="h-4 w-4" /></Button>}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.confirm('Excluir este risco?') && deleteRisk.mutate(risk.id)}
                      disabled={deleteRisk.isPending}
                      title="Excluir risco"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Probabilidade</div>
                  <div className="font-semibold">{risk.probability}/5</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Impacto</div>
                  <div className="font-semibold">{risk.impact}/5</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Score</div>
                  <div className="font-semibold">{risk.score}/25</div>
                </div>
              </div>
              <Progress className="mt-3" value={(risk.score / 25) * 100} />

              <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div>Area/processo: <span className="text-foreground">{risk.orgNode?.name ?? '-'}</span></div>
                <div>Responsavel: <span className="text-foreground">{risk.responsibleUser?.name ?? '-'}</span></div>
                <div>KPI: <span className="text-foreground">{risk.indicator ? `${risk.indicator.code ? `[${risk.indicator.code}] ` : ''}${risk.indicator.name}` : '-'}</span></div>
                <div>Projeto: <span className="text-foreground">{risk.project?.name ?? '-'}</span></div>
                <div>Mitigacao ate: <span className={cn('text-foreground', risk.isOverdue && 'text-status-yellow')}>{formatDate(risk.dueDate)}</span></div>
                <div>Plano vinculado: <span className="text-foreground">{risk.mitigationAction?.title ?? '-'}</span></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar risco' : 'Novo risco'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Titulo</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>Categoria</Label>
              <NativeSelect value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as RiskCategory }))}>
                {Object.entries(CATEGORY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Status</Label>
              <NativeSelect value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as RiskStatus }))}>
                {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Probabilidade</Label>
              <NativeSelect value={form.probability} onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Impacto</Label>
              <NativeSelect value={form.impact} onChange={(e) => setForm((f) => ({ ...f, impact: e.target.value }))}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Area/processo</Label>
              <NativeSelect value={form.orgNodeId} onChange={(e) => setForm((f) => ({ ...f, orgNodeId: e.target.value }))}>
                <option value="">Sem area direta</option>
                {(options?.orgNodes ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Responsavel</Label>
              <NativeSelect value={form.responsibleUserId} onChange={(e) => setForm((f) => ({ ...f, responsibleUserId: e.target.value }))}>
                <option value="">Sem responsavel</option>
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
              <Label>Projeto vinculado</Label>
              <NativeSelect value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}>
                <option value="">Sem projeto</option>
                {(options?.projects ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Plano de mitigacao</Label>
              <NativeSelect value={form.mitigationActionId} onChange={(e) => setForm((f) => ({ ...f, mitigationActionId: e.target.value }))}>
                <option value="">Sem plano vinculado</option>
                {(options?.actions ?? []).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Prazo da mitigacao</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Descricao</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label>Plano de mitigacao</Label>
              <Textarea rows={3} value={form.mitigationPlan} onChange={(e) => setForm((f) => ({ ...f, mitigationPlan: e.target.value }))} />
            </div>
            <div>
              <Label>Plano de contingencia</Label>
              <Textarea rows={3} value={form.contingencyPlan} onChange={(e) => setForm((f) => ({ ...f, contingencyPlan: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveRisk.mutate()} disabled={saveRisk.isPending || !form.title.trim()}>
              {saveRisk.isPending ? 'Salvando...' : 'Salvar risco'}
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

function invalidateRisks(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['risks'] });
}
