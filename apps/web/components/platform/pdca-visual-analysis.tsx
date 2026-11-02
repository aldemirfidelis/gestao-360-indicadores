'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { exportNodeToPng } from '@/lib/export-image';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  Lightbulb,
  Link2,
  ListChecks,
  Paperclip,
  PlayCircle,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  UserRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { AutoSaveStatus, type AutoSaveState } from '@/components/platform/auto-save-status';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber, formatPercent } from '@/lib/utils';

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
  icon: LucideIcon;
  number: string;
}> = {
  PLAN: { title: 'Plan', subtitle: 'Planejar causas, metas e ações', color: '#2563eb', soft: 'bg-blue-50 text-blue-700 border-blue-200', icon: ClipboardList, number: '01' },
  DO: { title: 'Do', subtitle: 'Executar ações definidas', color: '#f97316', soft: 'bg-orange-50 text-orange-700 border-orange-200', icon: PlayCircle, number: '02' },
  CHECK: { title: 'Check', subtitle: 'Medir resultados e verificar eficácia', color: '#16a34a', soft: 'bg-green-50 text-green-700 border-green-200', icon: BarChart3, number: '03' },
  ACT: { title: 'Act', subtitle: 'Padronizar, corrigir e evoluir', color: '#7c3aed', soft: 'bg-violet-50 text-violet-700 border-violet-200', icon: RefreshCw, number: '04' },
};

/** Ordem do ciclo (sentido horário a partir do alto à direita). */
const PHASES: Phase[] = ['PLAN', 'DO', 'CHECK', 'ACT'];

/**
 * Lugar de cada etapa no desktop, como na roda de Deming: Plan no alto à direita,
 * Do embaixo à direita, Check embaixo à esquerda e Act no alto à esquerda. No
 * celular os cards seguem a ordem do ciclo, um embaixo do outro.
 */
const GRID_POSITION: Record<Phase, string> = {
  PLAN: 'lg:col-start-3 lg:row-start-1',
  DO: 'lg:col-start-3 lg:row-start-2',
  CHECK: 'lg:col-start-1 lg:row-start-2',
  ACT: 'lg:col-start-1 lg:row-start-1',
};

