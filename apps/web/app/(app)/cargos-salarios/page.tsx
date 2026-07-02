'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  Briefcase,
  Building2,
  CheckCircle2,
  DollarSign,
  FileBarChart,
  FileUp,
  GitPullRequestArrow,
  HelpCircle,
  Network,
  Plus,
  Scale,
  Users,
  X,
} from 'lucide-react';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/select';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { downloadCsv, formatMoney } from '@/lib/compensation/format';
import { formatDate, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Overview {
  periodRef: string;
  salaryMasked: boolean;
  cards: Record<string, number | null>;
  charts: {
    plannedVsRealizedByArea: Array<{ name: string; plannedPositions: number; realizedEmployees: number; openPositions: number }>;
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

interface ApprovalMovement {
  id: string;
  protocol: string;
  type: string;
  reason: string;
  status: string;
  monthlyImpact: string | number | null;
  createdAt: string;
}

interface ApprovalsData {
  movements: ApprovalMovement[];
  descriptions: unknown[];
  salaryTables: unknown[];
  simulations: unknown[];
}

const FIT_LABELS: Record<string, string> = {
  ABAIXO_DA_FAIXA: 'Abaixo da faixa',
  DENTRO_DA_FAIXA: 'Dentro da faixa',
  ACIMA_DA_FAIXA: 'Acima da faixa',
  SEM_FAIXA: 'Sem faixa definida',
};

export default function CargosSalariosPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canApprove = hasPermission(['compensation:movements:approve', 'compensation:manage']);
  const [orgNodeId, setOrgNodeId] = useState('');
  const [jobCatalogId, setJobCatalogId] = useState('');
  const [reajustePct, setReajustePct] = useState(5);
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
  const approvalsQuery = useQuery<ApprovalsData>({
    queryKey: ['compensation', 'approvals'],
    queryFn: () => api('/cargos-salarios/approvals'),
  });
  const approvalAction = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: 'approve' | 'reject'; note?: string }) =>
      api(`/cargos-salarios/movements/${id}/${action}`, {
        method: 'PATCH',
        json: note ? { note } : {},
      }),
    onSuccess: () => {
      toast.success('Movimentação atualizada');
      qc.invalidateQueries({ queryKey: ['compensation', 'approvals'] });
      qc.invalidateQueries({ queryKey: ['compensation', 'overview'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível atualizar a movimentação'),
  });

  const overview = overviewQuery.data;
  const cards = overview?.cards;
  const allocated = cards?.allocatedEmployees ?? 0;
  const planned = cards?.plannedPositions ?? 0;
  const vacancies = cards?.openPositions ?? 0;
  const belowRange = cards?.employeesBelowRange ?? 0;
  const aboveRange = cards?.employeesAboveRange ?? 0;
  const pendingApprovals = cards?.pendingApprovals ?? approvalsQuery.data?.movements.length ?? 0;
  const compaRatio = overview?.charts.compaRatioAverage;
  const payrollBase = cards?.realizedCost;
  const plannedBudget = cards?.plannedBudget;
  const budgetVariation = cards?.budgetVariation;
  const budgetAdherence = plannedBudget && payrollBase != null ? (payrollBase / plannedBudget) * 100 : null;
  const vacancyRate = planned > 0 ? (vacancies / planned) * 100 : 0;
  const simulatedPayroll = payrollBase == null ? null : payrollBase * (1 + reajustePct / 100);
  const generatedImpact = payrollBase == null ? null : payrollBase * (reajustePct / 100);

  function rejectMovement(id: string) {
    const note = window.prompt('Motivo da rejeição:');
    if (note === null) return;
    approvalAction.mutate({ id, action: 'reject', note });
  }

  function exportSnapshot() {
    if (!overview) return;
    const rows = [
      ['Indicador', 'Valor'],
      ['Período', overview.periodRef],
      ['Colaboradores alocados', allocated],
      ['Posições planejadas', planned],
      ['Vagas abertas', vacancies],
      ['Compa-ratio médio', compaRatio ?? 'Sem acesso'],
      ['Folha mensal', payrollBase ?? 'Sem acesso'],
      ['Orçamento planejado', plannedBudget ?? 'Sem acesso'],
      ['Variação orçamentária', budgetVariation ?? 'Sem acesso'],
      ['Abaixo da faixa', belowRange],
      ['Acima da faixa', aboveRange],
      ['Aprovações pendentes', pendingApprovals],
    ];
    downloadCsv(`painel-remuneracao-${overview.periodRef}.csv`, rows);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 dark:border-slate-800/85 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-sky-500">Gestão / Cargos e Salários</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Cargos e Salários</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Indicadores calculados a partir do quadro, faixas, orçamento e movimentações cadastradas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect className="h-9 w-48 text-xs" value={orgNodeId} onChange={(event) => setOrgNodeId(event.target.value)}>
            <option value="">Todas as áreas</option>
            {(optionsQuery.data?.orgNodes ?? []).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
          </NativeSelect>
          <NativeSelect className="h-9 w-48 text-xs" value={jobCatalogId} onChange={(event) => setJobCatalogId(event.target.value)}>
            <option value="">Todos os cargos</option>
            {(optionsQuery.data?.jobs ?? []).map((job) => <option key={job.id} value={job.id}>{job.code} - {job.name}</option>)}
          </NativeSelect>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setShowSimulateModal(true)} disabled={payrollBase == null}>
            <Activity className="h-4 w-4 text-sky-500" /> Simular reajuste
          </Button>
          <Button size="sm" className="h-9 gap-1.5" onClick={() => router.push('/cargos-salarios/ciclos')}>
            <Plus className="h-4 w-4" /> Novo ciclo de mérito
          </Button>
        </div>
      </div>

      {overviewQuery.isLoading && <LoadingState />}

      {overview && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <KpiCard title="Compa-ratio médio" value={compaRatio == null ? 'Restrito' : `${compaRatio.toFixed(1)}%`} desc="Salário atual ÷ ponto médio" color="sky" icon={FileBarChart} />
            <KpiCard title="Folha mensal" value={payrollBase == null ? 'Restrito' : formatMoney(payrollBase)} desc={`${formatNumber(allocated)} colaboradores alocados`} color="emerald" icon={DollarSign} />
            <KpiCard title="Aderência ao orçamento" value={budgetAdherence == null ? 'Sem orçamento' : `${budgetAdherence.toFixed(1)}%`} desc={budgetVariation == null ? 'Valor restrito' : `${formatMoney(Math.abs(budgetVariation))} ${budgetVariation >= 0 ? 'disponíveis' : 'acima'}`} color={budgetVariation != null && budgetVariation < 0 ? 'rose' : 'emerald'} icon={Building2} />
            <KpiCard title="Dentro da faixa" value={formatNumber(cards?.employeesWithinRange ?? 0)} desc="Colaboradores enquadrados" color="emerald" icon={Scale} />
            <KpiCard title="Fora da faixa" value={formatNumber(belowRange + aboveRange)} desc={`${belowRange} abaixo e ${aboveRange} acima`} color={(belowRange + aboveRange) > 0 ? 'rose' : 'emerald'} icon={AlertTriangle} />
            <KpiCard title="Taxa de vacância" value={`${vacancyRate.toFixed(1)}%`} desc={`${vacancies} de ${planned} posições`} color={vacancies > 0 ? 'amber' : 'emerald'} icon={Briefcase} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            <QuickActionBtn icon={Plus} title="Tabelas salariais" onClick={() => router.push('/cargos-salarios/tabelas-salariais')} />
            <QuickActionBtn icon={Activity} title="Simular reajuste" onClick={() => setShowSimulateModal(true)} disabled={payrollBase == null} />
            <QuickActionBtn icon={Briefcase} title="Descrições de cargo" onClick={() => router.push('/cargos-salarios/descricoes')} />
            <QuickActionBtn icon={GitPullRequestArrow} title="Ciclos de mérito" onClick={() => router.push('/cargos-salarios/ciclos')} />
            <QuickActionBtn icon={Network} title="Estrutura e carreira" onClick={() => router.push('/cargos-salarios/estrutura-quadro')} />
            <QuickActionBtn icon={Scale} title="Equidade salarial (Lei 14.611)" onClick={() => router.push('/cargos-salarios/equidade')} />
          </div>

          {allocated === 0 && planned === 0 && (
            <EmptyState title="Sem dados no escopo atual" description="Cadastre o quadro, os cargos e as faixas salariais para gerar os indicadores." />
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardContent className="p-0">
                <PanelTitle icon={GitPullRequestArrow} title="Aprovações de movimentação" badge={pendingApprovals} />
                {approvalsQuery.isLoading ? <LoadingState /> : (approvalsQuery.data?.movements ?? []).length === 0 ? (
                  <EmptyState className="m-4" title="Nada pendente" description="Não há movimentações aguardando decisão." />
                ) : (
                  <div className="max-h-[310px] divide-y overflow-y-auto">
                    {(approvalsQuery.data?.movements ?? []).map((movement) => (
                      <div key={movement.id} className="space-y-2 p-3 text-xs">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{movement.protocol}</div>
                            <div className="mt-0.5 text-muted-foreground">{movement.reason}</div>
                          </div>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{formatDate(movement.createdAt)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span>Impacto mensal: <strong>{formatMoney(movement.monthlyImpact)}</strong></span>
                          {canApprove && (
                            <div className="flex gap-1">
                              <Button size="sm" className="h-7 px-2 text-[10px]" onClick={() => approvalAction.mutate({ id: movement.id, action: 'approve' })} disabled={approvalAction.isPending}>
                                <CheckCircle2 className="mr-1 h-3 w-3" /> Aprovar
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => rejectMovement(movement.id)} disabled={approvalAction.isPending}>
                                <X className="mr-1 h-3 w-3" /> Rejeitar
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t p-3">
                  <Button variant="outline" size="sm" className="w-full" onClick={() => router.push('/cargos-salarios/aprovacoes')}>Abrir fila completa</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <PanelTitle icon={Users} title="Quadro por área" />
                <div className="max-h-[365px] divide-y overflow-y-auto">
                  {overview.charts.plannedVsRealizedByArea.length === 0 ? (
                    <EmptyState className="m-4" title="Sem áreas no escopo" />
                  ) : overview.charts.plannedVsRealizedByArea.map((area) => (
                    <button key={area.name} type="button" className="block w-full p-3 text-left hover:bg-muted/40" onClick={() => router.push('/cargos-salarios/estrutura-quadro')}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold">{area.name}</span>
                        <span className="text-muted-foreground">{area.realizedEmployees}/{area.plannedPositions}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${area.plannedPositions > 0 ? Math.min(100, (area.realizedEmployees / area.plannedPositions) * 100) : 0}%` }} />
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">{area.openPositions} posições em aberto</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardContent className="p-0">
                  <PanelTitle icon={Scale} title="Enquadramento salarial" />
                  <div className="space-y-3 p-4">
                    {overview.charts.salaryFit.length === 0 ? (
                      <EmptyState title="Sem enquadramento calculado" />
                    ) : overview.charts.salaryFit.map((item) => {
                      const total = overview.charts.salaryFit.reduce((sum, row) => sum + row.value, 0);
                      const percent = total > 0 ? (item.value / total) * 100 : 0;
                      return (
                        <button key={item.name} type="button" className="block w-full text-left" onClick={() => router.push('/cargos-salarios/enquadramento')}>
                          <div className="flex justify-between text-xs"><span>{FIT_LABELS[item.name] ?? item.name}</span><strong>{item.value}</strong></div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} /></div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-0">
                  <PanelTitle icon={Building2} title="Colaboradores por faixa" />
                  <div className="max-h-[160px] divide-y overflow-y-auto">
                    {overview.charts.employeesByBand.length === 0 ? <EmptyState className="m-4" title="Sem faixas publicadas" /> : overview.charts.employeesByBand.map((band) => (
                      <button key={band.name} type="button" className="flex w-full items-center justify-between p-3 text-xs hover:bg-muted/40" onClick={() => router.push('/cargos-salarios/tabelas-salariais')}>
                        <span className="font-medium">{band.name}</span><strong>{band.value} pessoas</strong>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4 text-xs text-muted-foreground">
            <span>Período de referência: <strong>{overview.periodRef}</strong> · Cargos cadastrados: <strong>{optionsQuery.data?.jobs.length ?? 0}</strong></span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={exportSnapshot}><FileUp className="mr-1.5 h-4 w-4" />Exportar painel (CSV)</Button>
              <Button variant="outline" size="sm" onClick={() => router.push('/cargos-salarios/relatorios')}>Relatórios e auditoria</Button>
              <Button size="icon" variant="outline" title="Central de Atendimento" onClick={() => router.push('/central-atendimento')}><HelpCircle className="h-4 w-4" /></Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={showSimulateModal} onOpenChange={setShowSimulateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cenário de reajuste</DialogTitle></DialogHeader>
          <div className="space-y-4 py-3">
            <p className="text-xs text-muted-foreground">Projeção informativa sobre a folha ativa no escopo selecionado. Nenhum dado será alterado.</p>
            <div>
              <div className="flex justify-between text-xs font-semibold"><span>Percentual</span><span className="text-sky-500">{reajustePct.toFixed(1)}%</span></div>
              <input type="range" min="0" max="15" step="0.5" value={reajustePct} onChange={(event) => setReajustePct(Number(event.target.value))} className="mt-2 h-1.5 w-full cursor-pointer accent-sky-500" />
            </div>
            <div className="space-y-2 border-t pt-3 text-sm">
              <div className="flex justify-between"><span>Folha atual</span><strong>{formatMoney(payrollBase)}</strong></div>
              <div className="flex justify-between"><span>Impacto mensal</span><strong>{formatMoney(generatedImpact)}</strong></div>
              <div className="flex justify-between"><span>Folha projetada</span><strong className="text-sky-500">{formatMoney(simulatedPayroll)}</strong></div>
              <div className="flex justify-between"><span>Impacto anual estimado</span><strong>{formatMoney(generatedImpact == null ? null : generatedImpact * 13.3)}</strong></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReajustePct(5)}>Restaurar 5%</Button>
            <Button onClick={() => setShowSimulateModal(false)}>Fechar simulação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PanelTitle({ icon: Icon, title, badge }: { icon: React.ComponentType<any>; title: string; badge?: number }) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-sky-500" />{title}</h2>
      {badge != null && <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-600">{badge}</span>}
    </div>
  );
}

function KpiCard({ title, value, desc, color, icon: Icon }: {
  title: string;
  value: string | number;
  desc: string;
  color: 'emerald' | 'rose' | 'sky' | 'amber';
  icon: React.ComponentType<any>;
}) {
  const colors = {
    emerald: 'bg-emerald-500/10 text-emerald-600',
    rose: 'bg-rose-500/10 text-rose-600',
    sky: 'bg-sky-500/10 text-sky-600',
    amber: 'bg-amber-500/10 text-amber-600',
  };
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="min-w-0 space-y-1">
          <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
          <div className="truncate text-xl font-extrabold">{value}</div>
          <span className="block truncate text-[9px] text-muted-foreground">{desc}</span>
        </div>
        <div className={cn('ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', colors[color])}><Icon className="h-4 w-4" /></div>
      </CardContent>
    </Card>
  );
}

function QuickActionBtn({ icon: Icon, title, onClick, disabled = false }: {
  icon: React.ComponentType<any>;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="flex flex-col items-center justify-center gap-1.5 rounded-lg border bg-card p-3 text-center transition hover:border-slate-300 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
      <span className="flex h-8 w-8 items-center justify-center rounded-full border bg-muted/40 text-sky-500"><Icon className="h-4 w-4" /></span>
      <span className="max-w-[120px] text-[10px] font-bold leading-snug">{title}</span>
    </button>
  );
}
