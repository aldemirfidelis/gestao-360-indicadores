'use client';

import { useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  History,
  Lightbulb,
  Link2,
  ListChecks,
  Maximize,
  Paperclip,
  PlayCircle,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Sparkles,
  UserRound,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type StageStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'VALIDATED';
type Phase = 'PLAN' | 'DO' | 'CHECK' | 'ACT';

interface UserOption {
  id: string;
  name: string;
  email?: string;
}

interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

interface PdcaStage {
  id: string;
  phase: Phase;
  title: string;
  subtitle: string;
  description: string;
  objective: string;
  responsibleUserId: string;
  dueDate: string;
  priority: Priority;
  progress: number;
  status: StageStatus;
  evidence: string;
  comments: string;
  validated: boolean;
  checklist: ChecklistItem[];
  data: Record<string, any>;
  isAiSuggested: boolean;
  convertedToTaskId: string | null;
  completedAt: string | null;
}

interface PdcaSuggestion {
  phase: Phase;
  field: string;
  suggestion: string;
  justification: string;
}

const CANVAS_WIDTH = 1120;
const CANVAS_HEIGHT = 720;

const STAGE_META: Record<Phase, {
  title: string;
  subtitle: string;
  color: string;
  bg: string;
  border: string;
  soft: string;
  icon: LucideIcon;
  number: string;
  x: number;
  y: number;
}> = {
  PLAN: {
    title: 'Plan',
    subtitle: 'Planejar causas, metas e ações',
    color: '#2563eb',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    soft: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: ClipboardList,
    number: '01',
    x: 24,
    y: 40,
  },
  DO: {
    title: 'Do',
    subtitle: 'Executar ações definidas',
    color: '#f97316',
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    soft: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: PlayCircle,
    number: '02',
    x: 710,
    y: 40,
  },
  CHECK: {
    title: 'Check',
    subtitle: 'Medir resultados e verificar eficácia',
    color: '#16a34a',
    bg: 'bg-green-50',
    border: 'border-green-300',
    soft: 'bg-green-50 text-green-700 border-green-200',
    icon: BarChart3,
    number: '03',
    x: 710,
    y: 372,
  },
  ACT: {
    title: 'Act',
    subtitle: 'Padronizar, corrigir e evoluir',
    color: '#7c3aed',
    bg: 'bg-violet-50',
    border: 'border-violet-300',
    soft: 'bg-violet-50 text-violet-700 border-violet-200',
    icon: RefreshCw,
    number: '04',
    x: 24,
    y: 372,
  },
};

const PHASES: Phase[] = ['PLAN', 'DO', 'CHECK', 'ACT'];

const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

const STATUS_LABEL: Record<StageStatus, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluída',
  BLOCKED: 'Bloqueada',
  VALIDATED: 'Validada',
};

