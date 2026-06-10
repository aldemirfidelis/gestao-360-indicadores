'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Target, Trash2, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

interface Indicator {
  id: string; code: string; name: string; unit: string | null; kind: string; direction: string; source: string;
  weight: string | null; bscNumber: string | null; platformIndicatorId: string | null; _count?: { parameters: number; ranges: number };
}
interface PlatformIndicatorRef { id: string; name: string; code: string | null; unit: string | null; direction: string; bscNumber: string | null }
interface Parameter { id: string; year: number | null; month: number | null; scopeKey: string | null; target: string | null; zero: string | null; weight: string | null }
interface Range { id: string; orderIndex: number; minLimit: string | null; maxLimit: string | null; achievementPercent: string | null; gainPercent: string | null }
interface IndicatorDetail extends Indicator { parameters: Parameter[]; ranges: Range[] }

const KIND: Record<string, string> = { COLLECTIVE: 'Coletivo', INDIVIDUAL: 'Individual', BEHAVIORAL_COLLECTIVE: 'Comportamental (coletivo)', BEHAVIORAL_INDIVIDUAL: 'Comportamental (individual)' };
const DIRECTION: Record<string, string> = { HIGHER_BETTER: 'Maior melhor', LOWER_BETTER: 'Menor melhor', TARGET: 'Alvo exato' };
const SOURCE: Record<string, string> = { MANUAL: 'Manual', BSC: 'BSC', INTERNAL_API: 'API interna', FILE_IMPORT: 'Arquivo', AUTO_CALC: 'Cálculo' };

const emptyInd = { programId: '', code: '', name: '', unit: '', kind: 'COLLECTIVE', direction: 'HIGHER_BETTER', source: 'MANUAL', weight: '', bscNumber: '', platformIndicatorId: '', manual: false };
const emptyParam = { year: new Date().getFullYear(), month: new Date().getMonth() + 1, scopeKey: '', target: '', zero: '', weight: '', changeReason: '' };
const emptyRange = { orderIndex: 0, minLimit: '', maxLimit: '', achievementPercent: '', gainPercent: '' };

