'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '@/components/platform/empty-state';
import { STAGE_TYPE, labelOf } from '@/lib/recruitment/labels';

// Paleta do design system (skill dataviz): ordem categórica fixa + rampa sequencial azul.
const CATEGORICAL = ['#2a78d6', '#008300', '#e87ba4', '#eda100', '#1baf7a', '#eb6834', '#4a3aa7', '#e34948'];
const SEQUENTIAL_ORDINAL = ['#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95'];
const SINGLE_HUE = '#256abf';

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-background p-2 text-xs shadow-md">
      <div className="font-medium">{label}</div>
      <div className="text-muted-foreground">{payload[0].value} candidatura(s)</div>
    </div>
  );
}

/** Funil por tipo de etapa (cross-vaga, já que cada template pode ter nomes próprios). Rampa sequencial ordinal — estágios em ordem. */
export function StageFunnelChart({ data }: { data: Array<{ stageType: string; count: number }> }) {
  if (!data.length) return <EmptyState title="Sem candidaturas ativas" description="Nenhuma candidatura em andamento no momento." />;
  const chartData = data.map((d) => ({ name: labelOf(STAGE_TYPE, d.stageType), value: d.count }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e0d9" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(37,106,191,0.08)' }} />
        <Bar dataKey="value" name="Candidaturas" radius={[4, 4, 0, 0]}>
          {chartData.map((_, idx) => (
            <Cell key={idx} fill={SEQUENTIAL_ORDINAL[Math.min(idx, SEQUENTIAL_ORDINAL.length - 1)]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Origem da candidatura — identidade (categórica, ordem fixa). */
export function SourceBreakdownChart({ data }: { data: Array<{ source: string; count: number; hired: number }> }) {
  if (!data.length) return <EmptyState title="Sem candidaturas no período" />;
  const chartData = data.slice(0, 8).map((d) => ({ name: d.source, value: d.count, hired: d.hired }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e0d9" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Bar dataKey="value" name="Candidaturas" radius={[4, 4, 0, 0]}>
          {chartData.map((_, idx) => (
            <Cell key={idx} fill={CATEGORICAL[idx % CATEGORICAL.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Rejeição por etapa — magnitude (uma cor só; nomes de etapa variam por vaga, não são identidades comparáveis). */
export function RejectionByStageChart({ data }: { data: Array<{ stageName: string; count: number }> }) {
  if (!data.length) return <EmptyState title="Sem rejeições no período" description="Nenhuma candidatura foi rejeitada nesse intervalo." />;
  const chartData = data.slice(0, 8).map((d) => ({ name: d.stageName, value: d.count }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e1e0d9" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(211,59,59,0.06)' }} />
        <Bar dataKey="value" name="Rejeições" fill={SINGLE_HUE} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
