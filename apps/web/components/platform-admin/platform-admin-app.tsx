'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  Building2,
  Database,
  Flag,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PackageCheck,
  PlayCircle,
  Search,
  ServerCog,
  ShieldCheck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  clearPlatformAdminTokens,
  getPlatformAdminAccessToken,
  getPlatformAdminRefreshToken,
  platformAdminApi,
} from '@/lib/platform-admin-api';

type SectionKey = 'dashboard' | 'companies' | 'modules' | 'plans' | 'users' | 'security' | 'technical' | 'audit';

interface SectionItem {
  key: SectionKey;
  label: string;
  icon: LucideIcon;
}

interface PlatformProfile {
  id: string;
  email: string;
  name: string;
  jobTitle?: string | null;
  roles: { code: string; name: string }[];
  permissions: string[];
}

interface CompanyRow {
  id: string;
  name: string;
  tradeName?: string | null;
  cnpj?: string | null;
  status: string;
  createdAt: string;
  profile?: {
    internalCode?: string | null;
    lifecycleStatus: string;
    planCode?: string | null;
    contractEndsAt?: string | null;
    healthScore: number;
    storageUsedMb: number;
    storageLimitMb?: number | null;
  } | null;
  usage: { users: number; modules: number; lastAccessAt?: string | null };
}

interface ModuleCatalog {
  code: string;
  name: string;
  category?: string | null;
  route?: string | null;
  globalStatus: string;
  version?: string | null;
  technicalOwner?: string | null;
  experimental: boolean;
}

interface MatrixCompany {
  id: string;
  name: string;
  tradeName?: string | null;
  modules: { moduleCode: string; status: string; readOnly: boolean; note?: string | null }[];
}

interface AuditRow {
  id: string;
  userEmail?: string | null;
  action: string;
  companyId?: string | null;
  moduleCode?: string | null;
  targetLabel?: string | null;
  result: string;
  justification?: string | null;
  createdAt: string;
}

const SECTIONS: SectionItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'companies', label: 'Empresas', icon: Building2 },
  { key: 'modules', label: 'Matriz de Modulos', icon: PackageCheck },
  { key: 'plans', label: 'Planos', icon: ListChecks },
  { key: 'users', label: 'Usuarios', icon: Users },
  { key: 'security', label: 'Seguranca e Suporte', icon: ShieldCheck },
  { key: 'technical', label: 'Desenvolvimento', icon: ServerCog },
  { key: 'audit', label: 'Auditoria', icon: Activity },
];

const MODULE_STATUSES = [
  'ATIVO',
  'BLOQUEADO',
  'SUSPENSO',
  'SOMENTE_LEITURA',
  'EM_IMPLANTACAO',
  'EM_TESTE',
  'ATIVACAO_PROGRAMADA',
  'EXPIRACAO_PROGRAMADA',
  'EXPERIMENTAL',
  'HERDADO_DO_PLANO',
  'SOBRESCRITO_MANUALMENTE',
];

