'use client';

import { useEffect, useMemo, useState } from 'react';
import type * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Clock3,
  Download,
  Eye,
  FileClock,
  History,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Target,
  Trash2,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { EmptyState } from '@/components/platform/empty-state';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { StatusLight } from '@/components/ui/status-light';
import { Textarea } from '@/components/ui/textarea';
import { IndicatorResultEditor } from '@/components/platform/indicator-result-editor';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber, formatPercent, periodRefLabel } from '@/lib/utils';

interface CompanyOption {
  id: string;
  name: string;
  tradeName: string | null;
}

interface OrgNodeOption {
  id: string;
  companyId: string;
  parentId: string | null;
  name: string;
  code: string | null;
  type: string;
  responsibleUserId: string | null;
  parent?: { id: string; name: string; type: string; parentId: string | null } | null;
  _count?: { children: number; indicatorsOwned: number };
}

interface UserOption {
  id: string;
  name: string;
  email?: string;
}

interface StrategicObjectiveOption {
  id: string;
  name: string;
  perspective: { id: string; name: string; color: string | null };
  map: { id: string; name: string };
}

interface IndicatorOptions {
  companies: CompanyOption[];
  orgNodes: OrgNodeOption[];
  users: UserOption[];
  strategicObjectives: StrategicObjectiveOption[];
  currentPeriod: { year: number; startsAt: string; endsAt: string };
  indicatorTypes: string[];
  units: string[];
  periodicities: string[];
  directions: string[];
  statuses: string[];
}

interface MonthlyPoint {
  periodRef: string;
  month: string;
  meta: number | null;
  target: number | null;
  realizado: number | null;
  value: number | null;
  attainment: number | null;
  status: string;
}

interface IndicatorRow {
  id: string;
  companyId: string;
  name: string;
  code: string | null;
  description: string | null;
  type: string;
  category: string | null;
  unit: string;
  unitLabel: string | null;
  periodicity: string;
  direction: string;
  formula: string | null;
  source: string | null;
  status: string;
  weight: number;
  yellowToleranceP: number;
  createdAt: string;
  updatedAt: string;
  company: CompanyOption;
  ownerNode: { id: string; name: string; type: string; parentId: string | null; parent?: { id: string; name: string; type: string } | null };
  guidelineNode: { id: string; name: string; type: string } | null;
  strategicObjective: StrategicObjectiveOption | null;
  responsibleUser: { id: string; name: string } | null;
  areaMacro: { id: string; name: string; type: string | null };
  areaMicro: { id: string; name: string; type: string | null } | null;
  parentIndicator: { id: string; name: string; code: string | null } | null;
  isMacro: boolean;
  currentTarget: { periodRef: string; target: number; lowerBound: number | null; upperBound: number | null } | null;
  last: {
    id: string;
    periodRef: string;
    value: number;
    light: string;
    attainment: number | null;
    deviationPct: number | null;
    note: string | null;
    updatedAt: string;
  } | null;
  monthlyHistory: MonthlyPoint[];
  _count: { actions: number; meetings: number; targets: number; results: number };
}

