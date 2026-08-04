'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, BarChart3, Clock3, Filter, FolderKanban, Plus, Wallet, X } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { downloadCsv } from '@/lib/compensation/format';
import { cn, formatDate, formatNumber } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'PLANNED' | 'IN_PROGRESS' | 'ON_HOLD' | 'DONE' | 'CANCELLED';
  startsAt: string | null;
  endsAt: string | null;
  responsible: string | null;
  budget: number | null;
  progressOverall: number;
  expectedProgress: number | null;
  scheduleVariance: number | null;
  pmoStatus: 'ON_TRACK' | 'AT_RISK' | 'CRITICAL' | 'FINALIZED';
  milestonesDone: number;
  milestonesOverdue: number;
  tasksOverdue: number;
  indicatorId: string | null;
  indicator: {
    id: string;
    name: string;
    code: string | null;
    unit: string;
    unitLabel: string | null;
    direction: 'HIGHER_BETTER' | 'LOWER_BETTER';
    results: { value: number; light: string; attainment: number | null; periodRef: string }[];
  } | null;
  _count: { tasks: number; milestones: number };
}

interface IndicatorOption {
  id: string;
  name: string;
  code: string | null;
  unit: string;
  unitLabel: string | null;
  direction: 'HIGHER_BETTER' | 'LOWER_BETTER';
  ownerNodeId?: string;
}

interface PortfolioSummary {
  totalProjects: number;
  activeProjects: number;
  budgetTotal: number;
  activeBudget: number;
  avgProgress: number;
  milestonesTotal: number;
  milestonesDone: number;
  milestonesOverdue: number;
  tasksTotal: number;
  tasksOverdue: number;
  behindSchedule: number;
  criticalProjects: Array<{
    id: string;
    name: string;
    status: Project['status'];
    pmoStatus: Project['pmoStatus'];
    responsible: string | null;
    endsAt: string | null;
    progressOverall: number;
    expectedProgress: number | null;
    scheduleVariance: number | null;
    milestonesOverdue: number;
    tasksOverdue: number;
    indicator: { id: string; name: string; code: string | null } | null;
  }>;
}

const STATUS_PILL: Record<string, string> = {
  PLANNED: 'pill-gray',
  IN_PROGRESS: 'pill-blue',
  ON_HOLD: 'pill-yellow',
  DONE: 'pill-green',
  CANCELLED: 'pill-gray',
};

const STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Planejado',
  IN_PROGRESS: 'Em andamento',
  ON_HOLD: 'Pausado',
  DONE: 'Concluido',
  CANCELLED: 'Cancelado',
};

const PMO_LABEL: Record<Project['pmoStatus'], string> = {
  ON_TRACK: 'No prazo',
  AT_RISK: 'Em risco',
  CRITICAL: 'Crítico',
  FINALIZED: 'Finalizado',
};

const PMO_CLASS: Record<Project['pmoStatus'], string> = {
  ON_TRACK: 'pill-green',
  AT_RISK: 'pill-yellow',
  CRITICAL: 'pill-red',
  FINALIZED: 'pill-gray',
};