/** Campos próprios de cada etapa (gravados em `data`). */
const PHASE_FIELDS: Record<Phase, Array<{ key: string; label: string; rootCause?: boolean }>> = {
  PLAN: [
    { key: 'problem', label: 'Problema principal' },
    { key: 'rootCause', label: 'Causa raiz', rootCause: true },
    { key: 'target', label: 'Resultado esperado' },
    { key: 'successCriteria', label: 'Critério de sucesso' },
    { key: 'risks', label: 'Riscos previstos' },
  ],
  DO: [
    { key: 'actions', label: 'Ações executadas' },
    { key: 'blockers', label: 'Impedimentos' },
  ],
  CHECK: [
    { key: 'measuredResult', label: 'Resultado medido' },
    { key: 'indicator', label: 'Indicador monitorado' },
    { key: 'target', label: 'Meta' },
    { key: 'deviation', label: 'Desvio' },
    { key: 'checkComment', label: 'Comentário da verificação' },
  ],
  ACT: [
    { key: 'lessons', label: 'Lições aprendidas' },
    { key: 'adjustments', label: 'Ajustes necessários' },
    { key: 'standardization', label: 'Padronização' },
    { key: 'nextReview', label: 'Próxima revisão' },
  ],
};

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
  rootCauses = [],
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
  rootCauses?: Array<{ cause: string; rootCause: string }>;
  users?: UserOption[];
  saving: boolean;
  canEdit?: boolean;
  onRootCauseChange: (value: string) => void;
  /** Devolve a promessa do salvamento: a fila espera um terminar para mandar o próximo. */
  onSave: (stages: PdcaStage[], rootCause?: string) => Promise<unknown> | void;
}) {
  const qc = useQueryClient();
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [stages, setStages] = useState<PdcaStage[]>(() => normalizeStages(session?.pdcaSteps ?? initialStages, action, rootCause));
  const stagesRef = useRef(stages);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);
  const [saveState, setSaveState] = useState<AutoSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<PdcaSuggestion[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);

  // Fila de salvamento (um por vez), como no Ishikawa.
  const onSaveRef = useRef(onSave);
  const rootCauseRef = useRef(rootCause);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const pendingRef = useRef(0);
  const waitingRef = useRef(false);
  const dirtyRef = useRef(false);
  const failedRef = useRef(false);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  useEffect(() => {
    rootCauseRef.current = rootCause;
  }, [rootCause]);

  const completedCount = stages.filter(isDone).length;
  const currentPhase = PHASES.find((phase) => !isDone(stages.find((stage) => stage.phase === phase)!)) ?? null;
  const editingStage = editingPhase ? stages.find((stage) => stage.phase === editingPhase) ?? null : null;
  const responsibleById = useMemo(() => new Map(users.map((user) => [user.id, user.name])), [users]);

  const queueSave = useCallback(() => {
    if (!canEdit) return queueRef.current;
    setSaveState('saving');
    // Já há um salvamento esperando: ele vai levar o estado mais recente.
    if (waitingRef.current) return queueRef.current;
    const idle = pendingRef.current === 0;
    waitingRef.current = true;
    pendingRef.current += 1;
    const run = async () => {
      waitingRef.current = false;
      dirtyRef.current = false;
      await onSaveRef.current(stagesRef.current, rootCauseRef.current);
    };
    const job = idle ? run() : queueRef.current.catch(() => undefined).then(run);
    const tracked = job.then(
      () => {
        pendingRef.current -= 1;
        failedRef.current = false;
        if (pendingRef.current === 0 && !dirtyRef.current) {
          setSaveState('saved');
          setLastSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        }
      },
      () => {
        pendingRef.current -= 1;
        failedRef.current = true;
        dirtyRef.current = true;
        setSaveState('error');
      },
    );
    queueRef.current = tracked;
    return tracked;
  }, [canEdit]);

  function applyStages(next: PdcaStage[]) {
    stagesRef.current = next;
    setStages(next);
  }

  /** Digitação: só marca; grava ao sair do campo. */
  function updateStage(phase: Phase, patch: Partial<PdcaStage>) {
    dirtyRef.current = true;
    applyStages(stagesRef.current.map((stage) => (stage.phase === phase ? { ...stage, ...patch } : stage)));
  }

  /** Escolhas (status, prazo, checklist...): grava na hora. */
  function commitStage(phase: Phase, patch: Partial<PdcaStage>) {
    updateStage(phase, patch);
    queueSave();
  }

  function saveIfDirty() {
    if (dirtyRef.current) queueSave();
  }

  function markDone(stage: PdcaStage) {
    commitStage(stage.phase, { status: 'DONE', progress: 100, validated: true, completedAt: new Date().toISOString() });
    toast.success(`Etapa ${stage.title} concluída`);
  }

  function reopen(stage: PdcaStage) {
    commitStage(stage.phase, { status: 'IN_PROGRESS', validated: false, completedAt: null });
  }

  async function convertToAction(stage: PdcaStage) {
    if (!actionId) {
      toast.error('O plano de ação ainda não existe: preencha a análise para criá-lo.');
      return;
    }
    // A etapa precisa estar gravada (o id já é o definitivo) antes de virar tarefa.
    await queueSave();
    if (failedRef.current) {
      toast.error('Não foi possível salvar a etapa antes de transformá-la em ação.');
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
        applyStages(stagesRef.current.map((item) => (item.phase === stage.phase ? { ...item, convertedToTaskId: updatedStage.convertedToTaskId } : item)));
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

  function acceptSuggestion(item: PdcaSuggestion) {
    const phase = normalizePhase(item.phase);
    const stage = stagesRef.current.find((candidate) => candidate.phase === phase);
    if (!stage) return;
    const patch: Partial<PdcaStage> = { isAiSuggested: true };
    if (item.field === 'objective') patch.objective = item.suggestion;
    else if (item.field === 'checklist') patch.checklist = appendChecklistText(stage.checklist, item.suggestion, true);
    else if (item.field === 'measurement') patch.data = { ...stage.data, measurement: item.suggestion };
    else if (item.field === 'standardization') patch.data = { ...stage.data, standardization: item.suggestion };
    else patch.description = [stage.description, item.suggestion].filter(Boolean).join('\n');
    commitStage(phase, patch);
    setSuggestions((current) => current.filter((candidate) => candidate !== item));
    toast.success(`Dica aplicada em ${stage.title}`);
  }

  async function exportImage() {
    await exportNodeToPng(boardRef.current, `pdca-${actionId ?? 'analise'}`);
  }

  function closeEditor() {
    // Fechar com Esc ou no X não dispara o blur do campo aberto.
    saveIfDirty();
    setEditingPhase(null);
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadAiSuggestions} disabled={loadingAi}>
            <Lightbulb className="mr-2 h-4 w-4" />
            {loadingAi ? 'Carregando...' : 'Dicas IA'}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canEdit && <AutoSaveStatus state={saving && saveState !== 'error' ? 'saving' : saveState} lastSavedAt={lastSavedAt} onRetry={queueSave} />}
          <Button size="sm" variant="outline" onClick={exportImage}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {!canEdit && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
          Você está em modo de visualização. Edição, conversão e checklist estão bloqueados.
        </div>
      )}

      {rootCauses.length > 0 && (
        <div className="border-b border-teal-200 bg-teal-50 px-4 py-2.5 text-xs text-teal-900">
          <div className="mb-1 font-semibold">Causas raiz encontradas na análise ({rootCauses.length}) — acompanhe todas:</div>
          <ul className="space-y-0.5">
            {rootCauses.map((rc, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-teal-500">•</span>
                <span><span className="font-medium">{rc.rootCause}</span> <span className="text-teal-600">(de: {rc.cause})</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div ref={boardRef} className="bg-muted/20 p-4">
        <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_250px_minmax(0,1fr)]">
          <div className="flex items-center justify-center py-2 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <PDCACycle stages={stages} currentPhase={currentPhase} completedCount={completedCount} onSelect={setEditingPhase} />
          </div>
          {PHASES.map((phase) => {
            const stage = stages.find((item) => item.phase === phase)!;
            return (
              <PDCAStageCard
                key={phase}
                className={GRID_POSITION[phase]}
                stage={stage}
                current={currentPhase === phase}
                editing={editingPhase === phase}
                responsibleName={stage.responsibleUserId ? responsibleById.get(stage.responsibleUserId) : undefined}
                action={action}
                onOpen={() => setEditingPhase(phase)}
              />
            );
          })}
        </div>
      </div>

      <PDCAFooter completedCount={completedCount} currentPhase={currentPhase} />

      <Sheet open={Boolean(editingStage)} onOpenChange={(open) => !open && closeEditor()}>
        <SheetContent size="lg">
          {editingStage && (
            <PDCAStageEditor
              key={editingStage.phase}
              stage={editingStage}
              action={action}
              users={users}
              canEdit={canEdit}
              saveState={saving && saveState !== 'error' ? 'saving' : saveState}
              lastSavedAt={lastSavedAt}
              onRetry={queueSave}
              onUpdate={(patch) => updateStage(editingStage.phase, patch)}
              onCommit={(patch) => commitStage(editingStage.phase, patch)}
              onBlur={saveIfDirty}
              onNavigate={(phase) => {
                saveIfDirty();
                setEditingPhase(phase);
              }}
              onMarkDone={() => markDone(editingStage)}
              onReopen={() => reopen(editingStage)}
              onConvert={() => convertToAction(editingStage)}
              onRootCauseChange={onRootCauseChange}
            />
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Dicas IA — como funciona o ciclo PDCA</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm leading-6 text-slate-700">
              O <strong>PDCA</strong> é o ciclo de melhoria contínua. Rode as 4 etapas em sequência, no sentido horário, e repita o ciclo:
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
                  {actionId ? 'Sem ideias específicas no momento — use o tutorial acima para conduzir o ciclo.' : 'Preencha a análise para a IA sugerir ideias para este ciclo.'}
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
    </div>
  );
}

// Anel do ciclo. Ângulos medidos a partir das 12h, no sentido horário:
// Plan 0–90° (alto à direita), Do 90–180°, Check 180–270°, Act 270–360°.
const RING_SIZE = 236;
const RING_RADIUS = 92;
const RING_STROKE = 24;
const PHASE_START: Record<Phase, number> = { PLAN: 0, DO: 90, CHECK: 180, ACT: 270 };

function polar(radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  const center = RING_SIZE / 2;
  return { x: center + radius * Math.sin(radians), y: center - radius * Math.cos(radians) };
}

function arcPath(from: number, to: number) {
  const start = polar(RING_RADIUS, from);
  const end = polar(RING_RADIUS, to);
  return `M ${start.x} ${start.y} A ${RING_RADIUS} ${RING_RADIUS} 0 0 1 ${end.x} ${end.y}`;
}

/** Ponta de seta no fim do arco, apontando para a etapa seguinte. */
function arrowPath(degrees: number) {
  const tip = polar(RING_RADIUS, degrees + 8);
  const outer = polar(RING_RADIUS + RING_STROKE / 2 + 4, degrees);
  const inner = polar(RING_RADIUS - RING_STROKE / 2 - 4, degrees);
  return `M ${outer.x} ${outer.y} L ${tip.x} ${tip.y} L ${inner.x} ${inner.y} Z`;
}

function PDCACycle({
  stages,
  currentPhase,
  completedCount,
  onSelect,
}: {
  stages: PdcaStage[];
  currentPhase: Phase | null;
  completedCount: number;
  onSelect: (phase: Phase) => void;
}) {
  return (
    <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
      <svg width={RING_SIZE} height={RING_SIZE} className="absolute inset-0" aria-hidden>
        {PHASES.map((phase) => {
          const start = PHASE_START[phase];
          const stage = stages.find((item) => item.phase === phase)!;
          const strong = isDone(stage) || phase === currentPhase;
          const color = STAGE_META[phase].color;
          return (
            <g key={phase} opacity={strong ? 1 : 0.35}>
              <path d={arcPath(start + 4, start + 78)} fill="none" stroke={color} strokeWidth={RING_STROKE} />
              <path d={arrowPath(start + 78)} fill={color} />
            </g>
          );
        })}
      </svg>
      {PHASES.map((phase) => {
        const meta = STAGE_META[phase];
        const point = polar(RING_RADIUS, PHASE_START[phase] + 42);
        const stage = stages.find((item) => item.phase === phase)!;
        return (
          <button
            key={phase}
            type="button"
            title={`${meta.title}: ${meta.subtitle}`}
            aria-label={`Abrir etapa ${meta.title}`}
            className={cn(
              'absolute flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white text-xs font-bold text-white shadow-md transition hover:scale-110',
            )}
            // A etapa atual ganha um halo na cor dela.
            style={{ left: point.x - 18, top: point.y - 18, backgroundColor: meta.color, boxShadow: phase === currentPhase ? `0 0 0 5px ${meta.color}40` : undefined }}
            onClick={() => onSelect(phase)}
          >
            {isDone(stage) ? <CheckCircle2 className="h-4 w-4" /> : meta.number}
          </button>
        );
      })}
      <div className="absolute inset-[52px] flex flex-col items-center justify-center rounded-full bg-card text-center shadow-md">
        <div className="text-2xl font-bold text-foreground">PDCA</div>
        <div className="text-[11px] font-medium text-muted-foreground">Melhoria contínua</div>
        <div className="mt-1 text-xs font-semibold text-foreground">{completedCount}/4 etapas</div>
      </div>
    </div>
  );
}

function PDCAStageCard({
  stage,
  current,
  editing,
  responsibleName,
  action,
  className,
  onOpen,
}: {
  stage: PdcaStage;
  current: boolean;
  editing: boolean;
  responsibleName?: string;
  action?: any;
  className?: string;
  onOpen: () => void;
}) {
  const meta = STAGE_META[stage.phase];
  const Icon = meta.icon;
  const summary = stageSummary(stage, responsibleName, action);
  const checklistDone = stage.checklist.filter((item) => item.done).length;
  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Etapa ${stage.title}: abrir para editar`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        'group flex min-w-0 cursor-pointer flex-col rounded-xl border bg-card p-4 text-left shadow-sm outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary',
        editing && 'shadow-lg ring-2 ring-primary/30',
        className,
      )}
      style={{ borderTopColor: meta.color, borderTopWidth: 4 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', meta.soft)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2">
              <span className="text-[11px] font-bold text-muted-foreground">{meta.number}</span>
              <span className="text-lg font-bold leading-tight" style={{ color: meta.color }}>{stage.title}</span>
              {current && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Etapa atual</span>}
            </div>
            <div className="text-xs text-muted-foreground">{stage.subtitle}</div>
          </div>
        </div>
        <StatusPill stage={stage} />
      </div>
      <dl className="mt-3 grid flex-1 content-start gap-1.5">
        {summary.map((item) => (
          <div key={item.label} className="grid grid-cols-[16px_minmax(88px,auto)_1fr] items-start gap-2 text-xs">
            <item.icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} />
            <dt className="font-semibold text-muted-foreground">{item.label}</dt>
            <dd className="line-clamp-2 min-w-0 text-foreground">{item.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex items-center gap-3 border-t pt-3 text-[11px] text-muted-foreground">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full transition-[width]" style={{ width: `${stage.progress}%`, backgroundColor: meta.color }} />
        </div>
        <span className="font-semibold text-foreground">{stage.progress}%</span>
        <span className="inline-flex items-center gap-1" title="Checklist da etapa">
          <ListChecks className="h-3.5 w-3.5" />
          {checklistDone}/{stage.checklist.length}
        </span>
        <span className="inline-flex items-center gap-0.5 font-medium text-primary">
          Editar <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </article>
  );
}

/** Edição da etapa num painel lateral que só aparece enquanto se edita. */
function PDCAStageEditor({
  stage,
  action,
  users,
  canEdit,
  saveState,
  lastSavedAt,
  onRetry,
  onUpdate,
  onCommit,
  onBlur,
  onNavigate,
  onMarkDone,
  onReopen,
  onConvert,
  onRootCauseChange,
}: {
  stage: PdcaStage;
  action?: any;
  users: UserOption[];
  canEdit: boolean;
  saveState: AutoSaveState;
  lastSavedAt: string | null;
  onRetry: () => void;
  onUpdate: (patch: Partial<PdcaStage>) => void;
  onCommit: (patch: Partial<PdcaStage>) => void;
  onBlur: () => void;
  onNavigate: (phase: Phase) => void;
  onMarkDone: () => void;
  onReopen: () => void;
  onConvert: () => void;
  onRootCauseChange: (value: string) => void;
}) {
  const meta = STAGE_META[stage.phase];
  const index = PHASES.indexOf(stage.phase);
  const previous = PHASES[(index + PHASES.length - 1) % PHASES.length];
  const next = PHASES[(index + 1) % PHASES.length];
  const [newItem, setNewItem] = useState('');
  // Responsável travado: puxa do plano de ação / indicador. Só cai no seletor
  // aberto quando não há responsável de origem (ex.: PDCA avulso).
  const lockedResponsibleId = action?.responsibleUser?.id ?? action?.indicator?.responsibleUserId ?? '';
  const lockedResponsibleName = action?.responsibleUser?.name ?? users.find((u) => u.id === lockedResponsibleId)?.name ?? '';
  const done = isDone(stage);

  function addChecklistItem() {
    const title = newItem.trim();
    if (!title) return;
    onCommit({ checklist: appendChecklistText(stage.checklist, title) });
    setNewItem('');
  }

  return (
    <>
      <SheetHeader className="pr-12">
        <div className="flex items-start gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', meta.soft)}>
            <meta.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="flex flex-wrap items-center gap-2">
              <span style={{ color: meta.color }}>{meta.number} · {stage.title}</span>
              <StatusPill stage={stage} />
            </SheetTitle>
            <SheetDescription>{stage.subtitle}</SheetDescription>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 pt-2">
          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => onNavigate(previous)}>
            <ChevronLeft className="mr-1 h-3.5 w-3.5" /> {STAGE_META[previous].title}
          </Button>
          {canEdit && <AutoSaveStatus state={saveState} lastSavedAt={lastSavedAt} onRetry={onRetry} />}
          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => onNavigate(next)}>
            {STAGE_META[next].title} <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </SheetHeader>
      <SheetBody>
        <fieldset disabled={!canEdit} className="space-y-5">
          <section className="space-y-3">
            <div>
              <Label>Descrição</Label>
              <Textarea rows={3} value={stage.description} onChange={(event) => onUpdate({ description: event.target.value })} onBlur={onBlur} />
            </div>
            <div>
              <Label>Objetivo</Label>
              <Input value={stage.objective} onChange={(event) => onUpdate({ objective: event.target.value })} onBlur={onBlur} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {PHASE_FIELDS[stage.phase].map((field) => (
                <div key={field.key}>
                  <Label>{field.label}</Label>
                  <Input
                    value={stage.data[field.key] ?? ''}
                    onChange={(event) => {
                      onUpdate({ data: { ...stage.data, [field.key]: event.target.value } });
                      if (field.rootCause) onRootCauseChange(event.target.value);
                    }}
                    onBlur={onBlur}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-3 border-t pt-4 sm:grid-cols-2">
            <div>
              <Label>Responsável</Label>
              {lockedResponsibleId ? (
                <>
                  <Input value={lockedResponsibleName || 'Responsável do plano/indicador'} disabled readOnly />
                  <p className="mt-1 text-[11px] text-muted-foreground">Travado ao responsável do indicador e do plano de ação.</p>
                </>
              ) : (
                <NativeSelect value={stage.responsibleUserId} onChange={(event) => onCommit({ responsibleUserId: event.target.value })}>
                  <option value="">Sem responsável</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </NativeSelect>
              )}
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={stage.dueDate?.slice(0, 10) ?? ''} onChange={(event) => onCommit({ dueDate: event.target.value })} />
            </div>
            <div>
              <Label>Prioridade</Label>
              <NativeSelect value={stage.priority} onChange={(event) => onCommit({ priority: event.target.value as Priority })}>
                {Object.entries(PRIORITY_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Status</Label>
              <NativeSelect value={stage.status} onChange={(event) => onCommit({ status: event.target.value as StageStatus })}>
                {Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </NativeSelect>
            </div>
            <div className="sm:col-span-2">
              <Label>Progresso: {stage.progress}%</Label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={stage.progress}
                onChange={(event) => onUpdate({ progress: clampProgress(event.target.value) })}
                onPointerUp={onBlur}
                onKeyUp={onBlur}
                className="mt-2 w-full"
                style={{ accentColor: meta.color }}
                aria-label="Progresso da etapa"
              />
            </div>
          </section>

          <section className="space-y-2 border-t pt-4">
            <Label>Evidências vinculadas</Label>
            <Textarea rows={3} value={stage.evidence} onChange={(event) => onUpdate({ evidence: event.target.value })} onBlur={onBlur} placeholder="Links, documentos ou descrição das evidências" />
          </section>

          <section className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>Checklist da etapa</Label>
              <span className="text-xs text-muted-foreground">
                {stage.checklist.filter((item) => item.done).length}/{stage.checklist.length} concluídos
              </span>
            </div>
            <div className="space-y-1.5">
              {stage.checklist.map((item) => (
                <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={(event) =>
                      onCommit({ checklist: stage.checklist.map((candidate) => (candidate.id === item.id ? { ...candidate, done: event.target.checked } : candidate)) })
                    }
                    style={{ accentColor: meta.color }}
                  />
                  <span className={cn(item.done && 'text-muted-foreground line-through')}>{item.title}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newItem}
                onChange={(event) => setNewItem(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addChecklistItem();
                  }
                }}
                placeholder="Novo item do checklist"
              />
              <Button type="button" variant="outline" onClick={addChecklistItem}>
                <Plus className="mr-1 h-4 w-4" /> Adicionar
              </Button>
            </div>
          </section>

          <section className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Link2 className="h-3.5 w-3.5" />
            {stage.convertedToTaskId ? 'Esta etapa já virou tarefa do plano de ação.' : 'Nenhuma tarefa do plano vinculada a esta etapa.'}
          </section>
        </fieldset>
      </SheetBody>
      <SheetFooter>
        {canEdit && (
          <>
            <Button variant="outline" onClick={onConvert} disabled={Boolean(stage.convertedToTaskId)}>
              <Rocket className="mr-2 h-4 w-4" />
              {stage.convertedToTaskId ? 'Tarefa criada' : 'Transformar em tarefa do plano'}
            </Button>
            {done ? (
              <Button variant="outline" onClick={onReopen}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reabrir etapa
              </Button>
            ) : (
              <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={onMarkDone}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Marcar concluída
              </Button>
            )}
          </>
        )}
      </SheetFooter>
    </>
  );
}

function PDCAFooter({ completedCount, currentPhase }: { completedCount: number; currentPhase: Phase | null }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5 text-xs text-muted-foreground">
      <div>
        <div className="font-semibold text-foreground">Ciclo atual</div>
        <div>
          {completedCount} de 4 etapas concluídas
          {currentPhase ? ` · próxima: ${STAGE_META[currentPhase].title}` : ' · ciclo completo'}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" />Pendente</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-400" />Em andamento</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-green-500" />Concluída</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Atrasada</span>
      </div>
      <div className="text-right">
        <div className="font-semibold text-foreground">{completedCount * 25}%</div>
        <div>Clique numa etapa para editar</div>
      </div>
    </div>
  );
}

function isDone(stage: PdcaStage) {
  return stage.status === 'DONE' || stage.status === 'VALIDATED';
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

// Eficácia parcial = atingimento da meta no mês seguinte ao desvio tratado
// neste PDCA, com o delta em pontos percentuais frente ao mês do desvio — é
// isso que mede se as ações do plano surtiram efeito, não o progresso do
// checklist da etapa.
function partialEffectivenessLabel(action?: any) {
  const { reference, nextResult } = getCheckMetrics(action);
  if (nextResult?.attainment === undefined || nextResult?.attainment === null) {
    return 'Aguardando resultado do mês seguinte';
  }
  const value = formatPercent(nextResult.attainment, 2);
  if (reference?.attainment === undefined || reference?.attainment === null) return value;
  const deltaPoints = (nextResult.attainment - reference.attainment) * 100;
  const sign = deltaPoints >= 0 ? '+' : '';
  return `${value} (${sign}${formatNumber(deltaPoints, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} p.p. vs mês do desvio)`;
}

function stageSummary(stage: PdcaStage, responsibleName?: string, action?: any) {
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
      { icon: CheckCircle2, label: 'Eficácia parcial', value: partialEffectivenessLabel(action) },
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
    id: row?.id && !String(row.id).startsWith('temp-') ? String(row.id) : newClientId(),
    phase,
    title: row?.title ?? meta.title,
    subtitle: row?.subtitle ?? meta.subtitle,
    description: row?.description ?? fallback.description,
    objective: row?.objective ?? fallback.objective,
    // Responsável travado ao do indicador/plano de ação (quando houver): tem
    // precedência sobre o valor salvo por etapa, garantindo consistência.
    responsibleUserId: action?.responsibleUser?.id ?? action?.indicator?.responsibleUserId ?? row?.responsibleUserId ?? '',
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

// Localiza o resultado mensal vinculado ao desvio tratado neste PDCA (o mês de
// referência) e o resultado do mês seguinte a ele, para medir se as ações
// aplicadas melhoraram o atingimento da meta no período posterior.
function getCheckMetrics(action?: any) {
  const results: any[] = Array.isArray(action?.indicator?.results) ? action.indicator.results : [];
  // O plano de ação guarda o vínculo exato com o mês do desvio (indicatorResultId).
  // Só cai para o resultado mais recente quando não há esse vínculo (PDCA avulso).
  const reference = action?.indicatorResult ?? results[0] ?? null;
  const referenceTime = reference?.periodDate ? new Date(reference.periodDate).getTime() : null;
  const nextResult =
    referenceTime !== null
      ? results
          .filter((item) => item?.periodDate && new Date(item.periodDate).getTime() > referenceTime)
          .sort((a, b) => new Date(a.periodDate).getTime() - new Date(b.periodDate).getTime())[0] ?? null
      : null;
  return { reference, nextResult };
}

// Auto-preenche (link) o ciclo a partir do plano/indicador para poupar digitação.
function defaultStageData(phase: Phase, action?: any, rootCause = '') {
  const { reference: result } = getCheckMetrics(action);
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
        measuredResult: result?.value !== undefined && result?.value !== null ? formatNumber(result.value, { maximumFractionDigits: 2 }) : '',
        currentResult: result?.value !== undefined && result?.value !== null ? formatNumber(result.value, { maximumFractionDigits: 2 }) : '',
        indicator: action?.indicator?.name ?? '',
        target: action?.expectedResult ?? '',
        deviation:
          result?.deviationPct !== undefined && result?.deviationPct !== null
            ? `${formatNumber(result.deviationPct, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`
            : '',
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
  return [...checklist, { id: newClientId(), title: text, done }];
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

/**
 * Id definitivo já no navegador: o servidor mantém o id recebido, então a etapa
 * não troca de id ao salvar e pode virar tarefa sem recarregar a tela. Sem
 * `randomUUID` (navegador antigo), o prefixo temp- deixa o servidor gerar.
 */
function newClientId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
