'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Bot, CalendarDays, ClipboardCheck, ClipboardList, Columns3, Filter, List, Plus, Search, ShieldCheck, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { ActionPlanCard, type ActionPlanCardData } from '@/components/platform/action-plan-card';
import { EmptyState } from '@/components/platform/empty-state';
import { LoadingState } from '@/components/platform/loading-state';
import { SectionCard } from '@/components/platform/section-card';
import { StatusBadge } from '@/components/platform/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';

interface Action extends ActionPlanCardData {
  status: string;
  priority: string;
  criticality: string;
  analysisTool: string | null;
  effectivenessStatus: string;
  startDate: string | null;
  completedAt: string | null;
  createdAt: string;
  indicator: { id: string; name: string; code: string | null } | null;
  indicatorResult: { id: string; periodRef: string; value: number; light: string; deviationPct: number | null } | null;
  strategicObjective: { id: string; name: string; perspective: { id: string; name: string } | null } | null;
  deviation: { id: string; number: number; title: string; method: string; rootCause: string | null } | null;
  meeting: { id: string; title: string; startsAt: string } | null;
  _count: { tasks: number; evidences: number; comments: number; analysisSessions: number };
}

interface Options {
  users: { id: string; name: string; email: string }[];
  orgNodes: { id: string; name: string; type: string; branchId: string | null }[];
  indicators: { id: string; name: string; code: string | null; ownerNodeId: string; strategicObjectiveId: string | null; results: { id: string; periodRef: string; value: number; light: string }[] }[];
  deviations: { id: string; number: number; title: string; indicatorId: string; method: string; rootCause: string | null }[];
  meetings: { id: string; title: string }[];
  strategicObjectives: { id: string; name: string; perspective: { id: string; name: string } | null }[];
  statuses: string[];
  priorities: string[];
  origins: string[];
  analysisTools: string[];
  effectivenessStatuses: string[];
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  NOT_STARTED: 'Aberto',
  UNDER_ANALYSIS: 'Em análise',
  IN_PROGRESS: 'Em execucao',
  WAITING_THIRD: 'Aguardando terceiro',
  WAITING_EVIDENCE: 'Aguardando evidencia',
  WAITING_VALIDATION: 'Aguardando validação',
  PAUSED: 'Pausado',
  DONE: 'Concluido',
  DONE_LATE: 'Concluido fora do prazo',
  CANCELLED: 'Cancelado',
  REOPENED: 'Reaberto',
  INEFFECTIVE: 'Ineficaz',
  EFFECTIVE: 'Eficaz',
};

const TOOL_LABEL: Record<string, string> = {
  FIVE_WHYS: '5 Porques',
  ISHIKAWA: 'Ishikawa',
  MASP: 'MASP',
  PDCA: 'PDCA',
  FIVE_W_TWO_H: '5W2H',
  PARETO: 'Pareto',
  FCA: 'FCA',
  GUT: 'Matriz GUT',
  PRIORITIZATION_MATRIX: 'Matriz de priorizacao',
  BRAINSTORMING: 'Brainstorming',
  ROOT_CAUSE: 'Causa raiz',
  EFFECTIVENESS_CHECKLIST: 'Checklist de eficacia',
};

const COLUMNS = ['DRAFT', 'UNDER_ANALYSIS', 'IN_PROGRESS', 'WAITING_VALIDATION', 'EFFECTIVE'];
type ViewMode = 'kanban' | 'list' | 'timeline';

const emptyForm = {
  title: '',
  description: '',
  problemDescription: '',
  origin: 'MANUAL',
  indicatorId: '',
  indicatorResultId: '',
  deviationId: '',
  meetingId: '',
  strategicObjectiveId: '',
  ownerNodeId: '',
  responsibleUserId: '',
  priority: 'MEDIUM',
  criticality: 'MEDIUM',
  analysisTool: 'FIVE_WHYS',
  startDate: '',
  dueDate: '',
  expectedResult: '',
};

