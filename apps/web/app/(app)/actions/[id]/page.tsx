'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft, Bot, CheckCircle2, Download, GitBranch, Paperclip, Pencil, Plus, Save, Send, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { StatusBadge } from '@/components/platform/status-badge';
import { EmptyState } from '@/components/platform/empty-state';
import { LoadingState } from '@/components/platform/loading-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { SUGGESTION_STATUS_LABEL, SUGGESTION_TYPE_LABEL, ACTION_STATUS_LABEL, ACTION_PRIORITY_LABEL, ACTION_ORIGIN_LABEL, ACTION_CRITICALITY_LABEL, EFFECTIVENESS_STATUS_LABEL, TRACE_EVENT_LABEL, TRACE_FIELD_LABEL, ANALYSIS_METHOD_LABEL } from '@/lib/labels';
import { AnalysisWorkspace } from '@/components/platform/analysis-workspace';
import { exportNodeToPng } from '@/lib/export-image';
import { useAuth } from '@/components/auth/auth-provider';

interface ActionDetail {
  id: string;
  title: string;
  description: string | null;
  problemDescription: string | null;
  rootCause: string | null;
  origin: string;
  status: string;
  priority: string;
  criticality: string;
  analysisTool: string | null;
  effectivenessStatus: string;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  progress: number;
  estimatedCost: number | null;
  actualCost: number | null;
  expectedResult: string | null;
  achievedResult: string | null;
  effectivenessSummary: string | null;
  effectivenessEvidence: string | null;
  responsibleUser: { id: string; name: string; email?: string } | null;
  ownerNode: { id: string; name: string; type?: string } | null;
  indicator: any | null;
  indicatorResult: any | null;
  strategicObjective: any | null;
  deviation: any | null;
  analysis: any | null;
  meeting: any | null;
  tasks: {
    id: string;
    title: string;
    done: boolean;
    completionNote: string | null;
    dueDate: string | null;
    startDate: string | null;
    endDate: string | null;
    assignedToId: string | null;
    assignedTo: { id: string; name: string; email?: string; avatarUrl?: string | null } | null;
    _count?: { evidences: number };
  }[];
  evidences: any[];
  comments: any[];
  history: any[];
  aiSuggestions: any[];
  analysisSessions: any[];
  originTrail: { type: string; label: string; href?: string }[];
  aiReadiness: { score: number; gaps: string[] };
}

const STATUS_LABEL = ACTION_STATUS_LABEL;
const TOOL_LABEL = ANALYSIS_METHOD_LABEL;

