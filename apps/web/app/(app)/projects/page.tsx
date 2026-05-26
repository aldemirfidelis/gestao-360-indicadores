'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Clock3, FolderKanban, Plus } from 'lucide-react';
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
import { formatDate, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

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

export default function ProjectsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
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
    queryKey: ['projects'],
    queryFn: () => api<Project[]>('/projects'),
  });

  const indicatorsQuery = useQuery<IndicatorOption[]>({
    queryKey: ['projects', 'indicators'],
    queryFn: () => api<IndicatorOption[]>('/projects/indicators'),
    staleTime: 60_000,
  });

  const projects = useMemo(() => query.data ?? [], [query.data]);
  const inProgress = projects.filter((p) => p.status === 'IN_PROGRESS').length;
  const done = projects.filter((p) => p.status === 'DONE').length;
  const overdue = projects.filter((p) => p.endsAt && new Date(p.endsAt) < new Date() && p.status !== 'DONE').length;
  const avgProgress = projects.length
    ? Math.round(projects.reduce((acc, p) => acc + p.progressOverall, 0) / projects.length)
    : 0;

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

  return (
    <div>
      <PageHeader
        title="Projetos"
        description="Iniciativas estratégicas com cronograma, marcos e tarefas."
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Novo projeto</Button>}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Projetos ativos" value={formatNumber(inProgress)} description={`${formatNumber(projects.length)} no total`} icon={<FolderKanban className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Concluidos" value={formatNumber(done)} description="Entregas finalizadas" icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
        <MetricCard title="Atrasados" value={formatNumber(overdue)} description="Fim previsto vencido" icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <MetricCard title="Progresso medio" value={`${avgProgress}%`} description="Com base nos marcos" icon={<Clock3 className="h-4 w-4" />} tone="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {query.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {projects.map((p) => {
          const late = p.endsAt && new Date(p.endsAt) < new Date() && p.status !== 'DONE';
          return (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <span className={cn('pill', STATUS_PILL[p.status])}>{STATUS_LABEL[p.status]}</span>
                  </div>
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                  )}
                  {p.indicator && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                      <span>KPI</span>
                      <span className="truncate max-w-[180px]">{p.indicator.name}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground mt-3">
                    <div>
                      <div className="text-[10px] uppercase">Início</div>
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
                      <div className="text-foreground">{p._count.milestones}</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div>
                      <div className="text-[10px] uppercase">Responsável</div>
                      <div className="truncate text-foreground">{p.responsible ?? 'Não definido'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase">Orcamento</div>
                      <div className="text-foreground">
                        {p.budget ? formatNumber(p.budget, { style: 'currency', currency: 'BRL' }) : '-'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{p._count.tasks} tarefa(s)</span>
                      <span className="font-medium">{p.progressOverall}%</span>
                    </div>
                    <Progress value={p.progressOverall} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {!query.isLoading && projects.length === 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhum projeto cadastrado. Use o botão Novo projeto para iniciar um cronograma.
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
              <Label>Descrição</Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Escopo, objetivo, entregas esperadas e observacoes..."
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
                <Label>Início</Label>
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
