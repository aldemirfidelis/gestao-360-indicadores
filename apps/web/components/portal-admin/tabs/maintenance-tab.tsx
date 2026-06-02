'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, RefreshCcw, PowerOff, ShieldCheck, ShieldAlert } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PortalModuleRow, PortalPageRow } from '@/components/portal-admin/types';

interface MaintenanceWindow {
  id: string;
  scope: 'global' | 'module' | 'page';
  targetCode: string | null;
  message: string | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  allowSuperAdmin: boolean;
  createdAt: string;
}

export function MaintenanceTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    scope: 'global',
    targetCode: '',
    message: '',
    startsAt: '',
    endsAt: '',
    allowSuperAdmin: true,
  });

  const list = useQuery<MaintenanceWindow[]>({
    queryKey: ['portal', 'maintenance'],
    queryFn: () => api('/admin/portal/maintenance'),
    refetchOnWindowFocus: false,
  });

  // Buscar opções de alvo se não for global
  const modules = useQuery<PortalModuleRow[]>({ queryKey: ['portal', 'modules'], queryFn: () => api('/admin/portal/modules'), enabled: form.scope === 'module', staleTime: 30000 });
  const pages = useQuery<PortalPageRow[]>({ queryKey: ['portal', 'pages'], queryFn: () => api('/admin/portal/pages'), enabled: form.scope === 'page', staleTime: 30000 });

  const createMut = useMutation({
    mutationFn: (v: typeof form) => api('/admin/portal/maintenance', { method: 'POST', json: v }),
    onSuccess: () => {
      toast.success('Janela de manutenção criada.');
      setForm({
        scope: 'global',
        targetCode: '',
        message: '',
        startsAt: '',
        endsAt: '',
        allowSuperAdmin: true,
      });
      qc.invalidateQueries({ queryKey: ['portal', 'maintenance'] });
      qc.invalidateQueries({ queryKey: ['portal', 'config'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => api(`/admin/portal/maintenance/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Janela de manutenção desativada/concluída.');
      qc.invalidateQueries({ queryKey: ['portal', 'maintenance'] });
      qc.invalidateQueries({ queryKey: ['portal', 'config'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const targets: { value: string; label: string }[] = [];
  if (form.scope === 'module' && modules.data) {
    modules.data.forEach((m) => targets.push({ value: m.code, label: `${m.name} (${m.code})` }));
  } else if (form.scope === 'page' && pages.data) {
    pages.data.forEach((p) => targets.push({ value: p.code, label: `${p.name} (${p.code})` }));
  }

  const rows = list.data ?? [];
  const now = new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Gerencie interrupções planejadas do portal ou de módulos/páginas específicas.
        </p>
        <Button variant="ghost" size="sm" onClick={() => list.refetch()} disabled={list.isFetching}>
          <RefreshCcw className={cn('mr-2 h-4 w-4', list.isFetching && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {list.isLoading && <LoadingState label="Carregando manutenções..." />}

      {!list.isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* Form */}
          <SectionCard title="Nova Janela de Manutenção" description="Programe indisponibilidades gerais ou parciais.">
            <div className="space-y-3 text-sm py-2">
              <div>
                <Label htmlFor="maint-scope">Abrangência (Escopo)</Label>
                <select
                  id="maint-scope"
                  className="select-modern mt-1"
                  value={form.scope}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, scope: e.target.value, targetCode: '' })}
                >
                  <option value="global">Global (Todo o Portal)</option>
                  <option value="module">Módulo Específico</option>
                  <option value="page">Página Específica</option>
                </select>
              </div>

              {form.scope !== 'global' && (
                <div>
                  <Label htmlFor="maint-target">Selecione o Alvo</Label>
                  <select
                    id="maint-target"
                    className="select-modern mt-1"
                    value={form.targetCode}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, targetCode: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {targets.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <Label htmlFor="maint-msg">Mensagem aos Usuários</Label>
                <Input
                  id="maint-msg"
                  placeholder="Esta funcionalidade está em manutenção..."
                  className="mt-1"
                  value={form.message}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, message: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="maint-start">Início (Opcional)</Label>
                  <Input
                    id="maint-start"
                    type="datetime-local"
                    className="mt-1 h-9 text-xs"
                    value={form.startsAt}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, startsAt: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="maint-end">Fim (Opcional)</Label>
                  <Input
                    id="maint-end"
                    type="datetime-local"
                    className="mt-1 h-9 text-xs"
                    value={form.endsAt}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, endsAt: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border rounded p-2.5 bg-muted/10">
                <div>
                  <Label className="font-semibold cursor-pointer select-none" htmlFor="maint-super">Bypass Super Admin</Label>
                  <p className="text-[11px] text-muted-foreground">Permite acesso excepcional de Super Admins.</p>
                </div>
                <input
                  id="maint-super"
                  type="checkbox"
                  checked={form.allowSuperAdmin}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, allowSuperAdmin: e.target.checked })}
                  className="rounded border-gray-300 text-primary focus:ring-primary h-5 w-5 cursor-pointer"
                />
              </div>

              <Button
                className="w-full mt-2 bg-status-yellow hover:bg-status-yellow/90 text-black font-semibold"
                disabled={form.scope !== 'global' && !form.targetCode || createMut.isPending}
                onClick={() => createMut.mutate(form)}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Criar Manutenção
              </Button>
            </div>
          </SectionCard>

          {/* List */}
          <SectionCard title="Janelas de Manutenção Registradas" description="Histórico e controles de manutenção ativos." className="lg:col-span-2" contentClassName="p-0">
            {rows.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Nenhuma janela de manutenção registrada.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th className="text-left">Abrangência / Alvo</th>
                      <th className="text-left">Mensagem</th>
                      <th className="text-left">Período</th>
                      <th className="text-left">Bypass</th>
                      <th className="text-left">Status</th>
                      <th className="text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((w) => {
                      const start = w.startsAt ? new Date(w.startsAt) : null;
                      const end = w.endsAt ? new Date(w.endsAt) : null;

                      let status = 'Inativa';
                      let tone = 'pill-gray';

                      if (w.active) {
                        if (start && now < start) {
                          status = 'Agendada';
                          tone = 'pill-blue';
                        } else if (end && now > end) {
                          status = 'Concluída';
                          tone = 'pill-gray';
                        } else {
                          status = 'Em Andamento';
                          tone = 'pill-yellow';
                        }
                      }

                      return (
                        <tr key={w.id} className={cn(!w.active && 'opacity-60 bg-muted/5')}>
                          <td>
                            <div className="font-semibold text-sm capitalize">{w.scope}</div>
                            {w.targetCode && <div className="font-mono text-xs text-muted-foreground mt-0.5">{w.targetCode}</div>}
                          </td>
                          <td className="text-xs max-w-[200px] truncate" title={w.message ?? ''}>
                            {w.message || '-'}
                          </td>
                          <td className="text-xs">
                            {start ? start.toLocaleString() : 'Imediato'}
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              até {end ? end.toLocaleString() : 'Manual'}
                            </div>
                          </td>
                          <td>
                            {w.allowSuperAdmin ? (
                              <Badge variant="outline" className="text-status-green border-status-green/30 bg-status-green/5 gap-1">
                                <ShieldCheck className="h-3 w-3" /> SuperAdmin
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-status-red border-status-red/30 bg-status-red/5 gap-1">
                                <ShieldAlert className="h-3 w-3" /> Ninguém
                              </Badge>
                            )}
                          </td>
                          <td>
                            <span className={cn('pill', tone)}>{status}</span>
                          </td>
                          <td className="text-right">
                            {w.active && (status === 'Em Andamento' || status === 'Agendada') ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive font-semibold hover:bg-destructive/10"
                                disabled={cancelMut.isPending}
                                onClick={() => {
                                  if (confirm('Deseja encerrar/cancelar esta janela de manutenção de imediato?')) {
                                    cancelMut.mutate(w.id);
                                  }
                                }}
                              >
                                <PowerOff className="h-3.5 w-3.5 mr-1" /> Terminar
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
