'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Link2, ChevronDown, ChevronRight, Layers, Wand2, Copy, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { api, ApiError } from '@/lib/api';
import { CombinationDialog } from './combination-dialog';
import { LinkIndicatorDialog } from './link-indicator-dialog';
import { AnnexSpreadsheetView } from './annex-spreadsheet-view';
import type { CatalogIndicator, RuleGroup, RuleIndicator, RuleParameter } from './types';
import { MONTHS_PT, RULE_TYPE, VALIDITY_KIND } from './types';

interface Props {
  annexVersionId: string;
  annexTitle: string;
  canEdit: boolean;
  canManageGroups: boolean;
  canManageIndicators: boolean;
}

interface IndicatorSource {
  groupName: string;
  ruleIndicator: RuleIndicator;
}

export function CombinationsSection({ annexVersionId, annexTitle, canEdit, canManageGroups, canManageIndicators }: Props) {
  const qc = useQueryClient();
  const groupsKey = ['prize-rule-groups', annexVersionId];
  const refetchGroups = () => qc.invalidateQueries({ queryKey: groupsKey });
  const refetchCatalog = () => qc.invalidateQueries({ queryKey: ['prize-rule-catalog'] });

  const { data: groups = [], isLoading } = useQuery({
    queryKey: groupsKey,
    queryFn: () => api<RuleGroup[]>(`/prize/rules/groups?annexVersionId=${annexVersionId}`),
  });
  const { data: catalog = [] } = useQuery({
    queryKey: ['prize-rule-catalog'],
    queryFn: () => api<CatalogIndicator[]>('/prize/rules/catalog'),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<RuleGroup | null>(null);
  const [linkGroupId, setLinkGroupId] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const removeGroup = useMutation({
    mutationFn: (id: string) => api(`/prize/rules/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Combinação removida'); refetchGroups(); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  // catalogId -> outras combinações que usam o mesmo indicador (base p/ "copiar de").
  const sourcesByCatalog = useMemo(() => {
    const map = new Map<string, IndicatorSource[]>();
    for (const g of groups) for (const ri of g.indicators) {
      const list = map.get(ri.catalogId) ?? [];
      list.push({ groupName: g.name, ruleIndicator: ri });
      map.set(ri.catalogId, list);
    }
    return map;
  }, [groups]);

  return (
    <div className="mt-4 rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-medium"><Layers className="h-4 w-4" />Combinações (área × cargos) {groups.length > 0 && <span className="text-xs text-muted-foreground">· {groups.length}</span>}</h4>
        <div className="flex gap-2">
          {groups.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setViewOpen(true)}><Eye className="mr-1 h-3.5 w-3.5" />Visualizar</Button>
          )}
          {canEdit && canManageGroups && (
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />Nova combinação</Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="py-3 text-xs text-muted-foreground">Carregando combinações…</p>
      ) : groups.length === 0 ? (
        <p className="py-3 text-xs text-muted-foreground">Nenhuma combinação. Crie uma combinação com a(s) área(s), o(s) cargo(s) e o Salário Possível %, depois vincule os indicadores.</p>
      ) : (
        <div className="mt-2 space-y-3">
          {groups.map((g) => (
            <div key={g.id} className="rounded-md border border-border/60 bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{g.name}</span>
                    <Badge variant="default">Salário {g.salaryPercent}%</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {g.areaRefs.map((a) => <Badge key={a} variant="secondary" className="text-[11px]">{a}</Badge>)}
                    {g.positionRefs.map((c) => <Badge key={c} variant="outline" className="text-[11px]">{c}</Badge>)}
                  </div>
                  {g.normalizedPositionKeys.length > 0 && (
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      chaves elegibilidade: {g.normalizedAreaKeys.map((ak) => g.normalizedPositionKeys.map((pk) => `${ak}::${pk}`).join(' · ')).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  {canEdit && canManageIndicators && <Button size="sm" variant="ghost" onClick={() => setLinkGroupId(g.id)}><Link2 className="mr-1 h-3.5 w-3.5" />Vincular indicador</Button>}
                  {canEdit && canManageGroups && <Button size="sm" variant="ghost" onClick={() => setEditGroup(g)}>Editar</Button>}
                  {canEdit && canManageGroups && <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Remover a combinação "${g.name}"?`)) removeGroup.mutate(g.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
              </div>

              {/* Indicadores da combinação */}
              <div className="mt-3 space-y-1">
                {g.indicators.length === 0 && <p className="text-xs text-muted-foreground">Nenhum indicador vinculado.</p>}
                {g.indicators.map((ri) => (
                  <IndicatorRow
                    key={ri.id}
                    ri={ri}
                    canEdit={canEdit && canManageIndicators}
                    sources={(sourcesByCatalog.get(ri.catalogId) ?? []).filter((s) => s.ruleIndicator.id !== ri.id)}
                    onChanged={refetchGroups}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AnnexSpreadsheetView open={viewOpen} onOpenChange={setViewOpen} annexTitle={annexTitle} groups={groups} />
      <CombinationDialog open={createOpen} onOpenChange={setCreateOpen} annexVersionId={annexVersionId} onSaved={refetchGroups} />
      <CombinationDialog open={!!editGroup} onOpenChange={(o) => !o && setEditGroup(null)} annexVersionId={annexVersionId} group={editGroup} onSaved={refetchGroups} />
      {linkGroupId && (
        <LinkIndicatorDialog
          open={!!linkGroupId}
          onOpenChange={(o) => !o && setLinkGroupId(null)}
          groupId={linkGroupId}
          catalog={catalog}
          onSaved={refetchGroups}
          onCatalogChanged={refetchCatalog}
        />
      )}
    </div>
  );
}

// ---- Linha de um indicador vinculado, com editor expansível de zero/meta/faixas ----
function IndicatorRow({ ri, canEdit, sources, onChanged }: { ri: RuleIndicator; canEdit: boolean; sources: IndicatorSource[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => {
    const years = ri.parameters.map((p) => p.year);
    return years.length ? Math.max(...years) : new Date().getFullYear();
  });

  const remove = useMutation({
    mutationFn: () => api(`/prize/rules/indicators/${ri.id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Indicador desvinculado'); onChanged(); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const copyFrom = useMutation({
    mutationFn: async (sourceRuleIndicatorId: string) => {
      const src = sources.find((s) => s.ruleIndicator.id === sourceRuleIndicatorId);
      if (!src) return;
      const params = src.ruleIndicator.parameters.filter((p) => p.year === year);
      if (!params.length) throw new Error('A combinação de origem não tem parâmetros para este ano');
      for (const p of params) {
        const saved = await api<RuleParameter>(`/prize/rules/indicators/${ri.id}/parameters`, { method: 'POST', json: { year: p.year, month: p.month, zero: numOrNull(p.zero), target: numOrNull(p.target) } });
        if (p.bands.length && saved?.id) {
          await api(`/prize/rules/parameters/${saved.id}/bands/bulk`, { method: 'POST', json: { bands: p.bands.map((b) => ({ orderIndex: b.orderIndex, minLimit: numOrNull(b.minLimit), maxLimit: numOrNull(b.maxLimit), achievementPercent: numOrNull(b.achievementPercent), gainPercent: numOrNull(b.gainPercent) })) } });
        }
      }
    },
    onSuccess: () => { toast.success('Parâmetros copiados da outra combinação'); onChanged(); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const paramsOfYear = ri.parameters.filter((p) => p.year === year);

  return (
    <div className="rounded border border-border/60">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <button type="button" className="flex min-w-0 items-center gap-2 text-left" onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate text-sm font-medium">{ri.catalog.name}</span>
          <Badge variant="outline" className="text-[10px]">peso {ri.weight}%</Badge>
          <span className="text-[11px] text-muted-foreground">{RULE_TYPE[ri.type] ?? ri.type} · {VALIDITY_KIND[ri.validityKind] ?? ri.validityKind}</span>
        </button>
        {canEdit && <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => { if (window.confirm('Desvincular este indicador da combinação?')) remove.mutate(); }}><Trash2 className="h-3.5 w-3.5" /></button>}
      </div>

      {open && (
        <div className="border-t border-border/60 px-2 py-2">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Ano:</span>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-7 w-24" />
            {canEdit && sources.length > 0 && (
              <NativeSelect
                className="h-7 w-auto text-xs"
                value=""
                onChange={(e) => { if (e.target.value) copyFrom.mutate(e.target.value); }}
                disabled={copyFrom.isPending}
              >
                <option value="">{copyFrom.isPending ? 'Copiando…' : 'Copiar parâmetros de…'}</option>
                {sources.map((s) => <option key={s.ruleIndicator.id} value={s.ruleIndicator.id}>{s.groupName}</option>)}
              </NativeSelect>
            )}
          </div>
          <MonthGrid ruleIndicatorId={ri.id} year={year} params={paramsOfYear} direction={ri.catalog.direction} canEdit={canEdit} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}

// ---- Grade de 12 meses: zero/meta + gerador de faixas ----
function MonthGrid({ ruleIndicatorId, year, params, direction, canEdit, onChanged }: {
  ruleIndicatorId: string; year: number; params: RuleParameter[]; direction: string; canEdit: boolean; onChanged: () => void;
}) {
  const byMonth = useMemo(() => {
    const m = new Map<number, RuleParameter>();
    for (const p of params) m.set(p.month, p);
    return m;
  }, [params]);

  const [draft, setDraft] = useState<Record<number, { zero: string; target: string }>>({});
  const [bandCount, setBandCount] = useState(6);

  const setVal = (month: number, key: 'zero' | 'target', value: string) =>
    setDraft((d) => ({ ...d, [month]: { zero: d[month]?.zero ?? str(byMonth.get(month)?.zero), target: d[month]?.target ?? str(byMonth.get(month)?.target), [key]: value } }));

  const valueOf = (month: number, key: 'zero' | 'target') => draft[month]?.[key] ?? str(byMonth.get(month)?.[key === 'zero' ? 'zero' : 'target']);

  const saveMonth = useMutation({
    mutationFn: (month: number) => api(`/prize/rules/indicators/${ruleIndicatorId}/parameters`, {
      method: 'POST',
      json: { year, month, zero: emptyToNull(valueOf(month, 'zero')), target: emptyToNull(valueOf(month, 'target')) },
    }),
    onSuccess: () => { toast.success('Zero/meta salvos'); onChanged(); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const genBands = useMutation({
    mutationFn: async (parameterId: string) => {
      const suggestion = await api<{ zero: number; target: number; direction: string; bands: any[] }>(
        `/prize/rules/parameters/${parameterId}/bands/suggest`,
        { method: 'POST', json: { count: bandCount } },
      );
      const resumo = suggestion.bands.map((b) => `Faixa ${b.orderIndex}: [${b.minLimit ?? '−∞'} a ${b.maxLimit ?? '+∞'}] → ${b.gainPercent}%`).join('\n');
      if (!window.confirm(`Faixas (zero ${suggestion.zero} → meta ${suggestion.target}):\n\n${resumo}\n\nAplicar? (substitui as faixas atuais do mês)`)) return null;
      return api(`/prize/rules/parameters/${parameterId}/bands/bulk`, { method: 'POST', json: { bands: suggestion.bands } });
    },
    onSuccess: (r) => { if (r) { toast.success('Faixas geradas'); onChanged(); } },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="px-1 py-1 text-left font-medium">Mês</th>
            <th className="px-1 py-1 text-left font-medium">Zero</th>
            <th className="px-1 py-1 text-left font-medium">Meta</th>
            <th className="px-1 py-1 text-left font-medium">Faixas</th>
            {canEdit && <th className="px-1 py-1 text-right font-medium">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {MONTHS_PT.map((label, idx) => {
            const month = idx + 1;
            const param = byMonth.get(month);
            return (
              <tr key={month} className="border-t border-border/40">
                <td className="px-1 py-1">{label}</td>
                <td className="px-1 py-1">
                  {canEdit ? <Input className="h-6 w-20" type="number" value={valueOf(month, 'zero')} onChange={(e) => setVal(month, 'zero', e.target.value)} /> : (param?.zero ?? '—')}
                </td>
                <td className="px-1 py-1">
                  {canEdit ? <Input className="h-6 w-20" type="number" value={valueOf(month, 'target')} onChange={(e) => setVal(month, 'target', e.target.value)} /> : (param?.target ?? '—')}
                </td>
                <td className="px-1 py-1">
                  {param?.bands.length ? <span title={param.bands.map((b) => `${b.orderIndex}: [${b.minLimit ?? '−∞'} a ${b.maxLimit ?? '+∞'}] ${b.gainPercent}%`).join('\n')}>{param.bands.length} faixa(s)</span> : <span className="text-muted-foreground">—</span>}
                </td>
                {canEdit && (
                  <td className="px-1 py-1">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-6 px-2" onClick={() => saveMonth.mutate(month)} disabled={saveMonth.isPending}>Salvar</Button>
                      {param && <Button size="sm" variant="ghost" className="h-6 px-2" title="Gerar faixas (zero→meta)" onClick={() => genBands.mutate(param.id)} disabled={genBands.isPending}><Wand2 className="h-3.5 w-3.5" /></Button>}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {canEdit && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Wand2 className="h-3.5 w-3.5" />
          Gerar faixas usa distribuição linear zero→meta ({direction === 'LOWER_BETTER' ? 'menor melhor' : 'maior melhor'}).
          <span>Qtd. faixas:</span>
          <Input type="number" min={2} max={6} value={bandCount} onChange={(e) => setBandCount(Number(e.target.value))} className="h-6 w-16" />
          <Copy className="ml-2 h-3 w-3" /> use “Copiar parâmetros de…” para herdar de outra combinação.
        </div>
      )}
    </div>
  );
}

function str(v: string | null | undefined): string { return v == null ? '' : String(v); }
function emptyToNull(v: string): number | null { return v.trim() === '' ? null : Number(v); }
function numOrNull(v: string | null | undefined): number | null { return v == null || v === '' ? null : Number(v); }
