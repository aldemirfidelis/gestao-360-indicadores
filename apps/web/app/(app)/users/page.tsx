'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Edit, KeyRound, Plus, Save, Search, UsersRound } from 'lucide-react';
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
  status: string;
  jobTitle: string | null;
  phone?: string | null;
  active: boolean;
  lastLoginAt: string | null;
  branchId?: string | null;
  branch?: { id: string; name: string; code: string | null } | null;
  accessProfileId?: string | null;
  accessProfile?: { id: string; code: string; name: string } | null;
  passwordResetRequired?: boolean;
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

interface AdminBootstrapLite {
  branches: { id: string; name: string; code: string | null }[];
  profiles: { id: string; code: string; name: string; role: string | null }[];
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
  branchId: '',
  accessProfileId: '',
  status: 'ACTIVE',
  passwordResetRequired: false,
  defaultNodeId: '',
  active: true,
  permissionKeys: [] as string[],
};

type UserForm = typeof emptyForm;

export default function UsersPage() {
  const qc = useQueryClient();
  const { user: me, hasPermission } = useAuth();
  const canCreate = hasPermission(['users:create', 'users:manage']);
  const canUpdate = hasPermission(['users:update', 'users:manage']);
  const canPermissions = hasPermission(['users:permissions', 'users:manage']);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<UserForm>(emptyForm);
  const searchParams = useSearchParams();

  // Deep-link "/users?new=1" (ex.: vindo da Central de Administração) abre o cadastro direto.
  useEffect(() => {
    if (searchParams.get('new') === '1' && canCreate) {
      setForm(emptyForm);
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
  const admin = useQuery<AdminBootstrapLite>({
    queryKey: ['admin', 'bootstrap', 'users-lite'],
    queryFn: () => api<AdminBootstrapLite>('/admin/bootstrap'),
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
        branchId: form.branchId || null,
        accessProfileId: form.accessProfileId || null,
        status: form.status,
        active: form.status === 'ACTIVE',
        passwordResetRequired: form.passwordResetRequired,
        defaultNodeId: form.defaultNodeId || null,
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
      if (canPermissions) {
        await api(`/users/${userId}/permissions`, {
          method: 'PATCH',
          json: { permissionKeys: form.permissionKeys },
        });
      }
      return userId;
    },
    onSuccess: () => {
      toast.success('Usuário salvo');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar usuário'),
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
  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return (users.data ?? []).filter((u) =>
      [u.name, u.email, u.role, u.status, u.jobTitle ?? '', u.branch?.name ?? '', u.defaultNode?.name ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [search, users.data]);

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
        branchId: user.branch?.id ?? user.branchId ?? '',
        accessProfileId: user.accessProfile?.id ?? user.accessProfileId ?? '',
        status: user.status ?? (user.active ? 'ACTIVE' : 'INACTIVE'),
        passwordResetRequired: user.passwordResetRequired ?? false,
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
        eyebrow="Empresa"
        tone="admin"
        title="Usuários da empresa"
        description="Crie e mantenha usuários vinculados somente à empresa atual."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Usuários' }]}
        actions={
          canCreate ? (
            <Button onClick={() => openUser()}>
              <Plus className="mr-2 h-4 w-4" />
              Novo usuário
            </Button>
          ) : null
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard title="Usuários" value={formatNumber(users.data?.length)} description="Cadastrados" icon={<UsersRound className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Ativos" value={formatNumber(active)} description="Com acesso liberado" icon={<UsersRound className="h-4 w-4" />} tone="green" />
        <MetricCard title="Administradores" value={formatNumber(admins)} description="Perfil administrativo" icon={<KeyRound className="h-4 w-4" />} tone="purple" />
      </div>

      <SectionCard title="Equipe" description="Cadastros e acessos da empresa atual." contentClassName="p-0">
        <div className="border-b p-3">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Pesquisar por nome, e-mail, perfil, filial ou setor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th className="text-left">Usuário</th>
                <th className="text-left">Cargo</th>
                <th className="text-left">Filial</th>
                <th className="text-left">Perfil</th>
                <th className="text-left">Perfil acesso</th>
                <th className="text-left">Área</th>
                <th className="text-left">Permissões</th>
                <th className="text-left">Último acesso</th>
                <th className="text-left">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td>{u.jobTitle ?? '-'}</td>
                  <td>{u.branch?.name ?? '-'}</td>
                  <td><Badge variant="outline">{ROLE_LABEL[u.role] ?? u.role}</Badge></td>
                  <td>{u.accessProfile?.name ?? '-'}</td>
                  <td>{u.defaultNode?.name ?? '-'}</td>
                  <td>{u.permissions?.length ?? 0}</td>
                  <td className="text-xs">{formatDate(u.lastLoginAt)}</td>
                  <td><StatusBadge value={u.active ? 'ACTIVE' : 'CANCELLED'} label={u.status === 'BLOCKED' ? 'Bloqueado' : u.status === 'PENDING' ? 'Pendente' : u.active ? 'Ativo' : 'Inativo'} /></td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      {canUpdate && (
                        <Button variant="outline" size="sm" onClick={() => openUser(u)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </Button>
                      )}
                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActive.mutate({ id: u.id, active: !u.active })}
                        >
                          {u.active ? 'Inativar' : 'Ativar'}
                        </Button>
                      )}
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
            <DialogTitle>{form.id ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
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
                  <NativeSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value, active: e.target.value === 'ACTIVE' })}>
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                    <option value="BLOCKED">Bloqueado</option>
                    <option value="PENDING">Pendente</option>
                  </NativeSelect>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>Filial</Label>
                  <NativeSelect value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                    <option value="">Sem filial</option>
                    {admin.data?.branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div>
                  <Label>Perfil de acesso</Label>
                  <NativeSelect value={form.accessProfileId} onChange={(e) => setForm({ ...form, accessProfileId: e.target.value })}>
                    <option value="">Permissões individuais</option>
                    {admin.data?.profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>{profile.name}</option>
                    ))}
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
                <Label>Área padrão</Label>
                <NativeSelect value={form.defaultNodeId} onChange={(e) => setForm({ ...form, defaultNodeId: e.target.value })}>
                  <option value="">Sem área padrão</option>
                  {orgs.data?.map((node) => (
                    <option key={node.id} value={node.id}>{node.name} ({node.type})</option>
                  ))}
                </NativeSelect>
              </div>
              <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.passwordResetRequired}
                  onChange={(e) => setForm({ ...form, passwordResetRequired: e.target.checked })}
                />
                Exigir troca de senha no próximo acesso
              </label>
            </div>

            {canPermissions ? (
              <div className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Permissões</div>
                    <div className="text-xs text-muted-foreground">Marque os acessos liberados para este usuário.</div>
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
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Você não possui permissão para alterar permissões deste usuário.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name || !form.email || (!form.id && !form.password)}>
              <Save className="mr-2 h-4 w-4" />
              {save.isPending ? 'Salvando...' : 'Salvar usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
