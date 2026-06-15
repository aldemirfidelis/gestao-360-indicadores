'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import type { FitRow } from '@/lib/compensation/types';
import { compaRatioDistribution, penetrationHistogram } from '@/lib/compensation/analytics';
import { EmptyState } from '@/components/platform/empty-state';
import { formatNumber } from '@/lib/utils';

const MASKED_MESSAGE = 'Distribuicao numerica indisponivel sem permissao de salario individual.';

/** Distribuicao de colaboradores por faixa de compa-ratio. */
export function CompaRatioDistributionChart({ rows, masked }: { rows: FitRow[]; masked: boolean }) {
  if (masked) return <EmptyState title="Restrito" description={MASKED_MESSAGE} />;
  const data = compaRatioDistribution(rows);
  if (data.every((d) => d.value === 0)) return <EmptyState title="Sem dados de compa-ratio" />;
  // verde no centro (ideal ~1,0), vermelho/amarelo nas pontas
  const colors = ['#dc2626', '#ca8a04', '#16a34a', '#2563eb', '#7c3aed'];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="value" name="Colaboradores">
          {data.map((_, idx) => (
            <Cell key={idx} fill={colors[idx % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Histograma de penetracao na faixa (0-100%). */
export function PenetrationHistogram({ rows, masked }: { rows: FitRow[]; masked: boolean }) {
  if (masked) return <EmptyState title="Restrito" description={MASKED_MESSAGE} />;
  const data = penetrationHistogram(rows);
  if (data.every((d) => d.value === 0)) return <EmptyState title="Sem dados de penetracao" />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="value" name="Colaboradores" fill="#0ea5e9" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Dispersao compa-ratio (X) x penetracao na faixa (Y) por colaborador. */
export function CompaRatioScatter({ rows, masked }: { rows: FitRow[]; masked: boolean }) {
  if (masked) return <EmptyState title="Restrito" description={MASKED_MESSAGE} />;
  const data = rows
    .filter((r) => r.compaRatio !== null && r.positioningPercent !== null)
    .map((r) => ({ x: r.compaRatio as number, y: r.positioningPercent as number, name: r.employeeName }));
  if (data.length === 0) return <EmptyState title="Sem dados de compa-ratio" />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" dataKey="x" name="Compa-ratio" domain={[0.6, 1.4]} tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
        <YAxis type="number" dataKey="y" name="Penetracao" unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
        <ZAxis range={[60, 60]} />
        <ReferenceLine x={1} stroke="#16a34a" strokeDasharray="4 4" label={{ value: 'medio', fontSize: 10, position: 'top' }} />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as { x: number; y: number; name: string };
            return (
              <div className="rounded-md border bg-background p-2 text-xs shadow-md">
                <div className="font-medium">{p.name}</div>
                <div className="text-muted-foreground">Compa-ratio {formatNumber(p.x)}</div>
                <div className="text-muted-foreground">Penetracao {formatNumber(p.y, { maximumFractionDigits: 0 })}%</div>
              </div>
            );
          }}
        />
        <Scatter data={data} fill="#2563eb" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
