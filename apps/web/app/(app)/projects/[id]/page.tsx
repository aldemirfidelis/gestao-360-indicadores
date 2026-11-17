'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Copy, Pencil, Target, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { useAuth } from '@/components/auth/auth-provider';
import { ConfirmDialog } from '@/components/platform/confirm-dialog';
import { ProjectCurve } from '@/components/platform/project-curve';
import { ProcessReferences } from '@/components/processes/process-references';
import { ProjectCosts } from '@/components/projects/project-costs';
import { ProjectFormDialog } from '@/components/projects/project-form-dialog';
import { ProjectRisks } from '@/components/projects/project-risks';
import { ProjectSchedule } from '@/components/projects/project-schedule';
import { ProjectTeam } from '@/components/projects/project-team';
import { ProjectUpdates } from '@/components/projects/project-updates';
import { HEALTH_LABEL, HEALTH_PILL, PMO_CLASS, PMO_LABEL, PRIORITY_LABEL, PRIORITY_PILL, STATUS_LABEL, STATUS_ORDER, STATUS_PILL, formatDay, formatMoney, toDateInput, type LinkedIndicator, type ProjectDetail } from '@/components/projects/types';
import { useProjectAction, useProjectOptions } from '@/components/projects/use-project';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { formatNumber, cn } from '@/lib/utils';
import { getIndicatorUnitLabel } from '@/lib/labels';

const TABS = ['overview', 'schedule', 'costs', 'risks', 'team', 'updates'] as const;
type TabKey = (typeof TABS)[number];

