'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Gauge,
  MessageSquareText,
  Network,
  Plus,
  Presentation,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/shell/page-header';
import { useAuth } from '@/components/auth/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber, formatPercent, periodRefLabel } from '@/lib/utils';
import {
  LIGHT_COLORS,
  LIGHT_LABEL,
  LIGHT_STYLES,
  STATUS_STYLES,
  type Light,
  type MonthlyDashboard,
  type MonthlyOptions,
  defaultPeriodRef,
  formatValue,
  normalize,
} from './shared';

export default function MonthlyResultsHome() {
  const qc = useQueryClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['monthly:create', 'monthly:manage']);
  const [periodRef, setPeriodRef] = useState(defaultPeriodRef());
  const [areaFilter, setAreaFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const optionsQuery = useQuery<MonthlyOptions>({
    queryKey: ['monthly-options'],
    queryFn: () => api<MonthlyOptions>('/monthly-results/options'),
  });

  const dashboardQuery = useQuery<MonthlyDashboard>({
    queryKey: ['monthly-dashboard', periodRef, areaFilter],
    queryFn: () => {
      const params = new URLSearchParams({ periodRef });
      if (areaFilter) params.set('areaIds', areaFilter);
      return api<MonthlyDashboard>(`/monthly-results/dashboard?${params.toString()}`);
    },
  });

  const dashboard = dashboardQuery.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reunião Mensal de Resultados"
        description="Fechamento corporativo: meta, desvio, causa, ação, decisão e acompanhamento — tudo conectado aos dados do sistema."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="month"
              value={periodRef}
              onChange={(event) => setPeriodRef(event.target.value)}
              className="h-9 w-40"
            />
            <NativeSelect value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)} className="h-9 w-52">
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
            {canCreate && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nova reunião
              </Button>
            )}
          </div>
        }
      />

      {dashboardQuery.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{(dashboardQuery.error as Error).message}</div>
      )}

      <MetricGrid dashboard={dashboard} loading={dashboardQuery.isLoading} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <FarolPanel dashboard={dashboard} />
        <MeetingsPanel dashboard={dashboard} onOpen={(id) => router.push(`/monthly-results/${id}`)} canCreate={canCreate} onCreate={() => setCreateOpen(true)} />
      </div>

      <CriticalPanel dashboard={dashboard} />

      <CreateMeetingDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        options={optionsQuery.data}
        periodRef={periodRef}
        onCreated={async (id) => {
          setCreateOpen(false);
          await qc.invalidateQueries({ queryKey: ['monthly-dashboard'] });
          router.push(`/monthly-results/${id}`);
        }}
      />
    </div>
  );
}

