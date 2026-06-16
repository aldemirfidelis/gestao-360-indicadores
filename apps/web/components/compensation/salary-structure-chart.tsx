'use client';

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SalaryRange } from '@/lib/compensation/types';
import { salaryStructure } from '@/lib/compensation/analytics';
import { formatMoney } from '@/lib/compensation/format';
import { EmptyState } from '@/components/platform/empty-state';
import { formatNumber } from '@/lib/utils';

/**
 * Grafico de estrutura salarial: barra flutuante min -> ponto medio -> max por faixa
 * (stack: base transparente = min; segmento min->medio; segmento medio->max).
 */
export function SalaryStructureChart({
  ranges,
  currency = 'BRL',
  masked = false,
}: {
  ranges: SalaryRange[];
  currency?: string;
  masked?: boolean;
}) {
  const structure = salaryStructure(ranges);

  if (masked) {
    return <EmptyState title="Valores restritos" description="Você não possui permissão para visualizar valores salariais." />;
  }
  if (structure.length === 0) {
    return <EmptyState title="Sem faixas cadastradas" description="Adicione faixas com mínimo, ponto medio e maximo para ver a estrutura." />;
  }

  const data = structure.map((row) => ({
    label: row.label,
    base: row.min,
    lower: row.mid - row.min,
    upper: row.max - row.mid,
    min: row.min,
    mid: row.mid,
    max: row.max,
  }));

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 46 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={(value) => formatNumber(value, { notation: 'compact' })} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="label" width={96} tick={{ fontSize: 11 }} />
          <Tooltip
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as (typeof data)[number];
              return (
                <div className="rounded-md border bg-background p-2 text-xs shadow-md">
                  <div className="font-medium">{row.label}</div>
                  <div className="mt-1 grid grid-cols-[auto_auto] gap-x-3">
                    <span className="text-muted-foreground">Mínimo</span>
                    <span className="text-right tabular-nums">{formatMoney(row.min, { currency })}</span>
                    <span className="text-muted-foreground">Ponto medio</span>
                    <span className="text-right tabular-nums">{formatMoney(row.mid, { currency })}</span>
                    <span className="text-muted-foreground">Maximo</span>
                    <span className="text-right tabular-nums">{formatMoney(row.max, { currency })}</span>
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="base" stackId="range" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="lower" stackId="range" fill="#2563eb" isAnimationActive={false} />
          <Bar dataKey="upper" stackId="range" fill="#93c5fd" isAnimationActive={false}>
            <LabelList
              dataKey="max"
              position="right"
              formatter={(value: number) => formatNumber(value, { notation: 'compact' })}
              style={{ fontSize: 10, fill: 'var(--muted-foreground, #6b7280)' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2 text-left">Faixa</th>
              <th className="py-2 text-right">Min / Medio / Max</th>
              <th className="py-2 text-right">Amplitude</th>
              <th className="py-2 text-right">Progressao do medio</th>
              <th className="py-2 text-right">Sobreposicao</th>
            </tr>
          </thead>
          <tbody>
            {structure.map((row) => (
              <tr key={row.id} className="border-b border-border/60">
                <td className="py-2 font-medium">{row.label}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatMoney(row.min, { currency })} / {formatMoney(row.mid, { currency })} / {formatMoney(row.max, { currency })}
                </td>
                <td className="py-2 text-right tabular-nums">{formatNumber(row.rangeSpread, { maximumFractionDigits: 0 })}%</td>
                <td className="py-2 text-right tabular-nums">{row.midpointProgression === null ? '-' : `${formatNumber(row.midpointProgression, { maximumFractionDigits: 0 })}%`}</td>
                <td className="py-2 text-right tabular-nums">{row.overlapWithPrevious === null ? '-' : `${formatNumber(row.overlapWithPrevious, { maximumFractionDigits: 0 })}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
