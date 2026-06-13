'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Briefcase, Building2, FileBarChart, GitPullRequestArrow, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { NativeSelect } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

interface Overview {
  periodRef: string;
  salaryMasked: boolean;
  cards: Record<string, number | null>;
  charts: {
    plannedVsRealizedByArea: Array<{ name: string; plannedPositions: number; realizedEmployees: number; openPositions: number }>;
    vacanciesByArea: Array<{ name: string; value: number }>;
    employeesByBand: Array<{ name: string; value: number }>;
    salaryFit: Array<{ name: string; value: number }>;
    budgetPlannedVsRealized: Array<{ name: string; planned: number; realized: number }>;
    movementsByType: Array<{ name: string; value: number }>;
    correctionPriorities: Array<{ name: string; value: number }>;
  };
}

interface Options {
  orgNodes: Array<{ id: string; name: string; type: string }>;
  jobs: Array<{ id: string; name: string; code: string }>;
}

const COLORS = ['#0f172a', '#2563eb', '#16a34a', '#ca8a04', '#dc2626', '#7c3aed'];

export default function CargosSalariosPage() {
  const [orgNodeId, setOrgNodeId] = useState('');
  const [jobCatalogId, setJobCatalogId] = useState('');
  const params = useMemo(() => {
    const search = new URLSearchParams();
    if (orgNodeId) search.set('orgNodeId', orgNodeId);
    if (jobCatalogId) search.set('jobCatalogId', jobCatalogId);
    return search.toString();
  }, [orgNodeId, jobCatalogId]);

  const overviewQuery = useQuery<Overview>({
    queryKey: ['compensation', 'overview', params],
    queryFn: () => api(`/cargos-salarios/overview${params ? `?${params}` : ''}`),
  });
  const optionsQuery = useQuery<Options>({
    queryKey: ['compensation', 'options'],
    queryFn: () => api('/cargos-salarios/options'),
    staleTime: 60_000,
  });

  const overview = overviewQuery.data;
  const cards = overview?.cards;

  return (
    <div>
      <PageHeader
        eyebrow="Gestão"
        tone="view"
        title="Cargos e Salários"
        description="Painel de quadro, cargos, faixas salariais, orçamento e movimentações de pessoas."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários' }]}
      />
      <CompensationModuleNav />

      <SectionCard title="Filtros" description="Os indicadores abaixo respeitam empresa, permissão e escopo do usuário.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <Label>Área ou setor</Label>
            <NativeSelect value={orgNodeId} onChange={(event) => setOrgNodeId(event.target.value)}>
              <option value="">Todas</option>
              {(optionsQuery.data?.orgNodes ?? []).map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>Cargo</Label>
            <NativeSelect value={jobCatalogId} onChange={(event) => setJobCatalogId(event.target.value)}>
              <option value="">Todos</option>
              {(optionsQuery.data?.jobs ?? []).map((job) => (
                <option key={job.id} value={job.id}>
                  {job.code} - {job.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>Período</Label>
            <NativeSelect value={overviewQuery.data?.periodRef ?? ''} disabled>
              <option>{overviewQuery.data?.periodRef ?? 'Atual'}</option>
            </NativeSelect>
          </div>
        </div>
      </SectionCard>

      {overviewQuery.isLoading && <LoadingState />}

      {overview && cards && (
        <>
          <div className="my-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Colaboradores" value={formatNumber(cards.allocatedEmployees)} description="Alocados no quadro" icon={<Users className="h-4 w-4" />} tone="blue" href="/cargos-salarios/estrutura-quadro" />
            <MetricCard title="Posições previstas" value={formatNumber(cards.plannedPositions)} description={`${formatNumber(cards.occupiedPositions)} ocupadas`} icon={<Building2 className="h-4 w-4" />} tone="green" href="/cargos-salarios/estrutura-quadro" />
            <MetricCard title="Vagas abertas" value={formatNumber(cards.openPositions)} description="Posições sem ocupante" icon={<Briefcase className="h-4 w-4" />} tone="yellow" href="/cargos-salarios/estrutura-quadro" />
            <MetricCard title="Pendências" value={formatNumber(cards.pendingApprovals)} description="Movimentações aguardando fluxo" icon={<GitPullRequestArrow className="h-4 w-4" />} tone="purple" href="/cargos-salarios/movimentacoes" />
            <MetricCard title="Dentro do orçamento" value={formatNumber(cards.positionsInBudget)} description={`${formatNumber(cards.positionsOutOfBudget)} fora do orçado`} icon={<BarChart3 className="h-4 w-4" />} tone="green" href="/cargos-salarios/estrutura-quadro" />
            <MetricCard title="Abaixo da faixa" value={formatNumber(cards.employeesBelowRange)} description="Requer análise de enquadramento" icon={<FileBarChart className="h-4 w-4" />} tone="red" href="/cargos-salarios/enquadramento?situation=ABAIXO_DA_FAIXA" />
            <MetricCard title="Dentro da faixa" value={formatNumber(cards.employeesInRange)} description="Compa-ratio adequado" icon={<FileBarChart className="h-4 w-4" />} tone="blue" href="/cargos-salarios/enquadramento?situation=DENTRO_DA_FAIXA" />
            <MetricCard title="Orçamento x realizado" value={overview.salaryMasked ? 'Restrito' : formatNumber(cards.budgetVariation, { style: 'currency', currency: 'BRL' })} description="Variação do período" icon={<BarChart3 className="h-4 w-4" />} tone="purple" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="Quadro previsto x realizado por área">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={overview.charts.plannedVsRealizedByArea}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="plannedPositions" name="Previsto" fill="#0f172a" />
                  <Bar dataKey="realizedEmployees" name="Realizado" fill="#2563eb" />
                  <Bar dataKey="openPositions" name="Vagas" fill="#ca8a04" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Enquadramento salarial">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={overview.charts.salaryFit} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2}>
                    {overview.charts.salaryFit.map((_entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Distribuicao por faixa">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={overview.charts.employeesByBand}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="Colaboradores" fill="#16a34a" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Movimentações por tipo">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={overview.charts.movementsByType}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="Solicitacoes" fill="#7c3aed" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SectionCard title={title} contentClassName="p-3">
      {children}
    </SectionCard>
  );
}