export default function ActionsPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<ViewMode>('kanban');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [filters, setFilters] = useState({ search: '', status: '', indicatorId: '', ownerNodeId: '', effectivenessStatus: '' });

  const query = useQuery<Action[]>({
    queryKey: ['actions', filters],
    queryFn: () => api<Action[]>(`/actions${toQuery(filters)}`),
  });
  const options = useQuery<Options>({
    queryKey: ['actions', 'options'],
    queryFn: () => api<Options>('/actions/options'),
  });

  const actions = useMemo(() => query.data ?? [], [query.data]);
  const byCol = useMemo(() => {
    const map = new Map<string, Action[]>();
    COLUMNS.forEach((c) => map.set(c, []));
    actions.forEach((a) => {
      const key = COLUMNS.includes(a.status) ? a.status : a.status === 'DONE' || a.status === 'DONE_LATE' ? 'WAITING_VALIDATION' : 'IN_PROGRESS';
      map.get(key)?.push(a);
    });
    return map;
  }, [actions]);

  const overdue = actions.filter((a) => isOverdue(a)).length;
  const done = actions.filter((a) => ['DONE', 'DONE_LATE', 'EFFECTIVE'].includes(a.status)).length;
  const doneLate = actions.filter((a) => a.status === 'DONE_LATE').length;
  const withoutOwner = actions.filter((a) => !a.responsibleUser).length;
  const critical = actions.filter((a) => a.criticality === 'CRITICAL' || a.priority === 'CRITICAL').length;
  const pendingEffectiveness = actions.filter((a) => ['PENDING', 'IN_REVIEW', 'REOPENED'].includes(a.effectivenessStatus)).length;

  const create = useMutation({
    mutationFn: () => api('/actions', { method: 'POST', json: toPayload(form) }),
    onSuccess: (created: any) => {
      toast.success('Plano de ação criado');
      setOpen(false);
      setForm({ ...emptyForm });
      qc.invalidateQueries({ queryKey: ['actions'] });
      if (created?.id) window.location.href = `/actions/${created.id}`;
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao criar plano'),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(`/actions/${id}/status`, { method: 'PATCH', json: { status } }),
    onSuccess: () => {
      toast.success('Status atualizado');
      qc.invalidateQueries({ queryKey: ['actions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Gestão"
        tone="launch"
        title="Planos de ação"
        description="Gestão completa da origem, análise de causa, execucao, evidencias e eficacia dos planos."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Planos de ação' }]}
        actions={
          <>
            <div className="inline-flex rounded-lg border bg-card p-1">
              {[
                ['kanban', Columns3, 'Kanban'],
                ['list', List, 'Lista'],
                ['timeline', CalendarDays, 'Cronograma'],
              ].map(([key, Icon, label]) => {
                const I = Icon as typeof Columns3;
                return (
                  <Button key={String(key)} variant={view === key ? 'default' : 'ghost'} size="sm" onClick={() => setView(key as ViewMode)}>
                    <I className="mr-2 h-4 w-4" />
                    {String(label)}
                  </Button>
                );
              })}
            </div>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo plano
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total de planos" value={formatNumber(actions.length)} description={`${formatNumber(actions.length - done)} em aberto`} icon={<ClipboardList className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Atrasados" value={formatNumber(overdue)} description={`${formatNumber(doneLate)} concluidos fora do prazo`} icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <MetricCard title="Sem responsável" value={formatNumber(withoutOwner)} description={`${formatNumber(critical)} críticos`} icon={<UserRound className="h-4 w-4" />} tone="yellow" />
        <MetricCard title="Eficacia pendente" value={formatNumber(pendingEffectiveness)} description="Aguardando verificação" icon={<ShieldCheck className="h-4 w-4" />} tone="green" />
      </div>

      <SectionCard title="Filtros avançados" description="Busque por origem, status, indicador, área ou eficacia." className="mb-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar plano, problema ou causa..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          </div>
          <NativeSelect value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </NativeSelect>
          <NativeSelect value={filters.indicatorId} onChange={(e) => setFilters({ ...filters, indicatorId: e.target.value })}>
            <option value="">Todos os indicadores</option>
            {(options.data?.indicators ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </NativeSelect>
          <NativeSelect value={filters.effectivenessStatus} onChange={(e) => setFilters({ ...filters, effectivenessStatus: e.target.value })}>
            <option value="">Todas eficacias</option>
            {(options.data?.effectivenessStatuses ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </NativeSelect>
        </div>
      </SectionCard>

      {query.isLoading && <LoadingState />}
      {!query.isLoading && actions.length === 0 && (
        <EmptyState title="Nenhum plano de ação" description="Crie planos a partir de indicadores, desvios, reuniões, mapa estratégico ou ocorrências." />
      )}

      {!query.isLoading && actions.length > 0 && view === 'kanban' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {COLUMNS.map((col) => {
            const items = byCol.get(col) ?? [];
            return (
              <section key={col} className="rounded-lg border bg-muted/45 p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="text-sm font-semibold">{STATUS_LABEL[col]}</span>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                <div className="space-y-3">
                  {items.map((a) => (
                    <div key={a.id} className="space-y-2">
                      <ActionPlanCard action={a} />
                      <div className="flex flex-wrap gap-1">
                        {['UNDER_ANALYSIS', 'IN_PROGRESS', 'WAITING_EVIDENCE', 'WAITING_VALIDATION', 'DONE'].filter((s) => s !== a.status).map((s) => (
                          <button key={s} onClick={() => changeStatus.mutate({ id: a.id, status: s })} className="rounded border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                            {STATUS_LABEL[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <div className="rounded-lg border border-dashed bg-card/50 p-6 text-center text-xs text-muted-foreground">Sem planos</div>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {!query.isLoading && actions.length > 0 && view === 'list' && (
        <SectionCard title="Lista de planos" description="Visão tabular para priorizacao, rastreabilidade e cobrança." contentClassName="p-0">
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th className="text-left">Plano</th>
                  <th className="text-left">Origem</th>
                  <th className="text-left">Responsável</th>
                  <th className="text-left">Prazo</th>
                  <th className="text-left">Ferramenta</th>
                  <th className="text-left">Eficacia</th>
                  <th className="text-left">Progresso</th>
                </tr>
              </thead>
              <tbody>{actions.map((a) => <ActionRow key={a.id} action={a} />)}</tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {!query.isLoading && actions.length > 0 && view === 'timeline' && (
        <SectionCard title="Cronograma de execucao" description="Prazos ordenados para acompanhamento semanal e validação de eficacia.">
          <div className="space-y-3">
            {actions.slice().sort((a, b) => new Date(a.dueDate ?? '2999-12-31').getTime() - new Date(b.dueDate ?? '2999-12-31').getTime()).map((a) => (
              <Link key={a.id} href={`/actions/${a.id}`} className="grid gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/35 md:grid-cols-[140px,1fr,180px] md:items-center">
                <div className={cn('text-sm font-semibold', isOverdue(a) && 'text-status-red')}>{formatDate(a.dueDate)}</div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.indicator?.name ?? a.strategicObjective?.name ?? a.ownerNode?.name ?? 'Origem manual'}</div>
                </div>
                <StatusBadge value={a.status} label={STATUS_LABEL[a.status] ?? a.status} />
              </Link>
            ))}
          </div>
        </SectionCard>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Novo plano de ação</DialogTitle>
          </DialogHeader>
          <ActionForm form={form} setForm={setForm} options={options.data} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!form.title || create.isPending} onClick={() => create.mutate()}>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              {create.isPending ? 'Salvando...' : 'Salvar e abrir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionRow({ action: a }: { action: Action }) {
  return (
    <tr>
      <td>
        <Link href={`/actions/${a.id}`} className="font-medium hover:underline">{a.title}</Link>
        <div className="text-xs text-muted-foreground">{a.strategicObjective?.name ?? a.ownerNode?.name ?? a.origin}</div>
      </td>
      <td>
        <div className="text-sm">{a.indicator?.name ?? a.deviation?.title ?? a.meeting?.title ?? a.origin}</div>
        {a.indicatorResult && <div className="text-xs text-muted-foreground">{a.indicatorResult.periodRef} - {a.indicatorResult.light}</div>}
      </td>
      <td>{a.responsibleUser?.name ?? 'Sem responsável'}</td>
      <td className={cn(isOverdue(a) && 'font-medium text-status-red')}>{formatDate(a.dueDate)}</td>
      <td><Badge variant="outline">{a.analysisTool ? TOOL_LABEL[a.analysisTool] ?? a.analysisTool : 'Não definida'}</Badge></td>
      <td><StatusBadge value={a.effectivenessStatus} label={a.effectivenessStatus} /></td>
      <td>
        <div className="min-w-32">
          <div className="mb-1 text-xs font-medium">{a.progress}%</div>
          <Progress value={a.progress} className="h-1.5" />
        </div>
      </td>
    </tr>
  );
}

function ActionForm({ form, setForm, options }: { form: typeof emptyForm; setForm: (value: typeof emptyForm) => void; options?: Options }) {
  const selectedIndicator = options?.indicators.find((item) => item.id === form.indicatorId);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Título do plano" value={form.title} onChange={(title) => setForm({ ...form, title })} required />
      <div>
        <Label>Origem</Label>
        <NativeSelect value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })}>
          {(options?.origins ?? ['MANUAL', 'INDICATOR', 'DEVIATION', 'MEETING', 'STRATEGIC_MAP', 'RELATIONSHIP_MAP']).map((origin) => <option key={origin} value={origin}>{origin}</option>)}
        </NativeSelect>
      </div>
      <SelectField label="Objetivo estratégico" value={form.strategicObjectiveId} onChange={(strategicObjectiveId) => setForm({ ...form, strategicObjectiveId })} items={options?.strategicObjectives ?? []} />
      <SelectField label="Área ou setor" value={form.ownerNodeId} onChange={(ownerNodeId) => setForm({ ...form, ownerNodeId })} items={options?.orgNodes ?? []} />
      <SelectField label="Indicador vinculado" value={form.indicatorId} onChange={(indicatorId) => {
        const indicator = options?.indicators.find((item) => item.id === indicatorId);
        setForm({ ...form, indicatorId, ownerNodeId: indicator?.ownerNodeId ?? form.ownerNodeId, strategicObjectiveId: indicator?.strategicObjectiveId ?? form.strategicObjectiveId, indicatorResultId: indicator?.results[0]?.id ?? '' });
      }} items={options?.indicators ?? []} />
      <div>
        <Label>Resultado que gerou o plano</Label>
        <NativeSelect value={form.indicatorResultId} onChange={(e) => setForm({ ...form, indicatorResultId: e.target.value })}>
          <option value="">Não vinculado</option>
          {(selectedIndicator?.results ?? []).map((result) => <option key={result.id} value={result.id}>{result.periodRef} - {result.value} ({result.light})</option>)}
        </NativeSelect>
      </div>
      <SelectField label="Desvio / nao conformidade" value={form.deviationId} onChange={(deviationId) => {
        const deviation = options?.deviations.find((item) => item.id === deviationId);
        setForm({ ...form, deviationId, origin: deviationId ? 'DEVIATION' : form.origin, indicatorId: deviation?.indicatorId ?? form.indicatorId, analysisTool: deviation?.method === 'FIVE_WHYS' ? 'FIVE_WHYS' : deviation?.method ?? form.analysisTool });
      }} items={(options?.deviations ?? []).map((item) => ({ id: item.id, name: `#${item.number} - ${item.title}` }))} />
      <SelectField label="Reunião vinculada" value={form.meetingId} onChange={(meetingId) => setForm({ ...form, meetingId, origin: meetingId ? 'MEETING' : form.origin })} items={(options?.meetings ?? []).map((item) => ({ id: item.id, name: item.title }))} />
      <div>
        <Label>Ferramenta de análise</Label>
        <NativeSelect value={form.analysisTool} onChange={(e) => setForm({ ...form, analysisTool: e.target.value })}>
          {(options?.analysisTools ?? Object.keys(TOOL_LABEL)).map((tool) => <option key={tool} value={tool}>{TOOL_LABEL[tool] ?? tool}</option>)}
        </NativeSelect>
      </div>
      <SelectField label="Responsável" value={form.responsibleUserId} onChange={(responsibleUserId) => setForm({ ...form, responsibleUserId })} items={options?.users ?? []} />
      <div>
        <Label>Prioridade</Label>
        <NativeSelect value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((item) => <option key={item} value={item}>{item}</option>)}
        </NativeSelect>
      </div>
      <div>
        <Label>Criticidade</Label>
        <NativeSelect value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value })}>
          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((item) => <option key={item} value={item}>{item}</option>)}
        </NativeSelect>
      </div>
      <Field label="Início" type="date" value={form.startDate} onChange={(startDate) => setForm({ ...form, startDate })} />
      <Field label="Prazo final" type="date" value={form.dueDate} onChange={(dueDate) => setForm({ ...form, dueDate })} />
      <div className="md:col-span-2">
        <Text label="Descrição do problema" value={form.problemDescription} onChange={(problemDescription) => setForm({ ...form, problemDescription })} />
      </div>
      <div className="md:col-span-2">
        <Text label="Ação proposta" value={form.description} onChange={(description) => setForm({ ...form, description })} />
      </div>
      <div className="md:col-span-2">
        <Text label="Resultado esperado / criterio de eficacia" value={form.expectedResult} onChange={(expectedResult) => setForm({ ...form, expectedResult })} />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <Label className={required ? 'field-required' : undefined}>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectField({ label, value, onChange, items }: { label: string; value: string; onChange: (value: string) => void; items: { id: string; name: string }[] }) {
  return (
    <div>
      <Label>{label}</Label>
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Não vinculado</option>
        {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </NativeSelect>
    </div>
  );
}

function toQuery(filters: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const out = params.toString();
  return out ? `?${out}` : '';
}

function toPayload(form: typeof emptyForm) {
  const originRefId = form.deviationId || form.meetingId || form.indicatorId || form.strategicObjectiveId || null;
  return {
    ...form,
    originRefId,
    indicatorId: form.indicatorId || null,
    indicatorResultId: form.indicatorResultId || null,
    deviationId: form.deviationId || null,
    meetingId: form.meetingId || null,
    strategicObjectiveId: form.strategicObjectiveId || null,
    ownerNodeId: form.ownerNodeId || null,
    responsibleUserId: form.responsibleUserId || null,
    startDate: form.startDate || null,
    dueDate: form.dueDate || null,
    expectedResult: form.expectedResult || null,
  };
}

function isOverdue(action: Action) {
  return Boolean(action.dueDate && new Date(action.dueDate) < new Date() && !['DONE', 'DONE_LATE', 'CANCELLED', 'EFFECTIVE'].includes(action.status));
}
