'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowLeft, AlertTriangle, Network, ScrollText, Calendar } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/shell/page-header';
import { StatusLight } from '@/components/ui/status-light';
import { StatusBadge } from '@/components/platform/status-badge';
import { api } from '@/lib/api';
import { formatNumber, formatPercent, periodRefLabel } from '@/lib/utils';
import { PERIODICITY_LABEL, DIRECTION_LABEL, ACTION_STATUS_LABEL, MEETING_STATUS_LABEL, TRACE_EVENT_LABEL } from '@/lib/labels';

interface IndicatorDetail {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  type: string;
  unit: string;
  unitLabel: string | null;
  periodicity: string;
  direction: string;
  status: string;
  company?: { id: string; name: string } | null;
  ownerNode: { id: string; name: string; type: string; parent?: { id: string; name: string; type: string } | null };
  areaMacro?: { id: string; name: string; type: string } | null;
  areaMicro?: { id: string; name: string; type: string } | null;
  guidelineNode?: { id: string; name: string; type: string } | null;
  responsibleUser: { id: string; name: string } | null;
  strategicObjective?: { id: string; name: string; perspective?: { id: string; name: string; color: string } | null } | null;
  targets: { periodRef: string; target: number }[];
  results: {
    id: string;
    periodRef: string;
    value: number;
    light: string;
    attainment: number | null;
    deviationPct: number | null;
    note: string | null;
    createdAt: string;
    updatedAt: string;
    createdBy?: { id: string; name: string } | null;
  }[];
  actions?: { id: string; title: string; status: string; dueDate: string | null }[] | null;
  meetings?: { id: string; title: string; status: string; startsAt: string | null }[] | null;
}

interface SeriesPoint {
  periodRef: string;
  target: number | null;
  value: number | null;
  light: string;
}

interface TraceEvent {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  title: string;
  description: string | null;
  statusFrom?: string | null;
  statusTo?: string | null;
  occurredAt: string;
  user: { id: string; name: string; email?: string } | null;
  metadata?: unknown;
}

interface TraceabilityTimeline {
  events: TraceEvent[];
}

interface AuditLogEntry {
  id: string;
  action: string;
  recordLabel: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

const STATUS_LABEL = ACTION_STATUS_LABEL;

export default function IndicatorDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [auditOpen, setAuditOpen] = useState(false);

  const detail = useQuery<IndicatorDetail>({
    queryKey: ['indicator', id],
    queryFn: () => api<IndicatorDetail>(`/indicators/${id}`),
  });

  const series = useQuery<SeriesPoint[]>({
    queryKey: ['indicator', id, 'series'],
    queryFn: () => api<SeriesPoint[]>(`/indicators/${id}/series?points=12`),
  });
  const timeline = useQuery<TraceabilityTimeline>({
    queryKey: ['traceability', 'indicator', id],
    queryFn: () => api<TraceabilityTimeline>(`/traceability/indicators/${id}`),
  });
  const lastResult = detail.data?.results[detail.data.results.length - 1];

  const auditLog = useQuery<{ logs: AuditLogEntry[] }>({
    queryKey: ['indicator', id, 'history'],
    enabled: auditOpen,
    queryFn: () => api<{ logs: AuditLogEntry[] }>(`/indicators/${id}/history`),
  });

  const last = lastResult;

  const openDeviation = useMutation({
    mutationFn: () =>
      api<{ id: string; number: number }>('/deviations', {
        method: 'POST',
        json: {
          indicatorId: id,
          periodRef: last?.periodRef,
          severity: 'CRITICAL',
        },
      }),
    onSuccess: (d) => toast.success(`Desvio #${d.number} aberto`),
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao abrir desvio'),
  });

  if (detail.isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!detail.data) return null;
  const ind = detail.data;

  const chartData = (series.data ?? []).map((p) => ({
    label: periodRefLabel(p.periodRef),
    target: p.target,
    value: p.value,
  }));

