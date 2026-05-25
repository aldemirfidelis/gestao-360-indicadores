'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft, Bot, CheckCircle2, ClipboardCheck, FileCheck2, GitBranch, MessageSquare, Plus, Save, ShieldCheck, Sparkles } from 'lucide-react';
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
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

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
  tasks: { id: string; title: string; done: boolean; dueDate: string | null }[];
  evidences: any[];
  comments: any[];
  history: any[];
  aiSuggestions: any[];
  analysisSessions: any[];
  originTrail: { type: string; label: string; href?: string }[];
  aiReadiness: { score: number; gaps: string[] };
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  NOT_STARTED: 'Aberto',
  UNDER_ANALYSIS: 'Em análise',
  IN_PROGRESS: 'Em execucao',
  WAITING_THIRD: 'Aguardando terceiro',
  WAITING_EVIDENCE: 'Aguardando evidencia',
  WAITING_VALIDATION: 'Aguardando validação',
  PAUSED: 'Pausado',
  DONE: 'Concluido',
  DONE_LATE: 'Concluido fora do prazo',
  CANCELLED: 'Cancelado',
  REOPENED: 'Reaberto',
  INEFFECTIVE: 'Ineficaz',
  EFFECTIVE: 'Eficaz',
};

const TOOL_LABEL: Record<string, string> = {
  FIVE_WHYS: '5 Porques',
  ISHIKAWA: 'Ishikawa',
  MASP: 'MASP',
  PDCA: 'PDCA',
  FIVE_W_TWO_H: '5W2H',
  PARETO: 'Pareto',
  FCA: 'FCA',
  GUT: 'Matriz GUT',
  PRIORITIZATION_MATRIX: 'Matriz de priorizacao',
  BRAINSTORMING: 'Brainstorming',
  ROOT_CAUSE: 'Causa raiz',
  EFFECTIVENESS_CHECKLIST: 'Checklist de eficacia',
};

const tabs = ['Visão geral', 'Origem', 'Análise de causa', '5W2H', 'Execução', 'Evidências', 'Eficácia', 'IA', 'Histórico'];

