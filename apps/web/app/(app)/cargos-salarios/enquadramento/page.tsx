'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { CompaRatioDistributionChart, CompaRatioScatter, PenetrationHistogram } from '@/components/compensation/compa-ratio-chart';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { FilterBar } from '@/components/platform/filter-bar';
import { MetricCard } from '@/components/platform/metric-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { formatMoney, downloadCsv } from '@/lib/compensation/format';
import {
  computeFitKpis,
  equityByDimension,
  marketPositioning,
  type EquityDimension,
} from '@/lib/compensation/analytics';
import { SITUATION_LABELS, type FitRow, type JobOption, type SalaryTable, type SalarySurvey } from '@/lib/compensation/types';
import { formatNumber } from '@/lib/utils';

const situations = Object.keys(SITUATION_LABELS);
const EQUITY_LABELS: Record<EquityDimension, string> = { area: 'Área', job: 'Cargo', band: 'Faixa' };

function situationTone(situation: string): 'red' | 'yellow' | 'green' | 'gray' {
  if (situation === 'ABAIXO_DA_FAIXA' || situation === 'ACIMA_DA_FAIXA') return 'red';
  if (situation === 'PROXIMO_AO_MINIMO' || situation === 'PROXIMO_AO_TETO') return 'yellow';
  if (situation === 'SEM_TABELA' || situation === 'PENDENTE_ANALISE') return 'gray';
  return 'green';
}

