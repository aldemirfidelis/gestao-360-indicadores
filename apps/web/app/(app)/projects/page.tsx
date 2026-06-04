'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
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
  CRITICAL: 'Critico',
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
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel criar o projeto'),
  });

  return (
    <div>
      <PageHeader
        title="Projetos"
        description="Iniciativas estrategicas com cronograma, marcos, tarefas e painel PMO."
        actions={canCreate ? <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Novo projeto</Button> : null}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Projetos ativos" value={formatNumber(pmo?.activeProjects)} description={`${formatNumber(pmo?.totalProjects)} no portfolio`} icon={<FolderKanban className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Marcos vencidos" value={formatNumber(pmo?.milestonesOverdue)} description={`${formatNumber(pmo?.milestonesDone)} de ${formatNumber(pmo?.milestonesTotal)} concluidos`} icon={<AlertTriangle className="h-4 w-4" />} tone={(pmo?.milestonesOverdue ?? 0) > 0 ? 'red' : 'green'} />
        <MetricCard title="Orcamento ativo" value={formatNumber(pmo?.activeBudget, { style: 'currency', currency: 'BRL' })} description={`Total ${formatNumber(pmo?.budgetTotal, { style: 'currency', currency: 'BRL' })}`} icon={<Wallet className="h-4 w-4" />} tone="purple" />
        <MetricCard title="Progresso medio" value={`${formatNumber(pmo?.avgProgress, { maximumFractionDigits: 0 })}%`} description={`${formatNumber(pmo?.behindSchedule)} abaixo do plano`} icon={<Clock3 className="h-4 w-4" />} tone="yellow" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr,360px]">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Painel PMO</div>
                <div className="text-xs text-muted-foreground">Projetos criticos e em risco no portfolio autorizado.</div>
              </div>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              {(pmo?.criticalProjects ?? []).length === 0 && (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Nenhum projeto critico no momento.
                </div>
              )}
              {(pmo?.criticalProjects ?? []).slice(0, 5).map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="flex items-start justify-between gap-3 rounded-md border p-3 transition hover:bg-accent/35">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{project.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {project.responsible ?? 'Sem responsavel'} - fim {formatDate(project.endsAt)}
                    </div>
                    {project.indicator && (
                      <div className="mt-1 text-[11px] text-primary">
                        KPI {project.indicator.code ? `[${project.indicator.code}] ` : ''}{project.indicator.name}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={cn('pill', PMO_CLASS[project.pmoStatus])}>{PMO_LABEL[project.pmoStatus]}</span>
                    <div className="mt-1 text-xs text-muted-foreground">{project.progressOverall}%</div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Filter className="h-4 w-4" />
              Filtros
            </div>
            <div className="space-y-3">
              <Input
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Buscar projeto, responsavel ou KPI"
              />
              <NativeSelect value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="">Todos os status</option>
                {Object.entries(STATUS_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </NativeSelect>
              <NativeSelect value={filters.indicatorId} onChange={(e) => setFilters((prev) => ({ ...prev, indicatorId: e.target.value }))}>
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
                  className="w-full"
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {query.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {projects.map((p) => {
          const late = p.endsAt && new Date(p.endsAt) < new Date() && p.status !== 'DONE';
          return (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="cursor-pointer transition-all hover:border-primary/40 hover:shadow-md">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={cn('pill', STATUS_PILL[p.status])}>{STATUS_LABEL[p.status]}</span>
                      <span className={cn('pill', PMO_CLASS[p.pmoStatus])}>{PMO_LABEL[p.pmoStatus]}</span>
                    </div>
                  </div>
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                  )}
                  {p.indicator && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                      <span>KPI</span>
                      <span className="max-w-[180px] truncate">{p.indicator.name}</span>
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                    <div>
                      <div className="text-[10px] uppercase">Inicio</div>
                      <div className="text-foreground">{formatDate(p.startsAt)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase">Fim previsto</div>
                      <div className={cn('text-foreground', late && 'text-status-red')}>
                        {formatDate(p.endsAt)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase">Marcos</div>
                      <div className="text-foreground">{p.milestonesDone}/{p._count.milestones}</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div>
                      <div className="text-[10px] uppercase">Responsavel</div>
                      <div className="truncate text-foreground">{p.responsible ?? 'Nao definido'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase">Orcamento</div>
                      <div className="text-foreground">
                        {p.budget ? formatNumber(p.budget, { style: 'currency', currency: 'BRL' }) : '-'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {p._count.tasks} tarefa(s)
                        {p.tasksOverdue > 0 && <span className="ml-1 text-status-red">- {p.tasksOverdue} vencida(s)</span>}
                      </span>
                      <span className="font-medium">{p.progressOverall}%</span>
                    </div>
                    <Progress value={p.progressOverall} />
                    {p.expectedProgress !== null && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Planejado: {p.expectedProgress}% - variacao {p.scheduleVariance != null && p.scheduleVariance > 0 ? '+' : ''}{p.scheduleVariance ?? 0}%
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Nome do projeto *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Implantacao do plano de melhoria operacional"
              />
            </div>
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Escopo, objetivo, entregas esperadas e observacoes..."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Responsavel</Label>
                <Input
                  value={form.responsible}
                  onChange={(e) => setForm({ ...form, responsible: e.target.value })}
                  placeholder="Nome do responsavel"
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
                <Label>Orcamento</Label>
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
                O progresso do projeto sera comparado com este KPI no detalhe do projeto.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createProject.mutate()}
              disabled={!form.name.trim() || createProject.isPending}
            >
              {createProject.isPending ? 'Criando...' : 'Criar projeto'}
            </Button>
          </DialogFooter>
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
