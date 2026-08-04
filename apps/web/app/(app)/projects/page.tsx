'use client';

/**
 * ATA INTEGRADA da Reunião Mensal.
 *
 * Ocupa o lugar da antiga tela de Cronogramas. Não é um cadastro novo: mostra as
 * ações que SAÍRAM da reunião mensal (decisões, planos dos indicadores
 * apresentados e escalonamentos) organizadas como a ata é cobrada em campo —
 * por área, setor e responsável. Clicar na ação abre a curva S do avanço.
 */

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Loader2,
  Search,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { EmptyState } from '@/components/platform/empty-state';
import { LoadingState } from '@/components/platform/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { ActionCurveDialog } from '@/components/platform/action-curve-dialog';

type MinuteState = 'NAO_INICIADA' | 'EM_ANDAMENTO' | 'ENCERRADA' | 'CANCELADA';
type MinuteSource = 'DA_AREA' | 'SAIDA_REUNIAO';

export interface MinuteAction {
  id: string;
  title: string;
  status: string;
  state: MinuteState;
  source: MinuteSource;
  sourceDetail: string | null;
  overdue: boolean;
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  responsible: { id: string; name: string } | null;
  areaMacro: { id: string; name: string } | null;
  areaMicro: { id: string; name: string } | null;
  origin: string;
  indicator: { id: string; name: string; code: string | null } | null;
  deviation: { id: string; number: number; title: string } | null;
  meeting: { id: string; title: string; periodRef: string } | null;
  taskCount: number;
  taskDone: number;
  links: { action: string; indicator: string | null; deviation: string | null };
}

interface MinuteSummary {
  total: number;
  closed: number;
  inProgress: number;
  notStarted: number;
  cancelled: number;
  overdue: number;
  avgProgress: number;
}

interface MinutesResponse {
  meetings: Array<{ id: string; title: string; periodRef: string }>;
  summary: MinuteSummary;
  bySource: Record<MinuteSource, MinuteSummary>;
  areas: Array<{
    id: string;
    name: string;
    summary: MinuteSummary;
    sectors: Array<{
      id: string;
      name: string;
      owners: Array<{ id: string; name: string; actions: MinuteAction[] }>;
    }>;
  }>;
}

const STATE_LABEL: Record<MinuteState, string> = {
  NAO_INICIADA: 'Não iniciada',
  EM_ANDAMENTO: 'Em andamento',
  ENCERRADA: 'Encerrada',
  CANCELADA: 'Cancelada',
};

const STATE_CLASS: Record<MinuteState, string> = {
  NAO_INICIADA: 'border-slate-200 bg-slate-50 text-slate-700',
  EM_ANDAMENTO: 'border-blue-200 bg-blue-50 text-blue-700',
  ENCERRADA: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELADA: 'border-slate-200 bg-slate-100 text-slate-500',
};

const SOURCE_LABEL: Record<MinuteSource, string> = {
  DA_AREA: 'Plano da área',
  SAIDA_REUNIAO: 'Saída da reunião',
};

const SOURCE_CLASS: Record<MinuteSource, string> = {
  DA_AREA: 'border-slate-300 bg-slate-50 text-slate-700',
  SAIDA_REUNIAO: 'border-violet-200 bg-violet-50 text-violet-700',
};

const SOURCE_HINT: Record<MinuteSource, string> = {
  DA_AREA: 'Plano que a área já tinha e levou à reunião para prestar contas.',
  SAIDA_REUNIAO: 'Ação decidida no próprio fórum: decisão, escalonamento ou plano aberto durante a apresentação.',
};

