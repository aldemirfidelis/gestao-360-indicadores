'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowRight,
  Download,
  GripVertical,
  LayoutGrid,
  Maximize,
  Plus,
  Rocket,
  Save,
  Sparkles,
  Target,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
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

const CANVAS_WIDTH = 1120;
const CANVAS_HEIGHT = 650;
const SPINE_Y = 318;
const SPINE_START = 54;
const SPINE_END = 850;

const CATEGORIES = [
  { key: 'METHOD', label: 'Método', color: '#2563eb', soft: 'bg-blue-50 text-blue-700 border-blue-200', icon: '⚙', anchorX: 140, anchorY: SPINE_Y, labelX: 78, labelY: 34, cardX: 140, cardY: 72, side: 'top' },
  { key: 'MACHINE', label: 'Máquina', color: '#16a34a', soft: 'bg-green-50 text-green-700 border-green-200', icon: '●', anchorX: 372, anchorY: SPINE_Y, labelX: 330, labelY: 34, cardX: 390, cardY: 72, side: 'top' },
  { key: 'MANPOWER', label: 'Mão de obra', color: '#f97316', soft: 'bg-orange-50 text-orange-700 border-orange-200', icon: '▣', anchorX: 612, anchorY: SPINE_Y, labelX: 590, labelY: 34, cardX: 650, cardY: 72, side: 'top' },
  { key: 'MATERIAL', label: 'Material', color: '#7c3aed', soft: 'bg-violet-50 text-violet-700 border-violet-200', icon: '◇', anchorX: 140, anchorY: SPINE_Y, labelX: 78, labelY: 566, cardX: 150, cardY: 350, side: 'bottom' },
  { key: 'ENVIRONMENT', label: 'Meio ambiente', color: '#0f766e', soft: 'bg-teal-50 text-teal-700 border-teal-200', icon: '◒', anchorX: 372, anchorY: SPINE_Y, labelX: 330, labelY: 566, cardX: 400, cardY: 350, side: 'bottom' },
  { key: 'MEASUREMENT', label: 'Medição', color: '#f59e0b', soft: 'bg-amber-50 text-amber-700 border-amber-200', icon: '◈', anchorX: 612, anchorY: SPINE_Y, labelX: 610, labelY: 566, cardX: 660, cardY: 350, side: 'bottom' },
] as const;

const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

const STATUS_LABEL: Record<CauseStatus, string> = {
  DRAFT: 'Rascunho',
  IN_REVIEW: 'Em análise',
  LIKELY_CAUSE: 'Causa provável',
  ROOT_CAUSE: 'Causa raiz',
  DISCARDED: 'Descartada',
  CONVERTED_TO_ACTION: 'Convertida em plano de ação',
};

