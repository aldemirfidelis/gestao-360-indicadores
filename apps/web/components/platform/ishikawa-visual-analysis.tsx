'use client';

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { exportNodeToPng } from '@/lib/export-image';
import { toast } from 'sonner';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowRight, Download, GripVertical, Plus, Sparkles, Trash2 } from 'lucide-react';
import { AutoSaveStatus, type AutoSaveState } from '@/components/platform/auto-save-status';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { findContainer, moveItem, type Containers } from '@/lib/board-order';
import { cn } from '@/lib/utils';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type CauseStatus = 'DRAFT' | 'IN_REVIEW' | 'LIKELY_CAUSE' | 'ROOT_CAUSE' | 'DISCARDED' | 'CONVERTED_TO_ACTION';

interface IshikawaCause {
  id: string;
  category: string;
  title: string;
  description: string;
  priority: Priority;
  severity: number;
  impact?: number;
  probability: number;
  status: CauseStatus;
  evidence?: string | null;
  responsibleUserId?: string | null;
  dueDate?: string | null;
  positionX: number;
  positionY: number;
  orderIndex: number;
  tags: string[];
  isAiSuggested: boolean;
  isRootCause: boolean;
  likelyRootCause?: boolean;
  convertedToTaskId?: string | null;
  /** Causa raiz encontrada ao investigar esta causa nos 5 Porquês (ancoragem da análise). */
  rootCause?: string | null;
  /** Quadro dos 5 Porquês desta causa (para reabrir a análise preenchida). */
  fiveWhysData?: any[] | null;
}

interface Suggestion {
  category: string;
  title: string;
  justification: string;
  priority: Priority;
}

interface UserOption {
  id: string;
  name: string;
  email?: string;
}

/**
 * As 6 espinhas (6M): três acima e três abaixo da espinha central. `legacyX/Y`
 * reproduzem onde o desenho antigo (posição livre) punha a 1ª causa; continuam
 * gravados para quem ainda lê a posição.
 */
const CATEGORIES = [
  { key: 'METHOD', label: 'Método', color: '#2563eb', soft: 'bg-blue-50 text-blue-700 border-blue-200', icon: '⚙', side: 'top', legacyX: 140, legacyY: 72 },
  { key: 'MACHINE', label: 'Máquina', color: '#16a34a', soft: 'bg-green-50 text-green-700 border-green-200', icon: '●', side: 'top', legacyX: 390, legacyY: 72 },
  { key: 'MANPOWER', label: 'Mão de obra', color: '#f97316', soft: 'bg-orange-50 text-orange-700 border-orange-200', icon: '▣', side: 'top', legacyX: 650, legacyY: 72 },
  { key: 'MATERIAL', label: 'Material', color: '#7c3aed', soft: 'bg-violet-50 text-violet-700 border-violet-200', icon: '◇', side: 'bottom', legacyX: 150, legacyY: 350 },
  { key: 'ENVIRONMENT', label: 'Meio ambiente', color: '#0f766e', soft: 'bg-teal-50 text-teal-700 border-teal-200', icon: '◒', side: 'bottom', legacyX: 400, legacyY: 350 },
  { key: 'MEASUREMENT', label: 'Medição', color: '#f59e0b', soft: 'bg-amber-50 text-amber-700 border-amber-200', icon: '◈', side: 'bottom', legacyX: 660, legacyY: 350 },
] as const;

type Category = (typeof CATEGORIES)[number];

const TOP_CATEGORIES = CATEGORIES.filter((category) => category.side === 'top');
const BOTTOM_CATEGORIES = CATEGORIES.filter((category) => category.side === 'bottom');

/** Recuo da espinha da categoria na coluna e quanto ela inclina até a espinha central. */
const BONE_INSET = 14;
const BONE_MAX_SLANT = 44;

const CATEGORY_HINTS: Record<string, string> = {
  METHOD: 'Processos, procedimentos, instruções de trabalho e fluxo. Ex.: falta de padrão, etapa fora de sequência.',
  MACHINE: 'Equipamentos, ferramentas, manutenção e calibração. Ex.: máquina descalibrada, parada não planejada.',
  MANPOWER: 'Pessoas: treinamento, habilidade, comunicação e turno. Ex.: falta de treinamento, sobrecarga.',
  MATERIAL: 'Insumos, matéria-prima, fornecedores e especificação. Ex.: lote fora do padrão, material vencido.',
  ENVIRONMENT: 'Ambiente físico: temperatura, ruído, layout e clima. Ex.: umidade alta, espaço inadequado.',
  MEASUREMENT: 'Medições, instrumentos, critérios e coleta de dados. Ex.: instrumento sem aferição, critério ambíguo.',
};

const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

const SCREEN_READER_INSTRUCTIONS = {
  draggable: 'Para mover a causa, pressione espaço, use as setas para escolher a categoria e a posição e pressione espaço de novo para soltar. Esc cancela. Enter abre a edição.',
};

