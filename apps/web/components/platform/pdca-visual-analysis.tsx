'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  PlayCircle,
  RefreshCw,
  Rocket,
  Save,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

const STAGE_META: Record<Phase, {
  title: string;
  subtitle: string;
  color: string;
  soft: string;
  border: string;
  icon: LucideIcon;
  number: string;
}> = {
  PLAN: { title: 'Plan', subtitle: 'Planejar causas, metas e ações', color: '#2563eb', soft: 'bg-blue-50 text-blue-700 border-blue-200', border: 'border-blue-200', icon: ClipboardList, number: '01' },
  DO: { title: 'Do', subtitle: 'Executar as ações definidas', color: '#f97316', soft: 'bg-orange-50 text-orange-700 border-orange-200', border: 'border-orange-200', icon: PlayCircle, number: '02' },
  CHECK: { title: 'Check', subtitle: 'Medir resultados e verificar eficácia', color: '#16a34a', soft: 'bg-green-50 text-green-700 border-green-200', border: 'border-green-200', icon: BarChart3, number: '03' },
  ACT: { title: 'Act', subtitle: 'Padronizar, corrigir e evoluir', color: '#7c3aed', soft: 'bg-violet-50 text-violet-700 border-violet-200', border: 'border-violet-200', icon: RefreshCw, number: '04' },
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

// Campos específicos de cada fase, editados direto no bloco.
const PHASE_FIELDS: Record<Phase, { key: string; label: string; area?: boolean; rootCause?: boolean }[]> = {
  PLAN: [
    { key: 'problem', label: 'Problema principal', area: true },
    { key: 'rootCause', label: 'Causa raiz', area: true, rootCause: true },
    { key: 'target', label: 'Meta' },
    { key: 'successCriteria', label: 'Critério de sucesso' },
  ],
  DO: [
    { key: 'actions', label: 'Ações executadas', area: true },
    { key: 'blockers', label: 'Impedimentos' },
  ],
  CHECK: [
    { key: 'measuredResult', label: 'Resultado medido' },
    { key: 'indicator', label: 'Indicador monitorado' },
    { key: 'target', label: 'Meta' },
    { key: 'deviation', label: 'Desvio' },
  ],
  ACT: [
    { key: 'lessons', label: 'Lições aprendidas', area: true },
    { key: 'adjustments', label: 'Ajustes necessários' },
    { key: 'standardization', label: 'Padronização' },
  ],
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
  const stagesRef = useRef<PdcaStage[]>([]);
  const [stages, setStages] = useState<PdcaStage[]>(() => normalizeStages(session?.pdcaSteps ?? initialStages, action, rootCause));
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<PdcaSuggestion[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [convertingPhase, setConvertingPhase] = useState<Phase | null>(null);

  useEffect(() => {
    setStages(normalizeStages(session?.pdcaSteps ?? initialStages, action, rootCause));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.updatedAt]);

  useEffect(() => {
    stagesRef.current = stages;
  }, [stages]);

  const completedCount = stages.filter((stage) => stage.status === 'DONE' || stage.status === 'VALIDATED').length;
  const pdcaProgress = completedCount * 25;
  // Primeira fase ainda não concluída (fase "atual" do ciclo).
  const currentPhaseIndex = stages.findIndex((stage) => stage.status !== 'DONE' && stage.status !== 'VALIDATED');
  const responsibleById = useMemo(() => new Map(users.map((user) => [user.id, user.name])), [users]);

  function handleSave(nextStages = stagesRef.current, nextRootCause = rootCause) {
    onSave(nextStages, nextRootCause);
    setLastSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  }

  // Edição de texto (descrição/objetivo/campos) — salva no blur.
  function updateStage(phase: Phase, patch: Partial<PdcaStage>) {
    setStages((current) => current.map((stage) => (stage.phase === phase ? { ...stage, ...patch } : stage)));
  }

  // Confirma campos de seleção/data já salvando (evita onChange não disparar em valor pré-selecionado).
  function commitStage(phase: Phase, patch: Partial<PdcaStage>) {
    const next = stagesRef.current.map((stage) => (stage.phase === phase ? { ...stage, ...patch } : stage));
    setStages(next);
    handleSave(next);
  }

  function updateData(phase: Phase, key: string, value: string) {
    setStages((current) => current.map((stage) => (stage.phase === phase ? { ...stage, data: { ...stage.data, [key]: value } } : stage)));
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
    setConvertingPhase(stage.phase);
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
    } finally {
      setConvertingPhase(null);
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
    else if (item.field === 'measurement') patch.data = { ...stage.data, measuredResult: item.suggestion };
    else if (item.field === 'standardization') patch.data = { ...stage.data, standardization: item.suggestion };
    else patch.description = [stage.description, item.suggestion].filter(Boolean).join('\n');
    const next = stages.map((candidate) => (candidate.phase === phase ? { ...candidate, ...patch } : candidate));
    setStages(next);
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

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadAiSuggestions} disabled={!canEdit || loadingAi}>
            <Sparkles className="mr-2 h-4 w-4" />
            {loadingAi ? 'Gerando...' : 'Sugestão com IA'}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          Você está em modo de visualização. Edição e conversão estão bloqueados.
        </div>
      )}

      <div className="bg-slate-50 p-4" ref={canvasRef}>
        <div className="mb-4 text-center">
          <div className="text-lg font-bold tracking-tight text-slate-900">PDCA — Ciclo de melhoria contínua</div>
          <div className="text-xs font-medium text-slate-500">Preencha cada etapa direto no bloco. A maioria dos campos já vem puxada do plano e do indicador.</div>
        </div>

        <PDCAStepper stages={stages} currentPhaseIndex={currentPhaseIndex} />

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {PHASES.map((phase, index) => {
            const stage = stages.find((item) => item.phase === phase)!;
            return (
              <PDCAStageBlock
                key={phase}
                stage={stage}
                active={index === currentPhaseIndex}
                canEdit={canEdit}
                converting={convertingPhase === phase}
                users={users}
                responsibleName={stage.responsibleUserId ? responsibleById.get(stage.responsibleUserId) : undefined}
                onUpdate={(patch) => updateStage(phase, patch)}
                onCommit={(patch) => commitStage(phase, patch)}
                onUpdateData={(key, value) => updateData(phase, key, value)}
                onRootCauseChange={onRootCauseChange}
                onBlurSave={() => handleSave()}
                onMarkDone={() => markDone(stage)}
                onConvert={() => convertToAction(stage)}
              />
            );
          })}
        </div>
      </div>

      <PDCAFooter completedCount={completedCount} progress={pdcaProgress} saving={saving} lastSavedAt={lastSavedAt} />

      <Dialog open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Sugestões de PDCA com IA</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
            {suggestions.length === 0 && <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhuma sugestão pendente.</div>}
            {suggestions.map((item) => {
              const meta = STAGE_META[normalizePhase(item.phase)];
              return (
                <div key={`${item.phase}-${item.field}-${item.suggestion}`} className="rounded-lg border bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge variant="outline" className={meta.soft}>{meta.title}</Badge>
                    <Badge variant="outline">{item.field}</Badge>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{item.suggestion}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{item.justification}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => acceptSuggestion(item)} disabled={!canEdit}>Aceitar</Button>
                    <Button size="sm" variant="outline" onClick={() => acceptSuggestion(item, true)} disabled={!canEdit}>Editar e aceitar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setSuggestions((current) => current.filter((candidate) => candidate !== item))}>Descartar</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PDCAStepper({ stages, currentPhaseIndex }: { stages: PdcaStage[]; currentPhaseIndex: number }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-1.5">
      {PHASES.map((phase, index) => {
        const stage = stages.find((item) => item.phase === phase)!;
        const meta = STAGE_META[phase];
        const done = stage.status === 'DONE' || stage.status === 'VALIDATED';
        const active = index === currentPhaseIndex;
        return (
          <div key={phase} className="flex items-center gap-1.5">
            <span
              className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold', active ? 'ring-2 ring-offset-1' : '')}
              style={{ borderColor: meta.color, color: meta.color, backgroundColor: done ? meta.color : '#fff', ...(done ? { color: '#fff' } : {}) }}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <meta.icon className="h-3.5 w-3.5" />}
              {meta.number} {meta.title}
            </span>
            {index < PHASES.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300" />}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Bloco de uma fase do PDCA com edição inline. Os campos já chegam puxados do plano/indicador;
 * o usuário edita direto no card e pode marcar a fase como concluída ou transformá-la em ação.
 */
function PDCAStageBlock({
  stage,
  active,
  canEdit,
  converting,
  users,
  responsibleName,
  onUpdate,
  onCommit,
  onUpdateData,
  onRootCauseChange,
  onBlurSave,
  onMarkDone,
  onConvert,
}: {
  stage: PdcaStage;
  active: boolean;
  canEdit: boolean;
  converting: boolean;
  users: UserOption[];
  responsibleName?: string;
  onUpdate: (patch: Partial<PdcaStage>) => void;
  onCommit: (patch: Partial<PdcaStage>) => void;
  onUpdateData: (key: string, value: string) => void;
  onRootCauseChange: (value: string) => void;
  onBlurSave: () => void;
  onMarkDone: () => void;
  onConvert: () => void;
}) {
  const meta = STAGE_META[stage.phase];
  const Icon = meta.icon;
  const done = stage.status === 'DONE' || stage.status === 'VALIDATED';
  const fields = PHASE_FIELDS[stage.phase];
  return (
    <div
      className={cn('flex flex-col rounded-xl border bg-white p-4 shadow-sm transition', meta.border, active && 'ring-2 ring-blue-200')}
      style={{ borderTopColor: meta.color, borderTopWidth: 3 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-sm" style={{ backgroundColor: meta.color }}>
            {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
          </span>
          <div>
            <div className="text-base font-bold leading-4" style={{ color: meta.color }}>{meta.number}. {stage.title}</div>
            <div className="text-[11px] font-medium text-slate-500">{stage.subtitle}</div>
          </div>
        </div>
        <StatusPill stage={stage} />
      </div>

      <fieldset disabled={!canEdit} className="mt-3 flex-1 space-y-2">
        {fields.map((field) =>
          field.area ? (
            <div key={field.key}>
              <Label className="text-[11px] text-slate-500">{field.label}</Label>
              <Textarea
                rows={2}
                value={stage.data[field.key] ?? ''}
                onChange={(event) => {
                  onUpdateData(field.key, event.target.value);
                  if (field.rootCause) onRootCauseChange(event.target.value);
                }}
                onBlur={onBlurSave}
                className="text-sm"
              />
            </div>
          ) : (
            <div key={field.key}>
              <Label className="text-[11px] text-slate-500">{field.label}</Label>
              <Input
                value={stage.data[field.key] ?? ''}
                onChange={(event) => {
                  onUpdateData(field.key, event.target.value);
                  if (field.rootCause) onRootCauseChange(event.target.value);
                }}
                onBlur={onBlurSave}
                className="h-9 text-sm"
              />
            </div>
          ),
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label className="text-[11px] text-slate-500">Responsável</Label>
            <NativeSelect value={stage.responsibleUserId} onChange={(event) => onCommit({ responsibleUserId: event.target.value })} className="h-9 text-sm">
              <option value="">Sem responsável</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label className="text-[11px] text-slate-500">Prazo</Label>
            <Input type="date" value={stage.dueDate?.slice(0, 10) ?? ''} onChange={(event) => onCommit({ dueDate: event.target.value })} className="h-9 text-sm" />
          </div>
        </div>
      </fieldset>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${stage.progress}%`, backgroundColor: meta.color }} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="flex-1 text-green-700" onClick={onMarkDone} disabled={!canEdit || done}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {done ? 'Concluída' : 'Marcar concluída'}
        </Button>
        <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={onConvert} disabled={!canEdit || converting || Boolean(stage.convertedToTaskId)}>
          <Rocket className="mr-2 h-4 w-4" />
          {stage.convertedToTaskId ? 'Vinculada' : converting ? 'Gerando...' : 'Gerar tarefa'}
        </Button>
      </div>
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
      <div className="hidden flex-wrap items-center gap-4 md:flex">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" />Pendente</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-400" />Em andamento</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-green-500" />Concluída</span>
      </div>
      <div className="text-right">
        <div className="font-semibold text-slate-800">{progress}%</div>
        <div>{saving ? 'Salvando...' : lastSavedAt ? `Salvo às ${lastSavedAt}` : 'Não salvo'}</div>
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
  return <span className={cn('shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold', classes)}>{label}</span>;
}

// ---------- helpers ----------

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
    .replace(/[̀-ͯ]/g, '')
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
