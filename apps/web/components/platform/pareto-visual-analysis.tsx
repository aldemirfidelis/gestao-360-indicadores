'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, Download, Plus, Save, Trash2 } from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { cn, formatNumber } from '@/lib/utils';
import { exportNodeToPng } from '@/lib/export-image';

/**
 * Diagrama de Pareto — primeira ferramenta da sequência de análise.
 * Prioriza as causas por frequência/impacto (80/20) ANTES do Ishikawa: as
 * "poucas vitais" podem ser enviadas ao Ishikawa com um clique. É OPCIONAL —
 * a faixa-guia permite ir direto ao Ishikawa sem preencher o Pareto.
 *
 * Board persistido em session.data.items (mesmo padrão do 5W2H/5 Porquês,
 * sem migração).
 */

export interface ParetoItem {
  id: string;
  label: string;
  value: number;
  /** categoria 6M (opcional) — usada no handoff para o Ishikawa */
  category: string;
}

// Mesmas chaves 6M do Ishikawa para o handoff cair na espinha certa.
const CATEGORY_OPTIONS = [
  { key: '', label: 'Sem categoria' },
  { key: 'METHOD', label: 'Método' },
  { key: 'MACHINE', label: 'Máquina' },
  { key: 'MANPOWER', label: 'Mão de obra' },
  { key: 'MATERIAL', label: 'Material' },
  { key: 'ENVIRONMENT', label: 'Meio ambiente' },
  { key: 'MEASUREMENT', label: 'Medição' },
] as const;

const VITAL_THRESHOLD = 80;

function makeItem(partial?: Partial<ParetoItem>): ParetoItem {
  return {
    id: `temp-${Math.random().toString(36).slice(2, 10)}`,
    label: '',
    value: 1,
    category: '',
    ...partial,
  };
}

function normalizeItems(raw: unknown): ParetoItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) =>
      makeItem({
        id: typeof item?.id === 'string' ? item.id : undefined,
        label: String(item?.label ?? '').trim(),
        value: Number.isFinite(Number(item?.value)) && Number(item?.value) > 0 ? Number(item.value) : 1,
        category: typeof item?.category === 'string' ? item.category : '',
      }),
    )
    .filter((item) => item.label);
}

