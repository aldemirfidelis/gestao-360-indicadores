'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, ThumbsDown, ThumbsUp } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/training/training-bits';
import type { TrainingItem } from '@/lib/training/types';

interface EffectivenessItem {
  id: string;
  dueAt?: string | null;
  overdue: boolean;
  assignmentId: string;
  employee: { id: string; name: string; registrationId?: string | null; job?: { name: string } | null; orgNode?: { name: string } | null };
  training: { id: string; code: string; name: string };
  completedAt?: string | null;
}

interface PlanAction {
  id: string;
  description: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  training?: { id: string; code: string; name: string } | null;
  dueAt?: string | null;
  completedAt?: string | null;
  evidence?: string | null;
}

interface Plan {
  id: string;
  employee: { id: string; name: string; job?: { name: string } | null; orgNode?: { name: string } | null };
  title: string;
  origin: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  competency?: string | null;
  objective?: string | null;
  dueAt?: string | null;
  progress: number | null;
  actions: PlanAction[];
}

const ORIGIN_LABEL: Record<string, string> = {
  PERFORMANCE_REVIEW: 'Avaliação de desempenho',
  MANAGER_REQUEST: 'Necessidade do gestor',
  JOB_CHANGE: 'Mudança de cargo',
  SUCCESSION: 'Plano de sucessão',
  COMPETENCY_GAP: 'Lacuna de competência',
  AUDIT: 'Auditoria',
  OPERATIONAL_NEED: 'Necessidade operacional',
  EMPLOYEE_REQUEST: 'Solicitação do colaborador',
};

const ACTION_STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Planejada',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluída',
  CANCELLED: 'Cancelada',
};

const PLAN_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Em andamento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