export default function EnquadramentoPage() {
  const searchParams = useSearchParams();
  const [situation, setSituation] = useState(searchParams.get('situation') ?? '');
  const [orgNodeId, setOrgNodeId] = useState('');
  const [equityDim, setEquityDim] = useState<EquityDimension>('area');

  const optionsQuery = useQuery<{ orgNodes: Array<{ id: string; name: string }>; jobs: JobOption[] }>({
    queryKey: ['compensation', 'options'],
    queryFn: () => api('/cargos-salarios/options'),
    staleTime: 60_000,
  });
  // Sempre busca a base completa (sem filtro de situacao) para alimentar KPIs e graficos;
  // o filtro de situacao e aplicado no cliente para a tabela.
  const params = useMemo(() => (orgNodeId ? `?orgNodeId=${orgNodeId}` : ''), [orgNodeId]);
  const fitQuery = useQuery<FitRow[]>({
    queryKey: ['compensation', 'enquadramento', params],
    queryFn: () => api(`/cargos-salarios/enquadramento${params}`),
  });
  const tablesQuery = useQuery<SalaryTable[]>({ queryKey: ['compensation', 'salary-tables'], queryFn: () => api('/cargos-salarios/salary-tables') });
  const surveysQuery = useQuery<SalarySurvey[]>({ queryKey: ['compensation', 'salary-surveys'], queryFn: () => api('/cargos-salarios/salary-surveys') });

  const allRows = fitQuery.data ?? [];
  const rows = situation ? allRows.filter((r) => r.situation === situation) : allRows;
  const masked = allRows.length > 0 ? allRows[0].salaryMasked : false;
  const kpis = useMemo(() => computeFitKpis(allRows), [allRows]);
  const equity = useMemo(() => equityByDimension(allRows, equityDim), [allRows, equityDim]);
  const ranges = useMemo(() => (tablesQuery.data ?? []).flatMap((t) => t.ranges), [tablesQuery.data]);
  const market = useMemo(() => marketPositioning(surveysQuery.data ?? [], ranges), [surveysQuery.data, ranges]);

  function exportCsv() {
    const header = ['Matrícula', 'Colaborador', 'Área', 'Cargo', 'Faixa', 'Salário', 'Mínimo', 'Médio', 'Máximo', 'Compa-ratio', 'Penetração %', 'Situação'];
    const body = rows.map((r) => [
      r.registrationId ?? '',
      r.employeeName,
      r.orgNode?.name ?? '',
      r.job?.name ?? '',
      r.band ?? '',
      r.currentSalary ?? '',
      r.minSalary ?? '',
      r.midpointSalary ?? '',
      r.maxSalary ?? '',
      r.compaRatio ?? '',
      r.positioningPercent ?? '',
      SITUATION_LABELS[r.situation] ?? r.situation,
    ]);
    downloadCsv(`enquadramento-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...body]);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Enquadramento Salarial"
        description="Análise de compa-ratio, penetração na faixa, equidade interna e posicionamento de mercado."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Enquadramento' }]}
      />
      <CompensationModuleNav />

      <FilterBar
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="mr-1.5 h-4 w-4" /> Exportar CSV
          </Button>
        }
      >
        <div>
          <Label className="text-xs">Área ou setor</Label>
          <NativeSelect value={orgNodeId} onChange={(e) => setOrgNodeId(e.target.value)}>
            <option value="">Todas</option>
            {(optionsQuery.data?.orgNodes ?? []).map((node) => (
              <option key={node.id} value={node.id}>
                {node.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label className="text-xs">Situação</Label>
          <NativeSelect value={situation} onChange={(e) => setSituation(e.target.value)}>
            <option value="">Todas</option>
            {situations.map((item) => (
              <option key={item} value={item}>
                {SITUATION_LABELS[item]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </FilterBar>

      {fitQuery.isLoading && <LoadingState />}

      {!fitQuery.isLoading && allRows.length === 0 && (
        <EmptyState title="Sem colaboradores para analisar" description="Cadastre colaboradores, faixas e retratos salariais para ver o enquadramento." />
      )}

      {allRows.length > 0 && (
        <>
          {/* KPIs */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard title="Colaboradores" value={formatNumber(kpis.total)} description={`${formatNumber(kpis.withRange)} com faixa`} tone="blue" />
            <MetricCard title="Abaixo da faixa" value={`${formatNumber(kpis.belowPct, { maximumFractionDigits: 0 })}%`} description="Requer atenção" tone="red" />
            <MetricCard title="Dentro da faixa" value={`${formatNumber(kpis.inRangePct, { maximumFractionDigits: 0 })}%`} description="Compa-ratio adequado" tone="green" />
            <MetricCard title="Acima da faixa" value={`${formatNumber(kpis.abovePct, { maximumFractionDigits: 0 })}%`} description="Próximo/acima do teto" tone="yellow" />
            <MetricCard
              title="Compa-ratio médio"
              value={masked ? 'Restrito' : kpis.avgCompaRatio === null ? '-' : formatNumber(kpis.avgCompaRatio)}
              description={masked ? 'Sem permissão' : kpis.avgPenetration === null ? undefined : `Penetração ${formatNumber(kpis.avgPenetration, { maximumFractionDigits: 0 })}%`}
              tone="purple"
            />
          </div>

          {/* Graficos */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SectionCard title="Dispersão de compa-ratio x penetração" contentClassName="p-3">
              <CompaRatioScatter rows={allRows} masked={masked} />
            </SectionCard>
            <SectionCard title="Distribuição por compa-ratio" contentClassName="p-3">
              <CompaRatioDistributionChart rows={allRows} masked={masked} />
            </SectionCard>
            <SectionCard title="Penetração na faixa" contentClassName="p-3">
              <PenetrationHistogram rows={allRows} masked={masked} />
            </SectionCard>

            {/* Equidade */}
            <SectionCard
              title="Equidade interna"
              description="Compa-ratio médio por grupo. Gap = diferença vs. média geral."
              actions={
                <NativeSelect value={equityDim} onChange={(e) => setEquityDim(e.target.value as EquityDimension)} className="h-8 w-28 text-xs">
                  {(Object.keys(EQUITY_LABELS) as EquityDimension[]).map((dim) => (
                    <option key={dim} value={dim}>
                      {EQUITY_LABELS[dim]}
                    </option>
                  ))}
                </NativeSelect>
              }
              contentClassName="p-0"
            >
              {masked ? (
                <EmptyState title="Restrito" description="Análise de equidade indisponível sem permissão de salário individual." />
              ) : equity.length === 0 ? (
                <EmptyState title="Sem dados" />
              ) : (
                <div className="max-h-[300px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 border-b bg-card text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left">{EQUITY_LABELS[equityDim]}</th>
                        <th className="px-2 py-2 text-right">Qtd</th>
                        <th className="px-2 py-2 text-right">Compa médio</th>
                        <th className="px-4 py-2 text-right">Gap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equity.map((row) => (
                        <tr key={row.key} className="border-b border-border/60">
                          <td className="px-4 py-2">{row.label}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{row.count}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{row.avgCompaRatio === null ? '-' : formatNumber(row.avgCompaRatio)}</td>
                          <td className={`px-4 py-2 text-right tabular-nums ${row.gap !== null && row.gap < -0.05 ? 'text-status-red' : row.gap !== null && row.gap > 0.05 ? 'text-status-blue' : 'text-muted-foreground'}`}>
                            {row.gap === null ? '-' : `${row.gap > 0 ? '+' : ''}${formatNumber(row.gap, { maximumFractionDigits: 2 })}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Posicionamento de mercado */}
          <SectionCard
            title="Posicionamento de mercado"
            description="Ponto médio interno x mediana de mercado das pesquisas vinculadas ao cargo."
            className="mt-4"
            contentClassName="p-0"
          >
            {market.length === 0 ? (
              <EmptyState
                title="Sem pesquisas vinculadas"
                description="Cadastre pesquisas salariais (aba Pesquisas) vinculadas a um cargo do catálogo para comparar com o mercado."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Cargo (mercado)</th>
                      <th className="px-2 py-2 text-left">Fonte</th>
                      <th className="px-2 py-2 text-right">Médio interno</th>
                      <th className="px-2 py-2 text-right">P25</th>
                      <th className="px-2 py-2 text-right">Mediana</th>
                      <th className="px-2 py-2 text-right">P75</th>
                      <th className="px-2 py-2 text-right">Posição</th>
                      <th className="px-4 py-2 text-left">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {market.map((row, idx) => (
                      <tr key={`${row.jobCatalogId}-${idx}`} className="border-b border-border/60">
                        <td className="px-4 py-2 font-medium">{row.marketJobName}</td>
                        <td className="px-2 py-2 text-muted-foreground">{row.source}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatMoney(row.internalMidpoint)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatMoney(row.p25)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatMoney(row.marketMedian)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatMoney(row.p75)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{row.positioning === null ? '-' : `${formatNumber(row.positioning * 100, { maximumFractionDigits: 0 })}%`}</td>
                        <td className="px-4 py-2">
                          <Badge variant={row.classification === 'LAG' ? 'destructive' : row.classification === 'LEAD' ? 'default' : 'secondary'}>
                            {row.classification === 'LAG' ? 'Abaixo' : row.classification === 'LEAD' ? 'Acima' : row.classification === 'MATCH' ? 'Alinhado' : '—'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Tabela de colaboradores */}
          <SectionCard title="Colaboradores" className="mt-4" actions={<Badge variant="secondary">{rows.length}</Badge>}>
            {rows.length === 0 ? (
              <EmptyState title="Nenhum colaborador nesta situação" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1040px] text-sm">
                  <thead className="border-b text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2 text-left">Matrícula</th>
                      <th className="py-2 text-left">Colaborador</th>
                      <th className="py-2 text-left">Área</th>
                      <th className="py-2 text-left">Cargo</th>
                      <th className="py-2 text-left">Faixa</th>
                      <th className="py-2 text-right">Salário</th>
                      <th className="py-2 text-right">Min / Médio / Máx</th>
                      <th className="py-2 text-right">Compa</th>
                      <th className="py-2 text-right">Penetr.</th>
                      <th className="py-2 text-left">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.employeeId} className="border-b border-border/60">
                        <td className="py-2 font-mono text-xs">{row.registrationId ?? '-'}</td>
                        <td className="py-2 font-medium">{row.employeeName}</td>
                        <td className="py-2">{row.orgNode?.name ?? '-'}</td>
                        <td className="py-2">{row.job?.name ?? '-'}</td>
                        <td className="py-2">{row.band ?? '-'}</td>
                        <td className="py-2 text-right tabular-nums">{formatMoney(row.currentSalary, { masked: row.salaryMasked })}</td>
                        <td className="py-2 text-right tabular-nums">
                          {row.salaryMasked ? 'Restrito' : `${formatMoney(row.minSalary)} / ${formatMoney(row.midpointSalary)} / ${formatMoney(row.maxSalary)}`}
                        </td>
                        <td className="py-2 text-right tabular-nums">{row.compaRatio === null ? '-' : formatNumber(row.compaRatio)}</td>
                        <td className="py-2 text-right tabular-nums">{row.positioningPercent === null ? '-' : `${formatNumber(row.positioningPercent, { maximumFractionDigits: 0 })}%`}</td>
                        <td className="py-2">
                          <Badge variant={situationTone(row.situation) === 'red' ? 'destructive' : situationTone(row.situation) === 'green' ? 'default' : 'secondary'}>
                            {SITUATION_LABELS[row.situation] ?? row.situation}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