export default function ActionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [tab, setTab] = useState(tabs[0]);
  const [newTask, setNewTask] = useState('');
  const [evidence, setEvidence] = useState({ title: '', url: '', description: '' });
  const [comment, setComment] = useState('');
  const [effectiveness, setEffectiveness] = useState({ effective: true, reopen: false, summary: '', evidence: '', achievedResult: '' });

  const query = useQuery<ActionDetail>({
    queryKey: ['action', id],
    queryFn: () => api<ActionDetail>(`/actions/${id}`),
  });

  const a = query.data;

  useEffect(() => {
    if (!a) return;
    setEffectiveness({
      effective: a.effectivenessStatus === 'EFFECTIVE',
      reopen: a.effectivenessStatus === 'REOPENED',
      summary: a.effectivenessSummary ?? '',
      evidence: a.effectivenessEvidence ?? '',
      achievedResult: a.achievedResult ?? '',
    });
  }, [a?.id, a?.effectivenessStatus]);

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
    mutationFn: () => api(`/actions/${id}/tasks`, { method: 'POST', json: { title: newTask } }),
    onSuccess: () => {
      setNewTask('');
      qc.invalidateQueries({ queryKey: ['action', id] });
    },
  });
  const toggleTask = useMutation({
    mutationFn: ({ taskId, done }: { taskId: string; done: boolean }) => api(`/actions/tasks/${taskId}`, { method: 'PATCH', json: { done } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['action', id] }),
  });
  const saveAnalysis = useMutation({
    mutationFn: (payload: any) => api(`/actions/${id}/analysis`, { method: 'POST', json: payload }),
    onSuccess: () => {
      toast.success('Análise salva');
      qc.invalidateQueries({ queryKey: ['action', id] });
    },
  });
  const addEvidence = useMutation({
    mutationFn: () => api(`/actions/${id}/evidences`, { method: 'POST', json: evidence }),
    onSuccess: () => {
      setEvidence({ title: '', url: '', description: '' });
      qc.invalidateQueries({ queryKey: ['action', id] });
    },
  });
  const addComment = useMutation({
    mutationFn: () => api(`/actions/${id}/comments`, { method: 'POST', json: { comment } }),
    onSuccess: () => {
      setComment('');
      qc.invalidateQueries({ queryKey: ['action', id] });
    },
  });
  const validate = useMutation({
    mutationFn: () => api(`/actions/${id}/effectiveness`, { method: 'POST', json: effectiveness }),
    onSuccess: () => {
      toast.success('Eficacia registrada');
      qc.invalidateQueries({ queryKey: ['action', id] });
    },
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
        description={a.description ?? a.problemDescription ?? undefined}
        actions={
          <>
            <StatusBadge value={a.status} label={STATUS_LABEL[a.status] ?? a.status} />
            <Button variant="outline" onClick={() => aiAssist.mutate('general')}>
              <Bot className="mr-2 h-4 w-4" />
              IA assistente
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <Mini title="Status">
          <NativeSelect value={a.status} onChange={(e) => changeStatus.mutate(e.target.value)} className="mt-1 h-9">
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
        </Mini>
        <Mini title="Prazo">
          <div className={cn('mt-1 text-base font-semibold', isOverdue && 'text-status-red')}>{formatDate(a.dueDate)}</div>
        </Mini>
        <Mini title="Prioridade">
          <NativeSelect value={a.priority} onChange={(e) => update.mutate({ priority: e.target.value })} className="mt-1 h-9">
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((item) => <option key={item} value={item}>{item}</option>)}
          </NativeSelect>
        </Mini>
        <Mini title="Eficacia">
          <div className="mt-1"><StatusBadge value={a.effectivenessStatus} label={a.effectivenessStatus} /></div>
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
            <ExecutionCard a={a} newTask={newTask} setNewTask={setNewTask} addTask={addTask.mutate} toggleTask={toggleTask.mutate} />
          </div>
          <div className="space-y-4">
            <SectionCard title="Responsabilidade" description="Responsável, área, origem e ferramenta.">
              <Info label="Responsável" value={a.responsibleUser?.name ?? 'Sem responsável'} />
              <Info label="Área/Setor" value={a.ownerNode?.name ?? '-'} />
              <Info label="Origem" value={a.origin} />
              <Info label="Ferramenta" value={a.analysisTool ? TOOL_LABEL[a.analysisTool] ?? a.analysisTool : 'Não definida'} />
              <Info label="Criticidade" value={a.criticality} />
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
      {tab === 'Análise de causa' && <AnalysisWorkspace action={a} onSave={saveAnalysis.mutate} saving={saveAnalysis.isPending} onAskAi={() => aiAssist.mutate('analysis')} />}
      {tab === '5W2H' && <FiveW2H action={a} onSave={saveAnalysis.mutate} saving={saveAnalysis.isPending} onAskAi={() => aiAssist.mutate('5w2h')} />}
      {tab === 'Execução' && <ExecutionCard a={a} newTask={newTask} setNewTask={setNewTask} addTask={addTask.mutate} toggleTask={toggleTask.mutate} />}
      {tab === 'Evidências' && (
        <EvidencePanel a={a} evidence={evidence} setEvidence={setEvidence} addEvidence={() => addEvidence.mutate()} comment={comment} setComment={setComment} addComment={() => addComment.mutate()} />
      )}
      {tab === 'Eficácia' && (
        <EffectivenessPanel a={a} effectiveness={effectiveness} setEffectiveness={setEffectiveness} validate={() => validate.mutate()} saving={validate.isPending} onAskAi={() => aiAssist.mutate('effectiveness')} />
      )}
      {tab === 'IA' && <AiPanel suggestions={a.aiSuggestions} onGenerate={(scope) => aiAssist.mutate(scope)} onDecide={(sid, status) => decideAi.mutate({ sid, status })} />}
      {tab === 'Histórico' && <HistoryPanel history={a.history} />}
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

function AnalysisWorkspace({ action, onSave, saving, onAskAi }: { action: ActionDetail; onSave: (payload: any) => void; saving: boolean; onAskAi: () => void }) {
  const session = action.analysisSessions.find((item) => item.method === (action.analysisTool ?? 'FIVE_WHYS')) ?? action.analysisSessions[0];
  const [method, setMethod] = useState(action.analysisTool ?? session?.method ?? 'FIVE_WHYS');
  const [problem, setProblem] = useState(session?.problem ?? action.problemDescription ?? '');
  const [rootCause, setRootCause] = useState(session?.rootCause ?? action.rootCause ?? '');
  const [fiveWhys, setFiveWhys] = useState<any[]>(session?.fiveWhys?.length ? session.fiveWhys : Array.from({ length: 5 }, (_v, i) => ({ position: i + 1, question: `${i + 1}o por que?`, answer: '', evidence: '' })));
  const [ishikawa, setIshikawa] = useState<any[]>(session?.ishikawaCauses?.length ? session.ishikawaCauses : ['Metodo', 'Máquina', 'Mao de obra', 'Material', 'Meio ambiente', 'Medicao'].map((category) => ({ category, description: '', impact: 3, probability: 3, evidence: '' })));
  const [maspSteps, setMaspSteps] = useState<any[]>(session?.maspSteps?.length ? session.maspSteps : ['Identificação do problema', 'Observacao', 'Análise', 'Plano de ação', 'Execucao', 'Verificação', 'Padronizacao', 'Conclusão'].map((title, i) => ({ step: i + 1, title, description: '', status: 'PENDING' })));
  const [pdcaSteps, setPdcaSteps] = useState<any[]>(session?.pdcaSteps?.length ? session.pdcaSteps : ['PLAN', 'DO', 'CHECK', 'ACT'].map((phase) => ({ phase, description: '', status: 'PENDING' })));

  return (
    <SectionCard
      title="Ferramentas reais de análise"
      description="Preencha a ferramenta escolhida, salve a análise e use a IA como facilitadora antes de confirmar."
      actions={<Button variant="outline" onClick={onAskAi}><Sparkles className="mr-2 h-4 w-4" />Sugerir perguntas</Button>}
    >
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <Label>Ferramenta</Label>
          <NativeSelect value={method} onChange={(e) => setMethod(e.target.value)}>
            {Object.entries(TOOL_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </NativeSelect>
        </div>
        <div className="md:col-span-2">
          <Label>Problema principal</Label>
          <Input value={problem} onChange={(e) => setProblem(e.target.value)} />
        </div>
      </div>

      {method === 'FIVE_WHYS' && (
        <div className="space-y-3">
          {fiveWhys.map((item, index) => (
            <div key={index} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[120px,1fr,1fr]">
              <div className="text-sm font-semibold">{index + 1}o por que?</div>
              <Input value={item.answer ?? ''} placeholder="Resposta" onChange={(e) => setFiveWhys(updateArray(fiveWhys, index, { ...item, answer: e.target.value }))} />
              <Input value={item.evidence ?? ''} placeholder="Evidencia" onChange={(e) => setFiveWhys(updateArray(fiveWhys, index, { ...item, evidence: e.target.value }))} />
            </div>
          ))}
          <Button variant="outline" onClick={() => setFiveWhys([...fiveWhys, { position: fiveWhys.length + 1, question: `${fiveWhys.length + 1}o por que?`, answer: '', evidence: '' }])}>Adicionar por que</Button>
        </div>
      )}

      {method === 'ISHIKAWA' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {ishikawa.map((item, index) => (
            <div key={index} className="rounded-lg border p-3">
              <div className="mb-2 text-sm font-semibold">{item.category}</div>
              <Textarea rows={2} value={item.description ?? ''} placeholder="Causa possível" onChange={(e) => setIshikawa(updateArray(ishikawa, index, { ...item, description: e.target.value }))} />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input type="number" min={1} max={5} value={item.impact ?? 3} onChange={(e) => setIshikawa(updateArray(ishikawa, index, { ...item, impact: Number(e.target.value) }))} />
                <Input type="number" min={1} max={5} value={item.probability ?? 3} onChange={(e) => setIshikawa(updateArray(ishikawa, index, { ...item, probability: Number(e.target.value) }))} />
              </div>
            </div>
          ))}
        </div>
      )}

      {method === 'MASP' && <StepEditor rows={maspSteps} setRows={setMaspSteps} labelKey="title" />}
      {method === 'PDCA' && <StepEditor rows={pdcaSteps} setRows={setPdcaSteps} labelKey="phase" />}
      {!['FIVE_WHYS', 'ISHIKAWA', 'MASP', 'PDCA'].includes(method) && <GenericAnalysis method={method} session={session} />}

      <div className="mt-4">
        <Label>Causa raiz provavel</Label>
        <Textarea rows={3} value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
      </div>
      <div className="mt-4 flex justify-end">
        <Button disabled={saving} onClick={() => onSave({ method, problem, rootCause, fiveWhys, ishikawaCauses: ishikawa, maspSteps, pdcaSteps })}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar análise'}
        </Button>
      </div>
    </SectionCard>
  );
}

function FiveW2H({ action, onSave, saving, onAskAi }: { action: ActionDetail; onSave: (payload: any) => void; saving: boolean; onAskAi: () => void }) {
  const session = action.analysisSessions.find((item) => item.method === 'FIVE_W_TWO_H');
  const [form, setForm] = useState<any>(session?.fiveW2H ?? {});
  const set = (key: string, value: any) => setForm({ ...form, [key]: value });

  return (
    <SectionCard 
      title="Plano de Ação 5W2H" 
      description="Detalhe a execução da ação respondendo às perguntas do padrão 5W2H." 
      actions={<Button variant="outline" onClick={onAskAi}><Bot className="mr-2 h-4 w-4" />Revisar 5W2H com IA</Button>}
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
          <h3 className="text-sm font-bold text-primary border-b pb-1.5 uppercase tracking-wide">Os 5 &quot;W&quot;s (Direcionamento)</h3>
          {[
            ['what', 'What (O que será feito?)', 'Ação concreta a ser executada'],
            ['why', 'Why (Por que será feito?)', 'Justificativa e causa raiz que a ação resolve'],
            ['where', 'Where (Onde será feito?)', 'Local, departamento ou sistema afetado'],
            ['who', 'Who (Quem irá fazer?)', 'Responsável ou executor da ação'],
          ].map(([key, label, desc]) => (
            <div key={key}>
              <Label className="font-semibold text-xs text-foreground">{label}</Label>
              <Input 
                value={form[key] ?? ''} 
                placeholder={desc} 
                onChange={(e) => set(key, e.target.value)} 
                className="mt-1"
              />
            </div>
          ))}
          <div>
            <Label className="font-semibold text-xs text-foreground">When (Quando será feito? - Prazo)</Label>
            <Input 
              type="date" 
              value={form.when?.slice?.(0, 10) ?? ''} 
              onChange={(e) => set('when', e.target.value)} 
              className="mt-1"
            />
          </div>
        </div>

        <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
          <h3 className="text-sm font-bold text-primary border-b pb-1.5 uppercase tracking-wide">Os 2 &quot;H&quot;s & Notas (Execução)</h3>
          <div>
            <Label className="font-semibold text-xs text-foreground">How (Como será feito?)</Label>
            <Textarea 
              rows={4} 
              value={form.how ?? ''} 
              placeholder="Método, ferramentas e etapas detalhadas do procedimento..." 
              onChange={(e) => set('how', e.target.value)} 
              className="mt-1"
            />
          </div>
          <div>
            <Label className="font-semibold text-xs text-foreground">How Much (Quanto custará?)</Label>
            <Input 
              type="number" 
              value={form.howMuch ?? ''} 
              placeholder="Custo estimado em R$" 
              onChange={(e) => set('howMuch', e.target.value)} 
              className="mt-1"
            />
          </div>
          <div className="pt-2">
            <Label className="font-semibold text-xs text-muted-foreground">Notas de Revisão</Label>
            <Textarea 
              rows={2} 
              value={form.reviewNotes ?? ''} 
              placeholder="Comentários adicionais da diretoria ou auditoria..." 
              onChange={(e) => set('reviewNotes', e.target.value)} 
              className="mt-1 bg-background/50"
            />
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <Button disabled={saving} onClick={() => onSave({ method: 'FIVE_W_TWO_H', problem: action.problemDescription, rootCause: action.rootCause, fiveW2H: form })}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Gravando...' : 'Salvar Plano 5W2H'}
        </Button>
      </div>
    </SectionCard>
  );
}

function ExecutionCard({ a, newTask, setNewTask, addTask, toggleTask }: { a: ActionDetail; newTask: string; setNewTask: (v: string) => void; addTask: () => void; toggleTask: (v: { taskId: string; done: boolean }) => void }) {
  return (
    <SectionCard title={`Execucao (${a.tasks.length})`} description="Atualize tarefas, progresso e pendências.">
      <div className="mb-3 flex gap-2">
        <Input placeholder="Adicionar tarefa..." value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && newTask && addTask()} />
        <Button onClick={addTask} disabled={!newTask}><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-2">
        {a.tasks.map((t) => (
          <label key={t.id} className={cn('flex cursor-pointer items-center gap-3 rounded-md border p-2 text-sm hover:bg-accent/40', t.done && 'opacity-60')}>
            <input type="checkbox" checked={t.done} onChange={(e) => toggleTask({ taskId: t.id, done: e.target.checked })} className="h-4 w-4" />
            <span className={cn('flex-1', t.done && 'line-through')}>{t.title}</span>
            {t.dueDate && <span className="text-xs text-muted-foreground">{formatDate(t.dueDate)}</span>}
          </label>
        ))}
        {a.tasks.length === 0 && <EmptyState title="Nenhuma tarefa" description="Crie etapas de execucao para acompanhar o progresso automaticamente." className="border-dashed" />}
      </div>
    </SectionCard>
  );
}

function EvidencePanel({ a, evidence, setEvidence, addEvidence, comment, setComment, addComment }: any) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <SectionCard title="Evidencias" description="Anexe ou registre evidencias de execucao e eficacia.">
        <div className="mb-4 grid gap-2">
          <Input placeholder="Título da evidencia" value={evidence.title} onChange={(e) => setEvidence({ ...evidence, title: e.target.value })} />
          <Input placeholder="URL ou referência" value={evidence.url} onChange={(e) => setEvidence({ ...evidence, url: e.target.value })} />
          <Textarea placeholder="Descrição" value={evidence.description} onChange={(e) => setEvidence({ ...evidence, description: e.target.value })} />
          <Button disabled={!evidence.title} onClick={addEvidence}><FileCheck2 className="mr-2 h-4 w-4" />Registrar evidencia</Button>
        </div>
        <div className="space-y-2">
          {a.evidences.map((item: any) => <div key={item.id} className="rounded-lg border p-3"><div className="font-medium">{item.title}</div><div className="text-xs text-muted-foreground">{item.description ?? item.url ?? '-'}</div></div>)}
        </div>
      </SectionCard>
      <SectionCard title="Comentarios" description="Histórico narrativo do acompanhamento.">
        <div className="mb-4 grid gap-2">
          <Textarea placeholder="Adicionar comentario..." value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button disabled={!comment} onClick={addComment}><MessageSquare className="mr-2 h-4 w-4" />Comentar</Button>
        </div>
        <div className="space-y-2">
          {a.comments.map((item: any) => <div key={item.id} className="rounded-lg border p-3"><div className="text-sm">{item.comment}</div><div className="mt-1 text-xs text-muted-foreground">{formatDate(item.createdAt)}</div></div>)}
        </div>
      </SectionCard>
    </div>
  );
}

