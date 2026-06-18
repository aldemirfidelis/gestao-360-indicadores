'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Tags, RefreshCw, Upload, Pencil, Check, GitMerge, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/select';
import { api, ApiError } from '@/lib/api';
import type { CatalogRef } from './types';

const MAX_VISIBLE = 200; // evita renderizar milhares de linhas de uma vez

export function CatalogManager({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [areasText, setAreasText] = useState('');
  const [sectorsText, setSectorsText] = useState('');
  const [cargosText, setCargosText] = useState('');
  const [editing, setEditing] = useState<{ kind: 'area' | 'cargo'; id: string } | null>(null);
  const [editName, setEditName] = useState('');
  // Mesclagem sob demanda: so a linha selecionada renderiza o <select> de destino.
  const [merging, setMerging] = useState<{ kind: 'area' | 'cargo'; id: string } | null>(null);
  const [mergeTarget, setMergeTarget] = useState('');
  const [areaQuery, setAreaQuery] = useState('');
  const [cargoQuery, setCargoQuery] = useState('');

  const refetch = () => { qc.invalidateQueries({ queryKey: ['prize-catalog-areas'] }); qc.invalidateQueries({ queryKey: ['prize-catalog-cargos'] }); };
  const onErr = (e: ApiError) => toast.error(e.message);

  const { data: areas = [] } = useQuery({ queryKey: ['prize-catalog-areas'], queryFn: () => api<CatalogRef[]>('/prize/catalog/areas'), enabled: open });
  const { data: cargos = [] } = useQuery({ queryKey: ['prize-catalog-cargos'], queryFn: () => api<CatalogRef[]>('/prize/catalog/cargos'), enabled: open });

  const rebuild = useMutation({
    mutationFn: () => api<{ snapshots: number; groups: number; areas: number; cargos: number }>('/prize/catalog/rebuild', { method: 'POST' }),
    onSuccess: (r) => { toast.success(`Catálogo reconstruído: ${r.areas} áreas, ${r.cargos} cargos, ${r.snapshots} colaboradores e ${r.groups} combinações linkados`); refetch(); },
    onError: onErr,
  });
  const importMut = useMutation({
    mutationFn: () => api('/prize/catalog/import', { method: 'POST', json: {
      areas: areasText.split('\n').map((s) => s.trim()).filter(Boolean),
      sectors: sectorsText.split('\n').map((s) => s.trim()).filter(Boolean),
      cargos: cargosText.split('\n').map((s) => s.trim()).filter(Boolean),
    } }),
    onSuccess: () => { toast.success('Catálogo importado'); setAreasText(''); setSectorsText(''); setCargosText(''); setImportOpen(false); refetch(); },
    onError: onErr,
  });
  const rename = useMutation({
    mutationFn: ({ kind, id, name }: { kind: 'area' | 'cargo'; id: string; name: string }) => api(`/prize/catalog/${kind === 'area' ? 'areas' : 'cargos'}/${id}`, { method: 'PATCH', json: { name } }),
    onSuccess: () => { toast.success('Renomeado'); setEditing(null); refetch(); }, onError: onErr,
  });
  const merge = useMutation({
    mutationFn: ({ kind, sourceId, targetId }: { kind: 'area' | 'cargo'; sourceId: string; targetId: string }) => api(`/prize/catalog/${kind === 'area' ? 'areas' : 'cargos'}/merge`, { method: 'POST', json: { sourceId, targetId } }),
    onSuccess: () => { toast.success('Mesclado'); setMerging(null); setMergeTarget(''); refetch(); }, onError: onErr,
  });

  const filteredAreas = useFiltered(areas, areaQuery);
  const filteredCargos = useFiltered(cargos, cargoQuery);

  // Invocados como funcao (JSX inline), nao como <Row/>/<Column/>, para nao
  // remontar a subarvore a cada render (senao o input de busca perde o foco).
  function renderRow({ kind, item, list }: { kind: 'area' | 'cargo'; item: CatalogRef; list: CatalogRef[] }) {
    const isEditing = editing?.kind === kind && editing.id === item.id;
    const isMerging = merging?.kind === kind && merging.id === item.id;
    return (
      <div key={item.id} className="flex items-center gap-2 rounded border border-border/60 px-2 py-1 text-xs">
        <span className="font-mono text-muted-foreground">#{item.code}</span>
        {isEditing ? (
          <>
            <Input className="h-6 flex-1" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <button onClick={() => rename.mutate({ kind, id: item.id, name: editName })} className="text-emerald-600" title="Salvar"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground" title="Cancelar"><X className="h-3.5 w-3.5" /></button>
          </>
        ) : isMerging ? (
          <>
            <span className="flex-1 truncate" title={item.name}>{item.name} →</span>
            <NativeSelect className="h-6 w-48 text-[11px]" value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}>
              <option value="">mesclar em… (escolha o destino)</option>
              {list.filter((x) => x.id !== item.id).map((x) => <option key={x.id} value={x.id}>#{x.code} {x.name}</option>)}
            </NativeSelect>
            <button
              className="text-emerald-600 disabled:opacity-40"
              disabled={!mergeTarget}
              title="Confirmar mesclagem"
              onClick={() => {
                const target = list.find((x) => x.id === mergeTarget);
                if (target && window.confirm(`Mesclar "${item.name}" em "${target.name}"? Os vínculos passam para o destino e este item é desativado.`)) merge.mutate({ kind, sourceId: item.id, targetId: mergeTarget });
              }}
            ><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => { setMerging(null); setMergeTarget(''); }} className="text-muted-foreground hover:text-foreground" title="Cancelar"><X className="h-3.5 w-3.5" /></button>
          </>
        ) : (
          <>
            <span className="flex-1 truncate" title={item.name}>{item.name}{kind === 'area' && item.kind === 'SECTOR' ? <span className="ml-1 text-[10px] text-muted-foreground">(setor)</span> : null}</span>
            {canManage && <button onClick={() => { setEditing({ kind, id: item.id }); setEditName(item.name); }} className="text-muted-foreground hover:text-foreground" title="Renomear"><Pencil className="h-3 w-3" /></button>}
            {canManage && list.length > 1 && <button onClick={() => { setMerging({ kind, id: item.id }); setMergeTarget(''); }} className="text-muted-foreground hover:text-foreground" title="Mesclar em…"><GitMerge className="h-3 w-3" /></button>}
          </>
        )}
      </div>
    );
  }

  function renderColumn({ kind, title, all, filtered, query, setQuery }: { kind: 'area' | 'cargo'; title: string; all: CatalogRef[]; filtered: CatalogRef[]; query: string; setQuery: (v: string) => void }) {
    const shown = filtered.slice(0, MAX_VISIBLE);
    return (
      <div>
        <h5 className="mb-1 text-xs font-medium text-muted-foreground">{title} ({all.length})</h5>
        <Input className="mb-2 h-7 text-xs" placeholder="Buscar por nome ou #código…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {all.length === 0 && <p className="text-xs text-muted-foreground">Vazio. Importe colaboradores ou clique em “Reconstruir do histórico”.</p>}
          {all.length > 0 && filtered.length === 0 && <p className="text-xs text-muted-foreground">Nenhum item para “{query}”.</p>}
          {shown.map((c) => renderRow({ kind, item: c, list: all }))}
          {filtered.length > MAX_VISIBLE && <p className="px-1 py-1 text-[11px] text-muted-foreground">Mostrando {MAX_VISIBLE} de {filtered.length}. Refine a busca para ver os demais.</p>}
        </div>
      </div>
    );
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-0">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Tags className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Catálogo de Áreas e Cargos (IDs)</span>
          <span className="text-xs text-muted-foreground">— a chave que linka colaborador ↔ combinação na apuração.</span>
        </button>
        {open && (
          <div className="space-y-3 border-t border-border/60 p-4">
            {canManage && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => rebuild.mutate()} disabled={rebuild.isPending}><RefreshCw className={`mr-1 h-3.5 w-3.5 ${rebuild.isPending ? 'animate-spin' : ''}`} />Reconstruir do histórico</Button>
                <Button size="sm" variant="ghost" onClick={() => setImportOpen((o) => !o)}><Upload className="mr-1 h-3.5 w-3.5" />Importar lista</Button>
                <span className="self-center text-xs text-muted-foreground">Reconstruir = deriva o catálogo dos colaboradores já importados e linka tudo por ID (sem reimportar).</span>
              </div>
            )}
            {importOpen && canManage && (
              <div className="grid gap-2 rounded-md border border-dashed border-border/60 p-3 md:grid-cols-3">
                <div><label className="text-xs font-medium">Áreas (uma por linha)</label><Textarea rows={4} value={areasText} onChange={(e) => setAreasText(e.target.value)} /></div>
                <div><label className="text-xs font-medium">Setores (uma por linha)</label><Textarea rows={4} value={sectorsText} onChange={(e) => setSectorsText(e.target.value)} /></div>
                <div><label className="text-xs font-medium">Cargos (uma por linha)</label><Textarea rows={4} value={cargosText} onChange={(e) => setCargosText(e.target.value)} /></div>
                <div className="md:col-span-3"><Button size="sm" onClick={() => importMut.mutate()} disabled={importMut.isPending}>{importMut.isPending ? 'Importando…' : 'Importar para o catálogo'}</Button></div>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {renderColumn({ kind: 'area', title: 'Áreas/Setores', all: areas, filtered: filteredAreas, query: areaQuery, setQuery: setAreaQuery })}
              {renderColumn({ kind: 'cargo', title: 'Cargos', all: cargos, filtered: filteredCargos, query: cargoQuery, setQuery: setCargoQuery })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function useFiltered(list: CatalogRef[], query: string) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q) || String(c.code).includes(q));
  }, [list, query]);
}
