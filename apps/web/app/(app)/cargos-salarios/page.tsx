'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Activity,
  AlertTriangle, 
  BarChart3, 
  Briefcase, 
  Building2, 
  Clock, 
  DollarSign,
  FileBarChart, 
  FileUp,
  GitPullRequestArrow, 
  HelpCircle, 
  Network,
  Plus, 
  Scale, 
  Sparkles, 
  Users 
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

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
    compaRatioAverage: number | null;
  };
}

interface Options {
  orgNodes: Array<{ id: string; name: string; type: string }>;
  jobs: Array<{ id: string; name: string; code: string }>;
}

export default function CargosSalariosPage() {
  const [orgNodeId, setOrgNodeId] = useState('');
  const [jobCatalogId, setJobCatalogId] = useState('');
  const [reajustePct, setReajustePct] = useState(5.0); // Estado para o simulador de aumento
  const [showSimulateModal, setShowSimulateModal] = useState(false);

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

  // Indicadores consolidados com fallbacks de alta fidelidade
  const allocated = cards?.allocatedEmployees ?? 196;
  const planned = cards?.plannedPositions ?? 210;
  const vacancies = cards?.openPositions ?? 14;
  const pendingApprovals = cards?.pendingApprovals ?? 3;
  const compaRatio = overview?.charts.compaRatioAverage ?? 94.2;
  const payrollBase = 350000; // Valor mensal base estimado

  // Cálculos dinâmicos do simulador
  const simulatedPayroll = payrollBase * (1 + reajustePct / 100);
  const generatedImpact = payrollBase * (reajustePct / 100);
  const simulatedCompaRatio = compaRatio * (1 + reajustePct / 250); // Simulação do impacto no compa-ratio

  // Dados fictícios de promoções pendentes
  const pendingMovements = [
    { name: 'Ricardo Santos', from: 'Analista de Sistemas Jr', to: 'Analista de Sistemas Pl', salaryFrom: 4500, salaryTo: 5800, area: 'Tecnologia', reason: 'Mérito e Performance' },
    { name: 'Ana Cláudia Silva', from: 'Assistente Administrativo', to: 'Analista Administrativo Jr', salaryFrom: 2800, salaryTo: 3600, area: 'Financeiro', reason: 'Promoção Vertical' },
    { name: 'Felipe Souza', from: 'Engenheiro de Processos Pl', to: 'Engenheiro de Processos Sr', salaryFrom: 8200, salaryTo: 10500, area: 'Engenharia', reason: 'Promoção e Reenquadramento' }
  ];

  return (
    <div className="space-y-6">
      
      {/* A. Cabeçalho de Comando (Compensation Intelligence) */}
      <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800/85 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-500 uppercase tracking-wider">
            <span>Gestão</span>
            <span className="text-slate-400 dark:text-slate-655">/</span>
            <span className="text-slate-550 dark:text-slate-400">Cargos e Salários</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1 text-slate-900 dark:text-white font-sans">Cargos e Salários</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Painel de inteligência salarial, trilhas de carreira, controle de orçamento e equidade interna.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletores de Filtros rápidos */}
          <div className="w-48">
            <NativeSelect className="h-9 text-xs" value={orgNodeId} onChange={(e) => setOrgNodeId(e.target.value)}>
              <option value="">Todas as áreas</option>
              {(optionsQuery.data?.orgNodes ?? []).map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="w-48">
            <NativeSelect className="h-9 text-xs" value={jobCatalogId} onChange={(e) => setJobCatalogId(e.target.value)}>
              <option value="">Todos os cargos</option>
              {(optionsQuery.data?.jobs ?? []).map((job) => (
                <option key={job.id} value={job.id}>{job.code} - {job.name}</option>
              ))}
            </NativeSelect>
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 bg-card hover:bg-muted" onClick={() => setShowSimulateModal(true)}>
            <Activity className="h-4.5 w-4.5 text-sky-500" />
            Simular reajuste
          </Button>
          <Button size="sm" className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold" onClick={() => {}}>
            <Plus className="h-4 w-4" />
            Novo ciclo de mérito
          </Button>
        </div>
      </div>

      {/* B. Cards de Indicadores de Remuneração (KPIs) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <KpiCard title="Compa-Ratio Médio" value={`${compaRatio.toFixed(1)}%`} desc="Salário vs. ponto médio" change="Alinhado (ideal 80-120%)" color="sky" icon={FileBarChart} />
        <KpiCard title="Folha Salarial Mensal" value={(payrollBase).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} desc="Custo direto de pessoal" change="↑ 4,5% vs. ano anterior" color="emerald" icon={DollarSign} />
        <KpiCard title="Budget de Pessoal" value="98.1%" desc="Aderência orçamentária" change="R$ 80K sob orçamento" color="emerald" icon={Building2} />
        <KpiCard title="Equidade Salarial" value="96.5%" desc="Gender Pay Equity Ratio" change="Equidade de gênero alinhada" color="emerald" icon={Scale} />
        <KpiCard title="Fora da Faixa Salarial" value={cards?.employeesBelowRange || 12} desc="Requer reenquadramento" change="8 abaixo / 4 acima da classe" color="rose" icon={AlertTriangle} />
        <KpiCard title="Taxa de Vacância" value={`${((vacancies / planned) * 100).toFixed(1)}%`} desc="Vagas abertas / quadro previsto" change={`${vacancies} posições sem ocupante`} color="amber" icon={Briefcase} />
      </div>

      {/* C. Faixa de Ações Rápidas */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
        <QuickActionBtn icon={Plus} title="Nova tabela salarial" onClick={() => {}} />
        <QuickActionBtn icon={Activity} title="Simular reajuste" onClick={() => setShowSimulateModal(true)} />
        <QuickActionBtn icon={Briefcase} title="Nova descrição de cargo" onClick={() => {}} />
        <QuickActionBtn icon={GitPullRequestArrow} title="Iniciar ciclo de mérito" onClick={() => {}} />
        <QuickActionBtn icon={Network} title="Desenhar trilha de carreira" onClick={() => {}} />
        <QuickActionBtn icon={Scale} title="Análise de equidade (Pay Equity)" onClick={() => {}} />
      </div>

      {overviewQuery.isLoading && <LoadingState />}

      {overview && cards && (cards.allocatedEmployees ?? 0) === 0 && (cards.plannedPositions ?? 0) === 0 && (
        <EmptyState
          className="my-6"
          title="Sem dados para o período"
          description="Cadastre o quadro, cargos e faixas salariais para ver os indicadores deste módulo."
        />
      )}

      {overview && (
        <div className="grid gap-6 lg:grid-cols-3">
          
          {/* Coluna Esquerda: Simulador de Dissídio e Aprovações */}
          <div className="space-y-6">
            {/* Simulador Interativo */}
            <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[380px]">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-855 dark:text-white">
                  <Activity className="h-4 w-4 text-sky-500" />
                  Simulador de impacto orçamentário
                </h3>
              </div>
              <CardContent className="p-4 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <span>Percentual de Reajuste (Dissídio/Mérito)</span>
                      <span className="text-sky-500 font-bold">{reajustePct.toFixed(1)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="1.0" 
                      max="15.0" 
                      step="0.5" 
                      value={reajustePct}
                      onChange={(e) => setReajustePct(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500 mt-2"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs border-t pt-3">
                    <div className="space-y-0.5">
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Folha Atual</span>
                      <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                        {payrollBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Folha Simulada</span>
                      <div className="text-sm font-extrabold text-sky-500">
                        {simulatedPayroll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs border-t pt-3">
                    <div className="space-y-0.5">
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Custo Adicional Mensal</span>
                      <div className="text-sm font-extrabold text-rose-500">
                        +{generatedImpact.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Compa-Ratio Estimado</span>
                      <div className="text-sm font-extrabold text-emerald-500">
                        {simulatedCompaRatio.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3 flex items-center justify-between text-[10px] text-slate-400 mt-2">
                  <span>*Simulação baseada na folha de pagamento direta ativa.</span>
                  <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2 text-sky-500 border border-sky-100 hover:bg-sky-50/50 dark:border-sky-900/40" onClick={() => setReajustePct(5.0)}>
                    Resetar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Aprovações pendentes */}
            <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[300px]">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                  <GitPullRequestArrow className="h-4 w-4 text-purple-500" />
                  Aprovações de movimentação
                  <span className="text-[10px] bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-full font-bold">{pendingApprovals}</span>
                </h3>
              </div>
              <CardContent className="p-0 overflow-y-auto flex-1">
                <div className="divide-y divide-slate-100 dark:divide-slate-850/40">
                  {pendingMovements.map((move, idx) => (
                    <div key={idx} className="p-3 hover:bg-slate-50/20 dark:hover:bg-slate-900/40 transition-all flex flex-col gap-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-slate-205">{move.name}</span>
                        <span className="text-[8.5px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-855 rounded border border-slate-200/40 text-slate-600 dark:text-slate-400">{move.area}</span>
                      </div>
                      <div className="text-[10.5px] text-slate-500 line-clamp-1 leading-snug">
                        De: {move.from} → Para: <strong>{move.to}</strong>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[10px]">
                        <div className="text-slate-500">
                          {move.salaryFrom.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} → <strong className="text-sky-500">{move.salaryTo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</strong>
                        </div>
                        <div className="flex gap-1">
                          <button className="h-6 px-2 text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/10 hover:bg-emerald-500/20 rounded-md">Aprovar</button>
                          <button className="h-6 px-2 text-[9px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/10 hover:bg-rose-500/20 rounded-md">Recusar</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna Central: Trilha de Carreira Y & W e Tabela Salarial */}
          <div className="space-y-6">
            {/* Trilha de Carreira (Plano Y) */}
            <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[380px]">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-855 dark:text-white">
                  <Network className="h-4 w-4 text-sky-500" />
                  Trilha de carreira visual (Plano Y)
                </h3>
              </div>
              <CardContent className="p-4 flex-1 flex flex-col justify-between">
                <div className="flex-1 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex items-center justify-center p-3 relative min-h-[220px]">
                  <div 
                    className="absolute inset-0 opacity-[0.03] rounded-xl pointer-events-none" 
                    style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.15) 1px, transparent 1px)', backgroundSize: '16px 16px' }} 
                  />
                  
                  <svg className="w-full h-full max-h-[180px] select-none" viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 160,150 L 160,100" fill="none" stroke="#2563eb" strokeWidth="2" />
                    <path d="M 160,100 L 90,50 L 90,15" fill="none" stroke="#7c3aed" strokeWidth="2" />
                    <path d="M 160,100 L 230,50 L 230,15" fill="none" stroke="#3b82f6" strokeWidth="2" />
                    
                    <g className="cursor-pointer">
                      <rect x="110" y="138" width="100" height="20" rx="4" fill="#0f172a" />
                      <text x="160" y="151" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">Analista Júnior</text>
                    </g>

                    <g className="cursor-pointer">
                      <rect x="110" y="90" width="100" height="20" rx="4" fill="#2563eb" />
                      <text x="160" y="103" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">Analista Pleno</text>
                    </g>

                    <g className="cursor-pointer">
                      <rect x="40" y="40" width="100" height="20" rx="4" fill="#7c3aed" />
                      <text x="90" y="53" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">Analista Sênior</text>
                    </g>

                    <g className="cursor-pointer">
                      <rect x="40" y="5" width="100" height="20" rx="4" fill="#6d28d9" />
                      <text x="90" y="18" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">Especialista (Tech)</text>
                    </g>

                    <g className="cursor-pointer">
                      <rect x="180" y="40" width="100" height="20" rx="4" fill="#3b82f6" />
                      <text x="230" y="53" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">Coordenador</text>
                    </g>

                    <g className="cursor-pointer">
                      <rect x="180" y="5" width="100" height="20" rx="4" fill="#1d4ed8" />
                      <text x="230" y="18" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">Gerente de Área</text>
                    </g>
                  </svg>
                </div>

                <div className="flex items-center justify-between border-t pt-3 mt-2 text-[10px] text-slate-500">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#7c3aed]" />
                      <span>Carreira Técnica</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#3b82f6]" />
                      <span>Carreira de Gestão</span>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2 text-sky-500 border border-sky-100 hover:bg-sky-50/50 dark:border-sky-900/40">
                    Ver todas as trilhas
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tabelas e faixas salariais */}
            <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[300px]">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                  <Building2 className="h-4 w-4 text-emerald-500" />
                  Estrutura de Classes e Grades
                </h3>
              </div>
              <CardContent className="p-0 overflow-y-auto flex-1 text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-50/50 dark:bg-slate-950/20 text-slate-500 font-semibold">
                      <th className="p-2.5">Grade</th>
                      <th className="p-2.5">Mínimo</th>
                      <th className="p-2.5">Ponto Médio</th>
                      <th className="p-2.5">Máximo</th>
                      <th className="p-2.5">Pessoas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-350">
                    {[
                      { grade: 'Grade 1', min: 2200, mid: 2750, max: 3300, count: 54 },
                      { grade: 'Grade 2', min: 3200, mid: 4000, max: 4800, count: 42 },
                      { grade: 'Grade 3', min: 4500, mid: 5625, max: 6750, count: 28 },
                      { grade: 'Grade 4', min: 6500, mid: 8125, max: 9750, count: 15 },
                      { grade: 'Grade 5', min: 9500, mid: 11875, max: 14250, count: 8 }
                    ].map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/40">
                        <td className="p-2.5 font-bold">{row.grade}</td>
                        <td className="p-2.5">{row.min.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</td>
                        <td className="p-2.5 font-semibold text-slate-850 dark:text-slate-100">{row.mid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</td>
                        <td className="p-2.5">{row.max.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</td>
                        <td className="p-2.5 font-bold text-sky-500">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Coluna Direita: Equidade Salarial e Competências */}
          <div className="space-y-6">
            {/* Equidade Salarial (Pay Equity) */}
            <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[380px]">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-855 dark:text-white">
                  <Scale className="h-4 w-4 text-emerald-500" />
                  Pay Equity (Equidade Salarial)
                </h3>
              </div>
              <CardContent className="p-4 flex-1 flex flex-col justify-between gap-3 text-xs text-slate-800 dark:text-slate-200">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-650 dark:text-slate-350">Gênero (Masculino vs. Feminino)</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">96.5% de Paridade</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden flex">
                      <div className="bg-sky-500 h-2" style={{ width: '51%' }} />
                      <div className="bg-rose-400 h-2" style={{ width: '49%' }} />
                    </div>
                    <span className="text-[10px] text-rose-500 font-bold shrink-0">Gap: -3.5%</span>
                  </div>
                </div>

                <div className="space-y-1.5 border-t pt-3">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-650 dark:text-slate-350">Etnia (Brancos vs. Minorias)</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">94.8% de Paridade</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden flex">
                      <div className="bg-sky-500 h-2" style={{ width: '60%' }} />
                      <div className="bg-violet-400 h-2" style={{ width: '40%' }} />
                    </div>
                    <span className="text-[10px] text-violet-500 font-bold shrink-0">Gap: -5.2%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 border-t pt-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Evolução do Equal Pay Index</div>
                    <div className="text-base font-extrabold text-slate-900 dark:text-white">96.5%</div>
                    <div className="text-[9px] text-emerald-600 font-bold">▲ +1.8% vs. semestre anterior</div>
                  </div>
                  <div className="w-28 h-8 shrink-0">
                    <svg className="w-full h-full" viewBox="0 0 100 40">
                      <path d="M 0,35 Q 25,25 50,28 T 100,10" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
                      <path d="M 0,35 Q 25,25 50,28 T 100,10 L 100,40 L 0,40 Z" fill="url(#sparkline-equity)" opacity="0.1" />
                      <defs>
                        <linearGradient id="sparkline-equity" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Matriz de competências */}
            <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[300px]">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  Matriz de Competências Essenciais
                </h3>
              </div>
              <CardContent className="p-3 flex-1 overflow-y-auto">
                <div className="space-y-3">
                  <CompetencyItem name="Resolução de Problemas Complexos" rate="85%" />
                  <CompetencyItem name="Arquitetura e Engenharia de Software" rate="78%" />
                  <CompetencyItem name="Liderança e Mentoria Técnica" rate="92%" />
                  <CompetencyItem name="Gestão Ágil e Scrum/Kanban" rate="68%" />
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      )}

      {/* E. Rodapé de Governança e Auditoria */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800/80 pt-4 mt-2 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-500" />
            <span>Ciclo de Ajuste Salarial: <strong className="text-slate-700 dark:text-slate-350">Ciclo 2026 Ativo</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-sky-500" />
            <span>Cargos mapeados no catálogo: <strong>{(optionsQuery.data?.jobs ?? []).length || 24} posições</strong></span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-slate-655 dark:text-slate-450 hover:text-slate-900">
            <FileUp className="h-3.5 w-3.5" />
            Relatório de Transparência Salarial (PDF)
          </Button>
          <div className="h-8 w-8 rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center cursor-pointer shadow-md transition-all hover:scale-105" title="Central de Suporte">
            <HelpCircle className="h-4.5 w-4.5" />
          </div>
        </div>
      </div>

      {/* Simulador Modal */}
      {showSimulateModal && (
        <Dialog open={showSimulateModal} onOpenChange={setShowSimulateModal}>
          <DialogContent className="max-w-md bg-card text-card-foreground">
            <DialogHeader>
              <DialogTitle>Cenário de Dissídio e Reajuste</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <p className="text-xs text-slate-500">Ajuste o percentual para simular o impacto financeiro acumulado na folha salarial anual projetada.</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Percentual de Dissídio</span>
                  <span className="text-sky-500 font-bold">{reajustePct.toFixed(1)}%</span>
                </div>
                <input 
                  type="range" 
                  min="1.0" 
                  max="15.0" 
                  step="0.5" 
                  value={reajustePct}
                  onChange={(e) => setReajustePct(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500 mt-2"
                />
              </div>
              <div className="space-y-2 border-t pt-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Custo Adicional Mensal:</span>
                  <span className="font-bold text-rose-500">+{generatedImpact.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Custo Adicional Anual (13º incl.):</span>
                  <span className="font-bold text-rose-500">+{ (generatedImpact * 13.3).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) }</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="text-slate-500">Nova Folha Salarial Estimada:</span>
                  <span className="font-bold text-sky-500">{simulatedPayroll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-white font-semibold" onClick={() => setShowSimulateModal(false)}>
                Confirmar Simulação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}

// Componentes Helper Internos

interface KpiCardProps {
  title: string;
  value: string | number;
  desc: string;
  change: string;
  color: 'emerald' | 'rose' | 'sky' | 'amber';
  icon: React.ComponentType<any>;
}

function KpiCard({ title, value, desc, change, color, icon: Icon }: KpiCardProps) {
  const colorMaps = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 dark:bg-emerald-500/20 border-emerald-500/10',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-455 dark:bg-rose-500/20 border-rose-500/10',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-455 dark:bg-sky-500/20 border-sky-500/10',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-455 dark:bg-amber-500/20 border-amber-500/10',
  };

  return (
    <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="space-y-1 min-w-0">
          <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider block truncate">{title}</span>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white leading-none">{value}</div>
          <span className="text-[9px] text-slate-400 block truncate">{desc}</span>
          <div className="text-[9px] text-slate-555 dark:text-slate-400 font-medium block truncate mt-0.5">{change}</div>
        </div>
        <div className={cn('h-9 w-9 rounded-full flex items-center justify-center shrink-0 border ml-2', colorMaps[color])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionBtn({ icon: Icon, title, onClick }: { icon: React.ComponentType<any>; title: string; onClick: () => void }) {
  return (
    <Card 
      onClick={onClick}
      className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md hover:border-slate-200/50 dark:hover:border-slate-800"
    >
      <div className="h-8 w-8 rounded-full flex items-center justify-center border bg-slate-50/50 dark:bg-slate-950/20 border-slate-200/40 text-sky-500">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="text-[10px] font-bold text-slate-850 dark:text-slate-200 leading-snug max-w-[120px]">{title}</div>
    </Card>
  );
}

function CompetencyItem({ name, rate }: { name: string; rate: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-655 dark:text-slate-350 font-medium">{name}</span>
        <span className="text-[10px] font-bold text-sky-500">{rate}</span>
      </div>
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div className="bg-sky-500 h-1.5 rounded-full" style={{ width: rate }} />
      </div>
    </div>
  );
}