function EffectivenessPanel({ a, effectiveness, setEffectiveness, validate, saving, onAskAi }: any) {
  return (
    <SectionCard 
      title="Verificação de Eficácia & Aprendizado" 
      description="Verifique se a ação eliminou a causa raiz, avalie a melhoria dos indicadores e registre as lições aprendidas (Aprendizado)." 
      actions={<Button variant="outline" onClick={onAskAi}><Sparkles className="mr-2 h-4 w-4" />Análise de Coerência com IA</Button>}
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="md:col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border p-4 text-sm bg-card hover:bg-accent/30 cursor-pointer transition-colors shadow-sm">
            <input 
              type="checkbox" 
              checked={effectiveness.effective} 
              onChange={(e) => setEffectiveness({ ...effectiveness, effective: e.target.checked, reopen: !e.target.checked })} 
              className="h-4 w-4 accent-primary" 
            />
            <div>
              <span className="font-semibold block">Eficácia Validada</span>
              <span className="text-xs text-muted-foreground">A ação eliminou a causa raiz com sucesso.</span>
            </div>
          </label>
          <label className="flex items-center gap-3 rounded-xl border p-4 text-sm bg-card hover:bg-accent/30 cursor-pointer transition-colors shadow-sm">
            <input 
              type="checkbox" 
              checked={effectiveness.reopen} 
              onChange={(e) => setEffectiveness({ ...effectiveness, reopen: e.target.checked, effective: !e.target.checked })} 
              className="h-4 w-4 accent-primary" 
            />
            <div>
              <span className="font-semibold block text-status-red">Reabrir Plano de Ação</span>
              <span className="text-xs text-muted-foreground">A ação foi ineficaz e o desvio continua.</span>
            </div>
          </label>
        </div>

        <TextInput 
          label="Resultado Alcançado (Impacto Atingido)" 
          value={effectiveness.achievedResult} 
          onChange={(achievedResult) => setEffectiveness({ ...effectiveness, achievedResult })} 
        />
        <TextInput 
          label="Evidência da Melhoria (Link ou Documento)" 
          value={effectiveness.evidence} 
          onChange={(evidence) => setEffectiveness({ ...effectiveness, evidence })} 
        />
        
        <div className="md:col-span-2">
          <Label className="font-semibold text-xs">Aprendizado & Lições Aprendidas (Encerramento)</Label>
          <Textarea 
            rows={4} 
            value={effectiveness.summary} 
            placeholder="Descreva o que a equipe aprendeu com a tratativa desse problema, o conhecimento organizacional adquirido e as recomendações para evitar reincidência..." 
            onChange={(e) => setEffectiveness({ ...effectiveness, summary: e.target.value })} 
            className="mt-1"
          />
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <Button disabled={saving} onClick={validate} className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold">
          <ShieldCheck className="mr-2 h-4 w-4" />
          Registrar Eficácia & Aprendizado
        </Button>
      </div>
    </SectionCard>
  );
}

