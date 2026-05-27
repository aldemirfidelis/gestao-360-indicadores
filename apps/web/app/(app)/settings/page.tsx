'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2,
  CheckCircle2,
  Edit,
  FileDown,
  GitBranch,
  KeyRound,
  Layers3,
  Plus,
  Save,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { useAuth } from '@/components/auth/auth-provider';

type ModuleKey = 'users' | 'audit' | 'parameters' | 'security' | 'system';
type ParamView = 'companies' | 'branches' | 'structure' | 'categories' | 'items';

interface Company {
  id: string;
  name: string;
  tradeName: string | null;
  cnpj: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  branches: Branch[];
}

interface Branch {
  id: string;
  companyId: string;
  name: string;
  code: string | null;
  city: string | null;
  state: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface OrgNode {
  id: string;
  parentId: string | null;
  branchId: string | null;
  name: string;
  code: string | null;
  type: string;
  active: boolean;
  responsibleUser: { id: string; name: string } | null;
  _count?: { children: number; indicatorsOwned: number };
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  active: boolean;
  lastLoginAt: string | null;
}

interface Permission {
  id: string;
  key: string;
  description: string;
  module: string;
  action: string;
}

interface AccessProfile {
  id: string;
  code: string;
  name: string;
  description: string | null;
  role: string | null;
  status: string;
  system: boolean;
  permissions: { permission: Permission }[];
  _count?: { users: number };
}

interface ParameterItem {
  id: string;
  categoryId: string;
  parentId: string | null;
  code: string;
  name: string;
  description: string | null;
  status: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ParameterCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  module: string | null;
  status: string;
  system: boolean;
  sortOrder: number;
  items: ParameterItem[];
}

interface AppSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  valueType: string | null;
  group: string | null;
  active: boolean;
  updatedAt: string;
}

interface Bootstrap {
  companies: Company[];
  branches: Branch[];
  orgNodes: OrgNode[];
  users: UserRow[];
  categories: ParameterCategory[];
  profiles: AccessProfile[];
  permissions: Permission[];
  settings: AppSetting[];
  auditCount: number;
}

const EMPTY_BOOTSTRAP: Bootstrap = {
  companies: [],
  branches: [],
  orgNodes: [],
  users: [],
  categories: [],
  profiles: [],
  permissions: [],
  settings: [],
  auditCount: 0,
};

const modules: Array<{ key: ModuleKey; title: string; description: string; icon: any; tone: string }> = [
  { key: 'users', title: 'Usuários', description: 'Gerencie usuários, perfis, permissões e acessos.', icon: UsersRound, tone: 'text-status-blue bg-status-blue/10' },
  { key: 'audit', title: 'Auditoria', description: 'Acompanhe tudo o que acontece no sistema.', icon: ScrollText, tone: 'text-status-green bg-status-green/10' },
  { key: 'parameters', title: 'Parâmetros', description: 'Configure empresas, filiais, setores e cadastros base.', icon: SlidersHorizontal, tone: 'text-status-purple bg-status-purple/10' },
  { key: 'security', title: 'Seguranca', description: 'Controle perfis, permissões e acessos por módulo.', icon: ShieldCheck, tone: 'text-status-red bg-status-red/10' },
  { key: 'system', title: 'Sistema', description: 'Configure notificações, aprovações e regras globais.', icon: Settings, tone: 'text-status-yellow bg-status-yellow/10' },
];