export function ParetoVisualAnalysis({
  actionId,
  session,
  saving,
  canEdit = true,
  onSendToIshikawa,
  onSave,
}: {
  actionId?: string;
  session?: any;
  saving: boolean;
  canEdit?: boolean;
  /** handoff opcional: envia as causas vitais (título + categoria 6M) ao Ishikawa */
  onSendToIshikawa?: (causes: Array<{ title: string; category?: string }>) => void;
  onSave: (items: ParetoItem[]) => void;
}) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef<ParetoItem[]>([]);
  const [items, setItems] = useState<ParetoItem[]>(() => normalizeItems(session?.data?.items));
  const [draft, setDraft] = useState({ label: '', value: '1', category: '' });
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setItems(normalizeItems(session?.data?.items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.updatedAt]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const handleSave = useCallback(
    (nextItems = itemsRef.current) => {
      onSave(nextItems);
      setLastSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    },
    [onSave],
  );

  // Ordena por impacto e calcula o acumulado: vital = entra até a barra que CRUZA os 80%.
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  let running = 0;
  const rows = sorted.map((item) => {
    const before = total ? (running / total) * 100 : 0;
    running += item.value;
    const cumulative = total ? (running / total) * 100 : 0;
    return { ...item, percent: total ? (item.value / total) * 100 : 0, cumulative, vital: before < VITAL_THRESHOLD };
  });
  const vitals = rows.filter((row) => row.vital);
  const chartData = rows.map((row) => ({
    name: row.label.length > 18 ? `${row.label.slice(0, 17)}…` : row.label,
    valor: row.value,
    acumulado: Math.round(row.cumulative * 10) / 10,
    vital: row.vital,
  }));

  function addItem() {
    const label = draft.label.trim();
    const value = Number(String(draft.value).replace(',', '.'));
    if (!label) {
      toast.error('Descreva a causa/ocorrência.');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Informe uma frequência/impacto maior que zero.');
      return;
    }
    const next = [...items, makeItem({ label, value, category: draft.category })];
    setItems(next);
    setDraft({ label: '', value: '1', category: draft.category });
    handleSave(next);
  }

  function removeItem(id: string) {
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    handleSave(next);
  }

  function commitValue(id: string, raw: string) {
    const value = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return;
    const next = items.map((item) => (item.id === id ? { ...item, value } : item));
    setItems(next);
    handleSave(next);
  }

  function commitCategory(id: string, category: string) {
    const next = items.map((item) => (item.id === id ? { ...item, category } : item));
    setItems(next);
    handleSave(next);
  }

  async function exportImage() {
    const ok = await exportNodeToPng(boardRef.current, `pareto-${actionId ?? 'analise'}`);
    if (ok) toast.success('Imagem exportada');
    else toast.error('Não foi possível exportar a imagem');
  }

  function sendVitalsToIshikawa() {
    if (!onSendToIshikawa) return;
    if (!vitals.length) {
      toast.error('Adicione causas ao Pareto para identificar as vitais.');
      return;
    }
    onSendToIshikawa(vitals.map((row) => ({ title: row.label, category: row.category || undefined })));
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {onSendToIshikawa && (
            <Button size="sm" variant="outline" onClick={sendVitalsToIshikawa} disabled={!canEdit || vitals.length === 0}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Levar vitais ao Ishikawa ({vitals.length})
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lastSavedAt && <span className="text-xs text-slate-500">Salvo às {lastSavedAt}</span>}
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
          Você está em modo de visualização. Edição está bloqueada.
        </div>
      )}

      <div className="bg-slate-50 p-4">
        <div className="mb-4 text-center">
          <div className="text-lg font-bold tracking-tight text-slate-900">Diagrama de Pareto</div>
          <div className="text-xs font-medium text-slate-500">
            Liste as causas/ocorrências com a frequência ou impacto de cada uma; as “poucas vitais” (até {VITAL_THRESHOLD}% acumulado)
            concentram o resultado. Etapa opcional — você pode ir direto ao Ishikawa pela sequência acima.
          </div>
        </div>

        {canEdit && (
          <div className="mx-auto mb-4 grid max-w-3xl gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_110px_170px_auto]">
            <Input
              placeholder="Causa / ocorrência (ex.: parada por falta de material)"
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
              onKeyDown={(event) => event.key === 'Enter' && addItem()}
            />
            <Input
              type="number"
              min={0.01}
              step="any"
              placeholder="Qtde"
              title="Frequência ou impacto (nº de ocorrências, horas paradas, custo...)"
              value={draft.value}
              onChange={(event) => setDraft({ ...draft, value: event.target.value })}
              onKeyDown={(event) => event.key === 'Enter' && addItem()}
            />
            <NativeSelect value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </NativeSelect>
            <Button onClick={addItem}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </div>
        )}

        <div ref={boardRef} className="mx-auto max-w-4xl space-y-4 bg-slate-50 p-1">
          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              Nenhuma causa registrada ainda. Adicione as ocorrências acima — ou pule direto para o Ishikawa se preferir levantar as
              causas sem priorização.
            </div>
          ) : (
            <>
              <div className="h-72 rounded-lg border border-slate-200 bg-white p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-14} textAnchor="end" height={46} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} width={44} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} width={42} />
                    <Tooltip
                      formatter={(value: any, name: any) => (name === 'acumulado' ? [`${value}%`, '% acumulado'] : [formatNumber(Number(value)), 'Frequência/impacto'])}
                    />
                    <ReferenceLine yAxisId="right" y={VITAL_THRESHOLD} stroke="#dc2626" strokeDasharray="4 4" label={{ value: `${VITAL_THRESHOLD}%`, position: 'right', fontSize: 10, fill: '#dc2626' }} />
                    <Bar yAxisId="left" dataKey="valor" name="valor" radius={[3, 3, 0, 0]} fill="#2563eb" />
                    <Line yAxisId="right" dataKey="acumulado" name="acumulado" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100 text-left text-xs uppercase text-slate-500">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Causa / ocorrência</th>
                      <th className="px-3 py-2">Categoria (6M)</th>
                      <th className="px-3 py-2 text-right">Qtde</th>
                      <th className="px-3 py-2 text-right">%</th>
                      <th className="px-3 py-2 text-right">% acum.</th>
                      <th className="px-3 py-2">Classificação</th>
                      {canEdit && <th className="px-3 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.id} className={cn('border-b border-slate-100 last:border-0', row.vital && 'bg-blue-50/50')}>
                        <td className="px-3 py-2 font-medium text-slate-500">{index + 1}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{row.label}</td>
                        <td className="px-3 py-2">
                          {canEdit ? (
                            <NativeSelect className="h-8 text-xs" value={row.category} onChange={(event) => commitCategory(row.id, event.target.value)}>
                              {CATEGORY_OPTIONS.map((option) => (
                                <option key={option.key} value={option.key}>{option.label}</option>
                              ))}
                            </NativeSelect>
                          ) : (
                            <span className="text-slate-600">{CATEGORY_OPTIONS.find((option) => option.key === row.category)?.label ?? 'Sem categoria'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {canEdit ? (
                            <Input
                              type="number"
                              min={0.01}
                              step="any"
                              defaultValue={row.value}
                              onBlur={(event) => commitValue(row.id, event.target.value)}
                              className="ml-auto h-8 w-24 text-right text-xs"
                            />
                          ) : (
                            formatNumber(row.value)
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">{row.percent.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-800">{row.cumulative.toFixed(1)}%</td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                              row.vital ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-500',
                            )}
                          >
                            {row.vital ? 'Vital (80/20)' : 'Trivial'}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeItem(row.id)}
                              className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                              aria-label={`Remover ${row.label}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
