'use client';

import { useMemo, useState } from 'react';
import type { FitRow } from '@/lib/compensation/types';
import {
  COMPA_BANDS,
  DEFAULT_MERIT_MATRIX,
  PERFORMANCE_LEVELS,
  ratingDistribution,
  simulateMerit,
} from '@/lib/compensation/analytics';
import { formatMoney } from '@/lib/compensation/format';
import { Input } from '@/components/ui/input';
import { formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

const DEFAULT_DISTRIBUTION = [0.1, 0.55, 0.25, 0.1]; // soma 1

/**
 * Matriz de merito editavel (desempenho x faixa de compa-ratio -> % de aumento) com
 * simulador de impacto sobre a populacao do enquadramento. Quando os colaboradores
 * possuem rating de desempenho (perfil), a distribuicao REAL e usada por padrao;
 * sem ratings, cai na distribuicao assumida editavel.
 */
export function MeritMatrix({
  rows,
  currency = 'BRL',
  guidelinePercent,
  totalBudget,
  initialMatrix,
  onChange,
}: {
  rows: FitRow[];
  currency?: string;
  guidelinePercent?: number | null;
  totalBudget?: number | null;
  initialMatrix?: number[][];
  onChange?: (matrix: number[][]) => void;
}) {
  const [matrix, setMatrix] = useState<number[][]>(initialMatrix ?? DEFAULT_MERIT_MATRIX.map((r) => [...r]));
  const [distribution, setDistribution] = useState<number[]>(DEFAULT_DISTRIBUTION);
  const real = useMemo(() => ratingDistribution(rows), [rows]);
  const [source, setSource] = useState<'real' | 'assumida'>(real.rated > 0 ? 'real' : 'assumida');

  const activeDistribution = source === 'real' && real.rated > 0 ? real.distribution : distribution;
  const distributionSum = activeDistribution.reduce((a, b) => a + b, 0);
  const result = useMemo(() => simulateMerit(rows, matrix, activeDistribution), [rows, matrix, activeDistribution]);

  function updateCell(perfIdx: number, bandIdx: number, value: number) {
    const next = matrix.map((row) => [...row]);
    next[perfIdx][bandIdx] = Number.isNaN(value) ? 0 : value;
    setMatrix(next);
    onChange?.(next);
  }

  function updateDistribution(idx: number, value: number) {
    const next = [...distribution];
    next[idx] = Number.isNaN(value) ? 0 : value / 100;
    setDistribution(next);
  }

  return (
    <div className="space-y-6">
      {/* Grade editavel */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border bg-muted/40 p-2 text-left text-xs uppercase text-muted-foreground">Desempenho \ Compa-ratio</th>
              {COMPA_BANDS.map((band) => (
                <th key={band.key} className="border bg-muted/40 p-2 text-center text-xs uppercase text-muted-foreground">
                  {band.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERFORMANCE_LEVELS.map((perf, perfIdx) => (
              <tr key={perf.key}>
                <td className="border p-2 text-xs font-medium">{perf.label}</td>
                {COMPA_BANDS.map((band, bandIdx) => (
                  <td key={band.key} className="border p-1">
                    <div className="flex items-center justify-center gap-1">
                      <Input
                        type="number"
                        step="0.5"
                        value={matrix[perfIdx][bandIdx]}
                        onChange={(event) => updateCell(perfIdx, bandIdx, Number(event.target.value))}
                        className="h-8 w-16 text-center"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Distribuicao de desempenho: real (ratings do perfil) ou assumida */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Distribuicao de desempenho
          </div>
          {real.rated > 0 && (
            <div className="flex items-center gap-1 rounded-md border p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSource('real')}
                className={cn('rounded px-2 py-1', source === 'real' ? 'bg-sky-500 font-semibold text-white' : 'text-muted-foreground hover:bg-muted')}
              >
                Real ({formatNumber(real.coveragePct, { maximumFractionDigits: 0 })}% avaliados)
              </button>
              <button
                type="button"
                onClick={() => setSource('assumida')}
                className={cn('rounded px-2 py-1', source === 'assumida' ? 'bg-sky-500 font-semibold text-white' : 'text-muted-foreground hover:bg-muted')}
              >
                Assumida
              </button>
            </div>
          )}
        </div>
        {source === 'real' && real.rated > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PERFORMANCE_LEVELS.map((perf, idx) => (
              <div key={perf.key} className="rounded-md border bg-muted/20 p-2">
                <div className="text-xs text-muted-foreground">{perf.label}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {formatNumber((real.distribution[idx] ?? 0) * 100, { maximumFractionDigits: 0 })}%
                </div>
              </div>
            ))}
            <p className="col-span-2 text-xs text-muted-foreground sm:col-span-4">
              Calculada a partir dos ratings de desempenho informados no perfil de {real.rated} colaborador(es)
              — Enquadramento &gt; Perfil &amp; desempenho.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PERFORMANCE_LEVELS.map((perf, idx) => (
                <div key={perf.key}>
                  <label className="text-xs text-muted-foreground">{perf.label}</label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round((distribution[idx] ?? 0) * 100)}
                      onChange={(event) => updateDistribution(idx, Number(event.target.value))}
                      className="h-8"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
            </div>
            {Math.abs(distributionSum - 1) > 0.001 && (
              <p className="mt-2 text-xs text-status-yellow">
                A distribuicao soma {formatNumber(distributionSum * 100, { maximumFractionDigits: 0 })}% (o ideal e 100%).
              </p>
            )}
          </>
        )}
      </div>

      {/* Resultado do simulador */}
      <div className="rounded-lg border">
        <div className="border-b bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Impacto simulado
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
          <Kpi label="Colaboradores elegíveis" value={formatNumber(result.totalHeadcount)} />
          <Kpi
            label="Aumento medio ponderado"
            value={`${formatNumber(result.weightedAvgIncreasePct, { maximumFractionDigits: 2 })}%`}
            tone={guidelinePercent != null && result.weightedAvgIncreasePct > guidelinePercent * 100 ? 'red' : 'green'}
            hint={guidelinePercent != null ? `Diretriz: ${formatNumber(guidelinePercent * 100, { maximumFractionDigits: 1 })}%` : undefined}
          />
          <Kpi
            label="Custo anual estimado"
            value={result.hasSalaryData ? formatMoney(result.totalCost, { currency }) : 'Restrito'}
            tone={totalBudget != null && result.totalCost != null && result.totalCost > totalBudget ? 'red' : 'neutral'}
            hint={totalBudget != null ? `Orçamento: ${formatMoney(totalBudget, { currency })}` : undefined}
          />
        </div>
        <div className="overflow-x-auto border-t">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pl-4 text-left">Faixa de compa-ratio</th>
                <th className="py-2 text-right">Colaboradores</th>
                <th className="py-2 text-right">% medio</th>
                <th className="py-2 pr-4 text-right">Custo anual</th>
              </tr>
            </thead>
            <tbody>
              {result.perBand.map((band) => (
                <tr key={band.band} className="border-b border-border/60">
                  <td className="py-2 pl-4">{band.band}</td>
                  <td className="py-2 text-right tabular-nums">{band.headcount}</td>
                  <td className="py-2 text-right tabular-nums">{formatNumber(band.avgIncreasePct, { maximumFractionDigits: 2 })}%</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{result.hasSalaryData ? formatMoney(band.cost, { currency }) : 'Restrito'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, tone = 'neutral' }: { label: string; value: string; hint?: string; tone?: 'neutral' | 'green' | 'red' }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-xl font-semibold tabular-nums', tone === 'red' && 'text-status-red', tone === 'green' && 'text-status-green')}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