/** Âncoras antigas e atalhos do portfólio abrem a aba correspondente. */
const HASH_TAB: Record<string, TabKey> = {
  '#milestones': 'schedule',
  '#cronograma': 'schedule',
  '#custos': 'costs',
  '#riscos': 'risks',
  '#equipe': 'team',
  '#status': 'updates',
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, hasPermission } = useAuth();
  const canEdit = !user?.isDemo && hasPermission(['projects:update']);
  const canCreate = !user?.isDemo && hasPermission(['projects:create']);
  const canDelete = !user?.isDemo && hasPermission(['projects:delete']);

  const [tab, setTab] = useState<TabKey>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  useEffect(() => {
    const target = HASH_TAB[window.location.hash];
    if (target) setTab(target);
  }, []);

  const query = useQuery<ProjectDetail>({
    queryKey: ['project', id],
    queryFn: () => api<ProjectDetail>(`/projects/${id}`),
  });
  const options = useProjectOptions();
  const action = useProjectAction(id);

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (query.isError) {
    return (
      <div className="space-y-3">
        <p role="alert">Não foi possível carregar o projeto: {query.error.message}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button>
          <Button variant="ghost" asChild><Link href="/projects/cronograma">Voltar aos projetos</Link></Button>
        </div>
      </div>
    );
  }
  if (!query.data) return null;
  const p = query.data;
  const people = options.data?.people ?? [];
  const indicators = options.data?.indicators ?? [];
  const latestUpdate = p.updates[0] ?? null;
  const charter: Array<[string, string | null]> = [
    ['Objetivo', p.objective],
    ['Justificativa', p.justification],
    ['Escopo', p.scope],
    ['Fora do escopo', p.outOfScope],
    ['Premissas e restrições', p.assumptions],
    ['Benefícios esperados', p.benefits],
  ];
  const hasCharter = charter.some(([, value]) => Boolean(value));

  async function removeProject() {
    try {
      await api(`/projects/${id}`, { method: 'DELETE' });
      toast.success('Projeto excluído');
      qc.invalidateQueries({ queryKey: ['projects'] });
      router.push('/projects/cronograma');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível excluir o projeto');
    }
  }

  return (
    <div>
      <Link href="/projects/cronograma" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Projetos
      </Link>

      <PageHeader
        eyebrow={[p.code, p.category].filter(Boolean).join(' · ') || undefined}
        title={p.name}
        description={p.description ?? undefined}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? (
              <NativeSelect
                aria-label="Status do projeto"
                value={p.status}
                disabled={action.isPending}
                onChange={(e) => action.mutate({ path: `/projects/${id}`, method: 'PATCH', json: { status: e.target.value }, success: 'Status atualizado' })}
                className="h-9 w-auto text-xs"
              >
                {STATUS_ORDER.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
              </NativeSelect>
            ) : (
              <span className={cn('pill', STATUS_PILL[p.status])}>{STATUS_LABEL[p.status]}</span>
            )}
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Button>
            )}
            {canCreate && (
              <Button size="sm" variant="outline" onClick={() => setDuplicateOpen(true)}>
                <Copy className="mr-2 h-4 w-4" /> Duplicar
              </Button>
            )}
            {canDelete && (
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </Button>
            )}
          </div>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={cn('pill', PMO_CLASS[p.pmoStatus])}>{PMO_LABEL[p.pmoStatus]}</span>
        <span className={cn('pill', PRIORITY_PILL[p.priority])}>Prioridade {PRIORITY_LABEL[p.priority].toLowerCase()}</span>
        {p.latestHealth && <span className={cn('pill', HEALTH_PILL[p.latestHealth])}>Último relato: {HEALTH_LABEL[p.latestHealth].toLowerCase()}</span>}
        {p.finance.overBudget && <span className="pill pill-red">Orçamento estourado</span>}
      </div>



      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="schedule">Cronograma ({p.tasks.length + p.milestones.length})</TabsTrigger>
          <TabsTrigger value="costs">Custos</TabsTrigger>
          <TabsTrigger value="risks">Riscos ({p.openRisks + p.openIssues})</TabsTrigger>
          <TabsTrigger value="team">Equipe ({p.members.length})</TabsTrigger>
          <TabsTrigger value="updates">Status report ({p.updates.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
<div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">

        <Summary label="Prazo previsto">
          <div className="font-semibold">{formatDay(p.startsAt)} a {formatDay(p.endsAt)}</div>
          {(p.actualStartAt || p.actualEndAt) && (
            <div className="text-xs text-muted-foreground">Real: {formatDay(p.actualStartAt)} a {formatDay(p.actualEndAt)}</div>
          )}
        </Summary>
        <Summary label="Gerente do projeto">
          <div className="truncate font-semibold">{p.manager?.name ?? p.responsible ?? '—'}</div>
          {p.sponsor && <div className="truncate text-xs text-muted-foreground">Patrocinador: {p.sponsor}</div>}
        </Summary>
        <Summary label="Orçamento">
          <div className="font-semibold">{formatMoney(p.finance.budget)}</div>
          <div className={cn('text-xs text-muted-foreground', p.finance.overBudget && 'font-semibold text-status-red')}>
            Realizado: {formatMoney(p.finance.actualCost)}
          </div>
        </Summary>
        <Summary label="Riscos e impedimentos">
          <div className={cn('font-semibold', p.openIssues > 0 && 'text-status-red')}>{p.openRisks + p.openIssues} em aberto</div>
          <div className="text-xs text-muted-foreground">{p.openRisks} risco(s) · {p.openIssues} impedimento(s)</div>
        </Summary>
      </div>
          <ProcessReferences type="PROJECT" targetId={p.id} />

          {(p.milestonesOverdue > 0 || p.tasksOverdue > 0) && <Button className="mb-4" variant="outline" onClick={() => setTab('schedule')}><AlertTriangle className="mr-2 h-4 w-4" />{p.tasksOverdue} tarefas e {p.milestonesOverdue} marcos vencidos</Button>}

          <ProjectCurve curve={p.curve} progress={p.progressOverall} expectedProgress={p.expectedProgress} />

          {latestUpdate && (
            <Card className="mb-6">
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <CardTitle>Último status report</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setTab('updates')}>Ver histórico</Button>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('pill text-[10px]', HEALTH_PILL[latestUpdate.health])}>{HEALTH_LABEL[latestUpdate.health]}</span>
                  <span className="font-semibold">{formatDay(latestUpdate.reportDate)}</span>
                  <span className="text-xs text-muted-foreground">por {latestUpdate.authorName}</span>
                </div>
                <p className="mt-2 whitespace-pre-line">{latestUpdate.summary}</p>
              </CardContent>
            </Card>
          )}

          <Card className="mb-6">
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle>Termo de abertura</CardTitle>
              {canEdit && <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" /> Editar</Button>}
            </CardHeader>
            <CardContent>
              {hasCharter ? (
                <dl className="grid gap-4 md:grid-cols-2">
                  {charter.filter(([, value]) => Boolean(value)).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</dt>
                      <dd className="mt-0.5 whitespace-pre-line text-sm">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Objetivo, justificativa, escopo, premissas e benefícios ainda não foram preenchidos.
                  {canEdit ? ' Use Editar para registrar o termo de abertura.' : ''}
                </p>
              )}
              {p.lessonsLearned && (
                <div className="mt-4 border-t pt-4">
                  <div className="text-[11px] font-semibold uppercase text-muted-foreground">Lições aprendidas</div>
                  <p className="mt-0.5 whitespace-pre-line text-sm">{p.lessonsLearned}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-4 w-4" /> Indicador vinculado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-[280px,1fr]">
                <div className="space-y-2">
                  <Label htmlFor="project-linked-indicator">Selecionar indicador</Label>
                  <NativeSelect
                    id="project-linked-indicator"
                    value={p.indicatorId ?? ''}
                    onChange={(e) => action.mutate({ path: `/projects/${id}`, method: 'PATCH', json: { indicatorId: e.target.value }, success: 'Indicador atualizado' })}
                    disabled={!canEdit || action.isPending}
                  >
                    <option value="">Sem indicador</option>
                    {indicators.map((ind) => (
                      <option key={ind.id} value={ind.id}>
                        {ind.code ? `[${ind.code}] ` : ''}{ind.name}
                      </option>
                    ))}
                  </NativeSelect>
                  <p className="text-xs text-muted-foreground">
                    Vincule um KPI para acompanhar o impacto do projeto.
                  </p>
                </div>
                {p.indicator ? (
                  <IndicatorImpactPanel indicator={p.indicator} />
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nenhum indicador vinculado. Escolha um KPI ao lado para ver tendência e atingimento.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <ProjectSchedule project={p} canEdit={canEdit} action={action} people={people} />
        </TabsContent>
        <TabsContent value="costs">
          <ProjectCosts project={p} canEdit={canEdit} action={action} />
        </TabsContent>
        <TabsContent value="risks">
          <ProjectRisks project={p} canEdit={canEdit} action={action} people={people} />
        </TabsContent>
        <TabsContent value="team">
          <ProjectTeam project={p} canEdit={canEdit} action={action} people={people} />
        </TabsContent>
        <TabsContent value="updates">
          <ProjectUpdates project={p} canEdit={canEdit} action={action} />
        </TabsContent>
      </Tabs>

      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={p} />
      <DuplicateDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        project={p}
        onCreated={(created) => router.push(`/projects/${created.id}`)}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir projeto"
        description={`“${p.name}” sairá do portfólio com seu cronograma, custos, riscos, equipe e status reports.`}
        confirmLabel="Excluir projeto"
        destructive
        onConfirm={removeProject}
      />
    </div>
  );
}

function Summary({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
        {children}
      </CardContent>
    </Card>
  );
}

function DuplicateDialog({
  open,
  onOpenChange,
  project,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectDetail;
  onCreated: (project: { id: string }) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(`${project.name} (cópia)`.slice(0, 180));
    setStartsAt(toDateInput(project.startsAt));
  }, [open, project.name, project.startsAt]);

  const duplicate = useMutation({
    mutationFn: () => api<{ id: string }>(`/projects/${project.id}/duplicate`, {
      method: 'POST',
      json: { name: name.trim(), startsAt: startsAt || undefined },
    }),
    onSuccess: (created) => {
      toast.success('Projeto duplicado');
      qc.invalidateQueries({ queryKey: ['projects'] });
      onOpenChange(false);
      onCreated(created);
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível duplicar o projeto'),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !duplicate.isPending && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Duplicar projeto</DialogTitle>
          <DialogDescription>
            O novo projeto recebe o cadastro, as tarefas, os marcos e a equipe deste, com avanço zerado.
            Custos, riscos e status reports não são copiados.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="duplicate-name">Nome do novo projeto *</Label>
            <Input id="duplicate-name" value={name} maxLength={180} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duplicate-start">Nova data de início</Label>
            <Input id="duplicate-start" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              {project.startsAt
                ? 'As datas das tarefas e dos marcos são deslocadas pelo mesmo intervalo.'
                : 'O projeto original não tem data de início; as datas das tarefas e dos marcos são mantidas.'}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={duplicate.isPending} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => duplicate.mutate()} disabled={!name.trim() || duplicate.isPending}>
            {duplicate.isPending ? 'Duplicando...' : 'Duplicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IndicatorImpactPanel({ indicator }: { indicator: LinkedIndicator }) {
  const latest = indicator.results[0];
  const previous = indicator.results[1];
  const trendUp = latest && previous ? latest.value > previous.value : null;
  const onTarget = latest?.light === 'GREEN' || latest?.light === 'BLUE';
  const unitLabel = getIndicatorUnitLabel(indicator.unit, indicator.unitLabel);
  const valueColor = !latest
    ? 'text-muted-foreground'
    : onTarget
      ? 'text-[hsl(var(--status-green))]'
      : latest.light === 'YELLOW'
        ? 'text-[hsl(var(--status-yellow))]'
        : 'text-[hsl(var(--status-red))]';

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase text-muted-foreground">
            {indicator.code && <span className="mr-2 font-mono">[{indicator.code}]</span>}
            {indicator.ownerNode?.name ?? 'KPI'}
          </div>
          <div className="truncate font-semibold">{indicator.name}</div>
        </div>
        <Link
          href={`/indicators/${indicator.id}`}
          className="shrink-0 text-xs text-primary hover:underline"
        >
          Ver detalhes →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Atual</div>
          <div className={cn('text-xl font-bold', valueColor)}>
            {latest ? formatIndicatorValue(latest.value, unitLabel) : '—'}
          </div>
          {latest && (
            <div className="text-[10px] text-muted-foreground">{latest.periodRef}</div>
          )}
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Atingimento</div>
          <div className="text-xl font-bold">
            {latest?.attainment != null ? `${Math.round(latest.attainment)}%` : '—'}
          </div>
          <Progress value={Math.min(100, Math.max(0, latest?.attainment ?? 0))} className="mt-1 h-1.5" />
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Tendência</div>
          <div className="flex items-center gap-1.5 text-xl font-bold">
            {trendUp === null ? (
              '—'
            ) : trendUp ? (
              <>
                <TrendingUp className="h-5 w-5 text-[hsl(var(--status-green))]" />
                <span className="text-[hsl(var(--status-green))]">Subindo</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-5 w-5 text-[hsl(var(--status-red))]" />
                <span className="text-[hsl(var(--status-red))]">Caindo</span>
              </>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {indicator.direction === 'HIGHER_BETTER' ? 'Maior é melhor' : 'Menor é melhor'}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatIndicatorValue(value: number, unitLabel: string) {
  const formatted = formatNumber(value);
  if (unitLabel === 'R$') return `R$ ${formatted}`;
  if (unitLabel === '%') return `${formatted}%`;
  return unitLabel ? `${formatted} ${unitLabel}` : formatted;
}
