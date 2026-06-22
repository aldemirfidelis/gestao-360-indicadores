'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { LucideIcon } from 'lucide-react';
import {
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Download,
  FileText,
  History,
  Link2,
  ListChecks,
  MapPin,
  Maximize,
  Paperclip,
  Plus,
  Rocket,
  Save,
  Sparkles,
  Target,
  Trash2,
  Users,
  Wrench,
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
import { cn } from '@/lib/utils';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type ItemStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'REOPENED';
type FieldType = 'WHAT' | 'WHY' | 'WHERE' | 'WHEN' | 'WHO' | 'HOW' | 'HOW_MUCH';

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

interface FiveW2HItem {
  id: string;
  itemType: FieldType;
  title: string;
  subtitle: string;
  description: string;
  bullets: string[];
  responsibleUserId: string;
  dueDate: string;
  priority: Priority;
  progress: number;
  status: ItemStatus;
  evidence: string;
  checklist: ChecklistItem[];
  data: Record<string, any>;
  isAiSuggested: boolean;
  convertedToTaskId: string | null;
  completedAt: string | null;
  positionX: number;
  positionY: number;
}

interface FiveW2HSuggestion {
  field: FieldType;
  suggestion: string;
  justification: string;
}

const CANVAS_WIDTH = 1160;
const CANVAS_HEIGHT = 612;
const CARD_WIDTH = 256;
const CARD_HEIGHT = 236;

const FIELD_ORDER: FieldType[] = ['WHAT', 'WHY', 'WHERE', 'WHEN', 'WHO', 'HOW', 'HOW_MUCH'];

const FIELD_META: Record<
  FieldType,
  {
    number: string;
    title: string;
    subtitle: string;
    color: string;
    soft: string;
    icon: LucideIcon;
    x: number;
    y: number;
  }
> = {
  WHAT: { number: '1', title: 'What', subtitle: 'O que será feito', color: '#2563eb', soft: 'bg-blue-50 text-blue-700 border-blue-200', icon: Boxes, x: 24, y: 72 },
  WHY: { number: '2', title: 'Why', subtitle: 'Por que será feito', color: '#f97316', soft: 'bg-orange-50 text-orange-700 border-orange-200', icon: Target, x: 304, y: 72 },
  WHERE: { number: '3', title: 'Where', subtitle: 'Onde será feito', color: '#16a34a', soft: 'bg-green-50 text-green-700 border-green-200', icon: MapPin, x: 584, y: 72 },
  WHEN: { number: '4', title: 'When', subtitle: 'Quando será feito', color: '#7c3aed', soft: 'bg-violet-50 text-violet-700 border-violet-200', icon: CalendarDays, x: 864, y: 72 },
  WHO: { number: '5', title: 'Who', subtitle: 'Quem será responsável', color: '#0f766e', soft: 'bg-teal-50 text-teal-700 border-teal-200', icon: Users, x: 164, y: 360 },
  HOW: { number: '6', title: 'How', subtitle: 'Como será executado', color: '#f59e0b', soft: 'bg-amber-50 text-amber-700 border-amber-200', icon: Wrench, x: 444, y: 360 },
  HOW_MUCH: { number: '7', title: 'How much', subtitle: 'Quanto vai custar', color: '#ef4444', soft: 'bg-red-50 text-red-700 border-red-200', icon: DollarSign, x: 724, y: 360 },
};

// Sequência lógica dos conectores (1→2→3→4, 5→6→7 e pontes entre as fileiras).
const CONNECTORS: [FieldType, FieldType][] = [
  ['WHAT', 'WHY'],
  ['WHY', 'WHERE'],
  ['WHERE', 'WHEN'],
  ['WHO', 'HOW'],
  ['HOW', 'HOW_MUCH'],
  ['WHAT', 'WHO'],
  ['WHEN', 'HOW_MUCH'],
];

const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

const STATUS_LABEL: Record<ItemStatus, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluído',
  BLOCKED: 'Bloqueado',
  REOPENED: 'Reaberto',
};

