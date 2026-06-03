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
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Activity,
  BarChart3,
  CalendarDays,
  Clock3,
  Eye,
  FileClock,
  History,
  MessageSquare,
  Minus,
  Paperclip,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserRound,
  Sliders,
  Filter,
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
import { StatusLight } from '@/components/ui/status-light';
import { Textarea } from '@/components/ui/textarea';
import { IndicatorResultEditor, ResultNotesDialog } from '@/components/platform/indicator-result-editor';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { cn, formatDate, formatNumber, formatPercent, periodRefLabel } from '@/lib/utils';
import {
  PERIODICITY_LABEL,
  DIRECTION_LABEL,
  DIRECTION_SHORT_LABEL,
  INDICATOR_TYPE_LABEL,
  INDICATOR_UNIT_LABEL,
  INDICATOR_STATUS_LABEL,
  TRAFFIC_LIGHT_LABEL,
} from '@/lib/labels';

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

const TYPE_LABEL = INDICATOR_TYPE_LABEL;
const UNIT_LABEL = INDICATOR_UNIT_LABEL;
const STATUS_LABEL = INDICATOR_STATUS_LABEL;
const LIGHT_LABEL = TRAFFIC_LIGHT_LABEL;

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
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['indicators:create']);
  const canUpdate = hasPermission(['indicators:update']);
  const canDelete = hasPermission(['indicators:delete']);
  const canTargets = hasPermission(['indicators:targets', 'indicators:update']);
  const canLaunch = hasPermission(['results:launch']);
  const canLaunchGrain = hasPermission(['results:grain', 'results:launch']);
  const canHistory = hasPermission(['indicators:history', 'indicators:view']);
  const [showActions, setShowActions] = useState(true);
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
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  useEffect(() => {
    if (!options.data) return;
    const lightParam = searchParams.get('light');
    const ownerNodeId = searchParams.get('ownerNodeId');
    if (!lightParam && !ownerNodeId) return;

    setFilters((prev) => {
      const next = { ...prev };
      if (lightParam && ['GREEN', 'YELLOW', 'RED', 'GRAY'].includes(lightParam)) {
        next.light = lightParam;
      }
      if (ownerNodeId) {
        const node = options.data.orgNodes.find((item) => item.id === ownerNodeId);
        if (node) {
          next.companyId = node.companyId;
          next.areaMacroId = node.parentId ?? node.id;
          next.areaMicroId = node.parentId ? node.id : '';
        }
      }
      return next;
    });
  }, [options.data, searchParams]);

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

  const microsByParent = useMemo(() => {
    const map = new Map<string, IndicatorRow[]>();
    for (const row of rows) {
      const parentId = row.parentIndicator?.id;
      if (!parentId) continue;
      const list = map.get(parentId) ?? [];
      list.push(row);
      map.set(parentId, list);
    }
    return map;
  }, [rows]);

  const topLevelRows = useMemo(() => rows.filter((row) => !row.parentIndicator), [rows]);

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
      if (!ownerNodeId) throw new Error('Selecione a área ou setor');
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
      toast.success('Indicador inativado com exclusão lógica');
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
        eyebrow="Gestão"
        tone="admin"
        title="Indicadores"
        description="Gerencie os indicadores, metas, realizados e vínculos organizacionais."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Gestão' }, { label: 'Indicadores' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => indicators.refetch()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Button variant="outline" onClick={() => setShowActions((v) => !v)}>
              <Eye className="mr-2 h-4 w-4" />
              {showActions ? 'Ocultar Lançamentos' : 'Mostrar Lançamentos'}
            </Button>
            {canCreate && (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Incluir Indicador
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard compact title="Total de indicadores" value={formatNumber(rows.length)} description={`${formatNumber(stats.active)} ativos`} icon={<Target className="h-4 w-4" />} tone="blue" />
        <MetricCard compact title="Críticos" value={formatNumber(stats.red)} description="Fora da meta no último período" icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <MetricCard compact title="Sem responsável" value={formatNumber(stats.withoutOwner)} description="Revisar governanca" icon={<UserRound className="h-4 w-4" />} tone="yellow" />
        <MetricCard compact title="Sem dados mensais" value={formatNumber(stats.withoutMonthlyData)} description="Precisam de lançamento" icon={<FileClock className="h-4 w-4" />} tone="purple" />
      </div>

      <section className="panel mb-6 p-4">
        {/* Main Toolbar */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-1 min-w-[280px] flex-col gap-1.5">
            <Label htmlFor="search-indicator">Buscar Indicador</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-indicator"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Buscar por nome, código, área ou responsável..."
                className="pl-9"
              />
            </div>
          </div>
          
          <div className="flex flex-col gap-1.5">
            <Label>Filtrar por Farol</Label>
            <div className="flex flex-wrap gap-1.5">
              {(['GREEN', 'YELLOW', 'RED', 'GRAY'] as const).map((light) => {
                const label = LIGHT_LABEL[light] ?? light;
                const isSelected = filters.light === light;
                return (
                  <Button
                    key={light}
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    className={cn(
                      "h-9 px-3 gap-2 flex items-center transition-all",
                      isSelected && "ring-2 ring-primary/20"
                    )}
                    onClick={() => setFilters((prev) => ({ ...prev, light: prev.light === light ? '' : light }))}
                    aria-label={`Filtrar ${label}`}
                  >
                    <StatusLight light={light} />
                    <span className="text-xs font-medium hidden sm:inline">{label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={filtersOpen ? 'secondary' : 'outline'}
              size="sm"
              className="h-9 gap-2"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <Sliders className="h-4 w-4" />
              <span className="hidden md:inline">Filtros Avançados</span>
              <span className="md:hidden">Filtros</span>
            </Button>
            
            {(filters.companyId || filters.areaMacroId || filters.areaMicroId || filters.status || filters.type || filters.periodicity || filters.responsibleUserId || filters.light || filters.search) && (
              <Button variant="ghost" size="sm" className="h-9 px-3" onClick={clearFilters}>
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Collapsible Advanced Filters */}
        {filtersOpen && (
          <div className="mt-4 border-t pt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <Label>Empresa</Label>
              <NativeSelect value={filters.companyId} onChange={(e) => setFilters((prev) => ({ ...prev, companyId: e.target.value, areaMacroId: '', areaMicroId: '' }))}>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.tradeName || company.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Área</Label>
              <NativeSelect value={filters.areaMacroId} onChange={(e) => setFilters((prev) => ({ ...prev, areaMacroId: e.target.value, areaMicroId: '' }))}>
                <option value="">Todas</option>
                {macroOptions.map((node) => (
                  <option key={node.id} value={node.id}>{node.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Setor</Label>
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
              <Label>Responsável</Label>
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
          </div>
        )}
      </section>

      {(options.isLoading || indicators.isLoading) && <LoadingState />}

      {!indicators.isLoading && rows.length === 0 && (
        <EmptyState
          title="Nenhum indicador cadastrado"
          description="Inclua o primeiro indicador ou ajuste os filtros para encontrar registros existentes."
          action={canCreate ? <Button onClick={openCreate}>Incluir Indicador</Button> : null}
        />
      )}

      <div className="grid grid-cols-1 gap-4">
        {topLevelRows.map((indicator) => (
          <IndicatorManagementCard
            key={indicator.id}
            indicator={indicator}
            showActions={showActions}
            micros={microsByParent.get(indicator.id) ?? []}
            canEdit={canUpdate}
            canDelete={canDelete}
            canTargets={canTargets}
            canLaunch={canLaunch}
            canHistory={canHistory}
            onView={() => setViewing(indicator)}
            onEdit={() => openEdit(indicator)}
            onTarget={() => openTarget(indicator)}
            onResult={() => openResult(indicator)}
            onHistory={() => setHistoryIndicator(indicator)}
            onMicroView={(micro) => setViewing(micro)}
            onMicroEdit={(micro) => openEdit(micro)}
            onMicroTarget={(micro) => openTarget(micro)}
            onMicroResult={(micro) => openResult(micro)}
            onMicroHistory={(micro) => setHistoryIndicator(micro)}
            onMicroDelete={(micro) => {
              if (window.confirm('Inativar este indicador? A exclusão será lógica e o histórico será preservado.')) {
                deleteIndicator.mutate(micro);
              }
            }}
            onDelete={() => {
              if (window.confirm('Inativar este indicador? A exclusão será lógica e o histórico será preservado.')) {
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

type IndicatorViewMode = 'monthly' | 'cumulative' | 'weekly' | 'daily';
type IndicatorChartType = 'bar' | 's-curve';

// Cor da serie "Realizado" conforme o ultimo ponto preenchido: verde dentro da meta,
// vermelho fora (respeita a direcao do indicador). Usado na linha da Curva S.
function realizadoSeriesColor(
  points: Array<{ displayRealizado?: number | null; displayMeta?: number | null }>,
  direction?: string,
): string {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const r = points[i]?.displayRealizado;
    const m = points[i]?.displayMeta;
    if (r === null || r === undefined) continue;
    const within = direction === 'LOWER_BETTER' ? (r ?? 0) <= (m ?? 0) : (r ?? 0) >= (m ?? 0);
    return within ? '#10b981' : '#ef4444';
  }
  return '#10b981';
}

const ACTION_STATUS_PT: Record<string, string> = {
  DRAFT: 'Rascunho',
  NOT_STARTED: 'Não iniciada',
  UNDER_ANALYSIS: 'Em análise',
  IN_PROGRESS: 'Em andamento',
  WAITING_THIRD: 'Aguard. terceiro',
  WAITING_EVIDENCE: 'Aguard. evidência',
  WAITING_VALIDATION: 'Aguard. validação',
  PAUSED: 'Pausada',
  DONE: 'Concluída',
  DONE_LATE: 'Concluída (atraso)',
  CANCELLED: 'Cancelada',
  REOPENED: 'Reaberta',
  INEFFECTIVE: 'Ineficaz',
  EFFECTIVE: 'Eficaz',
};
const ACTION_DONE_SET = new Set(['DONE', 'DONE_LATE', 'CANCELLED', 'EFFECTIVE']);

interface LinkedActionRow {
  id: string;
  title: string;
  status: string;
  progress: number;
  dueDate: string | null;
  responsibleUser?: { name: string } | null;
}

// Card com o andamento das acoes vinculadas a um indicador (abaixo de Meta/Realizado/Atingimento).
function IndicatorLinkedActions({ indicatorId }: { indicatorId: string }) {
  const query = useQuery<LinkedActionRow[]>({
    queryKey: ['indicator-actions', indicatorId],
    queryFn: () => api<LinkedActionRow[]>(`/actions?indicatorId=${indicatorId}`),
  });
  const actions = query.data ?? [];
  if (query.isLoading) {
    return (
      <div className="mt-4 border border-border/60 bg-card/60 p-3 text-xs text-muted-foreground">
        Carregando ações vinculadas...
      </div>
    );
  }
  if (actions.length === 0) return null;
  const open = actions.filter((a) => !ACTION_DONE_SET.has(a.status)).length;
  return (
    <div className="mt-4 border border-border/60 bg-card/60 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" /> Ações vinculadas ({actions.length})
        {open > 0 && (
          <span className="rounded-full bg-status-blue/15 px-2 py-0.5 text-[10px] font-medium normal-case text-status-blue">
            {open} em aberto
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {actions.map((a) => {
          const overdue = !!a.dueDate && !ACTION_DONE_SET.has(a.status) && new Date(a.dueDate) < new Date();
          const p = Math.max(0, Math.min(100, a.progress ?? 0));
          return (
            <Link
              key={a.id}
              href={`/actions/${a.id}`}
              className="block rounded-md border bg-background/60 p-2 text-xs transition hover:bg-accent/35"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate font-medium text-foreground">{a.title}</span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                    ACTION_DONE_SET.has(a.status) ? 'bg-status-green/15 text-status-green' : 'bg-status-blue/15 text-status-blue',
                  )}
                >
                  {ACTION_STATUS_PT[a.status] ?? a.status}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', overdue ? 'bg-rose-600' : 'bg-emerald-600')}
                    style={{ width: `${p}%` }}
                  />
                </div>
                <span className="w-9 text-right text-[10px] text-muted-foreground">{Math.round(p)}%</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span className="truncate">{a.responsibleUser?.name ?? 'Sem responsável'}</span>
                <span className={cn('shrink-0', overdue && 'font-semibold text-rose-600')}>
                  {a.dueDate ? formatDate(a.dueDate) : 'Sem prazo'}
                  {overdue ? ' · vencida' : ''}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

interface ChartPoint {
  periodRef: string;
  month: string;
  meta: number | null;
  realizado: number | null;
  attainment: number | null;
  status: string;
  displayMeta: number | null;
  displayRealizado: number | null;
}

interface GrainCell {
  periodRef: string;
  target: number | null;
  value: number | null;
  status: string;
  light: string;
  isClosed?: boolean;
}

interface GrainResponse {
  indicator: { id: string; name: string };
  granularity: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  monthRef: string;
  cells: GrainCell[];
}

function grainPeriodLabel(periodRef: string): string {
  // DAILY: 2026-05-15 -> 15
  if (/^\d{4}-\d{2}-\d{2}$/.test(periodRef)) {
    return periodRef.slice(8, 10);
  }
  // WEEKLY: 2026-W21 -> S21
  const wMatch = /^\d{4}-W(\d{2})$/.exec(periodRef);
  if (wMatch) return `S${wMatch[1]}`;
  // BIWEEKLY: 2026-BW3 -> Q3
  const bwMatch = /^\d{4}-BW(\d+)$/.exec(periodRef);
  if (bwMatch) return `Q${bwMatch[1]}`;
  return periodRef;
}

function currentMonthRef(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function monthOptionsForYear(year: number): { value: string; label: string }[] {
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const pad = (n: number) => String(n).padStart(2, '0');
  return monthNames.map((label, i) => ({
    value: `${year}-${pad(i + 1)}`,
    label: `${label}/${String(year).slice(2)}`,
  }));
}

function buildCumulativeAvg(values: Array<number | null | undefined>): Array<number | null> {
  const out: Array<number | null> = [];
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (v !== null && v !== undefined && Number.isFinite(v)) {
      sum += v;
      count += 1;
    }
    out.push(count === 0 ? null : sum / count);
  }
  return out;
}

function IndicatorManagementCard({
  indicator,
  micros = [],
  showActions = true,
  canEdit = true,
  canDelete = true,
  canTargets = true,
  canLaunch = true,
  canHistory = true,
  onView,
  onEdit,
  onTarget,
  onResult,
  onHistory,
  onDelete,
  onMicroView,
  onMicroEdit,
  onMicroTarget,
  onMicroResult,
  onMicroHistory,
  onMicroDelete,
}: {
  indicator: IndicatorRow;
  showActions?: boolean;
  micros?: IndicatorRow[];
  canEdit?: boolean;
  canDelete?: boolean;
  canTargets?: boolean;
  canLaunch?: boolean;
  canHistory?: boolean;
  onView: () => void;
  onEdit: () => void;
  onTarget: () => void;
  onResult: () => void;
  onHistory: () => void;
  onDelete: () => void;
  onMicroView?: (micro: IndicatorRow) => void;
  onMicroEdit?: (micro: IndicatorRow) => void;
  onMicroTarget?: (micro: IndicatorRow) => void;
  onMicroResult?: (micro: IndicatorRow) => void;
  onMicroHistory?: (micro: IndicatorRow) => void;
  onMicroDelete?: (micro: IndicatorRow) => void;
}) {
  const [microsOpen, setMicrosOpen] = useState(false);
  const [viewMode, setViewMode] = useState<IndicatorViewMode>('monthly');
  const [chartType, setChartType] = useState<IndicatorChartType>('bar');
  const [grainMonth, setGrainMonth] = useState<string>(currentMonthRef());
  const monthlyHistory = indicator.monthlyHistory ?? [];
  const isGrainMode = viewMode === 'weekly' || viewMode === 'daily';
  const grainGranularity = viewMode === 'weekly' ? 'WEEKLY' : 'DAILY';

  const grainQuery = useQuery<GrainResponse>({
    queryKey: ['indicator', indicator.id, 'grain', grainGranularity, grainMonth],
    enabled: isGrainMode,
    queryFn: () => api<GrainResponse>(`/results/grain?indicatorId=${indicator.id}&granularity=${grainGranularity}&month=${grainMonth}`),
  });

  const lastFilledIdx = (() => {
    for (let i = monthlyHistory.length - 1; i >= 0; i--) {
      const point = monthlyHistory[i];
      if (point.meta !== null || point.realizado !== null) return i;
    }
    return monthlyHistory.length - 1;
  })();
  const [selectedIdx, setSelectedIdx] = useState<number>(Math.max(0, lastFilledIdx));

  const chartData: ChartPoint[] = useMemo(() => {
    if (isGrainMode) {
      const cells = grainQuery.data?.cells ?? [];
      return cells.map((c) => ({
        periodRef: c.periodRef,
        month: grainPeriodLabel(c.periodRef),
        meta: c.target,
        realizado: c.value,
        attainment: c.target !== null && c.value !== null && c.target !== 0 ? c.value / c.target : null,
        status: c.light,
        displayMeta: c.target,
        displayRealizado: c.value,
      }));
    }
    if (viewMode === 'monthly') {
      return monthlyHistory.map((p) => ({
        periodRef: p.periodRef,
        month: p.month,
        meta: p.meta,
        realizado: p.realizado,
        attainment: p.attainment,
        status: p.status,
        displayMeta: p.meta,
        displayRealizado: p.realizado,
      }));
    }
    const cumMeta = buildCumulativeAvg(monthlyHistory.map((p) => p.meta));
    const cumReal = buildCumulativeAvg(monthlyHistory.map((p) => p.realizado));
    return monthlyHistory.map((p, idx) => ({
      periodRef: p.periodRef,
      month: p.month,
      meta: p.meta,
      realizado: p.realizado,
      attainment: p.attainment,
      status: p.status,
      displayMeta: cumMeta[idx],
      displayRealizado: cumReal[idx],
    }));
  }, [monthlyHistory, viewMode, isGrainMode, grainQuery.data]);

  const safeSelectedIdx = Math.min(selectedIdx, Math.max(0, chartData.length - 1));
  const selectedChart = chartData[safeSelectedIdx] ?? null;
  const selectedPoint = isGrainMode
    ? selectedChart
      ? {
          periodRef: selectedChart.periodRef,
          month: selectedChart.month,
          meta: selectedChart.meta,
          realizado: selectedChart.realizado,
          attainment: selectedChart.attainment,
          status: selectedChart.status,
        }
      : null
    : monthlyHistory[safeSelectedIdx] ?? null;
  const light = (selectedPoint?.status as string | undefined) ?? indicator.last?.light ?? 'GRAY';
  const hasAnyData = isGrainMode
    ? (grainQuery.data?.cells ?? []).some((c) => c.target !== null || c.value !== null)
    : monthlyHistory.some((p) => p.meta !== null || p.realizado !== null);

  function onChartClick(state: any) {
    const idx = state?.activeTooltipIndex;
    if (typeof idx === 'number' && idx >= 0 && idx < chartData.length) {
      setSelectedIdx(idx);
    }
  }

  return (
    <article className="panel panel-hover flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold leading-tight">{indicator.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span
              className={cn(
                'inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                indicator.direction === 'LOWER_BETTER'
                  ? 'border-status-blue/30 bg-status-blue/10 text-status-blue'
                  : 'border-status-green/30 bg-status-green/10 text-status-green',
              )}
            >
              {indicator.direction === 'LOWER_BETTER' ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              {DIRECTION_SHORT_LABEL[indicator.direction] ?? indicator.direction}
            </span>
            <span className="flex items-center gap-1.5"><Target className="h-3.5 w-3.5" />{indicator.areaMacro?.name ?? '-'}</span>
            <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />{indicator.areaMicro?.name ?? indicator.ownerNode.name}</span>
            <span className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{indicator.responsibleUser?.name ?? 'Sem responsável'}</span>
            <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{indicator.last ? periodRefLabel(indicator.last.periodRef) : (PERIODICITY_LABEL[indicator.periodicity] ?? indicator.periodicity)}</span>
          </div>
        </div>
        <StatusLight light={light} size="md" />
      </div>

      <div className="mt-4">
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-md border bg-card/60 p-0.5">
                {(['monthly', 'cumulative', 'weekly', 'daily'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => { setViewMode(mode); setSelectedIdx(0); }}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded transition-colors',
                      viewMode === mode ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {mode === 'monthly' && 'Mensal'}
                    {mode === 'cumulative' && 'Acumulado'}
                    {mode === 'weekly' && 'Semanal'}
                    {mode === 'daily' && 'Diário'}
                  </button>
                ))}
              </div>
              {isGrainMode && (
                <NativeSelect
                  value={grainMonth}
                  onChange={(e) => { setGrainMonth(e.target.value); setSelectedIdx(0); }}
                  className="h-8 text-xs"
                >
                  {monthOptionsForYear(new Date().getFullYear()).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </NativeSelect>
              )}
            </div>
            <div className="inline-flex rounded-md border bg-card/60 p-0.5">
              <button
                type="button"
                onClick={() => setChartType('bar')}
                className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors', chartType === 'bar' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Barras
              </button>
              <button
                type="button"
                onClick={() => setChartType('s-curve')}
                className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors', chartType === 's-curve' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                <Activity className="h-3.5 w-3.5" />
                Curva S
              </button>
            </div>
          </div>

          <div className="h-80 border border-border/60 bg-card/60 p-2.5 sm:h-[27rem]">
            {hasAnyData ? (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar' ? (
                  <BarChart data={chartData} barGap={2} margin={{ top: 24, right: 12, left: 0, bottom: 8 }} onClick={onChartClick} style={{ cursor: 'pointer' }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={({ x, y, payload, index }: any) => (
                        <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fontWeight={index === selectedIdx ? 700 : 400} fill={index === selectedIdx ? 'hsl(var(--primary))' : 'currentColor'}>
                          {payload.value}
                        </text>
                      )}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11 }} width={48} />
                    <Tooltip content={<ChartTooltip viewMode={viewMode} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.35 }} />
                    <Bar dataKey="displayMeta" name="Meta" fill="#1e3a8a" radius={[3, 3, 0, 0]}>
                      <LabelList dataKey="displayMeta" position="top" fontSize={10} fill="#1e3a8a" formatter={(v: any) => (v === null || v === undefined ? '' : formatNumber(v))} />
                    </Bar>
                    <Bar dataKey="displayRealizado" name="Realizado" radius={[3, 3, 0, 0]}>
                      {chartData.map((entry, index) => {
                        let color = 'hsl(var(--status-gray))';
                        const r = entry.displayRealizado;
                        const m = entry.displayMeta;
                        if (r !== null && r !== undefined) {
                          const isWithin = indicator.direction === 'LOWER_BETTER'
                            ? (r ?? 0) <= (m ?? 0)
                            : (r ?? 0) >= (m ?? 0);
                          color = isWithin ? '#10b981' : '#ef4444';
                        }
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                      <LabelList dataKey="displayRealizado" position="top" fontSize={10} fill="hsl(var(--foreground))" formatter={(v: any) => (v === null || v === undefined ? '' : formatNumber(v))} />
                    </Bar>
                  </BarChart>
                ) : (
                  <LineChart data={chartData} margin={{ top: 24, right: 12, left: 0, bottom: 8 }} onClick={onChartClick} style={{ cursor: 'pointer' }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={({ x, y, payload, index }: any) => (
                        <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fontWeight={index === selectedIdx ? 700 : 400} fill={index === selectedIdx ? 'hsl(var(--primary))' : 'currentColor'}>
                          {payload.value}
                        </text>
                      )}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11 }} width={48} />
                    <Tooltip content={<ChartTooltip viewMode={viewMode} />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Line type="monotone" dataKey="displayMeta" name="Meta" stroke="#1e3a8a" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3, fill: '#1e3a8a' }} activeDot={{ r: 5 }}>
                      <LabelList dataKey="displayMeta" position="top" fontSize={10} fill="#1e3a8a" formatter={(v: any) => (v === null || v === undefined ? '' : formatNumber(v))} />
                    </Line>
                    <Line type="monotone" dataKey="displayRealizado" name="Realizado" stroke={realizadoSeriesColor(chartData, indicator.direction)} strokeWidth={2.5} dot={{ r: 3, fill: realizadoSeriesColor(chartData, indicator.direction) }} activeDot={{ r: 5 }}>
                      <LabelList dataKey="displayRealizado" position="top" fontSize={10} fill={realizadoSeriesColor(chartData, indicator.direction)} formatter={(v: any) => (v === null || v === undefined ? '' : formatNumber(v))} />
                    </Line>
                  </LineChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sem dados para o período</div>
            )}
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {viewMode === 'cumulative' && 'Acumulado calculado como média YTD dos períodos preenchidos. '}
            {viewMode === 'monthly' && 'Valores mensais do indicador no ano corrente. '}
            {viewMode === 'weekly' && `Semanas do mês ${grainMonth}. `}
            {viewMode === 'daily' && `Dias do mês ${grainMonth}. `}
            {isGrainMode && grainQuery.isLoading && 'Carregando... '}
            Clique nas barras/pontos para ver os detalhes do período.
          </div>
        </div>
      </div>

      {indicator._count.actions > 0 && <IndicatorLinkedActions indicatorId={indicator.id} />}

      {showActions && (
      <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
        {canLaunch && (
          <Button variant="default" size="sm" onClick={onResult}>
            <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
            Lançar Realizado
          </Button>
        )}
        <div className="hidden md:block mx-1 w-px self-stretch bg-border" />
        <Button variant="outline" size="sm" onClick={onView}><Eye className="mr-1.5 h-3.5 w-3.5" />Visualizar</Button>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Button>
        )}
        {canTargets && (
          <Button variant="outline" size="sm" onClick={onTarget}>Metas</Button>
        )}
        {canHistory && (
          <Button variant="ghost" size="sm" onClick={onHistory}><History className="mr-1.5 h-3.5 w-3.5" />Histórico</Button>
        )}
        {canDelete && (
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive ml-auto" onClick={onDelete}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Inativar</Button>
        )}
      </div>
      )}

      {micros.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <button
            type="button"
            onClick={() => setMicrosOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors hover:bg-accent/35"
          >
            <span className="flex items-center gap-2">
              {microsOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {formatNumber(micros.length)} indicador(es) micro
            </span>
            <span className="text-xs text-muted-foreground">
              {microsOpen ? 'Recolher' : 'Expandir'}
            </span>
          </button>
          {microsOpen && (
            <div className="mt-3 space-y-2">
              {micros.map((micro) => (
                <MicroIndicatorRow
                  key={micro.id}
                  micro={micro}
                  showActions={showActions}
                  onView={() => onMicroView?.(micro)}
                  onEdit={() => onMicroEdit?.(micro)}
                  onTarget={() => onMicroTarget?.(micro)}
                  onResult={() => onMicroResult?.(micro)}
                  onHistory={() => onMicroHistory?.(micro)}
                  onDelete={() => onMicroDelete?.(micro)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function MicroIndicatorRow({
  micro,
  showActions = true,
  onView,
  onEdit,
  onTarget,
  onResult,
  onHistory,
  onDelete,
}: {
  micro: IndicatorRow;
  showActions?: boolean;
  onView: () => void;
  onEdit: () => void;
  onTarget: () => void;
  onResult: () => void;
  onHistory: () => void;
  onDelete: () => void;
}) {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(['indicators:update']);
  const canDelete = hasPermission(['indicators:delete']);
  const canTargets = hasPermission(['indicators:targets', 'indicators:update']);
  const canResult = hasPermission(['results:launch']);
  const canHistory = hasPermission(['indicators:history', 'indicators:view']);
  const light = micro.last?.light ?? 'GRAY';
  const monthlyHistory = micro.monthlyHistory ?? [];
  const hasHistory = monthlyHistory.some((point) => point.meta !== null || point.realizado !== null);

  return (
    <div className="group relative flex flex-col gap-2 rounded-lg border bg-muted/15 p-3 transition-all hover:border-primary/20 hover:bg-muted/25">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        
        {/* Left Side: Indicator Metadata and Numbers */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {micro.code && <Badge variant="outline" className="font-mono text-[10px]">{micro.code}</Badge>}
            <Badge className={cn('border text-[10px] px-1.5 py-0', statusBadgeClass(light))} variant="outline">
              {LIGHT_LABEL[light] ?? light}
            </Badge>
            <span className="text-xs text-muted-foreground truncate">
              {micro.areaMicro?.name ?? micro.ownerNode.name}
            </span>
          </div>
          <h4 className="mt-1.5 truncate text-sm font-semibold text-foreground leading-tight">
            {micro.name}
          </h4>
          
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="font-medium text-foreground/80">Meta:</span> 
              {formatNumber(micro.currentTarget?.target)}
            </span>
            <span className="flex items-center gap-1">
              <span className="font-medium text-foreground/80">Realizado:</span> 
              {micro.last ? formatNumber(micro.last.value) : '-'}
            </span>
            <span className="flex items-center gap-1">
              <span className="font-medium text-foreground/80">Atingimento:</span> 
              <span className={cn(
                "font-semibold",
                micro.last?.attainment && micro.last.attainment >= 1 ? "text-emerald-500" : micro.last?.attainment ? "text-rose-500" : ""
              )}>
                {formatPercent(micro.last?.attainment ?? null)}
              </span>
            </span>
          </div>
        </div>

        {/* Right Side: Mini Bar Chart Sparkline */}
        <div className="flex items-center gap-3 self-stretch md:self-auto min-w-[155px] justify-between border-t border-muted pt-2.5 md:border-t-0 md:pt-0">
          {hasHistory ? (
            <div className="flex flex-col items-center gap-0.5">
              <div className="h-9 w-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyHistory} barGap={1}>
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
                    />
                    <Bar dataKey="meta" name="Meta" fill="hsl(var(--muted-foreground)/20)" radius={[1, 1, 0, 0]} />
                    <Bar dataKey="realizado" name="Realizado" radius={[1, 1, 0, 0]}>
                      {monthlyHistory.map((entry, index) => {
                        let color = 'hsl(var(--status-gray))';
                        if (entry.realizado !== null && entry.realizado !== undefined) {
                          const isWithin = micro.direction === 'LOWER_BETTER'
                            ? (entry.realizado ?? 0) <= (entry.meta ?? 0)
                            : (entry.realizado ?? 0) >= (entry.meta ?? 0);
                          color = isWithin ? '#10b981' : '#ef4444';
                        }
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex w-36 justify-between px-1 text-[9px] text-muted-foreground/60 select-none">
                <span>Jan</span>
                <span>Dez</span>
              </div>
            </div>
          ) : (
            <div className="flex h-10 w-36 items-center justify-center rounded border border-dashed text-[10px] text-muted-foreground/50">
              Sem dados mensais
            </div>
          )}
        </div>

      </div>

      {/* Micro actions row */}
      {showActions && (
      <div className="mt-1 flex flex-wrap gap-1 border-t pt-2">
        <Button variant="ghost" size="sm" className="h-7 text-xs px-2.5 gap-1.5" onClick={onView} title="Visualizar">
          <Eye className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Visualizar</span>
        </Button>
        {canEdit && (
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2.5 gap-1.5" onClick={onEdit} title="Editar">
            <Pencil className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Editar</span>
          </Button>
        )}
        {canTargets && (
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2.5" onClick={onTarget}>
            Metas
          </Button>
        )}
        {canResult && (
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2.5" onClick={onResult}>
            Realizados
          </Button>
        )}
        {canHistory && (
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2.5 gap-1.5" onClick={onHistory} title="Histórico">
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Histórico</span>
          </Button>
        )}
        <div className="flex-1" />
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 px-2.5 gap-1.5 ml-auto"
            onClick={onDelete}
            title="Inativar"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Inativar</span>
          </Button>
        )}
      </div>
      )}
    </div>
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
          <Field label="Código">
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
          <Field label="Área" required>
            <NativeSelect value={form.areaMacroId} onChange={(e) => patchForm(setForm, { areaMacroId: e.target.value, areaMicroId: '' })}>
              <option value="">Selecione</option>
              {macroOptions.map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Setor">
            <NativeSelect value={form.areaMicroId} onChange={(e) => patchForm(setForm, { areaMicroId: e.target.value })}>
              <option value="">Usar área</option>
              {microOptions.map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Indicador macro (pai)">
            <NativeSelect value={form.parentIndicatorId} onChange={(e) => patchForm(setForm, { parentIndicatorId: e.target.value })}>
              <option value="">Sem vínculo (indicador macro proprio)</option>
              {parentIndicatorOptions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code ? `${row.code} - ` : ''}{row.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Diretriz vinculada">
            <NativeSelect value={form.guidelineNodeId} onChange={(e) => patchForm(setForm, { guidelineNodeId: e.target.value })}>
              <option value="">Não vinculada</option>
              {guidelineOptions.map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Objetivo estratégico">
            <NativeSelect value={form.strategicObjectiveId} onChange={(e) => patchForm(setForm, { strategicObjectiveId: e.target.value })}>
              <option value="">Não vinculado</option>
              {strategicObjectives.map((objective) => (
                <option key={objective.id} value={objective.id}>{objective.perspective.name} - {objective.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Responsável">
            <NativeSelect value={form.responsibleUserId} onChange={(e) => patchForm(setForm, { responsibleUserId: e.target.value })}>
              <option value="">Sem responsável</option>
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
          <Field label="Rótulo da unidade">
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
          <Field label="Tolerância amarela (%)">
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
          <Field label="Formula de cálculo" className="md:col-span-2">
            <Input value={form.formula} onChange={(e) => patchForm(setForm, { formula: e.target.value })} placeholder="Ex.: (faltas / horas previstas) * 100" />
          </Field>
          <Field label="Categoria">
            <Input value={form.category} onChange={(e) => patchForm(setForm, { category: e.target.value })} placeholder="Opcional" />
          </Field>
          <Field label="Descrição e observacoes" className="md:col-span-2 xl:col-span-3">
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
              <Info label="Área" value={indicator.areaMacro?.name} />
              <Info label="Setor" value={indicator.areaMicro?.name ?? indicator.ownerNode.name} />
              <Info label="Diretriz" value={indicator.guidelineNode?.name ?? '-'} />
              <Info label="Objetivo estratégico" value={indicator.strategicObjective?.name ?? '-'} />
              <Info label="Responsável" value={indicator.responsibleUser?.name ?? 'Sem responsável'} />
              <Info label="Periodicidade" value={PERIODICITY_LABEL[indicator.periodicity] ?? indicator.periodicity} />
              <Info label="Sentido" value={DIRECTION_LABEL[indicator.direction] ?? indicator.direction} />
              <Info label="Status" value={STATUS_LABEL[indicator.status] ?? indicator.status} />
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Dados relacionados</h3>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
                <Info label="Metas" value={formatNumber(indicator._count.targets)} />
                <Info label="Realizados" value={formatNumber(indicator._count.results)} />
                <Info label="Planos de ação" value={formatNumber(indicator._count.actions)} />
                <Info label="Reuniões" value={formatNumber(indicator._count.meetings)} />
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

type LaunchGranularity = 'MONTHLY' | 'WEEKLY' | 'DAILY';

function TargetDialog({
  indicator,
  onOpenChange,
}: {
  indicator: IndicatorRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <UnifiedLaunchDialog
      indicator={indicator}
      mode="target"
      onOpenChange={onOpenChange}
    />
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
    <UnifiedLaunchDialog
      indicator={indicator}
      mode="result"
      onOpenChange={onOpenChange}
    />
  );
}

function UnifiedLaunchDialog({
  indicator,
  mode,
  onOpenChange,
}: {
  indicator: IndicatorRow | null;
  mode: 'result' | 'target';
  onOpenChange: (open: boolean) => void;
}) {
  const [granularity, setGranularity] = useState<LaunchGranularity>('MONTHLY');

  useEffect(() => {
    if (indicator) setGranularity('MONTHLY');
  }, [indicator?.id]);

  const isResult = mode === 'result';
  const monthlyLabel = isResult ? 'Lançar Realizado' : 'Meta Mensal';
  const weeklyLabel = isResult ? 'Lançar Semanal' : 'Meta Semanal';
  const dailyLabel = isResult ? 'Lançar Diário' : 'Meta Diária';
  const title = isResult ? `Lançar Realizado · ${indicator?.name ?? ''}` : `Alterar metas · ${indicator?.name ?? ''}`;

  const tabs: Array<{ key: LaunchGranularity; label: string }> = [
    { key: 'MONTHLY', label: monthlyLabel },
    { key: 'WEEKLY', label: weeklyLabel },
    { key: 'DAILY', label: dailyLabel },
  ];

  return (
    <Dialog open={Boolean(indicator)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {indicator && (
          <div className="space-y-4">
            <div className="inline-flex border border-border/60 bg-muted/40 p-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setGranularity(tab.key)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-colors',
                    granularity === tab.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {granularity === 'MONTHLY' && (
              <IndicatorResultEditor
                mode={mode}
                indicatorId={indicator.id}
                fallbackName={indicator.name}
                unitLabel={indicator.unitLabel ?? indicator.unit}
              />
            )}
            {granularity !== 'MONTHLY' && (
              <GrainEditor
                indicator={indicator}
                mode={mode}
                granularity={granularity}
              />
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GrainEditor({
  indicator,
  mode,
  granularity,
}: {
  indicator: IndicatorRow;
  mode: 'result' | 'target';
  granularity: 'WEEKLY' | 'DAILY';
}) {
  const qc = useQueryClient();
  const [month, setMonth] = useState<string>(currentMonthRef());
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [notesCell, setNotesCell] = useState<string | null>(null);

  useEffect(() => {
    setEdits({});
    setNotesCell(null);
  }, [indicator.id, granularity, month]);

  const query = useQuery<GrainResponse>({
    queryKey: ['grain', indicator.id, granularity, month],
    queryFn: () => api<GrainResponse>(`/results/grain?indicatorId=${indicator.id}&granularity=${granularity}&month=${month}`),
  });

  const save = useMutation({
    mutationFn: () => {
      const items: { indicatorId: string; periodRef: string; value: number }[] = [];
      for (const [periodRef, raw] of Object.entries(edits)) {
        const trimmed = raw.trim().replace(',', '.');
        if (trimmed === '') continue;
        const num = Number(trimmed);
        if (!Number.isFinite(num)) continue;
        items.push({ indicatorId: indicator.id, periodRef, value: num });
      }
      if (items.length === 0) return Promise.reject(new Error('Nada para salvar'));
      const endpoint = mode === 'target' ? '/results/batch' : '/results/batch';
      return api<{ count: number }>(endpoint, { method: 'POST', json: { items } });
    },
    onSuccess: (out) => {
      toast.success(`${out.count} lançamento(s) salvos`);
      setEdits({});
      qc.invalidateQueries({ queryKey: ['grain', indicator.id] });
      qc.invalidateQueries({ queryKey: ['indicators'] });
      qc.invalidateQueries({ queryKey: ['indicator', indicator.id, 'grain'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar'),
  });

  const cells = query.data?.cells ?? [];
  const editedCount = Object.values(edits).filter((v) => v.trim() !== '').length;
  const valueColLabel = mode === 'target' ? 'Meta' : 'Realizado';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-xs uppercase text-muted-foreground">Mês</Label>
        <NativeSelect value={month} onChange={(e) => { setMonth(e.target.value); setEdits({}); }} className="h-9 w-40">
          {monthOptionsForYear(new Date().getFullYear()).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </NativeSelect>
        <span className="text-xs text-muted-foreground">
          {granularity === 'WEEKLY' ? `${cells.length} semana(s) no mês` : `${cells.length} dia(s) no mês`}
        </span>
      </div>

      {query.isLoading && <LoadingState className="min-h-40" />}
      {!query.isLoading && cells.length === 0 && (
        <EmptyState title="Sem períodos" description="Selecione outro mês." />
      )}
      {!query.isLoading && cells.length > 0 && (
        <div className="overflow-x-auto border">
          <table className="table-modern min-w-[480px]">
            <thead>
              <tr>
                <th className="text-left">{granularity === 'WEEKLY' ? 'Semana' : 'Dia'}</th>
                <th className="text-left">Meta</th>
                <th className="text-left">{valueColLabel}</th>
                {mode === 'result' && <th className="text-left">Registros</th>}
              </tr>
            </thead>
            <tbody>
              {cells.map((cell) => {
                const editVal = edits[cell.periodRef] ?? '';
                const persisted = mode === 'target' ? cell.target : cell.value;
                const display = editVal !== ''
                  ? editVal
                  : persisted !== null && persisted !== undefined ? String(persisted) : '';
                return (
                  <tr key={cell.periodRef}>
                    <td>
                      <div className="font-medium">{grainPeriodLabel(cell.periodRef)}</div>
                      <div className="text-xs text-muted-foreground">{cell.periodRef}</div>
                    </td>
                    <td>
                      <div className="text-sm">{cell.target !== null ? formatNumber(cell.target) : '-'}</div>
                    </td>
                    <td>
                      <Input
                        value={display}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [cell.periodRef]: e.target.value }))}
                        placeholder={cell.target !== null ? String(cell.target) : '-'}
                        className="h-9 w-32 text-sm"
                      />
                    </td>
                    {mode === 'result' && (
                      <td>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => setNotesCell(cell.periodRef)}
                            title="Anexos"
                          >
                            <Paperclip className="mr-1 h-3.5 w-3.5" />
                            Anexo
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => setNotesCell(cell.periodRef)}
                            title="Comentários"
                          >
                            <MessageSquare className="mr-1 h-3.5 w-3.5" />
                            Comentários
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={editedCount === 0 || save.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {save.isPending ? 'Salvando...' : `Salvar (${editedCount})`}
        </Button>
      </div>

      {notesCell && (
        <ResultNotesDialog
          indicatorId={indicator.id}
          periodRef={notesCell}
          open={!!notesCell}
          onClose={() => setNotesCell(null)}
        />
      )}
    </div>
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
          <DialogTitle>Histórico do indicador</DialogTitle>
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

function ChartTooltip({ active, payload, label, viewMode }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as ChartPoint | undefined;
  const isCum = viewMode === 'cumulative';
  return (
    <div className="rounded-md border bg-background p-2 text-xs shadow-sm">
      <div className="font-semibold">{label}{isCum && ' (acumulado)'}</div>
      <div>Meta: {formatNumber(point?.displayMeta ?? point?.meta)}</div>
      <div>Realizado: {formatNumber(point?.displayRealizado ?? point?.realizado)}</div>
      {!isCum && <div>Atingimento: {formatPercent(point?.attainment)}</div>}
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
    CREATE: 'Criação do indicador',
    UPDATE: 'Edição cadastral',
    DELETE: 'Exclusão lógica',
    CREATE_TARGET: 'Meta criada',
    UPDATE_TARGET: 'Meta alterada',
    CREATE_RESULT: 'Realizado lancado',
    UPDATE_RESULT: 'Realizado alterado',
  };
  return labels[action] ?? action;
}