function AiPanel({ suggestions, onGenerate, onDecide }: { suggestions: any[]; onGenerate: (scope: string) => void; onDecide: (id: string, status: string) => void }) {
  return (
    <SectionCard title="IA assistente" description="Sugestões ficam pendentes ate o usuário aceitar ou rejeitar." actions={<Button onClick={() => onGenerate('general')}><Bot className="mr-2 h-4 w-4" />Gerar sugestões</Button>}>
      <div className="space-y-3">
        {suggestions.length === 0 && <EmptyState title="Nenhuma sugestão gerada" description="Peça apoio da IA para revisar causa, ação e eficacia." />}
        {suggestions.map((item) => (
          <div key={item.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Badge variant="outline">{item.suggestionType}</Badge>
                <div className="mt-2 font-semibold">{item.title}</div>
              </div>
              <StatusBadge value={item.status} label={item.status} />
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
  return (
    <SectionCard title="Histórico e auditoria do plano" description="Eventos gerados automaticamente por atualizações, IA, evidencias e eficacia.">
      <div className="space-y-2">
        {history.map((item) => (
          <div key={item.id} className="rounded-lg border p-3">
            <div className="text-sm font-semibold">{item.eventType}</div>
            <div className="text-xs text-muted-foreground">{formatDate(item.createdAt)} {item.field ? `- ${item.field}` : ''}</div>
            {item.afterValue && <div className="mt-1 text-sm">{item.afterValue}</div>}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function StepEditor({ rows, setRows, labelKey }: { rows: any[]; setRows: (rows: any[]) => void; labelKey: string }) {
  return (
    <div className="space-y-3">
      {rows.map((item, index) => (
        <div key={index} className="rounded-lg border p-3">
          <div className="mb-2 text-sm font-semibold">{item[labelKey]}</div>
          <Textarea rows={2} value={item.description ?? ''} onChange={(e) => setRows(updateArray(rows, index, { ...item, description: e.target.value }))} />
        </div>
      ))}
    </div>
  );
}

function GenericAnalysis({ method, session }: { method: string; session?: any }) {
  return (
    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      Use o campo de causa raiz abaixo para registrar a análise {TOOL_LABEL[method] ?? method}. Dados complementares ficam salvos no JSON da sessão.
      {session?.aiSummary && <div className="mt-2 rounded-md bg-muted p-2">{session.aiSummary}</div>}
    </div>
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

function updateArray(rows: any[], index: number, value: any) {
  return rows.map((item, itemIndex) => (itemIndex === index ? value : item));
}