export function IshikawaVisualAnalysis({
  actionId,
  session,
  problem,
  rootCause,
  users = [],
  saving,
  canEdit = true,
  onRootCauseChange,
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
  onSendToFiveWhys?: (text: string) => void;
  onSave: (causes: IshikawaCause[], rootCause?: string) => void;
}) {
  const qc = useQueryClient();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const causesRef = useRef<IshikawaCause[]>([]);
  const dragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const [causes, setCauses] = useState<IshikawaCause[]>(() => normalizeCauses(session?.ishikawaCauses));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({ category: 'METHOD', title: '' });
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const next = normalizeCauses(session?.ishikawaCauses);
    setCauses(next);
    setSelectedId((current) => (current && next.some((cause) => cause.id === current) ? current : next[0]?.id ?? null));
  }, [session?.id, session?.ishikawaCauses]);

  useEffect(() => {
    causesRef.current = causes;
  }, [causes]);

  const selectedCause = causes.find((cause) => cause.id === selectedId) ?? null;
  const causesByCategory = useMemo(() => {
    const map = new Map<string, IshikawaCause[]>();
    CATEGORIES.forEach((category) => map.set(category.key, []));
    causes.forEach((cause) => {
      const key = normalizeCategory(cause.category);
      map.set(key, [...(map.get(key) ?? []), cause]);
    });
    return map;
  }, [causes]);

  const handleSave = useCallback(
    (nextCauses = causesRef.current, nextRootCause = rootCause) => {
      onSave(nextCauses, nextRootCause);
      setLastSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    },
    [onSave, rootCause],
  );

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = (event.clientX - drag.startX) / zoom;
      const dy = (event.clientY - drag.startY) / zoom;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      setCauses((current) =>
        current.map((cause) =>
          cause.id === drag.id
            ? {
                ...cause,
                positionX: Math.max(72, Math.min(CANVAS_WIDTH - 250, drag.originX + dx)),
                positionY: Math.max(52, Math.min(CANVAS_HEIGHT - 92, drag.originY + dy)),
              }
            : cause,
        ),
      );
    }
    function onUp() {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag?.moved) handleSave(causesRef.current);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [handleSave, zoom]);

  function updateCause(id: string, patch: Partial<IshikawaCause>) {
    setCauses((current) => current.map((cause) => (cause.id === id ? { ...cause, ...patch } : cause)));
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
    const next = [...causes, makeCause({ category: draft.category, title, orderIndex: causes.length })];
    setCauses(next);
    setSelectedId(next[next.length - 1].id);
    setAddOpen(false);
  }

  function deleteCause(cause: IshikawaCause) {
    if (cause.convertedToTaskId && !window.confirm('Esta causa já foi convertida em tarefa. Deseja remover mesmo assim?')) return;
    const next = causes.filter((item) => item.id !== cause.id);
    setCauses(next);
    setSelectedId(next[0]?.id ?? null);
    handleSave(next, rootCause === cause.title ? '' : rootCause);
  }

  function markRootCause(cause: IshikawaCause) {
    const next = causes.map((item) => ({
      ...item,
      isRootCause: item.id === cause.id,
      status: item.id === cause.id ? 'ROOT_CAUSE' as CauseStatus : item.status === 'ROOT_CAUSE' ? 'IN_REVIEW' as CauseStatus : item.status,
    }));
    setCauses(next);
    onRootCauseChange(cause.title);
    handleSave(next, cause.title);
  }

  async function convertToAction(cause: IshikawaCause) {
    if (!actionId || cause.id.startsWith('temp-')) {
      toast.error('Salve a análise antes de transformar esta causa em ação.');
      return;
    }
    try {
      await api(`/actions/${actionId}/analysis/ishikawa/causes/${cause.id}/convert-to-action`, {
        method: 'POST',
        json: { markRootCause: cause.isRootCause || cause.status === 'ROOT_CAUSE' },
      });
      toast.success('Causa transformada em tarefa do plano');
      const next = causes.map((item) => (item.id === cause.id ? { ...item, status: 'CONVERTED_TO_ACTION' as CauseStatus, convertedToTaskId: 'pending-refresh' } : item));
      setCauses(next);
      qc.invalidateQueries({ queryKey: ['action', actionId] });
    } catch (error: any) {
      toast.error(error?.message ?? 'Não foi possível transformar em ação');
    }
  }

  async function loadAiSuggestions() {
    if (!actionId) {
      setSuggestions(defaultSuggestions(causes));
      setSuggestionsOpen(true);
      return;
    }
    setLoadingAi(true);
    try {
      const out = await api<Suggestion[]>(`/actions/${actionId}/analysis/ishikawa/ai-suggestions`, {
        method: 'POST',
        json: { problem, causes },
      });
      setSuggestions(out.length ? out : defaultSuggestions(causes));
      setSuggestionsOpen(true);
    } catch (error: any) {
      toast.error(error?.message ?? 'Não foi possível gerar sugestões com IA');
      setSuggestions(defaultSuggestions(causes));
      setSuggestionsOpen(true);
    } finally {
      setLoadingAi(false);
    }
  }

  function acceptSuggestion(item: Suggestion, editAfter = false) {
    const nextCause = makeCause({
      category: item.category,
      title: item.title,
      description: item.justification,
      priority: item.priority,
      orderIndex: causes.length,
      isAiSuggested: true,
    });
    const next = [...causes, nextCause];
    setCauses(next);
    setSelectedId(nextCause.id);
    setSuggestions((current) => current.filter((candidate) => candidate !== item));
    handleSave(next);
    if (editAfter) setSuggestionsOpen(false);
  }

  async function exportImage() {
    if (!canvasRef.current) return;
    const dataUrl = await toPng(canvasRef.current, { backgroundColor: '#f8fafc', pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = `ishikawa-${actionId ?? 'analise'}.png`;
    link.href = dataUrl;
    link.click();
  }

  function resetLayout() {
    const next = autoLayout(causes);
    setCauses(next);
    handleSave(next);
  }

  function centerCanvas() {
    setZoom(1);
    scrollRef.current?.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => openAdd()} disabled={!canEdit}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar causa
          </Button>
          <Button size="sm" variant="outline" onClick={loadAiSuggestions} disabled={!canEdit || loadingAi}>
            <Sparkles className="mr-2 h-4 w-4" />
            {loadingAi ? 'Gerando...' : 'Sugestão com IA'}
          </Button>
          <Button size="sm" variant="outline" onClick={resetLayout} disabled={!canEdit}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            Layout automático
          </Button>
          <Button size="sm" variant="outline" onClick={centerCanvas}>
            <Maximize className="mr-2 h-4 w-4" />
            Centralizar
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => setZoom((value) => Math.max(0.75, value - 0.1))} title="Reduzir zoom">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="w-12 text-center text-xs font-medium text-slate-600">{Math.round(zoom * 100)}%</div>
          <Button size="icon" variant="outline" onClick={() => setZoom((value) => Math.min(1.25, value + 0.1))} title="Aumentar zoom">
            <ZoomIn className="h-4 w-4" />
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
          Você está em modo de visualização. Criação, edição e conversão de causas estão bloqueadas.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div ref={scrollRef} className="max-h-[560px] overflow-auto bg-slate-50">
          <div
            ref={canvasRef}
            className="relative m-0 origin-top-left"
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          >
            <FishboneSvg causes={causes} />
            <FishTail />
            <FishHead problem={problem} />

            {CATEGORIES.map((category) => (
              <div key={category.key}>
                <div
                  className={cn('absolute z-10 inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold shadow-sm', category.soft)}
                  style={{ left: category.labelX, top: category.labelY }}
                >
                  <span aria-hidden>{category.icon}</span>
                  {category.label}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    className="absolute z-10 rounded-md border border-dashed border-slate-300 bg-white/90 px-4 py-2 text-xs font-medium text-slate-500 shadow-sm transition hover:border-blue-300 hover:text-blue-700"
                    style={{ left: category.cardX + 18, top: category.side === 'top' ? 248 : 522 }}
                    onClick={() => openAdd(category.key)}
                  >
                    + Adicionar causa
                  </button>
                )}
              </div>
            ))}

            {causes.map((cause) => (
              <CauseCard
                key={cause.id}
                cause={cause}
                selected={cause.id === selectedId}
                canEdit={canEdit}
                onSelect={() => setSelectedId(cause.id)}
                onPointerDown={(event) => {
                  if (!canEdit) return;
                  dragRef.current = {
                    id: cause.id,
                    startX: event.clientX,
                    startY: event.clientY,
                    originX: cause.positionX,
                    originY: cause.positionY,
                    moved: false,
                  };
                }}
              />
            ))}
          </div>
        </div>

        <CauseDrawer
          cause={selectedCause}
          users={users}
          canEdit={canEdit}
          onUpdate={(patch) => selectedCause && updateCause(selectedCause.id, patch)}
          onSave={() => handleSave()}
          onDelete={() => selectedCause && deleteCause(selectedCause)}
          onMarkLikely={() => selectedCause && updateCause(selectedCause.id, { status: 'LIKELY_CAUSE' })}
          onMarkRoot={() => selectedCause && markRootCause(selectedCause)}
          onConvert={() => selectedCause && convertToAction(selectedCause)}
          onSendToFiveWhys={onSendToFiveWhys ? () => {
            if (!selectedCause) return;
            updateCause(selectedCause.id, { status: 'LIKELY_CAUSE' });
            handleSave();
            onSendToFiveWhys(selectedCause.title);
          } : undefined}
        />
      </div>

      <Legend lastSavedAt={lastSavedAt} saving={saving} />

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
              <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} autoFocus />
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
            <DialogTitle>Sugestões de causas com IA</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
            {suggestions.length === 0 && <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhuma sugestão pendente.</div>}
            {suggestions.map((item) => {
              const category = getCategory(item.category);
              return (
                <div key={`${item.category}-${item.title}`} className="rounded-lg border bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge variant="outline" className={category.soft}>{category.label}</Badge>
                    <PriorityBadge priority={item.priority} />
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{item.justification}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => acceptSuggestion(item)}>Aceitar</Button>
                    <Button size="sm" variant="outline" onClick={() => acceptSuggestion(item, true)}>Editar e aceitar</Button>
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

function FishboneSvg({ causes }: { causes: IshikawaCause[] }) {
  return (
    <svg className="absolute inset-0 z-0" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} aria-hidden>
      <defs>
        <filter id="fishShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#94a3b8" floodOpacity="0.18" />
        </filter>
      </defs>
      <line x1={SPINE_START} y1={SPINE_Y} x2={SPINE_END} y2={SPINE_Y} stroke="#64748b" strokeWidth="5" strokeLinecap="round" />
      <circle cx={135} cy={SPINE_Y} r="8" fill="#64748b" />
      <circle cx={370} cy={SPINE_Y} r="8" fill="#64748b" />
      <circle cx={610} cy={SPINE_Y} r="8" fill="#64748b" />
      <circle cx={820} cy={SPINE_Y} r="8" fill="#64748b" />
      {CATEGORIES.map((category) => {
        const endY = category.side === 'top' ? 70 : 566;
        const endX = category.anchorX - 34;
        return (
          <g key={category.key}>
            <line x1={category.anchorX} y1={category.anchorY} x2={endX} y2={endY} stroke={category.color} strokeWidth="3" strokeLinecap="round" />
            {(causes.filter((cause) => normalizeCategory(cause.category) === category.key)).map((cause) => (
              <line
                key={cause.id}
                x1={category.side === 'top' ? cause.positionX - 24 : cause.positionX - 16}
                y1={cause.positionY + 22}
                x2={cause.positionX}
                y2={cause.positionY + 22}
                stroke={category.color}
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.65"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function FishTail() {
  return (
    <div className="absolute z-10" style={{ left: 6, top: SPINE_Y - 34, width: 48, height: 68 }}>
      <div className="h-full w-full bg-slate-600 shadow-md" style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
    </div>
  );
}

function FishHead({ problem }: { problem: string }) {
  return (
    <div
      className="absolute z-10 flex items-center justify-center px-8 text-center text-white shadow-xl"
      style={{
        left: 825,
        top: 220,
        width: 210,
        height: 195,
        background: 'linear-gradient(135deg, #f87171 0%, #ef4444 55%, #fb7185 100%)',
        clipPath: 'polygon(0 8%, 62% 16%, 100% 50%, 62% 84%, 0 92%, 8% 50%)',
        filter: 'url(#fishShadow)',
      }}
    >
      <div className="absolute left-55 top-36 h-7 w-7 rounded-full border-4 border-white bg-slate-800 shadow" style={{ left: 56, top: 38 }} />
      <div className="mt-8 max-w-[132px] text-sm font-bold leading-5">
        {problem?.trim() || 'Problema principal'}
        <div className="mx-auto mt-3 w-fit rounded-full bg-red-900/45 px-3 py-1 text-[11px] font-semibold">Efeito</div>
      </div>
    </div>
  );
}

function CauseCard({
  cause,
  selected,
  canEdit,
  onSelect,
  onPointerDown,
}: {
  cause: IshikawaCause;
  selected: boolean;
  canEdit: boolean;
  onSelect: () => void;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const category = getCategory(cause.category);
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'absolute z-20 w-[218px] rounded-lg border bg-white p-3 text-left shadow-sm transition',
        selected ? 'border-blue-500 shadow-lg ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-md',
        cause.isRootCause && 'border-emerald-500 ring-2 ring-emerald-100',
      )}
      style={{ left: cause.positionX, top: cause.positionY }}
      onClick={onSelect}
      onPointerDown={onPointerDown}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect();
      }}
    >
      <div className="flex items-start gap-2">
        <GripVertical className={cn('mt-0.5 h-4 w-4 shrink-0 text-slate-300', canEdit && 'cursor-grab')} />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-xs font-semibold leading-4 text-slate-900">{cause.title}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            <PriorityBadge priority={cause.priority} />
            {cause.isAiSuggested && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">IA</Badge>}
            {cause.isRootCause && <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Causa raiz</Badge>}
            {cause.convertedToTaskId && <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">Plano criado</Badge>}
          </div>
        </div>
        <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
      </div>
    </div>
  );
}

function CauseDrawer({
  cause,
  users,
  canEdit,
  onUpdate,
  onSave,
  onDelete,
  onMarkLikely,
  onMarkRoot,
  onConvert,
  onSendToFiveWhys,
}: {
  cause: IshikawaCause | null;
  users: UserOption[];
  canEdit: boolean;
  onUpdate: (patch: Partial<IshikawaCause>) => void;
  onSave: () => void;
  onDelete: () => void;
  onMarkLikely: () => void;
  onMarkRoot: () => void;
  onConvert: () => void;
  onSendToFiveWhys?: () => void;
}) {
  if (!cause) {
    return (
      <aside className="border-l border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-900">Causa selecionada</div>
        <p className="mt-2 text-sm text-slate-500">Selecione um card no diagrama para editar detalhes, responsáveis e evidências.</p>
      </aside>
    );
  }
  return (
    <aside className="border-l border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-2 border-b border-slate-200 p-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">Causa selecionada</div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" />
            <span className="truncate text-sm font-medium text-slate-800">{cause.title}</span>
          </div>
        </div>
        <PriorityBadge priority={cause.priority} />
      </div>
      <div className="max-h-[520px] space-y-3 overflow-y-auto p-3">
        <fieldset disabled={!canEdit} className="space-y-3">
          <div>
            <Label>Nome da causa</Label>
            <Input value={cause.title} onChange={(event) => onUpdate({ title: event.target.value })} onBlur={onSave} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Categoria</Label>
              <NativeSelect value={normalizeCategory(cause.category)} onChange={(event) => onUpdate({ category: event.target.value })} onBlur={onSave}>
                {CATEGORIES.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Prioridade</Label>
              <NativeSelect value={cause.priority} onChange={(event) => onUpdate({ priority: event.target.value as Priority })} onBlur={onSave}>
                {Object.entries(PRIORITY_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={4} value={cause.description ?? ''} onChange={(event) => onUpdate({ description: event.target.value })} onBlur={onSave} />
            <div className="mt-1 text-right text-[11px] text-slate-400">{cause.description?.length ?? 0}/500</div>
          </div>
          <div>
            <Label>Responsável</Label>
            <NativeSelect value={cause.responsibleUserId ?? ''} onChange={(event) => onUpdate({ responsibleUserId: event.target.value || null })} onBlur={onSave}>
              <option value="">Sem responsável</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </NativeSelect>
          </div>
          <ScaleControl label="Severidade (Impacto)" value={cause.severity} onChange={(severity) => onUpdate({ severity })} />
          <ScaleControl label="Probabilidade" value={cause.probability} onChange={(probability) => onUpdate({ probability })} />
          <div>
            <Label>Status</Label>
            <NativeSelect value={cause.status} onChange={(event) => onUpdate({ status: event.target.value as CauseStatus, isRootCause: event.target.value === 'ROOT_CAUSE' })} onBlur={onSave}>
              {Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label>Tags</Label>
            <Input value={cause.tags.join(', ')} onChange={(event) => onUpdate({ tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} onBlur={onSave} />
          </div>
          <div>
            <Label>Evidências</Label>
            <Textarea rows={3} value={cause.evidence ?? ''} onChange={(event) => onUpdate({ evidence: event.target.value })} onBlur={onSave} />
          </div>
          <div>
            <Label>Prazo sugerido</Label>
            <Input type="date" value={cause.dueDate?.slice(0, 10) ?? ''} onChange={(event) => onUpdate({ dueDate: event.target.value || null })} onBlur={onSave} />
          </div>
        </fieldset>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold text-slate-700">Histórico</div>
          <p className="mt-1 text-xs text-slate-500">Eventos desta causa ficam registrados no histórico e auditoria do plano ao salvar alterações.</p>
        </div>

        <div className="space-y-2 border-t border-slate-200 pt-4">
          {onSendToFiveWhys && (
            <Button className="w-full justify-start bg-emerald-600 hover:bg-emerald-700" onClick={onSendToFiveWhys} disabled={!canEdit}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Investigar nos 5 Porquês
            </Button>
          )}
          <Button variant="outline" className="w-full justify-start" onClick={onMarkLikely} disabled={!canEdit}>
            <Target className="mr-2 h-4 w-4" />
            Marcar como causa provável
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={onMarkRoot} disabled={!canEdit}>
            <Target className="mr-2 h-4 w-4" />
            Marcar como causa raiz
          </Button>
          <Button className="w-full justify-start" onClick={onConvert} disabled={!canEdit || cause.status === 'CONVERTED_TO_ACTION'}>
            <Rocket className="mr-2 h-4 w-4" />
            Transformar em plano de ação
          </Button>
          <Button variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700" onClick={onDelete} disabled={!canEdit}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir causa
          </Button>
        </div>
      </div>
    </aside>
  );
}

function ScaleControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 grid grid-cols-5 overflow-hidden rounded-md border border-slate-200">
        {[1, 2, 3, 4, 5].map((item) => (
          <button
            key={item}
            type="button"
            className={cn('h-8 border-r border-slate-200 text-xs font-semibold last:border-r-0', value === item ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-400' : 'bg-white text-slate-600 hover:bg-slate-50')}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function Legend({ saving, lastSavedAt }: { saving: boolean; lastSavedAt: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600">
      <span className="font-semibold text-slate-800">Legenda:</span>
      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Alta prioridade</span>
      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-400" />Média prioridade</span>
      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-green-500" />Baixa prioridade</span>
      <span className="ml-auto text-slate-400">{saving ? 'Salvando automaticamente...' : lastSavedAt ? `Salvo às ${lastSavedAt}` : 'Arraste para reposicionar'}</span>
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

function normalizeCauses(rows: any[] | undefined): IshikawaCause[] {
  const source = rows?.length ? rows : [];
  return autoLayout(
    source.map((row: any, index: number) =>
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
      }),
    ),
  );
}

function autoLayout(rows: IshikawaCause[]) {
  const counters = new Map<string, number>();
  return rows.map((cause) => {
    if (Number.isFinite(cause.positionX) && Number.isFinite(cause.positionY) && cause.positionX > 0 && cause.positionY > 0) return cause;
    const category = getCategory(cause.category);
    const index = counters.get(category.key) ?? 0;
    counters.set(category.key, index + 1);
    return {
      ...cause,
      positionX: category.cardX + (index % 2 === 0 ? 0 : 16),
      positionY: category.cardY + index * 58,
    };
  });
}

function makeCause(input: Partial<IshikawaCause>): IshikawaCause {
  const category = normalizeCategory(input.category);
  const priority = normalizePriority(input.priority);
  const title = String(input.title ?? '').trim() || 'Nova causa';
  return {
    id: input.id && !String(input.id).startsWith('temp-') ? String(input.id) : newTempId(),
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
    .replace(/[\u0300-\u036f]/g, '')
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

function newTempId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `temp-${crypto.randomUUID()}`;
  return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultSuggestions(_causes: IshikawaCause[]): Suggestion[] {
  return [];
}