export default function ProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['projects:create']);
  const [open, setOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [milestoneProjectId, setMilestoneProjectId] = useState('');
  const ganttRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState({
    search: searchParams.get('search') ?? '',
    status: searchParams.get('status') ?? '',
    indicatorId: searchParams.get('indicatorId') ?? '',
  });
  const [form, setForm] = useState({
    name: '',
    description: '',
    responsible: '',
    startsAt: '',
    endsAt: '',
    budget: '',
    status: 'PLANNED' as Project['status'],
    indicatorId: '',
  });

  const query = useQuery<Project[]>({
    queryKey: ['projects', filters],
    queryFn: () => api<Project[]>(`/projects${toQueryString(filters)}`),
  });

  const portfolio = useQuery<PortfolioSummary>({
    queryKey: ['projects', 'portfolio', filters],
    queryFn: () => api<PortfolioSummary>(`/projects/portfolio${toQueryString(filters)}`),
  });

  const indicatorsQuery = useQuery<IndicatorOption[]>({
    queryKey: ['projects', 'indicators'],
    queryFn: () => api<IndicatorOption[]>('/projects/indicators'),
    staleTime: 60_000,
  });

  const projects = useMemo(() => query.data ?? [], [query.data]);
  const pmo = portfolio.data;
  const timeline = useMemo(() => buildTimeline(projects), [projects]);

  useEffect(() => {
    router.replace(`/projects${toQueryString(filters)}`, { scroll: false });
  }, [filters, router]);

  const createProject = useMutation({
    mutationFn: () =>
      api<Project>('/projects', {
        method: 'POST',
        json: {
          name: form.name,
          description: form.description || undefined,
          responsible: form.responsible || undefined,
          startsAt: form.startsAt || undefined,
          endsAt: form.endsAt || undefined,
          budget: form.budget ? Number(form.budget) : undefined,
          status: form.status,
          indicatorId: form.indicatorId || undefined,
        },
      }),
    onSuccess: (project) => {
      toast.success('Projeto criado');
      setOpen(false);
      setForm({
        name: '',
        description: '',
        responsible: '',
        startsAt: '',
        endsAt: '',
        budget: '',
        status: 'PLANNED',
        indicatorId: '',
      });
      qc.invalidateQueries({ queryKey: ['projects'] });
      router.push(`/projects/${project.id}`);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível criar o projeto'),
  });

  function openMilestone() {
    if (projects.length === 0) {
      toast.info('Crie um projeto antes de cadastrar um marco');
      return;
    }
    if (projects.length === 1) {
      router.push(`/projects/${projects[0].id}#milestones`);
      return;
    }
    setMilestoneProjectId(projects[0].id);
    setMilestoneOpen(true);
  }

  function exportPortfolio() {
    if (projects.length === 0) return;
    downloadCsv(`portfolio-projetos-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Projeto', 'Status', 'Situação PMO', 'Responsável', 'Início', 'Fim', 'Progresso (%)', 'Orçamento', 'Tarefas vencidas', 'Marcos vencidos'],
      ...projects.map((project) => [
        project.name,
        STATUS_LABEL[project.status] ?? project.status,
        PMO_LABEL[project.pmoStatus],
        project.responsible ?? '',
        project.startsAt ?? '',
        project.endsAt ?? '',
        project.progressOverall,
        project.budget ?? '',
        project.tasksOverdue,
        project.milestonesOverdue,
      ]),
    ]);
  }

  function scrollToGantt() {
    ganttRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projetos e Cronogramas"
        description="Iniciativas estratégicas, cronograma de auditorias, marcos de conformidade e painel PMO integrado."
        actions={canCreate ? <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"><Plus className="mr-1.5 h-4 w-4" />Novo projeto</Button> : null}
      />

      {/* PMO KPIs superiores */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Projetos Ativos" value={formatNumber(pmo?.activeProjects)} change={`${formatNumber(pmo?.totalProjects)} no portfolio`} color="sky" icon={FolderKanban} />
        <KpiCard title="Marcos Concluídos" value={`${formatNumber(pmo?.milestonesDone)}/${formatNumber(pmo?.milestonesTotal)}`} change={`${formatNumber(pmo?.milestonesOverdue)} vencidos`} color="rose" icon={AlertTriangle} />
        <KpiCard title="Orçamento Alocado" value={formatNumber(pmo?.activeBudget, { style: 'currency', currency: 'BRL' })} change={`Total ${formatNumber(pmo?.budgetTotal, { style: 'currency', currency: 'BRL' })}`} color="purple" icon={Wallet} />
        <KpiCard title="Progresso Médio" value={`${formatNumber(pmo?.avgProgress, { maximumFractionDigits: 0 })}%`} change={`${formatNumber(pmo?.behindSchedule)} abaixo do plano`} color="amber" icon={Clock3} />
      </div>

      {/* Ações Rápidas */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
        <QuickActionBtn icon={Plus} title="Criar projeto" onClick={() => setOpen(true)} />
        <QuickActionBtn icon={AlertTriangle} title="Novo marco" onClick={openMilestone} />
        <QuickActionBtn icon={Wallet} title="Previsão financeira" onClick={() => setFinanceOpen(true)} />
        <QuickActionBtn icon={FolderKanban} title="Exportar portfólio" onClick={exportPortfolio} disabled={projects.length === 0} />
        <QuickActionBtn icon={BarChart3} title="Visão Gantt" onClick={scrollToGantt} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,360px]">

        {/* Painel PMO / Gantt Chart SVG */}
        <Card ref={ganttRef} className="scroll-mt-20 border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-855 dark:text-white">
              <BarChart3 className="h-4 w-4 text-sky-500" />
              Cronograma do portfólio (Gantt)
            </h3>
          </div>
          <CardContent className="p-4 space-y-4">

            <div className="overflow-x-auto rounded-xl border border-slate-100 bg-slate-50/40 p-3 dark:border-slate-800/85 dark:bg-slate-900/40">
              {timeline.rows.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Informe as datas de início e fim dos projetos para gerar o Gantt.</div>
              ) : (
                <div className="min-w-[620px] space-y-2">
                  <div className="grid grid-cols-[170px,1fr] items-center gap-3 text-[10px] font-semibold text-muted-foreground">
                    <span>Projeto</span>
                    <div className="flex justify-between"><span>{formatDate(timeline.start.toISOString())}</span><span>{formatDate(timeline.end.toISOString())}</span></div>
                  </div>
                  {timeline.rows.map((row) => (
                    <Link key={row.project.id} href={`/projects/${row.project.id}`} className="grid grid-cols-[170px,1fr] items-center gap-3 rounded-md px-1 py-1.5 hover:bg-muted/50">
                      <span className="truncate text-xs font-medium" title={row.project.name}>{row.project.name}</span>
                      <div className="relative h-6 rounded bg-slate-200/60 dark:bg-slate-800">
                        <div
                          className={cn('absolute top-1 h-4 min-w-2 rounded', row.project.pmoStatus === 'CRITICAL' ? 'bg-rose-500' : row.project.pmoStatus === 'AT_RISK' ? 'bg-amber-500' : 'bg-sky-500')}
                          style={{ left: `${row.left}%`, width: `${row.width}%` }}
                          title={`${formatDate(row.project.startsAt)} a ${formatDate(row.project.endsAt)}`}
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {(pmo?.criticalProjects ?? []).length === 0 && (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground text-center">
                  Nenhum projeto crítico no momento.
                </div>
              )}
              {(pmo?.criticalProjects ?? []).slice(0, 5).map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="flex items-start justify-between gap-3 rounded-xl border p-3 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-all text-xs">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{project.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {project.responsible ?? 'Sem responsável'} - fim {formatDate(project.endsAt)}
                    </div>
                    {project.indicator && (
                      <div className="mt-1 text-[10px] text-sky-500 font-semibold truncate">
                        KPI {project.indicator.code ? `[${project.indicator.code}] ` : ''}{project.indicator.name}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={cn('pill text-[9px] scale-90', PMO_CLASS[project.pmoStatus])}>{PMO_LABEL[project.pmoStatus]}</span>
                    <div className="mt-1 text-[10px] font-bold text-slate-500">{project.progressOverall}%</div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Filtros */}
        <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm h-fit">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Filter className="h-4 w-4" />
              Filtros de Portfólio
            </div>
            <div className="space-y-3">
              <Input
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Buscar projeto, responsável ou KPI"
                className="text-xs"
              />
              <NativeSelect value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className="text-xs">
                <option value="">Todos os status</option>
                {Object.entries(STATUS_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </NativeSelect>
              <NativeSelect value={filters.indicatorId} onChange={(e) => setFilters((prev) => ({ ...prev, indicatorId: e.target.value }))} className="text-xs">
                <option value="">Todos os indicadores</option>
                {(indicatorsQuery.data ?? []).map((ind) => (
                  <option key={ind.id} value={ind.id}>
                    {ind.code ? `[${ind.code}] ` : ''}{ind.name}
                  </option>
                ))}
              </NativeSelect>
              {(filters.search || filters.status || filters.indicatorId) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setFilters({ search: '', status: '', indicatorId: '' })}
                >
                  <X className="mr-2 h-4 w-4" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid de Projetos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {query.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {projects.map((p) => {
          const late = p.endsAt && new Date(p.endsAt) < new Date() && p.status !== 'DONE';
          return (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="cursor-pointer border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm transition-all hover:border-sky-500/40 hover:shadow-md hover:scale-[1.005]">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 dark:bg-sky-950/20 text-sky-500">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={cn('pill text-[9px]', STATUS_PILL[p.status])}>{STATUS_LABEL[p.status]}</span>
                      <span className={cn('pill text-[9px]', PMO_CLASS[p.pmoStatus])}>{PMO_LABEL[p.pmoStatus]}</span>
                    </div>
                  </div>
                  <h3 className="font-bold text-sm text-slate-850 dark:text-white">{p.name}</h3>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                  )}
                  {p.indicator && (
                    <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-500">
                      <span>KPI</span>
                      <span className="max-w-[180px] truncate">{p.indicator.name}</span>
                    </div>
                  )}
                  <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-slate-400">
                    <div>
                      <div className="text-[9px] uppercase font-bold">Inicio</div>
                      <div className="text-slate-700 dark:text-slate-350">{formatDate(p.startsAt)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-bold">Fim previsto</div>
                      <div className={cn('text-slate-700 dark:text-slate-350 font-semibold', late && 'text-status-red')}>
                        {formatDate(p.endsAt)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-bold">Marcos</div>
                      <div className="text-slate-700 dark:text-slate-350">{p.milestonesDone}/{p._count.milestones}</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-400">
                    <div>
                      <div className="text-[9px] uppercase font-bold">Responsável</div>
                      <div className="truncate text-slate-700 dark:text-slate-350 font-medium">{p.responsible ?? 'Não definido'}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-bold">Orçamento</div>
                      <div className="text-slate-700 dark:text-slate-350 font-medium">
                        {p.budget ? formatNumber(p.budget, { style: 'currency', currency: 'BRL' }) : '-'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 border-t pt-3 border-slate-100 dark:border-slate-800/60">
                    <div className="mb-1.5 flex justify-between text-[11px] font-semibold">
                      <span className="text-slate-400">
                        {p._count.tasks} tarefa(s)
                        {p.tasksOverdue > 0 && <span className="ml-1 text-rose-500 font-bold">- {p.tasksOverdue} vencida(s)</span>}
                      </span>
                      <span className="text-slate-750 dark:text-slate-300">{p.progressOverall}%</span>
                    </div>
                    <Progress value={p.progressOverall} />
                    {p.expectedProgress !== null && (
                      <div className="mt-1.5 text-[10px] text-slate-400">
                        Planejado: {p.expectedProgress}% - variação {p.scheduleVariance != null && p.scheduleVariance > 0 ? '+' : ''}{p.scheduleVariance ?? 0}%
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {!query.isLoading && projects.length === 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhum projeto encontrado para os filtros atuais.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Nome do projeto *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Implantação do plano de melhoria operacional"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Escopo, objetivo, entregas esperadas e observações..."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input
                  value={form.responsible}
                  onChange={(e) => setForm({ ...form, responsible: e.target.value })}
                  placeholder="Nome do responsável"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <NativeSelect
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as Project['status'] })}
                >
                  {Object.entries(STATUS_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Inicio</Label>
                <Input
                  type="date"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Fim previsto</Label>
                <Input
                  type="date"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Orçamento</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Indicador vinculado</Label>
              <NativeSelect
                value={form.indicatorId}
                onChange={(e) => setForm({ ...form, indicatorId: e.target.value })}
              >
                <option value="">Sem indicador</option>
                {(indicatorsQuery.data ?? []).map((ind) => (
                  <option key={ind.id} value={ind.id}>
                    {ind.code ? `[${ind.code}] ` : ''}{ind.name}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                O progresso do projeto será comparado com este KPI no detalhe do projeto.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createProject.mutate()}
              disabled={!form.name.trim() || createProject.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {createProject.isPending ? 'Criando...' : 'Criar projeto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={milestoneOpen} onOpenChange={setMilestoneOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Selecionar projeto para o novo marco</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Projeto</Label>
            <NativeSelect value={milestoneProjectId} onChange={(event) => setMilestoneProjectId(event.target.value)}>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </NativeSelect>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMilestoneOpen(false)}>Cancelar</Button>
            <Button
              disabled={!milestoneProjectId}
              onClick={() => {
                setMilestoneOpen(false);
                router.push(`/projects/${milestoneProjectId}#milestones`);
              }}
            >
              Abrir cadastro de marco
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={financeOpen} onOpenChange={setFinanceOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Previsão financeira do portfólio</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-3">
            <MetricCard title="Orçamento total" value={formatNumber(pmo?.budgetTotal, { style: 'currency', currency: 'BRL' })} />
            <MetricCard title="Projetos ativos" value={formatNumber(pmo?.activeBudget, { style: 'currency', currency: 'BRL' })} />
            <MetricCard title="Sem orçamento" value={formatNumber(projects.filter((project) => project.budget == null).length)} />
          </div>
          <div className="max-h-64 divide-y overflow-y-auto rounded-md border">
            {projects.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Nenhum projeto no filtro atual.</div>
            ) : projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} onClick={() => setFinanceOpen(false)} className="flex items-center justify-between gap-4 p-3 text-sm hover:bg-muted/50">
                <div className="min-w-0">
                  <div className="truncate font-medium">{project.name}</div>
                  <div className="text-xs text-muted-foreground">{STATUS_LABEL[project.status]} · {project.progressOverall}% concluído</div>
                </div>
                <strong className="shrink-0">{project.budget == null ? 'Não informado' : formatNumber(project.budget, { style: 'currency', currency: 'BRL' })}</strong>
              </Link>
            ))}
          </div>
          <DialogFooter><Button onClick={() => setFinanceOpen(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toQueryString(filters: { search?: string; status?: string; indicatorId?: string }) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function buildTimeline(projects: Project[]) {
  const dated = projects.filter((project): project is Project & { startsAt: string; endsAt: string } => Boolean(project.startsAt && project.endsAt));
  if (dated.length === 0) {
    const now = new Date();
    return { start: now, end: now, rows: [] as Array<{ project: Project; left: number; width: number }> };
  }
  const start = new Date(Math.min(...dated.map((project) => new Date(project.startsAt).getTime())));
  const end = new Date(Math.max(...dated.map((project) => new Date(project.endsAt).getTime())));
  const total = Math.max(1, end.getTime() - start.getTime());
  const rows = dated.map((project) => {
    const itemStart = new Date(project.startsAt).getTime();
    const itemEnd = new Date(project.endsAt).getTime();
    const left = Math.max(0, ((itemStart - start.getTime()) / total) * 100);
    const width = Math.max(1, ((Math.max(itemStart, itemEnd) - itemStart) / total) * 100);
    return { project, left, width: Math.min(100 - left, width) };
  });
  return { start, end, rows };
}

function KpiCard({ title, value, change, color, icon: Icon }: { title: string; value: any; change: string; color: 'emerald' | 'sky' | 'purple' | 'rose' | 'amber'; icon: any }) {
  const colors = {
    emerald: 'border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/10 dark:bg-emerald-950/10 text-emerald-600 dark:text-emerald-400',
    sky: 'border-sky-100 dark:border-sky-900/30 bg-sky-50/10 dark:bg-sky-950/10 text-sky-600 dark:text-sky-400',
    purple: 'border-purple-100 dark:border-purple-900/30 bg-purple-50/10 dark:bg-purple-950/10 text-purple-600 dark:text-purple-400',
    rose: 'border-rose-100 dark:border-rose-900/30 bg-rose-50/10 dark:bg-rose-950/10 text-rose-600 dark:text-rose-400',
    amber: 'border-amber-100 dark:border-amber-900/30 bg-amber-50/10 dark:bg-amber-950/10 text-amber-600 dark:text-amber-400'
  };

  return (
    <Card className={cn("border bg-card shadow-sm p-4 relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.01] flex items-center justify-between", colors[color])}>
      <div className="space-y-1">
        <span className="text-[10px] uppercase font-bold tracking-wider opacity-85 text-slate-550 dark:text-slate-400">{title}</span>
        <div className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">{value ?? '0'}</div>
        <span className="text-[10px] text-slate-400 font-medium">{change}</span>
      </div>
      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-50 dark:border-slate-800">
        <Icon className="h-5 w-5" />
      </div>
    </Card>
  );
}

function QuickActionBtn({ icon: Icon, title, onClick, disabled = false }: { icon: any; title: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-start gap-3 bg-card border-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 text-slate-700 dark:text-slate-200 h-11 w-full rounded-xl transition-all duration-200 text-xs font-semibold shadow-sm hover:scale-[1.01]"
    >
      <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
        <Icon className="h-4 w-4" />
      </div>
      <span>{title}</span>
    </Button>
  );
}