const tabs = ['Visão geral', 'Origem', 'Análise de causa', 'Execução', 'Eficácia', 'IA', 'Histórico'];
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export default function ActionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canApproveEffectiveness = hasPermission(['actions:effectiveness', 'eficacia:approve']);
  const canRequestDelete = hasPermission(['actions:update', 'actions:delete']);
  const canEditAnalysis = hasPermission(['actions:analysis', 'actions:update']);
  const canUseActionAi = hasPermission(['actions:ai']);
  const [tab, setTab] = useState(tabs[0]);
  const [newTask, setNewTask] = useState<{ title: string; startDate: string; endDate: string; assignedToId: string }>({ title: '', startDate: '', endDate: '', assignedToId: '' });
  const [effectiveness, setEffectiveness] = useState({ effective: true, reopen: false, summary: '', evidence: '', achievedResult: '' });
  const [deletePlanOpen, setDeletePlanOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  const query = useQuery<ActionDetail>({
    queryKey: ['action', id],
    queryFn: () => api<ActionDetail>(`/actions/${id}`),
  });

  const optionsQuery = useQuery<{ users: { id: string; name: string; email?: string }[] }>({
    queryKey: ['actions', 'options'],
    queryFn: () => api(`/actions/options`),
    staleTime: 60_000,
  });

  const a = query.data;
  const users = optionsQuery.data?.users ?? [];

  useEffect(() => {
    const currentAction = query.data;
    if (!currentAction) return;
    setEffectiveness({
      effective: currentAction.effectivenessStatus === 'EFFECTIVE',
      reopen: currentAction.effectivenessStatus === 'REOPENED',
      summary: currentAction.effectivenessSummary ?? '',
      evidence: currentAction.effectivenessEvidence ?? '',
      achievedResult: currentAction.achievedResult ?? '',
    });
  }, [query.data]);

  const update = useMutation({
    mutationFn: (patch: any) => api(`/actions/${id}`, { method: 'PATCH', json: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['action', id] }),
  });
  const changeStatus = useMutation({
    mutationFn: (status: string) => api(`/actions/${id}/status`, { method: 'PATCH', json: { status } }),
    onSuccess: () => {
      toast.success('Status atualizado');
      qc.invalidateQueries({ queryKey: ['action', id] });
    },
  });
  const addTask = useMutation({
    mutationFn: () =>
      api(`/actions/${id}/tasks`, {
        method: 'POST',
        json: {
          title: newTask.title,
          startDate: newTask.startDate || undefined,
          endDate: newTask.endDate || undefined,
          assignedToId: newTask.assignedToId || undefined,
        },
      }),
    onSuccess: () => {
      setNewTask({ title: '', startDate: '', endDate: '', assignedToId: '' });
      qc.invalidateQueries({ queryKey: ['action', id] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível criar a tarefa'),
  });
  const updateTask = useMutation({
    mutationFn: ({ taskId, patch }: { taskId: string; patch: Record<string, any> }) =>
      api(`/actions/tasks/${taskId}`, { method: 'PATCH', json: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['action', id] }),
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível atualizar a tarefa'),
  });
  const toggleTask = useMutation({
    mutationFn: ({ taskId, done }: { taskId: string; done: boolean }) =>
      api(`/actions/tasks/${taskId}`, { method: 'PATCH', json: { done } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['action', id] }),
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível atualizar a tarefa'),
  });
  const deleteTask = useMutation({
    mutationFn: (taskId: string) => api(`/actions/tasks/${taskId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Tarefa excluida');
      qc.invalidateQueries({ queryKey: ['action', id] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível excluir a tarefa'),
  });
  const requestDeletePlan = useMutation({
    mutationFn: () => api(`/actions/${id}/delete-request`, { method: 'POST', json: { reason: deleteReason || undefined } }),
    onSuccess: () => {
      toast.success('Solicitação enviada para aprovação da gestão');
      setDeletePlanOpen(false);
      setDeleteReason('');
      qc.invalidateQueries({ queryKey: ['actions', 'general-approvals'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível enviar para aprovação'),
  });
  const addTaskEvidence = useMutation({
    mutationFn: async ({ taskId, file }: { taskId: string; file: File }) => {
      if (file.size > MAX_ATTACHMENT_BYTES) throw new Error('Arquivo excede o limite de 5 MB');
      const dataBase64 = await fileToBase64(file);
      return api(`/actions/${id}/evidences`, {
        method: 'POST',
        json: {
          taskId,
          title: file.name,
          fileName: file.name,
          mimeType: file.type || null,
          dataBase64,
        },
      });
    },
    onSuccess: () => {
      toast.success('Evidência anexada');
      qc.invalidateQueries({ queryKey: ['action', id] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível anexar a evidência'),
  });
  const saveAnalysis = useMutation({
    mutationFn: (payload: any) => api(`/actions/${id}/analysis`, { method: 'POST', json: payload }),
    onSuccess: () => {
      toast.success('Análise salva');
      qc.invalidateQueries({ queryKey: ['action', id] });
    },
  });
  const validate = useMutation({
    mutationFn: () => api(`/actions/${id}/effectiveness`, { method: 'POST', json: effectiveness }),
    onSuccess: () => {
      toast.success('Eficácia registrada');
      qc.invalidateQueries({ queryKey: ['action', id] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao registrar eficácia'),
  });
  const requestReview = useMutation({
    mutationFn: () => api(`/actions/${id}/effectiveness/request`, {
      method: 'POST',
      json: {
        summary: effectiveness.summary,
        evidence: effectiveness.evidence,
        achievedResult: effectiveness.achievedResult,
      },
    }),
    onSuccess: () => {
      toast.success('Eficácia enviada para análise do responsável');
      qc.invalidateQueries({ queryKey: ['action', id] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao enviar para análise'),
  });
  const aiAssist = useMutation({
    mutationFn: (scope: string) => api(`/actions/${id}/ai-assist`, { method: 'POST', json: { scope } }),
    onSuccess: () => {
      toast.success('Sugestões geradas');
      qc.invalidateQueries({ queryKey: ['action', id] });
    },
  });
  const decideAi = useMutation({
    mutationFn: ({ sid, status }: { sid: string; status: string }) => api(`/actions/ai-suggestions/${sid}`, { method: 'PATCH', json: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['action', id] }),
  });

  if (query.isLoading) return <LoadingState label="Carregando plano de ação..." />;
  if (!a) return null;
  const isOverdue = a.dueDate && new Date(a.dueDate) < new Date() && !['DONE', 'DONE_LATE', 'CANCELLED', 'EFFECTIVE'].includes(a.status);

  return (
    <div>
      <Link href="/actions" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Planos de ação
      </Link>

      <PageHeader
        title={a.title}
        actions={
          <>
            <StatusBadge value={a.status} label={STATUS_LABEL[a.status] ?? a.status} />
            <Button variant="outline" onClick={() => aiAssist.mutate('general')}>
              <Bot className="mr-2 h-4 w-4" />
              IA assistente
            </Button>
            {canRequestDelete && (
              <Button variant="destructive" onClick={() => setDeletePlanOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar plano
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <Mini title="Status">
          <NativeSelect value={a.status} onChange={(e) => changeStatus.mutate(e.target.value)} className="mt-1 h-9">
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
          <p className="mt-1 text-[10px] leading-tight text-muted-foreground">Calculado automaticamente pelo andamento (análise → execução). Você pode ajustar manualmente.</p>
        </Mini>
        <Mini title="Prazo">
          <div className={cn('mt-1 text-base font-semibold', isOverdue && 'text-status-red')}>{formatDate(a.dueDate)}</div>
        </Mini>
        <Mini title="Prioridade">
          <NativeSelect value={a.priority} onChange={(e) => update.mutate({ priority: e.target.value })} className="mt-1 h-9">
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((item) => (
              <option key={item} value={item}>{ACTION_PRIORITY_LABEL[item] ?? item}</option>
            ))}
          </NativeSelect>
        </Mini>
        <Mini title="Eficácia">
          <div className="mt-1"><StatusBadge value={a.effectivenessStatus} label={EFFECTIVENESS_STATUS_LABEL[a.effectivenessStatus] ?? a.effectivenessStatus} /></div>
        </Mini>
        <Mini title="Progresso">
          <div className="mt-1 text-base font-semibold">{a.progress}%</div>
          <Progress value={a.progress} className="mt-1 h-1.5" />
        </Mini>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Button key={item} variant={tab === item ? 'default' : 'outline'} size="sm" onClick={() => setTab(item)}>
            {item}
          </Button>
        ))}
      </div>

      {tab === 'Visão geral' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <SectionCard title="Problema e plano" description="Contexto, causa raiz, ação proposta e resultado esperado.">
              <div className="grid gap-4">
                <EditableText label="Descrição do problema" value={a.problemDescription ?? ''} onSave={(problemDescription) => update.mutate({ problemDescription })} />
                <EditableText label="Causa raiz identificada" value={a.rootCause ?? ''} onSave={(rootCause) => update.mutate({ rootCause })} />
                <EditableText label="Ação proposta" value={a.description ?? ''} onSave={(description) => update.mutate({ description })} />
                <EditableText label="Resultado esperado (Impacto Esperado)" value={a.expectedResult ?? ''} onSave={(expectedResult) => update.mutate({ expectedResult })} />
              </div>
            </SectionCard>
            <ExecutionCard a={a} users={users} newTask={newTask} setNewTask={setNewTask} addTask={addTask.mutate} toggleTask={toggleTask.mutate} updateTask={updateTask.mutate} deleteTask={deleteTask.mutate} addTaskEvidence={(payload) => addTaskEvidence.mutate(payload)} evidenceUploading={addTaskEvidence.isPending} />
          </div>
          <div className="space-y-4">
            <SectionCard title="Responsabilidade" description="Responsável, área, origem e ferramenta.">
              <Info label="Responsável" value={a.responsibleUser?.name ?? 'Sem responsável'} />
              <Info label="Área/Setor" value={a.ownerNode?.name ?? '-'} />
              <Info label="Origem" value={ACTION_ORIGIN_LABEL[a.origin] ?? a.origin} />
              <Info label="Ferramenta" value={a.analysisTool ? TOOL_LABEL[a.analysisTool] ?? a.analysisTool : 'Não definida'} />
              <Info label="Criticidade" value={ACTION_CRITICALITY_LABEL[a.criticality] ?? a.criticality} />
            </SectionCard>
            <SectionCard title="Reunião do plano" description="A reunião conduz a análise de causa e gera as tarefas. A criação da reunião acontece no desvio.">
              {a.meeting ? (
                <div className="space-y-3">
                  <div className="rounded-md border p-3 text-sm">
                    <div className="font-semibold">{a.meeting.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatDate(a.meeting.startsAt)}</div>
                  </div>
                  <Button asChild className="w-full">
                    <Link href={`/meetings/${a.meeting.id}`}>
                      Abrir reunião
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                  <p>Este plano ainda não tem reunião vinculada. A reunião é criada a partir do <strong>desvio</strong> que originou o plano.</p>
                  {a.deviation?.id && (
                    <Button asChild variant="outline" className="w-full">
                      <Link href={`/deviations/${a.deviation.id}`}>Abrir desvio para criar a reunião</Link>
                    </Button>
                  )}
                </div>
              )}
            </SectionCard>
            <SectionCard title="Prontidao da ação" description="Lacunas antes de considerar o plano robusto.">
              <div className="mb-3 text-2xl font-semibold">{a.aiReadiness.score}%</div>
              <Progress value={a.aiReadiness.score} />
              <div className="mt-3 space-y-2">
                {a.aiReadiness.gaps.length === 0 ? <Badge>Sem lacunas críticas</Badge> : a.aiReadiness.gaps.map((gap) => <div key={gap} className="rounded-md border p-2 text-xs text-muted-foreground">{gap}</div>)}
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {tab === 'Origem' && <OriginTrail a={a} />}
      {tab === 'Análise de causa' && (
        <AnalysisWorkspace
          action={a}
          users={users}
          canEdit={canEditAnalysis}
          onSave={saveAnalysis.mutate}
          saving={saveAnalysis.isPending}
          onAskAi={canUseActionAi ? () => aiAssist.mutate('analysis') : undefined}
        />
      )}
      {tab === 'Execução' && <ExecutionCard a={a} users={users} newTask={newTask} setNewTask={setNewTask} addTask={addTask.mutate} toggleTask={toggleTask.mutate} updateTask={updateTask.mutate} deleteTask={deleteTask.mutate} addTaskEvidence={(payload) => addTaskEvidence.mutate(payload)} evidenceUploading={addTaskEvidence.isPending} />}
      {tab === 'Eficácia' && (
        <EffectivenessPanel
          a={a}
          effectiveness={effectiveness}
          setEffectiveness={setEffectiveness}
          canApprove={canApproveEffectiveness}
          validate={() => validate.mutate()}
          requestReview={() => requestReview.mutate()}
          saving={validate.isPending || requestReview.isPending}
          aiBusy={aiAssist.isPending}
          aiSuggestions={a.aiSuggestions?.filter((s: any) => s.context?.scope === 'effectiveness' || s.suggestionType === 'EFFECTIVENESS') ?? []}
          onAskAi={() => aiAssist.mutate('effectiveness')}
        />
      )}
      {tab === 'IA' && <AiPanel suggestions={a.aiSuggestions} onGenerate={(scope) => aiAssist.mutate(scope)} onDecide={(sid, status) => decideAi.mutate({ sid, status })} />}
      {tab === 'Histórico' && <HistoryPanel history={a.history} />}

      <Dialog open={deletePlanOpen} onOpenChange={setDeletePlanOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Eliminar plano de ação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border bg-muted/35 p-3">
              <div className="font-semibold">{a.title}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                A eliminação não será feita agora. A solicitação será enviada para aprovação da gestão.
              </p>
            </div>
            <div>
              <Label>Justificativa</Label>
              <Textarea
                rows={3}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Explique por que este plano deve ser eliminado..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletePlanOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => requestDeletePlan.mutate()} disabled={requestDeletePlan.isPending}>
              {requestDeletePlan.isPending ? 'Enviando...' : 'Enviar para aprovação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Mini({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase text-muted-foreground">{title}</div>
        {children}
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3 text-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function EditableText({ label, value, onSave }: { label: string; value: string; onSave: (value: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Textarea defaultValue={value} rows={3} onBlur={(e) => e.target.value !== value && onSave(e.target.value)} />
    </div>
  );
}

function OriginTrail({ a }: { a: ActionDetail }) {
  return (
    <SectionCard title="Trilha completa de origem" description="Caminho lógico que originou este plano de ação.">
      <div className="relative pl-6 border-l-2 border-primary/20 space-y-6">
        {a.originTrail.map((item, index) => (
          <div key={`${item.type}-${index}`} className="relative">
            {/* Círculo do Timeline */}
            <span className="absolute -left-[31px] top-1 grid h-5 w-5 place-items-center rounded-full bg-background border-2 border-primary text-[10px] font-bold text-primary">
              {index + 1}
            </span>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                <GitBranch className="h-3.5 w-3.5 text-primary" />
                {item.type === 'INDICATOR' ? 'Indicador' : item.type === 'DEVIATION' ? 'Desvio / FCA' : item.type === 'MEETING' ? 'Reunião' : item.type}
              </div>
              {item.href ? (
                <Link className="text-sm font-semibold text-primary hover:underline block" href={item.href}>
                  {item.label}
                </Link>
              ) : (
                <div className="text-sm font-semibold text-foreground">{item.label}</div>
              )}
            </div>
          </div>
        ))}
        {a.originTrail.length === 0 && (
          <EmptyState title="Origem não detalhada" description="Este plano de ação foi criado de forma manual direta." />
        )}
      </div>
    </SectionCard>
  );
}

function ExecutionCard({
  a,
  users,
  newTask,
  setNewTask,
  addTask,
  toggleTask,
  updateTask,
  deleteTask,
  addTaskEvidence,
  evidenceUploading,
}: {
  a: ActionDetail;
  users: { id: string; name: string; email?: string }[];
  newTask: { title: string; startDate: string; endDate: string; assignedToId: string };
  setNewTask: (v: { title: string; startDate: string; endDate: string; assignedToId: string }) => void;
  addTask: () => void;
  toggleTask: (v: { taskId: string; done: boolean }) => void;
  updateTask: (v: { taskId: string; patch: Record<string, any> }) => void;
  deleteTask: (taskId: string) => void;
  addTaskEvidence: (v: { taskId: string; file: File }) => void;
  evidenceUploading: boolean;
}) {
  const [completeDialog, setCompleteDialog] = useState<{ open: boolean; task: ActionDetail['tasks'][number] | null }>({ open: false, task: null });
  const [completeForm, setCompleteForm] = useState({ completionNote: '', endDate: todayInput() });
  const [editDialog, setEditDialog] = useState<{ open: boolean; task: ActionDetail['tasks'][number] | null }>({ open: false, task: null });
  const [editForm, setEditForm] = useState({ title: '', startDate: '', endDate: '', assignedToId: '', completionNote: '' });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; task: ActionDetail['tasks'][number] | null }>({ open: false, task: null });

  const openCompleteDialog = (t: ActionDetail['tasks'][number]) => {
    setCompleteForm({
      completionNote: t.completionNote ?? '',
      endDate: t.endDate ? t.endDate.slice(0, 10) : todayInput(),
    });
    setCompleteDialog({ open: true, task: t });
  };

  const openEditDialog = (t: ActionDetail['tasks'][number]) => {
    setEditForm({
      title: t.title,
      startDate: t.startDate ? t.startDate.slice(0, 10) : '',
      endDate: t.endDate ? t.endDate.slice(0, 10) : '',
      assignedToId: t.assignedToId ?? '',
      completionNote: t.completionNote ?? '',
    });
    setEditDialog({ open: true, task: t });
  };

  const handleToggle = (t: ActionDetail['tasks'][number], next: boolean) => {
    if (next) {
      openCompleteDialog(t);
      return;
    }
    toggleTask({ taskId: t.id, done: next });
  };

  const submitComplete = () => {
    if (!completeDialog.task) return;
    if (!completeForm.completionNote.trim()) {
      toast.error('Informe o que foi feito para concluir a tarefa.');
      return;
    }
    updateTask({
      taskId: completeDialog.task.id,
      patch: {
        done: true,
        endDate: completeForm.endDate || todayInput(),
        completionNote: completeForm.completionNote.trim(),
      },
    });
    setCompleteDialog({ open: false, task: null });
  };

  const submitEdit = () => {
    if (!editDialog.task) return;
    if (!editForm.title.trim()) {
      toast.error('Informe o título da tarefa.');
      return;
    }
    updateTask({
      taskId: editDialog.task.id,
      patch: {
        title: editForm.title.trim(),
        startDate: editForm.startDate || null,
        endDate: editForm.endDate || null,
        assignedToId: editForm.assignedToId || null,
        completionNote: editForm.completionNote || null,
      },
    });
    setEditDialog({ open: false, task: null });
  };

  const submitDelete = () => {
    if (!deleteDialog.task) return;
    deleteTask(deleteDialog.task.id);
    setDeleteDialog({ open: false, task: null });
  };

  // Exportação em imagem das tarefas do plano (para apresentações) — captura
  // só a lista, sem o formulário de criação.
  const tasksExportRef = useRef<HTMLDivElement | null>(null);
  const [exportingTasks, setExportingTasks] = useState(false);
  const exportTasks = async () => {
    setExportingTasks(true);
    const ok = await exportNodeToPng(tasksExportRef.current, `plano-execucao-${a.id}`, { backgroundColor: '#ffffff' });
    setExportingTasks(false);
    if (ok) toast.success('Imagem das tarefas exportada');
    else toast.error('Não foi possível exportar a imagem');
  };

  return (
    <>
      <SectionCard
        title={`Execução (${a.tasks.length})`}
        description="Ao concluir uma tarefa, registre o que foi feito."
        actions={
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={exportTasks} disabled={exportingTasks || a.tasks.length === 0}>
            <Download className="h-3.5 w-3.5" />
            {exportingTasks ? 'Exportando...' : 'Exportar imagem'}
          </Button>
        }
      >
        <div className="mb-3 grid gap-2 rounded-lg border bg-muted/30 p-3">
          <Input
            placeholder="Título da tarefa"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Início</Label>
              <Input type="date" value={newTask.startDate} onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })} className="h-9" />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Conclusão prevista</Label>
              <Input type="date" value={newTask.endDate} onChange={(e) => setNewTask({ ...newTask, endDate: e.target.value })} className="h-9" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-[10px] uppercase text-muted-foreground">Responsável</Label>
              <NativeSelect
                value={newTask.assignedToId}
                onChange={(e) => setNewTask({ ...newTask, assignedToId: e.target.value })}
                className="h-9"
              >
                <option value="">Sem responsável</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <Button onClick={addTask} disabled={!newTask.title.trim()} className="w-full sm:w-auto sm:justify-self-end">
            <Plus className="mr-2 h-4 w-4" /> Adicionar tarefa
          </Button>
        </div>
        <div ref={tasksExportRef} className="space-y-2 bg-background p-1">
          {a.tasks.map((t) => {
            const overdue = !t.done && t.endDate && new Date(t.endDate) < new Date();
            const hasEvidence = (t._count?.evidences ?? 0) > 0 || a.evidences.some((evidence: any) => evidence.taskId === t.id);
            return (
              <div
                key={t.id}
                className={cn(
                  'rounded-md border p-3 text-sm',
                  t.done && 'bg-muted/40',
                  overdue && 'border-status-red/40',
                )}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={(e) => handleToggle(t, e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className={cn('font-medium', t.done && 'line-through')}>{t.title}</div>
                      <div className="flex shrink-0 gap-1">
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => document.getElementById(`task-evidence-${t.id}`)?.click()} title="Anexar evidência" disabled={evidenceUploading}>
                          <Paperclip className="h-3.5 w-3.5" />
                        </Button>
                        <input
                          id={`task-evidence-${t.id}`}
                          type="file"
                          className="hidden"
                          accept=".doc,.docx,.xls,.xlsx,.csv,.pdf,.png,.jpg,.jpeg,.txt,.ppt,.pptx"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) addTaskEvidence({ taskId: t.id, file });
                            e.target.value = '';
                          }}
                          disabled={evidenceUploading}
                        />
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditDialog(t)} title="Editar tarefa">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-status-red hover:text-status-red" onClick={() => setDeleteDialog({ open: true, task: t })} title="Excluir tarefa">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {t.completionNote && (
                      <div className="mt-2 rounded-md border border-status-green/25 bg-status-green/10 p-2 text-xs">
                        <div className="mb-1 font-semibold text-status-green">Realizado</div>
                        <p className="whitespace-pre-wrap text-foreground">{t.completionNote}</p>
                      </div>
                    )}
                    {hasEvidence && (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-status-green/30 bg-status-green/10 px-2 py-1 text-xs font-medium text-status-green">
                        <Paperclip className="h-3 w-3" />
                        Evidência Anexada!
                      </div>
                    )}
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">Início</Label>
                        <Input
                          type="date"
                          defaultValue={t.startDate ? t.startDate.slice(0, 10) : ''}
                          onBlur={(e) => {
                            const v = e.target.value;
                            const cur = t.startDate ? t.startDate.slice(0, 10) : '';
                            if (v !== cur) updateTask({ taskId: t.id, patch: { startDate: v || null } });
                          }}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">Conclusão</Label>
                        <Input
                          type="date"
                          defaultValue={t.endDate ? t.endDate.slice(0, 10) : ''}
                          onBlur={(e) => {
                            const v = e.target.value;
                            const cur = t.endDate ? t.endDate.slice(0, 10) : '';
                            if (v !== cur) updateTask({ taskId: t.id, patch: { endDate: v || null } });
                          }}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">Responsável</Label>
                        <NativeSelect
                          value={t.assignedToId ?? ''}
                          onChange={(e) => updateTask({ taskId: t.id, patch: { assignedToId: e.target.value || null } })}
                          className="h-8"
                        >
                          <option value="">Sem responsável</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </NativeSelect>
                      </div>
                    </div>
                    {overdue && <div className="mt-2 text-xs text-status-red">Tarefa atrasada</div>}
                  </div>
                </div>
              </div>
            );
          })}
          {a.tasks.length === 0 && <EmptyState title="Nenhuma tarefa" description="Crie etapas de execução para acompanhar o progresso automaticamente." className="border-dashed" />}
        </div>
      </SectionCard>

      <Dialog open={completeDialog.open} onOpenChange={(open) => setCompleteDialog({ open, task: open ? completeDialog.task : null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Concluir tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/35 p-3 text-sm font-semibold">{completeDialog.task?.title}</div>
            <div>
              <Label>Data de conclusão</Label>
              <Input type="date" value={completeForm.endDate} onChange={(e) => setCompleteForm({ ...completeForm, endDate: e.target.value })} />
            </div>
            <div>
              <Label>O que foi feito</Label>
              <Textarea
                rows={4}
                value={completeForm.completionNote}
                onChange={(e) => setCompleteForm({ ...completeForm, completionNote: e.target.value })}
                placeholder="Descreva a ação realizada para concluir esta tarefa..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCompleteDialog({ open: false, task: null })}>Cancelar</Button>
            <Button onClick={submitComplete}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Concluir tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, task: open ? editDialog.task : null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar tarefa</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Título</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Início</Label>
                <Input type="date" value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} />
              </div>
              <div>
                <Label>Conclusão</Label>
                <Input type="date" value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Responsável</Label>
              <NativeSelect value={editForm.assignedToId} onChange={(e) => setEditForm({ ...editForm, assignedToId: e.target.value })}>
                <option value="">Sem responsável</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Realizado</Label>
              <Textarea rows={3} value={editForm.completionNote} onChange={(e) => setEditForm({ ...editForm, completionNote: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditDialog({ open: false, task: null })}>Cancelar</Button>
            <Button onClick={submitEdit}>
              <Save className="mr-2 h-4 w-4" />
              Salvar tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, task: open ? deleteDialog.task : null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir tarefa</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta tarefa será removida do plano: <span className="font-semibold text-foreground">{deleteDialog.task?.title}</span>
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialog({ open: false, task: null })}>Cancelar</Button>
            <Button variant="destructive" onClick={submitDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EffectivenessPanel({
  a,
  effectiveness,
  setEffectiveness,
  validate,
  requestReview,
  canApprove,
  saving,
  aiBusy,
  aiSuggestions,
  onAskAi,
}: {
  a: ActionDetail;
  effectiveness: { effective: boolean; reopen: boolean; summary: string; evidence: string; achievedResult: string };
  setEffectiveness: (value: any) => void;
  validate: () => void;
  requestReview: () => void;
  canApprove: boolean;
  saving: boolean;
  aiBusy: boolean;
  aiSuggestions: any[];
  onAskAi: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr,380px]">
      <SectionCard
        title="Análise de Eficácia"
        description="Registre o resultado alcançado, anexe evidências e envie para o responsável Master validar a eficácia do plano."
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <TextInput
            label="Resultado alcançado (impacto atingido)"
            value={effectiveness.achievedResult}
            onChange={(achievedResult) => setEffectiveness({ ...effectiveness, achievedResult })}
          />
          <TextInput
            label="Evidência da melhoria (link ou documento)"
            value={effectiveness.evidence}
            onChange={(evidence) => setEffectiveness({ ...effectiveness, evidence })}
          />
          <div className="md:col-span-2">
            <Label className="text-xs font-semibold">Aprendizado e lições aprendidas</Label>
            <Textarea
              rows={4}
              value={effectiveness.summary}
              placeholder="Descreva o que a equipe aprendeu, o conhecimento adquirido e as recomendações para evitar reincidência..."
              onChange={(e) => setEffectiveness({ ...effectiveness, summary: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
          <div className="text-xs text-muted-foreground">
            Status atual: <span className="font-medium text-foreground">{EFFECTIVENESS_STATUS_LABEL[a.effectivenessStatus] ?? a.effectivenessStatus}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onAskAi} disabled={aiBusy}>
              <Sparkles className="mr-2 h-4 w-4" />
              {aiBusy ? 'Analisando...' : 'Análise de Coerência com IA'}
            </Button>
            <Button onClick={requestReview} disabled={saving}>
              <Send className="mr-2 h-4 w-4" />
              Enviar para análise
            </Button>
          </div>
        </div>

        {canApprove && (
          <div className="mt-5 border-t border-border/60 pt-4">
            <div className="rounded-lg border bg-muted/25 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Status de eficácia</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {effectiveness.reopen
                      ? 'Ineficaz: o plano será reaberto para novas tarefas.'
                      : effectiveness.effective
                        ? 'Eficaz: a melhoria foi aprovada e o plano pode ser finalizado.'
                        : 'Selecione a decisão para aplicar ao plano.'}
                  </p>
                </div>
                <StatusBadge
                  value={effectiveness.reopen ? 'REOPENED' : effectiveness.effective ? 'EFFECTIVE' : a.effectivenessStatus}
                  label={
                    effectiveness.reopen
                      ? 'Precisa reabrir'
                      : effectiveness.effective
                        ? 'Eficácia aprovada'
                        : EFFECTIVENESS_STATUS_LABEL[a.effectivenessStatus] ?? a.effectivenessStatus
                  }
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={effectiveness.effective ? 'default' : 'outline'}
                  onClick={() => setEffectiveness({ ...effectiveness, effective: true, reopen: false })}
                >
                  Eficácia aprovada
                </Button>
                <Button
                  type="button"
                  variant={effectiveness.reopen ? 'destructive' : 'outline'}
                  onClick={() => setEffectiveness({ ...effectiveness, effective: false, reopen: true })}
                >
                  Reabrir plano
                </Button>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={validate} disabled={saving}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                {effectiveness.effective ? 'Finalizar Plano de Ação' : 'Aplicar'}
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Sugestões da IA"
        description="Análise de coerência sobre a eficácia da ação e o método aplicado."
      >
        {aiSuggestions.length === 0 ? (
          <EmptyState
            title="Sem sugestões ainda"
            description='Clique em "Análise de Coerência com IA" para gerar dicas baseadas no plano, no método e nos indicadores.'
          />
        ) : (
          <div className="space-y-3">
            {aiSuggestions.map((item) => (
              <div key={item.id} className="border border-border/60 bg-card p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Badge variant="outline">{SUGGESTION_TYPE_LABEL[item.suggestionType] ?? item.suggestionType}</Badge>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{SUGGESTION_STATUS_LABEL[item.status] ?? item.status}</span>
                </div>
                <div className="text-sm font-semibold">{item.title}</div>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{item.content}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function AiPanel({ suggestions, onGenerate, onDecide }: { suggestions: any[]; onGenerate: (scope: string) => void; onDecide: (id: string, status: string) => void }) {
  return (
    <SectionCard title="IA assistente" description="Sugestões ficam pendentes até o usuário aceitar ou rejeitar." actions={<Button onClick={() => onGenerate('general')}><Bot className="mr-2 h-4 w-4" />Gerar sugestões</Button>}>
      <div className="space-y-3">
        {suggestions.length === 0 && <EmptyState title="Nenhuma sugestão gerada" description="Peça apoio da IA para revisar causa, ação e eficácia." />}
        {suggestions.map((item) => (
          <div key={item.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Badge variant="outline">{SUGGESTION_TYPE_LABEL[item.suggestionType] ?? item.suggestionType}</Badge>
                <div className="mt-2 font-semibold">{item.title}</div>
              </div>
              <StatusBadge value={item.status} label={SUGGESTION_STATUS_LABEL[item.status] ?? item.status} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{item.content}</p>
            {item.status === 'PENDING' && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => onDecide(item.id, 'ACCEPTED')}><CheckCircle2 className="mr-2 h-4 w-4" />Aceitar</Button>
                <Button size="sm" variant="outline" onClick={() => onDecide(item.id, 'REJECTED')}>Rejeitar</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function HistoryPanel({ history }: { history: any[] }) {
  function translateValue(field: string | null | undefined, value: string | null | undefined) {
    if (!value) return '';
    if (field === 'analysisTool') return ANALYSIS_METHOD_LABEL[value] ?? value;
    if (field === 'effectivenessStatus') return EFFECTIVENESS_STATUS_LABEL[value] ?? value;
    if (field === 'status') return ACTION_STATUS_LABEL[value] ?? value;
    if (TRACE_FIELD_LABEL[value]) return TRACE_FIELD_LABEL[value];
    return value;
  }
  return (
    <SectionCard
      title="Histórico e auditoria do plano"
      description="Eventos gerados automaticamente por atualizações, IA, evidências e eficácia."
    >
      <div className="space-y-2">
        {history.length === 0 && (
          <EmptyState title="Nenhum evento registrado" description="Edições, sugestões de IA e validações aparecem aqui automaticamente." />
        )}
        {history.map((item) => (
          <div key={item.id} className="border border-border/60 bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">{TRACE_EVENT_LABEL[item.eventType] ?? item.eventType}</div>
              <div className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</div>
            </div>
            {item.field && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {TRACE_FIELD_LABEL[item.field] ?? item.field}
              </div>
            )}
            {item.afterValue && (
              <div className="mt-1 text-sm">{translateValue(item.field, item.afterValue)}</div>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',').pop()! : result);
    };
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    reader.readAsDataURL(file);
  });
}