const adminCards: Array<{ title: string; description: string; icon: any; active: ModuleKey; view?: ParamView; tone: string }> = [
  { title: 'Usuários', description: 'Acessos, status, vínculos e responsáveis.', icon: UsersRound, active: 'users', tone: 'text-status-blue bg-status-blue/10' },
  { title: 'Permissões', description: 'Regras por módulo e ações autorizadas.', icon: KeyRound, active: 'security', tone: 'text-status-purple bg-status-purple/10' },
  { title: 'Perfis de acesso', description: 'Perfis corporativos e permissões agrupadas.', icon: ShieldCheck, active: 'security', tone: 'text-status-red bg-status-red/10' },
  { title: 'Auditoria', description: 'Logs por usuário, data, módulo e resultado.', icon: ScrollText, active: 'audit', tone: 'text-status-green bg-status-green/10' },
  { title: 'Parâmetros', description: 'Tipos, status, prioridades e cadastros base.', icon: SlidersHorizontal, active: 'parameters', view: 'categories', tone: 'text-status-yellow bg-status-yellow/10' },
  { title: 'Empresas', description: 'Empresas, dados cadastrais e status.', icon: Building2, active: 'parameters', view: 'companies', tone: 'text-status-blue bg-status-blue/10' },
  { title: 'Filiais', description: 'Unidades de negócio e localizações.', icon: GitBranch, active: 'parameters', view: 'branches', tone: 'text-status-purple bg-status-purple/10' },
  { title: 'Áreas e Setores', description: 'Hierarquia organizacional e processos.', icon: Layers3, active: 'parameters', view: 'structure', tone: 'text-status-green bg-status-green/10' },
  { title: 'Notificações', description: 'Preferências, alertas e regras globais.', icon: Settings, active: 'system', tone: 'text-status-yellow bg-status-yellow/10' },
  { title: 'Sistema', description: 'Configurações gerais e comportamento global.', icon: Settings, active: 'system', tone: 'text-muted-foreground bg-muted' },
];

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  COMPANY_ADMIN: 'Admin',
  DIRECTOR: 'Diretor',
  MANAGER: 'Gestor',
  ANALYST: 'Analista',
  COLLABORATOR: 'Usuário',
  VIEWER: 'Visualizador',
};