export default function PrizeIndicatorsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['prize:indicators:manage']);

  const [programFilter, setProgramFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyInd);
  const [selected, setSelected] = useState<string | null>(null);
  const [paramForm, setParamForm] = useState(emptyParam);
  const [rangeForm, setRangeForm] = useState(emptyRange);

  const { data: programs = [] } = useQuery({ queryKey: ['prize-programs-ref'], queryFn: () => api<any[]>('/prize/programs') });
  // Catálogo nativo da plataforma: caminho PADRÃO de criação (reuso, sem recadastro).
  // Endpoint do próprio prêmio: não exige a permissão indicators:view.
  const { data: platformIndicators = [] } = useQuery({
    queryKey: ['platform-indicators-ref'],
    queryFn: () => api<PlatformIndicatorRef[]>('/prize/indicators/platform-options'),
    enabled: open,
    staleTime: 60_000,
  });
  const { data: indicators = [], isLoading } = useQuery({
    queryKey: ['prize-indicators', programFilter],
    queryFn: () => api<Indicator[]>(`/prize/indicators${programFilter ? `?programId=${programFilter}` : ''}`),
  });
  const { data: detail } = useQuery({
    queryKey: ['prize-indicator', selected],
    queryFn: () => api<IndicatorDetail>(`/prize/indicators/${selected}`),
    enabled: !!selected,
  });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['prize-indicators'] }); qc.invalidateQueries({ queryKey: ['prize-indicator'] }); };
  const onErr = (e: ApiError) => toast.error(e.message);

  const createInd = useMutation({
    mutationFn: () => {
      const { manual, ...payload } = form;
      // Vinculado: o backend herda nome/unidade/sentido do indicador nativo.
      const json = manual
        ? { ...payload, platformIndicatorId: null }
        : { programId: payload.programId, kind: payload.kind, weight: payload.weight, platformIndicatorId: payload.platformIndicatorId || null };
      return api('/prize/indicators', { method: 'POST', json: { ...json, weight: form.weight ? Number(form.weight) : null } });
    },
    onSuccess: () => { toast.success('Indicador adicionado ao programa'); invalidate(); setOpen(false); }, onError: onErr,
  });
  const removeInd = useMutation({
    mutationFn: (id: string) => api(`/prize/indicators/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Indicador removido'); invalidate(); }, onError: onErr,
  });
  const addParam = useMutation({
    mutationFn: (indicatorId: string) => api(`/prize/indicators/${indicatorId}/parameters`, { method: 'POST', json: {
      year: paramForm.year, month: paramForm.month, scopeKey: paramForm.scopeKey || null,
      target: paramForm.target ? Number(paramForm.target) : null, zero: paramForm.zero ? Number(paramForm.zero) : null,
      weight: paramForm.weight ? Number(paramForm.weight) : null, changeReason: paramForm.changeReason || null,
    } }),
    onSuccess: () => { toast.success('Meta/zero definida'); invalidate(); setParamForm(emptyParam); }, onError: onErr,
  });
  const removeParam = useMutation({
    mutationFn: ({ indicatorId, parameterId }: { indicatorId: string; parameterId: string }) => api(`/prize/indicators/${indicatorId}/parameters/${parameterId}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Parâmetro removido'); invalidate(); }, onError: onErr,
  });
  const addRange = useMutation({
    mutationFn: (indicatorId: string) => api(`/prize/indicators/${indicatorId}/ranges`, { method: 'POST', json: {
      orderIndex: Number(rangeForm.orderIndex) || 0,
      minLimit: rangeForm.minLimit ? Number(rangeForm.minLimit) : null, maxLimit: rangeForm.maxLimit ? Number(rangeForm.maxLimit) : null,
      achievementPercent: rangeForm.achievementPercent ? Number(rangeForm.achievementPercent) : null, gainPercent: rangeForm.gainPercent ? Number(rangeForm.gainPercent) : null,
    } }),
    onSuccess: () => { toast.success('Faixa adicionada'); invalidate(); setRangeForm(emptyRange); }, onError: onErr,
  });
  const removeRange = useMutation({
    mutationFn: ({ indicatorId, rangeId }: { indicatorId: string; rangeId: string }) => api(`/prize/indicators/${indicatorId}/ranges/${rangeId}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Faixa removida'); invalidate(); }, onError: onErr,
  });

  return (
    <div>
      <PageHeader
        title="Indicadores do Prêmio"
        eyebrow="Gestão de Prêmio"
        description="Parametrização do prêmio (metas, zeros, pesos e faixas) sobre os indicadores da plataforma — o cadastro do indicador continua único, no módulo Indicadores."
        tone="view"
        breadcrumbs={[{ label: 'Gestão de Prêmio', href: '/gestao-premio' }, { label: 'Indicadores' }]}
        actions={canManage ? <Button onClick={() => { setForm({ ...emptyInd, programId: programFilter || programs[0]?.id || '' }); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />Adicionar indicador</Button> : undefined}
      />

      <div className="mb-4 flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Programa:</Label>
        <NativeSelect value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="max-w-xs">
          <option value="">Todos</option>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </NativeSelect>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : indicators.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Target className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nenhum indicador cadastrado.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {indicators.map((ind) => {
            const isOpen = selected === ind.id;
            return (
              <Card key={ind.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 cursor-pointer" onClick={() => setSelected(isOpen ? null : ind.id)}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{ind.code}</span>
                        <span className="font-medium">{ind.name}</span>
                        <Badge variant="secondary">{KIND[ind.kind] ?? ind.kind}</Badge>
                        {ind.platformIndicatorId
                          ? <Badge variant="outline" className="border-emerald-300 text-emerald-700">🔗 Plataforma</Badge>
                          : <Badge variant="outline">Exclusivo do prêmio</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {DIRECTION[ind.direction]} · {SOURCE[ind.source]}{ind.unit ? ` · ${ind.unit}` : ''}{ind.weight ? ` · peso ${ind.weight}` : ''}{ind.bscNumber ? ` · BSC ${ind.bscNumber}` : ''}{ind.platformIndicatorId ? ' · realizado sincroniza dos Lançamentos' : ' · realizado manual'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelected(isOpen ? null : ind.id)}><SlidersHorizontal className="mr-1 h-3.5 w-3.5" />Metas e faixas</Button>
                      {canManage && <Button size="sm" variant="ghost" onClick={() => removeInd.mutate(ind.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                    </div>
                  </div>

                  {isOpen && detail && (
                    <div className="mt-4 grid gap-4 border-t border-border/60 pt-3 md:grid-cols-2">
                      {/* Metas e zeros */}
                      <div>
                        <h4 className="mb-2 text-sm font-medium">Metas e zeros por período</h4>
                        <div className="space-y-1">
                          {detail.parameters.length === 0 && <p className="text-xs text-muted-foreground">Nenhum parâmetro.</p>}
                          {detail.parameters.map((p) => (
                            <div key={p.id} className="flex items-center justify-between rounded border border-border/60 px-2 py-1 text-xs">
                              <span>{p.month}/{p.year}{p.scopeKey ? ` · ${p.scopeKey}` : ''} — meta {p.target ?? '—'} / zero {p.zero ?? '—'}</span>
                              {canManage && <button onClick={() => removeParam.mutate({ indicatorId: ind.id, parameterId: p.id })} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>}
                            </div>
                          ))}
                        </div>
                        {canManage && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <Input type="number" placeholder="Ano" value={paramForm.year} onChange={(e) => setParamForm({ ...paramForm, year: Number(e.target.value) })} />
                            <Input type="number" placeholder="Mês" value={paramForm.month} onChange={(e) => setParamForm({ ...paramForm, month: Number(e.target.value) })} />
                            <Input type="number" placeholder="Meta" value={paramForm.target} onChange={(e) => setParamForm({ ...paramForm, target: e.target.value })} />
                            <Input type="number" placeholder="Zero" value={paramForm.zero} onChange={(e) => setParamForm({ ...paramForm, zero: e.target.value })} />
                            <Button size="sm" className="col-span-2" variant="outline" onClick={() => addParam.mutate(ind.id)} disabled={addParam.isPending}>Adicionar meta/zero</Button>
                          </div>
                        )}
                      </div>

                      {/* Faixas */}
                      <div>
                        <h4 className="mb-2 text-sm font-medium">Faixas de resultado</h4>
                        <div className="space-y-1">
                          {detail.ranges.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma faixa.</p>}
                          {detail.ranges.map((r) => (
                            <div key={r.id} className="flex items-center justify-between rounded border border-border/60 px-2 py-1 text-xs">
                              <span>[{r.minLimit ?? '−∞'} a {r.maxLimit ?? '+∞'}] → atinge {r.achievementPercent ?? '—'}% · ganho {r.gainPercent ?? '—'}%</span>
                              {canManage && <button onClick={() => removeRange.mutate({ indicatorId: ind.id, rangeId: r.id })} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>}
                            </div>
                          ))}
                        </div>
                        {canManage && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <Input type="number" placeholder="Mín" value={rangeForm.minLimit} onChange={(e) => setRangeForm({ ...rangeForm, minLimit: e.target.value })} />
                            <Input type="number" placeholder="Máx" value={rangeForm.maxLimit} onChange={(e) => setRangeForm({ ...rangeForm, maxLimit: e.target.value })} />
                            <Input type="number" placeholder="% atingimento" value={rangeForm.achievementPercent} onChange={(e) => setRangeForm({ ...rangeForm, achievementPercent: e.target.value })} />
                            <Input type="number" placeholder="% ganho" value={rangeForm.gainPercent} onChange={(e) => setRangeForm({ ...rangeForm, gainPercent: e.target.value })} />
                            <Button size="sm" className="col-span-2" variant="outline" onClick={() => addRange.mutate(ind.id)} disabled={addRange.isPending}>Adicionar faixa</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Adicionar indicador ao programa: o caminho padrão é REUSAR o catálogo da plataforma */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Adicionar indicador ao programa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Programa *</Label>
              <NativeSelect value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })}>
                <option value="">Selecione…</option>
                {programs.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </NativeSelect>
            </div>

            {!form.manual ? (
              <div>
                <Label>Indicador da plataforma *</Label>
                <NativeSelect value={form.platformIndicatorId} onChange={(e) => setForm({ ...form, platformIndicatorId: e.target.value })}>
                  <option value="">Selecione no catálogo…</option>
                  {platformIndicators.map((pi) => <option key={pi.id} value={pi.id}>{pi.code ? `${pi.code} — ` : ''}{pi.name}</option>)}
                </NativeSelect>
                <p className="mt-1 text-xs text-muted-foreground">
                  Nome, unidade e sentido vêm do cadastro único do módulo Indicadores, e o realizado sincroniza
                  automaticamente dos Lançamentos (ou da API externa) — sem recadastro e sem planilha.
                  Indicador ainda não existe? Cadastre em <a href="/indicators/new" className="underline">Indicadores</a> e volte aqui.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="auto (IND-001)" /></div>
                  <div><Label>Unidade</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="%, ton, R$…" /></div>
                </div>
                <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Sentido</Label>
                    <NativeSelect value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                      {Object.entries(DIRECTION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </NativeSelect>
                  </div>
                  <div><Label>Fonte</Label>
                    <NativeSelect value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                      {Object.entries(SOURCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </NativeSelect>
                  </div>
                </div>
                <div><Label>Nº BSC (opcional)</Label><Input value={form.bscNumber} onChange={(e) => setForm({ ...form, bscNumber: e.target.value })} /></div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <NativeSelect value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </NativeSelect>
              </div>
              <div><Label>Peso (%)</Label><Input type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /></div>
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={form.manual} onChange={(e) => setForm({ ...form, manual: e.target.checked })} />
              Indicador exclusivo do prêmio (exceção: não existe no catálogo da plataforma; realizado será manual)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createInd.mutate()}
              disabled={createInd.isPending || !form.programId || (form.manual ? !form.name.trim() : !form.platformIndicatorId)}
            >{createInd.isPending ? 'Adicionando…' : 'Adicionar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
