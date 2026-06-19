'use client';

import Link from 'next/link';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileBarChart,
  FileDown,
  Gauge,
  ListChecks,
  Maximize2,
  MessageSquareText,
  Network,
  Plus,
  Presentation,
  RefreshCw,
  Route,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber, formatPercent, periodRefLabel } from '@/lib/utils';

type Light = 'GREEN' | 'YELLOW' | 'RED' | 'GRAY' | 'BLUE';

interface AreaOption {
  id: string;
  parentId: string | null;
  name: string;
  type: string;
  responsibleUserId?: string | null;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  jobTitle?: string | null;
  defaultNodeId?: string | null;
}

interface MonthlyOptions {
  currentPeriodRef: string;
  areaOptions: AreaOption[];
  users: UserOption[];
  agendaTemplate: AgendaItem[];
  internalAreaScript: Array<{ block: string; plannedMinutes: number }>;
  meetingStatuses: string[];
  ai: { enabled: boolean; provider: string; model: string | null };
}

interface AgendaItem {
  topic: string;
  areaId: string | null;
  areaName: string | null;
  plannedMinutes: number;
  responsibleUserId?: string | null;
  presentationStatus: string;
  internalScript?: Array<{ block: string; plannedMinutes: number }>;
}

interface IndicatorCard {
  id: string;
  name: string;
  code: string | null;
  unit: string;
  unitLabel: string;
  area: { id: string; name: string };
  responsible: { id: string; name: string } | null;
  target: number | null;
  lowerBound: number | null;
  upperBound: number | null;
  current: number | null;
  accumulated: number | null;
  attainment: number | null;
  deviationPct: number | null;
  light: Light;
  trend: string;
  executiveStatus: string;
  comment: string | null;
  source: string | null;
  lastUpdate: string | null;
  hasCause: boolean;
  hasActionPlan: boolean;
  hasImmediateAction: boolean;
  hasPendingDecision: boolean;
  hasOverdueAction: boolean;
  validationIssues: string[];
  rootCause: string | null;
  immediateAction: string | null;
  actionSummary: string | null;
  primaryDeviation: {
    id: string;
    number: number;
    title: string;
    severity: string;
    status: string;
    fact?: string | null;
    impact?: string | null;
    causes?: Array<{ id: string; category: string | null; description: string; weight: number }>;
    analyses?: Array<{ id: string; method: string; content: string }>;
  } | null;
  links: { indicator: string; deviation: string | null; action: string | null };
}

interface AreaSummary {
  id: string;
  name: string;
  type: string;
  responsible: { id: string; name: string; email: string } | null;
  totalIndicators: number;
  green: number;
  yellow: number;
  red: number;
  gray: number;
  noData: number;
  overdueActions: number;
  readiness: string;
  keyIndicators: IndicatorCard[];
  validationIssues: Array<{ indicatorId: string; indicator: string; issue: string }>;
}

interface MonthlyDashboard {
  periodRef: string;
  generatedAt: string;
  meetings: Array<{
    id: string;
    title: string;
    status: string;
    startsAt: string;
    endsAt: string | null;
    location: string | null;
    monthlyMeta?: { monthlyStatus?: string | null; nextWeeklyAt?: string | null } | null;
    _count: { agendaItems: number; decisions: number; participants: number; actions: number };
  }>;
  currentMeeting: { id: string; title: string; startsAt: string; status: string } | null;
  nextMeeting: { id: string; title: string; startsAt: string } | null;
  metrics: {
    currentMeetingStatus: string;
    participantAreas: number;
    indicatorsGreen: number;
    indicatorsYellow: number;
    indicatorsRed: number;
    indicatorsGray: number;
    indicatorsAtRisk: number;
    overdueActions: number;
    doneActions: number;
    openActions: number;
    pendingDecisions: number;
    openEscalations: number;
    areasWithoutUpdate: number;
    areasReady: number;
    nextMonthlyMeeting: string | null;
    nextWeeklyCheck: string | null;
  };
  executivePanel: {
    lights: Record<Light, number>;
    keyMessageDraft: string;
    macroIndicators: IndicatorCard[];
  };
  areas: AreaSummary[];
  indicators: IndicatorCard[];
  criticalIndicators: IndicatorCard[];
  pendingDecisions: Array<{ id: string; decision: string; owner: string | null; dueDate: string | null; meeting: { title: string } }>;
  agendaTemplate: AgendaItem[];
  internalAreaScript: Array<{ block: string; plannedMinutes: number }>;
  weeklyRoutine: Array<{ level: string; focus: string[] }>;
  governance: string[];
  indicatorSheetFields: string[];
  standardizationOptions: string[];
  exportsAvailable: string[];
}

const LIGHT_LABEL: Record<Light, string> = {
  GREEN: 'Verde',
  YELLOW: 'Amarelo',
  RED: 'Vermelho',
  GRAY: 'Cinza',
  BLUE: 'Azul',
};

const LIGHT_COLORS: Record<Light, string> = {
  GREEN: '#16a34a',
  YELLOW: '#d97706',
  RED: '#dc2626',
  GRAY: '#94a3b8',
  BLUE: '#2563eb',
};

const LIGHT_STYLES: Record<Light, string> = {
  GREEN: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  YELLOW: 'border-amber-200 bg-amber-50 text-amber-700',
  RED: 'border-red-200 bg-red-50 text-red-700',
  GRAY: 'border-slate-200 bg-slate-50 text-slate-600',
  BLUE: 'border-blue-200 bg-blue-50 text-blue-700',
};

