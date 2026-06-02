'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Camera, GitCompare, RotateCcw, Trash2 } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Snap { id: string; label: string; reason: string | null; kind: string; sizeBytes: number; status: string; createdByEmail: string | null; createdAt: string; restoredAt: string | null }
interface Diff { changes: { type: string; code: string; from: string; to: string }[] }

export function SnapshotsTab() {
  const qc = useQueryClient();
  const [label, setLabel] = useState('');
  const [restore, setRestore] = useState<{ snap: Snap; phrase: string } | null>(null);
  const [diff, setDiff] = useState<{ snap: Snap; data?: Diff } | null>(null);
  const list = useQuery<Snap[]>({ queryKey: ['portal', 'snapshots'], queryFn: () => api('/admin/portal/snapshots'), refetchOnWindowFocus: false });
  const inv = () => qc.invalidateQueries({ queryKey: ['portal', 'snapshots'] });

  const create = useMutation({ mutationFn: () => api('/admin/portal/snapshots', { method: 'POST', json: { label } }), onSuccess: () => { toast.success('Snapshot criado.'); setLabel(''); inv(); }, onError: (e: ApiError) => toast.error(e.message) });
  const del = useMutation({ mutationFn: (id: string) => api(`/admin/portal/snapshots/${id}`, { method: 'DELETE' }), onSuccess: inv });
  const restoreMut = useMutation({ mutationFn: () => api(`/admin/portal/snapshots/${restore!.snap.id}/restore`, { method: 'POST', json: { confirmationPhrase: restore!.phrase } }), onSuccess: () => { toast.success('Configuração restaurada (snapshot preventivo criado).'); setRestore(null); inv(); qc.invalidateQueries({ queryKey: ['portal'] }); }, onError: (e: ApiError) => toast.error(e.message) });
  const diffMut = useMutation({ mutationFn: (snap: Snap) => api<Diff>(`/admin/portal/snapshots/${snap.id}/diff`), onSuccess: (data, snap) => setDiff({ snap, data }), onError: (e: ApiError) => toast.error(e.message) });

  return (
    <div className="space-y-4">
      <SectionCard title="Criar snapshot" description="Captura o estado atual (módulos, páginas, funcionalidades, flags, menus).">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[280px] flex-1"><Label>Rótulo</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Antes da liberação X" /></div>
          <Button onClick={() => create.mutate()} disabled={create.isPending}><Camera className="mr-2 h-4 w-4" />Criar snapshot</Button>
        </div>
      </SectionCard>
      <SectionCard title="Histórico de configuração" description="Comparar, restaurar (com confirmação e snapshot preventivo) ou excluir." contentClassName="p-0">
        {list.isLoading && <LoadingState label="Lendo snapshots..." />}
        {(list.data ?? []).length === 0 ? <div className="p-4 text-sm text-muted-foreground">Nenhum snapshot. Snapshots automáticos também são criados antes de restaurações.</div> : (
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead><tr><th className="text-left">Rótulo</th><th className="text-left">Tipo</th><th className="text-left">Quando</th><th className="text-left">Autor</th><th className="text-left">Status</th><th className="text-right">Ações</th></tr></thead>
              <tbody>{(list.data ?? []).map((s) => (
                <tr key={s.id}>
                  <td><div className="font-medium">{s.label}</div>{s.reason && <div className="text-[10px] text-muted-foreground">{s.reason}</div>}</td>
                  <td><Badge variant="outline">{s.kind}</Badge></td>
                  <td className="text-xs">{formatDate(s.createdAt)}</td>
                  <td className="text-xs">{s.createdByEmail ?? 'sistema'}</td>
                  <td>{s.status}{s.restoredAt && <div className="text-[10px] text-muted-foreground">restaurado {formatDate(s.restoredAt)}</div>}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" title="Comparar com atual" onClick={() => diffMut.mutate(s)}><GitCompare className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" title="Restaurar" onClick={() => setRestore({ snap: s, phrase: '' })}><RotateCcw className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="text-destructive" title="Excluir" onClick={() => del.mutate(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {restore && (
        <Dialog open onOpenChange={(o) => !o && setRestore(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle className="text-status-red">Restaurar configuração</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <p>Restaurar <strong>{restore.snap.label}</strong> reverte status de módulos/páginas/funcionalidades/flags/menus para o estado do snapshot. Um snapshot preventivo do estado atual será criado.</p>
              <div><Label className="text-status-red">Digite: <span className="font-mono">CONFIRMAR ALTERAÇÃO CRÍTICA</span></Label><Input value={restore.phrase} onChange={(e) => setRestore({ ...restore, phrase: e.target.value })} autoFocus /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRestore(null)}>Cancelar</Button>
              <Button className="bg-status-red text-white hover:bg-status-red/90" disabled={restore.phrase !== 'CONFIRMAR ALTERAÇÃO CRÍTICA' || restoreMut.isPending} onClick={() => restoreMut.mutate()}>Restaurar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {diff && (
        <Dialog open onOpenChange={(o) => !o && setDiff(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Diferenças vs. atual — {diff.snap.label}</DialogTitle></DialogHeader>
            {(!diff.data || diff.data.changes.length === 0) ? <p className="text-sm text-muted-foreground">Nenhuma diferença: o estado atual é igual ao do snapshot.</p> : (
              <div className="max-h-[50vh] overflow-auto">
                <table className="table-modern"><thead><tr><th className="text-left">Tipo</th><th className="text-left">Código</th><th className="text-left">Snapshot</th><th className="text-left">Atual</th></tr></thead>
                  <tbody>{diff.data.changes.map((c, i) => <tr key={i}><td>{c.type}</td><td className="font-mono text-xs">{c.code}</td><td>{c.from}</td><td className="font-medium">{c.to}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