export function PDCAVisualAnalysis({
  actionId,
  action,
  session,
  stages: initialStages,
  rootCause,
  users = [],
  saving,
  canEdit = true,
  onRootCauseChange,
  onSave,
}: {
  actionId?: string;
  action?: any;
  session?: any;
  stages?: any[];
  rootCause: string;
  users?: UserOption[];
  saving: boolean;
  canEdit?: boolean;
  onRootCauseChange: (value: string) => void;
  onSave: (stages: PdcaStage[], rootCause?: string) => void;
}) {
  const qc = useQueryClient();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [stages, setStages] = useState<PdcaStage[]>(() => normalizeStages(session?.pdcaSteps ?? initialStages, action, rootCause));
  const [selectedPhase, setSelectedPhase] = useState<Phase>('PLAN');
  const [zoom, setZoom] = useState(1);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<PdcaSuggestion[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');

  const selectedStage = stages.find((stage) => stage.phase === selectedPhase) ?? stages[0];
  const completedCount = stages.filter((stage) => stage.status === 'DONE' || stage.status === 'VALIDATED').length;
  const pdcaProgress = completedCount * 25;

  const responsibleById = useMemo(() => new Map(users.map((user) => [user.id, user.name])), [users]);

  function updateStage(phase: Phase, patch: Partial<PdcaStage>) {
    setStages((current) => current.map((stage) => (stage.phase === phase ? { ...stage, ...patch } : stage)));
  }

  function handleSave(nextStages = stages, nextRootCause = rootCause) {
    onSave(nextStages, nextRootCause);
    setLastSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  }

  function markDone(stage: PdcaStage) {
    const next = stages.map((item) =>
      item.phase === stage.phase
        ? { ...item, status: 'DONE' as StageStatus, progress: 100, validated: true, completedAt: new Date().toISOString() }
        : item,
    );
    setStages(next);
    handleSave(next);
  }

  async function convertToAction(stage: PdcaStage) {
    if (!actionId || stage.id.startsWith('temp-')) {
      toast.error('Salve a análise antes de transformar esta etapa em ação.');
      return;
    }
    try {
      const updatedAction = await api<any>(`/actions/${actionId}/analysis/pdca/stages/${stage.id}/convert-to-action`, {
        method: 'POST',
        json: { title: `PDCA ${stage.title}: ${stage.objective || stage.description || action?.title || 'ação vinculada'}` },
      });
      toast.success('Etapa transformada em tarefa do plano');
      const updatedStage = updatedAction?.analysisSessions
        ?.find((item: any) => item.method === 'PDCA')
        ?.pdcaSteps?.find((item: any) => item.id === stage.id);
      if (updatedStage?.convertedToTaskId) {
        updateStage(stage.phase, { convertedToTaskId: updatedStage.convertedToTaskId });
      }
      qc.invalidateQueries({ queryKey: ['action', actionId] });
    } catch (error: any) {
      toast.error(error?.message ?? 'Não foi possível transformar em ação');
    }
  }

  async function loadAiSuggestions() {
    if (!actionId) {
      setSuggestions(defaultSuggestions(action));
      setSuggestionsOpen(true);
      return;
    }
    setLoadingAi(true);
    try {
      const out = await api<PdcaSuggestion[]>(`/actions/${actionId}/analysis/pdca/ai-suggestions`, {
        method: 'POST',
        json: { stages },
      });
      setSuggestions(out.length ? out : defaultSuggestions(action));
      setSuggestionsOpen(true);
    } catch (error: any) {
      toast.error(error?.message ?? 'Não foi possível gerar sugestões com IA');
      setSuggestions(defaultSuggestions(action));
      setSuggestionsOpen(true);
    } finally {
      setLoadingAi(false);
    }
  }

  function acceptSuggestion(item: PdcaSuggestion, editAfter = false) {
    const phase = normalizePhase(item.phase);
    const stage = stages.find((candidate) => candidate.phase === phase);
    if (!stage) return;
    const patch: Partial<PdcaStage> = { isAiSuggested: true };
    if (item.field === 'objective') patch.objective = item.suggestion;
    else if (item.field === 'checklist') patch.checklist = appendChecklistText(stage.checklist, item.suggestion, true);
    else if (item.field === 'measurement') patch.data = { ...stage.data, measurement: item.suggestion };
    else if (item.field === 'standardization') patch.data = { ...stage.data, standardization: item.suggestion };
    else patch.description = [stage.description, item.suggestion].filter(Boolean).join('\n');
    const next = stages.map((candidate) => (candidate.phase === phase ? { ...candidate, ...patch } : candidate));
    setStages(next);
    setSelectedPhase(phase);
    setSuggestions((current) => current.filter((candidate) => candidate !== item));
    handleSave(next);
    if (editAfter) setSuggestionsOpen(false);
  }

  async function exportImage() {
    if (!canvasRef.current) return;
    const dataUrl = await toPng(canvasRef.current, { backgroundColor: '#f8fafc', pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = `pdca-${actionId ?? 'analise'}.png`;
    link.href = dataUrl;
    link.click();
  }

  function addChecklistItem() {
    const title = newChecklistItem.trim();
    if (!title) return;
    updateStage(selectedStage.phase, {
      checklist: [...selectedStage.checklist, { id: newTempId(), title, done: false }],
    });
    setNewChecklistItem('');
  }

  function centerCanvas() {
    setZoom(1);
    scrollRef.current?.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadAiSuggestions} disabled={loadingAi}>
            <Lightbulb className="mr-2 h-4 w-4" />
            {loadingAi ? 'Carregando...' : 'Dicas IA'}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => setZoom((value) => Math.max(0.8, value - 0.1))} title="Reduzir zoom">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="w-12 text-center text-xs font-medium text-slate-600">{Math.round(zoom * 100)}%</div>
          <Button size="icon" variant="outline" onClick={() => setZoom((value) => Math.min(1.2, value + 0.1))} title="Aumentar zoom">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={centerCanvas} title="Centralizar">
            <Maximize className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={exportImage}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button size="sm" onClick={() => handleSave()} disabled={!canEdit || saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar análise'}
          </Button>
        </div>
      </div>

      {!canEdit && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
          Você está em modo de visualização. Edição, conversão e checklist estão bloqueados.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div ref={scrollRef} className="max-h-[560px] overflow-auto bg-slate-50">
          <div
            ref={canvasRef}
            className="relative origin-top-left"
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          >
            <PDCACycle selectedPhase={selectedPhase} onSelect={setSelectedPhase} />
            {PHASES.map((phase) => {
              const stage = stages.find((item) => item.phase === phase)!;
              return (
                <PDCAStageCard
                  key={phase}
                  stage={stage}
                  selected={selectedPhase === phase}
                  responsibleName={stage.responsibleUserId ? responsibleById.get(stage.responsibleUserId) : undefined}
                  onSelect={() => setSelectedPhase(phase)}
                />
              );
            })}
          </div>
        </div>

        <PDCAStageDrawer
          stage={selectedStage}
          action={action}
          users={users}
          canEdit={canEdit}
          onUpdate={(patch) => updateStage(selectedStage.phase, patch)}
          onSave={() => handleSave()}
          onMarkDone={() => markDone(selectedStage)}
          onConvert={() => convertToAction(selectedStage)}
          onRootCauseChange={onRootCauseChange}
        />
      </div>

      <PDCAFooter completedCount={completedCount} progress={pdcaProgress} saving={saving} lastSavedAt={lastSavedAt} />

      <Dialog open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Dicas IA — como funciona o ciclo PDCA</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm leading-6 text-slate-700">
              O <strong>PDCA</strong> é o ciclo de melhoria contínua. Rode as 4 etapas em sequência e repita o ciclo:
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li><strong>Plan (Planejar)</strong>: defina o problema, a causa raiz, a meta e as ações.</li>
                <li><strong>Do (Fazer)</strong>: execute as ações, registre responsáveis e evidências.</li>
                <li><strong>Check (Checar)</strong>: meça o resultado e compare com a meta (eficácia).</li>
                <li><strong>Act (Agir)</strong>: padronize o que funcionou ou corrija e rode o ciclo novamente.</li>
              </ol>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {PHASES.map((phase) => {
                const meta = STAGE_META[phase];
                return (
                  <div key={phase} className="rounded-lg border bg-white p-3">
                    <div className={cn('mb-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold', meta.soft)}>
                      {meta.number} {meta.title}
                    </div>
                    <p className="text-xs leading-5 text-slate-600">{meta.subtitle}</p>
                  </div>
                );
              })}
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-800">Ideias da IA para este ciclo</div>
              {suggestions.length === 0 && (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  {actionId ? 'Sem ideias específicas no momento — use o tutorial acima para conduzir o ciclo.' : 'Salve a análise para a IA sugerir ideias para este ciclo.'}
                </div>
              )}
              <div className="grid gap-2 md:grid-cols-2">
                {suggestions.map((item) => {
                  const meta = STAGE_META[normalizePhase(item.phase)];
                  return (
                    <div key={`${item.phase}-${item.field}-${item.suggestion}`} className="rounded-lg border bg-white p-3 shadow-sm">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <Badge variant="outline" className={meta.soft}>{meta.title}</Badge>
                        <Badge variant="outline">{item.field}</Badge>
                      </div>
                      <div className="text-sm font-semibold text-slate-900">{item.suggestion}</div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{item.justification}</p>
                      {canEdit && (
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => acceptSuggestion(item)}>Aplicar dica</Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSuggestionsOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={checklistOpen} onOpenChange={setChecklistOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Checklist da etapa {selectedStage.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {selectedStage.checklist.map((item) => (
              <label key={item.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateStage(selectedStage.phase, {
                      checklist: selectedStage.checklist.map((candidate) => candidate.id === item.id ? { ...candidate, done: event.target.checked } : candidate),
                    })
                  }
                />
                <span>{item.title}</span>
              </label>
            ))}
            <div className="flex gap-2 pt-2">
              <Input value={newChecklistItem} onChange={(event) => setNewChecklistItem(event.target.value)} placeholder="Novo item do checklist" disabled={!canEdit} />
              <Button onClick={addChecklistItem} disabled={!canEdit}>Adicionar</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChecklistOpen(false)}>Fechar</Button>
            <Button onClick={() => handleSave()} disabled={!canEdit || saving}>Salvar checklist</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PDCACycle({ selectedPhase, onSelect }: { selectedPhase: Phase; onSelect: (phase: Phase) => void }) {
  return (
    <div className="absolute left-[425px] top-[198px] z-10 h-[250px] w-[250px]">
      <div
        className="absolute inset-0 rounded-full shadow-lg"
        style={{ background: 'conic-gradient(#f97316 0deg 90deg, #16a34a 90deg 180deg, #7c3aed 180deg 270deg, #2563eb 270deg 360deg)' }}
      />
      <div className="absolute inset-[24px] rounded-full border-[10px] border-white/70 bg-white shadow-inner" />
      <div className="absolute inset-[73px] flex flex-col items-center justify-center rounded-full bg-white text-center shadow-md">
        <div className="text-2xl font-bold text-slate-900">PDCA</div>
        <div className="mt-1 text-xs font-medium text-slate-500">Melhoria<br />Contínua</div>
      </div>
      {PHASES.map((phase) => {
        const meta = STAGE_META[phase];
        const positions: Record<Phase, string> = {
          PLAN: 'left-[16px] top-[82px]',
          DO: 'right-[16px] top-[82px]',
          CHECK: 'right-[16px] bottom-[82px]',
          ACT: 'left-[16px] bottom-[82px]',
        };
        return (
          <button
            key={phase}
            type="button"
            className={cn('absolute flex h-10 w-10 items-center justify-center rounded-full border-4 border-white text-xs font-bold text-white shadow-md', positions[phase], selectedPhase === phase && 'ring-4 ring-slate-300')}
            style={{ backgroundColor: meta.color }}
            onClick={() => onSelect(phase)}
          >
            {meta.number}
          </button>
        );
      })}
    </div>
  );
}

function PDCAStageCard({ stage, selected, responsibleName, onSelect }: { stage: PdcaStage; selected: boolean; responsibleName?: string; onSelect: () => void }) {
  const meta = STAGE_META[stage.phase];
  const Icon = meta.icon;
  const summary = stageSummary(stage, responsibleName);
  return (
    <button
      type="button"
      className={cn('absolute z-20 flex h-[300px] w-[386px] flex-col overflow-hidden rounded-lg border bg-white p-4 text-left shadow-sm transition hover:shadow-md', meta.border, selected && 'shadow-lg ring-2 ring-blue-200')}
      style={{ left: meta.x, top: meta.y }}
      onClick={onSelect}
    >
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg border', meta.soft)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold" style={{ color: meta.color }}>{stage.title}</div>
            <div className="mt-0.5 text-xs font-medium text-slate-500">{stage.subtitle}</div>
          </div>
        </div>
        <span className="text-lg text-slate-500">›</span>
      </div>
      <div className="mt-3 grid flex-1 content-start gap-1.5 overflow-hidden">
        {summary.map((item) => (
          <div key={item.label} className="grid grid-cols-[18px_100px_1fr] items-start gap-2 text-xs">
            <item.icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} />
            <span className="font-semibold text-slate-600">{item.label}</span>
            <span className="line-clamp-2 min-w-0 text-slate-700">{item.value}</span>
          </div>
        ))}
        <div className="grid grid-cols-[18px_100px_1fr] items-center gap-2 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} />
          <span className="font-semibold text-slate-600">Status</span>
          <StatusPill stage={stage} />
        </div>
      </div>
      <div className="mt-2 h-1.5 shrink-0 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${stage.progress}%`, backgroundColor: meta.color }} />
      </div>
    </button>
  );
}

function PDCAStageDrawer({
  stage,
  action,
  users,
  canEdit,
  onUpdate,
  onSave,
  onMarkDone,
  onConvert,
  onRootCauseChange,
}: {
  stage: PdcaStage;
  action?: any;
  users: UserOption[];
  canEdit: boolean;
  onUpdate: (patch: Partial<PdcaStage>) => void;
  onSave: () => void;
  onMarkDone: () => void;
  onConvert: () => void;
  onRootCauseChange: (value: string) => void;
}) {
  const meta = STAGE_META[stage.phase];
  return (
    <aside className="border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-3">
        <div className="text-sm font-semibold text-slate-900">Etapa selecionada</div>
        <div className="mt-2 flex items-start gap-2">
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900">{stage.title}</div>
            <div className="mt-0.5 text-xs text-slate-500">{stage.subtitle}</div>
          </div>
        </div>
      </div>
      <div className="max-h-[520px] space-y-3 overflow-y-auto p-3">
        <fieldset disabled={!canEdit} className="space-y-3">
          <div>
            <Label>Descrição / Objetivo</Label>
            <Textarea rows={4} value={stage.description} onChange={(event) => onUpdate({ description: event.target.value })} onBlur={onSave} />
          </div>
          <div>
            <Label>Objetivo</Label>
            <Input value={stage.objective} onChange={(event) => onUpdate({ objective: event.target.value })} onBlur={onSave} />
          </div>
          {stage.phase === 'PLAN' && (
            <>
              <TextInput label="Problema principal" value={stage.data.problem ?? ''} onChange={(value) => onUpdate({ data: { ...stage.data, problem: value } })} onBlur={onSave} />
              <TextInput label="Causa raiz" value={stage.data.rootCause ?? ''} onChange={(value) => { onUpdate({ data: { ...stage.data, rootCause: value } }); onRootCauseChange(value); }} onBlur={onSave} />
              <TextInput label="Meta" value={stage.data.target ?? ''} onChange={(value) => onUpdate({ data: { ...stage.data, target: value } })} onBlur={onSave} />
              <TextInput label="Critério de sucesso" value={stage.data.successCriteria ?? ''} onChange={(value) => onUpdate({ data: { ...stage.data, successCriteria: value } })} onBlur={onSave} />
              <TextInput label="Riscos previstos" value={stage.data.risks ?? ''} onChange={(value) => onUpdate({ data: { ...stage.data, risks: value } })} onBlur={onSave} />
            </>
          )}
          {stage.phase === 'DO' && (
            <>
              <TextInput label="Ações executadas" value={stage.data.actions ?? ''} onChange={(value) => onUpdate({ data: { ...stage.data, actions: value } })} onBlur={onSave} />
              <TextInput label="Impedimentos" value={stage.data.blockers ?? ''} onChange={(value) => onUpdate({ data: { ...stage.data, blockers: value } })} onBlur={onSave} />
              <TextInput label="Percentual executado" value={String(stage.progress)} onChange={(value) => onUpdate({ progress: clampProgress(value) })} onBlur={onSave} />
            </>
          )}
          {stage.phase === 'CHECK' && (
            <>
              <TextInput label="Resultado medido" value={stage.data.measuredResult ?? ''} onChange={(value) => onUpdate({ data: { ...stage.data, measuredResult: value } })} onBlur={onSave} />
              <TextInput label="Indicador monitorado" value={stage.data.indicator ?? ''} onChange={(value) => onUpdate({ data: { ...stage.data, indicator: value } })} onBlur={onSave} />
              <TextInput label="Meta" value={stage.data.target ?? ''} onChange={(value) => onUpdate({ data: { ...stage.data, target: value } })} onBlur={onSave} />
              <TextInput label="Desvio" value={stage.data.deviation ?? ''} onChange={(value) => onUpdate({ data: { ...stage.data, deviation: value } })} onBlur={onSave} />
              <TextInput label="Comentário da verificação" value={stage.data.checkComment ?? ''} onChange={(value) => onUpdate({ data: { ...stage.data, checkComment: value } })} onBlur={onSave} />
            </>
          )}
          {stage.phase === 'ACT' && (
            <>
              <TextInput label="Lições aprendidas" value={stage.data.lessons ?? ''} onChange={(value) => onUpdate({ data: { ...stage.data, lessons: value } })} onBlur={onSave} />
              <TextInput label="Ajustes necessários" value={stage.data.adjustments ?? ''} onChange={(value) => onUpdate({ data: { ...stage.data, adjustments: value } })} onBlur={onSave} />
              <TextInput label="Padronização" value={stage.data.standardization ?? ''} onChange={(value) => onUpdate({ data: { ...stage.data, standardization: value } })} onBlur={onSave} />
              <TextInput label="Próxima revisão" value={stage.data.nextReview ?? ''} onChange={(value) => onUpdate({ data: { ...stage.data, nextReview: value } })} onBlur={onSave} />
            </>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Responsável</Label>
              <NativeSelect value={stage.responsibleUserId} onChange={(event) => onUpdate({ responsibleUserId: event.target.value })} onBlur={onSave}>
                <option value="">Sem responsável</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={stage.dueDate?.slice(0, 10) ?? ''} onChange={(event) => onUpdate({ dueDate: event.target.value })} onBlur={onSave} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Prioridade</Label>
              <NativeSelect value={stage.priority} onChange={(event) => onUpdate({ priority: event.target.value as Priority })} onBlur={onSave}>
                {Object.entries(PRIORITY_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Status</Label>
              <NativeSelect value={stage.status} onChange={(event) => onUpdate({ status: event.target.value as StageStatus })} onBlur={onSave}>
                {Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div>
            <Label>Progresso</Label>
            <Input type="number" min={0} max={100} value={stage.progress} onChange={(event) => onUpdate({ progress: clampProgress(event.target.value) })} onBlur={onSave} />
          </div>
          <div>
            <Label>Evidências vinculadas</Label>
            <Textarea rows={3} value={stage.evidence} onChange={(event) => onUpdate({ evidence: event.target.value })} onBlur={onSave} />
          </div>
        </fieldset>

        <div className="grid gap-2">
          <PanelLink icon={Paperclip} label="Evidências vinculadas" value={`${stage.evidence ? 1 : 0} registro`} />
          <PanelLink icon={Link2} label="Ações vinculadas" value={stage.convertedToTaskId ? '1 tarefa criada' : '0 tarefas vinculadas'} />
          <PanelLink icon={ListChecks} label="Checklist da etapa" value={`${stage.checklist.filter((item) => item.done).length}/${stage.checklist.length} concluídos`} />
        </div>

        <div className="space-y-2 border-t border-slate-200 pt-4">
          <Button className="w-full justify-start" onClick={onConvert} disabled={!canEdit || Boolean(stage.convertedToTaskId)}>
            <Rocket className="mr-2 h-4 w-4" />
            Transformar em plano de ação
          </Button>
          <Button variant="outline" className="w-full justify-start text-green-700" onClick={onMarkDone} disabled={!canEdit}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Marcar concluída
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={onSave} disabled={!canEdit}>
            <FileText className="mr-2 h-4 w-4" />
            Editar etapa
          </Button>
        </div>
      </div>
    </aside>
  );
}

function TextInput({ label, value, onChange, onBlur }: { label: string; value: string; onChange: (value: string) => void; onBlur: () => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value ?? ''} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} />
    </div>
  );
}

function PanelLink({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <span className="flex items-center gap-2 font-medium text-slate-700"><Icon className="h-4 w-4 text-slate-500" />{label}</span>
      <span className="text-xs text-slate-500">{value}</span>
    </div>
  );
}

function PDCAFooter({ completedCount, progress, saving, lastSavedAt }: { completedCount: number; progress: number; saving: boolean; lastSavedAt: string | null }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600">
      <div>
        <div className="font-semibold text-slate-800">Ciclo atual</div>
        <div>{completedCount} de 4 etapas concluídas</div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" />Pendente</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-400" />Em andamento</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-green-500" />Concluído</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Atrasado</span>
      </div>
      <div className="text-right">
        <div className="font-semibold text-slate-800">{progress}%</div>
        <div>{saving ? 'Salvando...' : lastSavedAt ? `Salvo às ${lastSavedAt}` : 'Arraste para reposicionar'}</div>
      </div>
    </div>
  );
}

function StatusPill({ stage }: { stage: PdcaStage }) {
  const overdue = isOverdue(stage);
  const label = overdue ? 'Atrasada' : STATUS_LABEL[stage.status];
  const classes = overdue
    ? 'border-red-200 bg-red-50 text-red-700'
    : stage.status === 'DONE' || stage.status === 'VALIDATED'
      ? 'border-green-200 bg-green-50 text-green-700'
      : stage.status === 'IN_PROGRESS'
        ? 'border-orange-200 bg-orange-50 text-orange-700'
        : stage.status === 'BLOCKED'
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-slate-200 bg-slate-100 text-slate-600';
  return <span className={cn('w-fit rounded-full border px-3 py-1 text-[11px] font-semibold', classes)}>{label}</span>;
}

function stageSummary(stage: PdcaStage, responsibleName?: string) {
  if (stage.phase === 'PLAN') {
    return [
      { icon: FileText, label: 'Problema principal', value: stage.data.problem || 'Não informado' },
      { icon: RefreshCw, label: 'Causa raiz', value: stage.data.rootCause || 'Não definida' },
      { icon: BarChart3, label: 'Meta', value: stage.data.target || 'Definir meta' },
      { icon: UserRound, label: 'Responsável', value: responsibleName || 'Sem responsável' },
      { icon: CalendarDays, label: 'Prazo', value: formatDate(stage.dueDate) },
    ];
  }
  if (stage.phase === 'DO') {
    return [
      { icon: PlayCircle, label: 'Ações em andamento', value: stage.data.actionsCount ?? stage.data.actions ?? '0 ações' },
      { icon: UserRound, label: 'Responsáveis', value: responsibleName || 'Não definido' },
      { icon: Paperclip, label: 'Evidências coletadas', value: stage.evidence ? '1 registro' : '0 registros' },
      { icon: CalendarDays, label: 'Início', value: stage.data.startedAt || '-' },
    ];
  }
  if (stage.phase === 'CHECK') {
    return [
      { icon: BarChart3, label: 'Resultado atual', value: stage.data.measuredResult || stage.data.currentResult || '-' },
      { icon: FileText, label: 'Indicador', value: stage.data.indicator || '-' },
      { icon: RefreshCw, label: 'Desvio', value: stage.data.deviation || '-' },
      { icon: CheckCircle2, label: 'Eficácia parcial', value: `${stage.progress}%` },
    ];
  }
  return [
    { icon: FileText, label: 'Lições aprendidas', value: stage.data.lessons ? '1 registro' : 'Nenhum registro' },
    { icon: ListChecks, label: 'Padronização', value: stage.data.standardization || 'Não iniciada' },
    { icon: RefreshCw, label: 'Próximos ajustes', value: stage.data.adjustments || 'Aguardando verificação' },
  ];
}

function normalizeStages(rows: any[] | undefined, action?: any, rootCause = ''): PdcaStage[] {
  const byPhase = new Map((rows ?? []).map((row) => [normalizePhase(row.phase), row]));
  return PHASES.map((phase) => makeStage(byPhase.get(phase), phase, action, rootCause));
}

function makeStage(row: any, phase: Phase, action?: any, rootCause = ''): PdcaStage {
  const meta = STAGE_META[phase];
  const data = normalizeData(row?.data);
  const fallback = defaultStageData(phase, action, rootCause);
  return {
    id: row?.id && !String(row.id).startsWith('temp-') ? String(row.id) : newTempId(),
    phase,
    title: row?.title ?? meta.title,
    subtitle: row?.subtitle ?? meta.subtitle,
    description: row?.description ?? fallback.description,
    objective: row?.objective ?? fallback.objective,
    responsibleUserId: row?.responsibleUserId ?? action?.responsibleUser?.id ?? '',
    dueDate: row?.dueDate ?? action?.dueDate ?? '',
    priority: normalizePriority(row?.priority ?? action?.priority),
    progress: clampProgress(row?.progress ?? fallback.progress),
    status: normalizeStatus(row?.status ?? fallback.status),
    evidence: row?.evidence ?? '',
    comments: row?.comments ?? '',
    validated: Boolean(row?.validated),
    checklist: Array.isArray(row?.checklist) && row.checklist.length ? row.checklist : defaultChecklist(phase),
    data: { ...fallback.data, ...data },
    isAiSuggested: Boolean(row?.isAiSuggested),
    convertedToTaskId: row?.convertedToTaskId ?? data.convertedTaskId ?? null,
    completedAt: row?.completedAt ?? null,
  };
}

// Auto-preenche (link) o ciclo a partir do plano/indicador para poupar digitação.
function defaultStageData(phase: Phase, action?: any, rootCause = '') {
  const result = action?.indicator?.results?.[0] ?? action?.indicatorResult ?? null;
  const base = {
    PLAN: {
      description: 'Definir o problema, identificar a causa raiz e estabelecer metas e ações para atingir a melhoria desejada.',
      objective: action?.problemDescription ?? action?.title ?? '',
      progress: 25,
      status: 'PENDING',
      data: {
        problem: action?.problemDescription ?? action?.title ?? '',
        rootCause: rootCause || action?.rootCause || '',
        target: action?.expectedResult ?? '',
        successCriteria: action?.expectedResult ?? '',
      },
    },
    DO: {
      description: 'Executar as ações definidas, registrar responsáveis, impedimentos e evidências.',
      objective: action?.description ?? '',
      progress: action?.tasks?.length ? 25 : 0,
      status: action?.tasks?.length ? 'IN_PROGRESS' : 'PENDING',
      data: {
        actions: action?.tasks?.length ? `${action.tasks.length} ação(ões) no plano` : '',
        actionsCount: `${action?.tasks?.length ?? 0} ações no plano`,
        startedAt: action?.startDate ? formatDate(action.startDate) : '',
      },
    },
    CHECK: {
      description: 'Medir resultados, comparar com a meta e verificar a eficácia parcial.',
      objective: action?.effectivenessSummary ?? '',
      progress: action?.effectivenessStatus === 'EFFECTIVE' ? 100 : 0,
      status: 'PENDING',
      data: {
        measuredResult: result?.value !== undefined && result?.value !== null ? String(result.value) : '',
        currentResult: result?.value !== undefined && result?.value !== null ? String(result.value) : '',
        indicator: action?.indicator?.name ?? '',
        target: action?.expectedResult ?? '',
        deviation: result?.deviationPct !== undefined && result?.deviationPct !== null ? `${result.deviationPct}%` : '',
      },
    },
    ACT: {
      description: 'Registrar aprendizados, ajustes e padronização para sustentar a melhoria.',
      objective: '',
      progress: 0,
      status: 'PENDING',
      data: {},
    },
  } satisfies Record<Phase, { description: string; objective: string; progress: number; status: StageStatus; data: Record<string, any> }>;
  return base[phase];
}

function defaultChecklist(phase: Phase): ChecklistItem[] {
  const items: Record<Phase, string[]> = {
    PLAN: ['Problema definido', 'Causa raiz validada', 'Meta definida', 'Responsável definido', 'Prazo definido'],
    DO: ['Ações iniciadas', 'Responsáveis acionados', 'Evidências coletadas', 'Impedimentos registrados'],
    CHECK: ['Indicador medido', 'Resultado comparado com a meta', 'Eficácia avaliada', 'Desvio registrado'],
    ACT: ['Lições aprendidas registradas', 'Ajustes definidos', 'Padronização criada', 'Próximo ciclo definido'],
  };
  return items[phase].map((title, index) => ({ id: `${phase}-${index + 1}`, title, done: false }));
}

function appendChecklistText(checklist: ChecklistItem[], text: string, done = false) {
  return [...checklist, { id: newTempId(), title: text, done }];
}

function defaultSuggestions(action: any): PdcaSuggestion[] {
  return [
    { phase: 'PLAN', field: 'objective', suggestion: `Definir meta, causa raiz e critério de sucesso para ${action?.title ?? 'o plano'}.`, justification: 'A etapa Plan precisa orientar a execução com clareza.' },
    { phase: 'DO', field: 'description', suggestion: 'Registrar ações executadas, impedimentos e evidências por responsável.', justification: 'A execução precisa ser rastreável antes da verificação.' },
    { phase: 'CHECK', field: 'measurement', suggestion: `Comparar o indicador ${action?.indicator?.name ?? 'monitorado'} com a meta definida.`, justification: 'O Check deve validar melhoria com dado objetivo.' },
    { phase: 'ACT', field: 'standardization', suggestion: 'Padronizar o que funcionou e definir próxima revisão do processo.', justification: 'A melhoria contínua depende de sustentação e aprendizado.' },
  ];
}

function normalizePhase(value: any): Phase {
  const key = normalizeKey(value);
  if (key === 'DO') return 'DO';
  if (key === 'CHECK') return 'CHECK';
  if (key === 'ACT') return 'ACT';
  return 'PLAN';
}

function normalizePriority(value: any): Priority {
  const key = normalizeKey(value);
  if (key === 'LOW' || key === 'BAIXA') return 'LOW';
  if (key === 'HIGH' || key === 'ALTA') return 'HIGH';
  if (key === 'CRITICAL' || key === 'CRITICA') return 'CRITICAL';
  return 'MEDIUM';
}

function normalizeStatus(value: any): StageStatus {
  const key = normalizeKey(value);
  if (key === 'IN_PROGRESS' || key === 'EM_ANDAMENTO') return 'IN_PROGRESS';
  if (key === 'DONE' || key === 'CONCLUIDA') return 'DONE';
  if (key === 'BLOCKED' || key === 'BLOQUEADA') return 'BLOCKED';
  if (key === 'VALIDATED' || key === 'VALIDADA') return 'VALIDATED';
  return 'PENDING';
}

function normalizeData(value: any) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeKey(value: any) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function clampProgress(value: any) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function isOverdue(stage: PdcaStage) {
  if (!stage.dueDate || stage.status === 'DONE' || stage.status === 'VALIDATED') return false;
  return new Date(stage.dueDate) < new Date();
}

function newTempId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `temp-${crypto.randomUUID()}`;
  return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
