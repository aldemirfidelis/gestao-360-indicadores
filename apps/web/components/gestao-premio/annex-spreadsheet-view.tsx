'use client';

import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/select';
import type { RuleBand, RuleGroup, RuleIndicator, RuleParameter } from './types';
import { pickInherited } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  annexTitle: string;
  groups: RuleGroup[];
}

const MONTHS_FULL = [
  '01 - Janeiro', '02 - Fevereiro', '03 - Março', '04 - Abril', '05 - Maio', '06 - Junho',
  '07 - Julho', '08 - Agosto', '09 - Setembro', '10 - Outubro', '11 - Novembro', '12 - Dezembro',
];

export function AnnexSpreadsheetView({ open, onOpenChange, annexTitle, groups }: Props) {
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const g of groups) for (const ri of g.indicators) for (const p of ri.parameters) set.add(p.year);
    return Array.from(set).sort((a, b) => b - a);
  }, [groups]);
  const [year, setYear] = useState(() => years[0] ?? new Date().getFullYear());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] max-h-[92vh] overflow-auto p-0">
        <DialogHeader className="sticky top-0 z-10 flex flex-row items-center justify-between gap-3 border-b bg-background px-4 py-2">
          <DialogTitle>Visualização do anexo (layout da planilha)</DialogTitle>
          <label className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
            Ano:
            <NativeSelect value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-8 w-28">
              {(years.length ? years : [year]).map((y) => <option key={y} value={y}>{y}</option>)}
            </NativeSelect>
          </label>
        </DialogHeader>

        <div className="space-y-8 p-4">
          {groups.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma combinação cadastrada neste anexo.</p>}
          {groups.map((g) => <SheetBlock key={g.id} annexTitle={annexTitle} group={g} year={year} />)}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SheetBlock({ annexTitle, group, year }: { annexTitle: string; group: RuleGroup; year: number }) {
  const indicators = group.indicators.filter((ri) => ri.active);
  return (
    <div className="overflow-x-auto rounded border border-emerald-800/40 text-[11px] text-slate-800">
      {/* Cabeçalho estilo planilha */}
      <div className="bg-emerald-50 px-3 py-2 text-base font-semibold text-emerald-900">
        Detalhamento de Indicadores Premiação — {annexTitle}
      </div>
      <div className="bg-emerald-700 px-3 py-1 text-sm font-semibold text-white">INDICADORES PRÊMIO</div>
      <div className="bg-emerald-800 px-3 py-1 text-white"><span className="font-semibold">ÁREA:</span> {group.areaRefs.join('  ·  ') || '—'}</div>
      <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-800 px-3 py-1 text-white">
        <span><span className="font-semibold">CARGO:</span> {group.positionRefs.join('  |  ') || '—'}</span>
        <span className="font-semibold">Salário Possível (%): {group.salaryPercent}</span>
      </div>

      {/* Proposta — quadro de indicadores */}
      <div className="bg-amber-100 px-3 py-1 font-semibold text-amber-900">Proposta Meta Acumulado {year}</div>
      <table className="w-full border-collapse">
        <thead className="bg-emerald-100 text-emerald-900">
          <tr>
            {['Natureza', 'Indicador', 'Unid.', 'Peso (%)', 'Tipo', 'Vigência'].map((h) => (
              <th key={h} className="border border-emerald-800/30 px-2 py-1 text-left font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {indicators.length === 0 && <tr><td colSpan={6} className="border border-emerald-800/20 px-2 py-2 text-center text-muted-foreground">Nenhum indicador vinculado.</td></tr>}
          {indicators.map((ri) => (
            <tr key={ri.id}>
              <td className="border border-emerald-800/20 px-2 py-1">{natureza(ri.kind)}</td>
              <td className="border border-emerald-800/20 px-2 py-1">{ri.catalog.name} {arrow(ri.catalog.direction)}</td>
              <td className="border border-emerald-800/20 px-2 py-1">{ri.catalog.unit ?? '—'}</td>
              <td className="border border-emerald-800/20 px-2 py-1">{ri.weight}</td>
              <td className="border border-emerald-800/20 px-2 py-1">{ri.type === 'FIXED' ? 'Fixo' : 'Variável'}</td>
              <td className="border border-emerald-800/20 px-2 py-1">{ri.validityKind === 'CROP_YEAR' ? `Safra (mês ${ri.startMonth}, ${ri.monthsCount}m)` : 'Ano civil'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Proposta Meta - Mensal */}
      <div className="mt-1 bg-emerald-700 px-3 py-1 text-sm font-semibold text-white">Proposta Meta — Mensal {year}</div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-emerald-100 text-emerald-900">
            <th rowSpan={2} className="sticky left-0 z-[1] border border-emerald-800/30 bg-emerald-100 px-2 py-1 text-left font-semibold">Indicador</th>
            {MONTHS_FULL.map((m) => <th key={m} colSpan={2} className="border border-emerald-800/30 px-2 py-1 text-center font-semibold">{m}</th>)}
          </tr>
          <tr className="bg-emerald-50 text-emerald-900">
            {MONTHS_FULL.map((m) => [
              <th key={`${m}-z`} className="border border-emerald-800/20 px-2 py-0.5 text-center font-medium">Zero</th>,
              <th key={`${m}-t`} className="border border-emerald-800/20 px-2 py-0.5 text-center font-medium">Meta</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {indicators.map((ri) => {
            const byMonth = monthMap(ri, year);
            const fixed = ri.type === 'FIXED';
            return (
              <tr key={ri.id}>
                <td className="sticky left-0 z-[1] border border-emerald-800/20 bg-white px-2 py-1 font-medium">{ri.catalog.name}</td>
                {MONTHS_FULL.map((_, i) => {
                  const month = i + 1;
                  const p = byMonth.get(month);
                  const inhP = p ? null : pickInherited(ri.inherited, year, month, fixed);
                  const inh = !p && inhP != null;
                  const cls = `border border-emerald-800/20 px-2 py-1 text-center${inh ? ' italic text-slate-400' : ''}`;
                  return [
                    <td key={`z${i}`} className={cls}>{fmt(p?.zero ?? inhP?.zero ?? null)}</td>,
                    <td key={`t${i}`} className={cls}>{fmt(p?.target ?? inhP?.target ?? null)}</td>,
                  ];
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Proposta Distribuição Faixas - Mensal */}
      <div className="mt-1 bg-emerald-700 px-3 py-1 text-sm font-semibold text-white">Proposta Distribuição Faixas — Mensal {year}</div>
      {indicators.map((ri) => <BandsTable key={ri.id} ri={ri} year={year} />)}
    </div>
  );
}

function BandsTable({ ri, year }: { ri: RuleIndicator; year: number }) {
  const byMonth = monthMap(ri, year);
  const fixed = ri.type === 'FIXED';
  const bandsForMonth = (month: number): RuleBand[] => {
    const p = byMonth.get(month);
    if (p) return p.bands;
    const inhP = pickInherited(ri.inherited, year, month, fixed);
    return inhP ? (ri.inherited?.ranges ?? []) : [];
  };
  const maxBands = Math.max(0, ...MONTHS_FULL.map((_, i) => bandsForMonth(i + 1).length));
  if (maxBands === 0) {
    return <div className="border-t border-emerald-800/20 px-3 py-1 text-muted-foreground"><span className="font-medium text-slate-700">{ri.catalog.name}:</span> sem faixas geradas.</div>;
  }
  const rows = Array.from({ length: maxBands }, (_, i) => i);
  return (
    <div className="border-t border-emerald-800/20">
      <div className="bg-slate-50 px-3 py-0.5 font-medium text-slate-700">{ri.catalog.name}</div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-emerald-100 text-emerald-900">
            <th rowSpan={2} className="sticky left-0 z-[1] border border-emerald-800/30 bg-emerald-100 px-2 py-1 text-left font-semibold">Faixa</th>
            {MONTHS_FULL.map((m) => <th key={m} colSpan={3} className="border border-emerald-800/30 px-2 py-1 text-center font-semibold">{m}</th>)}
          </tr>
          <tr className="bg-emerald-50 text-emerald-900">
            {MONTHS_FULL.map((m) => [
              <th key={`${m}-mn`} className="border border-emerald-800/20 px-2 py-0.5 text-center font-medium">Min</th>,
              <th key={`${m}-mx`} className="border border-emerald-800/20 px-2 py-0.5 text-center font-medium">Max</th>,
              <th key={`${m}-r`} className="border border-emerald-800/20 px-2 py-0.5 text-center font-medium">%</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr key={order}>
              <td className="sticky left-0 z-[1] border border-emerald-800/20 bg-white px-2 py-1 text-center font-medium">{order}</td>
              {MONTHS_FULL.map((_, i) => {
                const band = bandsForMonth(i + 1).find((b) => b.orderIndex === order);
                return [
                  <td key={`mn${i}`} className="border border-emerald-800/20 px-2 py-1 text-center">{fmt(band?.minLimit)}</td>,
                  <td key={`mx${i}`} className="border border-emerald-800/20 px-2 py-1 text-center">{band?.maxLimit == null ? '∞' : fmt(band.maxLimit)}</td>,
                  <td key={`r${i}`} className="border border-emerald-800/20 px-2 py-1 text-center">{band ? `${fmt(band.gainPercent)}%` : '—'}</td>,
                ];
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function monthMap(ri: RuleIndicator, year: number) {
  const m = new Map<number, RuleParameter>();
  for (const p of ri.parameters) if (p.year === year) m.set(p.month, p);
  return m;
}
function natureza(kind: string) { return kind.startsWith('BEHAVIORAL') ? 'Comportamental' : 'Indicadores de Desempenho'; }
function arrow(direction: string) { return direction === 'LOWER_BETTER' ? '↓' : direction === 'TARGET' ? '→' : '↑'; }
function fmt(v: string | null | undefined): string {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