const TYPE_FIELDS: Record<FieldType, { key: string; label: string; type?: 'date' | 'text' }[]> = {
  WHAT: [
    { key: 'objective', label: 'Objetivo principal' },
    { key: 'scope', label: 'Escopo da execução' },
    { key: 'expectedResult', label: 'Resultado esperado' },
    { key: 'completionCriteria', label: 'Critério de conclusão' },
  ],
  WHY: [
    { key: 'justification', label: 'Justificativa' },
    { key: 'expectedImpact', label: 'Impacto esperado' },
    { key: 'riskIfNotDone', label: 'Risco de não executar' },
    { key: 'indicatorBenefit', label: 'Benefício para o indicador' },
  ],
  WHERE: [
    { key: 'area', label: 'Área' },
    { key: 'sector', label: 'Setor' },
    { key: 'equipment', label: 'Equipamento' },
    { key: 'process', label: 'Processo' },
    { key: 'physicalLocation', label: 'Local físico' },
  ],
  WHEN: [
    { key: 'startDate', label: 'Data de início', type: 'date' },
    { key: 'endDate', label: 'Prazo final', type: 'date' },
    { key: 'estimatedDuration', label: 'Duração estimada' },
    { key: 'milestones', label: 'Marcos intermediários' },
  ],
  WHO: [
    { key: 'team', label: 'Equipe envolvida' },
    { key: 'supportAreas', label: 'Áreas de apoio' },
    { key: 'approver', label: 'Aprovador' },
    { key: 'validator', label: 'Validador' },
  ],
  HOW: [
    { key: 'steps', label: 'Passo a passo' },
    { key: 'method', label: 'Método' },
    { key: 'resources', label: 'Recursos necessários' },
    { key: 'expectedEvidence', label: 'Evidências esperadas' },
    { key: 'procedure', label: 'Procedimento relacionado' },
  ],
  HOW_MUCH: [
    { key: 'cost', label: 'Custo estimado' },
    { key: 'costType', label: 'Tipo de custo' },
    { key: 'costCenter', label: 'Centro de custo' },
    { key: 'approvedBudget', label: 'Orçamento aprovado' },
    { key: 'expectedReturn', label: 'Retorno esperado' },
  ],
};