interface AuditLogRow {
  id: string;
  action: string;
  recordLabel: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

interface IndicatorHistory {
  logs: AuditLogRow[];
}

type IndicatorForm = {
  id: string;
  companyId: string;
  areaMacroId: string;
  areaMicroId: string;
  ownerNodeId: string;
  guidelineNodeId: string;
  strategicObjectiveId: string;
  responsibleUserId: string;
  parentIndicatorId: string;
  name: string;
  code: string;
  description: string;
  type: string;
  category: string;
  unit: string;
  unitLabel: string;
  periodicity: string;
  direction: string;
  formula: string;
  source: string;
  status: string;
  weight: string;
  yellowToleranceP: string;
  initialTarget: string;
  initialResult: string;
};

type Filters = {
  companyId: string;
  areaMacroId: string;
  areaMicroId: string;
  status: string;
  type: string;
  periodicity: string;
  responsibleUserId: string;
  search: string;
  light: string;
  year: string;
};

const TYPE_LABEL: Record<string, string> = {
  STRATEGIC: 'Estrategico',
  TACTICAL: 'Tatico',
  OPERATIONAL: 'Operacional',
  PROJECT: 'Projeto',
  PROCESS: 'Processo',
  SAFETY: 'Seguranca',
  QUALITY: 'Qualidade',
  HR: 'RH',
  FINANCE: 'Financeiro',
  PRODUCTION: 'Producao',
  MAINTENANCE: 'Manutencao',
  PROCUREMENT: 'Suprimentos',
  COMMERCIAL: 'Comercial',
  CUSTOM: 'Personalizado',
};

const UNIT_LABEL: Record<string, string> = {
  PERCENT: '%',
  CURRENCY: 'R$',
  QUANTITY: 'Quantidade',
  HOURS: 'Horas',
  DAYS: 'Dias',
  TONS: 'Toneladas',
  LITERS: 'Litros',
  INDEX: 'Indice',
  TEXT: 'Texto',
  CUSTOM: 'Personalizada',
};

const PERIODICITY_LABEL: Record<string, string> = {
  DAILY: 'Diaria',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
};

const DIRECTION_LABEL: Record<string, string> = {
  HIGHER_BETTER: 'Quanto maior melhor',
  LOWER_BETTER: 'Quanto menor melhor',
  EQUAL_TARGET: 'Igual a meta',
  RANGE: 'Faixa aceitavel',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  IN_REVIEW: 'Em revisao',
};

const LIGHT_LABEL: Record<string, string> = {
  GREEN: 'No alvo',
  YELLOW: 'Atencao',
  RED: 'Critico',
  GRAY: 'Sem dados',
};

const EMPTY_FORM: IndicatorForm = {
  id: '',
  companyId: '',
  areaMacroId: '',
  areaMicroId: '',
  ownerNodeId: '',
  guidelineNodeId: '',
  strategicObjectiveId: '',
  responsibleUserId: '',
  parentIndicatorId: '',
  name: '',
  code: '',
  description: '',
  type: 'OPERATIONAL',
  category: '',
  unit: 'PERCENT',
  unitLabel: '',
  periodicity: 'MONTHLY',
  direction: 'HIGHER_BETTER',
  formula: '',
  source: '',
  status: 'ACTIVE',
  weight: '1',
  yellowToleranceP: '10',
  initialTarget: '',
  initialResult: '',
};

export default function IndicatorsPage() {
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>({
    companyId: '',
    areaMacroId: '',
    areaMicroId: '',
    status: '',
    type: '',
    periodicity: '',
    responsibleUserId: '',
    search: '',
    light: '',
    year: '',
  });
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<IndicatorForm>(EMPTY_FORM);
  const [viewing, setViewing] = useState<IndicatorRow | null>(null);
  const [targetEditing, setTargetEditing] = useState<IndicatorRow | null>(null);
  const [resultEditing, setResultEditing] = useState<IndicatorRow | null>(null);
  const [historyIndicator, setHistoryIndicator] = useState<IndicatorRow | null>(null);

  const options = useQuery<IndicatorOptions>({
    queryKey: ['indicators', 'options'],
    queryFn: () => api<IndicatorOptions>('/indicators/options'),
  });

  useEffect(() => {
    if (!options.data) return;
    setFilters((prev) => ({
      ...prev,
      companyId: prev.companyId || options.data.companies[0]?.id || '',
      year: prev.year || String(options.data.currentPeriod.year),
    }));
  }, [options.data]);

  useEffect(() => {
    if (searchParams.get('new') === '1') openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const indicators = useQuery<IndicatorRow[]>({
    queryKey: ['indicators', filters],
    enabled: Boolean(options.data),
    queryFn: () => api<IndicatorRow[]>(`/indicators${toQueryString(filters)}`),
  });

  const history = useQuery<IndicatorHistory>({
    queryKey: ['indicators', historyIndicator?.id, 'history'],
    enabled: Boolean(historyIndicator),
    queryFn: () => api<IndicatorHistory>(`/indicators/${historyIndicator?.id}/history`),
  });

  const orgNodes = options.data?.orgNodes ?? [];
  const users = options.data?.users ?? [];
  const strategicObjectives = options.data?.strategicObjectives ?? [];
  const companies = options.data?.companies ?? [];
  const filterOrgNodes = useMemo(
    () => orgNodes.filter((node) => !filters.companyId || node.companyId === filters.companyId),
    [orgNodes, filters.companyId],
  );
  const formOrgNodes = useMemo(
    () => orgNodes.filter((node) => !form.companyId || node.companyId === form.companyId),
    [orgNodes, form.companyId],
  );
  const macroOptions = useMemo(() => filterOrgNodes.filter((node) => !node.parentId || (node._count?.children ?? 0) > 0), [filterOrgNodes]);
  const formMacroOptions = useMemo(() => formOrgNodes.filter((node) => !node.parentId || (node._count?.children ?? 0) > 0), [formOrgNodes]);
  const filterMicroOptions = useMemo(
    () => filterOrgNodes.filter((node) => (filters.areaMacroId ? node.parentId === filters.areaMacroId : node.parentId)),
    [filterOrgNodes, filters.areaMacroId],
  );
  const formMicroOptions = useMemo(
    () => formOrgNodes.filter((node) => (form.areaMacroId ? node.parentId === form.areaMacroId : node.parentId)),
    [formOrgNodes, form.areaMacroId],
  );
  const guidelineOptions = useMemo(() => formOrgNodes.filter((node) => node.type === 'DIRECTORATE'), [formOrgNodes]);
  const rows = indicators.data ?? [];

  const stats = useMemo(() => {
    const active = rows.filter((row) => row.status === 'ACTIVE').length;
    const red = rows.filter((row) => row.last?.light === 'RED').length;
    const withoutOwner = rows.filter((row) => !row.responsibleUser).length;
    const withoutMonthlyData = rows.filter((row) => row.monthlyHistory.every((point) => point.realizado === null)).length;
    return { active, red, withoutOwner, withoutMonthlyData };
  }, [rows]);

  const saveIndicator = useMutation({
    mutationFn: () => {
      const ownerNodeId = form.areaMicroId || form.areaMacroId || form.ownerNodeId;
      if (!form.name.trim()) throw new Error('Informe o nome do indicador');
      if (!ownerNodeId) throw new Error('Selecione a area macro ou micro');
      if (!form.unit) throw new Error('Selecione a unidade de medida');
      if (!form.periodicity) throw new Error('Selecione a periodicidade');
      const payload = {
        companyId: form.companyId || companies[0]?.id,
        ownerNodeId,
        guidelineNodeId: form.guidelineNodeId || null,
        strategicObjectiveId: form.strategicObjectiveId || null,
        responsibleUserId: form.responsibleUserId || null,
        parentIndicatorId: form.parentIndicatorId || null,
        name: form.name,
        code: form.code || null,
        description: form.description || null,
        type: form.type,
        category: form.category || null,
        unit: form.unit,
        unitLabel: form.unitLabel || null,
        periodicity: form.periodicity,
        direction: form.direction,
        formula: form.formula || null,
        source: form.source || null,
        status: form.status,
        weight: numberOrUndefined(form.weight),
        yellowToleranceP: numberOrUndefined(form.yellowToleranceP),
        initialTarget: form.id ? undefined : numberOrUndefined(form.initialTarget),
        initialResult: form.id ? undefined : numberOrUndefined(form.initialResult),
      };
      return form.id
        ? api(`/indicators/${form.id}`, { method: 'PATCH', json: payload })
        : api('/indicators', { method: 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success(form.id ? 'Indicador atualizado' : 'Indicador incluido');
      setFormOpen(false);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ['indicators'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Falha ao salvar indicador'),
  });

  const deleteIndicator = useMutation({
    mutationFn: (indicator: IndicatorRow) => api(`/indicators/${indicator.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Indicador inativado com exclusao logica');
      qc.invalidateQueries({ queryKey: ['indicators'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Falha ao inativar indicador'),
  });

  function openCreate() {
    setForm({ ...EMPTY_FORM, companyId: filters.companyId || companies[0]?.id || '' });
    setFormOpen(true);
  }

  function openEdit(indicator: IndicatorRow) {
    setForm({
      ...EMPTY_FORM,
      id: indicator.id,
      companyId: indicator.companyId,
      areaMacroId: indicator.areaMacro?.id ?? '',
      areaMicroId: indicator.areaMicro?.id ?? '',
      ownerNodeId: indicator.ownerNode.id,
      guidelineNodeId: indicator.guidelineNode?.id ?? '',
      strategicObjectiveId: indicator.strategicObjective?.id ?? '',
      responsibleUserId: indicator.responsibleUser?.id ?? '',
      parentIndicatorId: indicator.parentIndicator?.id ?? '',
      name: indicator.name,
      code: indicator.code ?? '',
      description: indicator.description ?? '',
      type: indicator.type,
      category: indicator.category ?? '',
      unit: indicator.unit,
      unitLabel: indicator.unitLabel ?? '',
      periodicity: indicator.periodicity,
      direction: indicator.direction,
      formula: indicator.formula ?? '',
      source: indicator.source ?? '',
      status: indicator.status,
      weight: String(indicator.weight ?? 1),
      yellowToleranceP: String(indicator.yellowToleranceP ?? 10),
    });
    setFormOpen(true);
  }

  function openTarget(indicator: IndicatorRow) {
    setTargetEditing(indicator);
  }

  function openResult(indicator: IndicatorRow) {
    setResultEditing(indicator);
  }

  function clearFilters() {
    setFilters({
      companyId: companies[0]?.id || '',
      areaMacroId: '',
      areaMicroId: '',
      status: '',
      type: '',
      periodicity: '',
      responsibleUserId: '',
      search: '',
      light: '',
      year: options.data?.currentPeriod.year ? String(options.data.currentPeriod.year) : '',
    });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Gestao"
        tone="admin"
        title="Indicadores"
        description="Gerencie os indicadores, metas, realizados e vinculos organizacionais."
        breadcrumbs={[{ label: 'Inicio', href: '/' }, { label: 'Gestao' }, { label: 'Indicadores' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => indicators.refetch()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Button variant="outline" onClick={() => exportCsv(rows)}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Incluir Indicador
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total de indicadores" value={formatNumber(rows.length)} description={`${formatNumber(stats.active)} ativos`} icon={<Target className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Criticos" value={formatNumber(stats.red)} description="Fora da meta no ultimo periodo" icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <MetricCard title="Sem responsavel" value={formatNumber(stats.withoutOwner)} description="Revisar governanca" icon={<UserRound className="h-4 w-4" />} tone="yellow" />
        <MetricCard title="Sem dados mensais" value={formatNumber(stats.withoutMonthlyData)} description="Precisam de lancamento" icon={<FileClock className="h-4 w-4" />} tone="purple" />
      </div>

      <section className="panel mb-6 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Filtros</h2>
            <p className="text-xs text-muted-foreground">Filtre por empresa, estrutura, status, tipo, periodicidade e responsavel.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar</Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <Label>Empresa</Label>
            <NativeSelect value={filters.companyId} onChange={(e) => setFilters((prev) => ({ ...prev, companyId: e.target.value, areaMacroId: '', areaMicroId: '' }))}>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.tradeName || company.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>Area Macro</Label>
            <NativeSelect value={filters.areaMacroId} onChange={(e) => setFilters((prev) => ({ ...prev, areaMacroId: e.target.value, areaMicroId: '' }))}>
              <option value="">Todas</option>
              {macroOptions.map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>Area Micro</Label>
            <NativeSelect value={filters.areaMicroId} onChange={(e) => setFilters((prev) => ({ ...prev, areaMicroId: e.target.value }))}>
              <option value="">Todas</option>
              {filterMicroOptions.map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>Status</Label>
            <NativeSelect value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="">Todos</option>
              {options.data?.statuses.map((status) => (
                <option key={status} value={status}>{STATUS_LABEL[status] ?? status}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>Tipo</Label>
            <NativeSelect value={filters.type} onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}>
              <option value="">Todos</option>
              {options.data?.indicatorTypes.map((type) => (
                <option key={type} value={type}>{TYPE_LABEL[type] ?? type}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>Periodicidade</Label>
            <NativeSelect value={filters.periodicity} onChange={(e) => setFilters((prev) => ({ ...prev, periodicity: e.target.value }))}>
              <option value="">Todas</option>
              {options.data?.periodicities.map((periodicity) => (
                <option key={periodicity} value={periodicity}>{PERIODICITY_LABEL[periodicity] ?? periodicity}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>Responsavel</Label>
            <NativeSelect value={filters.responsibleUserId} onChange={(e) => setFilters((prev) => ({ ...prev, responsibleUserId: e.target.value }))}>
              <option value="">Todos</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>Ano</Label>
            <Input value={filters.year} onChange={(e) => setFilters((prev) => ({ ...prev, year: e.target.value }))} placeholder="2026" />
          </div>
          <div className="relative md:col-span-2 xl:col-span-3">
            <Label>Busca</Label>
            <Search className="absolute left-3 top-[35px] h-4 w-4 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Buscar por nome, codigo, area ou responsavel"
              className="pl-9"
            />
          </div>
          <div>
            <Label>Farol</Label>
            <div className="flex gap-2">
              {(['GREEN', 'YELLOW', 'RED', 'GRAY'] as const).map((light) => (
                <Button
                  key={light}
                  type="button"
                  variant={filters.light === light ? 'default' : 'outline'}
                  size="sm"
                  className="h-10 flex-1"
                  onClick={() => setFilters((prev) => ({ ...prev, light: prev.light === light ? '' : light }))}
                  aria-label={`Filtrar ${LIGHT_LABEL[light]}`}
                >
                  <StatusLight light={light} />
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {(options.isLoading || indicators.isLoading) && <LoadingState />}

      {!indicators.isLoading && rows.length === 0 && (
        <EmptyState
          title="Nenhum indicador cadastrado"
          description="Inclua o primeiro indicador ou ajuste os filtros para encontrar registros existentes."
          action={<Button onClick={openCreate}>Incluir Indicador</Button>}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {rows.map((indicator) => (
          <IndicatorManagementCard
            key={indicator.id}
            indicator={indicator}
            onView={() => setViewing(indicator)}
            onEdit={() => openEdit(indicator)}
            onTarget={() => openTarget(indicator)}
            onResult={() => openResult(indicator)}
            onHistory={() => setHistoryIndicator(indicator)}
            onDelete={() => {
              if (window.confirm('Inativar este indicador? A exclusao sera logica e o historico sera preservado.')) {
                deleteIndicator.mutate(indicator);
              }
            }}
          />
        ))}
      </div>

      <IndicatorFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        form={form}
        setForm={setForm}
        companies={companies}
        macroOptions={formMacroOptions}
        microOptions={formMicroOptions}
        guidelineOptions={guidelineOptions}
        users={users}
        strategicObjectives={strategicObjectives}
        parentIndicatorOptions={rows.filter((row) => row.id !== form.id)}
        options={options.data}
        isSaving={saveIndicator.isPending}
        onSave={() => saveIndicator.mutate()}
      />

      <IndicatorViewDialog indicator={viewing} onOpenChange={(open) => !open && setViewing(null)} />

      <TargetDialog
        indicator={targetEditing}
        onOpenChange={(open) => !open && setTargetEditing(null)}
      />

      <ResultDialog
        indicator={resultEditing}
        onOpenChange={(open) => !open && setResultEditing(null)}
      />

      <HistoryDialog
        indicator={historyIndicator}
        history={history.data}
        isLoading={history.isLoading}
        onOpenChange={(open) => !open && setHistoryIndicator(null)}
      />
    </div>
  );
}

function IndicatorManagementCard({
  indicator,
  onView,
  onEdit,
  onTarget,
  onResult,
  onHistory,
  onDelete,
}: {
  indicator: IndicatorRow;
  onView: () => void;
  onEdit: () => void;
  onTarget: () => void;
  onResult: () => void;
  onHistory: () => void;
  onDelete: () => void;
}) {
  const light = indicator.last?.light ?? 'GRAY';
  const attainment = indicator.last?.attainment ? Math.max(0, Math.min(100, Math.round(indicator.last.attainment * 100))) : 0;
  return (
    <article className="panel panel-hover flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {indicator.code && <Badge variant="outline">{indicator.code}</Badge>}
            <Badge variant="secondary">{TYPE_LABEL[indicator.type] ?? indicator.type}</Badge>
            <Badge className={cn('border', statusBadgeClass(light))} variant="outline">{LIGHT_LABEL[light] ?? light}</Badge>
            {indicator.isMacro && (
              <Badge className="border border-status-blue/40 bg-status-blue/10 text-status-blue" variant="outline">
                Macro
              </Badge>
            )}
            {indicator.parentIndicator && (
              <Badge className="border border-status-purple/40 bg-status-purple/10 text-status-purple" variant="outline">
                Micro de {indicator.parentIndicator.code ?? indicator.parentIndicator.name}
              </Badge>
            )}
          </div>
          <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-snug">{indicator.name}</h3>
        </div>
        <StatusLight light={light} size="md" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-muted-foreground">Meta atual</div>
          <div className="text-base font-semibold">{formatNumber(indicator.currentTarget?.target)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Realizado</div>
          <div className="text-base font-semibold">
            {indicator.last ? formatNumber(indicator.last.value) : '-'}
            <span className="ml-1 text-xs font-normal text-muted-foreground">{indicator.unitLabel || UNIT_LABEL[indicator.unit] || ''}</span>
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Atingimento</div>
          <div className="text-base font-semibold">{formatPercent(indicator.last?.attainment ?? null)}</div>
        </div>
      </div>

      <Progress value={attainment} className="mt-3 h-1.5" />

      <div className="mt-4 h-28 rounded-md border bg-card/60 p-2">
        {indicator.monthlyHistory.some((point) => point.meta !== null || point.realizado !== null) ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={indicator.monthlyHistory} barGap={1}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis hide domain={[0, 'auto']} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.35 }} />
              <Bar dataKey="meta" name="Meta" fill="hsl(var(--muted-foreground))" radius={[2, 2, 0, 0]} />
              <Bar dataKey="realizado" name="Realizado" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sem dados mensais</div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5" />
          <span className="truncate">{indicator.areaMacro?.name ?? '-'}</span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5" />
          <span className="truncate">{indicator.areaMicro?.name ?? indicator.ownerNode.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <UserRound className="h-3.5 w-3.5" />
          <span className="truncate">{indicator.responsibleUser?.name ?? 'Sem responsavel'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock3 className="h-3.5 w-3.5" />
          <span>{indicator.last ? periodRefLabel(indicator.last.periodRef) : PERIODICITY_LABEL[indicator.periodicity]}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onView}><Eye className="mr-1.5 h-3.5 w-3.5" />Visualizar</Button>
        <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Button>
        <Button variant="outline" size="sm" onClick={onTarget}>Metas</Button>
        <Button variant="outline" size="sm" onClick={onResult}>Realizados</Button>
        <Button variant="ghost" size="sm" onClick={onHistory}><History className="mr-1.5 h-3.5 w-3.5" />Historico</Button>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Inativar</Button>
      </div>
    </article>
  );
}

function IndicatorFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  companies,
  macroOptions,
  microOptions,
  guidelineOptions,
  users,
  strategicObjectives,
  parentIndicatorOptions,
  options,
  isSaving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: IndicatorForm;
  setForm: React.Dispatch<React.SetStateAction<IndicatorForm>>;
  companies: CompanyOption[];
  macroOptions: OrgNodeOption[];
  microOptions: OrgNodeOption[];
  guidelineOptions: OrgNodeOption[];
  users: UserOption[];
  strategicObjectives: StrategicObjectiveOption[];
  parentIndicatorOptions: IndicatorRow[];
  options?: IndicatorOptions;
  isSaving: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Editar indicador' : 'Incluir indicador'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Nome do indicador" required className="xl:col-span-2">
            <Input value={form.name} onChange={(e) => patchForm(setForm, { name: e.target.value })} placeholder="Ex.: Absenteismo" />
          </Field>
          <Field label="Codigo">
            <Input value={form.code} onChange={(e) => patchForm(setForm, { code: e.target.value })} placeholder="Ex.: RH-001" />
          </Field>
          <Field label="Empresa" required>
            <NativeSelect value={form.companyId} onChange={(e) => patchForm(setForm, { companyId: e.target.value, areaMacroId: '', areaMicroId: '', guidelineNodeId: '' })}>
              <option value="">Selecione</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.tradeName || company.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Area Macro" required>
            <NativeSelect value={form.areaMacroId} onChange={(e) => patchForm(setForm, { areaMacroId: e.target.value, areaMicroId: '' })}>
              <option value="">Selecione</option>
              {macroOptions.map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Area Micro">
            <NativeSelect value={form.areaMicroId} onChange={(e) => patchForm(setForm, { areaMicroId: e.target.value })}>
              <option value="">Usar area macro</option>
              {microOptions.map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Indicador macro (pai)">
            <NativeSelect value={form.parentIndicatorId} onChange={(e) => patchForm(setForm, { parentIndicatorId: e.target.value })}>
              <option value="">Sem vinculo (indicador macro proprio)</option>
              {parentIndicatorOptions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code ? `${row.code} - ` : ''}{row.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Diretriz vinculada">
            <NativeSelect value={form.guidelineNodeId} onChange={(e) => patchForm(setForm, { guidelineNodeId: e.target.value })}>
              <option value="">Nao vinculada</option>
              {guidelineOptions.map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Objetivo estrategico">
            <NativeSelect value={form.strategicObjectiveId} onChange={(e) => patchForm(setForm, { strategicObjectiveId: e.target.value })}>
              <option value="">Nao vinculado</option>
              {strategicObjectives.map((objective) => (
                <option key={objective.id} value={objective.id}>{objective.perspective.name} - {objective.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Responsavel">
            <NativeSelect value={form.responsibleUserId} onChange={(e) => patchForm(setForm, { responsibleUserId: e.target.value })}>
              <option value="">Sem responsavel</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Tipo">
            <NativeSelect value={form.type} onChange={(e) => patchForm(setForm, { type: e.target.value })}>
              {options?.indicatorTypes.map((type) => (
                <option key={type} value={type}>{TYPE_LABEL[type] ?? type}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Unidade" required>
            <NativeSelect value={form.unit} onChange={(e) => patchForm(setForm, { unit: e.target.value })}>
              {options?.units.map((unit) => (
                <option key={unit} value={unit}>{UNIT_LABEL[unit] ?? unit}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Rotulo da unidade">
            <Input value={form.unitLabel} onChange={(e) => patchForm(setForm, { unitLabel: e.target.value })} placeholder="Ex.: R$/t" />
          </Field>
          <Field label="Periodicidade" required>
            <NativeSelect value={form.periodicity} onChange={(e) => patchForm(setForm, { periodicity: e.target.value })}>
              {options?.periodicities.map((periodicity) => (
                <option key={periodicity} value={periodicity}>{PERIODICITY_LABEL[periodicity] ?? periodicity}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Sentido do indicador">
            <NativeSelect value={form.direction} onChange={(e) => patchForm(setForm, { direction: e.target.value })}>
              {options?.directions.map((direction) => (
                <option key={direction} value={direction}>{DIRECTION_LABEL[direction] ?? direction}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Status">
            <NativeSelect value={form.status} onChange={(e) => patchForm(setForm, { status: e.target.value })}>
              {options?.statuses.map((status) => (
                <option key={status} value={status}>{STATUS_LABEL[status] ?? status}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Peso">
            <Input type="number" step="0.1" value={form.weight} onChange={(e) => patchForm(setForm, { weight: e.target.value })} />
          </Field>
          <Field label="Tolerancia amarela (%)">
            <Input type="number" step="0.1" value={form.yellowToleranceP} onChange={(e) => patchForm(setForm, { yellowToleranceP: e.target.value })} />
          </Field>
          {!form.id && (
            <>
              <Field label="Meta inicial">
                <Input type="number" step="0.01" value={form.initialTarget} onChange={(e) => patchForm(setForm, { initialTarget: e.target.value })} />
              </Field>
              <Field label="Realizado inicial">
                <Input type="number" step="0.01" value={form.initialResult} onChange={(e) => patchForm(setForm, { initialResult: e.target.value })} />
              </Field>
            </>
          )}
          <Field label="Fonte dos dados">
            <Input value={form.source} onChange={(e) => patchForm(setForm, { source: e.target.value })} placeholder="ERP, planilha, sistema interno" />
          </Field>
          <Field label="Formula de calculo" className="md:col-span-2">
            <Input value={form.formula} onChange={(e) => patchForm(setForm, { formula: e.target.value })} placeholder="Ex.: (faltas / horas previstas) * 100" />
          </Field>
          <Field label="Categoria">
            <Input value={form.category} onChange={(e) => patchForm(setForm, { category: e.target.value })} placeholder="Opcional" />
          </Field>
          <Field label="Descricao e observacoes" className="md:col-span-2 xl:col-span-3">
            <Textarea rows={3} value={form.description} onChange={(e) => patchForm(setForm, { description: e.target.value })} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar indicador'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IndicatorViewDialog({ indicator, onOpenChange }: { indicator: IndicatorRow | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={Boolean(indicator)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{indicator?.name}</DialogTitle>
        </DialogHeader>
        {indicator && (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <Info label="Empresa" value={indicator.company.tradeName || indicator.company.name} />
              <Info label="Area Macro" value={indicator.areaMacro?.name} />
              <Info label="Area Micro" value={indicator.areaMicro?.name ?? indicator.ownerNode.name} />
              <Info label="Diretriz" value={indicator.guidelineNode?.name ?? '-'} />
              <Info label="Objetivo estrategico" value={indicator.strategicObjective?.name ?? '-'} />
              <Info label="Responsavel" value={indicator.responsibleUser?.name ?? 'Sem responsavel'} />
              <Info label="Periodicidade" value={PERIODICITY_LABEL[indicator.periodicity] ?? indicator.periodicity} />
              <Info label="Sentido" value={DIRECTION_LABEL[indicator.direction] ?? indicator.direction} />
              <Info label="Status" value={STATUS_LABEL[indicator.status] ?? indicator.status} />
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Dados relacionados</h3>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
                <Info label="Metas" value={formatNumber(indicator._count.targets)} />
                <Info label="Realizados" value={formatNumber(indicator._count.results)} />
                <Info label="Planos de acao" value={formatNumber(indicator._count.actions)} />
                <Info label="Reunioes" value={formatNumber(indicator._count.meetings)} />
              </div>
            </div>
            {indicator.description && <p className="text-sm text-muted-foreground">{indicator.description}</p>}
            <div className="flex justify-end">
              <Button variant="outline" asChild>
                <Link href={`/indicators/${indicator.id}`}>Abrir detalhe completo</Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TargetDialog({
  indicator,
  onOpenChange,
}: {
  indicator: IndicatorRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(indicator)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Alterar metas do ano</DialogTitle>
        </DialogHeader>
        {indicator && (
          <IndicatorResultEditor
            mode="target"
            indicatorId={indicator.id}
            fallbackName={indicator.name}
            unitLabel={indicator.unitLabel ?? indicator.unit}
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultDialog({
  indicator,
  onOpenChange,
}: {
  indicator: IndicatorRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(indicator)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Alterar realizado</DialogTitle>
        </DialogHeader>
        {indicator && (
          <IndicatorResultEditor
            indicatorId={indicator.id}
            fallbackName={indicator.name}
            unitLabel={indicator.unitLabel ?? indicator.unit}
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({
  indicator,
  history,
  isLoading,
  onOpenChange,
}: {
  indicator: IndicatorRow | null;
  history?: IndicatorHistory;
  isLoading: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(indicator)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Historico do indicador</DialogTitle>
        </DialogHeader>
        {isLoading && <LoadingState />}
        {!isLoading && (history?.logs.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum registro de auditoria encontrado para este indicador.</p>
        )}
        <div className="max-h-[55vh] space-y-3 overflow-y-auto">
          {history?.logs.map((log) => (
            <div key={log.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{historyActionLabel(log.action)}</div>
                <div className="text-xs text-muted-foreground">{formatDate(log.createdAt)} - {log.user?.name ?? 'Sistema'}</div>
              </div>
              {log.recordLabel && <p className="mt-1 text-sm text-muted-foreground">{log.recordLabel}</p>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className={required ? 'field-required' : undefined}>{label}</Label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value || '-'}</div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as MonthlyPoint | undefined;
  return (
    <div className="rounded-md border bg-background p-2 text-xs shadow-sm">
      <div className="font-semibold">{label}</div>
      <div>Meta: {formatNumber(point?.meta)}</div>
      <div>Realizado: {formatNumber(point?.realizado)}</div>
      <div>Atingimento: {formatPercent(point?.attainment)}</div>
      <div>Status: {LIGHT_LABEL[point?.status ?? 'GRAY']}</div>
    </div>
  );
}

function patchForm(setForm: React.Dispatch<React.SetStateAction<IndicatorForm>>, patch: Partial<IndicatorForm>) {
  setForm((prev) => ({ ...prev, ...patch }));
}

function numberOrUndefined(value: string) {
  if (!value.trim()) return undefined;
  return Number(value.replace(',', '.'));
}

function toQueryString(filters: Filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

function statusBadgeClass(light: string) {
  if (light === 'GREEN') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (light === 'YELLOW') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (light === 'RED') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function historyActionLabel(action: string) {
  const labels: Record<string, string> = {
    CREATE: 'Criacao do indicador',
    UPDATE: 'Edicao cadastral',
    DELETE: 'Exclusao logica',
    CREATE_TARGET: 'Meta criada',
    UPDATE_TARGET: 'Meta alterada',
    CREATE_RESULT: 'Realizado lancado',
    UPDATE_RESULT: 'Realizado alterado',
  };
  return labels[action] ?? action;
}

function exportCsv(rows: IndicatorRow[]) {
  const header = ['Nome', 'Codigo', 'Empresa', 'Area Macro', 'Area Micro', 'Responsavel', 'Meta Atual', 'Realizado Atual', 'Status'];
  const lines = rows.map((row) => [
    row.name,
    row.code ?? '',
    row.company.tradeName || row.company.name,
    row.areaMacro?.name ?? '',
    row.areaMicro?.name ?? row.ownerNode.name,
    row.responsibleUser?.name ?? '',
    row.currentTarget?.target ?? '',
    row.last?.value ?? '',
    LIGHT_LABEL[row.last?.light ?? 'GRAY'],
  ]);
  const csv = [header, ...lines].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'indicadores.csv';
  a.click();
  URL.revokeObjectURL(url);
}
