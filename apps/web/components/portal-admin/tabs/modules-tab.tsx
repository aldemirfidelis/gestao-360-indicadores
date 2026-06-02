'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { EyeOff, Lock, Power, RefreshCcw, Wrench } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PORTAL_STATUS_TONE, type PortalModuleRow } from '@/components/portal-admin/types';

const CRITICAL_PHRASE = 'CONFIRMAR ALTERAÇÃO CRÍTICA';

export function ModulesTab() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<{ mod: PortalModuleRow; status: string; phrase: string; reason: string } | null>(null);
  const modules = useQuery<PortalModuleRow[]>({ queryKey: ['portal', 'modules'], queryFn: () => api('/admin/portal/modules'), refetchOnWindowFocus: false });

  const syncMut = useMutation({
    mutationFn: () => api<{ created: number }>('/admin/portal/registry/sync', { method: 'POST' }),
    onSuccess: (r) => { toast.success(`Registro sincronizado (+${r.created}).`); qc.invalidateQueries({ queryKey: ['portal', 'modules'] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (v: { code: string; status: string; confirmationPhrase?: string; reason?: string }) =>
      api(`/admin/portal/modules/${v.code}/status`, { method: 'POST', json: { status: v.status, confirmationPhrase: v.confirmationPhrase, reason: v.reason } }),
    onSuccess: () => { toast.success('Status atualizado.'); setConfirm(null); qc.invalidateQueries({ queryKey: ['portal', 'modules'] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  function changeStatus(mod: PortalModuleRow, status: string) {
    const makesUnavailable = ['INACTIVE', 'BLOCKED', 'MAINTENANCE', 'DISCONTINUED', 'HIDDEN'].includes(status);
    if (mod.nonBlockable && makesUnavailable) {
      toast.error(`Módulo essencial "${mod.code}" não pode ser bloqueado.`);
      return;
    }
    if ((mod.criticality === 'critical' || mod.criticality === 'high') && makesUnavailable) {
      setConfirm({ mod, status, phrase: '', reason: '' });
      return;
    }
    statusMut.mutate({ code: mod.code, status });
  }

  const rows = modules.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{rows.length} módulo(s). Módulos essenciais têm 🔒 (não podem ser bloqueados).</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>Ressincronizar registro</Button>
          <Button variant="ghost" size="sm" onClick={() => modules.refetch()} disabled={modules.isFetching}><RefreshCcw className={cn('mr-2 h-4 w-4', modules.isFetching && 'animate-spin')} />Atualizar</Button>
        </div>
      </div>

      {modules.isLoading && <LoadingState label="Lendo módulos..." />}
      {!modules.isLoading && rows.length === 0 && (
        <SectionCard title="Registro vazio" description="Clique em Ressincronizar registro para popular a partir do catálogo do portal.">
          <Button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>Ressincronizar registro</Button>
        </SectionCard>
      )}

      {rows.length > 0 && (
        <SectionCard title="Módulos" description="Habilitar, desabilitar, ocultar ou colocar em manutenção." contentClassName="p-0">
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr><th className="text-left">Módulo</th><th className="text-left">Categoria</th><th className="text-left">Rota</th><th className="text-left">Criticidade</th><th className="text-left">Status</th><th className="text-right">Ações</th></tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.code}>
                    <td>
                      <div className="flex items-center gap-2 font-medium">
                        {m.nonBlockable && <Lock className="h-3.5 w-3.5 text-status-red" aria-label="Essencial" />}
                        {m.name}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">{m.code}</div>
                    </td>
                    <td className="text-xs">{m.category ?? '-'}</td>
                    <td className="font-mono text-xs text-muted-foreground">{m.route ?? '-'}</td>
                    <td><Badge variant="outline" className={cn(m.criticality === 'critical' && 'border-status-red/40 text-status-red', m.criticality === 'high' && 'border-status-yellow/40 text-status-yellow')}>{m.criticality}</Badge></td>
                    <td><span className={cn('pill', PORTAL_STATUS_TONE[m.status] ?? 'pill-gray')}>{m.status}</span></td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" title="Ativar" disabled={m.status === 'ACTIVE'} onClick={() => changeStatus(m, 'ACTIVE')}><Power className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" title="Manutenção" disabled={m.nonBlockable} onClick={() => changeStatus(m, 'MAINTENANCE')}><Wrench className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" title="Ocultar do menu" disabled={m.nonBlockable} onClick={() => changeStatus(m, 'HIDDEN')}><EyeOff className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="text-destructive" title="Desativar" disabled={m.nonBlockable} onClick={() => changeStatus(m, 'INACTIVE')}><Power className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {confirm && (
        <Dialog open onOpenChange={(o) => !o && setConfirm(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle className="text-status-red">Alteração crítica</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <p>Alterar <strong>{confirm.mod.name}</strong> para <strong>{confirm.status}</strong> é uma operação de alto risco (criticidade {confirm.mod.criticality}).</p>
              <div><Label>Motivo (recomendado)</Label><Input value={confirm.reason} onChange={(e) => setConfirm({ ...confirm, reason: e.target.value })} /></div>
              <div><Label className="text-status-red">Digite: <span className="font-mono">{CRITICAL_PHRASE}</span></Label><Input value={confirm.phrase} onChange={(e) => setConfirm({ ...confirm, phrase: e.target.value })} autoFocus /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirm(null)}>Cancelar</Button>
              <Button className="bg-status-red text-white hover:bg-status-red/90" disabled={confirm.phrase !== CRITICAL_PHRASE || statusMut.isPending} onClick={() => statusMut.mutate({ code: confirm.mod.code, status: confirm.status, confirmationPhrase: confirm.phrase, reason: confirm.reason })}>
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
