'use client';

import { useParams } from 'next/navigation';
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
import { ArrowLeft, AlertTriangle, Save } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shell/page-header';
import { StatusLight } from '@/components/ui/status-light';
import { Badge } from '@/components/ui/badge';
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

export default function IndicatorDetailPage() {
  const params = useParams<{ id: string }>();
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

  const last = detail.data?.results[detail.data.results.length - 1];

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
        description={ind.description ?? `${ind.ownerNode.name} - ${ind.code ?? '—'}`}
        actions={
          last?.light === 'RED' && (
            <Button
              variant="destructive"
              onClick={() => openDeviation.mutate()}
              disabled={openDeviation.isPending}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              {openDeviation.isPending ? 'Abrindo...' : 'Abrir desvio'}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Realizado atual</div>
            <div className="text-2xl font-semibold mt-1">{last ? formatNumber(last.value) : '—'}</div>
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
                      {s.target !== null ? formatNumber(s.target) : '—'}
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
                        <td className="px-4 py-2 text-right">{t ? formatNumber(t.target) : '—'}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatNumber(r.value)}</td>
                        <td className="px-4 py-2 text-right">
                          {r.deviationPct !== null
                            ? `${r.deviationPct > 0 ? '+' : ''}${formatNumber(r.deviationPct, { maximumFractionDigits: 1 })}%`
                            : '—'}
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