function defaultPeriodRef() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const defaultCreateForm = {
  title: `Reunião Mensal de Resultados - ${periodRefLabel(defaultPeriodRef())}`,
  periodRef: defaultPeriodRef(),
  cropSeason: '',
  cycleName: 'Fechamento mensal',
  startsAt: new Date().toISOString().slice(0, 16),
  endsAt: '',
  location: '',
  format: 'HYBRID',
  responsibleUserId: '',
  secretaryUserId: '',
  followUpUserId: '',
  monthlyStatus: 'Em preparação',
  objective: 'Fechar resultados do mês, validar desvios relevantes, decidir prioridades e acionar o acompanhamento semanal.',
  assumptions: '',
  criticalRisks: '',
  boardDirections: '',
  generalNotes: '',
  nextMonthlyAt: '',
  nextWeeklyAt: '',
  areaIds: [] as string[],
};

export default function MonthlyResultsPage() {
  const qc = useQueryClient();
  const presentationRef = useRef<HTMLDivElement | null>(null);
  const [periodRef, setPeriodRef] = useState(defaultPeriodRef());
  const [areaFilter, setAreaFilter] = useState('');
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [meetingId, setMeetingId] = useState('');
  const [keyMessage, setKeyMessage] = useState('');
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [decisionForm, setDecisionForm] = useState({ topic: 'Decisão', decision: '', owner: '', dueDate: '' });

  const optionsQuery = useQuery<MonthlyOptions>({
    queryKey: ['monthly-results-options'],
    queryFn: () => api<MonthlyOptions>('/monthly-results/options'),
  });

  useEffect(() => {
    if (!optionsQuery.data || createForm.areaIds.length) return;
    const ssma = optionsQuery.data.areaOptions.find((area) => normalize(area.name).includes('SSMA'));
    if (ssma) {
      setCreateForm((form) => ({ ...form, areaIds: [ssma.id] }));
      setSelectedAreaId(ssma.id);
    }
  }, [createForm.areaIds.length, optionsQuery.data]);

  const dashboardQuery = useQuery<MonthlyDashboard>({
    queryKey: ['monthly-results-dashboard', periodRef, areaFilter],
    queryFn: () => {
      const params = new URLSearchParams({ periodRef });
      if (areaFilter) params.set('areaIds', areaFilter);
      return api<MonthlyDashboard>(`/monthly-results/dashboard?${params.toString()}`);
    },
  });

  const dashboard = dashboardQuery.data;
  const activeMeetingId = meetingId || dashboard?.currentMeeting?.id || dashboard?.meetings[0]?.id || '';

  useEffect(() => {
    if (!dashboard) return;
    setKeyMessage((current) => current || dashboard.executivePanel.keyMessageDraft);
  }, [dashboard]);

  useEffect(() => {
    if (!dashboard) return;
    if (selectedAreaId && dashboard.areas.some((area) => area.id === selectedAreaId)) return;
    setSelectedAreaId(dashboard.areas.find((area) => area.totalIndicators > 0)?.id ?? dashboard.areas[0]?.id ?? '');
  }, [dashboard, selectedAreaId]);

  const createMeeting = useMutation({
    mutationFn: () =>
      api<unknown>('/monthly-results/meetings', {
        method: 'POST',
        json: {
          ...createForm,
          periodRef,
          endsAt: createForm.endsAt || undefined,
          areaIds: createForm.areaIds,
        },
      }),
    onSuccess: async (result: any) => {
      toast.success('Reunião mensal criada');
      setMeetingId(result?.id ?? result?.meeting?.id ?? '');
      await qc.invalidateQueries({ queryKey: ['monthly-results-dashboard'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addDecision = useMutation({
    mutationFn: () =>
      api<unknown>(`/monthly-results/meetings/${activeMeetingId}/decisions`, {
        method: 'POST',
        json: decisionForm,
      }),
    onSuccess: async () => {
      toast.success('Registro enviado para a ata');
      setDecisionForm({ topic: 'Decisão', decision: '', owner: '', dueDate: '' });
      await qc.invalidateQueries({ queryKey: ['monthly-results-dashboard'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const generateMessage = useMutation({
    mutationFn: () => api<{ message: string; provider: string }>(`/monthly-results/meetings/${activeMeetingId}/ai/key-message`, { method: 'POST' }),
    onSuccess: (data) => {
      setKeyMessage(data.message);
      toast.success(data.provider === 'rules' ? 'Mensagem sugerida por regras' : 'Mensagem sugerida pela IA');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const selectedArea = dashboard?.areas.find((area) => area.id === selectedAreaId) ?? dashboard?.areas[0] ?? null;
  const selectedAreaIndicators = useMemo(
    () => dashboard?.indicators.filter((indicator) => indicator.area.id === selectedArea?.id) ?? [],
    [dashboard?.indicators, selectedArea?.id],
  );
  const selectedCritical = selectedAreaIndicators.filter((indicator) => indicator.light === 'RED' || indicator.light === 'YELLOW');
  const paretoData = buildParetoData(selectedCritical);
  const meetingOptions = dashboard?.meetings ?? [];

  async function togglePresentationMode() {
    const node = presentationRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await node.requestFullscreen();
  }

  function toggleCreateArea(areaId: string) {
    setCreateForm((form) => {
      const hasArea = form.areaIds.includes(areaId);
      return {
        ...form,
        areaIds: hasArea ? form.areaIds.filter((id) => id !== areaId) : [...form.areaIds, areaId],
      };
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reunião Mensal de Resultados"
        description="Fechamento corporativo com meta, desvio, causa, ação, decisões e acompanhamento semanal."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="month"
              value={periodRef}
              onChange={(event) => {
                setPeriodRef(event.target.value);
                setKeyMessage('');
              }}
              className="h-9 w-40"
            />
            <NativeSelect
              value={areaFilter}
              onChange={(event) => {
                setAreaFilter(event.target.value);
                setKeyMessage('');
              }}
              className="h-9 w-56"
            >
              <option value="">Todas as áreas</option>
              {optionsQuery.data?.areaOptions.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </NativeSelect>
            <Button variant="outline" onClick={() => dashboardQuery.refetch()} disabled={dashboardQuery.isFetching}>
              <RefreshCw className={cn('mr-2 h-4 w-4', dashboardQuery.isFetching && 'animate-spin')} />
              Atualizar
            </Button>
          </div>
        }
      />

      {dashboardQuery.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {(dashboardQuery.error as Error).message}
        </div>
      )}

      <Tabs defaultValue="painel" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="painel"><Gauge className="mr-2 h-4 w-4" />Painel</TabsTrigger>
          <TabsTrigger value="cadastro"><CalendarDays className="mr-2 h-4 w-4" />Cadastro</TabsTrigger>
          <TabsTrigger value="agenda"><Clock3 className="mr-2 h-4 w-4" />Agenda</TabsTrigger>
          <TabsTrigger value="preparacao"><ListChecks className="mr-2 h-4 w-4" />Preparação</TabsTrigger>
          <TabsTrigger value="executivo"><Presentation className="mr-2 h-4 w-4" />Executivo</TabsTrigger>
          <TabsTrigger value="area"><Target className="mr-2 h-4 w-4" />Área</TabsTrigger>
          <TabsTrigger value="ata"><ClipboardList className="mr-2 h-4 w-4" />Ata</TabsTrigger>
          <TabsTrigger value="semanal"><Route className="mr-2 h-4 w-4" />Semanal</TabsTrigger>
          <TabsTrigger value="farol"><FileBarChart className="mr-2 h-4 w-4" />Farol</TabsTrigger>
        </TabsList>

        <TabsContent value="painel" className="space-y-4">
          <MetricGrid dashboard={dashboard} loading={dashboardQuery.isLoading} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.8fr]">
            <ExecutiveSnapshot dashboard={dashboard} keyMessage={keyMessage} />
            <CurrentMeetingPanel
              dashboard={dashboard}
              activeMeetingId={activeMeetingId}
              setMeetingId={setMeetingId}
              meetings={meetingOptions}
            />
          </div>
          <CriticalIndicators indicators={dashboard?.criticalIndicators ?? []} />
        </TabsContent>

        <TabsContent value="cadastro" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>Cadastrar reunião mensal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Título" className="md:col-span-2">
                    <Input value={createForm.title} onChange={(event) => setCreateForm({ ...createForm, title: event.target.value })} />
                  </Field>
                  <Field label="Safra / exercício">
                    <Input value={createForm.cropSeason} onChange={(event) => setCreateForm({ ...createForm, cropSeason: event.target.value })} />
                  </Field>
                  <Field label="Ciclo de fechamento">
                    <Input value={createForm.cycleName} onChange={(event) => setCreateForm({ ...createForm, cycleName: event.target.value })} />
                  </Field>
                  <Field label="Início">
                    <Input type="datetime-local" value={createForm.startsAt} onChange={(event) => setCreateForm({ ...createForm, startsAt: event.target.value })} />
                  </Field>
                  <Field label="Fim">
                    <Input type="datetime-local" value={createForm.endsAt} onChange={(event) => setCreateForm({ ...createForm, endsAt: event.target.value })} />
                  </Field>
                  <Field label="Local ou link">
                    <Input value={createForm.location} onChange={(event) => setCreateForm({ ...createForm, location: event.target.value })} />
                  </Field>
                  <Field label="Formato">
                    <NativeSelect value={createForm.format} onChange={(event) => setCreateForm({ ...createForm, format: event.target.value })}>
                      <option value="HYBRID">Híbrida</option>
                      <option value="ONLINE">Online</option>
                      <option value="PRESENTIAL">Presencial</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Responsável">
                    <UserSelect users={optionsQuery.data?.users ?? []} value={createForm.responsibleUserId} onChange={(value) => setCreateForm({ ...createForm, responsibleUserId: value })} />
                  </Field>
                  <Field label="Secretário / ata">
                    <UserSelect users={optionsQuery.data?.users ?? []} value={createForm.secretaryUserId} onChange={(value) => setCreateForm({ ...createForm, secretaryUserId: value })} />
                  </Field>
                  <Field label="Follow-up">
                    <UserSelect users={optionsQuery.data?.users ?? []} value={createForm.followUpUserId} onChange={(value) => setCreateForm({ ...createForm, followUpUserId: value })} />
                  </Field>
                  <Field label="Status">
                    <NativeSelect value={createForm.monthlyStatus} onChange={(event) => setCreateForm({ ...createForm, monthlyStatus: event.target.value })}>
                      {optionsQuery.data?.meetingStatuses.map((status) => <option key={status}>{status}</option>)}
                    </NativeSelect>
                  </Field>
                  <Field label="Próxima reunião mensal">
                    <Input type="datetime-local" value={createForm.nextMonthlyAt} onChange={(event) => setCreateForm({ ...createForm, nextMonthlyAt: event.target.value })} />
                  </Field>
                  <Field label="Próxima checagem semanal">
                    <Input type="datetime-local" value={createForm.nextWeeklyAt} onChange={(event) => setCreateForm({ ...createForm, nextWeeklyAt: event.target.value })} />
                  </Field>
                  <Field label="Objetivo" className="md:col-span-2">
                    <Textarea rows={2} value={createForm.objective} onChange={(event) => setCreateForm({ ...createForm, objective: event.target.value })} />
                  </Field>
                  <Field label="Premissas do mês">
                    <Textarea rows={3} value={createForm.assumptions} onChange={(event) => setCreateForm({ ...createForm, assumptions: event.target.value })} />
                  </Field>
                  <Field label="Riscos críticos">
                    <Textarea rows={3} value={createForm.criticalRisks} onChange={(event) => setCreateForm({ ...createForm, criticalRisks: event.target.value })} />
                  </Field>
                  <Field label="Direcionadores da diretoria">
                    <Textarea rows={3} value={createForm.boardDirections} onChange={(event) => setCreateForm({ ...createForm, boardDirections: event.target.value })} />
                  </Field>
                  <Field label="Observações gerais">
                    <Textarea rows={3} value={createForm.generalNotes} onChange={(event) => setCreateForm({ ...createForm, generalNotes: event.target.value })} />
                  </Field>
                </div>

                <div>
                  <Label>Áreas participantes</Label>
                  <div className="mt-2 grid max-h-72 grid-cols-1 gap-2 overflow-auto rounded-md border p-3 md:grid-cols-2">
                    {optionsQuery.data?.areaOptions.map((area) => (
                      <label key={area.id} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                        <input
                          type="checkbox"
                          checked={createForm.areaIds.includes(area.id)}
                          onChange={() => toggleCreateArea(area.id)}
                          className="h-4 w-4 shrink-0"
                        />
                        <span className="min-w-0 truncate">{area.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Button onClick={() => createMeeting.mutate()} disabled={!createForm.title || !createForm.startsAt || createMeeting.isPending}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar reunião mensal
                </Button>
              </CardContent>
            </Card>
            <MeetingList dashboard={dashboard} activeMeetingId={activeMeetingId} setMeetingId={setMeetingId} />
          </div>
        </TabsContent>

        <TabsContent value="agenda" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Roteiro da reunião</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {(dashboard?.agendaTemplate ?? optionsQuery.data?.agendaTemplate ?? []).map((item, index) => (
                  <div key={`${item.topic}-${index}`} className="flex min-w-0 items-center justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span>
                        <p className="min-w-0 break-words text-sm font-medium">{item.topic}</p>
                      </div>
                      {item.areaName && <p className="mt-1 pl-9 text-xs text-muted-foreground">{item.areaName}</p>}
                    </div>
                    <Badge variant="secondary" className="shrink-0">{item.plannedMinutes} min</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Roteiro interno da área</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                {(dashboard?.internalAreaScript ?? optionsQuery.data?.internalAreaScript ?? []).map((item) => (
                  <div key={item.block} className="rounded-md border p-3">
                    <p className="break-words text-sm font-medium">{item.block}</p>
                    <p className="mt-2 text-2xl font-semibold">{item.plannedMinutes}</p>
                    <p className="text-xs text-muted-foreground">minutos</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preparacao" className="space-y-4">
          <AreaReadinessTable areas={dashboard?.areas ?? []} />
          <PreparationBacklog indicators={dashboard?.criticalIndicators ?? []} />
        </TabsContent>

        <TabsContent value="executivo" className="space-y-4">
          <div ref={presentationRef} className="space-y-4 bg-background p-0 fullscreen:bg-background fullscreen:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Painel Executivo - {periodRefLabel(periodRef)}</h2>
                <p className="text-sm text-muted-foreground">Farol corporativo, riscos e decisão do mês.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={togglePresentationMode}>
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Tela cheia
                </Button>
                <Button onClick={() => generateMessage.mutate()} disabled={!activeMeetingId || generateMessage.isPending}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Sugerir mensagem
                </Button>
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 p-4">
              <Label>Mensagem-chave do mês</Label>
              <Textarea className="mt-2 min-h-24 text-base" value={keyMessage} onChange={(event) => setKeyMessage(event.target.value)} />
            </div>
            <ExecutiveCards indicators={dashboard?.executivePanel.macroIndicators ?? []} />
          </div>
        </TabsContent>

        <TabsContent value="area" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Apresentação da área</h2>
              <p className="text-sm text-muted-foreground">{selectedArea?.name ?? 'Área não selecionada'}</p>
            </div>
            <NativeSelect value={selectedAreaId} onChange={(event) => setSelectedAreaId(event.target.value)} className="w-72 max-w-full">
              {dashboard?.areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <ExecutiveCards indicators={selectedAreaIndicators.slice(0, 8)} compact />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ResultVsTarget indicators={selectedCritical.length ? selectedCritical : selectedAreaIndicators.slice(0, 6)} />
            <ParetoPanel data={paretoData} />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.9fr]">
            <RootCausePanel indicators={selectedCritical} />
            <ActionAndLearningPanel indicators={selectedCritical} standardizationOptions={dashboard?.standardizationOptions ?? []} />
          </div>
        </TabsContent>

        <TabsContent value="ata" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Decisões, riscos e escalonamentos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="Reunião">
                  <NativeSelect value={activeMeetingId} onChange={(event) => setMeetingId(event.target.value)}>
                    <option value="">Selecione</option>
                    {meetingOptions.map((meeting) => (
                      <option key={meeting.id} value={meeting.id}>
                        {meeting.title}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Tema">
                  <NativeSelect value={decisionForm.topic} onChange={(event) => setDecisionForm({ ...decisionForm, topic: event.target.value })}>
                    <option>Decisão</option>
                    <option>Risco</option>
                    <option>Escalonamento</option>
                    <option>Pendência</option>
                  </NativeSelect>
                </Field>
                <Field label="Registro">
                  <Textarea rows={4} value={decisionForm.decision} onChange={(event) => setDecisionForm({ ...decisionForm, decision: event.target.value })} />
                </Field>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Responsável">
                    <Input value={decisionForm.owner} onChange={(event) => setDecisionForm({ ...decisionForm, owner: event.target.value })} />
                  </Field>
                  <Field label="Prazo">
                    <Input type="date" value={decisionForm.dueDate} onChange={(event) => setDecisionForm({ ...decisionForm, dueDate: event.target.value })} />
                  </Field>
                </div>
                <Button onClick={() => addDecision.mutate()} disabled={!activeMeetingId || !decisionForm.decision || addDecision.isPending}>
                  <MessageSquareText className="mr-2 h-4 w-4" />
                  Enviar para ata
                </Button>
              </CardContent>
            </Card>
            <MinutesPreview dashboard={dashboard} />
          </div>
        </TabsContent>

        <TabsContent value="semanal" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1fr]">
            <RoutinePanel dashboard={dashboard} />
            <WeeklyActionPanel indicators={dashboard?.criticalIndicators ?? []} />
          </div>
        </TabsContent>

        <TabsContent value="farol" className="space-y-4">
          <ConsolidatedLightTable indicators={dashboard?.indicators ?? []} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <InfoList title="Ficha do indicador" items={dashboard?.indicatorSheetFields ?? []} icon={<Target className="h-4 w-4" />} />
            <InfoList title="Exportações" items={dashboard?.exportsAvailable ?? []} icon={<FileDown className="h-4 w-4" />} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricGrid({ dashboard, loading }: { dashboard?: MonthlyDashboard; loading: boolean }) {
  const metrics = dashboard?.metrics;
  const items = [
    { title: 'Reunião do mês', value: metrics?.currentMeetingStatus ?? '-', detail: dashboard?.currentMeeting?.title ?? 'Sem reunião criada', icon: CalendarDays, tone: 'blue' },
    { title: 'Áreas participantes', value: metrics?.participantAreas ?? 0, detail: `${metrics?.areasReady ?? 0} prontas`, icon: Network, tone: 'slate' },
    { title: 'Dentro da meta', value: metrics?.indicatorsGreen ?? 0, detail: 'Verde ou azul', icon: CheckCircle2, tone: 'green' },
    { title: 'Fora da meta', value: metrics?.indicatorsRed ?? 0, detail: `${metrics?.indicatorsYellow ?? 0} em risco`, icon: AlertTriangle, tone: 'red' },
    { title: 'Ações atrasadas', value: metrics?.overdueActions ?? 0, detail: `${metrics?.doneActions ?? 0} concluídas`, icon: Clock3, tone: 'amber' },
    { title: 'Decisões pendentes', value: metrics?.pendingDecisions ?? 0, detail: `${metrics?.openEscalations ?? 0} escalonamentos`, icon: MessageSquareText, tone: 'violet' },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => (
        <MetricCard key={item.title} {...item} loading={loading} />
      ))}
    </div>
  );
}

function MetricCard({ title, value, detail, icon: Icon, tone, loading }: any) {
  return (
    <Card className="min-w-0">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-words text-xs font-medium uppercase text-muted-foreground">{title}</p>
            <p className="mt-2 break-words text-2xl font-semibold">{loading ? '-' : value}</p>
          </div>
          <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-md', toneClass(tone))}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-2 break-words text-xs text-muted-foreground">{loading ? 'Carregando...' : detail}</p>
      </CardContent>
    </Card>
  );
}

function ExecutiveSnapshot({ dashboard, keyMessage }: { dashboard?: MonthlyDashboard; keyMessage: string }) {
  const data = dashboard
    ? [
        { name: 'Verde', value: dashboard.executivePanel.lights.GREEN + dashboard.executivePanel.lights.BLUE, color: LIGHT_COLORS.GREEN },
        { name: 'Amarelo', value: dashboard.executivePanel.lights.YELLOW, color: LIGHT_COLORS.YELLOW },
        { name: 'Vermelho', value: dashboard.executivePanel.lights.RED, color: LIGHT_COLORS.RED },
        { name: 'Cinza', value: dashboard.executivePanel.lights.GRAY, color: LIGHT_COLORS.GRAY },
      ]
    : [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Farol geral</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-[0.8fr_1fr]">
        <div className="h-64 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: -20, right: 12, top: 12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="min-w-0 rounded-md border bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            Mensagem-chave
          </div>
          <p className="mt-3 whitespace-pre-line break-words text-sm leading-6">{keyMessage || dashboard?.executivePanel.keyMessageDraft || '-'}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CurrentMeetingPanel({ dashboard, activeMeetingId, setMeetingId, meetings }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reuniões do ciclo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {meetings.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma reunião mensal encontrada para o período.</p>}
        {meetings.map((meeting: any) => (
          <button
            key={meeting.id}
            onClick={() => setMeetingId(meeting.id)}
            className={cn(
              'flex w-full min-w-0 items-center justify-between gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted',
              activeMeetingId === meeting.id && 'border-primary bg-primary/5',
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{meeting.title}</p>
              <p className="text-xs text-muted-foreground">{formatDate(meeting.startsAt)} · {meeting.location ?? 'Sem local'}</p>
            </div>
            <Badge variant="secondary" className="shrink-0">{meeting.monthlyMeta?.monthlyStatus ?? meeting.status}</Badge>
          </button>
        ))}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <SmallFact label="Próxima mensal" value={formatDate(dashboard?.metrics.nextMonthlyMeeting)} />
          <SmallFact label="Checagem semanal" value={formatDate(dashboard?.metrics.nextWeeklyCheck)} />
        </div>
      </CardContent>
    </Card>
  );
}

function CriticalIndicators({ indicators }: { indicators: IndicatorCard[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Indicadores críticos para discussão</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {indicators.slice(0, 9).map((indicator) => (
            <IndicatorTile key={indicator.id} indicator={indicator} />
          ))}
          {indicators.length === 0 && <p className="text-sm text-muted-foreground">Sem indicadores críticos no recorte atual.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function IndicatorTile({ indicator }: { indicator: IndicatorCard }) {
  return (
    <Link href={indicator.links.indicator} className="block min-w-0 rounded-md border p-3 transition-colors hover:border-primary/50 hover:bg-muted/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold">{indicator.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{indicator.area.name}</p>
        </div>
        <LightBadge light={indicator.light} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <SmallFact label="Realizado" value={formatValue(indicator.current, indicator.unitLabel)} />
        <SmallFact label="Meta" value={formatValue(indicator.target, indicator.unitLabel)} />
        <SmallFact label="Ating." value={formatPercent(indicator.attainment)} />
      </div>
      <p className="mt-3 line-clamp-2 break-words text-xs text-muted-foreground">{indicator.rootCause ?? indicator.actionSummary ?? indicator.executiveStatus}</p>
    </Link>
  );
}

function ExecutiveCards({ indicators, compact = false }: { indicators: IndicatorCard[]; compact?: boolean }) {
  return (
    <div className={cn('grid grid-cols-1 gap-3', compact ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2 xl:grid-cols-3')}>
      {indicators.map((indicator) => (
        <div key={indicator.id} className="min-w-0 rounded-md border bg-background p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold">{indicator.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{indicator.area.name}</p>
            </div>
            <LightBadge light={indicator.light} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <SmallFact label="Resultado" value={formatValue(indicator.current, indicator.unitLabel)} />
            <SmallFact label="Meta" value={formatValue(indicator.target, indicator.unitLabel)} />
            <SmallFact label="Tendência" value={indicator.trend} />
            <SmallFact label="Status" value={indicator.executiveStatus} />
          </div>
          <p className="mt-3 min-h-10 break-words text-xs text-muted-foreground">{indicator.comment || indicator.rootCause || 'Sem comentário consolidado.'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={indicator.links.indicator}>Ficha</Link>
            </Button>
            {indicator.links.deviation && (
              <Button asChild variant="outline" size="sm">
                <Link href={indicator.links.deviation}>Desvio</Link>
              </Button>
            )}
            {indicator.links.action && (
              <Button asChild variant="outline" size="sm">
                <Link href={indicator.links.action}>Ação</Link>
              </Button>
            )}
          </div>
        </div>
      ))}
      {indicators.length === 0 && <p className="text-sm text-muted-foreground">Sem indicadores disponíveis.</p>}
    </div>
  );
}

function MeetingList({ dashboard, activeMeetingId, setMeetingId }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reuniões cadastradas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(dashboard?.meetings ?? []).map((meeting: any) => (
          <button
            key={meeting.id}
            onClick={() => setMeetingId(meeting.id)}
            className={cn('w-full rounded-md border p-3 text-left hover:bg-muted', activeMeetingId === meeting.id && 'border-primary bg-primary/5')}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold">{meeting.title}</p>
                <p className="text-xs text-muted-foreground">{formatDate(meeting.startsAt)} · {meeting.location ?? 'Sem local'}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
              <SmallFact label="Pauta" value={meeting._count.agendaItems} />
              <SmallFact label="Ata" value={meeting._count.decisions} />
              <SmallFact label="Pessoas" value={meeting._count.participants} />
              <SmallFact label="Ações" value={meeting._count.actions} />
            </div>
          </button>
        ))}
        {!dashboard?.meetings?.length && <p className="text-sm text-muted-foreground">Crie a reunião mensal para liberar pauta e ata integrada.</p>}
      </CardContent>
    </Card>
  );
}

function AreaReadinessTable({ areas }: { areas: AreaSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preparação da apresentação da área</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-3">Área</th>
              <th className="py-2 pr-3">Responsável</th>
              <th className="py-2 pr-3">Farol</th>
              <th className="py-2 pr-3">Ações atrasadas</th>
              <th className="py-2 pr-3">Pendências</th>
              <th className="py-2 pr-3">Prontidão</th>
            </tr>
          </thead>
          <tbody>
            {areas.map((area) => (
              <tr key={area.id} className="border-b last:border-0">
                <td className="max-w-72 py-3 pr-3 font-medium"><span className="break-words">{area.name}</span></td>
                <td className="py-3 pr-3 text-muted-foreground">{area.responsible?.name ?? '-'}</td>
                <td className="py-3 pr-3">
                  <div className="flex flex-wrap gap-1">
                    <CounterBadge light="GREEN" value={area.green} />
                    <CounterBadge light="YELLOW" value={area.yellow} />
                    <CounterBadge light="RED" value={area.red} />
                    <CounterBadge light="GRAY" value={area.gray} />
                  </div>
                </td>
                <td className="py-3 pr-3">{area.overdueActions}</td>
                <td className="py-3 pr-3">{area.validationIssues.length}</td>
                <td className="py-3 pr-3"><ReadinessBadge value={area.readiness} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function PreparationBacklog({ indicators }: { indicators: IndicatorCard[] }) {
  const issues = indicators.flatMap((indicator) => indicator.validationIssues.map((issue) => ({ indicator, issue })));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Validações antes da reunião</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {issues.map(({ indicator, issue }) => (
          <div key={`${indicator.id}-${issue}`} className="flex min-w-0 items-start gap-3 rounded-md border p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="break-words text-sm font-medium">{indicator.name}</p>
              <p className="break-words text-xs text-muted-foreground">{issue}</p>
            </div>
          </div>
        ))}
        {issues.length === 0 && <p className="text-sm text-muted-foreground">Sem bloqueios de preparação no recorte atual.</p>}
      </CardContent>
    </Card>
  );
}

function ResultVsTarget({ indicators }: { indicators: IndicatorCard[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resultado x meta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {indicators.slice(0, 4).map((indicator) => {
          const data = [
            { name: 'Realizado', value: indicator.current ?? 0, color: LIGHT_COLORS[indicator.light] },
            { name: 'Meta', value: indicator.target ?? 0, color: '#64748b' },
          ];
          return (
            <div key={indicator.id} className="rounded-md border p-3">
              <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
                <p className="min-w-0 break-words text-sm font-medium">{indicator.name}</p>
                <LightBadge light={indicator.light} />
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => formatValue(Number(value), indicator.unitLabel)} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
        {indicators.length === 0 && <p className="text-sm text-muted-foreground">Sem indicador com resultado e meta para comparar.</p>}
      </CardContent>
    </Card>
  );
}

function ParetoPanel({ data }: { data: Array<{ name: string; value: number; cumulative: number }> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Estratificação e Pareto</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 16, right: 20, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {data.length === 0 && <p className="text-sm text-muted-foreground">Sem causas estratificadas vinculadas aos desvios da área.</p>}
      </CardContent>
    </Card>
  );
}

function RootCausePanel({ indicators }: { indicators: IndicatorCard[] }) {
  const causes = indicators.flatMap((indicator) =>
    (indicator.primaryDeviation?.causes ?? []).map((cause) => ({ ...cause, indicator: indicator.name })),
  );
  const fishbone = ['Método', 'Máquina', 'Mão de obra', 'Material', 'Meio ambiente', 'Medição'].map((category) => ({
    category,
    items: causes.filter((cause) => normalize(cause.category ?? '').includes(normalize(category))).slice(0, 4),
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Causa raiz</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative rounded-md border p-4">
          <div className="absolute left-6 right-24 top-1/2 hidden h-px bg-border md:block" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {fishbone.map((group) => (
              <div key={group.category} className="relative rounded-md bg-background p-3 shadow-sm ring-1 ring-border">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{group.category}</p>
                <div className="mt-2 space-y-1">
                  {group.items.map((item) => (
                    <p key={item.id} className="break-words text-xs">{item.description}</p>
                  ))}
                  {group.items.length === 0 && <p className="text-xs text-muted-foreground">Sem registro</p>}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700 md:absolute md:right-4 md:top-1/2 md:mt-0 md:w-28 md:-translate-y-1/2">
            Efeito / desvio
          </div>
        </div>
        <div className="space-y-2">
          {indicators.slice(0, 5).map((indicator) => (
            <div key={indicator.id} className="rounded-md border p-3">
              <p className="break-words text-sm font-medium">{indicator.name}</p>
              <p className="mt-1 break-words text-xs text-muted-foreground">{indicator.rootCause ?? 'Causa raiz pendente de validação.'}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActionAndLearningPanel({ indicators, standardizationOptions }: { indicators: IndicatorCard[]; standardizationOptions: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plano de ação, providências e aprendizado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {indicators.slice(0, 6).map((indicator) => (
            <div key={indicator.id} className="rounded-md border p-3">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{indicator.name}</p>
                  <p className="mt-1 break-words text-xs text-muted-foreground">Providência: {indicator.immediateAction ?? 'Pendente'}</p>
                  <p className="mt-1 break-words text-xs text-muted-foreground">Plano: {indicator.actionSummary ?? 'Pendente'}</p>
                </div>
                <LightBadge light={indicator.light} />
              </div>
            </div>
          ))}
          {indicators.length === 0 && <p className="text-sm text-muted-foreground">Sem plano vinculado no recorte atual.</p>}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Padronização sugerida</p>
          <div className="flex flex-wrap gap-2">
            {standardizationOptions.slice(0, 9).map((option) => (
              <Badge key={option} variant="secondary" className="max-w-full whitespace-normal break-words">{option}</Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MinutesPreview({ dashboard }: { dashboard?: MonthlyDashboard }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ata integrada</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <InfoBlock title="Indicadores críticos discutidos" items={(dashboard?.criticalIndicators ?? []).slice(0, 6).map((item) => `${item.name} - ${item.executiveStatus}`)} />
        <InfoBlock title="Causas raiz validadas" items={(dashboard?.criticalIndicators ?? []).filter((item) => item.rootCause).slice(0, 6).map((item) => `${item.name}: ${item.rootCause}`)} />
        <InfoBlock title="Planos e providências" items={(dashboard?.criticalIndicators ?? []).filter((item) => item.actionSummary || item.immediateAction).slice(0, 6).map((item) => `${item.name}: ${item.actionSummary ?? item.immediateAction}`)} />
        <InfoBlock title="Decisões pendentes" items={(dashboard?.pendingDecisions ?? []).map((decision) => `${decision.decision}${decision.owner ? ` - ${decision.owner}` : ''}`)} />
      </CardContent>
    </Card>
  );
}

function RoutinePanel({ dashboard }: { dashboard?: MonthlyDashboard }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Acompanhamento semanal da rotina</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(dashboard?.weeklyRoutine ?? []).map((routine) => (
          <div key={routine.level} className="rounded-md border p-3">
            <p className="text-sm font-semibold">{routine.level}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {routine.focus.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}
            </div>
          </div>
        ))}
        <InfoBlock title="Governança" items={dashboard?.governance ?? []} />
      </CardContent>
    </Card>
  );
}

function WeeklyActionPanel({ indicators }: { indicators: IndicatorCard[] }) {
  const rows = indicators.filter((indicator) => indicator.actionSummary || indicator.hasOverdueAction || indicator.validationIssues.length);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fila semanal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((indicator) => (
          <div key={indicator.id} className="rounded-md border p-3">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <p className="min-w-0 break-words text-sm font-medium">{indicator.name}</p>
              <LightBadge light={indicator.light} />
            </div>
            <p className="mt-2 break-words text-xs text-muted-foreground">{indicator.actionSummary ?? indicator.validationIssues[0] ?? 'Acompanhar evolução semanal.'}</p>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Sem pendências semanais no recorte atual.</p>}
      </CardContent>
    </Card>
  );
}

function ConsolidatedLightTable({ indicators }: { indicators: IndicatorCard[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Farol por área e indicador</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-3">Área</th>
              <th className="py-2 pr-3">Indicador</th>
              <th className="py-2 pr-3">Meta</th>
              <th className="py-2 pr-3">Realizado</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Tendência</th>
              <th className="py-2 pr-3">Responsável</th>
              <th className="py-2 pr-3">Causa</th>
              <th className="py-2 pr-3">Plano</th>
              <th className="py-2 pr-3">Última atualização</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map((indicator) => (
              <tr key={indicator.id} className="border-b align-top last:border-0">
                <td className="max-w-56 py-3 pr-3"><span className="break-words">{indicator.area.name}</span></td>
                <td className="max-w-72 py-3 pr-3 font-medium"><Link href={indicator.links.indicator} className="break-words hover:underline">{indicator.name}</Link></td>
                <td className="py-3 pr-3">{formatValue(indicator.target, indicator.unitLabel)}</td>
                <td className="py-3 pr-3">{formatValue(indicator.current, indicator.unitLabel)}</td>
                <td className="py-3 pr-3"><LightBadge light={indicator.light} /></td>
                <td className="py-3 pr-3">{indicator.trend}</td>
                <td className="py-3 pr-3">{indicator.responsible?.name ?? '-'}</td>
                <td className="py-3 pr-3">{indicator.hasCause ? 'Sim' : 'Não'}</td>
                <td className="py-3 pr-3">{indicator.hasActionPlan ? 'Sim' : 'Não'}</td>
                <td className="py-3 pr-3">{formatDate(indicator.lastUpdate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function InfoList({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {items.map((item) => (
            <div key={item} className="rounded-md border px-3 py-2 text-sm">{item}</div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function InfoBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Sem registros.</p>}
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="break-words rounded-md border px-3 py-2 text-sm">{item}</div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function UserSelect({ users, value, onChange }: { users: UserOption[]; value: string; onChange: (value: string) => void }) {
  return (
    <NativeSelect value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Selecione</option>
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.name}
        </option>
      ))}
    </NativeSelect>
  );
}

function LightBadge({ light }: { light: Light }) {
  return <Badge variant="outline" className={cn('shrink-0', LIGHT_STYLES[light])}>{LIGHT_LABEL[light]}</Badge>;
}

function CounterBadge({ light, value }: { light: Light; value: number }) {
  return <span className={cn('rounded-full border px-2 py-0.5 text-xs', LIGHT_STYLES[light])}>{LIGHT_LABEL[light]} {value}</span>;
}

function ReadinessBadge({ value }: { value: string }) {
  const style = value.includes('pend') ? 'border-amber-200 bg-amber-50 text-amber-700' : value.includes('Liberada') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-700';
  return <Badge variant="outline" className={cn('whitespace-normal break-words', style)}>{value}</Badge>;
}

function SmallFact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function toneClass(tone: string) {
  const tones: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return tones[tone] ?? tones.slate;
}

function formatValue(value: number | null | undefined, unitLabel?: string | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  if (unitLabel === '%') return formatPercent(value > 1 ? value / 100 : value);
  return `${formatNumber(value)}${unitLabel && unitLabel !== 'personalizado' ? ` ${unitLabel}` : ''}`;
}

function buildParetoData(indicators: IndicatorCard[]) {
  const counts = new Map<string, number>();
  for (const indicator of indicators) {
    for (const cause of indicator.primaryDeviation?.causes ?? []) {
      const key = cause.category || 'Sem categoria';
      counts.set(key, (counts.get(key) ?? 0) + (cause.weight || 1));
    }
  }
  const rows = Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  let acc = 0;
  return rows.map((row) => {
    acc += row.value;
    return { ...row, cumulative: total ? acc / total : 0 };
  });
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}
