'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Clock3, Columns3, Filter, Flag, FolderKanban, LayoutGrid, List, Plus, Wallet, X } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { EmptyState } from '@/components/platform/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetricCard } from '@/components/platform/metric-card';
import { ProjectFormDialog } from '@/components/projects/project-form-dialog';
import {
  HEALTH_LABEL,
  HEALTH_PILL,
  PMO_CLASS,
  PMO_LABEL,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  PRIORITY_PILL,
  STATUS_LABEL,
  STATUS_ORDER,
  STATUS_PILL,
  formatDay,
  formatMoney,
  isOverdue,
  toDateInput,
  type PortfolioSummary,
  type ProjectSummary,
} from '@/components/projects/types';
import { useProjectOptions } from '@/components/projects/use-project';
import { PortfolioGantt } from '@/components/projects/portfolio-gantt';
import { PortfolioAgenda, PortfolioCurveCard, usePortfolioExecution } from '@/components/projects/portfolio-execution';
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
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { downloadCsv } from '@/lib/compensation/format';
import { cn, formatNumber } from '@/lib/utils';

type Filters = { search: string; status: string; priority: string; managerId: string; indicatorId: string };
type ViewMode = 'cards' | 'list' | 'board';

const EMPTY_FILTERS: Filters = { search: '', status: '', priority: '', managerId: '', indicatorId: '' };
const VIEWS: Array<{ key: ViewMode; label: string; icon: typeof LayoutGrid }> = [
  { key: 'cards', label: 'Cartões', icon: LayoutGrid },
  { key: 'list', label: 'Lista', icon: List },
  { key: 'board', label: 'Quadro', icon: Columns3 },
];