export function FiveWTwoHVisualAnalysis({
  actionId,
  action,
  session,
  users = [],
  saving,
  canEdit = true,
  onSave,
}: {
  actionId?: string;
  action?: any;
  session?: any;
  users?: UserOption[];
  saving: boolean;
  canEdit?: boolean;
  onSave: (items: FiveW2HItem[]) => void;
}) {
  const qc = useQueryClient();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef<FiveW2HItem[]>([]);
  const dragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const [items, setItems] = useState<FiveW2HItem[]>(() => normalizeItems(session?.data?.items, action));
  const [selectedType, setSelectedType] = useState<FieldType>('WHAT');
  const [zoom, setZoom] = useState(1);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<FiveW2HSuggestion[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<{ itemType: FieldType; text: string }>({ itemType: 'WHAT', text: '' });

  useEffect(() => {
    const next = normalizeItems(session?.data?.items, action);
    setItems(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.updatedAt]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const selectedItem = items.find((item) => item.itemType === selectedType) ?? items[0];
  const responsibleById = useMemo(() => new Map(users.map((user) => [user.id, user.name])), [users]);
  const completedCount = items.filter((item) => item.status === 'DONE').length;
  const structuredCount = items.filter((item) => isStructured(item)).length;
  const overallProgress = Math.round((completedCount / FIELD_ORDER.length) * 100);

  const handleSave = useCallback(
    (nextItems = itemsRef.current) => {
      onSave(nextItems);
      setLastSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    },
    [onSave],
  );

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = (event.clientX - drag.startX) / zoom;
      const dy = (event.clientY - drag.startY) / zoom;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      setItems((current) =>
        current.map((item) =>
          item.id === drag.id
            ? {
                ...item,
                positionX: Math.max(8, Math.min(CANVAS_WIDTH - CARD_WIDTH - 8, drag.originX + dx)),
                positionY: Math.max(56, Math.min(CANVAS_HEIGHT - CARD_HEIGHT - 64, drag.originY + dy)),
              }
            : item,
        ),
      );
    }
    function onUp() {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag?.moved) handleSave(itemsRef.current);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [handleSave, zoom]);

  function updateItem(type: FieldType, patch: Partial<FiveW2HItem>) {
    setItems((current) => current.map((item) => (item.itemType === type ? { ...item, ...patch } : item)));
  }

  function markDone(item: FiveW2HItem) {
    const gap = completionGap(item);
    if (gap) {
      toast.error(gap);
      return;
    }
    const next = items.map((candidate) =>
      candidate.itemType === item.itemType
        ? { ...candidate, status: 'DONE' as ItemStatus, progress: 100, completedAt: new Date().toISOString() }
        : candidate,
    );
    setItems(next);
    handleSave(next);
  }

  function addBullet() {
    const text = draft.text.trim();
    if (!text) {
      toast.error('Informe o conteúdo do item.');
      return;
    }
    const target = items.find((item) => item.itemType === draft.itemType);
    if (!target) return;
    const next = items.map((item) =>
      item.itemType === draft.itemType ? { ...item, bullets: [...item.bullets, text] } : item,
    );
    setItems(next);
    setSelectedType(draft.itemType);
    setDraft({ itemType: draft.itemType, text: '' });
    setAddOpen(false);
    handleSave(next);
  }

  function removeBullet(type: FieldType, index: number) {
    const next = items.map((item) =>
      item.itemType === type ? { ...item, bullets: item.bullets.filter((_b, i) => i !== index) } : item,
    );
    setItems(next);
    handleSave(next);
  }

  function addChecklistItem() {
    const title = newChecklistItem.trim();
    if (!title || !selectedItem) return;
    updateItem(selectedItem.itemType, { checklist: [...selectedItem.checklist, { id: newTempId(), title, done: false }] });
    setNewChecklistItem('');
  }

  async function convertToAction(item: FiveW2HItem) {
    if (!actionId) {
      toast.error('Salve a análise antes de transformar este item em ação.');
      return;
    }
    if (item.convertedToTaskId) return;
    try {
      await api(`/actions/${actionId}/analysis/5w2h/items/${item.itemType}/convert-to-action`, {
        method: 'POST',
        json: {
          title: `5W2H ${FIELD_META[item.itemType].title}: ${item.description || item.bullets[0] || action?.title || 'ação vinculada'}`,
          description: item.description,
          responsibleUserId: item.responsibleUserId || undefined,
          dueDate: item.dueDate || undefined,
          priority: item.priority,
        },
      });
      toast.success('Item transformado em tarefa do plano');
      // O backend já persistiu a marca de conversão em session.data; apenas refletimos
      // localmente e deixamos o refetch trazer o convertedToTaskId real (sem re-salvar).
      setItems((current) => current.map((candidate) => (candidate.itemType === item.itemType ? { ...candidate, convertedToTaskId: 'pending-refresh' } : candidate)));
      qc.invalidateQueries({ queryKey: ['action', actionId] });
    } catch (error: any) {
      toast.error(error?.message ?? 'Não foi possível transformar em ação');
    }
  }

  async function loadAiSuggestions() {
    if (!actionId) {
      setSuggestions(defaultSuggestions(action, items));
      setSuggestionsOpen(true);
      return;
    }
    setLoadingAi(true);
    try {
      const out = await api<FiveW2HSuggestion[]>(`/actions/${actionId}/analysis/5w2h/ai-suggestions`, {
        method: 'POST',
        json: { items },
      });
      setSuggestions(out.length ? out : defaultSuggestions(action, items));
      setSuggestionsOpen(true);
    } catch (error: any) {
      toast.error(error?.message ?? 'Não foi possível gerar sugestões com IA');
      setSuggestions(defaultSuggestions(action, items));
      setSuggestionsOpen(true);
    } finally {
      setLoadingAi(false);
    }
  }

  function acceptSuggestion(item: FiveW2HSuggestion, editAfter = false) {
    const type = normalizeType(item.field);
    const next = items.map((candidate) =>
      candidate.itemType === type
        ? {
            ...candidate,
            isAiSuggested: true,
            description: candidate.description ? candidate.description : item.suggestion,
            bullets: candidate.description ? [...candidate.bullets, item.suggestion] : candidate.bullets,
          }
        : candidate,
    );
    setItems(next);
    setSelectedType(type);
    setSuggestions((current) => current.filter((candidate) => candidate !== item));
    handleSave(next);
    if (editAfter) setSuggestionsOpen(false);
  }

  async function exportImage() {
    if (!canvasRef.current) return;
    const dataUrl = await toPng(canvasRef.current, { backgroundColor: '#f8fafc', pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = `5w2h-${actionId ?? 'analise'}.png`;
    link.href = dataUrl;
    link.click();
  }

  function resetLayout() {
    const next = items.map((item) => ({ ...item, positionX: FIELD_META[item.itemType].x, positionY: FIELD_META[item.itemType].y }));
    setItems(next);
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
          <Button size="sm" onClick={() => { setDraft({ itemType: selectedType, text: '' }); setAddOpen(true); }} disabled={!canEdit}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar item
          </Button>
          <Button size="sm" variant="outline" onClick={loadAiSuggestions} disabled={!canEdit || loadingAi}>
            <Sparkles className="mr-2 h-4 w-4" />
            {loadingAi ? 'Gerando...' : 'Sugestão com IA'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setChecklistOpen(true)}>
            <ListChecks className="mr-2 h-4 w-4" />
            Checklist
          </Button>
          <Button size="sm" variant="outline" onClick={() => selectedItem && setSelectedType(selectedItem.itemType)}>
            <Paperclip className="mr-2 h-4 w-4" />
            Evidências
          </Button>
          <Button size="sm" variant="outline" onClick={() => selectedItem && setSelectedType(selectedItem.itemType)}>
            <History className="mr-2 h-4 w-4" />
            Timeline
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={resetLayout} disabled={!canEdit} title="Reorganizar layout">
            <Maximize className="mr-2 h-4 w-4" />
            Layout
          </Button>
          <Button size="icon" variant="outline" onClick={() => setZoom((value) => Math.max(0.75, value - 0.1))} title="Reduzir zoom">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="w-12 text-center text-xs font-medium text-slate-600">{Math.round(zoom * 100)}%</div>
          <Button size="icon" variant="outline" onClick={() => setZoom((value) => Math.min(1.25, value + 0.1))} title="Aumentar zoom">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={centerCanvas} title="Centralizar">
            <Target className="h-4 w-4" />
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
          Você está em modo de visualização. Edição, conversão, checklist e evidências estão bloqueados.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div ref={scrollRef} className="max-h-[560px] overflow-auto bg-slate-50">
          <div
            ref={canvasRef}
            className="relative origin-top-left"
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          >
            <FiveW2HConnectors items={items} />
            <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 text-center">
              <div className="text-lg font-bold tracking-tight text-slate-900">5W2H</div>
              <div className="text-xs font-medium text-slate-500">Plano estruturado de execução</div>
            </div>
            {FIELD_ORDER.map((type) => {
              const item = items.find((candidate) => candidate.itemType === type)!;
              return (
                <FiveW2HCard
                  key={type}
                  item={item}
                  selected={selectedType === type}
                  canEdit={canEdit}
                  responsibleName={item.responsibleUserId ? responsibleById.get(item.responsibleUserId) : undefined}
                  onSelect={() => setSelectedType(type)}
                  onPointerDown={(event) => {
                    if (!canEdit) return;
                    dragRef.current = { id: item.id, startX: event.clientX, startY: event.clientY, originX: item.positionX, originY: item.positionY, moved: false };
                  }}
                />
              );
            })}
          </div>
        </div>

        <FiveW2HDrawer
          item={selectedItem}
          action={action}
          users={users}
          canEdit={canEdit}
          onUpdate={(patch) => selectedItem && updateItem(selectedItem.itemType, patch)}
          onSave={() => handleSave()}
          onMarkDone={() => selectedItem && markDone(selectedItem)}
          onConvert={() => selectedItem && convertToAction(selectedItem)}
          onRemoveBullet={(index) => selectedItem && removeBullet(selectedItem.itemType, index)}
          onOpenChecklist={() => setChecklistOpen(true)}
        />
      </div>

      <FiveW2HFooter structuredCount={structuredCount} completedCount={completedCount} progress={overallProgress} saving={saving} lastSavedAt={lastSavedAt} />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar item ao 5W2H</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Campo</Label>
              <NativeSelect value={draft.itemType} onChange={(event) => setDraft({ ...draft, itemType: event.target.value as FieldType })}>
                {FIELD_ORDER.map((type) => (
                  <option key={type} value={type}>{FIELD_META[type].title} — {FIELD_META[type].subtitle}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Conteúdo do item</Label>
              <Input value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} autoFocus onKeyDown={(event) => event.key === 'Enter' && addBullet()} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={addBullet}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Sugestões de 5W2H com IA</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
            {suggestions.length === 0 && <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhuma sugestão pendente.</div>}
            {suggestions.map((item) => {
              const meta = FIELD_META[normalizeType(item.field)];
              return (
                <div key={`${item.field}-${item.suggestion}`} className="rounded-lg border bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge variant="outline" className={meta.soft}>{meta.title}</Badge>
                    <span className="text-xs text-slate-400">{meta.subtitle}</span>
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

      <Dialog open={checklistOpen} onOpenChange={setChecklistOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Checklist — {selectedItem ? FIELD_META[selectedItem.itemType].title : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {selectedItem?.checklist.map((check) => (
              <label key={check.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={check.done}
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateItem(selectedItem.itemType, {
                      checklist: selectedItem.checklist.map((candidate) => (candidate.id === check.id ? { ...candidate, done: event.target.checked } : candidate)),
                    })
                  }
                />
                <span className={cn(check.done && 'text-slate-400 line-through')}>{check.title}</span>
              </label>
            ))}
            <div className="flex gap-2 pt-2">
              <Input value={newChecklistItem} onChange={(event) => setNewChecklistItem(event.target.value)} placeholder="Novo item do checklist" disabled={!canEdit} onKeyDown={(event) => event.key === 'Enter' && addChecklistItem()} />
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

function FiveW2HConnectors({ items }: { items: FiveW2HItem[] }) {
  const byType = new Map(items.map((item) => [item.itemType, item]));
  return (
    <svg className="absolute inset-0 z-0" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} aria-hidden>
      {CONNECTORS.map(([from, to]) => {
        const a = byType.get(from);
        const b = byType.get(to);
        if (!a || !b) return null;
        const ax = a.positionX + CARD_WIDTH / 2;
        const ay = a.positionY + CARD_HEIGHT / 2;
        const bx = b.positionX + CARD_WIDTH / 2;
        const by = b.positionY + CARD_HEIGHT / 2;
        return <line key={`${from}-${to}`} x1={ax} y1={ay} x2={bx} y2={by} stroke="#cbd5e1" strokeWidth={2} strokeDasharray="4 6" strokeLinecap="round" />;
      })}
    </svg>
  );
}

function FiveW2HCard({
  item,
  selected,
  canEdit,
  responsibleName,
  onSelect,
  onPointerDown,
}: {
  item: FiveW2HItem;
  selected: boolean;
  canEdit: boolean;
  responsibleName?: string;
  onSelect: () => void;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const meta = FIELD_META[item.itemType];
  const Icon = meta.icon;
  const bullets = item.bullets.length ? item.bullets : item.description ? [item.description] : [];
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'absolute z-20 rounded-xl border bg-white p-4 text-left shadow-sm transition',
        canEdit && 'cursor-grab active:cursor-grabbing',
        selected ? 'border-blue-500 shadow-lg ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-md',
      )}
      style={{ left: item.positionX, top: item.positionY, width: CARD_WIDTH, minHeight: CARD_HEIGHT, borderTopColor: meta.color, borderTopWidth: 3 }}
      onClick={onSelect}
      onPointerDown={onPointerDown}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-sm" style={{ backgroundColor: meta.color }}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-bold leading-4" style={{ color: meta.color }}>{meta.number}. {meta.title}</div>
            <div className="text-[11px] font-medium text-slate-500">{meta.subtitle}</div>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-300" />
      </div>

      <ul className="mt-3 space-y-1">
        {bullets.slice(0, 5).map((bullet, index) => (
          <li key={index} className="flex gap-1.5 text-[11px] leading-4 text-slate-700">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
            <span className="line-clamp-2">{bullet}</span>
          </li>
        ))}
        {bullets.length === 0 && <li className="text-[11px] italic text-slate-400">Sem itens preenchidos</li>}
        {bullets.length > 5 && <li className="text-[11px] font-medium text-slate-400">+{bullets.length - 5} item(ns)</li>}
      </ul>

      <div className="absolute inset-x-4 bottom-3">
        <div className="mb-2 flex items-center justify-between">
          <StatusPill item={item} />
          {item.convertedToTaskId && <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">Ação criada</Badge>}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full" style={{ width: `${item.progress}%`, backgroundColor: meta.color }} />
        </div>
      </div>
    </div>
  );
}

function FiveW2HDrawer({
  item,
  action,
  users,
  canEdit,
  onUpdate,
  onSave,
  onMarkDone,
  onConvert,
  onRemoveBullet,
  onOpenChecklist,
}: {
  item?: FiveW2HItem;
  action?: any;
  users: UserOption[];
  canEdit: boolean;
  onUpdate: (patch: Partial<FiveW2HItem>) => void;
  onSave: () => void;
  onMarkDone: () => void;
  onConvert: () => void;
  onRemoveBullet: (index: number) => void;
  onOpenChecklist: () => void;
}) {
  if (!item) {
    return (
      <aside className="border-l border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-900">Item selecionado</div>
        <p className="mt-2 text-sm text-slate-500">Selecione um card do board para editar detalhes, responsáveis, checklist e evidências.</p>
      </aside>
    );
  }
  const meta = FIELD_META[item.itemType];
  const Icon = meta.icon;
  const doneChecklist = item.checklist.filter((check) => check.done).length;
  return (
    <aside className="border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-3">
        <div className="text-sm font-semibold text-slate-900">Item selecionado</div>
        <div className="mt-2 flex items-start gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: meta.color }}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900">{meta.title}</div>
            <div className="text-xs text-slate-500">{meta.subtitle}</div>
          </div>
        </div>
      </div>
      <div className="max-h-[520px] space-y-3 overflow-y-auto p-3">
        <fieldset disabled={!canEdit} className="space-y-3">
          <div>
            <Label>Descrição / Objetivo</Label>
            <Textarea rows={3} value={item.description} onChange={(event) => onUpdate({ description: event.target.value })} onBlur={onSave} />
          </div>

          <div>
            <Label>Itens deste campo</Label>
            <div className="mt-1 space-y-1">
              {item.bullets.length === 0 && <p className="text-xs text-slate-400">Use “Adicionar item” para detalhar este campo.</p>}
              {item.bullets.map((bullet, index) => (
                <div key={index} className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                  <span className="min-w-0 flex-1 text-slate-700">{bullet}</span>
                  {canEdit && (
                    <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => onRemoveBullet(index)} aria-label="Remover item">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {TYPE_FIELDS[item.itemType].map((field) => (
            <div key={field.key}>
              <Label>{field.label}</Label>
              <Input
                type={field.type === 'date' ? 'date' : 'text'}
                value={field.type === 'date' ? String(item.data[field.key] ?? '').slice(0, 10) : item.data[field.key] ?? ''}
                onChange={(event) => onUpdate({ data: { ...item.data, [field.key]: event.target.value } })}
                onBlur={onSave}
              />
            </div>
          ))}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Responsável</Label>
              <NativeSelect value={item.responsibleUserId} onChange={(event) => onUpdate({ responsibleUserId: event.target.value })} onBlur={onSave}>
                <option value="">Sem responsável</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={item.dueDate?.slice(0, 10) ?? ''} onChange={(event) => onUpdate({ dueDate: event.target.value })} onBlur={onSave} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Prioridade</Label>
              <NativeSelect value={item.priority} onChange={(event) => onUpdate({ priority: event.target.value as Priority })} onBlur={onSave}>
                {Object.entries(PRIORITY_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Status</Label>
              <NativeSelect value={item.status} onChange={(event) => onUpdate({ status: event.target.value as ItemStatus })} onBlur={onSave}>
                {Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div>
            <Label>Progresso</Label>
            <div className="flex items-center gap-3">
              <Input type="number" min={0} max={100} value={item.progress} onChange={(event) => onUpdate({ progress: clampProgress(event.target.value) })} onBlur={onSave} className="w-24" />
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${item.progress}%`, backgroundColor: meta.color }} />
              </div>
            </div>
          </div>
          <div>
            <Label>Evidências vinculadas</Label>
            <Textarea rows={2} value={item.evidence} onChange={(event) => onUpdate({ evidence: event.target.value })} onBlur={onSave} placeholder="Arquivos, links, prints ou registros operacionais" />
          </div>
        </fieldset>

        <div className="grid gap-2">
          <PanelLink icon={Paperclip} label="Evidências vinculadas" value={`${item.evidence ? 1 : 0} registro`} />
          <PanelLink icon={Link2} label="Ações vinculadas" value={item.convertedToTaskId ? '1 tarefa criada' : `${action?.tasks?.length ?? 0} tarefas do plano`} />
          <button type="button" onClick={onOpenChecklist} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm transition hover:border-slate-300">
            <span className="flex items-center gap-2 font-medium text-slate-700"><ListChecks className="h-4 w-4 text-slate-500" />Checklist do item</span>
            <span className="text-xs text-slate-500">{doneChecklist}/{item.checklist.length} concluídos</span>
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold text-slate-700">Histórico</div>
          <p className="mt-1 text-xs text-slate-500">As alterações deste item ficam registradas no histórico e na auditoria do plano ao salvar.</p>
        </div>

        <div className="space-y-2 border-t border-slate-200 pt-4">
          <Button className="w-full justify-start" onClick={onConvert} disabled={!canEdit || Boolean(item.convertedToTaskId)}>
            <Rocket className="mr-2 h-4 w-4" />
            Transformar em plano de ação
          </Button>
          <Button variant="outline" className="w-full justify-start text-green-700" onClick={onMarkDone} disabled={!canEdit}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Marcar concluído
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={onSave} disabled={!canEdit}>
            <FileText className="mr-2 h-4 w-4" />
            Editar item
          </Button>
        </div>
      </div>
    </aside>
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

function FiveW2HFooter({ structuredCount, completedCount, progress, saving, lastSavedAt }: { structuredCount: number; completedCount: number; progress: number; saving: boolean; lastSavedAt: string | null }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600">
      <div>
        <div className="font-semibold text-slate-800">Plano 5W2H atual</div>
        <div>{structuredCount} de {FIELD_ORDER.length} campos estruturados · {completedCount} concluído(s)</div>
      </div>
      <div className="hidden flex-wrap items-center gap-4 md:flex">
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

function StatusPill({ item }: { item: FiveW2HItem }) {
  const overdue = isOverdue(item);
  const label = overdue ? 'Atrasado' : STATUS_LABEL[item.status];
  const classes = overdue
    ? 'border-red-200 bg-red-50 text-red-700'
    : item.status === 'DONE'
      ? 'border-green-200 bg-green-50 text-green-700'
      : item.status === 'IN_PROGRESS'
        ? 'border-orange-200 bg-orange-50 text-orange-700'
        : item.status === 'BLOCKED'
          ? 'border-red-200 bg-red-50 text-red-700'
          : item.status === 'REOPENED'
            ? 'border-violet-200 bg-violet-50 text-violet-700'
            : 'border-slate-200 bg-slate-100 text-slate-600';
  return <span className={cn('w-fit rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', classes)}>{label}</span>;
}

// ---------- helpers ----------

function normalizeItems(rows: any[] | undefined, action: any): FiveW2HItem[] {
  const byType = new Map((Array.isArray(rows) ? rows : []).map((row) => [normalizeType(row.itemType), row]));
  return FIELD_ORDER.map((type) => makeItem(byType.get(type), type, action));
}

function makeItem(row: any, type: FieldType, action: any): FiveW2HItem {
  const meta = FIELD_META[type];
  const fallback = defaultItemSeed(type, action);
  const data = row?.data && typeof row.data === 'object' && !Array.isArray(row.data) ? row.data : {};
  const status = normalizeStatus(row?.status);
  return {
    id: row?.id ?? `${type}-${newTempId()}`,
    itemType: type,
    title: meta.title,
    subtitle: meta.subtitle,
    description: typeof row?.description === 'string' ? row.description : fallback.description,
    bullets: Array.isArray(row?.bullets) ? row.bullets.map((b: any) => String(b)).filter(Boolean) : fallback.bullets,
    responsibleUserId: row?.responsibleUserId ?? fallback.responsibleUserId,
    dueDate: row?.dueDate ?? fallback.dueDate,
    priority: normalizePriority(row?.priority ?? action?.priority),
    progress: clampProgress(row?.progress ?? (status === 'DONE' ? 100 : 0)),
    status,
    evidence: typeof row?.evidence === 'string' ? row.evidence : '',
    checklist: Array.isArray(row?.checklist) && row.checklist.length ? normalizeChecklist(row.checklist) : defaultChecklist(type),
    data: { ...fallback.data, ...data },
    isAiSuggested: Boolean(row?.isAiSuggested),
    convertedToTaskId: row?.convertedToTaskId ?? null,
    completedAt: row?.completedAt ?? null,
    positionX: Number.isFinite(Number(row?.positionX)) && Number(row?.positionX) > 0 ? Number(row.positionX) : meta.x,
    positionY: Number.isFinite(Number(row?.positionY)) && Number(row?.positionY) > 0 ? Number(row.positionY) : meta.y,
  };
}

function defaultItemSeed(type: FieldType, action: any): { description: string; bullets: string[]; responsibleUserId: string; dueDate: string; data: Record<string, any> } {
  const empty = { description: '', bullets: [] as string[], responsibleUserId: '', dueDate: '', data: {} as Record<string, any> };
  if (!action) return empty;
  switch (type) {
    case 'WHAT':
      return { ...empty, description: action.description ?? action.title ?? '' };
    case 'WHY':
      return { ...empty, description: action.problemDescription ?? action.rootCause ?? '', data: { indicatorBenefit: action.indicator?.name ? `Recuperar o desempenho de ${action.indicator.name}` : '' } };
    case 'WHERE':
      return { ...empty, bullets: action.ownerNode?.name ? [action.ownerNode.name] : [], data: { area: action.ownerNode?.name ?? '' } };
    case 'WHEN':
      return { ...empty, dueDate: action.dueDate ?? '', data: { startDate: action.startDate ?? '', endDate: action.dueDate ?? '' } };
    case 'WHO':
      return { ...empty, responsibleUserId: action.responsibleUser?.id ?? '', bullets: action.responsibleUser?.name ? [action.responsibleUser.name] : [], data: { team: action.responsibleUser?.name ?? '' } };
    case 'HOW':
      return empty;
    case 'HOW_MUCH':
      return {
        ...empty,
        bullets: action.estimatedCost ? [`Investimento estimado: R$ ${action.estimatedCost}`] : [],
        data: { cost: action.estimatedCost ? `R$ ${action.estimatedCost}` : '' },
      };
    default:
      return empty;
  }
}

function defaultChecklist(type: FieldType): ChecklistItem[] {
  const items: Record<FieldType, string[]> = {
    WHAT: ['Ação definida', 'Escopo claro', 'Resultado esperado informado', 'Critério de conclusão definido'],
    WHY: ['Justificativa informada', 'Impacto esperado descrito', 'Risco de não executar registrado'],
    WHERE: ['Área definida', 'Setor definido', 'Processo/equipamento informado'],
    WHEN: ['Data de início definida', 'Prazo final definido', 'Marcos intermediários informados'],
    WHO: ['Responsável principal definido', 'Áreas de apoio informadas', 'Validador definido'],
    HOW: ['Passo a passo definido', 'Método informado', 'Recursos necessários listados', 'Evidências esperadas definidas'],
    HOW_MUCH: ['Custo estimado informado', 'Centro de custo informado', 'Retorno esperado registrado'],
  };
  return items[type].map((title, index) => ({ id: `${type}-${index + 1}`, title, done: false }));
}

function normalizeChecklist(value: any[]): ChecklistItem[] {
  return value
    .map((item, index) => ({
      id: typeof item?.id === 'string' && item.id ? item.id : `item-${index + 1}`,
      title: typeof item?.title === 'string' ? item.title : String(item ?? ''),
      done: Boolean(item?.done),
    }))
    .filter((item) => item.title);
}

function isStructured(item: FiveW2HItem) {
  return Boolean(item.description?.trim()) || item.bullets.length > 0 || Object.values(item.data).some((v) => String(v ?? '').trim());
}

function completionGap(item: FiveW2HItem): string | null {
  const hasContent = Boolean(item.description?.trim()) || item.bullets.length > 0;
  switch (item.itemType) {
    case 'WHAT':
      return hasContent ? null : 'Informe o que será feito antes de concluir o What.';
    case 'WHY':
      return hasContent || item.data.justification ? null : 'Informe a justificativa antes de concluir o Why.';
    case 'WHERE':
      return hasContent || item.data.area || item.data.process ? null : 'Informe local, área ou processo antes de concluir o Where.';
    case 'WHEN':
      return item.dueDate || item.data.endDate ? null : 'Informe o prazo antes de concluir o When.';
    case 'WHO':
      return item.responsibleUserId || hasContent || item.data.team ? null : 'Informe o responsável antes de concluir o Who.';
    case 'HOW':
      return hasContent || item.data.method || item.data.steps ? null : 'Informe o método de execução antes de concluir o How.';
    case 'HOW_MUCH':
      return hasContent || item.data.cost ? null : 'Informe o custo estimado (ou justifique custo zero) antes de concluir o How much.';
    default:
      return null;
  }
}

function defaultSuggestions(action: any, items: FiveW2HItem[]): FiveW2HSuggestion[] {
  const indicatorName = action?.indicator?.name ?? 'indicador relacionado';
  const area = action?.ownerNode?.name ?? 'a área responsável';
  const catalog: Record<FieldType, { suggestion: string; justification: string }> = {
    WHAT: { suggestion: `Detalhar o que será feito para tratar "${action?.problemDescription ?? action?.title ?? 'o problema'}", com escopo e resultado esperado.`, justification: 'O What precisa deixar claro entrega, escopo e critério de conclusão.' },
    WHY: { suggestion: `Justificar por que a ação resolve a causa raiz e o impacto sobre ${indicatorName}.`, justification: 'O Why conecta a execução ao problema e ao benefício do indicador.' },
    WHERE: { suggestion: `Informar onde será executado: ${area}, setor, processo e equipamentos.`, justification: 'O Where evita ambiguidade sobre local e processo.' },
    WHEN: { suggestion: 'Definir início, prazo final, duração estimada e marcos intermediários.', justification: 'O When estrutura o cronograma e o acompanhamento de atraso.' },
    WHO: { suggestion: 'Definir responsável principal, equipe de apoio, aprovador e validador.', justification: 'O Who garante responsabilização clara.' },
    HOW: { suggestion: 'Descrever passo a passo, método, recursos e evidências esperadas.', justification: 'O How torna a execução repetível e auditável.' },
    HOW_MUCH: { suggestion: 'Estimar custo, tipo de custo, centro de custo e retorno esperado.', justification: 'O How much sustenta a decisão de investimento.' },
  };
  const byType = new Map(items.map((item) => [item.itemType, item]));
  return FIELD_ORDER.filter((type) => {
    const item = byType.get(type);
    return !item || !isStructured(item);
  }).map((type) => ({ field: type, suggestion: catalog[type].suggestion, justification: catalog[type].justification }));
}

function normalizeType(value: any): FieldType {
  const key = normalizeKey(value);
  const map: Record<string, FieldType> = {
    WHAT: 'WHAT', O_QUE: 'WHAT', OQUE: 'WHAT',
    WHY: 'WHY', POR_QUE: 'WHY', PORQUE: 'WHY',
    WHERE: 'WHERE', ONDE: 'WHERE',
    WHEN: 'WHEN', QUANDO: 'WHEN',
    WHO: 'WHO', QUEM: 'WHO',
    HOW: 'HOW', COMO: 'HOW',
    HOW_MUCH: 'HOW_MUCH', HOWMUCH: 'HOW_MUCH', QUANTO: 'HOW_MUCH', QUANTO_CUSTA: 'HOW_MUCH',
  };
  return map[key] ?? 'WHAT';
}

function normalizePriority(value: any): Priority {
  const key = normalizeKey(value);
  if (key === 'LOW' || key === 'BAIXA') return 'LOW';
  if (key === 'HIGH' || key === 'ALTA') return 'HIGH';
  if (key === 'CRITICAL' || key === 'CRITICA') return 'CRITICAL';
  return 'MEDIUM';
}

function normalizeStatus(value: any): ItemStatus {
  const key = normalizeKey(value);
  if (key === 'IN_PROGRESS' || key === 'EM_ANDAMENTO') return 'IN_PROGRESS';
  if (key === 'DONE' || key === 'CONCLUIDO' || key === 'CONCLUIDA') return 'DONE';
  if (key === 'BLOCKED' || key === 'BLOQUEADO' || key === 'BLOQUEADA') return 'BLOCKED';
  if (key === 'REOPENED' || key === 'REABERTO' || key === 'REABERTA') return 'REOPENED';
  return 'PENDING';
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

function isOverdue(item: FiveW2HItem) {
  if (!item.dueDate || item.status === 'DONE') return false;
  return new Date(item.dueDate) < new Date();
}

function newTempId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `temp-${crypto.randomUUID()}`;
  return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
