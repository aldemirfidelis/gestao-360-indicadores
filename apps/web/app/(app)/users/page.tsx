'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Edit, KeyRound, Plus, Save, UsersRound } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { StatusBadge } from '@/components/platform/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { useAuth } from '@/components/auth/auth-provider';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  jobTitle: string | null;
  phone?: string | null;
  active: boolean;
  lastLoginAt: string | null;
  defaultNodeId?: string | null;
  defaultNode: { id: string; name: string } | null;
  permissions?: { permission: { key: string } }[];
}

interface Permission {
  id: string;
  key: string;
  description: string;
  module: string;
  action: string;
}

interface OrgNode {
  id: string;
  name: string;
  type: string;
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  COMPANY_ADMIN: 'Admin',
  DIRECTOR: 'Diretoria',
  MANAGER: 'Gestor',
  ANALYST: 'Analista',
  COLLABORATOR: 'Colaborador',
  VIEWER: 'Visitante',
};

const emptyForm = {
  id: '',
  email: '',
  password: '',
  name: '',
  role: 'COLLABORATOR',
  jobTitle: '',
  phone: '',
  defaultNodeId: '',
  active: true,
  permissionKeys: [] as string[],
};

type UserForm = typeof emptyForm;

export default function UsersPage() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<UserForm>(emptyForm);

  const users = useQuery<UserRow[]>({
    queryKey: ['users'],
    queryFn: () => api<UserRow[]>('/users'),
  });
  const orgs = useQuery<OrgNode[]>({
    queryKey: ['orgnodes'],
    queryFn: () => api<OrgNode[]>('/orgnodes'),
  });
  const permissions = useQuery<Permission[]>({
    queryKey: ['users', 'permissions'],
    queryFn: () => api<Permission[]>('/users/permissions'),
  });

  const byModule = useMemo(() => {
    const map = new Map<string, Permission[]>();
    (permissions.data ?? []).forEach((p) => {
      if (!map.has(p.module)) map.set(p.module, []);
      map.get(p.module)!.push(p);
    });
    return Array.from(map.entries());
  }, [permissions.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        email: form.email,
        password: form.password || undefined,
        name: form.name,
        role: form.role,
        companyId: me?.companyId,
        jobTitle: form.jobTitle || null,
        phone: form.phone || null,
        defaultNodeId: form.defaultNodeId || null,
        active: form.active,
      };
      let userId = form.id;
      if (form.id) {
        await api(`/users/${form.id}`, { method: 'PATCH', json: payload });
      } else {
        const created = await api<{ id: string }>('/users', { method: 'POST', json: payload });
        userId = created.id;
        if (!form.active) {
          await api(`/users/${userId}/active`, { method: 'PATCH', json: { active: false } });
        }
      }
      await api(`/users/${userId}/permissions`, {
        method: 'PATCH',
        json: { permissionKeys: form.permissionKeys },
      });
      return userId;
    },
    onSuccess: () => {
      toast.success('Usuario salvo');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar usuario'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api(`/users/${id}/active`, { method: 'PATCH', json: { active } }),
    onSuccess: () => {
      toast.success('Status atualizado');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const active = users.data?.filter((u) => u.active).length ?? 0;
  const admins = users.data?.filter((u) => ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(u.role)).length ?? 0;

  const openUser = (user?: UserRow) => {
    if (!user) {
      setForm(emptyForm);
    } else {
      setForm({
        id: user.id,
        email: user.email,
        password: '',
        name: user.name,
        role: user.role,
        jobTitle: user.jobTitle ?? '',
        phone: user.phone ?? '',
        defaultNodeId: user.defaultNode?.id ?? user.defaultNodeId ?? '',
        active: user.active,
        permissionKeys: user.permissions?.map((p) => p.permission.key) ?? [],
      });
    }
    setOpen(true);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Configuracoes"
        tone="admin"
        title="Usuarios e permissoes"
        description="Cadastre usuarios, vincule areas de trabalho e ajuste permissoes por modulo."
        breadcrumbs={[{ label: 'Inicio', href: '/' }, { label: 'Configuracoes' }, { label: 'Usuarios' }]}
        actions={
          <Button onClick={() => openUser()}>
            <Plus className="mr-2 h-4 w-4" />
            Novo usuario
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard title="Usuarios" value={formatNumber(users.data?.length)} description="Cadastrados" icon={<UsersRound className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Ativos" value={formatNumber(active)} description="Com acesso liberado" icon={<UsersRound className="h-4 w-4" />} tone="green" />
        <MetricCard title="Administradores" value={formatNumber(admins)} description="Permissoes elevadas" icon={<KeyRound className="h-4 w-4" />} tone="purple" />
      </div>

      <SectionCard title="Equipe" description="Clique em editar para alterar cadastro e permissoes." contentClassName="p-0">
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th className="text-left">Usuario</th>
                <th className="text-left">Cargo</th>
                <th className="text-left">Perfil</th>
                <th className="text-left">Area</th>
                <th className="text-left">Permissoes</th>
                <th className="text-left">Ultimo acesso</th>
                <th className="text-left">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.data?.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td>{u.jobTitle ?? '-'}</td>
                  <td><Badge variant="outline">{ROLE_LABEL[u.role] ?? u.role}</Badge></td>
                  <td>{u.defaultNode?.name ?? '-'}</td>
                  <td>{u.permissions?.length ?? 0}</td>
                  <td className="text-xs">{formatDate(u.lastLoginAt)}</td>
                  <td><StatusBadge value={u.active ? 'ACTIVE' : 'CANCELLED'} label={u.active ? 'Ativo' : 'Inativo'} /></td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openUser(u)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive.mutate({ id: u.id, active: !u.active })}
                      >
                        {u.active ? 'Inativar' : 'Ativar'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar usuario' : 'Novo usuario'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr,1fr]">
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>{form.id ? 'Nova senha (opcional)' : 'Senha inicial'}</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>Perfil</Label>
                  <NativeSelect value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    {Object.entries(ROLE_LABEL).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div>
                  <Label>Status</Label>
                  <NativeSelect value={form.active ? 'true' : 'false'} onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}>
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </NativeSelect>
                </div>
              </div>
              <div>
                <Label>Cargo</Label>
                <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>Area padrao</Label>
                <NativeSelect value={form.defaultNodeId} onChange={(e) => setForm({ ...form, defaultNodeId: e.target.value })}>
                  <option value="">Sem area padrao</option>
                  {orgs.data?.map((node) => (
                    <option key={node.id} value={node.id}>{node.name} ({node.type})</option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Permissoes</div>
                  <div className="text-xs text-muted-foreground">Marque os acessos liberados para este usuario.</div>
                </div>
                <Badge variant="secondary">{form.permissionKeys.length}</Badge>
              </div>
              <div className="max-h-[460px] space-y-4 overflow-y-auto pr-1">
                {byModule.map(([module, items]) => (
                  <div key={module}>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{module}</div>
                    <div className="space-y-2">
                      {items.map((permission) => {
                        const checked = form.permissionKeys.includes(permission.key);
                        return (
                          <label
                            key={permission.key}
                            className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm hover:bg-accent/35', checked && 'border-primary/40 bg-primary/5')}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  permissionKeys: e.target.checked
                                    ? [...prev.permissionKeys, permission.key]
                                    : prev.permissionKeys.filter((key) => key !== permission.key),
                                }))
                              }
                              className="mt-1"
                            />
                            <span>
                              <span className="block font-medium">{permission.description}</span>
                              <span className="text-xs text-muted-foreground">{permission.key}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name || !form.email || (!form.id && !form.password)}>
              <Save className="mr-2 h-4 w-4" />
              {save.isPending ? 'Salvando...' : 'Salvar usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
