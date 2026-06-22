'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  History,
  Layers,
  ListChecks,
  Maximize,
  Paperclip,
  Plus,
  Rocket,
  Save,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trash2,
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
type WhyStatus = 'PENDING' | 'IN_REVIEW' | 'VALIDATED' | 'ROOT_CAUSE' | 'DISCARDED' | 'CONVERTED_TO_ACTION';
type CauseType = 'IDENTIFIED_CAUSE' | 'PROBABLE_CAUSE' | 'ROOT_CAUSE' | 'DISCARDED' | 'RECOMMENDED_ACTION';

interface UserOption {
  id: string;
  name: string;
  email?: string;
}

interface WhyEvidence {
  id: string;
  name: string;
  url?: string;
}

interface WhyAction {
  id: string;
  title: string;
}

interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

interface WhyItem {
  id: string;
  level: number;
  question: string;
  answer: string;
  causeType: CauseType;
  confidence: number;
  status: WhyStatus;
  responsibleUserId: string;
  dueDate: string;
  priority: Priority;
  observations: string;
  evidence: string;
  evidences: WhyEvidence[];
  actions: WhyAction[];
  isRootCause: boolean;
  isAiSuggested: boolean;
  convertedToTaskId: string | null;
}

interface WhySuggestion {
  level: number;
  question: string;
  answer: string;
  justification: string;
  confidence: number;
}

const PALETTE = ['#2563eb', '#16a34a', '#f97316', '#7c3aed', '#ef4444'];
const PALETTE_SOFT = [
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-green-50 text-green-700 border-green-200',
  'bg-orange-50 text-orange-700 border-orange-200',
  'bg-violet-50 text-violet-700 border-violet-200',
  'bg-red-50 text-red-700 border-red-200',
];

function levelColor(level: number) {
  return PALETTE[(Math.max(1, level) - 1) % PALETTE.length];
}
function levelSoft(level: number) {
  return PALETTE_SOFT[(Math.max(1, level) - 1) % PALETTE_SOFT.length];
}

const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

const STATUS_LABEL: Record<WhyStatus, string> = {
  PENDING: 'Pendente',
  IN_REVIEW: 'Em análise',
  VALIDATED: 'Validado',
  ROOT_CAUSE: 'Causa raiz',
  DISCARDED: 'Descartado',
  CONVERTED_TO_ACTION: 'Convertido em ação',
};

const CAUSE_TYPE_META: Record<CauseType, { label: string; short: string; dot: string; soft: string }> = {
  IDENTIFIED_CAUSE: { label: 'Causa identificada', short: 'CAUSA IDENTIFICADA', dot: '#2563eb', soft: 'border-blue-200 bg-blue-50 text-blue-700' },
  PROBABLE_CAUSE: { label: 'Causa provável', short: 'CAUSA PROVÁVEL', dot: '#f97316', soft: 'border-orange-200 bg-orange-50 text-orange-700' },
  ROOT_CAUSE: { label: 'Causa raiz', short: 'CAUSA RAIZ', dot: '#ef4444', soft: 'border-red-200 bg-red-50 text-red-700' },
  DISCARDED: { label: 'Descartada', short: 'DESCARTADA', dot: '#94a3b8', soft: 'border-slate-200 bg-slate-100 text-slate-600' },
  RECOMMENDED_ACTION: { label: 'Ação recomendada', short: 'AÇÃO RECOMENDADA', dot: '#16a34a', soft: 'border-green-200 bg-green-50 text-green-700' },
};

const CAUSE_TYPE_ORDER: CauseType[] = ['IDENTIFIED_CAUSE', 'PROBABLE_CAUSE', 'ROOT_CAUSE', 'DISCARDED', 'RECOMMENDED_ACTION'];