export function PlatformAdminApp() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<SectionKey>('dashboard');

  const me = useQuery({
    queryKey: ['platform-admin', 'me'],
    queryFn: () => platformAdminApi<PlatformProfile>('/auth/me'),
    retry: false,
  });

  useEffect(() => {
    if (!getPlatformAdminAccessToken()) router.replace('/platform-admin/login');
  }, [router]);

  useEffect(() => {
    if (me.isError) {
      clearPlatformAdminTokens();
      router.replace('/platform-admin/login');
    }
  }, [me.isError, router]);

  const sync = useMutation({
    mutationFn: () => platformAdminApi('/sync-foundation', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Fundacao sincronizada');
      void queryClient.invalidateQueries({ queryKey: ['platform-admin'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao sincronizar'),
  });

  async function logout() {
    const refreshToken = getPlatformAdminRefreshToken();
    await platformAdminApi('/auth/logout', { method: 'POST', json: { refreshToken } }).catch(() => undefined);
    clearPlatformAdminTokens();
    router.replace('/platform-admin/login');
  }

  if (me.isLoading) {
    return <div className="grid min-h-screen place-items-center bg-[#f4f7f8] text-sm text-muted-foreground">Carregando Portal Admin Global...</div>;
  }

  return (
    <main className="flex h-screen overflow-hidden bg-[#f4f7f8] text-foreground">
      <aside className="hidden w-[280px] shrink-0 border-r bg-[#101820] text-white lg:flex lg:flex-col">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Gestao 360</div>
          <div className="mt-1 text-lg font-semibold">Portal Admin Global</div>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto p-2">
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const active = section === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSection(item.key)}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors',
                  active ? 'bg-white text-[#101820]' : 'text-white/70 hover:bg-white/10 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3 text-xs text-white/55">
          <div className="font-medium text-white">{me.data?.name}</div>
          <div className="truncate">{me.data?.email}</div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-white px-4 lg:px-6">
          <div>
            <div className="text-sm font-semibold">{SECTIONS.find((item) => item.key === section)?.label}</div>
            <div className="text-xs text-muted-foreground">Ambiente interno separado das empresas clientes</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
              <PlayCircle className="mr-2 h-4 w-4" />
              Sincronizar
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
          {section === 'dashboard' && <DashboardSection />}
          {section === 'companies' && <CompaniesSection />}
          {section === 'modules' && <ModulesSection />}
          {section === 'plans' && <PlansSection />}
          {section === 'users' && <UsersSection />}
          {section === 'security' && <SecuritySection />}
          {section === 'technical' && <TechnicalSection />}
          {section === 'audit' && <AuditSection />}
        </div>
      </section>
    </main>
  );
}

function DashboardSection() {
  const dashboard = useQuery({
    queryKey: ['platform-admin', 'dashboard'],
    queryFn: () => platformAdminApi<{
      cards: Record<string, number | string | null>;
      alerts: { code: string; label: string; count: number }[];
      charts: { modulesMostUsed: { moduleCode: string; companies: number }[]; companiesByPlan: { planCode: string; companies: number }[] };
      health: { status: string; responseMs: number; tables: number; environment: string };
      recentAudit: AuditRow[];
    }>('/dashboard'),
  });

  if (dashboard.isLoading) return <LoadingGrid />;
  if (!dashboard.data) return <EmptyState title="Dashboard indisponivel" />;

  const cards = dashboard.data.cards;
  const metricKeys = [
    ['totalCompanies', 'Empresas'],
    ['activeCompanies', 'Ativas'],
    ['suspendedCompanies', 'Suspensas'],
    ['implementationCompanies', 'Implantacao'],
    ['trialCompanies', 'Teste'],
    ['totalUsers', 'Usuarios'],
    ['activeUsers7d', 'Ativos 7d'],
    ['activeUsers30d', 'Ativos 30d'],
    ['onlineUsers', 'Online agora'],
    ['accessesToday', 'Acessos hoje'],
    ['accessesMonth', 'Acessos mes'],
    ['recentErrors', 'Erros recentes'],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricKeys.map(([key, label]) => (
          <Metric key={key} label={label} value={cards[key] ?? 0} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr,0.8fr]">
        <Panel title="Alertas administrativos">
          <div className="grid gap-2 sm:grid-cols-2">
            {dashboard.data.alerts.map((alert) => (
              <div key={alert.code} className="flex items-center justify-between border px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{alert.label}</span>
                <span className={cn('pill', alert.count > 0 ? 'pill-yellow' : 'pill-green')}>{alert.count}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Saude tecnica">
          <div className="grid gap-2 text-sm">
            <Row label="Banco" value={dashboard.data.health.status} />
            <Row label="Ambiente" value={dashboard.data.health.environment} />
            <Row label="Tabelas" value={dashboard.data.health.tables} />
            <Row label="Resposta media" value={`${dashboard.data.health.responseMs} ms`} />
            <Row label="Versao publicada" value={cards.currentVersion ?? '-'} />
            <Row label="Ultimo backup" value={formatDate(cards.lastBackupAt)} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Modulos mais utilizados">
          <Bars data={dashboard.data.charts.modulesMostUsed.map((item) => ({ label: item.moduleCode, value: item.companies }))} />
        </Panel>
        <Panel title="Empresas por plano">
          <Bars data={dashboard.data.charts.companiesByPlan.map((item) => ({ label: item.planCode, value: item.companies }))} />
        </Panel>
      </div>

      <Panel title="Atividades recentes">
        <AuditTable rows={dashboard.data.recentAudit} />
      </Panel>
    </div>
  );
}

function CompaniesSection() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', tradeName: '', cnpj: '', planCode: 'ESSENCIAL', lifecycleStatus: 'ACTIVE' });
  const companies = useQuery({
    queryKey: ['platform-admin', 'companies', q],
    queryFn: () => platformAdminApi<{ rows: CompanyRow[]; total: number }>(`/companies${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  });
  const detail = useQuery({
    queryKey: ['platform-admin', 'company', selectedId],
    queryFn: () => platformAdminApi<{ company: CompanyRow; profile: CompanyRow['profile']; usage: Record<string, number>; users: unknown[]; modules: { module: ModuleCatalog; assignment: { status: string; note?: string | null } | null }[]; logs: AuditRow[] }>(`/companies/${selectedId}`),
    enabled: Boolean(selectedId),
  });
  const create = useMutation({
    mutationFn: () => platformAdminApi('/companies', { method: 'POST', json: form }),
    onSuccess: () => {
      toast.success('Empresa cadastrada');
      setForm({ name: '', tradeName: '', cnpj: '', planCode: 'ESSENCIAL', lifecycleStatus: 'ACTIVE' });
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'companies'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao cadastrar'),
  });
  const status = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) =>
      platformAdminApi(`/companies/${id}/status`, { method: 'PATCH', json: { status: next, reason: `Alteracao via Portal Admin Global para ${next}` } }),
    onSuccess: () => {
      toast.success('Status atualizado');
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'companies'] });
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'company'] });
    },
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr,390px]">
      <div className="space-y-4">
        <Panel title="Empresas" actions={<SearchBox value={q} onChange={setQ} />}>
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>CNPJ</th>
                  <th>Plano</th>
                  <th>Status</th>
                  <th>Usuarios</th>
                  <th>Modulos</th>
                  <th>Ultimo acesso</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {(companies.data?.rows ?? []).map((company) => (
                  <tr key={company.id}>
                    <td>
                      <button type="button" className="text-left font-medium hover:underline" onClick={() => setSelectedId(company.id)}>
                        {company.tradeName || company.name}
                      </button>
                      <div className="text-xs text-muted-foreground">{company.profile?.internalCode ?? company.name}</div>
                    </td>
                    <td>{company.cnpj ?? '-'}</td>
                    <td>{company.profile?.planCode ?? '-'}</td>
                    <td><Status value={company.profile?.lifecycleStatus ?? company.status} /></td>
                    <td>{company.usage.users}</td>
                    <td>{company.usage.modules}</td>
                    <td>{formatDate(company.usage.lastAccessAt)}</td>
                    <td className="space-x-1 whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => status.mutate({ id: company.id, next: 'ACTIVE' })}>Ativar</Button>
                      <Button size="sm" variant="outline" onClick={() => status.mutate({ id: company.id, next: 'SUSPENDED' })}>Suspender</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {detail.data && (
          <Panel title={`Detalhe: ${detail.data.company.tradeName || detail.data.company.name}`}>
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="space-y-2 text-sm">
                <Row label="Plano" value={detail.data.profile?.planCode ?? '-'} />
                <Row label="Saude" value={`${detail.data.profile?.healthScore ?? 0}%`} />
                <Row label="Contrato" value={formatDate(detail.data.profile?.contractEndsAt)} />
              </div>
              <div className="space-y-2 text-sm">
                {Object.entries(detail.data.usage).map(([key, value]) => <Row key={key} label={key} value={value} />)}
              </div>
              <div className="space-y-2">
                {detail.data.modules.slice(0, 8).map((item) => (
                  <div key={item.module.code} className="flex items-center justify-between border px-2 py-1 text-xs">
                    <span>{item.module.name}</span>
                    <Status value={item.assignment?.status ?? 'HERDADO_DO_PLANO'} />
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        )}
      </div>

      <Panel title="Cadastrar empresa">
        <div className="space-y-3">
          <Field label="Razao social" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
          <Field label="Nome fantasia" value={form.tradeName} onChange={(value) => setForm((prev) => ({ ...prev, tradeName: value }))} />
          <Field label="CNPJ" value={form.cnpj} onChange={(value) => setForm((prev) => ({ ...prev, cnpj: value }))} />
          <Label className="text-xs">Plano</Label>
          <select className="h-10 w-full border bg-background px-3 text-sm" value={form.planCode} onChange={(event) => setForm((prev) => ({ ...prev, planCode: event.target.value }))}>
            {['ESSENCIAL', 'PROFISSIONAL', 'CORPORATIVO', 'ENTERPRISE', 'PERSONALIZADO'].map((plan) => <option key={plan}>{plan}</option>)}
          </select>
          <Label className="text-xs">Status de implantacao</Label>
          <select className="h-10 w-full border bg-background px-3 text-sm" value={form.lifecycleStatus} onChange={(event) => setForm((prev) => ({ ...prev, lifecycleStatus: event.target.value }))}>
            {['ACTIVE', 'IMPLEMENTATION', 'TRIAL', 'SUSPENDED'].map((item) => <option key={item}>{item}</option>)}
          </select>
          <Button className="w-full" onClick={() => create.mutate()} disabled={create.isPending || !form.name}>Cadastrar</Button>
        </div>
      </Panel>
    </div>
  );
}

function ModulesSection() {
  const queryClient = useQueryClient();
  const [change, setChange] = useState<Record<string, string>>({});
  const matrix = useQuery({
    queryKey: ['platform-admin', 'module-matrix'],
    queryFn: () => platformAdminApi<{ modules: ModuleCatalog[]; companies: MatrixCompany[] }>('/module-matrix'),
  });
  const update = useMutation({
    mutationFn: ({ companyId, moduleCode, status }: { companyId: string; moduleCode: string; status: string }) =>
      platformAdminApi(`/companies/${companyId}/modules/${moduleCode}`, { method: 'PATCH', json: { status, reason: `Alteracao de modulo para ${status}` } }),
    onSuccess: () => {
      toast.success('Modulo atualizado');
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'module-matrix'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao atualizar modulo'),
  });

  if (matrix.isLoading) return <LoadingGrid />;
  if (!matrix.data) return <EmptyState title="Matriz indisponivel" />;
  const modules = matrix.data.modules.slice(0, 12);

  return (
    <div className="space-y-4">
      <Panel title="Catalogo de modulos">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {matrix.data.modules.map((module) => (
            <div key={module.code} className="border bg-white p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{module.name}</div>
                <Status value={module.globalStatus} />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{module.category ?? '-'} · {module.version ?? '1.0.0'}</div>
              <div className="mt-2 text-xs">Resp.: {module.technicalOwner ?? '-'}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Matriz de modulos por empresa">
        <div className="overflow-x-auto">
          <table className="table-modern min-w-[980px]">
            <thead>
              <tr>
                <th>Empresa</th>
                {modules.map((module) => <th key={module.code}>{module.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {matrix.data.companies.map((company) => (
                <tr key={company.id}>
                  <td className="font-medium">{company.tradeName || company.name}</td>
                  {modules.map((module) => {
                    const current = company.modules.find((item) => item.moduleCode === module.code)?.status ?? 'HERDADO_DO_PLANO';
                    const key = `${company.id}:${module.code}`;
                    const selected = change[key] ?? current;
                    return (
                      <td key={key} className="min-w-[190px]">
                        <div className="flex items-center gap-2">
                          <select className="h-8 flex-1 border bg-background px-2 text-xs" value={selected} onChange={(event) => setChange((prev) => ({ ...prev, [key]: event.target.value }))}>
                            {MODULE_STATUSES.map((status) => <option key={status}>{status}</option>)}
                          </select>
                          <Button size="sm" variant="outline" disabled={selected === current || update.isPending} onClick={() => update.mutate({ companyId: company.id, moduleCode: module.code, status: selected })}>Salvar</Button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function PlansSection() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ code: '', name: '', monthlyPriceCents: '0', defaultUsers: '' });
  const plans = useQuery({
    queryKey: ['platform-admin', 'plans'],
    queryFn: () => platformAdminApi<Array<{ code: string; name: string; monthlyPriceCents: number; defaultUsers?: number | null; modules: unknown[] }>>('/plans'),
  });
  const save = useMutation({
    mutationFn: () => platformAdminApi('/plans', { method: 'POST', json: { ...form, monthlyPriceCents: Number(form.monthlyPriceCents), defaultUsers: form.defaultUsers ? Number(form.defaultUsers) : null } }),
    onSuccess: () => {
      toast.success('Plano salvo');
      setForm({ code: '', name: '', monthlyPriceCents: '0', defaultUsers: '' });
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'plans'] });
    },
  });
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr,360px]">
      <Panel title="Planos comerciais">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(plans.data ?? []).map((plan) => (
            <div key={plan.code} className="border bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{plan.name}</div>
                <Status value={plan.code} />
              </div>
              <div className="mt-3 text-2xl font-semibold">{formatMoney(plan.monthlyPriceCents)}</div>
              <div className="mt-2 text-sm text-muted-foreground">{plan.defaultUsers ?? 'Ilimitado'} usuarios · {plan.modules.length} modulos</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Novo ou atualizar plano">
        <div className="space-y-3">
          <Field label="Codigo" value={form.code} onChange={(value) => setForm((prev) => ({ ...prev, code: value.toUpperCase() }))} />
          <Field label="Nome" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
          <Field label="Mensalidade em centavos" value={form.monthlyPriceCents} onChange={(value) => setForm((prev) => ({ ...prev, monthlyPriceCents: value }))} />
          <Field label="Usuarios padrao" value={form.defaultUsers} onChange={(value) => setForm((prev) => ({ ...prev, defaultUsers: value }))} />
          <Button className="w-full" disabled={!form.code || !form.name || save.isPending} onClick={() => save.mutate()}>Salvar plano</Button>
        </div>
      </Panel>
    </div>
  );
}

function UsersSection() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const users = useQuery({
    queryKey: ['platform-admin', 'users', q],
    queryFn: () => platformAdminApi<Array<{ id: string; name: string; email: string; role: string; status: string; active: boolean; lastLoginAt?: string | null; company: { name: string; tradeName?: string | null }; refreshTokens: unknown[] }>>(`/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => platformAdminApi(`/users/${id}/status`, { method: 'PATCH', json: { status } }),
    onSuccess: () => {
      toast.success('Usuario atualizado');
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'users'] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => platformAdminApi(`/users/${id}/revoke-sessions`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Sessoes revogadas');
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'users'] });
    },
  });
  return (
    <Panel title="Usuarios das empresas" actions={<SearchBox value={q} onChange={setQ} />}>
      <div className="overflow-x-auto">
        <table className="table-modern">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Empresa</th>
              <th>Perfil</th>
              <th>Status</th>
              <th>Ultimo acesso</th>
              <th>Sessoes</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {(users.data ?? []).map((user) => (
              <tr key={user.id}>
                <td><div className="font-medium">{user.name}</div><div className="text-xs text-muted-foreground">{user.email}</div></td>
                <td>{user.company.tradeName || user.company.name}</td>
                <td>{user.role}</td>
                <td><Status value={user.status} /></td>
                <td>{formatDate(user.lastLoginAt)}</td>
                <td>{user.refreshTokens.length}</td>
                <td className="space-x-1 whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: user.id, status: user.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED' })}>{user.status === 'BLOCKED' ? 'Desbloquear' : 'Bloquear'}</Button>
                  <Button size="sm" variant="outline" onClick={() => revoke.mutate(user.id)}>Revogar</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function SecuritySection() {
  const queryClient = useQueryClient();
  const [support, setSupport] = useState({ companyId: '', reason: 'Diagnostico tecnico', justification: '', minutes: '60' });
  const sessions = useQuery({
    queryKey: ['platform-admin', 'sessions'],
    queryFn: () => platformAdminApi<{ companySessions: unknown[]; adminSessions: unknown[] }>('/sessions'),
  });
  const companies = useQuery({
    queryKey: ['platform-admin', 'companies', 'support'],
    queryFn: () => platformAdminApi<{ rows: CompanyRow[] }>('/companies?take=200'),
  });
  const start = useMutation({
    mutationFn: () => platformAdminApi('/support-sessions', { method: 'POST', json: { ...support, minutes: Number(support.minutes), readOnly: true } }),
    onSuccess: () => {
      toast.success('Modo de suporte iniciado');
      setSupport((prev) => ({ ...prev, justification: '' }));
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'sessions'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao iniciar suporte'),
  });
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Sessoes abertas">
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="Sessoes de empresas" value={sessions.data?.companySessions.length ?? 0} />
          <Metric label="Sessoes internas" value={sessions.data?.adminSessions.length ?? 0} />
        </div>
      </Panel>
      <Panel title="Modo seguro de suporte">
        <div className="space-y-3">
          <Label className="text-xs">Empresa</Label>
          <select className="h-10 w-full border bg-background px-3 text-sm" value={support.companyId} onChange={(event) => setSupport((prev) => ({ ...prev, companyId: event.target.value }))}>
            <option value="">Selecione</option>
            {(companies.data?.rows ?? []).map((company) => <option key={company.id} value={company.id}>{company.tradeName || company.name}</option>)}
          </select>
          <Field label="Motivo" value={support.reason} onChange={(value) => setSupport((prev) => ({ ...prev, reason: value }))} />
          <Field label="Justificativa" value={support.justification} onChange={(value) => setSupport((prev) => ({ ...prev, justification: value }))} />
          <Field label="Minutos" value={support.minutes} onChange={(value) => setSupport((prev) => ({ ...prev, minutes: value }))} />
          <Button className="w-full" disabled={!support.companyId || !support.justification || start.isPending} onClick={() => start.mutate()}>Iniciar somente leitura</Button>
        </div>
      </Panel>
    </div>
  );
}

function TechnicalSection() {
  const database = useQuery({ queryKey: ['platform-admin', 'database'], queryFn: () => platformAdminApi<{ health: Record<string, unknown>; backups: unknown[]; migrations: unknown[] }>('/database') });
  const flags = useQuery({ queryKey: ['platform-admin', 'feature-flags'], queryFn: () => platformAdminApi<{ flags: Array<{ key: string; name: string; enabled: boolean; environment?: string | null }>; targets: unknown[] }>('/feature-flags') });
  const envs = useQuery({ queryKey: ['platform-admin', 'environments'], queryFn: () => platformAdminApi<{ environments: Array<{ code: string; name: string; status: string; currentVersion?: string | null }>; releases: unknown[] }>('/environments') });
  const integrations = useQuery({ queryKey: ['platform-admin', 'integrations'], queryFn: () => platformAdminApi<Array<{ code: string; name: string; status: string; maskedSecret?: string | null }>>('/integrations') });
  const jobs = useQuery({ queryKey: ['platform-admin', 'jobs'], queryFn: () => platformAdminApi<Array<{ id: string; name: string; status: string; moduleCode?: string | null; error?: string | null }>>('/jobs') });

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Banco de dados e integridade" icon={Database}>
        <div className="space-y-2 text-sm">
          {Object.entries(database.data?.health ?? {}).map(([key, value]) => <Row key={key} label={key} value={String(value)} />)}
          <Row label="Backups registrados" value={database.data?.backups.length ?? 0} />
          <Row label="Migracoes rastreadas" value={database.data?.migrations.length ?? 0} />
        </div>
      </Panel>
      <Panel title="Ambientes e versoes" icon={ServerCog}>
        <div className="space-y-2">
          {(envs.data?.environments ?? []).map((env) => (
            <div key={env.code} className="flex items-center justify-between border px-3 py-2 text-sm">
              <span>{env.name}</span>
              <span className="text-muted-foreground">{env.currentVersion ?? '-'} · {env.status}</span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Funcionalidades e experimentos" icon={Flag}>
        <div className="space-y-2">
          {(flags.data?.flags ?? []).map((flag) => (
            <div key={flag.key} className="flex items-center justify-between border px-3 py-2 text-sm">
              <span>{flag.key}</span>
              <Status value={flag.enabled ? 'ATIVO' : 'BLOQUEADO'} />
            </div>
          ))}
          {(flags.data?.flags ?? []).length === 0 && <EmptyState title="Nenhuma flag cadastrada" />}
        </div>
      </Panel>
      <Panel title="Integracoes e jobs" icon={Wrench}>
        <div className="grid gap-3">
          {(integrations.data ?? []).map((item) => (
            <div key={item.code} className="flex items-center justify-between border px-3 py-2 text-sm">
              <span>{item.name}</span>
              <Status value={item.status} />
            </div>
          ))}
          {(jobs.data ?? []).slice(0, 8).map((job) => (
            <div key={job.id} className="flex items-center justify-between border px-3 py-2 text-sm">
              <span>{job.name}</span>
              <Status value={job.status} />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function AuditSection() {
  const [q, setQ] = useState('');
  const audit = useQuery({
    queryKey: ['platform-admin', 'audit', q],
    queryFn: () => platformAdminApi<{ rows: AuditRow[]; total: number }>(`/audit${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  });
  return (
    <Panel title="Trilha de auditoria da plataforma" actions={<SearchBox value={q} onChange={setQ} />}>
      <AuditTable rows={audit.data?.rows ?? []} />
    </Panel>
  );
}

function Panel({ title, children, actions, icon: Icon }: { title: string; children: React.ReactNode; actions?: React.ReactNode; icon?: LucideIcon }) {
  return (
    <section className="border bg-white">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          <h2 className="truncate text-sm font-semibold">{title}</h2>
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="border bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value ?? '-'}</div>
    </div>
  );
}

function Status({ value }: { value: string }) {
  const normalized = value.toUpperCase();
  const tone = normalized.includes('ATIVO') || normalized === 'ACTIVE' || normalized === 'ONLINE' || normalized === 'SUCCESS' ? 'pill-green'
    : normalized.includes('BLOQUE') || normalized.includes('SUSP') || normalized === 'ERROR' || normalized === 'FAILED' ? 'pill-red'
      : normalized.includes('PENDING') || normalized.includes('TESTE') || normalized.includes('IMPLANT') ? 'pill-yellow'
        : 'pill-gray';
  return <span className={cn('pill whitespace-nowrap', tone)}>{value}</span>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-1 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replace(/\W+/g, '-');
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(event) => onChange(event.target.value)} className="pl-8" placeholder="Buscar" />
    </div>
  );
}

function AuditTable({ rows }: { rows: AuditRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="table-modern">
        <thead>
          <tr>
            <th>Quando</th>
            <th>Usuario</th>
            <th>Acao</th>
            <th>Alvo</th>
            <th>Modulo</th>
            <th>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{formatDate(row.createdAt)}</td>
              <td>{row.userEmail ?? '-'}</td>
              <td>{row.action}</td>
              <td>{row.targetLabel ?? row.companyId ?? '-'}</td>
              <td>{row.moduleCode ?? '-'}</td>
              <td><Status value={row.result} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <EmptyState title="Nenhum registro encontrado" />}
    </div>
  );
}

function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="space-y-2">
      {data.length === 0 && <EmptyState title="Sem dados suficientes" />}
      {data.map((item) => (
        <div key={item.label} className="grid grid-cols-[130px,1fr,42px] items-center gap-3 text-sm">
          <span className="truncate text-muted-foreground">{item.label}</span>
          <div className="h-2 bg-muted">
            <div className="h-2 bg-[#2a6f68]" style={{ width: `${Math.max(5, (item.value / max) * 100)}%` }} />
          </div>
          <span className="text-right font-medium">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse border bg-white" />
      ))}
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="grid min-h-24 place-items-center border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        {title}
      </div>
    </div>
  );
}

function formatDate(value: unknown) {
  if (!value || typeof value !== 'string') return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}