interface Geometry {
  width: number;
  height: number;
  spine: { x1: number; x2: number; y: number } | null;
  bones: Array<{ key: string; color: string; x1: number; y1: number; x2: number; y2: number }>;
  ribs: Array<{ id: string; color: string; x1: number; x2: number; y: number }>;
}

export function IshikawaVisualAnalysis({
  actionId,
  session,
  problem,
  rootCause,
  saving,
  canEdit = true,
  onSendToFiveWhys,
  onSave,
}: {
  actionId?: string;
  session?: any;
  problem: string;
  rootCause: string;
  users?: UserOption[];
  saving: boolean;
  canEdit?: boolean;
  onRootCauseChange: (value: string) => void;
  onSendToFiveWhys?: (text: string, causeId: string) => void;
  /** Devolve a promessa do salvamento: a fila espera um terminar para mandar o próximo. */
  onSave: (causes: IshikawaCause[], rootCause?: string) => Promise<unknown> | void;
}) {
  const diagramRef = useRef<HTMLDivElement | null>(null);
  const spineRef = useRef<HTMLDivElement | null>(null);
  const tailRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const causesRef = useRef<IshikawaCause[]>([]);
  const [causes, setCauses] = useState<IshikawaCause[]>(() => normalizeCauses(session?.ishikawaCauses));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({ category: 'METHOD', title: '' });
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [saveState, setSaveState] = useState<AutoSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);

  // Ordem durante o arraste (antes de virar estado salvo).
  const [dragOrder, setDragOrderState] = useState<Containers | null>(null);
  const dragOrderRef = useRef<Containers | null>(null);
  const dragStartRef = useRef<Containers | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Fila de salvamento: um por vez; enquanto houver mudança local não enviada ou
  // salvamento a caminho, o retrato que volta do servidor não sobrescreve a tela.
  const onSaveRef = useRef(onSave);
  const rootCauseRef = useRef(rootCause);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const pendingRef = useRef(0);
  const waitingRef = useRef(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  useEffect(() => {
    rootCauseRef.current = rootCause;
  }, [rootCause]);
  useEffect(() => {
    causesRef.current = causes;
  }, [causes]);

  useEffect(() => {
    // Inclusive quando a sessão acaba de nascer (1º salvamento): o retrato que chega
    // pode ser anterior a uma causa adicionada enquanto ele estava a caminho.
    if (dirtyRef.current || pendingRef.current > 0) return;
    const next = normalizeCauses(session?.ishikawaCauses);
    causesRef.current = next;
    setCauses(next);
    setSelectedId((current) => (current && next.some((cause) => cause.id === current) ? current : null));
  }, [session?.id, session?.ishikawaCauses]);

  function setDragOrder(next: Containers | null) {
    dragOrderRef.current = next;
    setDragOrderState(next);
  }

  const queueSave = useCallback(() => {
    if (!canEdit) return;
    setSaveState('saving');
    // Já há um salvamento esperando na fila: ele vai levar o estado mais recente.
    if (waitingRef.current) return;
    const idle = pendingRef.current === 0;
    waitingRef.current = true;
    pendingRef.current += 1;
    const run = async () => {
      waitingRef.current = false;
      dirtyRef.current = false;
      await onSaveRef.current(causesRef.current, rootCauseRef.current);
    };
    // Sem nada na fila, salva já (na mesma chamada): trocar para os 5 Porquês logo em
    // seguida desmonta esta tela, mas o salvamento já saiu.
    const job = idle ? run() : queueRef.current.catch(() => undefined).then(run);
    queueRef.current = job.then(
      () => {
        pendingRef.current -= 1;
        if (pendingRef.current === 0 && !dirtyRef.current) {
          setSaveState('saved');
          setLastSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        }
      },
      () => {
        pendingRef.current -= 1;
        // A tela continua com a versão local; "Tentar de novo" reenvia.
        dirtyRef.current = true;
        setSaveState('error');
      },
    );
  }, [canEdit]);

  /** Mudança local que já deve ser gravada (arraste, nova causa, exclusão...). */
  const commit = useCallback(
    (next: IshikawaCause[], nextRootCause?: string) => {
      const ordered = applyContainers(next, containersOf(next));
      causesRef.current = ordered;
      setCauses(ordered);
      if (nextRootCause !== undefined) rootCauseRef.current = nextRootCause;
      dirtyRef.current = true;
      queueSave();
    },
    [queueSave],
  );

  /** Edição em andamento (digitação): só marca; grava ao sair do campo. */
  function updateCause(id: string, patch: Partial<IshikawaCause>) {
    dirtyRef.current = true;
    setCauses((current) => {
      const next = current.map((cause) => (cause.id === id ? { ...cause, ...patch } : cause));
      causesRef.current = next;
      return next;
    });
  }

  function saveIfDirty() {
    if (dirtyRef.current) queueSave();
  }

  function openAdd(category = 'METHOD') {
    setDraft({ category, title: '' });
    setAddOpen(true);
  }

  function addCause() {
    const title = draft.title.trim();
    if (!title) {
      toast.error('Informe o nome da causa.');
      return;
    }
    const created = makeCause({ category: draft.category, title });
    commit([...causesRef.current, created]);
    setSelectedId(created.id);
    setAddOpen(false);
  }

  function deleteCause(cause: IshikawaCause) {
    if (cause.convertedToTaskId && !window.confirm('Esta causa já foi convertida em tarefa. Deseja remover mesmo assim?')) return;
    commit(
      causesRef.current.filter((item) => item.id !== cause.id),
      rootCauseRef.current === cause.title ? '' : undefined,
    );
    setSelectedId(null);
  }

  function changeCategory(cause: IshikawaCause, category: string) {
    if (normalizeCategory(category) === normalizeCategory(cause.category)) return;
    // Vai para o fim da espinha de destino.
    commit([...causesRef.current.filter((item) => item.id !== cause.id), { ...cause, category: normalizeCategory(category) }]);
  }

  function sendToFiveWhys(cause: IshikawaCause) {
    if (!onSendToFiveWhys) return;
    commit(causesRef.current.map((item) => (item.id === cause.id ? { ...item, status: 'LIKELY_CAUSE' as CauseStatus } : item)));
    onSendToFiveWhys(cause.title, cause.id);
  }

  async function loadAiSuggestions() {
    if (!actionId) {
      setSuggestions(defaultSuggestions());
      setSuggestionsOpen(true);
      return;
    }
    setLoadingAi(true);
    try {
      const out = await api<Suggestion[]>(`/actions/${actionId}/analysis/ishikawa/ai-suggestions`, {
        method: 'POST',
        json: { problem, causes },
      });
      setSuggestions(out.length ? out : defaultSuggestions());
      setSuggestionsOpen(true);
    } catch (error: any) {
      toast.error(error?.message ?? 'Não foi possível gerar sugestões com IA');
      setSuggestions(defaultSuggestions());
      setSuggestionsOpen(true);
    } finally {
      setLoadingAi(false);
    }
  }

  function acceptSuggestion(item: Suggestion) {
    const nextCause = makeCause({
      category: item.category,
      title: item.title,
      description: item.justification,
      priority: item.priority,
      isAiSuggested: true,
    });
    commit([...causesRef.current, nextCause]);
    setSelectedId(nextCause.id);
    setSuggestions((current) => current.filter((candidate) => candidate !== item));
  }

  async function exportImage() {
    await exportNodeToPng(diagramRef.current, `ishikawa-${actionId ?? 'analise'}`);
  }

  // ---- Arraste -------------------------------------------------------------

  const causeById = useMemo(() => new Map(causes.map((cause) => [cause.id, cause])), [causes]);
  const containers = dragOrder ?? containersOf(causes);
  const activeCause = activeId ? causeById.get(activeId) ?? null : null;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    // Enter abre a edição; espaço pega e solta.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  const titleOf = (id: UniqueIdentifier) => causeById.get(String(id))?.title ?? 'causa';
  const placeOf = (id: UniqueIdentifier) => {
    const current = dragOrderRef.current ?? containersOf(causesRef.current);
    const key = findContainer(current, String(id));
    const category = key ? CATEGORIES.find((item) => item.key === key) : undefined;
    if (!category || !key) return 'fora das espinhas';
    return `${category.label}, posição ${current[key].indexOf(String(id)) + 1} de ${current[key].length}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Causa "${titleOf(active.id)}" pega em ${placeOf(active.id)}.`,
    onDragOver: ({ active }) => `Causa "${titleOf(active.id)}" em ${placeOf(active.id)}.`,
    onDragEnd: ({ active, over }) => (over ? `Causa "${titleOf(active.id)}" solta em ${placeOf(active.id)}.` : `Causa "${titleOf(active.id)}" voltou ao lugar.`),
    onDragCancel: ({ active }) => `Movimento cancelado. A causa "${titleOf(active.id)}" voltou ao lugar.`,
  };

  function handleDragStart({ active }: DragStartEvent) {
    const start = containersOf(causesRef.current);
    dragStartRef.current = start;
    setDragOrder(start);
    setActiveId(String(active.id));
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    const current = dragOrderRef.current;
    if (!over || !current) return;
    const from = findContainer(current, String(active.id));
    const to = findContainer(current, String(over.id));
    if (!from || !to || from === to) return;
    setDragOrder(moveItem(current, String(active.id), String(over.id)));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    const start = dragStartRef.current;
    const current = dragOrderRef.current;
    dragStartRef.current = null;
    setActiveId(null);
    setDragOrder(null);
    if (!start || !current) return;
    const final = over ? moveItem(current, id, String(over.id)) : current;
    const from = findContainer(start, id);
    const to = findContainer(final, id);
    if (!to || (from === to && start[from].indexOf(id) === final[to].indexOf(id))) return;
    const next = applyContainers(causesRef.current, final);
    if (from !== to) {
      const category = CATEGORIES.find((item) => item.key === to);
      toast.success(`"${titleOf(id)}" agora está em ${category?.label ?? 'outra categoria'}`);
    }
    commit(next);
  }

  function handleDragCancel() {
    dragStartRef.current = null;
    setActiveId(null);
    setDragOrder(null);
  }

  // ---- Desenho da espinha --------------------------------------------------

  // As linhas saem das posições reais dos cards (alturas variam com o texto).
  useEffect(() => {
    const root = diagramRef.current;
    if (!root) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setGeometry(measureGeometry(root, spineRef.current, tailRef.current, headRef.current)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [causes, selectedId, problem]);

  const renderColumn = (category: Category) => {
    const ids = containers[category.key] ?? [];
    return (
      <CategoryColumn
        key={category.key}
        category={category}
        causes={ids.flatMap((id) => {
          const cause = causeById.get(id);
          return cause ? [cause] : [];
        })}
        selectedId={selectedId}
        canEdit={canEdit}
        dragging={Boolean(activeCause)}
        onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
        onAdd={() => openAdd(category.key)}
        renderEditor={(cause) => (
          <CauseEditor
            cause={cause}
            canEdit={canEdit}
            onTitle={(value) => updateCause(cause.id, { title: value, description: value })}
            onBlur={saveIfDirty}
            onCategory={(value) => changeCategory(cause, value)}
            onPriority={(value) => commit(causesRef.current.map((item) => (item.id === cause.id ? { ...item, priority: value } : item)))}
            onSendToFiveWhys={onSendToFiveWhys ? () => sendToFiveWhys(cause) : undefined}
            onDelete={() => deleteCause(cause)}
          />
        )}
      />
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button size="sm" onClick={() => openAdd()}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar causa
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={loadAiSuggestions} disabled={loadingAi}>
            <Sparkles className="mr-2 h-4 w-4" />
            {loadingAi ? 'Carregando...' : 'Dicas de IA'}
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
          Você está em modo de visualização. Criação, edição e movimentação de causas estão bloqueadas.
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          ref={diagramRef}
          className="relative bg-muted/20 px-4 py-5"
          onClick={(event) => {
            // Clique fora dos cards fecha a edição.
            if (!(event.target as HTMLElement).closest('[data-cause-id]')) setSelectedId(null);
          }}
        >
          {geometry && <FishboneLines geometry={geometry} showRibs={!activeCause} />}
          <div className="relative z-10 grid gap-4 lg:grid-cols-3 lg:gap-x-6">{TOP_CATEGORIES.map(renderColumn)}</div>
          <div ref={spineRef} className="relative z-10 my-4 flex min-h-[84px] items-center gap-3">
            <div ref={tailRef} className="hidden h-14 w-10 shrink-0 bg-slate-500 lg:block" style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} aria-hidden />
            <div className="hidden flex-1 lg:block" />
            <FishHead ref={headRef} problem={problem} />
          </div>
          <div className="relative z-10 grid gap-4 lg:grid-cols-3 lg:gap-x-6">{BOTTOM_CATEGORIES.map(renderColumn)}</div>
        </div>
        <DragOverlay dropAnimation={{ duration: 160, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' }}>
          {activeCause ? (
            <div className="w-[240px] rotate-1 cursor-grabbing drop-shadow-xl">
              <CauseCardView cause={activeCause} selected={false} draggable />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Legend canEdit={canEdit} />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar causa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Categoria</Label>
              <NativeSelect value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
                {CATEGORIES.map((category) => (
                  <option key={category.key} value={category.key}>{category.label}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Nome da causa</Label>
              <Input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                onKeyDown={(event) => event.key === 'Enter' && addCause()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={addCause}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Dicas de IA — como preencher o Ishikawa</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm leading-6 text-slate-700">
              O <strong>Diagrama de Ishikawa</strong> (espinha de peixe) organiza as <strong>possíveis causas</strong> de um problema (o efeito, na cabeça do peixe)
              em <strong>6 categorias (6M)</strong>. Passo a passo:
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Confirme o <strong>problema/efeito</strong> (já vem do indicador/desvio).</li>
                <li>Em cada espinha (categoria), faça um <strong>brainstorm</strong> de causas possíveis (use o botão Adicionar causa).</li>
                <li>Pergunte <em>por que isso acontece?</em> para chegar a causas reais — sem se prender ao sintoma.</li>
                <li>Selecione a causa mais provável e clique em <strong>Investigar nos 5 Porquês</strong> para chegar à causa raiz.</li>
              </ol>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {CATEGORIES.map((category) => (
                <div key={category.key} className="rounded-lg border bg-white p-3">
                  <div className={cn('mb-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold', category.soft)}>
                    <span aria-hidden>{category.icon}</span>{category.label}
                  </div>
                  <p className="text-xs leading-5 text-slate-600">{CATEGORY_HINTS[category.key]}</p>
                </div>
              ))}
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-800">Ideias da IA para este problema</div>
              {loadingAi && <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Gerando ideias com IA...</div>}
              {!loadingAi && suggestions.length === 0 && (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  {actionId ? 'Sem ideias específicas no momento — use o tutorial acima para preencher.' : 'Salve a análise para a IA sugerir exemplos de causas.'}
                </div>
              )}
              <div className="grid gap-2 md:grid-cols-2">
                {suggestions.map((item) => {
                  const category = getCategory(item.category);
                  return (
                    <div key={`${item.category}-${item.title}`} className="rounded-lg border bg-white p-3 shadow-sm">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <Badge variant="outline" className={category.soft}>{category.label}</Badge>
                        <PriorityBadge priority={item.priority} />
                      </div>
                      <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{item.justification}</p>
                      {canEdit && (
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => acceptSuggestion(item)}>
                          <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar como causa
                        </Button>
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

/** Coluna da categoria: rótulo na ponta da espinha e causas empilhadas ao longo dela. */
function CategoryColumn({
  category,
  causes,
  selectedId,
  canEdit,
  dragging,
  onSelect,
  onAdd,
  renderEditor,
}: {
  category: Category;
  causes: IshikawaCause[];
  selectedId: string | null;
  canEdit: boolean;
  dragging: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  renderEditor: (cause: IshikawaCause) => React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: category.key, disabled: !canEdit });
  const label = (
    <div data-bone-label={category.key} className={cn('inline-flex h-9 w-fit items-center gap-2 rounded-lg border px-3 text-sm font-semibold shadow-sm', category.soft)}>
      <span aria-hidden>{category.icon}</span>
      {category.label}
      <span className="rounded-full bg-white/70 px-1.5 text-[10px] font-bold">{causes.length}</span>
    </div>
  );
  const list = (
    <SortableContext items={causes.map((cause) => cause.id)} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        data-bone-list={category.key}
        className={cn(
          // À esquerda, no desktop, fica o espaço da espinha inclinada (BONE_INSET + BONE_MAX_SLANT + folga).
          'flex min-h-[96px] flex-col gap-2 rounded-xl p-1.5 transition-colors lg:pl-[72px]',
          dragging && 'bg-background/60 ring-1 ring-dashed ring-border',
          isOver && 'bg-primary/5 ring-2 ring-primary/40',
        )}
      >
        {causes.map((cause) => (
          <SortableCause key={cause.id} cause={cause} selected={cause.id === selectedId} canEdit={canEdit} onSelect={() => onSelect(cause.id)}>
            {cause.id === selectedId ? renderEditor(cause) : null}
          </SortableCause>
        ))}
        {!causes.length && (
          <div className="grid min-h-[72px] place-items-center rounded-lg border border-dashed px-3 text-center text-xs text-muted-foreground">
            {dragging ? `Solte aqui para mover para ${category.label}` : 'Nenhuma causa nesta categoria'}
          </div>
        )}
        {canEdit && !dragging && (
          <button
            type="button"
            className="rounded-md border border-dashed bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/50 hover:text-primary"
            onClick={onAdd}
          >
            + Adicionar causa
          </button>
        )}
      </div>
    </SortableContext>
  );
  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label={`Causas de ${category.label}`}>
      {category.side === 'top' ? (
        <>
          {label}
          {list}
        </>
      ) : (
        <>
          {list}
          {label}
        </>
      )}
    </section>
  );
}

function SortableCause({
  cause,
  selected,
  canEdit,
  onSelect,
  children,
}: {
  cause: IshikawaCause;
  selected: boolean;
  canEdit: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cause.id, disabled: !canEdit });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('touch-manipulation rounded-lg', isDragging && 'opacity-40 outline-dashed outline-2 outline-offset-2 outline-primary/60')}
    >
      <CauseCardView
        cause={cause}
        selected={selected}
        draggable={canEdit}
        dragAttributes={canEdit ? attributes : undefined}
        dragListeners={canEdit ? listeners : undefined}
        onSelect={onSelect}
      >
        {children}
      </CauseCardView>
    </div>
  );
}

function CauseCardView({
  cause,
  selected,
  draggable,
  dragAttributes,
  dragListeners,
  onSelect,
  children,
}: {
  cause: IshikawaCause;
  selected: boolean;
  draggable: boolean;
  dragAttributes?: DraggableAttributes;
  dragListeners?: DraggableSyntheticListeners;
  onSelect?: () => void;
  children?: React.ReactNode;
}) {
  const category = getCategory(cause.category);
  const hasRootCause = (cause.rootCause ?? '').trim().length > 0;
  return (
    <div
      data-cause-id={cause.id}
      role="button"
      tabIndex={0}
      {...dragAttributes}
      {...dragListeners}
      aria-roledescription={dragListeners ? 'causa arrastável' : undefined}
      aria-expanded={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && onSelect) {
          event.preventDefault();
          onSelect();
          return;
        }
        dragListeners?.onKeyDown?.(event);
      }}
      className={cn(
        'group relative rounded-lg border bg-card p-2.5 text-left shadow-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        selected ? 'border-primary shadow-lg ring-2 ring-primary/20' : 'hover:shadow-md',
        cause.isRootCause && 'border-emerald-500 ring-2 ring-emerald-100',
      )}
      style={{ borderLeftColor: category.color, borderLeftWidth: 4 }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="line-clamp-4 break-words text-xs font-semibold leading-4 text-foreground">{cause.title}</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <PriorityBadge priority={cause.priority} />
            {cause.isAiSuggested && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">IA</Badge>}
            {cause.isRootCause && <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Causa raiz</Badge>}
            {hasRootCause && <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700" title={cause.rootCause ?? undefined}>✔ Causa raiz encontrada</Badge>}
            {cause.convertedToTaskId && <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">Plano criado</Badge>}
          </div>
        </div>
        {draggable && <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40 transition group-hover:text-muted-foreground" aria-hidden />}
      </div>
      {children}
    </div>
  );
}

/**
 * Edição no próprio card. Os eventos não sobem para o card: digitar espaço não
 * começa um arraste e clicar no campo não fecha a edição.
 */
function CauseEditor({
  cause,
  canEdit,
  onTitle,
  onBlur,
  onCategory,
  onPriority,
  onSendToFiveWhys,
  onDelete,
}: {
  cause: IshikawaCause;
  canEdit: boolean;
  onTitle: (value: string) => void;
  onBlur: () => void;
  onCategory: (value: string) => void;
  onPriority: (value: Priority) => void;
  onSendToFiveWhys?: () => void;
  onDelete: () => void;
}) {
  const hasRootCause = (cause.rootCause ?? '').trim().length > 0;
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();
  return (
    <div className="mt-2 cursor-default space-y-2 border-t pt-2" onClick={stop} onMouseDown={stop} onTouchStart={stop} onKeyDown={stop}>
      {canEdit && (
        <>
          <Textarea
            autoFocus
            rows={3}
            value={cause.title}
            maxLength={500}
            onChange={(event) => onTitle(event.target.value)}
            onBlur={onBlur}
            className="min-h-[56px] resize-none p-1.5 text-xs leading-4"
            placeholder="Descreva a causa"
            aria-label="Texto da causa"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <NativeSelect value={normalizeCategory(cause.category)} onChange={(event) => onCategory(event.target.value)} className="h-8 text-[11px]" aria-label="Categoria">
              {CATEGORIES.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
            </NativeSelect>
            <NativeSelect value={cause.priority} onChange={(event) => onPriority(event.target.value as Priority)} className="h-8 text-[11px]" aria-label="Prioridade">
              {Object.entries(PRIORITY_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </NativeSelect>
          </div>
        </>
      )}
      {onSendToFiveWhys && (
        <Button size="sm" className="h-7 w-full justify-center bg-emerald-600 px-2 text-[11px] hover:bg-emerald-700" disabled={!canEdit} onClick={onSendToFiveWhys}>
          <ArrowRight className="mr-1 h-3.5 w-3.5" />
          {hasRootCause ? 'Reabrir no 5 Porquês' : 'Investigar nos 5 Porquês'}
        </Button>
      )}
      {canEdit && (
        <Button size="sm" variant="ghost" className="h-6 w-full justify-center px-2 text-[11px] text-red-600 hover:text-red-700" onClick={onDelete}>
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Excluir causa
        </Button>
      )}
    </div>
  );
}

function FishboneLines({ geometry, showRibs }: { geometry: Geometry; showRibs: boolean }) {
  return (
    <svg className="pointer-events-none absolute left-0 top-0 z-0" width={geometry.width} height={geometry.height} aria-hidden>
      {geometry.spine && (
        <line x1={geometry.spine.x1} y1={geometry.spine.y} x2={geometry.spine.x2} y2={geometry.spine.y} stroke="#64748b" strokeWidth={5} strokeLinecap="round" />
      )}
      {geometry.bones.map((bone) => (
        <g key={bone.key}>
          <line x1={bone.x1} y1={bone.y1} x2={bone.x2} y2={bone.y2} stroke={bone.color} strokeWidth={3} strokeLinecap="round" />
          {geometry.spine && <circle cx={bone.x2} cy={bone.y2} r={6} fill="#64748b" />}
        </g>
      ))}
      {showRibs &&
        geometry.ribs.map((rib) => (
          <g key={rib.id} opacity={0.7}>
            <line x1={rib.x1} y1={rib.y} x2={rib.x2} y2={rib.y} stroke={rib.color} strokeWidth={2} strokeLinecap="round" />
            <circle cx={rib.x1} cy={rib.y} r={3} fill={rib.color} />
          </g>
        ))}
    </svg>
  );
}

const FishHead = forwardRef<HTMLDivElement, { problem: string }>(({ problem }, ref) => (
  <div
    ref={ref}
    className="relative ml-auto flex min-h-[84px] w-full items-center justify-center px-8 py-3 text-center text-white shadow-xl lg:w-[230px]"
    style={{
      background: 'linear-gradient(135deg, #f87171 0%, #ef4444 55%, #fb7185 100%)',
      clipPath: 'polygon(0 8%, 70% 0, 100% 50%, 70% 100%, 0 92%, 6% 50%)',
    }}
  >
    <div className="max-w-[160px] text-sm font-bold leading-5">
      {problem?.trim() || 'Problema principal'}
      <div className="mx-auto mt-2 w-fit rounded-full bg-red-900/45 px-3 py-0.5 text-[11px] font-semibold">Efeito</div>
    </div>
  </div>
));
FishHead.displayName = 'FishHead';

function Legend({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">Legenda:</span>
      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Alta prioridade</span>
      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-400" />Média prioridade</span>
      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-green-500" />Baixa prioridade</span>
      {canEdit && (
        <span className="ml-auto">Arraste as causas para reordenar ou levar a outra categoria (no celular, toque e segure). Clique para editar.</span>
      )}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const styles: Record<Priority, string> = {
    LOW: 'border-green-200 bg-green-50 text-green-700',
    MEDIUM: 'border-orange-200 bg-orange-50 text-orange-700',
    HIGH: 'border-red-200 bg-red-50 text-red-700',
    CRITICAL: 'border-red-300 bg-red-100 text-red-800',
  };
  return <Badge variant="outline" className={styles[priority]}>{PRIORITY_LABEL[priority]}</Badge>;
}

/** Linhas do desenho a partir dos retângulos reais; sem as colunas lado a lado (celular), só os cards. */
function measureGeometry(root: HTMLElement, spineRow: HTMLElement | null, tail: HTMLElement | null, head: HTMLElement | null): Geometry | null {
  const base = root.getBoundingClientRect();
  const relative = (rect: DOMRect) => ({ left: rect.left - base.left, right: rect.right - base.left, top: rect.top - base.top, bottom: rect.bottom - base.top });
  const lists = CATEGORIES.map((category) => root.querySelector<HTMLElement>(`[data-bone-list="${category.key}"]`));
  const labels = CATEGORIES.map((category) => root.querySelector<HTMLElement>(`[data-bone-label="${category.key}"]`));
  if (!spineRow || lists.some((list) => !list) || labels.some((label) => !label)) return null;
  const listRects = lists.map((list) => relative(list!.getBoundingClientRect()));
  const sideBySide = Math.abs(listRects[0].top - listRects[1].top) < 2 && listRects[1].left > listRects[0].right;
  if (!sideBySide) return null;

  const spineRect = relative(spineRow.getBoundingClientRect());
  const spineY = (spineRect.top + spineRect.bottom) / 2;
  const tailRect = tail ? relative(tail.getBoundingClientRect()) : null;
  const headRect = head ? relative(head.getBoundingClientRect()) : null;
  const geometry: Geometry = {
    width: base.width,
    height: base.height,
    spine: { x1: tailRect ? tailRect.right - 4 : spineRect.left, x2: headRect ? headRect.left + 8 : spineRect.right, y: spineY },
    bones: [],
    ribs: [],
  };

  CATEGORIES.forEach((category, index) => {
    const list = listRects[index];
    const label = relative(labels[index]!.getBoundingClientRect());
    const top = category.side === 'top';
    const far = top ? label.bottom + 4 : label.top - 4;
    const length = Math.abs(spineY - far);
    const slant = Math.min(BONE_MAX_SLANT, Math.max(18, length * 0.3));
    const farX = list.left + BONE_INSET;
    const nearX = farX + slant;
    geometry.bones.push({ key: category.key, color: category.color, x1: farX, y1: far, x2: nearX, y2: spineY });
    // x da espinha da categoria numa altura y (reta entre a ponta e a espinha central).
    const boneX = (y: number) => {
      const t = length ? Math.min(1, Math.max(0, Math.abs(y - far) / length)) : 0;
      return farX + slant * t;
    };
    lists[index]!.querySelectorAll<HTMLElement>('[data-cause-id]').forEach((card) => {
      const rect = relative(card.getBoundingClientRect());
      const y = Math.min(rect.top + 22, (rect.top + rect.bottom) / 2);
      geometry.ribs.push({ id: card.dataset.causeId ?? `${category.key}-${y}`, color: category.color, x1: boneX(y), x2: rect.left - 2, y });
    });
  });
  return geometry;
}

function containersOf(causes: IshikawaCause[]): Containers {
  const containers: Containers = Object.fromEntries(CATEGORIES.map((category) => [category.key, [] as string[]]));
  for (const cause of causes) containers[normalizeCategory(cause.category)].push(cause.id);
  return containers;
}

/** Categoria e ordem saem do lugar da causa na espinha; x/y seguem o desenho antigo. */
function applyContainers(causes: IshikawaCause[], containers: Containers): IshikawaCause[] {
  const byId = new Map(causes.map((cause) => [cause.id, cause]));
  return CATEGORIES.flatMap((category) =>
    (containers[category.key] ?? []).flatMap((id, index) => {
      const cause = byId.get(id);
      if (!cause) return [];
      return [{ ...cause, category: category.key, orderIndex: index, positionX: category.legacyX + (index % 2 ? 18 : 0), positionY: category.legacyY + index * 58 }];
    }),
  );
}

function normalizeCauses(rows: any[] | undefined): IshikawaCause[] {
  const source = rows?.length ? rows : [];
  const causes = source.map((row: any, index: number) =>
    makeCause({
      id: row.id,
      category: row.category,
      title: row.title ?? row.description,
      description: row.description,
      priority: row.priority,
      severity: row.severity ?? row.impact,
      probability: row.probability,
      status: row.status,
      evidence: row.evidence,
      responsibleUserId: row.responsibleUserId,
      dueDate: row.dueDate,
      positionX: row.positionX,
      positionY: row.positionY,
      orderIndex: row.orderIndex ?? index,
      tags: row.tags,
      isAiSuggested: row.isAiSuggested,
      isRootCause: row.isRootCause ?? row.likelyRootCause,
      convertedToTaskId: row.convertedToTaskId,
      rootCause: row.rootCause,
      fiveWhysData: row.fiveWhysData,
    }),
  );
  // Ordem na espinha: a altura em que a causa aparecia no desenho antigo (posição
  // livre), depois a ordem gravada. Nos dados novos as duas andam juntas.
  const height = (cause: IshikawaCause) => (cause.positionY > 0 ? cause.positionY : Number.MAX_SAFE_INTEGER);
  const ordered = causes
    .map((cause, index) => ({ cause, index }))
    .sort((a, b) => height(a.cause) - height(b.cause) || a.cause.orderIndex - b.cause.orderIndex || a.index - b.index)
    .map((item) => item.cause);
  return applyContainers(ordered, containersOf(ordered));
}

function makeCause(input: Partial<IshikawaCause>): IshikawaCause {
  const category = normalizeCategory(input.category);
  const priority = normalizePriority(input.priority);
  const title = String(input.title ?? '').trim() || 'Nova causa';
  return {
    id: input.id && !String(input.id).startsWith('temp-') ? String(input.id) : newCauseId(),
    category,
    title,
    description: input.description ?? '',
    priority,
    severity: clampScale(input.severity ?? input.impact),
    probability: clampScale(input.probability),
    status: normalizeStatus(input.status, input.isRootCause),
    evidence: input.evidence ?? '',
    responsibleUserId: input.responsibleUserId ?? '',
    dueDate: input.dueDate ?? '',
    positionX: Number(input.positionX ?? 0),
    positionY: Number(input.positionY ?? 0),
    orderIndex: Number(input.orderIndex ?? 0),
    tags: Array.isArray(input.tags) ? input.tags : [],
    isAiSuggested: Boolean(input.isAiSuggested),
    isRootCause: Boolean(input.isRootCause),
    convertedToTaskId: input.convertedToTaskId ?? null,
    rootCause: input.rootCause ?? null,
    fiveWhysData: Array.isArray(input.fiveWhysData) ? input.fiveWhysData : null,
  };
}

function getCategory(value: string) {
  return CATEGORIES.find((category) => category.key === normalizeCategory(value)) ?? CATEGORIES[0];
}

function normalizeCategory(value: any) {
  const key = normalizeKey(value);
  const map: Record<string, string> = {
    METHOD: 'METHOD',
    METODO: 'METHOD',
    MACHINE: 'MACHINE',
    MAQUINA: 'MACHINE',
    MANPOWER: 'MANPOWER',
    MAO_DE_OBRA: 'MANPOWER',
    MAO_OBRA: 'MANPOWER',
    MATERIAL: 'MATERIAL',
    ENVIRONMENT: 'ENVIRONMENT',
    MEIO_AMBIENTE: 'ENVIRONMENT',
    MEASUREMENT: 'MEASUREMENT',
    MEDICAO: 'MEASUREMENT',
  };
  return map[key] ?? 'METHOD';
}

function normalizePriority(value: any): Priority {
  const key = normalizeKey(value);
  const map: Record<string, Priority> = {
    LOW: 'LOW',
    BAIXA: 'LOW',
    MEDIUM: 'MEDIUM',
    MEDIA: 'MEDIUM',
    HIGH: 'HIGH',
    ALTA: 'HIGH',
    CRITICAL: 'CRITICAL',
    CRITICA: 'CRITICAL',
  };
  return map[key] ?? 'MEDIUM';
}

function normalizeStatus(value: any, isRootCause?: boolean): CauseStatus {
  if (isRootCause) return 'ROOT_CAUSE';
  const key = normalizeKey(value);
  const map: Record<string, CauseStatus> = {
    DRAFT: 'DRAFT',
    IN_REVIEW: 'IN_REVIEW',
    LIKELY_CAUSE: 'LIKELY_CAUSE',
    ROOT_CAUSE: 'ROOT_CAUSE',
    DISCARDED: 'DISCARDED',
    CONVERTED_TO_ACTION: 'CONVERTED_TO_ACTION',
  };
  return map[key] ?? 'DRAFT';
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

function clampScale(value: any) {
  const numeric = Number(value ?? 3);
  if (!Number.isFinite(numeric)) return 3;
  return Math.max(1, Math.min(5, Math.round(numeric)));
}

/**
 * Id definitivo já no navegador: o servidor mantém o id recebido, então a causa
 * nova não troca de id ao salvar (a seleção não se perde). Sem `randomUUID`
 * (navegador antigo), o prefixo temp- deixa o servidor gerar.
 */
function newCauseId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultSuggestions(): Suggestion[] {
  return [];
}
