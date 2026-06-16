'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Edit3, EyeOff, Lock, Power, RefreshCcw, Wrench } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PORTAL_STATUS_TONE, type PortalPageRow } from '@/components/portal-admin/types';

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'superadministrador' },
  { value: 'COMPANY_ADMIN', label: 'Admin da Empresa' },
  { value: 'DIRECTOR', label: 'Diretor' },
  { value: 'MANAGER', label: 'Gestor' },
  { value: 'ANALYST', label: 'Analista' },
  { value: 'COLLABORATOR', label: 'Colaborador' },
  { value: 'VIEWER', label: 'Visualizador' },
];

export function PagesTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<PortalPageRow | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    menuOrder: number;
    unavailableMessage: string;
    allowedRoles: string[];
  } | null>(null);

  const pages = useQuery<PortalPageRow[]>({
    queryKey: ['portal', 'pages'],
    queryFn: () => api('/admin/portal/pages'),
    refetchOnWindowFocus: false,
  });

  const statusMut = useMutation({
    mutationFn: (v: { code: string; status: string }) =>
      api(`/admin/portal/pages/${v.code}/status`, { method: 'POST', json: { status: v.status } }),
    onSuccess: () => {
      toast.success('Status da página atualizado.');
      qc.invalidateQueries({ queryKey: ['portal', 'pages'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (v: { code: string; data: any }) =>
      api(`/admin/portal/pages/${v.code}`, { method: 'PUT', json: v.data }),
    onSuccess: () => {
      toast.success('Página configurada com sucesso.');
      setEditing(null);
      setEditForm(null);
      qc.invalidateQueries({ queryKey: ['portal', 'pages'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  function startEdit(page: PortalPageRow) {
    setEditing(page);
    let allowed: string[] = [];
    try {
      allowed = typeof page.allowedRoles === 'string' ? JSON.parse(page.allowedRoles) : (page.allowedRoles || []);
    } catch {
      allowed = [];
    }
    setEditForm({
      title: page.title || '',
      description: page.description || '',
      menuOrder: page.menuOrder || 0,
      unavailableMessage: page.unavailableMessage || '',
      allowedRoles: allowed,
    });
  }

  function handleRoleToggle(role: string) {
    if (!editForm) return;
    const exists = editForm.allowedRoles.includes(role);
    const updated = exists
      ? editForm.allowedRoles.filter((r) => r !== role)
      : [...editForm.allowedRoles, role];
    setEditForm({ ...editForm, allowedRoles: updated });
  }

  const rows = pages.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{rows.length} página(s) registradas no portal.</p>
        <Button variant="ghost" size="sm" onClick={() => pages.refetch()} disabled={pages.isFetching}>
          <RefreshCcw className={cn('mr-2 h-4 w-4', pages.isFetching && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {pages.isLoading && <LoadingState label="Lendo páginas..." />}

      {!pages.isLoading && rows.length === 0 && (
        <SectionCard title="Nenhuma página registrada" description="Sincronize os módulos primeiro na aba Módulos.">
          <div className="p-4 text-center text-xs text-muted-foreground">Sincronize os módulos na aba Módulos para popular o catálogo.</div>
        </SectionCard>
      )}

      {rows.length > 0 && (
        <SectionCard title="Páginas do Portal" description="Gerenciar acesso, mensagens e status das páginas." contentClassName="p-0">
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th className="text-left">Página / Título</th>
                  <th className="text-left">Módulo</th>
                  <th className="text-left">Rota</th>
                  <th className="text-left">Restrições de Acesso</th>
                  <th className="text-left">Status</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  let rolesArr: string[] = [];
                  try {
                    rolesArr = typeof p.allowedRoles === 'string' ? JSON.parse(p.allowedRoles) : (p.allowedRoles || []);
                  } catch {
                    rolesArr = [];
                  }
                  return (
                    <tr key={p.code}>
                      <td>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.title || '-'}</div>
                        <div className="font-mono text-[9px] text-muted-foreground">{p.code}</div>
                      </td>
                      <td>
                        <Badge variant="secondary" className="font-mono text-xs">{p.moduleCode || 'global'}</Badge>
                      </td>
                      <td className="font-mono text-xs text-muted-foreground">{p.route || '-'}</td>
                      <td>
                        {rolesArr.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Público (Todos perfis)</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {rolesArr.map((r) => (
                              <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={cn('pill', PORTAL_STATUS_TONE[p.status] ?? 'pill-gray')}>{p.status}</span>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" title="Editar Configurações" onClick={() => startEdit(p)}>
                            <Edit3 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Ativar"
                            disabled={p.status === 'ACTIVE'}
                            onClick={() => statusMut.mutate({ code: p.code, status: 'ACTIVE' })}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Manutenção"
                            disabled={p.status === 'MAINTENANCE'}
                            onClick={() => statusMut.mutate({ code: p.code, status: 'MAINTENANCE' })}
                          >
                            <Wrench className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Ocultar"
                            disabled={p.status === 'HIDDEN'}
                            onClick={() => statusMut.mutate({ code: p.code, status: 'HIDDEN' })}
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            title="Bloquear/Desativar"
                            disabled={p.status === 'INACTIVE'}
                            onClick={() => statusMut.mutate({ code: p.code, status: 'INACTIVE' })}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {editing && editForm && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Configurar Página: {editing.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2 text-sm">
              <div className="grid gap-1">
                <Label htmlFor="page-title">Título Exibido</Label>
                <Input
                  id="page-title"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>

              <div className="grid gap-1">
                <Label htmlFor="page-desc">Descrição / Nota</Label>
                <Input
                  id="page-desc"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>

              <div className="grid gap-1">
                <Label htmlFor="page-order">Ordem no Menu</Label>
                <Input
                  id="page-order"
                  type="number"
                  value={editForm.menuOrder}
                  onChange={(e) => setEditForm({ ...editForm, menuOrder: parseInt(e.target.value, 10) || 0 })}
                />
              </div>

              <div className="grid gap-1">
                <Label htmlFor="page-msg">Mensagem Customizada quando Indisponível</Label>
                <Input
                  id="page-msg"
                  placeholder="Esta página está temporariamente indisponível."
                  value={editForm.unavailableMessage}
                  onChange={(e) => setEditForm({ ...editForm, unavailableMessage: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Restringir Acesso aos Perfis (Deixe vazio para Público)</Label>
                <div className="grid grid-cols-2 gap-2 border rounded-md p-3 bg-muted/20">
                  {ROLES.map((r) => {
                    const isChecked = editForm.allowedRoles.includes(r.value);
                    return (
                      <label key={r.value} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleRoleToggle(r.value)}
                          className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                        />
                        <span className="text-xs">{r.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button
                disabled={updateMut.isPending}
                onClick={() =>
                  updateMut.mutate({
                    code: editing.code,
                    data: {
                      title: editForm.title,
                      description: editForm.description,
                      menuOrder: editForm.menuOrder,
                      unavailableMessage: editForm.unavailableMessage,
                      allowedRoles: editForm.allowedRoles,
                    },
                  })
                }
              >
                Salvar Configurações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