export function FiveWhysVisualAnalysis({
  actionId,
  action,
  session,
  problem,
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
  problem: string;
  rootCause: string;
  users?: UserOption[];
  saving: boolean;
  canEdit?: boolean;
  onRootCauseChange: (value: string) => void;
  onSave: (items: WhyItem[], rootCause?: string, extra?: Record<string, any>) => void;
}) {
  const qc = useQueryClient();
  const boardRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef<WhyItem[]>([]);
  const [items, setItems] = useState<WhyItem[]>(() => normalizeItems(session?.data?.items ?? session?.fiveWhys, problem));
  const [nextSteps, setNextSteps] = useState<ChecklistItem[]>(() => normalizeChecklist(session?.data?.nextSteps) ?? defaultNextSteps());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<WhySuggestion[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [evidenceDraft, setEvidenceDraft] = useState('');
  const [actionDraft, setActionDraft] = useState('');

  useEffect(() => {
    setItems(normalizeItems(session?.data?.items ?? session?.fiveWhys, problem));
    setNextSteps(normalizeChecklist(session?.data?.nextSteps) ?? defaultNextSteps());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.updatedAt]);

  useEffect(() => {
    itemsRef.current = items;
    setSelectedId((current) => (current && items.some((item) => item.id === current) ? current : items[0]?.id ?? null));
  }, [items]);

  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  const rootItem = items.find((item) => item.isRootCause) ?? null;
  const answeredCount = items.filter(isAnswered).length;
  const baseAnswered = items.filter((item) => item.level <= 5 && isAnswered(item)).length;
  const progress = Math.round((Math.min(baseAnswered, 5) / 5) * 100);
  const responsibleById = useMemo(() => new Map(users.map((user) => [user.id, user.name])), [users]);

  const handleSave = useCallback(
    (nextItems = itemsRef.current, nextRootCause = rootCause, steps = nextSteps) => {
      onSave(nextItems, nextRootCause, { nextSteps: steps });
      setLastSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    },
    [onSave, rootCause, nextSteps],
  );

  function updateItem(id: string, patch: Partial<WhyItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addWhy() {
    const level = items.length + 1;
    const last = items[items.length - 1];
    const next = [...items, makeItem({ level, question: last && isAnswered(last) ? `Por que "${last.answer}" ocorre?` : 'Por quê?' }, level, problem)];
    setItems(next);
    setSelectedId(next[next.length - 1].id);
    handleSave(next);
  }

  function deleteWhy(item: WhyItem) {
    if (item.convertedToTaskId && !window.confirm('Este porquê já foi convertido em ação. Deseja remover mesmo assim?')) return;
    if (items.length <= 1) {
      toast.error('A análise precisa de pelo menos um porquê.');
      return;
    }
    const next = items.filter((candidate) => candidate.id !== item.id).map((candidate, index) => ({ ...candidate, level: index + 1 }));
    setItems(next);
    setSelectedId(next[0]?.id ?? null);
    handleSave(next, item.isRootCause ? '' : rootCause);
  }

  function markRootCause(item: WhyItem) {
    const next = items.map((candidate) => ({
      ...candidate,
      isRootCause: candidate.id === item.id,
      causeType: candidate.id === item.id ? ('ROOT_CAUSE' as CauseType) : candidate.causeType === 'ROOT_CAUSE' ? ('PROBABLE_CAUSE' as CauseType) : candidate.causeType,
      status: candidate.id === item.id ? ('ROOT_CAUSE' as WhyStatus) : candidate.status === 'ROOT_CAUSE' ? ('IN_REVIEW' as WhyStatus) : candidate.status,
    }));
    setItems(next);
    onRootCauseChange(item.answer);
    handleSave(next, item.answer);
  }

  function addEvidence() {
    const name = evidenceDraft.trim();
    if (!name || !selectedItem) return;
    const isUrl = /^https?:\/\//i.test(name);
    updateItem(selectedItem.id, { evidences: [...selectedItem.evidences, { id: newTempId(), name, url: isUrl ? name : undefined }] });
    setEvidenceDraft('');
  }

  function addRecommendedAction() {
    const title = actionDraft.trim();
    if (!title || !selectedItem) return;
    updateItem(selectedItem.id, { actions: [...selectedItem.actions, { id: newTempId(), title }] });
    setActionDraft('');
  }

  async function convertToAction(item: WhyItem) {
    if (!actionId) {
      toast.error('Salve a análise antes de transformar este porquê em ação.');
      return;
    }
    if (item.convertedToTaskId) return;
    try {
      await api(`/actions/${actionId}/analysis/five-whys/items/${item.level}/convert-to-action`, {
        method: 'POST',
        json: {
          title: `5 Porquês (nível ${item.level}): ${item.answer || item.question || action?.title || 'ação vinculada'}`,
          answer: item.answer,
          responsibleUserId: item.responsibleUserId || undefined,
          dueDate: item.dueDate || undefined,
          priority: item.priority,
          markRootCause: item.isRootCause,
        },
      });
      toast.success('Porquê transformado em tarefa do plano');
      setItems((current) => current.map((candidate) => (candidate.id === item.id ? { ...candidate, convertedToTaskId: 'pending-refresh', status: 'CONVERTED_TO_ACTION' } : candidate)));
      qc.invalidateQueries({ queryKey: ['action', actionId] });
    } catch (error: any) {
      toast.error(error?.message ?? 'Não foi possível transformar em ação');
    }
  }

  async function loadAiSuggestions() {
    if (!actionId) {
      setSuggestions(defaultSuggestions(problem, items));
      setSuggestionsOpen(true);
      return;
    }
    setLoadingAi(true);
    try {
      const out = await api<WhySuggestion[]>(`/actions/${actionId}/analysis/five-whys/ai-suggestions`, {
        method: 'POST',
        json: { items, problem },
      });
      setSuggestions(out.length ? out : defaultSuggestions(problem, items));
      setSuggestionsOpen(true);
    } catch (error: any) {
      toast.error(error?.message ?? 'Não foi possível gerar sugestões com IA');
      setSuggestions(defaultSuggestions(problem, items));
      setSuggestionsOpen(true);
    } finally {
      setLoadingAi(false);
    }
  }

  function acceptSuggestion(suggestion: WhySuggestion, editAfter = false) {
    const level = Math.max(1, Math.round(suggestion.level || 1));
    let next: WhyItem[];
    const existing = items.find((item) => item.level === level);
    if (existing) {
      next = items.map((item) =>
        item.level === level
          ? {
              ...item,
              question: suggestion.question || item.question,
              answer: suggestion.answer || item.answer,
              confidence: suggestion.confidence || item.confidence,
              isAiSuggested: true,
              status: item.status === 'PENDING' ? 'IN_REVIEW' : item.status,
            }
          : item,
      );
    } else {
      next = [...items, makeItem({ level, question: suggestion.question, answer: suggestion.answer, confidence: suggestion.confidence, isAiSuggested: true, status: 'IN_REVIEW' }, level, problem)]
        .sort((a, b) => a.level - b.level)
        .map((item, index) => ({ ...item, level: index + 1 }));
    }
    setItems(next);
    const target = next.find((item) => item.level === level);
    if (target) setSelectedId(target.id);
    setSuggestions((current) => current.filter((candidate) => candidate !== suggestion));
    handleSave(next);
    if (editAfter) setSuggestionsOpen(false);
  }

  function toggleNextStep(id: string) {
    const next = nextSteps.map((step) => (step.id === id ? { ...step, done: !step.done } : step));
    setNextSteps(next);
    handleSave(itemsRef.current, rootCause, next);
  }

  async function exportImage() {
    if (!boardRef.current) return;
    const dataUrl = await toPng(boardRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = `5-porques-${actionId ?? 'analise'}.png`;
    link.href = dataUrl;
    link.click();
  }

  function centerCanvas() {
    setZoom(1);
    scrollRef.current?.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={addWhy} disabled={!canEdit}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar porquê
          </Button>
          <Button size="sm" variant="outline" onClick={loadAiSuggestions} disabled={!canEdit || loadingAi}>
            <Sparkles className="mr-2 h-4 w-4" />
            {loadingAi ? 'Gerando...' : 'Sugestão com IA'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => selectedItem && setSelectedId(selectedItem.id)}>
            <Paperclip className="mr-2 h-4 w-4" />
            Evidências
          </Button>
          <Button size="sm" variant="outline" onClick={() => setChecklistOpen(true)}>
            <ListChecks className="mr-2 h-4 w-4" />
            Checklist
          </Button>
          <Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)}>
            <History className="mr-2 h-4 w-4" />
            Histórico
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportImage}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button size="icon" variant="outline" onClick={() => setZoom((value) => Math.max(0.7, value - 0.1))} title="Reduzir zoom">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="w-12 text-center text-xs font-medium text-slate-600">{Math.round(zoom * 100)}%</div>
          <Button size="icon" variant="outline" onClick={() => setZoom((value) => Math.min(1.25, value + 0.1))} title="Aumentar zoom">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={centerCanvas} title="Centralizar">
            <Maximize className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => handleSave()} disabled={!canEdit || saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar análise'}
          </Button>
        </div>
      </div>

      {!canEdit && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
          Você está em modo de visualização. Edição, conversão, evidências e marcação de causa raiz estão bloqueadas.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div ref={scrollRef} className="overflow-auto bg-slate-50 p-5">
          <div ref={boardRef} className="origin-top-left" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            <div className="mb-1 text-base font-semibold text-slate-900">Análise de causa raiz - 5 Porquês</div>
            <p className="mb-4 text-xs text-slate-500">Clique em cada porquê para ver detalhes, evidências e ações relacionadas.</p>

            <div className="flex items-stretch gap-1 overflow-x-auto pb-2">
              {items.map((item, index) => (
                <div key={item.id} className="flex items-stretch">
                  <WhyCard item={item} selected={item.id === selectedId} onSelect={() => setSelectedId(item.id)} />
                  {index < items.length - 1 && (
                    <div className="flex items-center px-1 text-slate-300">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard icon={Target} iconColor="#ef4444" title="Causa raiz identificada" value={rootItem?.answer || 'Causa raiz ainda não confirmada.'} />
              <SummaryCard icon={Layers} iconColor="#2563eb" title="Profundidade da análise" value={`${answeredCount} ${answeredCount === 1 ? 'nível respondido' : 'níveis de porquês respondidos'}`} badge={rootItem ? 'Causa raiz confirmada' : undefined} />
              <SummaryCard icon={ShieldCheck} iconColor="#16a34a" title="Confiança na causa raiz" value={rootItem ? `${confidenceLabel(rootItem.confidence)} (${rootItem.confidence}%)` : 'Defina a causa raiz'} />
              <SummaryCard icon={History} iconColor="#f59e0b" title="Status da análise" value={analysisStatusLabel(rootItem, answeredCount, baseAnswered)} />
            </div>

            {baseAnswered >= 5 && !rootItem && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4" /> A análise está completa, mas nenhuma causa raiz foi confirmada.
              </div>
            )}
            {baseAnswered < 5 && (
              <div className="mt-4 text-xs text-slate-500">Continue aprofundando a análise para chegar à causa raiz ({baseAnswered}/5 respondidos · {progress}%).</div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Legenda:</span>
              {CAUSE_TYPE_ORDER.map((type) => (
                <span key={type} className="inline-flex items-center gap-1.5">
                  {type === 'ROOT_CAUSE' ? <Star className="h-3 w-3" style={{ color: CAUSE_TYPE_META[type].dot }} /> : <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CAUSE_TYPE_META[type].dot }} />}
                  {CAUSE_TYPE_META[type].label}
                </span>
              ))}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Resumo da análise</div>
                <p className="mt-2 text-xs leading-5 text-slate-600">{buildSummaryText(items, rootItem, problem)}</p>
                {rootItem && <p className="mt-2 text-xs leading-5 text-slate-600"><span className="font-semibold">Recomendação:</span> {recommendationText(rootItem)}</p>}
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Próximos passos sugeridos</div>
                <div className="mt-2 space-y-2">
                  {nextSteps.map((step) => (
                    <label key={step.id} className="flex items-start gap-2 text-xs text-slate-700">
                      <input type="checkbox" className="mt-0.5" checked={step.done} disabled={!canEdit} onChange={() => toggleNextStep(step.id)} />
                      <span className={cn(step.done && 'text-slate-400 line-through')}>{step.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <WhyDrawer
          item={selectedItem}
          action={action}
          users={users}
          canEdit={canEdit}
          responsibleName={selectedItem?.responsibleUserId ? responsibleById.get(selectedItem.responsibleUserId) : undefined}
          evidenceDraft={evidenceDraft}
          actionDraft={actionDraft}
          onEvidenceDraft={setEvidenceDraft}
          onActionDraft={setActionDraft}
          onAddEvidence={addEvidence}
          onAddAction={addRecommendedAction}
          onUpdate={(patch) => selectedItem && updateItem(selectedItem.id, patch)}
          onSave={() => handleSave()}
          onMarkRoot={() => selectedItem && markRootCause(selectedItem)}
          onConvert={() => selectedItem && convertToAction(selectedItem)}
          onDelete={() => selectedItem && deleteWhy(selectedItem)}
          onShowHistory={() => setHistoryOpen(true)}
        />
      </div>

      <Dialog open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Sugestões dos 5 Porquês com IA</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
            {suggestions.length === 0 && <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhuma sugestão pendente.</div>}
            {suggestions.map((suggestion) => (
              <div key={`${suggestion.level}-${suggestion.question}`} className="rounded-lg border bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge variant="outline" className={levelSoft(suggestion.level)}>{ordinal(suggestion.level)} Porquê</Badge>
                  <span className="text-xs text-slate-400">Confiança {clampPercent(suggestion.confidence)}%</span>
                </div>
                <div className="text-sm font-semibold text-slate-900">{suggestion.question}</div>
                {suggestion.answer && <div className="mt-1 text-xs text-slate-700"><span className="font-medium">Resposta:</span> {suggestion.answer}</div>}
                <p className="mt-1 text-xs leading-5 text-slate-600">{suggestion.justification}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => acceptSuggestion(suggestion)} disabled={!canEdit}>Aceitar</Button>
                  <Button size="sm" variant="outline" onClick={() => acceptSuggestion(suggestion, true)} disabled={!canEdit}>Editar e aceitar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSuggestions((current) => current.filter((candidate) => candidate !== suggestion))}>Descartar</Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={checklistOpen} onOpenChange={setChecklistOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Checklist da análise</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {buildAnalysisChecklist(items, rootItem, problem).map((check) => (
              <div key={check.title} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                <CheckCircle2 className={cn('h-4 w-4', check.done ? 'text-green-600' : 'text-slate-300')} />
                <span className={cn(check.done ? 'text-slate-700' : 'text-slate-500')}>{check.title}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChecklistOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico da análise</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {(action?.history ?? []).length === 0 && <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Sem eventos registrados ainda.</div>}
            {(action?.history ?? []).slice(0, 30).map((event: any) => (
              <div key={event.id} className="rounded-lg border border-slate-200 p-3 text-xs">
                <div className="font-medium text-slate-700">{historyLabel(event.eventType)}</div>
                <div className="mt-0.5 text-slate-400">{formatDate(event.createdAt)}{event.field ? ` · ${event.field}` : ''}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WhyCard({ item, selected, onSelect }: { item: WhyItem; selected: boolean; onSelect: () => void }) {
  const color = levelColor(item.level);
  const cause = CAUSE_TYPE_META[item.causeType];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex w-[212px] flex-col rounded-xl border bg-white p-3 text-left shadow-sm transition hover:shadow-md',
        selected ? 'ring-2 ring-blue-200' : '',
        item.isRootCause ? 'border-red-300' : 'border-slate-200',
      )}
      style={{ borderTopColor: color, borderTopWidth: 3 }}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm" style={{ backgroundColor: color }}>
          {item.level}
        </span>
        <span className="text-sm font-semibold text-slate-800">Por quê?{item.level > 5 ? ' (adicional)' : ''}</span>
        {item.isAiSuggested && <span className="ml-auto text-[10px] font-semibold text-blue-600">IA</span>}
      </div>
      <p className="mt-3 min-h-[48px] text-xs leading-4 text-slate-500">{item.question || 'Defina a pergunta deste nível.'}</p>
      <div className="my-2 h-px bg-slate-100" />
      <p className="min-h-[60px] text-xs leading-4 text-slate-800">{item.answer || <span className="italic text-slate-400">Sem resposta</span>}</p>
      <div className="mt-3">
        <span className={cn('inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold', cause.soft)}>
          {item.isRootCause ? <Star className="h-3 w-3" /> : <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cause.dot }} />}
          {cause.short}
        </span>
      </div>
    </button>
  );
}

function SummaryCard({ icon: Icon, iconColor, title, value, badge }: { icon: any; iconColor: string; title: string; value: string; badge?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: iconColor }} />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-800">{title}</div>
          <div className="mt-0.5 line-clamp-3 text-xs text-slate-600">{value}</div>
          {badge && <Badge variant="outline" className="mt-1 border-emerald-200 bg-emerald-50 text-emerald-700">{badge}</Badge>}
        </div>
      </div>
    </div>
  );
}

function WhyDrawer({
  item,
  action,
  users,
  canEdit,
  responsibleName,
  evidenceDraft,
  actionDraft,
  onEvidenceDraft,
  onActionDraft,
  onAddEvidence,
  onAddAction,
  onUpdate,
  onSave,
  onMarkRoot,
  onConvert,
  onDelete,
  onShowHistory,
}: {
  item: WhyItem | null;
  action?: any;
  users: UserOption[];
  canEdit: boolean;
  responsibleName?: string;
  evidenceDraft: string;
  actionDraft: string;
  onEvidenceDraft: (value: string) => void;
  onActionDraft: (value: string) => void;
  onAddEvidence: () => void;
  onAddAction: () => void;
  onUpdate: (patch: Partial<WhyItem>) => void;
  onSave: () => void;
  onMarkRoot: () => void;
  onConvert: () => void;
  onDelete: () => void;
  onShowHistory: () => void;
}) {
  if (!item) {
    return (
      <aside className="border-l border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-900">Porquê selecionado</div>
        <p className="mt-2 text-sm text-slate-500">Selecione um card da sequência para editar pergunta, resposta, evidências e ações.</p>
      </aside>
    );
  }
  const color = levelColor(item.level);
  const shallow = isAnswered(item) && item.answer.trim().length < 15;
  return (
    <aside className="border-l border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 p-3">
        <div className="text-sm font-semibold text-slate-900">Porquê selecionado</div>
        <Badge variant="outline" style={{ borderColor: color, color }}>{ordinal(item.level)} Porquê</Badge>
      </div>
      <div className="max-h-[560px] space-y-3 overflow-y-auto p-3">
        <fieldset disabled={!canEdit} className="space-y-3">
          <div>
            <Label>Pergunta</Label>
            <Textarea rows={2} value={item.question} onChange={(event) => onUpdate({ question: event.target.value })} onBlur={onSave} />
          </div>
          <div>
            <Label>Resposta</Label>
            <Textarea rows={4} value={item.answer} onChange={(event) => onUpdate({ answer: event.target.value, status: item.status === 'PENDING' && event.target.value.trim() ? 'IN_REVIEW' : item.status })} onBlur={onSave} />
            {shallow && (
              <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-700">
                <AlertTriangle className="h-3 w-3" /> Resposta superficial. Considere detalhar melhor a causa.
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Tipo de causa</Label>
              <NativeSelect value={item.causeType} onChange={(event) => onUpdate({ causeType: event.target.value as CauseType, isRootCause: event.target.value === 'ROOT_CAUSE' })} onBlur={onSave}>
                {CAUSE_TYPE_ORDER.map((type) => <option key={type} value={type}>{CAUSE_TYPE_META[type].label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Status</Label>
              <NativeSelect value={item.status} onChange={(event) => onUpdate({ status: event.target.value as WhyStatus })} onBlur={onSave}>
                {Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div>
            <Label>Confiança na resposta · {item.confidence}%</Label>
            <input type="range" min={0} max={100} step={5} value={item.confidence} onChange={(event) => onUpdate({ confidence: clampPercent(event.target.value) })} onMouseUp={onSave} onTouchEnd={onSave} className="mt-1 w-full accent-blue-600" />
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${item.confidence}%`, backgroundColor: confidenceColor(item.confidence) }} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Responsável pela validação</Label>
              <NativeSelect value={item.responsibleUserId} onChange={(event) => onUpdate({ responsibleUserId: event.target.value })} onBlur={onSave}>
                <option value="">Sem responsável</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Prioridade</Label>
              <NativeSelect value={item.priority} onChange={(event) => onUpdate({ priority: event.target.value as Priority })} onBlur={onSave}>
                {Object.entries(PRIORITY_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div>
            <Label>Prazo</Label>
            <Input type="date" value={item.dueDate?.slice(0, 10) ?? ''} onChange={(event) => onUpdate({ dueDate: event.target.value })} onBlur={onSave} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={item.observations} onChange={(event) => onUpdate({ observations: event.target.value })} onBlur={onSave} />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Evidências vinculadas</Label>
              <span className="text-xs text-slate-400">{item.evidences.length}</span>
            </div>
            <div className="mt-1 space-y-1">
              {item.evidences.map((evidence) => (
                <div key={evidence.id} className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate text-slate-700">{evidence.name}</span>
                  {canEdit && (
                    <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => onUpdate({ evidences: item.evidences.filter((candidate) => candidate.id !== evidence.id) })} aria-label="Remover evidência">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input value={evidenceDraft} onChange={(event) => onEvidenceDraft(event.target.value)} placeholder="Nome do arquivo ou link" disabled={!canEdit} onKeyDown={(event) => event.key === 'Enter' && onAddEvidence()} />
              <Button size="sm" variant="outline" onClick={onAddEvidence} disabled={!canEdit}>Adicionar</Button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Ações recomendadas</Label>
              <span className="text-xs text-slate-400">{item.actions.length}</span>
            </div>
            <div className="mt-1 space-y-1">
              {item.actions.map((rec) => (
                <div key={rec.id} className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  <span className="min-w-0 flex-1 text-slate-700">{rec.title}</span>
                  {canEdit && (
                    <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => onUpdate({ actions: item.actions.filter((candidate) => candidate.id !== rec.id) })} aria-label="Remover ação">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input value={actionDraft} onChange={(event) => onActionDraft(event.target.value)} placeholder="Nova ação recomendada" disabled={!canEdit} onKeyDown={(event) => event.key === 'Enter' && onAddAction()} />
              <Button size="sm" variant="outline" onClick={onAddAction} disabled={!canEdit}>Adicionar</Button>
            </div>
          </div>
        </fieldset>

        <button type="button" onClick={onShowHistory} className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm transition hover:border-slate-300">
          <span className="flex items-center gap-2 font-medium text-slate-700"><History className="h-4 w-4 text-slate-500" />Histórico</span>
          <span className="text-xs text-blue-600">Ver histórico completo</span>
        </button>

        <div className="space-y-2 border-t border-slate-200 pt-4">
          <Button className="w-full justify-start bg-red-600 hover:bg-red-700" onClick={onMarkRoot} disabled={!canEdit}>
            <Star className="mr-2 h-4 w-4" />
            Marcar como causa raiz
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={onConvert} disabled={!canEdit || Boolean(item.convertedToTaskId)}>
            <Rocket className="mr-2 h-4 w-4" />
            {item.convertedToTaskId ? 'Convertido em ação' : 'Transformar em ação'}
          </Button>
          <Button variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700" onClick={onDelete} disabled={!canEdit}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir porquê
          </Button>
        </div>
      </div>
    </aside>
  );
}

// ---------- helpers ----------

function isAnswered(item: WhyItem) {
  return Boolean(item.question?.trim()) && Boolean(item.answer?.trim());
}

function confidenceLabel(value: number) {
  if (value >= 70) return 'Alta';
  if (value >= 40) return 'Média';
  return 'Baixa';
}

function confidenceColor(value: number) {
  if (value >= 70) return '#16a34a';
  if (value >= 40) return '#f59e0b';
  return '#ef4444';
}

function analysisStatusLabel(rootItem: WhyItem | null, answeredCount: number, baseAnswered: number) {
  if (answeredCount === 0) return 'Não iniciada';
  if (rootItem) return baseAnswered >= 5 ? 'Causa raiz confirmada' : 'Causa raiz definida';
  return 'Em análise';
}

function buildSummaryText(items: WhyItem[], rootItem: WhyItem | null, problem: string) {
  const base = problem?.trim() ? `Para o problema "${problem.trim()}", ` : '';
  if (rootItem) {
    return `${base}a análise dos 5 porquês identificou a causa raiz relacionada a "${rootItem.answer}", impactando diretamente o controle do processo e resultando no desvio observado.`;
  }
  const answered = items.filter(isAnswered).length;
  return `${base}a análise possui ${answered} ${answered === 1 ? 'porquê respondido' : 'porquês respondidos'} e ainda não confirmou uma causa raiz. Continue encadeando os porquês até chegar à causa acionável.`;
}

function recommendationText(rootItem: WhyItem) {
  if (rootItem.actions.length) return rootItem.actions.map((action) => action.title).join('; ') + '.';
  return `Tratar a causa raiz "${rootItem.answer}" com ação preventiva e validar a eficácia após a implementação.`;
}

function buildAnalysisChecklist(items: WhyItem[], rootItem: WhyItem | null, problem: string) {
  const answered = (level: number) => items.some((item) => item.level === level && isAnswered(item));
  const hasEvidence = items.some((item) => item.evidences.length || item.evidence?.trim());
  const hasRecommended = items.some((item) => item.actions.length);
  const hasConverted = items.some((item) => item.convertedToTaskId);
  return [
    { title: 'Problema principal definido', done: Boolean(problem?.trim()) },
    { title: 'Primeiro porquê respondido', done: answered(1) },
    { title: 'Segundo porquê respondido', done: answered(2) },
    { title: 'Terceiro porquê respondido', done: answered(3) },
    { title: 'Quarto porquê respondido', done: answered(4) },
    { title: 'Quinto porquê respondido', done: answered(5) },
    { title: 'Evidências anexadas', done: hasEvidence },
    { title: 'Causa raiz marcada', done: Boolean(rootItem) },
    { title: 'Ação recomendada criada', done: hasRecommended },
    { title: 'Plano de ação vinculado', done: hasConverted },
  ];
}

function defaultNextSteps(): ChecklistItem[] {
  return [
    { id: 'ns-1', title: 'Criar plano de ação para tratar a causa raiz', done: false },
    { id: 'ns-2', title: 'Definir responsáveis e prazos para execução', done: false },
    { id: 'ns-3', title: 'Validar eficácia após implementação', done: false },
  ];
}

function normalizeItems(rows: any[] | undefined, problem: string): WhyItem[] {
  const source = Array.isArray(rows) && rows.length ? rows.slice() : [];
  source.sort((a, b) => Number(a.level ?? a.position ?? 0) - Number(b.level ?? b.position ?? 0));
  const items = source.map((row, index) => makeItem(row, Number(row.level ?? row.position ?? index + 1), problem));
  // garante os 5 níveis padrão
  for (let level = items.length + 1; level <= 5; level += 1) {
    items.push(makeItem(undefined, level, problem));
  }
  return items.map((item, index) => ({ ...item, level: index + 1 }));
}

function makeItem(row: any, level: number, problem: string): WhyItem {
  const defaultQuestion = level === 1 ? (problem?.trim() ? `Por que "${problem.trim()}" ocorreu?` : 'Por que o problema ocorreu?') : 'Por quê?';
  return {
    id: typeof row?.id === 'string' && row.id ? row.id : `${level}-${newTempId()}`,
    level,
    question: typeof row?.question === 'string' ? row.question : defaultQuestion,
    answer: typeof row?.answer === 'string' ? row.answer : '',
    causeType: normalizeCauseType(row?.causeType, row?.isRootCause),
    confidence: clampPercent(row?.confidence ?? 60),
    status: normalizeStatus(row?.status, row?.isRootCause),
    responsibleUserId: row?.responsibleUserId ?? '',
    dueDate: row?.dueDate ?? '',
    priority: normalizePriority(row?.priority),
    observations: typeof row?.observations === 'string' ? row.observations : '',
    evidence: typeof row?.evidence === 'string' ? row.evidence : '',
    evidences: Array.isArray(row?.evidences) ? row.evidences.map((evidence: any, index: number) => ({ id: evidence?.id ?? `ev-${index}`, name: String(evidence?.name ?? evidence?.fileName ?? evidence ?? '').trim(), url: evidence?.url })).filter((evidence: WhyEvidence) => evidence.name) : [],
    actions: Array.isArray(row?.actions) ? row.actions.map((rec: any, index: number) => ({ id: rec?.id ?? `ac-${index}`, title: String(rec?.title ?? rec ?? '').trim() })).filter((rec: WhyAction) => rec.title) : [],
    isRootCause: Boolean(row?.isRootCause),
    isAiSuggested: Boolean(row?.isAiSuggested),
    convertedToTaskId: row?.convertedToTaskId ?? null,
  };
}

function normalizeChecklist(value: any): ChecklistItem[] | null {
  if (!Array.isArray(value)) return null;
  const list = value
    .map((item, index) => ({ id: typeof item?.id === 'string' && item.id ? item.id : `ns-${index + 1}`, title: typeof item?.title === 'string' ? item.title : String(item ?? ''), done: Boolean(item?.done) }))
    .filter((item) => item.title);
  return list.length ? list : null;
}

function defaultSuggestions(problem: string, items: WhyItem[]): WhySuggestion[] {
  const answered = items.filter(isAnswered).length;
  const last = [...items].reverse().find(isAnswered);
  const base = last?.answer?.trim() || problem?.trim() || 'o problema identificado';
  const out: WhySuggestion[] = [];
  const start = Math.max(1, answered + 1);
  for (let level = start; level <= 5; level += 1) {
    out.push({
      level,
      question: level === 1 ? `Por que "${base}" aconteceu?` : `Por que a causa do nível ${level - 1} ocorre?`,
      answer: '',
      justification: 'Encadeie a pergunta à resposta anterior, baseando-se em fatos e evidências, até atingir uma causa acionável.',
      confidence: 60,
    });
  }
  return out.length ? out : [{ level: answered, question: 'Revise o último porquê e confirme se já é uma causa raiz acionável.', answer: '', justification: 'Verifique se a causa é controlável pela área e suportada por evidências.', confidence: 65 }];
}

function normalizeCauseType(value: any, isRootCause?: boolean): CauseType {
  if (isRootCause) return 'ROOT_CAUSE';
  const key = normalizeKey(value);
  const map: Record<string, CauseType> = {
    IDENTIFIED_CAUSE: 'IDENTIFIED_CAUSE',
    CAUSA_IDENTIFICADA: 'IDENTIFIED_CAUSE',
    PROBABLE_CAUSE: 'PROBABLE_CAUSE',
    CAUSA_PROVAVEL: 'PROBABLE_CAUSE',
    ROOT_CAUSE: 'ROOT_CAUSE',
    CAUSA_RAIZ: 'ROOT_CAUSE',
    DISCARDED: 'DISCARDED',
    DESCARTADA: 'DISCARDED',
    RECOMMENDED_ACTION: 'RECOMMENDED_ACTION',
    ACAO_RECOMENDADA: 'RECOMMENDED_ACTION',
  };
  return map[key] ?? 'IDENTIFIED_CAUSE';
}

function normalizeStatus(value: any, isRootCause?: boolean): WhyStatus {
  if (isRootCause) return 'ROOT_CAUSE';
  const key = normalizeKey(value);
  const map: Record<string, WhyStatus> = {
    PENDING: 'PENDING',
    PENDENTE: 'PENDING',
    IN_REVIEW: 'IN_REVIEW',
    EM_ANALISE: 'IN_REVIEW',
    VALIDATED: 'VALIDATED',
    VALIDADO: 'VALIDATED',
    ROOT_CAUSE: 'ROOT_CAUSE',
    CAUSA_RAIZ: 'ROOT_CAUSE',
    DISCARDED: 'DISCARDED',
    DESCARTADO: 'DISCARDED',
    CONVERTED_TO_ACTION: 'CONVERTED_TO_ACTION',
    CONVERTIDO_EM_ACAO: 'CONVERTED_TO_ACTION',
  };
  return map[key] ?? 'PENDING';
}

function normalizePriority(value: any): Priority {
  const key = normalizeKey(value);
  if (key === 'LOW' || key === 'BAIXA') return 'LOW';
  if (key === 'HIGH' || key === 'ALTA') return 'HIGH';
  if (key === 'CRITICAL' || key === 'CRITICA') return 'CRITICAL';
  return 'MEDIUM';
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

function clampPercent(value: any) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function ordinal(level: number) {
  return `${level}º`;
}

function historyLabel(eventType: string) {
  const map: Record<string, string> = {
    ANALYSIS_SAVED: 'Análise salva',
    AI_FIVE_WHYS_SUGGESTIONS: 'Sugestões de IA geradas',
    FIVE_WHYS_CONVERTED_TO_TASK: 'Porquê convertido em ação',
    UPDATE: 'Plano atualizado',
    CREATE: 'Plano criado',
    STATUS: 'Status alterado',
    TASK_CREATED: 'Tarefa criada',
  };
  return map[eventType] ?? eventType;
}

function newTempId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `temp-${crypto.randomUUID()}`;
  return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