const nodeTypeLabels: Record<string, string> = {
  COMPANY: 'Empresa',
  BRANCH: 'Filial',
  UNIT: 'Unidade',
  AREA: 'Área',
  SUBAREA: 'Subarea',
  SECTOR: 'Setor',
  SUBSECTOR: 'Subsetor',
  DEPARTMENT: 'Departamento',
  COST_CENTER: 'Centro de custo',
  MACROPROCESS: 'Macroprocesso',
  PROCESS: 'Processo',
  DIRECTORATE: 'Diretoria',
  MANAGEMENT: 'Gerencia',
  COORDINATION: 'Coordenacao',
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const { hasPermission, loading: authLoading } = useAuth();
  const [active, setActive] = useState<ModuleKey>('parameters');
  const [paramView, setParamView] = useState<ParamView>('companies');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<{ type: string; record?: any } | null>(null);
  const canOpenSettings = hasPermission(['settings:view', 'settings:manage']);

  const query = useQuery<Bootstrap>({
    queryKey: ['admin', 'bootstrap'],
    queryFn: () => withTimeout(api<Bootstrap>('/admin/bootstrap'), 15000, 'Tempo excedido ao carregar configurações.'),
    enabled: canOpenSettings,
    retry: 1,
  });

  const data = query.data ?? EMPTY_BOOTSTRAP;
  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return (data?.users ?? []).filter((user) =>
      [user.name, user.email, user.role, user.status].some((value) => value.toLowerCase().includes(q)),
    );
  }, [data?.users, search]);

  const allItems = useMemo(
    () => (data?.categories ?? []).flatMap((category) => category.items.map((item) => ({ ...item, category }))),
    [data?.categories],
  );

  const save = useMutation({
    mutationFn: async ({ type, payload, id }: { type: string; payload: any; id?: string }) => {
      const endpoints: Record<string, string> = {
        company: '/admin/companies',
        branch: '/admin/branches',
        category: '/admin/parameters/categories',
        item: '/admin/parameters/items',
        profile: '/admin/security/profiles',
        setting: '/admin/system/settings',
      };
      const path = endpoints[type];
      if (!path) throw new Error('Tipo de cadastro inválido');
      if (type === 'setting') return api(path, { method: 'PUT', json: payload });
      return api(id ? `${path}/${id}` : path, { method: id ? 'PATCH' : 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success('Cadastro salvo');
      setDialog(null);
      qc.invalidateQueries({ queryKey: ['admin', 'bootstrap'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar'),
  });

  const remove = useMutation({
    mutationFn: ({ type, id }: { type: string; id: string }) => {
      const endpoints: Record<string, string> = {
        company: '/admin/companies',
        branch: '/admin/branches',
        category: '/admin/parameters/categories',
        item: '/admin/parameters/items',
        profile: '/admin/security/profiles',
      };
      return api(`${endpoints[type]}/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast.success('Exclusão lógica realizada');
      qc.invalidateQueries({ queryKey: ['admin', 'bootstrap'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível excluir'),
  });

  if (authLoading || (canOpenSettings && query.isPending && query.fetchStatus !== 'idle')) {
    return <LoadingState label="Carregando configurações..." />;
  }

  if (!canOpenSettings) {
    return (
      <div>
        <PageHeader
          eyebrow="Administração"
          tone="admin"
          title="Configurações"
          description="Central administrativa protegida por permissão."
          breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Configurações' }]}
        />
        <SectionCard title="Acesso restrito" description="Seu perfil não possui permissão para visualizar Configurações.">
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            <ShieldCheck className="mx-auto mb-3 h-8 w-8 opacity-50" />
            Solicite ao Super Admin a permissão adequada para acessar usuários, auditoria, parâmetros, segurança ou sistema.
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administracao"
        tone="admin"
        title="Configurações"
        description="Central administrativa para usuários, auditoria, parâmetros, segurança e regras do sistema."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Configurações' }]}
        actions={
          <Button asChild variant="outline">
            <Link href="/audit">
              <ScrollText className="mr-2 h-4 w-4" />
              Auditoria completa
            </Link>
          </Button>
        }
      />

      {query.isError && (
        <SectionCard
          title="Configurações em modo seguro"
          description="Não foi possível carregar os dados administrativos agora. A tela continua disponível com listas vazias para evitar carregamento infinito."
          className="mb-6 border-status-yellow/30"
          actions={
            <Button variant="outline" onClick={() => query.refetch()}>
              Tentar novamente
            </Button>
          }
        >
          <div className="rounded-lg border border-status-yellow/30 bg-status-yellow/10 p-4 text-sm text-muted-foreground">
            {(query.error as Error)?.message ?? 'Falha ao carregar configurações.'}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Central de Configurações"
        description="Acesso separado da operação diária para usuários, permissões, auditoria, parâmetros e regras globais."
        contentClassName="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"
        className="mb-6"
      >
        {adminCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.title}
              type="button"
              onClick={() => {
                setActive(card.active);
                if (card.view) setParamView(card.view);
              }}
              className={cn(
                'h-full rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent/35',
                active === card.active && (!card.view || card.view === paramView) && 'border-primary/40 bg-primary/5',
              )}
            >
              <div className={cn('grid h-10 w-10 place-items-center rounded-md', card.tone)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-sm font-semibold">{card.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{card.description}</p>
            </button>
          );
        })}
      </SectionCard>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {modules.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActive(item.key)}
              className={cn(
                'rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent/35',
                active === item.key && 'border-primary/40 bg-primary/5',
              )}
            >
              <div className={cn('grid h-10 w-10 place-items-center rounded-md', item.tone)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-sm font-semibold">{item.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
            </button>
          );
        })}
      </div>

      {active === 'users' && (
        <SectionCard
          title="Usuários"
          description="Usuários cadastrados, status, último acesso e atalhos para cadastro completo."
          actions={
            <Button asChild>
              <Link href="/users">
                <Plus className="mr-2 h-4 w-4" />
                Novo usuário
              </Link>
            </Button>
          }
          contentClassName="p-0"
        >
          <Toolbar search={search} setSearch={setSearch} placeholder="Pesquisar por nome, email, perfil ou status..." />
          <DataTable
            headers={['Usuário', 'Perfil', 'Status', 'Último acesso', 'Ações']}
            empty="Nenhum usuário encontrado."
          >
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </td>
                <td><Badge variant="outline">{roleLabels[user.role] ?? user.role}</Badge></td>
                <td><StatusPill status={user.status} label={user.active ? user.status : 'INACTIVE'} /></td>
                <td className="text-xs">{formatDate(user.lastLoginAt)}</td>
                <td className="text-right">
                  <Button asChild variant="outline" size="sm"><Link href="/users">Gerenciar</Link></Button>
                </td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>
      )}

      {active === 'audit' && (
        <SectionCard
          title="Auditoria"
          description="Logs automaticos de ações, acessos, alterações de permissões e parametrizacoes."
          actions={
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/audit">
                  <FileDown className="mr-2 h-4 w-4" />
                  Exportar
                </Link>
              </Button>
              <Button asChild size="sm"><Link href="/audit">Abrir auditoria</Link></Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SummaryTile label="Eventos registrados" value={formatNumber(data?.auditCount)} icon={<ScrollText className="h-4 w-4" />} />
            <SummaryTile label="Usuários monitorados" value={formatNumber(data?.users.length)} icon={<UsersRound className="h-4 w-4" />} />
            <SummaryTile label="Parâmetros auditáveis" value={formatNumber(allItems.length)} icon={<SlidersHorizontal className="h-4 w-4" />} />
          </div>
        </SectionCard>
      )}

      {active === 'parameters' && (
        <SectionCard
          title="Parâmetros"
          description="Cadastros estruturais usados por empresas, filiais, hierarquia, indicadores e tratativas."
          actions={<ParameterActions view={paramView} onNew={(type) => setDialog({ type })} />}
          contentClassName="p-0"
        >
          <div className="border-b p-3">
            <div className="flex flex-wrap gap-2">
              {[
                ['companies', 'Empresas', Building2],
                ['branches', 'Filiais', GitBranch],
                ['structure', 'Hierarquia', Layers3],
                ['categories', 'Categorias', SlidersHorizontal],
                ['items', 'Itens', CheckCircle2],
              ].map(([key, label, Icon]: any) => (
                <Button key={key} variant={paramView === key ? 'default' : 'outline'} size="sm" onClick={() => setParamView(key)}>
                  <Icon className="mr-2 h-4 w-4" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {paramView === 'companies' && (
            <DataTable headers={['Empresa', 'CNPJ', 'Filiais', 'Status', 'Atualizado', 'Ações']} empty="Nenhuma empresa cadastrada.">
              {data?.companies.map((company) => (
                <tr key={company.id}>
                  <td>
                    <div className="font-medium">{company.name}</div>
                    <div className="text-xs text-muted-foreground">{company.tradeName ?? '-'}</div>
                  </td>
                  <td>{company.cnpj ?? '-'}</td>
                  <td>{company.branches.length}</td>
                  <td><StatusPill status={company.active ? 'ACTIVE' : 'INACTIVE'} /></td>
                  <td className="text-xs">{formatDate(company.updatedAt)}</td>
                  <RowActions onEdit={() => setDialog({ type: 'company', record: company })} onDelete={() => confirmDelete('company', company.id)} />
                </tr>
              ))}
            </DataTable>
          )}

          {paramView === 'branches' && (
            <DataTable headers={['Filial', 'Código', 'Localização', 'Status', 'Atualizado', 'Ações']} empty="Nenhuma filial cadastrada.">
              {data?.branches.map((branch) => (
                <tr key={branch.id}>
                  <td className="font-medium">{branch.name}</td>
                  <td>{branch.code ?? '-'}</td>
                  <td>{[branch.city, branch.state].filter(Boolean).join('/') || '-'}</td>
                  <td><StatusPill status={branch.active ? 'ACTIVE' : 'INACTIVE'} /></td>
                  <td className="text-xs">{formatDate(branch.updatedAt)}</td>
                  <RowActions onEdit={() => setDialog({ type: 'branch', record: branch })} onDelete={() => confirmDelete('branch', branch.id)} />
                </tr>
              ))}
            </DataTable>
          )}

          {paramView === 'structure' && (
            <DataTable headers={['Estrutura', 'Tipo', 'Responsável', 'Indicadores', 'Status', 'Ações']} empty="Nenhum no estrutural cadastrado.">
              {data?.orgNodes.map((node) => (
                <tr key={node.id}>
                  <td>
                    <div className="font-medium">{node.name}</div>
                    <div className="text-xs text-muted-foreground">{node.code ?? '-'}</div>
                  </td>
                  <td><Badge variant="outline">{nodeTypeLabels[node.type] ?? node.type}</Badge></td>
                  <td>{node.responsibleUser?.name ?? '-'}</td>
                  <td>{node._count?.indicatorsOwned ?? 0}</td>
                  <td><StatusPill status={node.active ? 'ACTIVE' : 'INACTIVE'} /></td>
                  <td className="text-right"><Button asChild variant="outline" size="sm"><Link href="/org">Gerenciar arvore</Link></Button></td>
                </tr>
              ))}
            </DataTable>
          )}

          {paramView === 'categories' && (
            <DataTable headers={['Categoria', 'Módulo', 'Itens', 'Status', 'Sistema', 'Ações']} empty="Nenhuma categoria cadastrada.">
              {data?.categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <div className="font-medium">{category.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{category.code}</div>
                  </td>
                  <td>{category.module ?? '-'}</td>
                  <td>{category.items.length}</td>
                  <td><StatusPill status={category.status} /></td>
                  <td>{category.system ? 'Sim' : 'Não'}</td>
                  <RowActions onEdit={() => setDialog({ type: 'category', record: category })} onDelete={() => confirmDelete('category', category.id)} />
                </tr>
              ))}
            </DataTable>
          )}

          {paramView === 'items' && (
            <>
              <Toolbar search={search} setSearch={setSearch} placeholder="Pesquisar item, código, categoria ou módulo..." />
              <DataTable headers={['Parametro', 'Categoria', 'Descrição', 'Status', 'Atualizado', 'Ações']} empty="Nenhum item encontrado.">
                {allItems
                  .filter((item) => [item.name, item.code, item.category.name, item.category.module ?? ''].join(' ').toLowerCase().includes(search.toLowerCase()))
                  .map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="font-medium">{item.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{item.code}</div>
                      </td>
                      <td>{item.category.name}</td>
                      <td className="max-w-md truncate">{item.description ?? '-'}</td>
                      <td><StatusPill status={item.status} /></td>
                      <td className="text-xs">{formatDate(item.updatedAt)}</td>
                      <RowActions onEdit={() => setDialog({ type: 'item', record: item })} onDelete={() => confirmDelete('item', item.id)} />
                    </tr>
                  ))}
              </DataTable>
            </>
          )}
        </SectionCard>
      )}

      {active === 'security' && (
        <SectionCard
          title="Seguranca"
          description="Perfis administraveis e permissões por módulo salvas no banco de dados."
          actions={<Button onClick={() => setDialog({ type: 'profile' })}><Plus className="mr-2 h-4 w-4" />Novo perfil</Button>}
          contentClassName="p-0"
        >
          <DataTable headers={['Perfil', 'Papel base', 'Permissões', 'Usuários', 'Status', 'Ações']} empty="Nenhum perfil cadastrado.">
            {data?.profiles.map((profile) => (
              <tr key={profile.id}>
                <td>
                  <div className="font-medium">{profile.name}</div>
                  <div className="text-xs text-muted-foreground">{profile.description ?? profile.code}</div>
                </td>
                <td><Badge variant="outline">{profile.role ? roleLabels[profile.role] ?? profile.role : '-'}</Badge></td>
                <td>{profile.permissions.length}</td>
                <td>{profile._count?.users ?? 0}</td>
                <td><StatusPill status={profile.status} /></td>
                <RowActions onEdit={() => setDialog({ type: 'profile', record: profile })} onDelete={() => confirmDelete('profile', profile.id)} />
              </tr>
            ))}
          </DataTable>
        </SectionCard>
      )}

      {active === 'system' && (
        <SectionCard
          title="Sistema"
          description="Regras globais, notificações, aprovações e preferencias da plataforma."
          actions={<Button onClick={() => setDialog({ type: 'setting' })}><Plus className="mr-2 h-4 w-4" />Novo parametro</Button>}
          contentClassName="p-0"
        >
          <DataTable headers={['Chave', 'Grupo', 'Valor', 'Tipo', 'Status', 'Ações']} empty="Nenhum parametro de sistema cadastrado.">
            {data?.settings.map((setting) => (
              <tr key={setting.id}>
                <td>
                  <div className="font-medium">{setting.key}</div>
                  <div className="text-xs text-muted-foreground">{setting.description ?? '-'}</div>
                </td>
                <td>{setting.group ?? 'Sistema'}</td>
                <td className="max-w-sm truncate">{setting.value}</td>
                <td>{setting.valueType ?? 'text'}</td>
                <td><StatusPill status={setting.active ? 'ACTIVE' : 'INACTIVE'} /></td>
                <td className="text-right">
                  <Button variant="outline" size="sm" onClick={() => setDialog({ type: 'setting', record: setting })}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>
      )}

      {dialog && (
        <AdminDialog
          dialog={dialog}
          data={data}
          saving={save.isPending}
          onClose={() => setDialog(null)}
          onSave={(payload) => save.mutate({ type: dialog.type, id: dialog.record?.id, payload })}
        />
      )}
    </div>
  );

  function confirmDelete(type: string, id: string) {
    if (window.confirm('Confirma a exclusão lógica deste cadastro?')) remove.mutate({ type, id });
  }
}

function ParameterActions({ view, onNew }: { view: ParamView; onNew: (type: string) => void }) {
  const map: Record<ParamView, { label: string; type?: string }> = {
    companies: { label: 'Nova empresa', type: 'company' },
    branches: { label: 'Nova filial', type: 'branch' },
    structure: { label: 'Abrir arvore' },
    categories: { label: 'Nova categoria', type: 'category' },
    items: { label: 'Novo item', type: 'item' },
  };
  const cfg = map[view];
  if (view === 'structure') {
    return (
      <Button asChild>
        <Link href="/org">
          <GitBranch className="mr-2 h-4 w-4" />
          {cfg.label}
        </Link>
      </Button>
    );
  }
  return (
    <Button onClick={() => cfg.type && onNew(cfg.type)}>
      <Plus className="mr-2 h-4 w-4" />
      {cfg.label}
    </Button>
  );
}

function Toolbar({ search, setSearch, placeholder }: { search: string; setSearch: (value: string) => void; placeholder: string }) {
  return (
    <div className="border-b p-3">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder} />
      </div>
    </div>
  );
}

function DataTable({ headers, children, empty }: { headers: string[]; children: React.ReactNode; empty: string }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(rows) && rows.length === 0;
  return (
    <div className="overflow-x-auto">
      <table className="table-modern">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} className={cn('text-left', header === 'Ações' && 'text-right')}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr><td colSpan={headers.length}><EmptyState title={empty} className="border-0 bg-transparent" /></td></tr>
          ) : rows}
        </tbody>
      </table>
    </div>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <td className="text-right">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Excluir
        </Button>
      </div>
    </td>
  );
}

function StatusPill({ status, label }: { status: string; label?: string }) {
  const normalized = label ?? status;
  const cls = normalized === 'ACTIVE' ? 'pill-green' : normalized === 'PENDING' ? 'pill-yellow' : normalized === 'BLOCKED' || normalized === 'ARCHIVED' ? 'pill-red' : 'pill-gray';
  return <span className={cn('pill', cls)}>{normalized}</span>;
}

function SummaryTile({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-md bg-background text-primary shadow-sm">{icon}</div>
      </div>
    </div>
  );
}

function AdminDialog({
  dialog,
  data,
  saving,
  onClose,
  onSave,
}: {
  dialog: { type: string; record?: any };
  data?: Bootstrap;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: any) => void;
}) {
  const r = dialog.record ?? {};
  const [form, setForm] = useState<any>(() => ({
    name: r.name ?? '',
    code: r.code ?? '',
    tradeName: r.tradeName ?? '',
    cnpj: r.cnpj ?? '',
    city: r.city ?? '',
    state: r.state ?? '',
    description: r.description ?? '',
    module: r.module ?? '',
    status: r.status ?? (r.active === false ? 'INACTIVE' : 'ACTIVE'),
    active: r.active ?? true,
    categoryId: r.categoryId ?? data?.categories?.[0]?.id ?? '',
    parentId: r.parentId ?? '',
    role: r.role ?? 'COLLABORATOR',
    permissionKeys: r.permissions?.map((p: any) => p.permission.key) ?? [],
    key: r.key ?? '',
    value: r.value ?? '',
    valueType: r.valueType ?? 'text',
    group: r.group ?? 'Sistema',
  }));

  const titleMap: Record<string, string> = {
    company: 'Empresa',
    branch: 'Filial',
    category: 'Categoria de parametro',
    item: 'Item de parametro',
    profile: 'Perfil de acesso',
    setting: 'Parametro do sistema',
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{r.id ? 'Editar' : 'Novo'} {titleMap[dialog.type]}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {dialog.type === 'company' && (
            <>
              <Field label="Razão social" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
              <Field label="Nome fantasia" value={form.tradeName} onChange={(tradeName) => setForm({ ...form, tradeName })} />
              <Field label="CNPJ" value={form.cnpj} onChange={(cnpj) => setForm({ ...form, cnpj })} />
              <StatusSelect form={form} setForm={setForm} />
            </>
          )}

          {dialog.type === 'branch' && (
            <>
              <Field label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
              <Field label="Código" value={form.code} onChange={(code) => setForm({ ...form, code })} />
              <Field label="Cidade" value={form.city} onChange={(city) => setForm({ ...form, city })} />
              <Field label="Estado" value={form.state} onChange={(state) => setForm({ ...form, state })} />
              <StatusSelect form={form} setForm={setForm} />
            </>
          )}

          {dialog.type === 'category' && (
            <>
              <Field label="Código" value={form.code} onChange={(code) => setForm({ ...form, code })} required />
              <Field label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
              <Field label="Módulo" value={form.module} onChange={(module) => setForm({ ...form, module })} />
              <StatusSelect form={form} setForm={setForm} />
              <div className="md:col-span-2"><TextField label="Descrição" value={form.description} onChange={(description) => setForm({ ...form, description })} /></div>
            </>
          )}

          {dialog.type === 'item' && (
            <>
              <div>
                <Label>Categoria</Label>
                <NativeSelect value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  {data?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </NativeSelect>
              </div>
              <Field label="Código" value={form.code} onChange={(code) => setForm({ ...form, code })} required />
              <Field label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
              <StatusSelect form={form} setForm={setForm} />
              <div className="md:col-span-2"><TextField label="Descrição" value={form.description} onChange={(description) => setForm({ ...form, description })} /></div>
            </>
          )}

          {dialog.type === 'profile' && (
            <>
              <Field label="Código" value={form.code} onChange={(code) => setForm({ ...form, code })} required />
              <Field label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
              <div>
                <Label>Papel base</Label>
                <NativeSelect value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {Object.entries(roleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </NativeSelect>
              </div>
              <StatusSelect form={form} setForm={setForm} />
              <div className="md:col-span-2"><TextField label="Descrição" value={form.description} onChange={(description) => setForm({ ...form, description })} /></div>
              <div className="md:col-span-2 max-h-80 overflow-y-auto rounded-lg border p-3">
                <div className="mb-3 text-sm font-semibold">Permissões por módulo</div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {data?.permissions.map((permission) => {
                    const checked = form.permissionKeys.includes(permission.key);
                    return (
                      <label key={permission.key} className={cn('flex cursor-pointer gap-2 rounded-md border p-2 text-sm hover:bg-accent/35', checked && 'border-primary/40 bg-primary/5')}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              permissionKeys: e.target.checked
                                ? [...form.permissionKeys, permission.key]
                                : form.permissionKeys.filter((key: string) => key !== permission.key),
                            })
                          }
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
            </>
          )}

          {dialog.type === 'setting' && (
            <>
              <Field label="Chave" value={form.key} onChange={(key) => setForm({ ...form, key })} required />
              <Field label="Grupo" value={form.group} onChange={(group) => setForm({ ...form, group })} />
              <Field label="Valor" value={form.value} onChange={(value) => setForm({ ...form, value })} required />
              <div>
                <Label>Tipo</Label>
                <NativeSelect value={form.valueType} onChange={(e) => setForm({ ...form, valueType: e.target.value })}>
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="boolean">Booleano</option>
                  <option value="json">JSON</option>
                </NativeSelect>
              </div>
              <StatusSelect form={form} setForm={setForm} />
              <div className="md:col-span-2"><TextField label="Descrição" value={form.description} onChange={(description) => setForm({ ...form, description })} /></div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={saving || (['company', 'branch', 'category', 'item', 'profile'].includes(dialog.type) && !form.name)}
            onClick={() => onSave(toPayload(dialog.type, form))}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <div>
      <Label className={required ? 'field-required' : undefined}>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function StatusSelect({ form, setForm }: { form: any; setForm: (value: any) => void }) {
  return (
    <div>
      <Label>Status</Label>
      <NativeSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value, active: e.target.value === 'ACTIVE' })}>
        <option value="ACTIVE">Ativo</option>
        <option value="INACTIVE">Inativo</option>
        <option value="ARCHIVED">Arquivado</option>
      </NativeSelect>
    </div>
  );
}

function toPayload(type: string, form: any) {
  if (type === 'company') return { name: form.name, tradeName: form.tradeName || null, cnpj: form.cnpj || null, active: form.status === 'ACTIVE' };
  if (type === 'branch') return { name: form.name, code: form.code || null, city: form.city || null, state: form.state || null, active: form.status === 'ACTIVE' };
  if (type === 'category') return { code: form.code, name: form.name, description: form.description || null, module: form.module || null, status: form.status };
  if (type === 'item') return { categoryId: form.categoryId, code: form.code, name: form.name, description: form.description || null, status: form.status };
  if (type === 'profile') return { code: form.code, name: form.name, description: form.description || null, role: form.role, status: form.status, permissionKeys: form.permissionKeys };
  if (type === 'setting') return { key: form.key, value: form.value, description: form.description || null, valueType: form.valueType, group: form.group, active: form.status === 'ACTIVE' };
  return form;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer));
  });
}