  return (
    <div>
      <Link href="/indicators" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para indicadores
      </Link>

      <PageHeader
        title={ind.name}
        description={ind.description ?? `${ind.ownerNode?.name ?? '-'} - ${ind.code ?? '-'}`}
        actions={
          last?.light === 'RED' && (
            <Button variant="destructive" onClick={() => openDeviation.mutate()} disabled={openDeviation.isPending || !last?.id}>
              <AlertTriangle className="mr-2 h-4 w-4" />
              {openDeviation.isPending ? 'Abrindo...' : 'Abrir análise de causa'}
            </Button>
          )
        }
      />

      {/* Fluxo Lógico e Rastreabilidade Superior */}
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border bg-card/45 p-3 text-xs shadow-sm backdrop-blur-sm">
        <span className="font-semibold text-muted-foreground">Hierarquia integrada:</span>
        <span className="font-medium text-foreground">{ind.company?.name ?? 'Empresa'}</span>
        <span className="text-muted-foreground/60">&rarr;</span>
        <span className="font-medium text-foreground">{ind.areaMacro?.name ?? 'Sem Área'}</span>
        {ind.areaMicro && (
          <>
            <span className="text-muted-foreground/60">&rarr;</span>
            <span className="font-medium text-foreground">{ind.areaMicro.name}</span>
          </>
        )}
        {ind.ownerNode?.type === 'UNIT' && (
          <>
            <span className="text-muted-foreground/60">&rarr;</span>
            <span className="font-medium text-foreground">Pilar: {ind.ownerNode.name}</span>
          </>
        )}
        {ind.guidelineNode && (
          <>
            <span className="text-muted-foreground/60">&rarr;</span>
            <span className="font-medium text-foreground">Diretriz: {ind.guidelineNode.name}</span>
          </>
        )}
        {ind.strategicObjective && (
          <>
            <span className="text-muted-foreground/60">&rarr;</span>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
              Objetivo Estratégico: {ind.strategicObjective.name}
            </span>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Realizado atual</div>
            <div className="text-2xl font-semibold mt-1">{last ? formatNumber(last.value) : '-'}</div>
            <div className="text-xs text-muted-foreground">{last ? periodRefLabel(last.periodRef) : ''}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Atingimento</div>
            <div className="text-2xl font-semibold mt-1">{formatPercent(last?.attainment ?? null)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Status</div>
            <div className="mt-2">
              <StatusLight light={last?.light ?? 'GRAY'} size="md" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Periodicidade</div>
            <div className="text-2xl font-semibold mt-1">{PERIODICITY_LABEL[ind.periodicity] ?? ind.periodicity}</div>
            <div className="text-xs text-muted-foreground">Direção: {DIRECTION_LABEL[ind.direction] ?? ind.direction}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Evolução (12 períodos)</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              />
              <Line type="monotone" dataKey="target" stroke="#1e3a8a" strokeDasharray="5 5" strokeWidth={2.5} dot={false} name="Meta" />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--status-blue))"
                strokeWidth={2.5}
                dot={(dotProps: any) => {
                  const { cx, cy, payload, index } = dotProps;
                  if (payload.value === null || payload.value === undefined) {
                    return <circle key={`dot-${index}`} cx={cx} cy={cy} r={0} fill="transparent" />;
                  }
                  const isWithin = ind.direction === 'LOWER_BETTER'
                    ? (payload.value ?? 0) <= (payload.target ?? 0)
                    : (payload.value ?? 0) >= (payload.target ?? 0);
                  const color = isWithin ? '#10b981' : '#ef4444';
                  return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4.5} fill={color} stroke={color} />;
                }}
                name="Realizado"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Blocos de Ações e Reuniões Relacionados */}
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b">
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-primary" />
              Planos de Ação Relacionados ({ind.actions?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {(!ind.actions || ind.actions.length === 0) ? (
              <p className="text-xs text-muted-foreground py-2">Nenhum plano de ação vinculado a este indicador.</p>
            ) : (
              <div className="divide-y divide-border">
                {ind.actions.map((act) => (
                  <div key={act.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                    <div className="min-w-0">
                      <Link href={`/actions/${act.id}`} className="font-semibold hover:underline block truncate text-foreground">
                        {act.title}
                      </Link>
                      <span className="text-muted-foreground block mt-0.5">Prazo: {act.dueDate ? new Date(act.dueDate).toLocaleDateString('pt-BR') : 'Sem prazo'}</span>
                    </div>
                    <StatusBadge value={act.status} label={STATUS_LABEL[act.status] ?? act.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b">
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Reuniões de Alinhamento ({ind.meetings?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {(!ind.meetings || ind.meetings.length === 0) ? (
              <p className="text-xs text-muted-foreground py-2">Nenhuma reunião vinculada a este indicador.</p>
            ) : (
              <div className="divide-y divide-border">
                {ind.meetings.map((meet) => (
                  <div key={meet.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                    <div className="min-w-0">
                      <Link href={`/meetings/${meet.id}`} className="font-semibold hover:underline block truncate text-foreground">
                        {meet.title}
                      </Link>
                      <span className="text-muted-foreground block mt-0.5">Agendada para: {meet.startsAt ? new Date(meet.startsAt).toLocaleString('pt-BR') : 'Sem data'}</span>
                    </div>
                    <StatusBadge value={meet.status} label={MEETING_STATUS_LABEL[meet.status] ?? meet.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr,420px]">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Próximos passos sugeridos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 pt-0">
            <Button variant="outline" size="sm" asChild>
              <Link href="/org">
                <Network className="mr-1.5 h-4 w-4" />
                Ver na árvore
              </Link>
            </Button>
            <Button
              variant={last?.light === 'RED' ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => openDeviation.mutate()}
              disabled={!last || last.light !== 'RED' || openDeviation.isPending}
            >
              <AlertTriangle className="mr-1.5 h-4 w-4" />
              Abrir análise de causa
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/meetings">
                <ScrollText className="mr-1.5 h-4 w-4" />
                Registrar reunião
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
            <CardTitle className="text-sm">Linha de rastreabilidade</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setAuditOpen(true)}>
              <ScrollText className="mr-1.5 h-3.5 w-3.5" />
              Auditoria completa
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {timeline.isLoading && <p className="text-sm text-muted-foreground">Carregando histórico...</p>}
            {!timeline.isLoading && (timeline.data?.events.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum evento registrado para este indicador.</p>
            )}
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {timeline.data?.events.map((event) => (
                <Link
                  key={event.id}
                  href={eventHref(event)}
                  className="block rounded-lg border p-3 transition-colors hover:bg-accent/35"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{event.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(event.occurredAt).toLocaleString('pt-BR')} - {event.user?.name ?? 'Sistema'}
                      </div>
                    </div>
                    <StatusBadge value={event.statusTo ?? event.eventType} label={shortEventLabel(event.eventType)} />
                  </div>
                  {event.description && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{event.description}</p>
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-row items-center justify-between">
            <CardTitle>Histórico de lançamentos</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setAuditOpen(true)}>
              <ScrollText className="mr-1.5 h-3.5 w-3.5" />
              Auditoria completa
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase">
                  <th className="px-4 py-2 font-medium">Período</th>
                  <th className="px-4 py-2 font-medium text-right">Meta</th>
                  <th className="px-4 py-2 font-medium text-right">Realizado</th>
                  <th className="px-4 py-2 font-medium text-right">Desvio %</th>
                  <th className="px-4 py-2 font-medium text-right">Atingim.</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Lançado por</th>
                  <th className="px-4 py-2 font-medium">Atualizado em</th>
                  <th className="px-4 py-2 font-medium">Observação</th>
                </tr>
              </thead>
              <tbody>
                {ind.results
                  .slice()
                  .reverse()
                  .map((r) => {
                    const t = ind.targets.find((x) => x.periodRef === r.periodRef);
                    return (
                      <tr key={r.id} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-2 font-medium">{periodRefLabel(r.periodRef)}</td>
                        <td className="px-4 py-2 text-right">{t ? formatNumber(t.target) : '-'}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatNumber(r.value)}</td>
                        <td className="px-4 py-2 text-right">
                          {r.deviationPct !== null
                            ? `${r.deviationPct > 0 ? '+' : ''}${formatNumber(r.deviationPct, { maximumFractionDigits: 1 })}%`
                            : '-'}
                        </td>
                        <td className="px-4 py-2 text-right">{formatPercent(r.attainment)}</td>
                        <td className="px-4 py-2">
                          <StatusLight light={r.light} />
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{r.createdBy?.name ?? 'Sistema'}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {r.updatedAt ? new Date(r.updatedAt).toLocaleString('pt-BR') : '-'}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground max-w-[260px] truncate" title={r.note ?? ''}>
                          {r.note ?? '-'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Auditoria completa - {ind.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {auditLog.isLoading && <p className="text-sm text-muted-foreground">Carregando auditoria...</p>}
            {!auditLog.isLoading && (auditLog.data?.logs.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum registro de auditoria encontrado.</p>
            )}
            {auditLog.data?.logs.map((log) => (
              <div key={log.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{auditActionLabel(log.action)}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString('pt-BR')} - {log.user?.name ?? 'Sistema'}
                  </div>
                </div>
                {log.recordLabel && <p className="mt-1 text-sm text-muted-foreground">{log.recordLabel}</p>}
                {(log.beforeValue || log.afterValue) && (
                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                    {log.beforeValue && (
                      <div className="rounded border bg-muted/30 p-2">
                        <div className="font-semibold text-muted-foreground">Antes</div>
                        <pre className="mt-1 whitespace-pre-wrap break-words text-[11px]">{log.beforeValue}</pre>
                      </div>
                    )}
                    {log.afterValue && (
                      <div className="rounded border bg-muted/30 p-2">
                        <div className="font-semibold text-muted-foreground">Depois</div>
                        <pre className="mt-1 whitespace-pre-wrap break-words text-[11px]">{log.afterValue}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function eventHref(event: TraceEvent) {
  if (event.entityType === 'ACTION_PLAN') return `/actions/${event.entityId}`;
  if (event.entityType === 'DEVIATION') return `/deviations/${event.entityId}`;
  if (event.entityType === 'MEETING') return `/meetings/${event.entityId}`;
  if (event.entityType === 'RISK') return `/risks?focus=${event.entityId}`;
  if (event.entityType === 'NON_CONFORMITY') return `/nonconformities?focus=${event.entityId}`;
  return '#';
}

function shortEventLabel(type: string) {
  return TRACE_EVENT_LABEL[type] ?? type;
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    CREATE: 'Criação do indicador',
    UPDATE: 'Edição cadastral',
    DELETE: 'Exclusão lógica',
    CREATE_TARGET: 'Meta criada',
    UPDATE_TARGET: 'Meta alterada',
    CREATE_RESULT: 'Lançamento de realizado',
    UPDATE_RESULT: 'Alteração de realizado',
    PERMISSION_CHANGE: 'Alteração de permissão',
  };
  return labels[action] ?? action;
}