function MetricGrid({ dashboard, loading }: { dashboard?: MonthlyDashboard; loading: boolean }) {
  const m = dashboard?.metrics;
  const items = [
    { title: 'Reuniões no mês', value: m?.meetingsInPeriod ?? 0, detail: `${m?.areasReady ?? 0} área(s) prontas`, icon: CalendarDays, tone: 'blue' },
    { title: 'Áreas participantes', value: m?.participantAreas ?? 0, detail: `${m?.areasWithoutUpdate ?? 0} sem atualização`, icon: Network, tone: 'slate' },
    { title: 'Dentro da meta', value: m?.indicatorsGreen ?? 0, detail: 'Verde ou azul', icon: CheckCircle2, tone: 'green' },
    { title: 'Fora da meta', value: m?.indicatorsRed ?? 0, detail: `${m?.indicatorsYellow ?? 0} em atenção`, icon: AlertTriangle, tone: 'red' },
    { title: 'Ações atrasadas', value: m?.overdueActions ?? 0, detail: `${m?.doneActions ?? 0} concluídas`, icon: Clock3, tone: 'amber' },
    { title: 'Decisões pendentes', value: m?.pendingDecisions ?? 0, detail: `${m?.openEscalations ?? 0} escalonamentos`, icon: MessageSquareText, tone: 'violet' },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => (
        <Card key={item.title} className="min-w-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-xs font-medium uppercase text-muted-foreground">{item.title}</p>
                <p className="mt-2 text-2xl font-semibold">{loading ? '-' : item.value}</p>
              </div>
              <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-md', toneClass(item.tone))}>
                <item.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 break-words text-xs text-muted-foreground">{loading ? 'Carregando...' : item.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FarolPanel({ dashboard }: { dashboard?: MonthlyDashboard }) {
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
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-4 w-4" />
          Farol corporativo do mês
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1fr]">
        <div className="h-60 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: -20, right: 12, top: 12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="min-w-0 rounded-md border bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            Mensagem-chave sugerida
          </div>
          <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-muted-foreground">
            {dashboard?.executivePanel.keyMessageDraft ?? 'Selecione um período para consolidar a mensagem-chave.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function MeetingsPanel({
  dashboard,
  onOpen,
  canCreate,
  onCreate,
}: {
  dashboard?: MonthlyDashboard;
  onOpen: (id: string) => void;
  canCreate: boolean;
  onCreate: () => void;
}) {
  const meetings = dashboard?.meetings ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reuniões mensais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {meetings.length === 0 && (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Nenhuma reunião neste recorte.
            {canCreate && (
              <Button variant="link" className="h-auto px-1" onClick={onCreate}>
                Criar a primeira
              </Button>
            )}
          </div>
        )}
        {meetings.map((meeting) => (
          <button
            key={meeting.id}
            onClick={() => onOpen(meeting.id)}
            className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md border p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/50"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{meeting.title}</p>
              <p className="text-xs text-muted-foreground">
                {periodRefLabel(meeting.periodRef)} · {formatDate(meeting.startsAt)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>{meeting.counts.areas} áreas</span>
                <span>·</span>
                <span>{meeting.readiness.ready}/{meeting.readiness.total} prontas</span>
                <span>·</span>
                <span>{meeting.counts.decisions} decisões</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <Badge variant="outline" className={cn(STATUS_STYLES[meeting.status] ?? '')}>
                {STATUS_LABEL[meeting.status] ?? meeting.status}
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function CriticalPanel({ dashboard }: { dashboard?: MonthlyDashboard }) {
  const indicators = dashboard?.criticalIndicators ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Indicadores críticos para discussão
        </CardTitle>
      </CardHeader>
      <CardContent>
        {indicators.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem indicadores críticos no recorte atual.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {indicators.slice(0, 9).map((indicator) => (
              <Link
                key={indicator.id}
                href={indicator.links.indicator}
                className="block min-w-0 rounded-md border p-3 transition-colors hover:border-primary/50 hover:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold">{indicator.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{indicator.area}</p>
                  </div>
                  <Badge variant="outline" className={cn('shrink-0', LIGHT_STYLES[indicator.light])}>
                    {LIGHT_LABEL[indicator.light]}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <Fact label="Realizado" value={formatValue(indicator.current, indicator.unitLabel)} />
                  <Fact label="Meta" value={formatValue(indicator.target, indicator.unitLabel)} />
                  <Fact label="Ating." value={formatPercent(indicator.attainment)} />
                </div>
                <p className="mt-3 line-clamp-2 break-words text-xs text-muted-foreground">
                  {indicator.rootCause ?? indicator.actionTitle ?? (indicator.validationIssues[0] ?? 'Sem comentário consolidado.')}
                </p>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateMeetingDialog({
  open,
  onOpenChange,
  options,
  periodRef,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options?: MonthlyOptions;
  periodRef: string;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState(() => buildDefaultForm(periodRef));

  useEffect(() => {
    if (open) setForm(buildDefaultForm(periodRef));
  }, [open, periodRef]);

  useEffect(() => {
    if (!open || !options || form.areaIds.length) return;
    const ssma = options.areaOptions.find((area) => normalize(area.name).includes('SSMA'));
    if (ssma) setForm((current) => ({ ...current, areaIds: [ssma.id] }));
  }, [open, options, form.areaIds.length]);

  const create = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/monthly-results/meetings', {
        method: 'POST',
        json: { ...form, endsAt: form.endsAt || undefined },
      }),
    onSuccess: (result) => {
      toast.success('Reunião mensal criada');
      onCreated(result.id);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function toggleArea(areaId: string) {
    setForm((current) => ({
      ...current,
      areaIds: current.areaIds.includes(areaId) ? current.areaIds.filter((id) => id !== areaId) : [...current.areaIds, areaId],
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova reunião mensal de resultados</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Título" className="md:col-span-2">
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </Field>
            <Field label="Mês de referência">
              <Input type="month" value={form.periodRef} onChange={(event) => setForm({ ...form, periodRef: event.target.value })} />
            </Field>
            <Field label="Safra / exercício">
              <Input value={form.cropSeason} onChange={(event) => setForm({ ...form, cropSeason: event.target.value })} />
            </Field>
            <Field label="Início">
              <Input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} />
            </Field>
            <Field label="Fim">
              <Input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} />
            </Field>
            <Field label="Local ou link">
              <Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
            </Field>
            <Field label="Formato">
              <NativeSelect value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value })}>
                <option value="HYBRID">Híbrida</option>
                <option value="ONLINE">Online</option>
                <option value="PRESENTIAL">Presencial</option>
              </NativeSelect>
            </Field>
            <Field label="Responsável">
              <UserSelect options={options} value={form.responsibleUserId} onChange={(value) => setForm({ ...form, responsibleUserId: value })} />
            </Field>
            <Field label="Secretário / ata">
              <UserSelect options={options} value={form.secretaryUserId} onChange={(value) => setForm({ ...form, secretaryUserId: value })} />
            </Field>
            <Field label="Objetivo" className="md:col-span-2">
              <Textarea rows={2} value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} />
            </Field>
          </div>

          <div>
            <Label>Áreas participantes</Label>
            <div className="mt-2 grid max-h-60 grid-cols-1 gap-1 overflow-auto rounded-md border p-3 md:grid-cols-2">
              {options?.areaOptions.map((area) => (
                <label key={area.id} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                  <input type="checkbox" checked={form.areaIds.includes(area.id)} onChange={() => toggleArea(area.id)} className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">{area.name}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Os indicadores de cada área são copiados como snapshot do mês ao criar a reunião.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => create.mutate()} disabled={!form.title || !form.startsAt || !form.areaIds.length || create.isPending}>
            <Plus className="mr-2 h-4 w-4" />
            Criar reunião
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildDefaultForm(periodRef: string) {
  return {
    title: `Reunião Mensal de Resultados — ${periodRefLabel(periodRef)}`,
    periodRef,
    cropSeason: '',
    cycleName: 'Fechamento mensal',
    startsAt: new Date().toISOString().slice(0, 16),
    endsAt: '',
    location: '',
    format: 'HYBRID',
    responsibleUserId: '',
    secretaryUserId: '',
    objective: 'Fechar resultados do mês, validar desvios, decidir prioridades e acionar o acompanhamento semanal.',
    areaIds: [] as string[],
  };
}

function UserSelect({ options, value, onChange }: { options?: MonthlyOptions; value: string; onChange: (value: string) => void }) {
  return (
    <NativeSelect value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Selecione</option>
      {options?.users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.name}
        </option>
      ))}
    </NativeSelect>
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

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium">{value}</p>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  PREPARING: 'Em preparação',
  READY: 'Pronta',
  IN_PROGRESS: 'Em andamento',
  CLOSED: 'Encerrada',
  REOPENED: 'Reaberta',
  CANCELLED: 'Cancelada',
};

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

export type { Light };
