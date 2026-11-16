'use client';

import type { ReactNode } from 'react';
import type { ProjectCurve as ProjectCurveData } from '@g360/shared';
import { CartesianGrid, ComposedChart, Legend, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { downloadCsv } from '@/lib/compensation/format';
import { cn, formatNumber } from '@/lib/utils';

const dateLabel = (value: number | string) => new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC',
}).format(new Date(value));

export function ProjectCurve({
  curve,
  progress,
  expectedProgress,
  title = 'Curva S do projeto',
  fileName = 'curva-s-projeto.csv',
  id = 'curva-s',
  note,
}: {
  curve: ProjectCurveData;
  progress: number;
  expectedProgress: number | null;
  title?: string;
  fileName?: string;
  id?: string;
  /** Substitui a explicação padrão (regra de um projeto) exibida abaixo do gráfico. */
  note?: ReactNode;
}) {
  const delta = expectedProgress === null ? null : progress - expectedProgress;
  const data = curve.points.map((point) => ({ ...point, time: Date.parse(point.date) }));
  const recordedPoints = data.filter((point) => point.actual !== null && point.date >= (curve.historyStartsOn ?? curve.measuredOn));
  const latestActual = recordedPoints[recordedPoints.length - 1];
  const actualColor = delta !== null && delta < 0 ? '#ef4444' : '#10b981';
  return (
    <Card className="mb-6" id={id}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> {title}</CardTitle>
        <Button size="sm" variant="outline" onClick={() => downloadCsv(fileName, [
          ['Data', 'Planejado (%)', 'Realizado (%)'],
          ...curve.points.map((point) => [point.date.slice(0, 10), point.planned ?? '', point.actual ?? '']),
        ])}><Download className="mr-2 h-4 w-4" /> Exportar curva</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Realizado" value={`${formatNumber(progress)}%`} />
          <Metric label="Planejado até hoje" value={expectedProgress === null ? 'Sem cronograma' : `${formatNumber(expectedProgress)}%`} />
          <Metric label="Diferença" value={delta === null ? '—' : `${delta > 0 ? '+' : ''}${formatNumber(delta)} p.p.`} tone={delta === null ? undefined : delta < 0 ? 'text-status-red' : 'text-status-green'} />
        </div>
        <div className="h-72 w-full" role="img" aria-label={`Curva de avanço do projeto. Realizado: ${progress}%. Planejado: ${expectedProgress === null ? 'sem cronograma' : `${expectedProgress}%`}.`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 18, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} padding={{ left: 20, right: 48 }} tickFormatter={dateLabel} tick={{ fontSize: 11 }} minTickGap={30} />
              <YAxis domain={[0, 100]} padding={{ top: 10, bottom: 10 }} unit="%" width={45} tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(value) => dateLabel(value as number)} formatter={(value: number, name: string) => [`${formatNumber(value)}%`, name]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine x={Date.parse(curve.measuredOn)} stroke="#64748b" strokeDasharray="3 3" label={{ value: 'Hoje', position: 'insideTopRight', fontSize: 11 }} />
              <Line dataKey="planned" name="Planejado" type="linear" stroke="#1e3a8a" strokeDasharray="6 4" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="actual" name="Realizado" type="stepAfter" stroke={actualColor} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
              {latestActual && (
                <ReferenceDot
                  x={latestActual.time}
                  y={latestActual.actual!}
                  r={6}
                  fill={actualColor}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                  ifOverflow="visible"
                  label={{ value: `Realizado: ${formatNumber(latestActual.actual)}%`, position: delta !== null && delta < 0 && (latestActual.actual ?? 0) > 10 ? 'bottom' : 'top', offset: 10, fill: actualColor, fontSize: 11 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {recordedPoints.length === 1 && latestActual && (
          <p className="rounded-lg border border-border/70 bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            Primeira medição do Realizado: {formatNumber(latestActual.actual)}% em {dateLabel(latestActual.time)}, destacada no gráfico.
            {' '}As medições dos próximos dias formarão a linha de evolução do Realizado.
          </p>
        )}
        {note ?? <p className="text-xs text-muted-foreground">
          Planejado pelos prazos das tarefas e dos marcos; quando ambos existem, cada grupo representa metade do avanço.
          Sem tarefas nem marcos, o planejado segue as datas do projeto.
          {' '}O realizado guarda a última medição de cada dia e mantém esse valor até a próxima atualização.
          {curve.historyStartsOn ? ` Histórico disponível desde ${dateLabel(curve.historyStartsOn)}.` : ' O histórico começa com a primeira atualização.'}
          {' '}Alterar o cronograma recalcula o planejado; medições passadas do realizado são preservadas.
        </p>}
        {!curve.hasSchedule && <p className="text-sm text-muted-foreground">Preencha as datas do projeto ou de todas as tarefas para comparar o avanço com o planejado.</p>}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <div className="rounded-md border p-3"><div className="text-[11px] uppercase text-muted-foreground">{label}</div><div className={cn('mt-1 font-semibold tabular-nums', tone)}>{value}</div></div>;
}