export default function MeetingMinutesPage() {
  const [meetingId, setMeetingId] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [source, setSource] = useState<'' | MinuteSource>('');
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [curveActionId, setCurveActionId] = useState<string | null>(null);

  const meetings = useQuery({
    queryKey: ['minutes', 'meetings'],
    queryFn: () => api<Array<{ id: string; title: string; periodRef: string; status: string }>>('/monthly-results/minutes/meetings'),
  });

  const minutes = useQuery<MinutesResponse>({
    queryKey: ['minutes', meetingId, onlyOpen, source],
    queryFn: () =>
      api<MinutesResponse>(
        `/monthly-results/minutes?${new URLSearchParams({
          ...(meetingId ? { meetingId } : {}),
          ...(onlyOpen ? { onlyOpen: '1' } : {}),
          ...(source ? { source } : {}),
        }).toString()}`,
      ),
  });

  const term = search.trim().toLowerCase();
  const areas = useMemo(() => {
    const rows = minutes.data?.areas ?? [];
    if (!term) return rows;
    return rows
      .map((area) => ({
        ...area,
        sectors: area.sectors
          .map((sector) => ({
            ...sector,
            owners: sector.owners
              .map((owner) => ({
                ...owner,
                actions: owner.actions.filter(
                  (action) =>
                    action.title.toLowerCase().includes(term) ||
                    owner.name.toLowerCase().includes(term) ||
                    (action.indicator?.name ?? '').toLowerCase().includes(term),
                ),
              }))
              .filter((owner) => owner.actions.length > 0),
          }))
          .filter((sector) => sector.owners.length > 0),
      }))
      .filter((area) => area.sectors.length > 0);
  }, [minutes.data, term]);

  const summary = minutes.data?.summary;
  const toggle = (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div>
      <PageHeader
        eyebrow="Gestão à Vista"
        tone="view"
        title="Ata da Reunião Mensal"
        description="Acompanhamento das ações que saíram da reunião — por área, setor e responsável, com prazo e situação de cada uma."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Gestão à Vista' }, { label: 'Ata da Reunião' }]}
        actions={
          <Button asChild variant="outline">
            <Link href="/monthly-results">
              <ExternalLink className="mr-2 h-4 w-4" />
              Reunião Mensal
            </Link>
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard compact title="Ações da ata" value={formatNumber(summary?.total ?? 0)} description={`${formatNumber(summary?.closed ?? 0)} encerradas`} icon={<ClipboardList className="h-4 w-4" />} tone="blue" />
        <MetricCard compact title="Em andamento" value={formatNumber(summary?.inProgress ?? 0)} description={`${formatNumber(summary?.notStarted ?? 0)} não iniciadas`} icon={<Loader2 className="h-4 w-4" />} tone="purple" />
        <MetricCard compact title="Atrasadas" value={formatNumber(summary?.overdue ?? 0)} description="Prazo vencido e ainda abertas" icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <MetricCard compact title="Avanço médio" value={`${formatNumber(summary?.avgProgress ?? 0)}%`} description="Das ações ainda abertas" icon={<TrendingUp className="h-4 w-4" />} tone="green" />
      </div>

      {/* Os dois tipos de ação que a reunião trata de forma diferente. Clicar
          filtra a ata inteira pelo tipo. */}
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {(['DA_AREA', 'SAIDA_REUNIAO'] as const).map((key) => {
          const stats = minutes.data?.bySource?.[key];
          const selected = source === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSource(selected ? '' : key)}
              title={SOURCE_HINT[key]}
              className={cn(
                'panel p-4 text-left transition-colors hover:bg-accent/25',
                selected && 'border-primary/50 bg-primary/5',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className={cn('text-[10px]', SOURCE_CLASS[key])}>{SOURCE_LABEL[key]}</Badge>
                  <span className="text-lg font-semibold tabular-nums">{formatNumber(stats?.total ?? 0)}</span>
                  <span className="text-xs text-muted-foreground">ação(ões)</span>
                </span>
                <span className="text-xs text-muted-foreground">{selected ? 'filtrando — clique para limpar' : 'clique para filtrar'}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{formatNumber(stats?.closed ?? 0)} encerradas</span>
                <span>{formatNumber(stats?.inProgress ?? 0)} em andamento</span>
                <span className={cn((stats?.overdue ?? 0) > 0 && 'font-medium text-red-600')}>
                  {formatNumber(stats?.overdue ?? 0)} atrasadas
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{SOURCE_HINT[key]}</p>
            </button>
          );
        })}
      </div>

      <section className="panel mb-6 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[240px] flex-1">
            <Label htmlFor="minutes-search">Buscar</Label>
            <div className="relative mt-1.5">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="minutes-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ação, responsável ou indicador..."
                className="pl-9"
              />
            </div>
          </div>
          <div className="min-w-[240px]">
            <Label htmlFor="minutes-meeting">Reunião</Label>
            <NativeSelect id="minutes-meeting" className="mt-1.5" value={meetingId} onChange={(event) => setMeetingId(event.target.value)}>
              <option value="">Últimas reuniões</option>
              {(meetings.data ?? []).map((meeting) => (
                <option key={meeting.id} value={meeting.id}>
                  {meeting.periodRef} · {meeting.title}
                </option>
              ))}
            </NativeSelect>
          </div>
          <label className="flex h-10 items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" className="h-3.5 w-3.5" checked={onlyOpen} onChange={(event) => setOnlyOpen(event.target.checked)} />
            Somente pendentes
          </label>
        </div>
      </section>

      {minutes.isLoading && <LoadingState />}

      {!minutes.isLoading && areas.length === 0 && (
        <EmptyState
          title="Nenhuma ação na ata"
          description="Assim que a reunião mensal gerar decisões, planos de ação nos indicadores ou escalonamentos, eles aparecem aqui organizados por área."
          action={
            <Button asChild variant="outline">
              <Link href="/monthly-results">Abrir a Reunião Mensal</Link>
            </Button>
          }
        />
      )}

      <div className="space-y-4">
        {areas.map((area) => {
          const areaClosed = collapsed[area.id];
          return (
            <section key={area.id} className="panel overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(area.id)}
                className="flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-accent/30"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {areaClosed ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                  <span className="truncate text-sm font-semibold">{area.name}</span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{formatNumber(area.summary.total)} ação(ões)</Badge>
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-1.5 text-[11px]">
                  {area.summary.overdue > 0 && (
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">{formatNumber(area.summary.overdue)} atrasada(s)</Badge>
                  )}
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{formatNumber(area.summary.closed)} encerrada(s)</Badge>
                </span>
              </button>

              {!areaClosed && (
                <div className="divide-y">
                  {area.sectors.map((sector) => (
                    <div key={sector.id} className="px-4 py-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {sector.name}
                      </div>

                      {sector.owners.map((owner) => (
                        <div key={owner.id} className="mb-4 last:mb-0">
                          <div className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                            {owner.name}
                            <span className="text-xs font-normal text-muted-foreground">
                              {formatNumber(owner.actions.length)} ação(ões)
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="table-modern min-w-[1000px]">
                              <thead>
                                <tr>
                                  <th className="text-left">Ação</th>
                                  <th className="text-left">Tipo</th>
                                  <th className="text-left">Previsão de início</th>
                                  <th className="text-left">Previsão de fim</th>
                                  <th className="text-left">Avanço</th>
                                  <th className="text-left">Status</th>
                                  <th className="text-left">Curva S</th>
                                </tr>
                              </thead>
                              <tbody>
                                {owner.actions.map((action) => (
                                  <tr
                                    key={action.id}
                                    className="cursor-pointer transition-colors hover:bg-accent/30"
                                    onClick={() => setCurveActionId(action.id)}
                                    title="Ver curva S desta ação"
                                  >
                                    <td>
                                      <div className="font-medium">{action.title}</div>
                                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                                        {action.indicator && <span>Indicador: {action.indicator.name}</span>}
                                        {action.deviation && <span>Desvio #{formatNumber(action.deviation.number)}</span>}
                                        {action.meeting && <span>{action.meeting.periodRef}</span>}
                                      </div>
                                    </td>
                                    <td>
                                      <Badge variant="outline" className={cn('whitespace-nowrap text-[10px]', SOURCE_CLASS[action.source])} title={SOURCE_HINT[action.source]}>
                                        {SOURCE_LABEL[action.source]}
                                      </Badge>
                                      {action.sourceDetail && (
                                        <div className="mt-0.5 max-w-[160px] truncate text-[10px] text-muted-foreground" title={action.sourceDetail}>
                                          {action.sourceDetail}
                                        </div>
                                      )}
                                    </td>
                                    <td className="text-xs">{action.startDate ? formatDate(action.startDate) : '—'}</td>
                                    <td className="text-xs">
                                      <span className={cn(action.overdue && 'font-semibold text-red-600')}>
                                        {action.dueDate ? formatDate(action.dueDate) : '—'}
                                      </span>
                                      {action.overdue && <div className="text-[10px] text-red-600">em atraso</div>}
                                    </td>
                                    <td className="min-w-[120px]">
                                      <div className="flex items-center gap-2">
                                        <Progress value={action.progress} className="h-1.5 w-16" />
                                        <span className="text-xs tabular-nums">{formatNumber(action.progress)}%</span>
                                      </div>
                                      {action.taskCount > 0 && (
                                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                                          {formatNumber(action.taskDone)}/{formatNumber(action.taskCount)} tarefas
                                        </div>
                                      )}
                                    </td>
                                    <td>
                                      <Badge variant="outline" className={cn('text-[10px]', STATE_CLASS[action.state])}>
                                        {action.state === 'ENCERRADA' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                                        {STATE_LABEL[action.state]}
                                      </Badge>
                                    </td>
                                    <td>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 gap-1.5 px-2 text-xs"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setCurveActionId(action.id);
                                        }}
                                      >
                                        <CalendarClock className="h-3.5 w-3.5" />
                                        Ver curva
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <ActionCurveDialog actionId={curveActionId} onOpenChange={(open) => !open && setCurveActionId(null)} />
    </div>
  );
}
