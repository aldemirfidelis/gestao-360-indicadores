'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Download, Lightbulb, Plus, Save, Trash2 } from 'lucide-react';
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

const CATEGORIES = [
  { key: 'METHOD', label: 'Método', color: '#2563eb', soft: 'bg-blue-50 text-blue-700 border-blue-200', icon: '⚙', hint: 'Processos, procedimentos, instruções de trabalho e fluxo. Ex.: falta de padrão, etapa fora de sequência.' },
  { key: 'MACHINE', label: 'Máquina', color: '#16a34a', soft: 'bg-green-50 text-green-700 border-green-200', icon: '●', hint: 'Equipamentos, ferramentas, manutenção e calibração. Ex.: máquina descalibrada, parada não planejada.' },
  { key: 'MANPOWER', label: 'Mão de obra', color: '#f97316', soft: 'bg-orange-50 text-orange-700 border-orange-200', icon: '▣', hint: 'Pessoas: treinamento, habilidade, comunicação e turno. Ex.: falta de treinamento, sobrecarga.' },
  { key: 'MATERIAL', label: 'Material', color: '#7c3aed', soft: 'bg-violet-50 text-violet-700 border-violet-200', icon: '◇', hint: 'Insumos, matéria-prima, fornecedores e especificação. Ex.: lote fora do padrão, material vencido.' },
  { key: 'ENVIRONMENT', label: 'Meio ambiente', color: '#0f766e', soft: 'bg-teal-50 text-teal-700 border-teal-200', icon: '◒', hint: 'Ambiente físico: temperatura, ruído, layout e clima. Ex.: umidade alta, espaço inadequado.' },
  { key: 'MEASUREMENT', label: 'Medição', color: '#f59e0b', soft: 'bg-amber-50 text-amber-700 border-amber-200', icon: '◈', hint: 'Medições, instrumentos, critérios e coleta de dados. Ex.: instrumento sem aferição, critério ambíguo.' },
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
  // Mantido por compatibilidade (a marcação de causa raiz acontece nos 5 Porquês).
  onRootCauseChange?: (value: string) => void;
  onSendToFiveWhys?: (text: string) => void;
  onSave: (causes: IshikawaCause[], rootCause?: string) => void;
}) {
  const qc = useQueryClient();
  const boardRef = useRef<HTMLDivElement | null>(null);
  const causesRef = useRef<IshikawaCause[]>([]);
  const [causes, setCauses] = useState<IshikawaCause[]>(() => normalizeCauses(session?.ishikawaCauses));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({ category: 'METHOD', title: '' });
  const [tipsOpen, setTipsOpen] = useState(false);
  const [tips, setTips] = useState<Suggestion[]>([]);
  const [loadingTips, setLoadingTips] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const next = normalizeCauses(session?.ishikawaCauses);
    setCauses(next);
    setSelectedId((current) => (current && next.some((cause) => cause.id === current) ? current : null));
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
    handleSave(next);
  }

  function deleteCause(cause: IshikawaCause) {
    if (cause.convertedToTaskId && !window.confirm('Esta causa já foi convertida em tarefa. Deseja remover mesmo assim?')) return;
    const next = causes.filter((item) => item.id !== cause.id);
    setCauses(next);
    setSelectedId(next[0]?.id ?? null);
    handleSave(next, rootCause === cause.title ? '' : rootCause);
  }

  // "Dicas de IA": tutorial de preenchimento + exemplos de causas (quando a IA está disponível).
  async function loadTips() {
    setTipsOpen(true);
    if (!actionId) return;
    setLoadingTips(true);
    try {
      const out = await api<Suggestion[]>(`/actions/${actionId}/analysis/ishikawa/ai-suggestions`, {
        method: 'POST',
        json: { problem, causes },
      });
      setTips(Array.isArray(out) ? out : []);
    } catch {
      setTips([]);
    } finally {
      setLoadingTips(false);
    }
  }

  function addTipAsCause(item: Suggestion) {
    const nextCause = makeCause({ category: item.category, title: item.title, description: item.justification, priority: item.priority, orderIndex: causes.length, isAiSuggested: true });
    const next = [...causes, nextCause];
    setCauses(next);
    setSelectedId(nextCause.id);
    setTips((current) => current.filter((candidate) => candidate !== item));
    handleSave(next);
  }

  async function exportImage() {
    if (!boardRef.current) return;
    const dataUrl = await toPng(boardRef.current, { backgroundColor: '#f8fafc', pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = `ishikawa-${actionId ?? 'analise'}.png`;
    link.href = dataUrl;
    link.click();
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => openAdd()} disabled={!canEdit}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar causa
          </Button>
          <Button size="sm" variant="outline" onClick={loadTips}>
            <Lightbulb className="mr-2 h-4 w-4" />
            {loadingTips ? 'Carregando...' : 'Dicas de IA'}
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
          Você está em modo de visualização. Criação, edição e conversão de causas estão bloqueadas.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div ref={boardRef} className="max-h-[600px] overflow-auto bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm">
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Efeito</span>
            <span className="font-semibold text-red-900">{problem?.trim() || 'Defina o problema principal acima'}</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {CATEGORIES.map((category) => {
              const list = causesByCategory.get(category.key) ?? [];
              return (
                <div key={category.key} className="flex flex-col rounded-lg border border-slate-200 bg-white">
                  <div className={cn('flex items-center gap-2 rounded-t-lg border-b px-3 py-2 text-sm font-semibold', category.soft)}>
                    <span aria-hidden>{category.icon}</span>
                    {category.label}
                    <span className="ml-auto rounded-full bg-white/70 px-1.5 text-[11px] font-bold">{list.length}</span>
                  </div>
                  <div className="flex-1 space-y-2 p-2">
                    {list.map((cause) => (
                      <CauseCardInline
                        key={cause.id}
                        cause={cause}
                        color={category.color}
                        selected={cause.id === selectedId}
                        onSelect={() => setSelectedId(cause.id)}
                      />
                    ))}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openAdd(category.key)}
                        className="w-full rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-blue-300 hover:text-blue-700"
                      >
                        + Adicionar causa
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <CauseDrawer
          cause={selectedCause}
          canEdit={canEdit}
          onUpdate={(patch) => selectedCause && updateCause(selectedCause.id, patch)}
          onSave={() => handleSave()}
          onDelete={() => selectedCause && deleteCause(selectedCause)}
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
              <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} autoFocus onKeyDown={(e) => e.key === 'Enter' && addCause()} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={addCause}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tipsOpen} onOpenChange={setTipsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Dicas de IA — como preencher o Ishikawa</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm leading-6 text-slate-700">
              O <strong>Diagrama de Ishikawa</strong> (espinha de peixe) organiza as <strong>possíveis causas</strong> de um problema (o “efeito”)
              em <strong>6 categorias (6M)</strong>. Passo a passo:
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Confirme o <strong>problema/efeito</strong> (já vem do indicador/desvio).</li>
                <li>Em cada categoria, faça um <strong>brainstorm</strong> de causas possíveis (clique em “+ Adicionar causa”).</li>
                <li>Pergunte <em>“por que isso acontece?”</em> para chegar a causas reais — sem se prender ao sintoma.</li>
                <li>Selecione a causa mais provável e clique em <strong>“Investigar nos 5 Porquês”</strong> para chegar à causa raiz.</li>
              </ol>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {CATEGORIES.map((category) => (
                <div key={category.key} className="rounded-lg border bg-white p-3">
                  <div className={cn('mb-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold', category.soft)}>
                    <span aria-hidden>{category.icon}</span>{category.label}
                  </div>
                  <p className="text-xs leading-5 text-slate-600">{category.hint}</p>
                </div>
              ))}
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-800">Ideias da IA para este problema</div>
              {loadingTips && <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Gerando ideias com IA...</div>}
              {!loadingTips && tips.length === 0 && (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  {actionId ? 'Sem ideias específicas no momento — use o tutorial acima para preencher.' : 'Salve a análise para a IA sugerir exemplos de causas para este problema.'}
                </div>
              )}
              <div className="grid gap-2 md:grid-cols-2">
                {tips.map((item) => {
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
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => addTipAsCause(item)}>
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
            <Button variant="ghost" onClick={() => setTipsOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Card de causa inline (na coluna da categoria). Redimensionável verticalmente para acomodar
 * textos longos. Clicar seleciona a causa para edição no painel lateral.
 */
function CauseCardInline({ cause, color, selected, onSelect }: { cause: IshikawaCause; color: string; selected: boolean; onSelect: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect();
      }}
      className={cn(
        'min-h-[58px] resize-y overflow-auto rounded-md border bg-white p-2.5 text-left shadow-sm transition',
        selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-md',
        cause.isRootCause && 'border-emerald-500 ring-2 ring-emerald-100',
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold leading-4 text-slate-900">{cause.title}</div>
          {cause.description?.trim() && <div className="mt-1 text-[11px] leading-4 text-slate-600">{cause.description}</div>}
          <div className="mt-1.5 flex flex-wrap gap-1">
            <PriorityBadge priority={cause.priority} />
            {cause.isAiSuggested && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">IA</Badge>}
            {cause.isRootCause && <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Causa raiz</Badge>}
            {cause.convertedToTaskId && <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">Plano criado</Badge>}
          </div>
        </div>
      </div>
    </div>
  );
}

function CauseDrawer({
  cause,
  canEdit,
  onUpdate,
  onSave,
  onDelete,
  onSendToFiveWhys,
}: {
  cause: IshikawaCause | null;
  canEdit: boolean;
  onUpdate: (patch: Partial<IshikawaCause>) => void;
  onSave: () => void;
  onDelete: () => void;
  onSendToFiveWhys?: () => void;
}) {
  if (!cause) {
    return (
      <aside className="border-l border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-900">Causa selecionada</div>
        <p className="mt-2 text-sm text-slate-500">Clique em uma causa para editar nome, categoria, prioridade e descrição.</p>
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
            <Textarea rows={5} value={cause.description ?? ''} onChange={(event) => onUpdate({ description: event.target.value })} onBlur={onSave} />
          </div>
        </fieldset>

        <div className="space-y-2 border-t border-slate-200 pt-4">
          {onSendToFiveWhys && (
            <Button className="w-full justify-start bg-emerald-600 hover:bg-emerald-700" onClick={onSendToFiveWhys} disabled={!canEdit}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Investigar nos 5 Porquês
            </Button>
          )}
          <Button variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700" onClick={onDelete} disabled={!canEdit}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir causa
          </Button>
        </div>
      </div>
    </aside>
  );
}

function Legend({ saving, lastSavedAt }: { saving: boolean; lastSavedAt: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600">
      <span className="font-semibold text-slate-800">Legenda:</span>
      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Alta prioridade</span>
      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-400" />Média prioridade</span>
      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-green-500" />Baixa prioridade</span>
      <span className="ml-auto text-slate-400">{saving ? 'Salvando automaticamente...' : lastSavedAt ? `Salvo às ${lastSavedAt}` : 'Arraste o canto do card para redimensionar'}</span>
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

// ---------- helpers ----------

function normalizeCauses(rows: any[] | undefined): IshikawaCause[] {
  const source = rows?.length ? rows : [];
  return source.map((row: any, index: number) =>
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
      orderIndex: row.orderIndex ?? index,
      tags: row.tags,
      isAiSuggested: row.isAiSuggested,
      isRootCause: row.isRootCause ?? row.likelyRootCause,
      convertedToTaskId: row.convertedToTaskId,
    }),
  );
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
    positionX: 0,
    positionY: 0,
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

function newTempId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `temp-${crypto.randomUUID()}`;
  return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