export default function ProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { user, hasPermission } = useAuth();
  const canCreate = !user?.isDemo && hasPermission(['projects:create']);
  const canEdit = !user?.isDemo && hasPermission(['projects:update']);
  const [open, setOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [milestoneProjectId, setMilestoneProjectId] = useState('');
  const [view, setView] = useState<ViewMode>('cards');
  const [section, setSection] = useState('projects');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: searchParams.get('search') ?? '',
    status: searchParams.get('status') ?? '',
    priority: searchParams.get('priority') ?? '',
    managerId: searchParams.get('managerId') ?? '',
    indicatorId: searchParams.get('indicatorId') ?? '',
  });
  const hasFilters = Object.values(filters).some(Boolean);

  const query = useQuery<ProjectSummary[]>({
    queryKey: ['projects', filters],
    queryFn: () => api<ProjectSummary[]>(`/projects${toQueryString(filters)}`),
  });

  const portfolio = useQuery<PortfolioSummary>({
    queryKey: ['projects', 'portfolio', filters],
    queryFn: () => api<PortfolioSummary>(`/projects/portfolio${toQueryString(filters)}`),
  });

  const options = useProjectOptions();

  const execution = usePortfolioExecution(filters);

  const projects = useMemo(() => query.data ?? [], [query.data]);
  const pmo = portfolio.data;

  // Filtros na URL desta tela: "/projects" agora é a Ata da reunião e levaria o usuário embora.
  useEffect(() => {
    router.replace(`/projects/cronograma${toQueryString(filters)}`, { scroll: false });
  }, [filters, router]);

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(`/projects/${id}`, { method: 'PATCH', json: { status } }),
    onSuccess: () => {
      toast.success('Status atualizado');
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (e: Error) => toast.error(e.message || 'Não foi possível atualizar o status'),
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
      ['Código', 'Projeto', 'Categoria', 'Status', 'Prioridade', 'Situação PMO', 'Gerente', 'Início', 'Fim', 'Progresso (%)', 'Planejado (%)', 'Orçamento', 'Custo realizado', 'Riscos abertos', 'Impedimentos abertos', 'Tarefas vencidas', 'Marcos vencidos'],
      ...projects.map((project) => [
        project.code ?? '',
        project.name,
        project.category ?? '',
        STATUS_LABEL[project.status] ?? project.status,
        PRIORITY_LABEL[project.priority] ?? '',
        PMO_LABEL[project.pmoStatus],
        project.responsible ?? '',
        toDateInput(project.startsAt),
        toDateInput(project.endsAt),
        project.progressOverall,
        project.expectedProgress ?? '',
        project.budget ?? '',
        project.finance?.actualCost ?? '',
        project.openRisks ?? 0,
        project.openIssues ?? 0,
        project.tasksOverdue,
        project.milestonesOverdue,
      ]),
    ]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projetos e Cronogramas"
        description="Acompanhe entregas, prazos e custos."
        actions={canCreate ? <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"><Plus className="mr-1.5 h-4 w-4" />Novo projeto</Button> : null}
        summary={
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard title="Projetos Ativos" value={formatNumber(pmo?.activeProjects)} change={`${formatNumber(pmo?.totalProjects)} no portfólio`} color="sky" icon={FolderKanban} />
            <KpiCard title="Progresso Médio" value={`${formatNumber(pmo?.avgProgress, { maximumFractionDigits: 0 })}%`} change={`${formatNumber(pmo?.behindSchedule)} abaixo do plano`} color="amber" icon={Clock3} />
            <KpiCard title="Tarefas Vencidas" value={formatNumber(pmo?.tasksOverdue)} change={`${formatNumber(pmo?.milestonesOverdue)} marcos vencidos · ${formatNumber((pmo?.openRisks ?? 0) + (pmo?.openIssues ?? 0))} riscos/impedimentos`} color="rose" icon={AlertTriangle} />
            <KpiCard title="Orçamento Ativo" value={formatMoney(pmo?.activeBudget ?? 0)} change={`Realizado ${formatMoney(pmo?.actualCost ?? 0)}`} color="purple" icon={Wallet} />
          </div>
        }
      />

        {/* Filtros */}
        <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm h-fit">
          <CardContent className="space-y-3 p-3">
            <div className="flex items-center gap-2">
              <Input
                aria-label="Buscar projeto"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Buscar projeto..."
                className="text-xs"
              />
              <Button variant="outline" aria-expanded={showFilters} aria-controls="portfolio-filters" onClick={() => setShowFilters((value) => !value)}><Filter className="mr-2 h-4 w-4" />Filtros{[filters.status, filters.priority, filters.managerId, filters.indicatorId].filter(Boolean).length > 0 ? ` (${[filters.status, filters.priority, filters.managerId, filters.indicatorId].filter(Boolean).length})` : ''}</Button>
              {hasFilters && <Button size="icon" variant="ghost" aria-label="Limpar filtros" onClick={() => setFilters(EMPTY_FILTERS)}><X className="h-4 w-4" /></Button>}
            </div>
            <div id="portfolio-filters" hidden={!showFilters}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <NativeSelect aria-label="Filtrar por status" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className="text-xs">
                <option value="">Todos os status</option>
                {STATUS_ORDER.map((key) => <option key={key} value={key}>{STATUS_LABEL[key]}</option>)}
              </NativeSelect>
              <NativeSelect aria-label="Filtrar por prioridade" value={filters.priority} onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))} className="text-xs">
                <option value="">Todas as prioridades</option>
                {PRIORITY_ORDER.map((key) => <option key={key} value={key}>Prioridade {PRIORITY_LABEL[key].toLowerCase()}</option>)}
              </NativeSelect>
              <NativeSelect aria-label="Filtrar por gerente" value={filters.managerId} onChange={(e) => setFilters((prev) => ({ ...prev, managerId: e.target.value }))} className="text-xs">
                <option value="">Todos os gerentes</option>
                {(options.data?.people ?? []).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </NativeSelect>
              <NativeSelect aria-label="Filtrar por indicador" value={filters.indicatorId} onChange={(e) => setFilters((prev) => ({ ...prev, indicatorId: e.target.value }))} className="text-xs">
                <option value="">Todos os indicadores</option>
                {(options.data?.indicators ?? []).map((ind) => (
                  <option key={ind.id} value={ind.id}>
                    {ind.code ? `[${ind.code}] ` : ''}{ind.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            </div>
          </CardContent>
        </Card>

      <div className="flex flex-wrap gap-2">
        {canEdit && <Button variant="outline" size="sm" onClick={openMilestone}><Flag className="mr-2 h-4 w-4" />Novo marco</Button>}
        <Button variant="outline" size="sm" onClick={() => setFinanceOpen(true)}><Wallet className="mr-2 h-4 w-4" />Previsão financeira</Button>
        <Button variant="outline" size="sm" onClick={exportPortfolio} disabled={projects.length === 0}><FolderKanban className="mr-2 h-4 w-4" />Exportar</Button>
      </div>
      <Tabs value={section} onValueChange={setSection}>
        <TabsList aria-label="Visões do portfólio">
          <TabsTrigger value="projects">Projetos</TabsTrigger>
          <TabsTrigger value="schedule">Cronograma</TabsTrigger>
          <TabsTrigger value="execution">Curva S e agenda</TabsTrigger>
        </TabsList>
        <TabsContent value="projects" className="space-y-4">      {/* Projetos: cartões, lista ou quadro por status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Projetos ({projects.length})</h2>
        <div className="inline-flex rounded-md border bg-muted/35 p-1" role="group" aria-label="Modo de exibição">
          {VIEWS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={cn('inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium transition-colors', view === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {query.isError && (
        <div className="space-y-2" role="alert">
          <p className="text-sm">Não foi possível carregar os projetos: {query.error.message}</p>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>Tentar novamente</Button>
        </div>
      )}

      {!query.isLoading && !query.isError && projects.length === 0 && (
        <EmptyState
          icon={<FolderKanban className="h-5 w-5" strokeWidth={1.5} />}
          title={hasFilters ? 'Nenhum projeto encontrado para os filtros atuais' : 'Nenhum projeto cadastrado'}
          description={hasFilters
            ? 'Ajuste ou limpe os filtros para ver outros projetos.'
            : 'Cadastre o primeiro projeto para montar o cronograma, acompanhar a curva S, os custos, os riscos e a equipe.'}
          action={hasFilters
            ? <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>Limpar filtros</Button>
            : undefined}
        />
      )}

      {view === 'cards' && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}

      {view === 'list' && projects.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Projeto</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Prioridade</th>
                  <th className="px-3 py-2 font-medium">Gerente</th>
                  <th className="px-3 py-2 font-medium">Prazo</th>
                  <th className="w-40 px-3 py-2 font-medium">Progresso</th>
                  <th className="px-3 py-2 text-right font-medium">Orçamento</th>
                  <th className="px-3 py-2 text-right font-medium">Realizado</th>
                  <th className="px-3 py-2 text-right font-medium">Riscos</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2">
                      <Link href={`/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                      <div className="text-xs text-muted-foreground">{[p.code, p.category].filter(Boolean).join(' · ') || '—'}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-start gap-1">
                        <span className={cn('pill text-[10px]', STATUS_PILL[p.status])}>{STATUS_LABEL[p.status]}</span>
                        <span className={cn('pill text-[10px]', PMO_CLASS[p.pmoStatus])}>{PMO_LABEL[p.pmoStatus]}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2"><span className={cn('pill text-[10px]', PRIORITY_PILL[p.priority])}>{PRIORITY_LABEL[p.priority]}</span></td>
                    <td className="px-3 py-2 text-xs">{p.responsible ?? '—'}</td>
                    <td className={cn('whitespace-nowrap px-3 py-2 text-xs', isLate(p) && 'font-semibold text-status-red')}>
                      {formatDay(p.startsAt)} a {formatDay(p.endsAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Progress value={p.progressOverall} className="h-1.5" />
                        <span className="w-9 text-right text-xs tabular-nums">{p.progressOverall}%</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums">{formatMoney(p.budget)}</td>
                    <td className={cn('whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums', p.finance?.overBudget && 'font-semibold text-status-red')}>{formatMoney(p.finance?.actualCost ?? 0)}</td>
                    <td className={cn('px-3 py-2 text-right text-xs tabular-nums', (p.openIssues ?? 0) > 0 && 'font-semibold text-status-red')}>{(p.openRisks ?? 0) + (p.openIssues ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {view === 'board' && projects.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {STATUS_ORDER.map((status) => {
            const column = projects.filter((p) => p.status === status);
            return (
              <section key={status} aria-label={STATUS_LABEL[status]} className="rounded-lg border bg-muted/20 p-2">
                <header className="mb-2 flex items-center justify-between px-1">
                  <span className={cn('pill text-[10px]', STATUS_PILL[status])}>{STATUS_LABEL[status]}</span>
                  <span className="text-xs text-muted-foreground">{column.length}</span>
                </header>
                <div className="space-y-2">
                  {column.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">Nenhum projeto</p>}
                  {column.map((p) => (
                    <div key={p.id} className="rounded-md border bg-card p-3 text-xs shadow-sm">
                      <Link href={`/projects/${p.id}`} className="font-semibold hover:underline">{p.name}</Link>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{p.code ?? ''}{p.responsible ? ` · ${p.responsible}` : ''}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className={cn('pill text-[9px]', PMO_CLASS[p.pmoStatus])}>{PMO_LABEL[p.pmoStatus]}</span>
                        <span className={cn('pill text-[9px]', PRIORITY_PILL[p.priority])}>{PRIORITY_LABEL[p.priority]}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={p.progressOverall} className="h-1.5" />
                        <span className="tabular-nums">{p.progressOverall}%</span>
                      </div>
                      <div className={cn('mt-1 text-[10px] text-muted-foreground', isLate(p) && 'font-semibold text-status-red')}>Fim: {formatDay(p.endsAt)}</div>
                      {canEdit && (
                        <NativeSelect
                          aria-label={`Mover ${p.name} para outro status`}
                          value={p.status}
                          disabled={changeStatus.isPending}
                          onChange={(e) => changeStatus.mutate({ id: p.id, status: e.target.value })}
                          className="mt-2 h-8 text-[11px]"
                        >
                          {STATUS_ORDER.map((key) => <option key={key} value={key}>{STATUS_LABEL[key]}</option>)}
                        </NativeSelect>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

</TabsContent>
        <TabsContent value="schedule">
          <Card><CardContent className="p-4"><PortfolioGantt projects={projects} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="execution">
          {execution.isLoading && <p className="text-sm text-muted-foreground">Carregando execução...</p>}
          {execution.isError && <p role="alert" className="text-sm">Não foi possível carregar a execução: {execution.error.message}</p>}
          {!execution.isLoading && !execution.isError && projects.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhum projeto para acompanhar neste filtro.</p>}
                {/* Execução do portfólio: curva S consolidada e agenda de marcos e tarefas */}
      {projects.length > 0 && execution.data && (
        <section aria-label="Execução do portfólio">
          <PortfolioCurveCard curve={execution.data.curve} />
          <PortfolioAgenda data={execution.data} canEdit={canEdit} />
        </section>
      )}

        </TabsContent>
      </Tabs>

      <ProjectFormDialog open={open} onOpenChange={setOpen} onSaved={(project) => router.push(`/projects/${project.id}`)} />

      <Dialog open={milestoneOpen} onOpenChange={setMilestoneOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Selecionar projeto para o novo marco</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="milestone-project">Projeto</Label>
            <NativeSelect id="milestone-project" value={milestoneProjectId} onChange={(event) => setMilestoneProjectId(event.target.value)}>
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
              Abrir cronograma do projeto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={financeOpen} onOpenChange={setFinanceOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Previsão financeira do portfólio</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-4">
            <MetricCard title="Orçamento total" value={formatMoney(pmo?.budgetTotal ?? 0)} />
            <MetricCard title="Custo previsto" value={formatMoney(pmo?.plannedCost ?? 0)} />
            <MetricCard title="Custo realizado" value={formatMoney(pmo?.actualCost ?? 0)} />
            <MetricCard title="Acima do orçamento" value={formatNumber(pmo?.overBudget)} />
          </div>
          <div className="max-h-64 divide-y overflow-y-auto rounded-md border">
            {projects.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Nenhum projeto no filtro atual.</div>
            ) : projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}#custos`} onClick={() => setFinanceOpen(false)} className="flex items-center justify-between gap-4 p-3 text-sm hover:bg-muted/50">
                <div className="min-w-0">
                  <div className="truncate font-medium">{project.name}</div>
                  <div className="text-xs text-muted-foreground">{STATUS_LABEL[project.status]} · {project.progressOverall}% concluído</div>
                </div>
                <div className="shrink-0 text-right">
                  <strong>{project.budget == null ? 'Sem orçamento' : formatMoney(project.budget)}</strong>
                  <div className={cn('text-xs text-muted-foreground', project.finance?.overBudget && 'font-semibold text-status-red')}>
                    Realizado {formatMoney(project.finance?.actualCost ?? 0)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <DialogFooter><Button onClick={() => setFinanceOpen(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isLate(project: ProjectSummary) {
  return project.status !== 'DONE' && project.status !== 'CANCELLED' && isOverdue(project.endsAt);
}

function ProjectCard({ project: p }: { project: ProjectSummary }) {
  const late = isLate(p);
  return (
    <Link href={`/projects/${p.id}`}>
      <Card className="h-full cursor-pointer border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm transition-all hover:border-sky-500/40 hover:shadow-md hover:scale-[1.005]">
        <CardContent className="p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 dark:bg-sky-950/20 text-sky-500">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              <span className={cn('pill text-[9px]', STATUS_PILL[p.status])}>{STATUS_LABEL[p.status]}</span>
              <span className={cn('pill text-[9px]', PMO_CLASS[p.pmoStatus])}>{PMO_LABEL[p.pmoStatus]}</span>
              <span className={cn('pill text-[9px]', PRIORITY_PILL[p.priority])}>{PRIORITY_LABEL[p.priority]}</span>
              {p.latestHealth && <span className={cn('pill text-[9px]', HEALTH_PILL[p.latestHealth])}>{HEALTH_LABEL[p.latestHealth]}</span>}
            </div>
          </div>
          {(p.code || p.category) && (
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{[p.code, p.category].filter(Boolean).join(' · ')}</div>
          )}
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
              <div className="text-[9px] uppercase font-bold">Início</div>
              <div className="text-slate-700 dark:text-slate-350">{formatDay(p.startsAt)}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase font-bold">Fim previsto</div>
              <div className={cn('text-slate-700 dark:text-slate-350 font-semibold', late && 'text-status-red')}>
                {formatDay(p.endsAt)}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase font-bold">Marcos</div>
              <div className="text-slate-700 dark:text-slate-350">{p.milestonesDone}/{p._count.milestones}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-slate-400">
            <div>
              <div className="text-[9px] uppercase font-bold">Gerente</div>
              <div className="truncate text-slate-700 dark:text-slate-350 font-medium">{p.responsible ?? 'Não definido'}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase font-bold">Orçamento</div>
              <div className={cn('text-slate-700 dark:text-slate-350 font-medium', p.finance?.overBudget && 'text-status-red')}>
                {p.budget ? formatMoney(p.budget) : '-'}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase font-bold">Riscos abertos</div>
              <div className={cn('text-slate-700 dark:text-slate-350 font-medium', (p.openIssues ?? 0) > 0 && 'text-status-red')}>
                {(p.openRisks ?? 0) + (p.openIssues ?? 0)}
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
                Planejado: {p.expectedProgress}% - variação {p.scheduleVariance != null && p.scheduleVariance > 0 ? '+' : ''}{p.scheduleVariance ?? 0} p.p.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function toQueryString(filters: Partial<Filters>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function KpiCard({ title, value, change, color, icon: Icon }: { title: string; value: any; change: string; color: 'emerald' | 'sky' | 'purple' | 'rose' | 'amber'; icon: any }) {
  const tones = { emerald: 'green', sky: 'blue', purple: 'purple', rose: 'red', amber: 'yellow' } as const;
  return <MetricCard compact title={title} value={value ?? '0'} description={change} tone={tones[color]} icon={<Icon className="h-4 w-4" />} />;
}
