'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Tags, RefreshCw, Upload, Pencil, Check, GitMerge } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/select';
import { api, ApiError } from '@/lib/api';
import type { CatalogRef } from './types';

export function CatalogManager({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [areasText, setAreasText] = useState('');
  const [sectorsText, setSectorsText] = useState('');
  const [cargosText, setCargosText] = useState('');
  const [editing, setEditing] = useState<{ kind: 'area' | 'cargo'; id: string } | null>(null);
  const [editName, setEditName] = useState('');

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
    onSuccess: () => { toast.success('Mesclado'); refetch(); }, onError: onErr,
  });

  function Row({ kind, item, list }: { kind: 'area' | 'cargo'; item: CatalogRef; list: CatalogRef[] }) {
    const isEditing = editing?.kind === kind && editing.id === item.id;
    return (
      <div className="flex items-center gap-2 rounded border border-border/60 px-2 py-1 text-xs">
        <span className="font-mono text-muted-foreground">#{item.code}</span>
        {isEditing ? (
          <>
            <Input className="h-6 flex-1" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <button onClick={() => rename.mutate({ kind, id: item.id, name: editName })} className="text-emerald-600"><Check className="h-3.5 w-3.5" /></button>
          </>
        ) : (
          <>
            <span className="flex-1">{item.name}{kind === 'area' && item.kind === 'SECTOR' ? <span className="ml-1 text-[10px] text-muted-foreground">(setor)</span> : null}</span>
            {canManage && <button onClick={() => { setEditing({ kind, id: item.id }); setEditName(item.name); }} className="text-muted-foreground hover:text-foreground" title="Renomear"><Pencil className="h-3 w-3" /></button>}
            {canManage && list.length > 1 && (
              <NativeSelect className="h-6 w-28 text-[11px]" value="" onChange={(e) => { if (e.target.value && window.confirm(`Mesclar "${item.name}" em "${list.find((x) => x.id === e.target.value)?.name}"? Os vínculos passam para o destino e este item é desativado.`)) merge.mutate({ kind, sourceId: item.id, targetId: e.target.value }); }} title="Mesclar em…">
                <option value=""><GitMerge className="h-3 w-3" /> mesclar…</option>
                {list.filter((x) => x.id !== item.id).map((x) => <option key={x.id} value={x.id}>→ {x.name} #{x.code}</option>)}
              </NativeSelect>
            )}
          </>
        )}
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
              <div>
                <h5 className="mb-1 text-xs font-medium text-muted-foreground">Áreas/Setores ({areas.length})</h5>
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {areas.length === 0 && <p className="text-xs text-muted-foreground">Vazio. Importe colaboradores ou clique em “Reconstruir do histórico”.</p>}
                  {areas.map((a) => <Row key={a.id} kind="area" item={a} list={areas} />)}
                </div>
              </div>
              <div>
                <h5 className="mb-1 text-xs font-medium text-muted-foreground">Cargos ({cargos.length})</h5>
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {cargos.length === 0 && <p className="text-xs text-muted-foreground">Vazio. Importe colaboradores ou “Reconstruir do histórico”.</p>}
                  {cargos.map((c) => <Row key={c.id} kind="cargo" item={c} list={cargos} />)}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
