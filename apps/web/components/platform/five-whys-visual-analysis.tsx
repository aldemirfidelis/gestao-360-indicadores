'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
  Download,
  Lock,
  Plus,
  Rocket,
  Save,
  Sparkles,
  Star,
  Target,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

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

const CONFIDENCE_OPTIONS = [
  { value: 30, label: 'Baixa confiança' },
  { value: 60, label: 'Confiança média' },
  { value: 85, label: 'Alta confiança' },
];

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
  const itemsRef = useRef<WhyItem[]>([]);
  const [items, setItems] = useState<WhyItem[]>(() => normalizeItems(session?.data?.items ?? session?.fiveWhys, problem));
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<WhySuggestion[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    setItems(normalizeItems(session?.data?.items ?? session?.fiveWhys, problem));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.updatedAt]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const rootItem = items.find((item) => item.isRootCause) ?? null;
  const answeredCount = items.filter(isAnswered).length;
  const baseAnswered = items.filter((item) => item.level <= 5 && isAnswered(item)).length;
  const progress = Math.round((Math.min(baseAnswered, 5) / 5) * 100);
  // Índice do primeiro porquê ainda não respondido (bloco "ativo").
  const currentIndex = items.findIndex((item) => !isAnswered(item));

  const handleSave = useCallback(
    (nextItems = itemsRef.current, nextRootCause = rootCause) => {
      onSave(nextItems, nextRootCause);
      setLastSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    },
    [onSave, rootCause],
  );

  // Edição de texto (pergunta/resposta) — salva no blur.
  function updateItem(id: string, patch: Partial<WhyItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  // Confirma campos de seleção/data já salvando (evita onChange não disparar em valor pré-selecionado).
  function commitItem(id: string, patch: Partial<WhyItem>, nextRootCause = rootCause) {
    const next = itemsRef.current.map((item) => (item.id === id ? { ...item, ...patch } : item));
    setItems(next);
    handleSave(next, nextRootCause);
  }

  function addWhy() {
    const level = items.length + 1;
    const last = items[items.length - 1];
    const next = [...items, makeItem({ level, question: last && isAnswered(last) ? `Por que "${last.answer}" ocorre?` : 'Por quê?' }, level, problem)];
    setItems(next);
    handleSave(next);
  }

  function toggleRootCause(item: WhyItem) {
    const willBeRoot = !item.isRootCause;
    const next = items.map((candidate) => ({
      ...candidate,
      isRootCause: candidate.id === item.id ? willBeRoot : false,
      causeType:
        candidate.id === item.id
          ? willBeRoot
            ? ('ROOT_CAUSE' as CauseType)
            : ('PROBABLE_CAUSE' as CauseType)
          : candidate.causeType === 'ROOT_CAUSE'
            ? ('PROBABLE_CAUSE' as CauseType)
            : candidate.causeType,
      status:
        candidate.id === item.id
          ? willBeRoot
            ? ('ROOT_CAUSE' as WhyStatus)
            : ('IN_REVIEW' as WhyStatus)
          : candidate.status === 'ROOT_CAUSE'
            ? ('IN_REVIEW' as WhyStatus)
            : candidate.status,
    }));
    setItems(next);
    const nextRootCause = willBeRoot ? item.answer : '';
    onRootCauseChange(nextRootCause);
    handleSave(next, nextRootCause);
  }

  async function convertToAction(item: WhyItem) {
    if (!actionId) {
      toast.error('Salve a análise antes de transformar a causa raiz em ação.');
      return;
    }
    if (item.convertedToTaskId) return;
    setConverting(true);
    try {
      handleSave(items, item.answer);
      await api(`/actions/${actionId}/analysis/five-whys/items/${item.level}/convert-to-action`, {
        method: 'POST',
        json: {
          title: `Causa raiz (5 Porquês): ${item.answer || item.question || action?.title || 'ação vinculada'}`,
          answer: item.answer,
          responsibleUserId: item.responsibleUserId || undefined,
          dueDate: item.dueDate || undefined,
          priority: item.priority,
          markRootCause: true,
        },
      });
      toast.success('Causa raiz transformada em tarefa do plano');
      setItems((current) => current.map((candidate) => (candidate.id === item.id ? { ...candidate, convertedToTaskId: 'pending-refresh', status: 'CONVERTED_TO_ACTION' } : candidate)));
      qc.invalidateQueries({ queryKey: ['action', actionId] });
    } catch (error: any) {
      toast.error(error?.message ?? 'Não foi possível transformar em ação');
    } finally {
      setConverting(false);
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
    setSuggestions((current) => current.filter((candidate) => candidate !== suggestion));
    handleSave(next);
    if (editAfter) setSuggestionsOpen(false);
  }

  async function exportImage() {
    if (!boardRef.current) return;
    const dataUrl = await toPng(boardRef.current, { backgroundColor: '#f8fafc', pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = `5-porques-${actionId ?? 'analise'}.png`;
    link.href = dataUrl;
    link.click();
  }

  const responsibleById = new Map(users.map((user) => [user.id, user.name]));

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={addWhy} disabled={!canEdit}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar porquê
          </Button>
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
          Você está em modo de visualização. Edição, marcação de causa raiz e conversão estão bloqueadas.
        </div>
      )}

      <div className="bg-slate-50 p-4">
        <div className="mb-4 text-center">
          <div className="text-lg font-bold tracking-tight text-slate-900">5 Porquês</div>
          <div className="text-xs font-medium text-slate-500">
            Responda um porquê por vez; o próximo libera ao responder o anterior. Marque a causa raiz quando chegar a uma causa acionável.
          </div>
        </div>

        <div ref={boardRef} className="mx-auto max-w-3xl space-y-2">
          {items.map((item, index) => {
            const answered = isAnswered(item);
            const active = index === currentIndex;
            const locked = currentIndex !== -1 && index > currentIndex;
            return (
              <div key={item.id}>
                <WhyBlock
                  item={item}
                  index={index}
                  answered={answered}
                  active={active}
                  locked={locked}
                  isLast={index === items.length - 1}
                  canEdit={canEdit}
                  converting={converting}
                  users={users}
                  responsibleName={item.responsibleUserId ? responsibleById.get(item.responsibleUserId) : undefined}
                  onQuestion={(value) => updateItem(item.id, { question: value })}
                  onAnswer={(value) => updateItem(item.id, { answer: value, status: item.status === 'PENDING' && value.trim() ? 'IN_REVIEW' : item.status })}
                  onCommit={(patch) => commitItem(item.id, patch)}
                  onBlurSave={() => handleSave()}
                  onToggleRoot={() => toggleRootCause(item)}
                  onConvert={() => convertToAction(item)}
                />
                {index < items.length - 1 && (
                  <div className="flex justify-center py-0.5 text-slate-300">
                    <ArrowDown className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {baseAnswered >= 5 && !rootItem && (
          <div className="mx-auto mt-4 flex max-w-3xl items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
            <AlertTriangle className="h-4 w-4" /> Análise completa, mas nenhuma causa raiz foi confirmada. Marque o porquê que representa a causa acionável.
          </div>
        )}
      </div>

      <FiveWhysFooter
        rootItem={rootItem}
        answered={answeredCount}
        progress={progress}
        converting={converting}
        canEdit={canEdit}
        onConvert={() => rootItem && convertToAction(rootItem)}
        saving={saving}
        lastSavedAt={lastSavedAt}
      />

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
    </div>
  );
}

/**
 * Bloco do 5 Porquês com edição inline. O usuário digita pergunta e resposta direto no card;
 * o próximo nível só libera quando o anterior é respondido. Ao marcar a causa raiz, o bloco
 * libera responsável/prazo e o botão para transformar a causa em ação no plano.
 */
function WhyBlock({
  item,
  index,
  answered,
  active,
  locked,
  isLast,
  canEdit,
  converting,
  users,
  responsibleName,
  onQuestion,
  onAnswer,
  onCommit,
  onBlurSave,
  onToggleRoot,
  onConvert,
}: {
  item: WhyItem;
  index: number;
  answered: boolean;
  active: boolean;
  locked: boolean;
  isLast: boolean;
  canEdit: boolean;
  converting: boolean;
  users: UserOption[];
  responsibleName?: string;
  onQuestion: (value: string) => void;
  onAnswer: (value: string) => void;
  onCommit: (patch: Partial<WhyItem>) => void;
  onBlurSave: () => void;
  onToggleRoot: () => void;
  onConvert: () => void;
}) {
  const color = levelColor(item.level);
  const isRoot = item.isRootCause;
  const statusLabel = isRoot ? 'Causa raiz' : answered ? 'Respondido' : active ? 'Respondendo' : 'Pendente';
  const statusClass = isRoot
    ? 'border-red-200 bg-red-50 text-red-700'
    : answered
      ? 'border-green-200 bg-green-50 text-green-700'
      : active
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-slate-200 bg-slate-100 text-slate-500';
  const shallow = answered && item.answer.trim().length < 15;
  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-4 shadow-sm transition',
        active && 'ring-2 ring-blue-200',
        locked && 'opacity-60',
        isRoot && 'border-red-300',
      )}
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm" style={{ backgroundColor: answered || active ? color : '#cbd5e1' }}>
            {isRoot ? <Star className="h-4 w-4" /> : item.level}
          </span>
          <div>
            <div className="text-sm font-bold leading-4 text-slate-800">{ordinal(item.level)} Por quê?{item.level > 5 ? ' (adicional)' : ''}</div>
            <div className="text-[11px] font-medium text-slate-500">{index === 0 ? 'Por que o problema ocorre' : 'Por que a causa anterior acontece'}</div>
          </div>
        </div>
        {locked ? <Lock className="h-4 w-4 text-slate-300" /> : <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold', statusClass)}>{statusLabel}</span>}
      </div>

      {locked ? (
        <p className="mt-3 text-xs text-slate-400">Responda o porquê anterior para liberar este nível.</p>
      ) : (
        <fieldset disabled={!canEdit} className="mt-3 space-y-2">
          <div>
            <Label className="text-[11px] text-slate-500">Pergunta</Label>
            <Textarea rows={2} value={item.question} placeholder="Por quê?" onChange={(event) => onQuestion(event.target.value)} onBlur={onBlurSave} className="text-sm" />
          </div>
          <div>
            <Label className="text-[11px] text-slate-500">Resposta (causa)</Label>
            <Textarea rows={2} value={item.answer} placeholder="Descreva a causa identificada neste nível..." onChange={(event) => onAnswer(event.target.value)} onBlur={onBlurSave} className="text-sm" />
            {shallow && (
              <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-700">
                <AlertTriangle className="h-3 w-3" /> Resposta superficial. Considere detalhar melhor a causa.
              </div>
            )}
          </div>

          {answered && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                variant={isRoot ? 'default' : 'outline'}
                className={cn('h-8', isRoot ? 'bg-red-600 hover:bg-red-700' : 'text-red-600')}
                onClick={onToggleRoot}
                disabled={!canEdit}
              >
                <Star className="mr-2 h-3.5 w-3.5" />
                {isRoot ? 'É a causa raiz' : 'Marcar como causa raiz'}
              </Button>
              <div className="min-w-[160px] flex-1">
                <NativeSelect value={item.confidence} onChange={(event) => onCommit({ confidence: clampPercent(event.target.value) })} className="h-8 text-xs">
                  {CONFIDENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </NativeSelect>
              </div>
            </div>
          )}

          {isRoot && (
            <div className="mt-2 space-y-2 rounded-lg border border-red-100 bg-red-50/60 p-3">
              <div className="text-[11px] font-semibold text-red-700">Tratar a causa raiz</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-[11px] text-slate-500">Responsável</Label>
                  <NativeSelect value={item.responsibleUserId} onChange={(event) => onCommit({ responsibleUserId: event.target.value })} className="h-9 text-sm">
                    <option value="">Selecione...</option>
                    {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                  </NativeSelect>
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Prazo</Label>
                  <Input type="date" value={item.dueDate?.slice(0, 10) ?? ''} onChange={(event) => onCommit({ dueDate: event.target.value })} className="h-9 text-sm" />
                </div>
              </div>
              <Button
                className="w-full justify-center bg-emerald-600 hover:bg-emerald-700"
                onClick={onConvert}
                disabled={!canEdit || converting || Boolean(item.convertedToTaskId)}
              >
                <Rocket className="mr-2 h-4 w-4" />
                {item.convertedToTaskId ? 'Causa raiz já vinculada ao plano' : converting ? 'Gerando...' : 'Transformar causa raiz em ação'}
              </Button>
            </div>
          )}
        </fieldset>
      )}

      {isLast && !locked && !answered && (
        <p className="mt-2 text-[11px] text-slate-400">Responda este nível para liberar um novo porquê (se ainda não for a causa raiz).</p>
      )}
    </div>
  );
}

function FiveWhysFooter({
  rootItem,
  answered,
  progress,
  converting,
  canEdit,
  onConvert,
  saving,
  lastSavedAt,
}: {
  rootItem: WhyItem | null;
  answered: number;
  progress: number;
  converting: boolean;
  canEdit: boolean;
  onConvert: () => void;
  saving: boolean;
  lastSavedAt: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600">
      <div className="flex items-start gap-2">
        <Target className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
        <div className="min-w-0">
          <div className="font-semibold text-slate-800">Causa raiz</div>
          <div className="max-w-[420px] truncate">{rootItem?.answer || 'Ainda não confirmada'}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-right">
          <div className="font-semibold text-slate-800">{progress}%</div>
          <div>{answered} respondido(s) · {saving ? 'Salvando...' : lastSavedAt ? `Salvo às ${lastSavedAt}` : 'Não salvo'}</div>
        </div>
        {rootItem && !rootItem.convertedToTaskId && (
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={onConvert} disabled={!canEdit || converting}>
            <Rocket className="mr-2 h-4 w-4" />
            {converting ? 'Gerando...' : 'Gerar ação'}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------- helpers ----------

function isAnswered(item: WhyItem) {
  return Boolean(item.question?.trim()) && Boolean(item.answer?.trim());
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

function newTempId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `temp-${crypto.randomUUID()}`;
  return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
