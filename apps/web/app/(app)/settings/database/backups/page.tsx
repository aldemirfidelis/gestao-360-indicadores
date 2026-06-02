'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Archive, Download, RefreshCcw, RotateCcw, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import type { TableSummary } from '@/components/database-admin/types';

interface BackupRow {
  id: string; userEmail: string | null; type: string; reason: string | null; relatedOperation: string | null;
  targetTables: string; format: string; sizeBytes: number; rowCount: number; important: boolean; status: string;
  integrityVerified: boolean; createdAt: string;
}

function prettySize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function BackupsPage() {
  const qc = useQueryClient();
  const [table, setTable] = useState('');
  const [restore, setRestore] = useState<{ row: BackupRow; phrase: string } | null>(null);

  const backups = useQuery<BackupRow[]>({ queryKey: ['db-admin', 'backups'], queryFn: () => api('/admin/database/backups'), refetchOnWindowFocus: false });
  const tables = useQuery<TableSummary[]>({ queryKey: ['db-admin', 'tables'], queryFn: () => api('/admin/database/tables'), refetchOnWindowFocus: false });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['db-admin', 'backups'] });

  const createMut = useMutation({
    mutationFn: () => api('/admin/database/backups', { method: 'POST', json: { table } }),
    onSuccess: () => { toast.success('Backup lógico criado.'); invalidate(); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const delMut = useMutation({ mutationFn: (id: string) => api(`/admin/database/backups/${id}`, { method: 'DELETE' }), onSuccess: invalidate });
  const verifyMut = useMutation({
    mutationFn: (id: string) => api<{ ok: boolean; reason?: string }>(`/admin/database/backups/${id}/verify`, { method: 'POST' }),
    onSuccess: (r) => { toast[r.ok ? 'success' : 'error'](r.ok ? 'Integridade OK.' : `Falha: ${r.reason}`); invalidate(); },
  });
  const importantMut = useMutation({ mutationFn: ({ id, important }: { id: string; important: boolean }) => api(`/admin/database/backups/${id}/important`, { method: 'POST', json: { important } }), onSuccess: invalidate });
  const restoreMut = useMutation({
    mutationFn: () => api<{ restoredInto: string; inserted: number; skipped: number }>(`/admin/database/backups/${restore!.row.id}/restore`, { method: 'POST', json: { confirmationPhrase: restore!.phrase } }),
    onSuccess: (r) => { toast.success(`Restaurado em ${r.restoredInto}: +${r.inserted}, ${r.skipped} ignorado(s).`); setRestore(null); invalidate(); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  async function download(id: string) {
    try {
      const f = await api<{ name: string; content: string }>(`/admin/database/backups/${id}/download`);
      const blob = new Blob([f.content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = f.name; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as ApiError).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Backup e Restauração</h2>
          <p className="text-sm text-muted-foreground">Snapshots lógicos por tabela/operação. Restauração lógica reinsere linhas (ON CONFLICT DO NOTHING).</p>
        </div>
        <Button variant="outline" onClick={() => backups.refetch()} disabled={backups.isFetching}>
          <RefreshCcw className={cn('mr-2 h-4 w-4', backups.isFetching && 'animate-spin')} /> Atualizar
        </Button>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-status-blue/30 bg-status-blue/10 p-3 text-sm">
        <ShieldCheck className="h-4 w-4 text-status-blue" />
        <span>Recuperação de <strong>banco inteiro</strong> não é feita aqui — use o <strong>branching/Point-in-Time-Recovery da Neon</strong>. Esta tela faz backups <strong>lógicos</strong> (por tabela).</span>
      </div>

      <SectionCard title="Criar backup lógico" description="Snapshot manual de uma tabela.">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px]">
            <Label>Tabela</Label>
            <NativeSelect value={table} onChange={(e) => setTable(e.target.value)}>
              <option value="">Selecione...</option>
              {(tables.data ?? []).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </NativeSelect>
          </div>
          <Button onClick={() => createMut.mutate()} disabled={!table || createMut.isPending}>
            <Archive className="mr-2 h-4 w-4" /> {createMut.isPending ? 'Criando...' : 'Criar backup'}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Backups" description="Snapshots lógicos registrados." contentClassName="p-0">
        {backups.isLoading && <LoadingState label="Lendo backups..." />}
        {!backups.isLoading && (backups.data ?? []).length === 0 && <EmptyState title="Nenhum backup" description="Crie um backup ou execute uma operação destrutiva (gera snapshot automático)." className="border-0 bg-transparent" />}
        {(backups.data ?? []).length > 0 && (
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th className="text-left">Quando</th>
                  <th className="text-left">Tipo</th>
                  <th className="text-left">Tabela(s)</th>
                  <th className="text-left">Linhas</th>
                  <th className="text-left">Tamanho</th>
                  <th className="text-left">Status</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(backups.data ?? []).map((b) => (
                  <tr key={b.id}>
                    <td className="text-xs">{formatDate(b.createdAt)}<div className="text-[10px] text-muted-foreground">{b.userEmail ?? '-'}</div></td>
                    <td><Badge variant="outline">{b.type}</Badge>{b.reason && <div className="text-[10px] text-muted-foreground">{b.reason}</div>}</td>
                    <td className="font-mono text-xs">{safeTables(b.targetTables)}</td>
                    <td>{formatNumber(b.rowCount)}</td>
                    <td>{prettySize(b.sizeBytes)}</td>
                    <td>
                      <span className={cn('pill', b.status === 'AVAILABLE' ? 'pill-green' : b.status === 'CORRUPTED' ? 'pill-red' : 'pill-gray')}>{b.status}</span>
                      {b.integrityVerified && <ShieldCheck className="ml-1 inline h-3 w-3 text-status-green" />}
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" title="Marcar importante" onClick={() => importantMut.mutate({ id: b.id, important: !b.important })}>
                          <Star className={cn('h-3.5 w-3.5', b.important && 'fill-status-yellow text-status-yellow')} />
                        </Button>
                        <Button variant="ghost" size="sm" title="Verificar integridade" onClick={() => verifyMut.mutate(b.id)}><ShieldCheck className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" title="Baixar" onClick={() => download(b.id)}><Download className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" title="Restaurar (lógico)" disabled={b.status !== 'AVAILABLE'} onClick={() => setRestore({ row: b, phrase: '' })}><RotateCcw className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="text-destructive" title="Excluir" onClick={() => delMut.mutate(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {restore && (
        <Dialog open onOpenChange={(o) => !o && setRestore(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle className="text-status-red">Restaurar backup (lógico)</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <p>Reinsere as linhas do snapshot em <strong className="font-mono">{safeTables(restore.row.targetTables)}</strong> (ON CONFLICT DO NOTHING). Um snapshot preventivo do estado atual é criado.</p>
              <p className="text-xs text-muted-foreground">{formatDate(restore.row.createdAt)} · {formatNumber(restore.row.rowCount)} linha(s) · {prettySize(restore.row.sizeBytes)}</p>
              <div>
                <Label className="text-status-red">Digite: <span className="font-mono">CONFIRMAR ALTERAÇÃO CRÍTICA</span></Label>
                <Input value={restore.phrase} onChange={(e) => setRestore({ ...restore, phrase: e.target.value })} autoFocus />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRestore(null)}>Cancelar</Button>
              <Button className="bg-status-red text-white hover:bg-status-red/90" disabled={restore.phrase !== 'CONFIRMAR ALTERAÇÃO CRÍTICA' || restoreMut.isPending} onClick={() => restoreMut.mutate()}>
                {restoreMut.isPending ? 'Restaurando...' : 'Restaurar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function safeTables(json: string): string {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.join(', ') : String(json);
  } catch {
    return json;
  }
}
