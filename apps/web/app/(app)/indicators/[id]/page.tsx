'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { ArrowLeft, AlertTriangle, Network, Save, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shell/page-header';
import { StatusLight } from '@/components/ui/status-light';
import { StatusBadge } from '@/components/platform/status-badge';
import { api } from '@/lib/api';
import { formatNumber, formatPercent, periodRefLabel } from '@/lib/utils';

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
  ownerNode: { id: string; name: string; type: string };
  responsibleUser: { id: string; name: string } | null;
  targets: { periodRef: string; target: number }[];
  results: {
    id: string;
    periodRef: string;
    value: number;
    light: string;
    attainment: number | null;
    deviationPct: number | null;
  }[];
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

interface CurrentTreatment {
  id: string;
  status: string;
  periodRef: string;
  title: string;
}

export default function IndicatorDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const qc = useQueryClient();
  const [targetEdits, setTargetEdits] = useState<Record<string, string>>({});

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
  const lastForTreatment = detail.data?.results[detail.data.results.length - 1];
  const currentTreatment = useQuery<CurrentTreatment | null>({
    queryKey: ['treatment', 'indicator', id, lastForTreatment?.periodRef],
    queryFn: () => api<CurrentTreatment | null>(`/treatments/indicators/${id}/current?periodRef=${lastForTreatment?.periodRef}`),
    enabled: lastForTreatment?.light === 'RED',
  });

  const saveTarget = useMutation({
    mutationFn: ({ periodRef, target }: { periodRef: string; target: number }) =>
      api(`/indicators/${id}/targets`, {
        method: 'POST',
        json: { periodRef, target },
      }),
    onSuccess: () => {
      toast.success('Meta salva');
      setTargetEdits({});
      qc.invalidateQueries({ queryKey: ['indicator', id] });
      qc.invalidateQueries({ queryKey: ['indicator', id, 'series'] });
    },
  });

  const last = lastForTreatment;

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

  const startTreatment = useMutation({
    mutationFn: () => api<CurrentTreatment>(`/treatments/from-result/${last?.id}/start`, { method: 'POST' }),
    onSuccess: (treatment) => {
      toast.success('Tratativa iniciada');
      qc.invalidateQueries({ queryKey: ['treatment', 'indicator', id] });
      router.push(`/treatments/${treatment.id}`);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao iniciar tratativa'),
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
        description={ind.description ?? `${ind.ownerNode.name} - ${ind.code ?? '-'}`}
        actions={
          last?.light === 'RED' && (
            <>
              {currentTreatment.data ? (
                <Button variant="destructive" asChild>
                  <Link href={`/treatments/${currentTreatment.data.id}`}>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Abrir tratativa
                  </Link>
                </Button>
              ) : (
                <Button variant="destructive" onClick={() => startTreatment.mutate()} disabled={startTreatment.isPending || !last?.id}>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {startTreatment.isPending ? 'Iniciando...' : 'Iniciar tratativa'}
                </Button>
              )}
              <Button variant="outline" onClick={() => openDeviation.mutate()} disabled={openDeviation.isPending}>
                Abrir desvio manual
              </Button>
            </>
          )
        }
      />

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
            <div className="text-2xl font-semibold mt-1">{ind.periodicity}</div>
            <div className="text-xs text-muted-foreground">Direcao: {ind.direction}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Evolucao (12 periodos)</CardTitle>
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
              <Line type="monotone" dataKey="target" stroke="hsl(var(--status-gray))" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Meta" />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--status-blue))" strokeWidth={2.5} dot={{ r: 3 }} name="Realizado" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr,420px]">
        <Card>
          <CardHeader>
            <CardTitle>Proximos passos sugeridos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Button variant="outline" className="h-auto justify-start gap-3 p-4" asChild>
              <Link href="/org">
                <Network className="h-5 w-5 text-primary" />
                <span className="text-left">
                  <span className="block font-medium">Ver na arvore</span>
                  <span className="block text-xs text-muted-foreground">Area, setor e indicadores vinculados</span>
                </span>
              </Link>
            </Button>
            <Button
              variant={last?.light === 'RED' ? 'destructive' : 'outline'}
              className="h-auto justify-start gap-3 p-4"
              onClick={() => currentTreatment.data ? router.push(`/treatments/${currentTreatment.data.id}`) : startTreatment.mutate()}
              disabled={!last || (last.light !== 'RED' && !currentTreatment.data) || startTreatment.isPending}
            >
              <AlertTriangle className="h-5 w-5" />
              <span className="text-left">
                <span className="block font-medium">{currentTreatment.data ? 'Abrir tratativa' : 'Iniciar tratativa'}</span>
                <span className="block text-xs opacity-80">Analise, reuniao e plano de acao</span>
              </span>
            </Button>
            <Button variant="outline" className="h-auto justify-start gap-3 p-4" asChild>
              <Link href="/meetings">
                <ScrollText className="h-5 w-5 text-primary" />
                <span className="text-left">
                  <span className="block font-medium">Registrar reuniao</span>
                  <span className="block text-xs text-muted-foreground">Ata, decisoes e acoes</span>
                </span>
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linha de rastreabilidade</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.isLoading && <p className="text-sm text-muted-foreground">Carregando historico...</p>}
            {!timeline.isLoading && (timeline.data?.events.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum evento registrado para este indicador.</p>
            )}
            <div className="space-y-3">
              {timeline.data?.events.slice(0, 8).map((event) => (
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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Editor de metas</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Periodo</th>
                <th className="px-4 py-2 text-right">Meta atual</th>
                <th className="px-4 py-2 text-right">Nova meta</th>
                <th className="px-4 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {(series.data ?? []).map((s) => {
                const editKey = s.periodRef;
                const editVal = targetEdits[editKey] ?? '';
                return (
                  <tr key={editKey} className="border-t">
                    <td className="px-4 py-2">{periodRefLabel(s.periodRef)}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {s.target !== null ? formatNumber(s.target) : '-'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Input
                        value={editVal}
                        onChange={(e) =>
                          setTargetEdits((prev) => ({ ...prev, [editKey]: e.target.value }))
                        }
                        placeholder={s.target !== null ? String(s.target) : 'definir'}
                        className="h-8 w-28 text-right text-sm inline-block"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!editVal || saveTarget.isPending}
                        onClick={() => {
                          const v = Number(editVal.replace(',', '.'));
                          if (Number.isFinite(v)) {
                            saveTarget.mutate({ periodRef: s.periodRef, target: v });
                          }
                        }}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historico de lancamentos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-4 py-2 font-medium">Periodo</th>
                  <th className="px-4 py-2 font-medium text-right">Meta</th>
                  <th className="px-4 py-2 font-medium text-right">Realizado</th>
                  <th className="px-4 py-2 font-medium text-right">Desvio %</th>
                  <th className="px-4 py-2 font-medium text-right">Atingim.</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {ind.results
                  .slice()
                  .reverse()
                  .map((r) => {
                    const t = ind.targets.find((x) => x.periodRef === r.periodRef);
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-4 py-2">{periodRefLabel(r.periodRef)}</td>
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
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function eventHref(event: TraceEvent) {
  if (event.entityType === 'ACTION_PLAN') return `/actions/${event.entityId}`;
  if (event.entityType === 'DEVIATION') return `/deviations/${event.entityId}`;
  if (event.entityType === 'MEETING') return `/meetings/${event.entityId}`;
  return '#';
}

function shortEventLabel(type: string) {
  const labels: Record<string, string> = {
    RESULT_RECORDED: 'Resultado',
    OFF_TARGET_ALERT: 'Fora da meta',
    CREATED: 'Criado',
    CAUSE_CREATED: 'Causa',
    ANALYSIS_CREATED: 'Analise',
    ACTION_CREATED: 'Acao',
    ACTION_STATUS_CHANGED: 'Status',
    CLOSED: 'Concluido',
  };
  return labels[type] ?? type;
}