export default function DesenvolvimentoPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canReview = hasPermission(['training:effectiveness', 'training:manage']);
  const canPlan = hasPermission(['training:create', 'training:manage']);

  const [reviewing, setReviewing] = useState<EffectivenessItem | null>(null);
  const [newPlan, setNewPlan] = useState(false);
  const [actionFor, setActionFor] = useState<Plan | null>(null);

  const effectiveness = useQuery<EffectivenessItem[]>({
    queryKey: ['training-effectiveness'],
    queryFn: () => api('/training/development/effectiveness/pending'),
  });
  const plans = useQuery<Plan[]>({
    queryKey: ['training-plans'],
    queryFn: () => api('/training/development/plans'),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['training-effectiveness'] });
    void qc.invalidateQueries({ queryKey: ['training-plans'] });
    void qc.invalidateQueries({ queryKey: ['training-overview'] });
    void qc.invalidateQueries({ queryKey: ['training-assignments'] });
  };

  const updateAction = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/training/development/actions/${id}`, { method: 'PATCH', json: { status } }),
    onSuccess: () => {
      toast.success('Ação atualizada.');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Treinamento e Desenvolvimento"
        tone="view"
        title="Eficácia e Desenvolvimento"
        description="Avalie se o treinamento produziu resultado no trabalho e acompanhe os planos de desenvolvimento individual."
        breadcrumbs={[{ label: 'Treinamento', href: '/treinamento' }, { label: 'Eficácia e PDI' }]}
      />

      <Tabs defaultValue="eficacia" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="eficacia">Avaliação de eficácia</TabsTrigger>
            <TabsTrigger value="pdi">Planos de desenvolvimento</TabsTrigger>
          </TabsList>
          {canPlan && (
            <Button onClick={() => setNewPlan(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo plano
            </Button>
          )}
        </div>

        <TabsContent value="eficacia">
          {effectiveness.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (effectiveness.data ?? []).length === 0 ? (
            <EmptyState
              title="Nenhuma avaliação de eficácia pendente."
              description="A avaliação é agendada automaticamente quando o treinamento exige e a turma é concluída."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Colaborador</th>
                    <th className="px-4 py-2.5 text-left font-medium">Treinamento</th>
                    <th className="px-4 py-2.5 text-left font-medium">Realizado</th>
                    <th className="px-4 py-2.5 text-left font-medium">Prazo da avaliação</th>
                    <th className="px-4 py-2.5 text-right font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(effectiveness.data ?? []).map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{item.employee.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {[item.employee.job?.name, item.employee.orgNode?.name].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div>{item.training.name}</div>
                        <div className="text-[11px] text-muted-foreground">{item.training.code}</div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{item.completedAt ? formatDate(item.completedAt) : '—'}</td>
                      <td className={cn('px-4 py-2.5', item.overdue ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>
                        {item.dueAt ? formatDate(item.dueAt) : '—'}
                        {item.overdue && <div className="text-[11px]">Atrasada</div>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {canReview && (
                          <Button size="sm" variant="outline" onClick={() => setReviewing(item)}>
                            Avaliar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pdi" className="space-y-3">
          {plans.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (plans.data ?? []).length === 0 ? (
            <EmptyState
              title="Nenhum plano de desenvolvimento cadastrado."
              description="O PDI reaproveita os treinamentos já cadastrados: a ação pode ser realizar um treinamento do catálogo."
            />
          ) : (
            (plans.data ?? []).map((plan) => (
              <Card key={plan.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{plan.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {plan.employee.name}
                        {plan.employee.job?.name ? ` · ${plan.employee.job.name}` : ''} · {ORIGIN_LABEL[plan.origin] ?? plan.origin}
                        {plan.dueAt ? ` · prazo ${formatDate(plan.dueAt)}` : ''}
                      </p>
                      {plan.competency && <p className="mt-1 text-xs text-muted-foreground">Competência: {plan.competency}</p>}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{PLAN_STATUS_LABEL[plan.status] ?? plan.status}</span>
                      {plan.progress !== null && (
                        <span className="tabular-nums text-muted-foreground">{Math.round(plan.progress * 100)}%</span>
                      )}
                      {canPlan && (
                        <Button size="sm" variant="outline" onClick={() => setActionFor(plan)}>
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Ação
                        </Button>
                      )}
                    </div>
                  </div>

                  {plan.actions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma ação cadastrada neste plano.</p>
                  ) : (
                    <ul className="divide-y rounded-md border">
                      {plan.actions.map((action) => (
                        <li key={action.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p>{action.description}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {action.training ? `Treinamento: ${action.training.code} — ${action.training.name}` : 'Ação livre'}
                              {action.dueAt ? ` · prazo ${formatDate(action.dueAt)}` : ''}
                            </p>
                          </div>
                          {canPlan ? (
                            <NativeSelect
                              className="h-8 w-40 text-xs"
                              value={action.status}
                              onChange={(e) => updateAction.mutate({ id: action.id, status: e.target.value })}
                            >
                              {Object.keys(ACTION_STATUS_LABEL).map((key) => (
                                <option key={key} value={key}>{ACTION_STATUS_LABEL[key]}</option>
                              ))}
                            </NativeSelect>
                          ) : (
                            <span className="text-xs text-muted-foreground">{ACTION_STATUS_LABEL[action.status]}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <EffectivenessDialog item={reviewing} onClose={() => setReviewing(null)} onSaved={invalidate} />
      <NewPlanDialog open={newPlan} onOpenChange={setNewPlan} onSaved={invalidate} />
      <NewActionDialog plan={actionFor} onClose={() => setActionFor(null)} onSaved={invalidate} />
    </div>
  );
}

function EffectivenessDialog({
  item,
  onClose,
  onSaved,
}: {
  item: EffectivenessItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [note, setNote] = useState('');

  const review = useMutation({
    mutationFn: (effective: boolean) =>
      api(`/training/development/effectiveness/${item?.id}`, { method: 'POST', json: { effective, note } }),
    onSuccess: (_data, effective) => {
      toast.success(
        effective
          ? 'Treinamento avaliado como eficaz.'
          : 'Registrado como ineficaz — o treinamento voltou para pendente, permitindo programar reciclagem.',
      );
      setNote('');
      onSaved();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Avaliar eficácia</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {item?.employee.name} — {item?.training.name}
          </p>
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            A avaliação de eficácia verifica se o treinamento produziu resultado no trabalho. Se for ineficaz, a exigência
            volta a pendente para você programar reciclagem.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Observação {`(obrigatória se ineficaz)`}</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => review.mutate(false)} disabled={review.isPending || !note.trim()}>
            <ThumbsDown className="mr-2 h-4 w-4" />
            Ineficaz
          </Button>
          <Button onClick={() => review.mutate(true)} disabled={review.isPending}>
            <ThumbsUp className="mr-2 h-4 w-4" />
            Eficaz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewPlanDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ employeeId: '', title: '', origin: 'MANAGER_REQUEST', competency: '', objective: '', dueAt: '' });

  const employees = useQuery<{ items: Array<{ id: string; name: string }> }>({
    queryKey: ['training-employees-picker'],
    queryFn: () => api('/personnel/employees?take=500'),
    enabled: open,
  });

  const save = useMutation({
    mutationFn: () => api('/training/development/plans', { method: 'POST', json: { ...form, dueAt: form.dueAt || null } }),
    onSuccess: () => {
      toast.success('Plano criado.');
      onSaved();
      onOpenChange(false);
      setForm({ employeeId: '', title: '', origin: 'MANAGER_REQUEST', competency: '', objective: '', dueAt: '' });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const list = (employees.data as any)?.items ?? (Array.isArray(employees.data) ? employees.data : []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo plano de desenvolvimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Colaborador</Label>
            <NativeSelect value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">Selecione...</option>
              {list.map((employee: any) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Origem</Label>
            <NativeSelect value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })}>
              {Object.keys(ORIGIN_LABEL).map((key) => (
                <option key={key} value={key}>{ORIGIN_LABEL[key]}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Competência a desenvolver</Label>
            <Input value={form.competency} onChange={(e) => setForm({ ...form, competency: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Objetivo</Label>
            <Textarea rows={2} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Prazo</Label>
            <Input type="date" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!form.employeeId || !form.title.trim() || save.isPending}>
            Criar plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewActionDialog({ plan, onClose, onSaved }: { plan: Plan | null; onClose: () => void; onSaved: () => void }) {
  const [description, setDescription] = useState('');
  const [trainingId, setTrainingId] = useState('');
  const [dueAt, setDueAt] = useState('');

  const trainings = useQuery<TrainingItem[]>({
    queryKey: ['training-catalog-simple'],
    queryFn: () => api('/training/catalog/trainings?status=ACTIVE'),
    enabled: Boolean(plan),
  });

  const save = useMutation({
    mutationFn: () =>
      api(`/training/development/plans/${plan?.id}/actions`, {
        method: 'POST',
        json: { description, trainingId: trainingId || null, dueAt: dueAt || null },
      }),
    onSuccess: () => {
      toast.success(trainingId ? 'Ação criada e treinamento incluído na matriz do colaborador.' : 'Ação criada.');
      setDescription('');
      setTrainingId('');
      setDueAt('');
      onSaved();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={Boolean(plan)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova ação de desenvolvimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Ação</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Treinamento relacionado</Label>
            <NativeSelect value={trainingId} onChange={(e) => setTrainingId(e.target.value)}>
              <option value="">Nenhum (ação livre)</option>
              {(trainings.data ?? []).map((training) => (
                <option key={training.id} value={training.id}>
                  {training.code} · {training.name}
                </option>
              ))}
            </NativeSelect>
            <p className="text-[11px] text-muted-foreground">
              Ao vincular um treinamento, ele entra na matriz do colaborador como desenvolvimento (não obrigatório).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Prazo</Label>
            <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!description.trim() || save.isPending}>
            Adicionar ação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
