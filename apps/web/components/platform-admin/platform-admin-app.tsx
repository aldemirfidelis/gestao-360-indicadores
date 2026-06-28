'use client';

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Building2,
  ChevronDown,
  Database,
  Eye,
  Flag,
  Globe2,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  Network,
  PackageCheck,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  Send,
  ServerCog,
  Save,
  ShieldCheck,
  Star,
  Trash2,
  Settings2,
  SlidersHorizontal,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { dbAdminNav, DB_ADMIN_BASE } from '@/components/database-admin/nav';
import { cn } from '@/lib/utils';
import {
  clearPlatformAdminTokens,
  getPlatformAdminAccessToken,
  getPlatformAdminRefreshToken,
  platformAdminApi,
} from '@/lib/platform-admin-api';
import GeneralSettingsPage from '@/app/(app)/settings/page';
import ExternalIntegrationsPage from '@/app/(app)/settings/integracoes/page';
import VisibilitySettingsPage from '@/app/(app)/settings/visibilidade/page';
import PortalAdminPage from '@/app/(app)/settings/portal/page';
import OrgPage from '@/app/(app)/org/page';
import UsersPage from '@/app/(app)/users/page';
import { PrizeConnectorsPanel } from '@/components/gestao-premio/prize-connectors-panel';
import { Vision360Provider } from '@/components/ui/vision360-context';
import { Vision360Sidebar } from '@/components/ui/vision360-sidebar';
import DatabaseOverviewPage from '@/app/(app)/settings/database/page';
import DatabaseTablesPage from '@/app/(app)/settings/database/tables/page';
import { TableDetailContent } from '@/components/database-admin/table-detail-content';
import DatabaseRecordsPage from '@/app/(app)/settings/database/records/page';
import DatabaseSqlPage from '@/app/(app)/settings/database/sql/page';
import DatabaseQueryBuilderPage from '@/app/(app)/settings/database/query-builder/page';
import DatabaseStructurePage from '@/app/(app)/settings/database/structure/page';
import DatabaseIndexesPage from '@/app/(app)/settings/database/indexes/page';
import DatabaseImportExportPage from '@/app/(app)/settings/database/import-export/page';
import DatabaseBackupsPage from '@/app/(app)/settings/database/backups/page';
import DatabaseAuditPage from '@/app/(app)/settings/database/audit/page';
import DatabaseDiagnosticsPage from '@/app/(app)/settings/database/diagnostics/page';
import DatabaseAdvancedPage from '@/app/(app)/settings/database/advanced/page';

type SectionKey =
  | 'dashboard'
  | 'settings'
  | 'generalSettings'
  | 'visibilityAdmin'
  | 'externalIntegrations'
  | 'orgStructure'
  | 'databaseAdmin'
  | 'portalAdmin'
  | 'email'
  | 'seoPresence'
  | 'companyAudit'
  | 'companies'
  | 'modules'
  | 'plans'
  | 'users'
  | 'security'
  | 'technical'
  | 'audit'
  | 'inbox';

type DatabaseAdminTab =
  | 'overview'
  | 'tables'
  | 'records'
  | 'sql'
  | 'query-builder'
  | 'structure'
  | 'indexes'
  | 'import-export'
  | 'backups'
  | 'audit'
  | 'diagnostics'
  | 'advanced';

type ExternalIntegrationsTab = 'external' | 'prize';

interface SectionItem {
  key: SectionKey;
  label: string;
  icon: LucideIcon;
  group: string;
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
  slug?: string | null;
  customDomain?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  segment?: string | null;
  maxUsers?: number | null;
  notes?: string | null;
  active?: boolean;
  status: string;
  areaAccessEnabled?: boolean;
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

interface PlanRow {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status?: string;
  monthlyPriceCents: number;
  setupPriceCents?: number;
  defaultUsers?: number | null;
  defaultBranches?: number | null;
  storageLimitMb?: number | null;
  supportLevel?: string | null;
  sla?: string | null;
  trialDays?: number | null;
  modules: { moduleCode: string; included: boolean; optional?: boolean; limits?: string | null }[];
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

interface CompanyAuditEntry {
  id: string;
  action: string;
  module: string | null;
  entity: string;
  entityId: string | null;
  recordLabel: string | null;
  payload: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  result: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

// Barra lateral agrupada por contexto. A antiga aba "Configuracoes" (landing de
// cards) foi removida por duplicar a propria barra — cada destino segue aqui.
const SECTIONS: SectionItem[] = [
  { key: 'dashboard', label: 'Painel', icon: LayoutDashboard, group: 'Geral' },
  // Gestao dos clientes da plataforma (global, independe da empresa selecionada).
  { key: 'companies', label: 'Empresas', icon: Building2, group: 'Plataforma' },
  { key: 'modules', label: 'Matriz de Módulos', icon: PackageCheck, group: 'Plataforma' },
  { key: 'plans', label: 'Planos', icon: ListChecks, group: 'Plataforma' },
  { key: 'seoPresence', label: 'SEO e Presenca Digital', icon: Globe2, group: 'Plataforma' },
  { key: 'inbox', label: 'Caixa de Entrada', icon: Inbox, group: 'Plataforma' },
  { key: 'users', label: 'Usuários', icon: Users, group: 'Plataforma' },
  { key: 'security', label: 'Seguranca e Suporte', icon: ShieldCheck, group: 'Plataforma' },
  // Operam sobre a empresa selecionada no seletor do topo.
  { key: 'generalSettings', label: 'Config. Gerais', icon: Settings2, group: 'Empresa selecionada' },
  { key: 'visibilityAdmin', label: 'Visibilidade', icon: Eye, group: 'Empresa selecionada' },
  { key: 'orgStructure', label: 'Áreas e Setores', icon: Network, group: 'Empresa selecionada' },
  { key: 'externalIntegrations', label: 'APIs Externas', icon: ArrowLeftRight, group: 'Empresa selecionada' },
  { key: 'companyAudit', label: 'Auditoria Empresa', icon: Activity, group: 'Empresa selecionada' },
  // Ferramentas tecnicas/globais.
  { key: 'databaseAdmin', label: 'Banco de Dados', icon: Database, group: 'Técnico' },
  { key: 'portalAdmin', label: 'Central do Portal', icon: Wrench, group: 'Técnico' },
  { key: 'email', label: 'E-mail', icon: Mail, group: 'Técnico' },
  { key: 'technical', label: 'Desenvolvimento', icon: ServerCog, group: 'Técnico' },
  { key: 'audit', label: 'Auditoria', icon: Activity, group: 'Técnico' },
];

const SECTION_KEYS = new Set<SectionKey>(SECTIONS.map((section) => section.key));

const COMPANY_STATUSES = ['ACTIVE', 'SUSPENDED', 'INACTIVE'] as const;
const COMPANY_LIFECYCLE_STATUSES = ['ACTIVE', 'IMPLEMENTATION', 'TRIAL', 'SUSPENDED', 'INACTIVE'] as const;
const COMPANY_PLAN_CODES = ['ESSENCIAL', 'PROFISSIONAL', 'CORPORATIVO', 'ENTERPRISE', 'PERSONALIZADO'];
const COMPANY_CORE_MODULE_CODES = new Set(['users', 'my-day', 'tasks']);
const PLATFORM_COMPANY_CONTEXT_KEY = 'g360.platformAdmin.companyId';
const PORTAL_ADMIN_TAB_KEY = 'g360.platformAdmin.portalTab';
const PORTAL_ADMIN_TAB_EVENT = 'platform-admin:portal-tab';
const LEGACY_COMPANY_SECTIONS = new Set<SectionKey>(['generalSettings', 'visibilityAdmin', 'externalIntegrations', 'orgStructure', 'users', 'companyAudit']);
const DATABASE_ADMIN_TABS = new Set<DatabaseAdminTab>([
  'overview',
  'tables',
  'records',
  'sql',
  'query-builder',
  'structure',
  'indexes',
  'import-export',
  'backups',
  'audit',
  'diagnostics',
  'advanced',
]);

const EMPTY_COMPANY_FORM = {
  name: '',
  tradeName: '',
  cnpj: '',
  slug: '',
  customDomain: '',
  email: '',
  phone: '',
  segment: '',
  addressLine: '',
  city: '',
  state: '',
  maxUsers: '',
  status: 'ACTIVE',
  lifecycleStatus: 'ACTIVE',
  areaAccessEnabled: true,
  planCode: 'ESSENCIAL',
  notes: '',
};

type CompanyForm = typeof EMPTY_COMPANY_FORM;

const EMPTY_PLAN_FORM = {
  code: '',
  name: '',
  monthlyPriceCents: '0',
  setupPriceCents: '0',
  defaultUsers: '',
  defaultBranches: '',
  storageLimitMb: '',
  supportLevel: '',
  sla: '',
  trialDays: '',
  moduleCodes: [] as string[],
};

type PlanForm = typeof EMPTY_PLAN_FORM;

const SETTINGS_AREAS: Array<{
  title: string;
  description: string;
  action: string;
  target: SectionKey;
  icon: LucideIcon;
}> = [
  {
    title: 'Configurações gerais',
    description: 'Usuários, perfis de acesso, permissões, parâmetros, empresas, filiais e sistema.',
    action: 'Abrir configurações',
    target: 'generalSettings',
    icon: Settings2,
  },
  {
    title: 'Matriz de visibilidade',
    description: 'Controle de acesso entre áreas, excecoes por usuário e simulação por empresa.',
    action: 'Abrir visibilidade',
    target: 'visibilityAdmin',
    icon: Eye,
  },
  {
    title: 'Áreas e Setores',
    description: 'Arvore hierarquica da empresa, responsáveis, códigos, cores e status dos nos.',
    action: 'Abrir estrutura',
    target: 'orgStructure',
    icon: Network,
  },
  {
    title: 'APIs externas',
    description: 'Conectores, chaves de API, credenciais cifradas, testes, execuções e registros.',
    action: 'Abrir APIs',
    target: 'externalIntegrations',
    icon: ArrowLeftRight,
  },
  {
    title: 'Banco de dados',
    description: 'Menu completo com tabelas, registros, SQL, estrutura, índices, importação, backup e diagnostico.',
    action: 'Abrir banco',
    target: 'databaseAdmin',
    icon: Database,
  },
  {
    title: 'Central do Portal',
    description: 'Módulos, páginas, funcionalidades, menus, escopo, manutenção, históricos e parâmetros avançados.',
    action: 'Abrir portal',
    target: 'portalAdmin',
    icon: Wrench,
  },
  {
    title: 'Empresas',
    description: 'Cadastro, status, contrato, saúde e limites ficam centralizados por empresa.',
    action: 'Abrir empresas',
    target: 'companies',
    icon: Building2,
  },
  {
    title: 'Módulos e menus',
    description: 'Liberação de módulos, páginas, visibilidade e comportamento por cliente.',
    action: 'Abrir matriz',
    target: 'modules',
    icon: PackageCheck,
  },
  {
    title: 'Planos',
    description: 'Pacotes comerciais, limites padrão e conjunto inicial de módulos.',
    action: 'Abrir planos',
    target: 'plans',
    icon: ListChecks,
  },
  {
    title: 'Usuários globais',
    description: 'Consulta, bloqueio e revogação de sessões dos usuários das empresas.',
    action: 'Abrir usuários',
    target: 'users',
    icon: Users,
  },
  {
    title: 'Segurança e suporte',
    description: 'Sessões abertas, suporte somente leitura e controles operacionais.',
    action: 'Abrir segurança',
    target: 'security',
    icon: ShieldCheck,
  },
  {
    title: 'Banco e integrações',
    description: 'Saúde do banco, backups, ambientes, opções, integrações e rotinas.',
    action: 'Abrir técnico',
    target: 'technical',
    icon: ServerCog,
  },
  {
    title: 'Auditoria da empresa',
    description: 'Trilha de acessos, alterações, permissões, parâmetros e registros da empresa selecionada.',
    action: 'Abrir auditoria',
    target: 'companyAudit',
    icon: Activity,
  },
];

/**
 * Raizes de queryKey cujo conteudo depende da empresa ativa selecionada no
 * Portal Admin Global (header `x-platform-company-id`). Sao descartadas ao
 * trocar de empresa para nao vazar dados entre empresas/areas. NAO inclui as
 * consultas globais (`db-admin`, `platform-admin`, `platform-companies`,
 * `platform-overview`), que independem da empresa selecionada.
 */
const COMPANY_SCOPED_QUERY_ROOTS = new Set<string>([
  'admin',
  'access-areas',
  'access-modules',
  'access-matrix',
  'access-simulate',
  'access-user-areas',
  'users',
  'users-list',
  'orgnodes',
  'ext-connectors',
  'ext-keys',
  'ext-logs',
  'platform-admin-company-audit',
  'prize-connectors',
  'prize-jobs',
]);

export function PlatformAdminApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const requestedSection = searchParams.get('section');
  const requestedExternalTab = searchParams.get('tab');
  const [section, setSection] = useState<SectionKey>(() => (isSectionKey(requestedSection) ? requestedSection : 'dashboard'));
  const [databaseTab, setDatabaseTab] = useState<DatabaseAdminTab>('overview');
  const [databaseTable, setDatabaseTable] = useState<string | null>(null);
  const [settingsCompanyId, setSettingsCompanyId] = useState('');

  const me = useQuery({
    queryKey: ['platform-admin', 'me'],
    queryFn: () => platformAdminApi<PlatformProfile>('/auth/me'),
    retry: false,
  });
  const companyContext = useQuery({
    queryKey: ['platform-admin', 'company-context'],
    queryFn: () => platformAdminApi<{ rows: CompanyRow[]; total: number }>('/companies?take=500'),
    enabled: Boolean(me.data),
  });

  const setSettingsCompanyContext = useCallback((companyId: string) => {
    setSettingsCompanyId(companyId);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PLATFORM_COMPANY_CONTEXT_KEY, companyId);
    }
    // Ao trocar a empresa ativa, DESCARTA (nao apenas invalida) o cache das
    // consultas com escopo de empresa. Com invalidateQueries, uma secao ja
    // carregada continuaria exibindo os dados da empresa anterior durante o
    // refetch — um vazamento visual de uma empresa/area para outra. Com
    // removeQueries o dado obsoleto e descartado: consultas ativas recarregam
    // imediatamente e as inativas montam em estado de carregamento. As demais
    // (db-admin e os metadados do proprio Portal Admin Global) sao globais e
    // permanecem em cache para evitar refetches caros e desnecessarios.
    void queryClient.removeQueries({
      predicate: (query) => COMPANY_SCOPED_QUERY_ROOTS.has(String(query.queryKey[0] ?? '')),
    });
  }, [queryClient]);

  useEffect(() => {
    if (!getPlatformAdminAccessToken()) router.replace('/platform-admin/login');
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSettingsCompanyId(window.localStorage.getItem(PLATFORM_COMPANY_CONTEXT_KEY) ?? '');
  }, []);

  useEffect(() => {
    const rows = companyContext.data?.rows ?? [];
    if (rows.length === 0) return;
    const stored = settingsCompanyId || (typeof window !== 'undefined' ? window.localStorage.getItem(PLATFORM_COMPANY_CONTEXT_KEY) ?? '' : '');
    const selected = rows.some((company) => company.id === stored) ? stored : rows[0].id;
    if (selected !== settingsCompanyId) {
      setSettingsCompanyContext(selected);
    }
  }, [companyContext.data?.rows, settingsCompanyId, setSettingsCompanyContext]);

  useEffect(() => {
    const handleDatabaseTab = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (isDatabaseAdminTab(detail)) {
        setSection('databaseAdmin');
        setDatabaseTab(detail);
        setDatabaseTable(null);
        return;
      }
      if (isDatabaseNavigationDetail(detail)) {
        setSection('databaseAdmin');
        setDatabaseTab(detail.tab);
        setDatabaseTable(detail.table ?? null);
      }
    };
    window.addEventListener('platform-admin:database-tab', handleDatabaseTab);
    return () => window.removeEventListener('platform-admin:database-tab', handleDatabaseTab);
  }, []);

  useEffect(() => {
    if (me.isError) {
      clearPlatformAdminTokens();
      router.replace('/platform-admin/login');
    }
  }, [me.isError, router]);

  const sync = useMutation({
    mutationFn: () => platformAdminApi('/sync-foundation', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Fundação sincronizada');
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

  function openPortalAdminTab(tab: string) {
    window.localStorage.setItem(PORTAL_ADMIN_TAB_KEY, tab);
    window.dispatchEvent(new CustomEvent(PORTAL_ADMIN_TAB_EVENT, { detail: tab }));
  }

  function selectSection(next: SectionKey) {
    setSection(next);
    if (typeof window === 'undefined') return;
    const url = next === 'dashboard' ? '/platform-admin' : `/platform-admin?section=${next}`;
    window.history.replaceState(null, '', url);
  }

  useEffect(() => {
    if (isSectionKey(requestedSection)) setSection(requestedSection);
  }, [requestedSection]);

  function handleLegacyNavigation(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return;

    const url = new URL(anchor.href);
    if (url.origin !== window.location.origin) return;

    const path = url.pathname;
    let next: SectionKey | null = null;

    if (path.startsWith('/settings/database')) {
      next = 'databaseAdmin';
      setDatabaseTable(null);
      setDatabaseTab(tabFromDatabasePath(path));
      const tableName = tableNameFromDatabasePath(path);
      if (tableName) setDatabaseTable(tableName);
    } else if (path.startsWith('/settings/portal')) {
      next = 'portalAdmin';
    } else if (path.startsWith('/settings/visibilidade')) {
      next = 'visibilityAdmin';
    } else if (path.startsWith('/settings/integracoes')) {
      next = 'externalIntegrations';
    } else if (path.startsWith('/integracoes')) {
      next = 'portalAdmin';
      openPortalAdminTab('integrations');
    } else if (path.startsWith('/settings/empresas')) {
      next = 'companies';
    } else if (path.startsWith('/org')) {
      next = 'orgStructure';
    } else if (path.startsWith('/users')) {
      next = 'users';
    } else if (path.startsWith('/audit')) {
      next = 'companyAudit';
    } else if (path === '/settings') {
      next = 'generalSettings';
    }

    if (!next) return;
    event.preventDefault();
    selectSection(next);
  }

  if (me.isLoading) {
    return <div className="grid min-h-screen place-items-center bg-[#f4f7f8] text-sm text-muted-foreground">Carregando Portal Administrativo Global...</div>;
  }

  return (
    <main className="flex h-screen overflow-hidden bg-[#f4f7f8] text-foreground">
      <aside className="hidden w-[280px] shrink-0 border-r bg-[#101820] text-white lg:flex lg:flex-col">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Gestão 360</div>
          <div className="mt-1 text-lg font-semibold">Portal Administrativo Global</div>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto p-2">
          {SECTIONS.map((item, idx) => {
            const Icon = item.icon;
            const active = section === item.key;
            const showHeading = idx === 0 || SECTIONS[idx - 1].group !== item.group;
            return (
              <div key={item.key}>
                {showHeading && (
                  <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">{item.group}</div>
                )}
                <button
                  type="button"
                  onClick={() => selectSection(item.key)}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors',
                    active ? 'bg-white text-[#101820]' : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              </div>
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
            {LEGACY_COMPANY_SECTIONS.has(section) && (
              <div className="hidden min-w-[260px] items-center gap-2 md:flex">
                <Label className="whitespace-nowrap text-xs text-muted-foreground">Empresa</Label>
                <NativeSelect
                  className="h-9"
                  value={settingsCompanyId}
                  onChange={(event) => setSettingsCompanyContext(event.target.value)}
                  disabled={companyContext.isLoading}
                >
                  {(companyContext.data?.rows ?? []).map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.tradeName || company.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
              <PlayCircle className="mr-2 h-4 w-4" />
              Sincronizar
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6" onClickCapture={handleLegacyNavigation}>
          {section === 'dashboard' && <DashboardSection />}
          {section === 'generalSettings' && <GeneralSettingsSection />}
          {section === 'visibilityAdmin' && <VisibilitySettingsSection />}
          {section === 'externalIntegrations' && <ExternalIntegrationsSection initialTab={requestedExternalTab === 'prize' ? 'prize' : 'external'} />}
          {section === 'orgStructure' && <OrgStructureSection />}
          {section === 'databaseAdmin' && (
            <DatabaseAdminSection
              tab={databaseTab}
              tableName={databaseTable}
              onTabChange={(nextTab) => {
                setDatabaseTable(null);
                setDatabaseTab(nextTab);
              }}
              onTableBack={() => setDatabaseTable(null)}
            />
          )}
          {section === 'portalAdmin' && <PortalAdminSection />}
          {section === 'email' && <EmailSection />}
          {section === 'companyAudit' && <CompanyAuditSection />}
          {section === 'companies' && <CompaniesSection />}
          {section === 'modules' && <ModulesSection />}
          {section === 'plans' && <PlansSection />}
          {section === 'seoPresence' && <SeoPresenceSection />}
          {section === 'inbox' && <InboxSection />}
          {section === 'users' && <UsersManagementSection />}
          {section === 'security' && <SecuritySection />}
          {section === 'technical' && <TechnicalSection />}
          {section === 'audit' && <AuditSection />}
        </div>
      </section>
    </main>
  );
}

function SettingsSection({ onNavigate }: { onNavigate: (section: SectionKey) => void }) {
  return (
    <div className="space-y-4">
      <Panel title="Configurações da plataforma" icon={SlidersHorizontal}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {SETTINGS_AREAS.map((area) => {
            const Icon = area.icon;
            return (
              <button
                key={area.title}
                type="button"
                onClick={() => onNavigate(area.target)}
                className="group flex h-full flex-col border bg-white p-4 text-left transition-colors hover:border-[#101820] hover:bg-[#f8fafb]"
              >
                <div className="flex items-center justify-between gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="mt-4 text-sm font-semibold">{area.title}</div>
                <div className="mt-2 flex-1 text-xs leading-5 text-muted-foreground">{area.description}</div>
                <div className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#101820]">{area.action}</div>
              </button>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Escopo das empresas" icon={Users}>
          <div className="space-y-2 text-sm">
            <Row label="Portal da empresa" value="Usuários da própria empresa" />
            <Row label="Rotas antigas /settings" value="Redirecionadas para /users" />
            <Row label="Administração global" value="Portal Admin Global" />
          </div>
        </Panel>
        <Panel title="Controles centralizados" icon={ShieldCheck}>
          <div className="space-y-2 text-sm">
            <Row label="Empresas, planos e módulos" value="Portal Admin Global" />
            <Row label="Portal, menus e visibilidade" value="Matriz de Modulos" />
            <Row label="Banco, integrações e auditoria" value="Desenvolvimento e Auditoria" />
          </div>
        </Panel>
      </div>
    </div>
  );
}

const DATABASE_ADMIN_PAGES: Record<DatabaseAdminTab, React.ReactNode> = {
  overview: <DatabaseOverviewPage />,
  tables: <DatabaseTablesPage />,
  records: <DatabaseRecordsPage />,
  sql: <DatabaseSqlPage />,
  'query-builder': <DatabaseQueryBuilderPage />,
  structure: <DatabaseStructurePage />,
  indexes: <DatabaseIndexesPage />,
  'import-export': <DatabaseImportExportPage />,
  backups: <DatabaseBackupsPage />,
  audit: <DatabaseAuditPage />,
  diagnostics: <DatabaseDiagnosticsPage />,
  advanced: <DatabaseAdvancedPage />,
};

function tabFromDatabaseHref(href: string): DatabaseAdminTab {
  const raw = href.replace(DB_ADMIN_BASE, '').replace(/^\//, '');
  const segment = raw.split('/').filter(Boolean)[0] || 'overview';
  return isDatabaseAdminTab(segment) ? segment : 'overview';
}

function tabFromDatabasePath(path: string): DatabaseAdminTab {
  const raw = path.replace(DB_ADMIN_BASE, '').replace(/^\/+/, '');
  const segment = raw.split('/').filter(Boolean)[0] || 'overview';
  return isDatabaseAdminTab(segment) ? segment : 'overview';
}

function tableNameFromDatabasePath(path: string) {
  const prefix = `${DB_ADMIN_BASE}/tables/`;
  if (!path.startsWith(prefix)) return null;
  const value = path.slice(prefix.length).split('/').filter(Boolean)[0];
  return value ? decodeURIComponent(value) : null;
}

function isDatabaseAdminTab(value: unknown): value is DatabaseAdminTab {
  return typeof value === 'string' && DATABASE_ADMIN_TABS.has(value as DatabaseAdminTab);
}

function isSectionKey(value: unknown): value is SectionKey {
  return typeof value === 'string' && SECTION_KEYS.has(value as SectionKey);
}

function isDatabaseNavigationDetail(value: unknown): value is { tab: DatabaseAdminTab; table?: string | null } {
  if (!value || typeof value !== 'object') return false;
  const detail = value as { tab?: unknown; table?: unknown };
  return isDatabaseAdminTab(detail.tab) && (detail.table === undefined || detail.table === null || typeof detail.table === 'string');
}

function GeneralSettingsSection() {
  return (
    <div className="rounded-sm border bg-white p-4">
      <GeneralSettingsPage />
    </div>
  );
}

function VisibilitySettingsSection() {
  return (
    <div className="rounded-sm border bg-white p-4">
      <VisibilitySettingsPage />
    </div>
  );
}

function ExternalIntegrationsSection({ initialTab }: { initialTab: ExternalIntegrationsTab }) {
  const [tab, setTab] = useState<ExternalIntegrationsTab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  function selectTab(next: ExternalIntegrationsTab) {
    setTab(next);
    if (typeof window === 'undefined') return;
    const url = next === 'prize'
      ? '/platform-admin?section=externalIntegrations&tab=prize'
      : '/platform-admin?section=externalIntegrations';
    window.history.replaceState(null, '', url);
  }

  return (
    <div className="rounded-sm border bg-white p-4">
      <div className="mb-4 flex flex-wrap gap-2 border-b pb-3">
        <button
          type="button"
          onClick={() => selectTab('external')}
          className={cn(
            'border px-3 py-1.5 text-xs font-medium transition-colors',
            tab === 'external' ? 'border-[#101820] bg-[#101820] text-white' : 'border-border bg-white text-muted-foreground hover:text-foreground',
          )}
        >
          APIs Externas
        </button>
        <button
          type="button"
          onClick={() => selectTab('prize')}
          className={cn(
            'border px-3 py-1.5 text-xs font-medium transition-colors',
            tab === 'prize' ? 'border-[#101820] bg-[#101820] text-white' : 'border-border bg-white text-muted-foreground hover:text-foreground',
          )}
        >
          Integracoes do Premio
        </button>
      </div>
      {tab === 'external' && <ExternalIntegrationsPage />}
      {tab === 'prize' && <PrizeConnectorsPanel embedded canAdmin />}
    </div>
  );
}

function OrgStructureSection() {
  return (
    <Vision360Provider>
      <div className="rounded-sm border bg-white p-4">
        <OrgPage />
      </div>
      <Vision360Sidebar />
    </Vision360Provider>
  );
}

function PortalAdminSection() {
  return (
    <div className="rounded-sm border bg-white p-4">
      <PortalAdminPage />
    </div>
  );
}

function CompanyAuditSection() {
  const [filters, setFilters] = useState({ q: '', entity: '', action: '', module: '', userId: '', from: '', to: '' });
  const [selected, setSelected] = useState<CompanyAuditEntry | null>(null);
  const params = useMemo(() => {
    const search = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && search.set(key, value));
    search.set('limit', '500');
    return search.toString();
  }, [filters]);
  const audit = useQuery({
    queryKey: ['platform-admin-company-audit', filters],
    queryFn: () => platformAdminApi<CompanyAuditEntry[]>(`/company-audit?${params}`),
  });
  const users = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string }>();
    (audit.data ?? []).forEach((row) => row.user && map.set(row.user.id, row.user));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [audit.data]);
  const modules = useMemo(() => Array.from(new Set((audit.data ?? []).map((row) => row.module).filter(Boolean))) as string[], [audit.data]);

  async function downloadCsv() {
    const csv = await platformAdminApi<string>('/company-audit/exports/csv');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'auditoria-empresa.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Filtros da auditoria da empresa"
        icon={Activity}
        actions={<Button size="sm" variant="outline" onClick={downloadCsv}>Exportar CSV</Button>}
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Pesquisar no log..." value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
          </div>
          <NativeSelect value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })}>
            <option value="">Todas as ações</option>
            <option value="LOGIN">Login</option>
            <option value="LOGOUT">Logout</option>
            <option value="CREATE">Criação</option>
            <option value="UPDATE">Edição</option>
            <option value="DELETE">Exclusão</option>
            <option value="PERMISSION_CHANGE">Permissão</option>
          </NativeSelect>
          <NativeSelect value={filters.module} onChange={(event) => setFilters({ ...filters, module: event.target.value })}>
            <option value="">Todos os módulos</option>
            {modules.map((module) => <option key={module} value={module}>{module}</option>)}
          </NativeSelect>
          <NativeSelect value={filters.userId} onChange={(event) => setFilters({ ...filters, userId: event.target.value })}>
            <option value="">Todos usuários</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </NativeSelect>
          <Input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
          <Input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
        </div>
      </Panel>

      <Panel title={`Eventos auditados (${audit.data?.length ?? 0})`}>
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Módulo</th>
                <th>Registro afetado</th>
                <th>Resultado</th>
                <th>IP / sessão</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(audit.data ?? []).map((entry) => (
                <tr key={entry.id}>
                  <td className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</td>
                  <td>
                    {entry.user ? (
                      <div>
                        <div className="font-medium">{entry.user.name}</div>
                        <div className="text-xs text-muted-foreground">{entry.user.email}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Sistema</span>
                    )}
                  </td>
                  <td>{entry.action}</td>
                  <td>{entry.module ?? '-'}</td>
                  <td>
                    <div className="flex flex-col">
                      <span>{entry.recordLabel ?? entry.entity}</span>
                      {entry.entityId && <span className="mt-0.5 max-w-[220px] truncate font-mono text-[10px] text-muted-foreground">{entry.entityId}</span>}
                    </div>
                  </td>
                  <td><Status value={entry.result ?? 'SUCCESS'} /></td>
                  <td className="text-xs text-muted-foreground">
                    <div>{entry.ip ?? '-'}</div>
                    <div className="max-w-[260px] truncate">{entry.userAgent ?? ''}</div>
                  </td>
                  <td className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelected(entry)}>Detalhe</Button>
                  </td>
                </tr>
              ))}
              {audit.isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">Carregando...</td></tr>}
            </tbody>
          </table>
        </div>
        {!audit.isLoading && (audit.data?.length ?? 0) === 0 && <EmptyState title="Nenhum registro encontrado" />}
      </Panel>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalhe da auditoria</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <AuditDetail label="Ação" value={selected.action} />
                <AuditDetail label="Módulo" value={selected.module ?? '-'} />
                <AuditDetail label="Entidade" value={selected.entity} />
                <AuditDetail label="Resultado" value={selected.result ?? 'SUCCESS'} />
              </div>
              <AuditPayload title="Valor anterior" value={selected.beforeValue} />
              <AuditPayload title="Valor novo / dados técnicos" value={selected.afterValue ?? selected.payload} />
              <AuditPayload title="Metadados" value={selected.payload} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DatabaseAdminSection({
  tab,
  tableName,
  onTabChange,
  onTableBack,
}: {
  tab: DatabaseAdminTab;
  tableName: string | null;
  onTabChange: (tab: DatabaseAdminTab) => void;
  onTableBack: () => void;
}) {
  const active = dbAdminNav.find((item) => tabFromDatabaseHref(item.href) === tab);
  const [open, setOpen] = useState(true);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px,1fr]">
      <aside className="xl:sticky xl:top-4 xl:self-start">
        <div className="overflow-hidden border bg-white">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-2 border-b px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Database className="h-4 w-4 text-muted-foreground" />
              Banco de Dados
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Administração completa do banco</div>
            <ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
          </button>
          {open && (
          <nav className="max-h-[calc(100vh-190px)] overflow-y-auto p-2">
            {dbAdminNav.map((item) => {
              const Icon = item.icon;
              const itemTab = tabFromDatabaseHref(item.href);
              const selected = itemTab === tab;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => onTabChange(itemTab)}
                  className={cn(
                    'flex w-full items-start gap-2.5 px-2.5 py-2 text-left text-sm transition-colors',
                    selected ? 'bg-[#101820] text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', selected ? 'text-white' : 'text-muted-foreground')} />
                  <span className="min-w-0">
                    <span className="block font-medium leading-tight">{item.label}</span>
                    <span className={cn('block text-[11px]', selected ? 'text-white/70' : 'text-muted-foreground')}>{item.description}</span>
                  </span>
                </button>
              );
            })}
          </nav>
          )}
        </div>
      </aside>
      <section className="min-w-0 rounded-sm border bg-white p-4">
        <div className="mb-4 border-b pb-3">
          <h2 className="text-base font-semibold">{active?.label ?? 'Banco de Dados'}</h2>
          <p className="text-sm text-muted-foreground">{active?.description ?? 'Administração técnica do banco.'}</p>
        </div>
        {tableName ? <TableDetailContent table={tableName} onBack={onTableBack} /> : DATABASE_ADMIN_PAGES[tab]}
      </section>
    </div>
  );
}

interface SeoPresencePayload {
  settings: Record<string, string>;
  publicUrls: string[];
  protectedPrefixes: string[];
  robotsPolicy: { oaiSearchBot: string; gptBot: string };
  generatedFiles: Record<string, string>;
}

function SeoPresenceSection() {
  const qc = useQueryClient();
  const seo = useQuery({
    queryKey: ['platform-admin', 'seo-presence'],
    queryFn: () => platformAdminApi<SeoPresencePayload>('/seo-presence'),
  });
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (seo.data?.settings) setForm(seo.data.settings);
  }, [seo.data?.settings]);

  const save = useMutation({
    mutationFn: () => platformAdminApi<SeoPresencePayload>('/seo-presence', { method: 'PATCH', json: form }),
    onSuccess: () => {
      toast.success('SEO e presenca digital atualizados');
      void qc.invalidateQueries({ queryKey: ['platform-admin', 'seo-presence'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao salvar SEO'),
  });

  if (seo.isLoading) return <LoadingGrid />;
  const files = seo.data?.generatedFiles ?? {};

  return (
    <div className="space-y-4">
      <Panel
        title="SEO e Presenca Digital"
        icon={Globe2}
        actions={<Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}><Save className="mr-2 h-4 w-4" />Salvar</Button>}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <SeoField label="Título padrão" value={form.defaultTitle} onChange={(value) => setForm({ ...form, defaultTitle: value })} />
          <SeoField label="Nome do produto" value={form.productName} onChange={(value) => setForm({ ...form, productName: value })} />
          <SeoField label="Dominio principal" value={form.primaryDomain} onChange={(value) => setForm({ ...form, primaryDomain: value })} />
          <SeoField label="Imagem social padrão" value={form.defaultSocialImage} onChange={(value) => setForm({ ...form, defaultSocialImage: value })} />
          <SeoField label="Google Analytics 4" value={form.gaMeasurementId} onChange={(value) => setForm({ ...form, gaMeasurementId: value })} />
          <SeoField label="Google Tag Manager" value={form.gtmId} onChange={(value) => setForm({ ...form, gtmId: value })} />
          <SeoField label="Código Search Console" value={form.googleVerification} onChange={(value) => setForm({ ...form, googleVerification: value })} />
          <SeoField label="Código Bing Webmaster" value={form.bingVerification} onChange={(value) => setForm({ ...form, bingVerification: value })} />
          <SeoField label="Número WhatsApp" value={form.whatsappNumber} onChange={(value) => setForm({ ...form, whatsappNumber: value })} />
          <SeoField label="Chave IndexNow" value={form.indexNowKey} onChange={(value) => setForm({ ...form, indexNowKey: value })} />
          <label className="grid gap-1.5 text-sm lg:col-span-2">
            <span className="font-medium">Descrição padrão</span>
            <Textarea value={form.defaultDescription ?? ''} onChange={(event) => setForm({ ...form, defaultDescription: event.target.value })} rows={3} />
          </label>
          <label className="grid gap-1.5 text-sm lg:col-span-2">
            <span className="font-medium">Mensagem inicial do WhatsApp</span>
            <Textarea value={form.whatsappMessage ?? ''} onChange={(event) => setForm({ ...form, whatsappMessage: event.target.value })} rows={2} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">IndexNow</span>
            <NativeSelect value={form.indexNowEnabled ?? 'false'} onChange={(event) => setForm({ ...form, indexNowEnabled: event.target.value })}>
              <option value="false">Desativado</option>
              <option value="true">Ativado</option>
            </NativeSelect>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Botao flutuante WhatsApp</span>
            <NativeSelect value={form.floatingWhatsappEnabled ?? 'true'} onChange={(event) => setForm({ ...form, floatingWhatsappEnabled: event.target.value })}>
              <option value="true">Ativado</option>
              <option value="false">Desativado</option>
            </NativeSelect>
          </label>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Arquivos publicados" icon={Globe2}>
          <div className="grid gap-2 text-sm">
            {Object.entries(files).map(([label, href]) => <Row key={label} label={label} value={href} />)}
          </div>
        </Panel>
        <Panel title="Política de rastreadores" icon={ShieldCheck}>
          <div className="space-y-2 text-sm">
            <Row label="OAI-SearchBot" value={seo.data?.robotsPolicy.oaiSearchBot ?? '-'} />
            <Row label="GPTBot" value={seo.data?.robotsPolicy.gptBot ?? '-'} />
            <Row label="Observação" value="Robots não substitui autenticação nem autorização." />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Rotas públicas indexáveis">
          <div className="flex flex-wrap gap-2">
            {(seo.data?.publicUrls ?? []).map((url) => <span key={url} className="pill pill-green">{url}</span>)}
          </div>
        </Panel>
        <Panel title="Prefixos protegidos / noindex">
          <div className="flex flex-wrap gap-2">
            {(seo.data?.protectedPrefixes ?? []).map((url) => <span key={url} className="pill pill-red">{url}</span>)}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SeoField({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <Input value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
    </label>
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
  if (!dashboard.data) return <EmptyState title="Painel indisponível" />;

  const cards = dashboard.data.cards;
  const metricKeys = [
    ['totalCompanies', 'Empresas'],
    ['activeCompanies', 'Ativas'],
    ['suspendedCompanies', 'Suspensas'],
    ['implementationCompanies', 'Implantação'],
    ['trialCompanies', 'Teste'],
    ['totalUsers', 'Usuários'],
    ['activeUsers7d', 'Ativos 7d'],
    ['activeUsers30d', 'Ativos 30d'],
    ['onlineUsers', 'Conectados agora'],
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
        <Panel title="Saúde técnica">
          <div className="grid gap-2 text-sm">
            <Row label="Banco" value={dashboard.data.health.status} />
            <Row label="Ambiente" value={dashboard.data.health.environment} />
            <Row label="Tabelas" value={dashboard.data.health.tables} />
            <Row label="Resposta média" value={`${dashboard.data.health.responseMs} ms`} />
            <Row label="Versão publicada" value={cards.currentVersion ?? '-'} />
            <Row label="Último backup" value={formatDate(cards.lastBackupAt)} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Módulos mais utilizados">
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
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<CompanyForm>(EMPTY_COMPANY_FORM);
  const companies = useQuery({
    queryKey: ['platform-admin', 'companies', q],
    queryFn: () => platformAdminApi<{ rows: CompanyRow[]; total: number }>(`/companies${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  });
  const detail = useQuery({
    queryKey: ['platform-admin', 'company', selectedId],
    queryFn: () => platformAdminApi<{ company: CompanyRow; profile: CompanyRow['profile']; usage: Record<string, number>; users: unknown[]; modules: { module: ModuleCatalog; assignment: { status: string; note?: string | null } | null }[]; logs: AuditRow[] }>(`/companies/${selectedId}`),
    enabled: Boolean(selectedId),
  });
  const save = useMutation({
    mutationFn: () => {
      const payload = companyFormPayload(form);
      return editingCompanyId
        ? platformAdminApi(`/companies/${editingCompanyId}`, { method: 'PATCH', json: payload })
        : platformAdminApi('/companies', { method: 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success(editingCompanyId ? 'Empresa atualizada' : 'Empresa cadastrada');
      setDialogMode(null);
      setEditingCompanyId(null);
      setForm(EMPTY_COMPANY_FORM);
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'companies'] });
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'company'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao salvar empresa'),
  });
  const status = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) =>
      platformAdminApi(`/companies/${id}/status`, { method: 'PATCH', json: { status: next, reason: `Alteração via Portal Administrativo Global para ${next}` } }),
    onSuccess: () => {
      toast.success('Status atualizado');
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'companies'] });
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'company'] });
    },
  });

  function openCreate() {
    setEditingCompanyId(null);
    setForm(EMPTY_COMPANY_FORM);
    setDialogMode('create');
  }

  function openEdit(company: CompanyRow, profile: CompanyRow['profile'] = company.profile) {
    setEditingCompanyId(company.id);
    setForm(companyToForm(company, profile));
    setDialogMode('edit');
  }

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1fr,390px]">
        <div className="space-y-4">
          <Panel
            title="Empresas"
            actions={
              <div className="flex flex-col gap-2 sm:flex-row">
                <SearchBox value={q} onChange={setQ} />
                <Button size="sm" onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova empresa
                </Button>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>CNPJ</th>
                    <th>Plano</th>
                    <th>Status</th>
                    <th>Usuários</th>
                    <th>Módulos</th>
                    <th>Último acesso</th>
                    <th>Ações</th>
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
                        <Button size="sm" variant="outline" onClick={() => openEdit(company)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => status.mutate({ id: company.id, next: 'ACTIVE' })}>Ativar</Button>
                        <Button size="sm" variant="outline" onClick={() => status.mutate({ id: company.id, next: 'SUSPENDED' })}>Suspender</Button>
                        <Button size="sm" variant="outline" onClick={() => status.mutate({ id: company.id, next: 'INACTIVE' })}>Inativar</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {detail.data && (
            <Panel
              title={`Detalhe: ${detail.data.company.tradeName || detail.data.company.name}`}
              actions={
                <Button size="sm" variant="outline" onClick={() => openEdit(detail.data.company, detail.data.profile)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar cadastro
                </Button>
              }
            >
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="space-y-2 text-sm">
                  <Row label="Razão social" value={detail.data.company.name} />
                  <Row label="Nome fantasia" value={detail.data.company.tradeName ?? '-'} />
                  <Row label="CNPJ" value={detail.data.company.cnpj ?? '-'} />
                  <Row label="Subdomínio" value={detail.data.company.slug ? `${detail.data.company.slug}.gestao360.org` : '-'} />
                  <Row label="Domínio próprio" value={detail.data.company.customDomain ?? '-'} />
                  <Row label="E-mail" value={detail.data.company.email ?? '-'} />
                  <Row label="Telefone" value={detail.data.company.phone ?? '-'} />
                  <Row label="Segmento" value={detail.data.company.segment ?? '-'} />
                  <Row label="Plano" value={detail.data.profile?.planCode ?? '-'} />
                  <Row label="Saúde" value={`${detail.data.profile?.healthScore ?? 0}%`} />
                  <Row label="Contrato" value={formatDate(detail.data.profile?.contractEndsAt)} />
                </div>
                <div className="space-y-2 text-sm">
                  <Row label="Endereço" value={detail.data.company.addressLine ?? '-'} />
                  <Row label="Cidade" value={detail.data.company.city ?? '-'} />
                  <Row label="UF" value={detail.data.company.state ?? '-'} />
                  <Row label="Max. usuários" value={detail.data.company.maxUsers ?? '-'} />
                  <Row label="Status empresa" value={<Status value={detail.data.company.status} />} />
                  <Row label="Status implantação" value={<Status value={detail.data.profile?.lifecycleStatus ?? detail.data.company.status} />} />
                  <Row label="Controle por área" value={detail.data.company.areaAccessEnabled === false ? 'Desativado' : 'Ativado'} />
                  {Object.entries(detail.data.usage).map(([key, value]) => <Row key={key} label={key} value={value} />)}
                </div>
                <div className="space-y-2">
                  {detail.data.modules.slice(0, 8).map((item) => (
                    <div key={item.module.code} className="flex items-center justify-between border px-2 py-1 text-xs">
                      <span>{item.module.name}</span>
                      <Status value={item.assignment?.status ?? 'HERDADO_DO_PLANO'} />
                    </div>
                  ))}
                  {detail.data.company.notes && <div className="border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">{detail.data.company.notes}</div>}
                </div>
              </div>
            </Panel>
          )}
        </div>

        <Panel title="Cadastro completo de empresas" icon={Building2}>
          <div className="space-y-3 text-sm">
            <p className="text-xs leading-5 text-muted-foreground">
              Cadastro, contato, endereço, limite de usuários, status, plano, implantação, controle por área e observações ficam centralizados aqui.
            </p>
            <Button className="w-full" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nova empresa
            </Button>
            <div className="space-y-2 pt-2">
              <Row label="Campos cadastrais" value="Razão, fantasia, CNPJ, contato" />
              <Row label="Endereço" value="Logradouro, cidade e UF" />
              <Row label="Governança" value="Status, plano e implantação" />
              <Row label="Permissões por área" value="Ativar/desativar por empresa" />
            </div>
          </div>
        </Panel>
      </div>

      <CompanyFormDialog
        open={dialogMode !== null}
        mode={dialogMode ?? 'create'}
        form={form}
        setForm={setForm}
        saving={save.isPending}
        onClose={() => {
          setDialogMode(null);
          setEditingCompanyId(null);
          setForm(EMPTY_COMPANY_FORM);
        }}
        onSave={() => save.mutate()}
      />
    </>
  );
}

function CompanyFormDialog({
  open,
  mode,
  form,
  setForm,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  form: CompanyForm;
  setForm: React.Dispatch<React.SetStateAction<CompanyForm>>;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const update = <K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Editar empresa' : 'Nova empresa'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Razão social" value={form.name} onChange={(value) => update('name', value)} />
          <Field label="Nome fantasia" value={form.tradeName} onChange={(value) => update('tradeName', value)} />
          <Field label="CNPJ" value={form.cnpj} onChange={(value) => update('cnpj', value)} />
          <Field label="E-mail" value={form.email} onChange={(value) => update('email', value)} />
          <Field label="Telefone" value={form.phone} onChange={(value) => update('phone', value)} />
          <Field label="Segmento" value={form.segment} onChange={(value) => update('segment', value)} />
          <div className="md:col-span-2">
            <Field label="Endereço" value={form.addressLine} onChange={(value) => update('addressLine', value)} />
          </div>
          <Field label="Cidade" value={form.city} onChange={(value) => update('city', value)} />
          <Field label="UF" value={form.state} onChange={(value) => update('state', value.toUpperCase().slice(0, 2))} />
          <div className="md:col-span-2 grid gap-4 border bg-muted/10 p-3 md:grid-cols-2">
            <div className="md:col-span-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Endereço de acesso (multi-tenant)
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subdomínio</Label>
              <Input
                value={form.slug}
                placeholder="ex.: goiasa"
                onChange={(event) => update('slug', event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              />
              <p className="text-[11px] text-muted-foreground">
                {form.slug.trim() ? `${form.slug.trim()}.gestao360.org` : 'Sem subdomínio dedicado (acessa pelo endereço padrão).'}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Domínio próprio (white-label)</Label>
              <Input
                value={form.customDomain}
                placeholder="ex.: indicadores.suaempresa.com.br"
                onChange={(event) => update('customDomain', event.target.value.toLowerCase())}
              />
              <p className="text-[11px] text-muted-foreground">Opcional. Requer CNAME do cliente apontando para o servidor.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Limite de usuários</Label>
            <Input type="number" min={0} value={form.maxUsers} onChange={(event) => update('maxUsers', event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Plano</Label>
            <NativeSelect value={form.planCode} onChange={(event) => update('planCode', event.target.value)}>
              {COMPANY_PLAN_CODES.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status da empresa</Label>
            <NativeSelect value={form.status} onChange={(event) => update('status', event.target.value)}>
              {COMPANY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status de implantação</Label>
            <NativeSelect value={form.lifecycleStatus} onChange={(event) => update('lifecycleStatus', event.target.value)}>
              {COMPANY_LIFECYCLE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </NativeSelect>
          </div>
          <label className="flex items-center gap-2 border bg-muted/20 px-3 py-2 text-sm">
            <input type="checkbox" checked={form.areaAccessEnabled} onChange={(event) => update('areaAccessEnabled', event.target.checked)} />
            Controle de visibilidade por área ativo
          </label>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={4} value={form.notes} onChange={(event) => update('notes', event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={saving || !form.name.trim()} onClick={onSave}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BusinessModuleRow {
  code: string;
  name: string;
  menuOrder: number;
  core: boolean;
  members: string[];
}

// Status que contam como "ativo" ao derivar o estado de uma aba a partir dos membros.
const ACTIVE_STATUS_SET = new Set(['ATIVO', 'ACTIVE', 'HERDADO_DO_PLANO', 'EM_IMPLANTACAO', 'EM_TESTE', 'EXPERIMENTAL', 'SOMENTE_LEITURA', 'ATIVACAO_PROGRAMADA', 'EXPIRACAO_PROGRAMADA']);
// Opções que o admin pode aplicar a uma aba inteira.
const BUSINESS_APPLY_STATUSES = ['HERDADO_DO_PLANO', 'ATIVO', 'BLOQUEADO', 'SOMENTE_LEITURA'] as const;

/** Deriva o status de uma aba (Ativo/Bloqueado/Misto) a partir dos módulos membros. */
function deriveBusinessStatus(company: MatrixCompany, members: string[]): string {
  const statuses = members.map((code) => company.modules.find((m) => m.moduleCode === code)?.status ?? 'HERDADO_DO_PLANO');
  if (statuses.length === 0) return 'HERDADO_DO_PLANO';
  const allActive = statuses.every((s) => ACTIVE_STATUS_SET.has(s));
  if (allActive) return 'ATIVO';
  const allBlocked = statuses.every((s) => !ACTIVE_STATUS_SET.has(s));
  if (allBlocked) return 'BLOQUEADO';
  return 'MISTO';
}

function ModulesSection() {
  const queryClient = useQueryClient();
  const [change, setChange] = useState<Record<string, string>>({});
  const [applyForm, setApplyForm] = useState({ companyId: '', planCode: 'ESSENCIAL' });
  const matrix = useQuery({
    queryKey: ['platform-admin', 'module-matrix'],
    queryFn: () => platformAdminApi<{ modules: ModuleCatalog[]; companies: MatrixCompany[] }>('/module-matrix'),
  });
  const business = useQuery({
    queryKey: ['platform-admin', 'business-modules'],
    queryFn: () => platformAdminApi<BusinessModuleRow[]>('/business-modules'),
  });
  const plans = useQuery({
    queryKey: ['platform-admin', 'plans', 'module-apply'],
    queryFn: () => platformAdminApi<PlanRow[]>('/plans'),
  });
  const update = useMutation({
    mutationFn: ({ companyId, businessCode, status }: { companyId: string; businessCode: string; status: string }) =>
      platformAdminApi(`/companies/${companyId}/business-modules/${businessCode}`, { method: 'PATCH', json: { status, reason: `Aba ${businessCode} → ${status}` } }),
    onSuccess: () => {
      toast.success('Módulo atualizado');
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'module-matrix'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao atualizar módulo'),
  });
  const applyPlan = useMutation({
    mutationFn: () => platformAdminApi(`/companies/${applyForm.companyId}/modules/apply-plan/${applyForm.planCode}`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Plano aplicado a empresa');
      setChange({});
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'module-matrix'] });
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'companies'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao aplicar plano'),
  });

  if (matrix.isLoading || business.isLoading) return <LoadingGrid />;
  if (!matrix.data || !business.data) return <EmptyState title="Matriz indisponível" />;
  const businessModules = [...business.data].sort((a, b) => a.menuOrder - b.menuOrder);

  return (
    <div className="space-y-4">
      <Panel title="Aplicar plano em uma empresa" icon={ListChecks}>
        <div className="grid gap-3 lg:grid-cols-[1fr,260px,auto]">
          <div>
            <Label className="text-xs">Empresa</Label>
            <NativeSelect value={applyForm.companyId} onChange={(event) => setApplyForm((prev) => ({ ...prev, companyId: event.target.value }))}>
              <option value="">Selecione a empresa</option>
              {matrix.data.companies.map((company) => (
                <option key={company.id} value={company.id}>{company.tradeName || company.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label className="text-xs">Plano</Label>
            <NativeSelect value={applyForm.planCode} onChange={(event) => setApplyForm((prev) => ({ ...prev, planCode: event.target.value }))}>
              {(plans.data ?? []).map((plan) => (
                <option key={plan.code} value={plan.code}>{plan.name} ({plan.code})</option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex items-end">
            <Button className="w-full lg:w-auto" disabled={!applyForm.companyId || !applyForm.planCode || applyPlan.isPending} onClick={() => applyPlan.mutate()}>
              Aplicar e bloquear fora do plano
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Módulos (abas do menu)">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {businessModules.map((bm) => (
            <div key={bm.code} className="border bg-white p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{bm.name}</div>
                {bm.core && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Padrão</span>}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{bm.members.length} {bm.members.length === 1 ? 'recurso' : 'recursos'} internos</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Matriz de módulos por empresa">
        <div className="overflow-x-auto">
          <table className="table-modern min-w-[1280px]">
            <thead>
              <tr>
                <th>Empresa</th>
                {businessModules.map((bm) => <th key={bm.code}>{bm.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {matrix.data.companies.map((company) => (
                <tr key={company.id}>
                  <td className="font-medium">{company.tradeName || company.name}</td>
                  {businessModules.map((bm) => {
                    const derived = deriveBusinessStatus(company, bm.members);
                    const key = `${company.id}:${bm.code}`;
                    const fallback = BUSINESS_APPLY_STATUSES.includes(derived as (typeof BUSINESS_APPLY_STATUSES)[number]) ? derived : 'ATIVO';
                    const selected = change[key] ?? fallback;
                    return (
                      <td key={key} className="min-w-[210px]">
                        <div className="flex items-center gap-2">
                          <Status value={derived} />
                          {bm.core ? (
                            <span className="text-[10px] text-muted-foreground" title="Aba padrão — sempre ativa">padrão</span>
                          ) : (
                            <>
                              <select
                                className="h-8 flex-1 border bg-background px-2 text-xs"
                                value={selected}
                                onChange={(event) => setChange((prev) => ({ ...prev, [key]: event.target.value }))}
                              >
                                {BUSINESS_APPLY_STATUSES.map((status) => <option key={status}>{status}</option>)}
                              </select>
                              <Button size="sm" variant="outline" disabled={selected === derived || update.isPending} onClick={() => update.mutate({ companyId: company.id, businessCode: bm.code, status: selected })}>Salvar</Button>
                            </>
                          )}
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
  const [form, setForm] = useState<PlanForm>(EMPTY_PLAN_FORM);
  const plans = useQuery({
    queryKey: ['platform-admin', 'plans'],
    queryFn: () => platformAdminApi<PlanRow[]>('/plans'),
  });
  const business = useQuery({
    queryKey: ['platform-admin', 'business-modules'],
    queryFn: () => platformAdminApi<BusinessModuleRow[]>('/business-modules'),
  });
  const save = useMutation({
    mutationFn: () => {
      // Expandir as abas de negócio selecionadas em módulos granulares antes de enviar à API
      const finalModuleCodes = Array.from(
        new Set(
          form.moduleCodes.flatMap((code) => {
            const bm = (business.data ?? []).find((b) => b.code === code);
            return bm ? bm.members : [];
          })
        )
      );

      return platformAdminApi('/plans', {
        method: 'POST',
        json: {
          ...form,
          monthlyPriceCents: Number(form.monthlyPriceCents || 0),
          setupPriceCents: Number(form.setupPriceCents || 0),
          defaultUsers: form.defaultUsers ? Number(form.defaultUsers) : null,
          defaultBranches: form.defaultBranches ? Number(form.defaultBranches) : null,
          storageLimitMb: form.storageLimitMb ? Number(form.storageLimitMb) : null,
          trialDays: form.trialDays ? Number(form.trialDays) : null,
          moduleCodes: finalModuleCodes,
        },
      });
    },
    onSuccess: () => {
      toast.success('Plano salvo');
      setForm(EMPTY_PLAN_FORM);
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'plans'] });
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'module-matrix'] });
    },
  });

  const businessModules = useMemo(() => {
    return [...(business.data ?? [])].sort((a, b) => a.menuOrder - b.menuOrder);
  }, [business.data]);

  const selectedModules = new Set(form.moduleCodes);

  function editPlan(plan: PlanRow) {
    // Determinar quais abas de negócio têm todos os seus membros incluídos no plano
    const planModuleCodes = new Set(plan.modules.filter((m) => m.included).map((m) => m.moduleCode));
    const activeBusinessModules = (business.data ?? [])
      .filter((bm) => {
        if (bm.core) return true; // As abas core/padrão sempre estão selecionadas
        return bm.members.every((memberCode) => planModuleCodes.has(memberCode));
      })
      .map((bm) => bm.code);

    setForm({
      code: plan.code,
      name: plan.name,
      monthlyPriceCents: String(plan.monthlyPriceCents ?? 0),
      setupPriceCents: String(plan.setupPriceCents ?? 0),
      defaultUsers: plan.defaultUsers == null ? '' : String(plan.defaultUsers),
      defaultBranches: plan.defaultBranches == null ? '' : String(plan.defaultBranches),
      storageLimitMb: plan.storageLimitMb == null ? '' : String(plan.storageLimitMb),
      supportLevel: plan.supportLevel ?? '',
      sla: plan.sla ?? '',
      trialDays: plan.trialDays == null ? '' : String(plan.trialDays),
      moduleCodes: activeBusinessModules,
    });
  }

  function toggleModule(code: string) {
    const isCore = (business.data ?? []).find((b) => b.code === code)?.core;
    if (isCore) return;
    setForm((prev) => ({
      ...prev,
      moduleCodes: prev.moduleCodes.includes(code)
        ? prev.moduleCodes.filter((item) => item !== code)
        : [...prev.moduleCodes, code],
    }));
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr,420px]">
      <Panel title="Planos comerciais">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(plans.data ?? []).map((plan) => {
            const planModuleCodes = new Set(plan.modules.filter((m) => m.included).map((m) => m.moduleCode));
            // Derivar abas de negócio opcionais/comerciais (não-core) inclusas no plano
            const activeBusinessModules = (business.data ?? [])
              .filter((bm) => {
                if (bm.core) return false;
                return bm.members.every((memberCode) => planModuleCodes.has(memberCode));
              });
            const names = activeBusinessModules.map((bm) => bm.name);
            return (
              <div key={plan.code} className="border bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{plan.name}</div>
                    <div className="text-xs text-muted-foreground">{plan.code}</div>
                  </div>
                  <Status value={plan.status ?? 'ACTIVE'} />
                </div>
                <div className="mt-3 text-2xl font-semibold">{formatMoney(plan.monthlyPriceCents)}</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {plan.defaultUsers ?? 'Ilimitado'} usuários · {activeBusinessModules.length} abas opcionais inclusas
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {names.slice(0, 7).map((name) => <span key={name} className="pill pill-gray">{name}</span>)}
                  {names.length > 7 && <span className="pill pill-gray">+{names.length - 7}</span>}
                </div>
                <Button className="mt-4 w-full" size="sm" variant="outline" onClick={() => editPlan(plan)}>Editar plano</Button>
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel title="Novo ou atualizar plano">
        <div className="space-y-3">
          <Field label="Código" value={form.code} onChange={(value) => setForm((prev) => ({ ...prev, code: value.toUpperCase() }))} />
          <Field label="Nome" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
          <Field label="Mensalidade em centavos" value={form.monthlyPriceCents} onChange={(value) => setForm((prev) => ({ ...prev, monthlyPriceCents: value }))} />
          <Field label="Implantação em centavos" value={form.setupPriceCents} onChange={(value) => setForm((prev) => ({ ...prev, setupPriceCents: value }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Usuários padrão" value={form.defaultUsers} onChange={(value) => setForm((prev) => ({ ...prev, defaultUsers: value }))} />
            <Field label="Filiais padrão" value={form.defaultBranches} onChange={(value) => setForm((prev) => ({ ...prev, defaultBranches: value }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Storage MB" value={form.storageLimitMb} onChange={(value) => setForm((prev) => ({ ...prev, storageLimitMb: value }))} />
            <Field label="Dias trial" value={form.trialDays} onChange={(value) => setForm((prev) => ({ ...prev, trialDays: value }))} />
          </div>
          <Field label="Suporte" value={form.supportLevel} onChange={(value) => setForm((prev) => ({ ...prev, supportLevel: value }))} />
          <Field label="SLA" value={form.sla} onChange={(value) => setForm((prev) => ({ ...prev, sla: value }))} />
          <div className="rounded-sm border">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Módulos inclusos</div>
              <div className="text-xs text-muted-foreground">{selectedModules.size} selecionados</div>
            </div>
            <div className="max-h-[420px] overflow-y-auto p-3">
              {businessModules.map((module) => {
                const core = module.core;
                const checked = core || selectedModules.has(module.code);
                return (
                  <label key={module.code} className={cn('flex cursor-pointer items-start gap-2 border px-3 py-2 text-sm mb-2 last:mb-0', checked && 'border-[#101820] bg-[#f8fafb]', core && 'cursor-not-allowed opacity-80')}>
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      disabled={core}
                      onChange={() => toggleModule(module.code)}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{module.name}</span>
                      <span className="block text-xs text-muted-foreground">{module.code}{core ? ' · essencial da empresa' : ''}</span>
                    </span>
                  </label>
                );
              })}
              {businessModules.length === 0 && <EmptyState title="Catálogo de módulos indisponível" />}
            </div>
          </div>
          <Button className="w-full" disabled={!form.code || !form.name || save.isPending} onClick={() => save.mutate()}>Salvar plano</Button>
          <Button className="w-full" variant="ghost" onClick={() => setForm(EMPTY_PLAN_FORM)}>Limpar formulário</Button>
        </div>
      </Panel>
    </div>
  );
}

function UsersManagementSection() {
  return (
    <div className="rounded-sm border bg-white p-4">
      <UsersPage />
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
      toast.success('Usuário atualizado');
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'users'] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => platformAdminApi(`/users/${id}/revoke-sessions`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Sessões revogadas');
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'users'] });
    },
  });
  return (
    <Panel title="Usuários das empresas" actions={<SearchBox value={q} onChange={setQ} />}>
      <div className="overflow-x-auto">
        <table className="table-modern">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Empresa</th>
              <th>Perfil</th>
              <th>Status</th>
              <th>Último acesso</th>
              <th>Sessões</th>
              <th>Ações</th>
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
  const [support, setSupport] = useState({ companyId: '', reason: 'Diagnostico técnico', justification: '', minutes: '60' });
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
      <Panel title="Sessões abertas">
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="Sessões de empresas" value={sessions.data?.companySessions.length ?? 0} />
          <Metric label="Sessões internas" value={sessions.data?.adminSessions.length ?? 0} />
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

interface EmailSettings {
  configured: boolean;
  source: 'db' | 'env' | 'none';
  host: string | null;
  port: number;
  secure: boolean;
  username: string | null;
  hasPassword: boolean;
  fromName: string | null;
  fromAddress: string | null;
  replyTo: string | null;
  status: string;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestError: string | null;
}

interface Mailbox {
  id: string;
  address: string;
  displayName: string | null;
  purpose: string | null;
  isDefault: boolean;
  active: boolean;
  notes: string | null;
}

const PASSWORD_MASK = '••••••';

function EmailSection() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['platform-admin', 'email-settings'], queryFn: () => platformAdminApi<EmailSettings>('/email/settings') });
  const mailboxes = useQuery({ queryKey: ['platform-admin', 'mailboxes'], queryFn: () => platformAdminApi<Mailbox[]>('/email/mailboxes') });

  const [form, setForm] = useState({ host: '', port: '587', secure: false, username: '', password: '', fromName: '', fromAddress: '', replyTo: '', status: 'active' });
  const [testTo, setTestTo] = useState('');
  const [newBox, setNewBox] = useState({ address: '', displayName: '', purpose: '' });

  useEffect(() => {
    const d = settings.data;
    if (!d) return;
    setForm({
      host: d.host ?? '',
      port: String(d.port ?? 587),
      secure: Boolean(d.secure),
      username: d.username ?? '',
      password: d.hasPassword ? PASSWORD_MASK : '',
      fromName: d.fromName ?? '',
      fromAddress: d.fromAddress ?? '',
      replyTo: d.replyTo ?? '',
      status: d.status ?? 'active',
    });
  }, [settings.data]);

  const update = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  const save = useMutation({
    mutationFn: () => platformAdminApi('/email/settings', { method: 'PUT', json: { ...form, port: Number(form.port) || 587 } }),
    onSuccess: () => { toast.success('Configuração de e-mail salva'); qc.invalidateQueries({ queryKey: ['platform-admin', 'email-settings'] }); },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao salvar'),
  });
  const test = useMutation({
    mutationFn: () => platformAdminApi<{ ok: boolean; error?: string | null; to: string }>('/email/test', { method: 'POST', json: { to: testTo || undefined } }),
    onSuccess: (r) => {
      if (r.ok) toast.success(`E-mail de teste enviado para ${r.to}`);
      else toast.error(`Falha no envio: ${r.error ?? 'erro desconhecido'}`);
      qc.invalidateQueries({ queryKey: ['platform-admin', 'email-settings'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha no teste de envio'),
  });
  const addBox = useMutation({
    mutationFn: () => platformAdminApi('/email/mailboxes', { method: 'POST', json: newBox }),
    onSuccess: () => { toast.success('Remetente cadastrado'); setNewBox({ address: '', displayName: '', purpose: '' }); qc.invalidateQueries({ queryKey: ['platform-admin', 'mailboxes'] }); },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao cadastrar remetente'),
  });
  const setDefault = useMutation({
    mutationFn: (id: string) => platformAdminApi(`/email/mailboxes/${id}/default`, { method: 'POST' }),
    onSuccess: () => { toast.success('Remetente padrão atualizado'); qc.invalidateQueries({ queryKey: ['platform-admin', 'mailboxes'] }); },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao definir padrão'),
  });
  const toggleBox = useMutation({
    mutationFn: (box: Mailbox) => platformAdminApi(`/email/mailboxes/${box.id}`, { method: 'PATCH', json: { active: !box.active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-admin', 'mailboxes'] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao atualizar remetente'),
  });
  const delBox = useMutation({
    mutationFn: (id: string) => platformAdminApi(`/email/mailboxes/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Remetente removido'); qc.invalidateQueries({ queryKey: ['platform-admin', 'mailboxes'] }); },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao remover'),
  });

  const data = settings.data;
  const lastTest = data?.lastTestOk === true ? 'SUCCESS' : data?.lastTestOk === false ? 'ERROR' : null;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel
        title="Servidor SMTP"
        icon={Mail}
        actions={<span className="pill pill-gray whitespace-nowrap">Origem: {data?.source === 'db' ? 'banco' : data?.source === 'env' ? 'ambiente' : 'não configurado'}</span>}
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Host SMTP</Label>
              <Input value={form.host} onChange={(e) => update({ host: e.target.value })} placeholder="smtp.zoho.com" />
            </div>
            <div>
              <Label className="text-xs">Porta</Label>
              <Input value={form.port} onChange={(e) => update({ port: e.target.value.replace(/\D/g, '') })} placeholder="587" />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" checked={form.secure} onChange={(e) => update({ secure: e.target.checked })} />
              Conexão segura (TLS/SSL na porta 465)
            </label>
            <div>
              <Label className="text-xs">Usuário</Label>
              <Input value={form.username} onChange={(e) => update({ username: e.target.value })} placeholder="contato@gestao360.org" />
            </div>
            <div>
              <Label className="text-xs">Senha</Label>
              <Input type="password" value={form.password} onChange={(e) => update({ password: e.target.value })} placeholder={data?.hasPassword ? 'Senha salva (deixe para manter)' : 'Senha do SMTP'} />
            </div>
            <div>
              <Label className="text-xs">Nome de exibição (From)</Label>
              <Input value={form.fromName} onChange={(e) => update({ fromName: e.target.value })} placeholder="Gestão 360" />
            </div>
            <div>
              <Label className="text-xs">E-mail remetente padrão (From)</Label>
              <Input value={form.fromAddress} onChange={(e) => update({ fromAddress: e.target.value })} placeholder="contato@gestao360.org" />
            </div>
            <div>
              <Label className="text-xs">Responder para (Reply-To)</Label>
              <Input value={form.replyTo} onChange={(e) => update({ replyTo: e.target.value })} placeholder="opcional" />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <NativeSelect value={form.status} onChange={(e) => update({ status: e.target.value })}>
                <option value="active">Ativo</option>
                <option value="disabled">Desativado</option>
              </NativeSelect>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="mr-2 h-4 w-4" />{save.isPending ? 'Salvando...' : 'Salvar configuração'}
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="destinatário do teste (opcional)" className="w-56" />
              <Button size="sm" variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
                <Send className="mr-2 h-4 w-4" />{test.isPending ? 'Enviando...' : 'Testar envio'}
              </Button>
            </div>
          </div>

          {lastTest && (
            <div className="flex items-center justify-between border bg-muted/20 px-3 py-2 text-xs">
              <span>Último teste: {data?.lastTestAt ? formatDate(data.lastTestAt) : '-'}</span>
              <span className="flex items-center gap-2"><Status value={lastTest} />{data?.lastTestError && <span className="text-muted-foreground">{data.lastTestError}</span>}</span>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Remetentes do sistema" icon={Send}>
        <p className="mb-3 text-xs text-muted-foreground">
          Endereços que o sistema usa para enviar e-mails (convites de reunião, notificações). O remetente padrão (★) é usado quando nenhum outro é especificado.
          Para que <strong>contato@gestao360.org</strong> receba mensagens de verdade é preciso provisionar a caixa no provedor + DNS (veja docs/email-gestao360.md).
        </p>
        <div className="space-y-2">
          {(mailboxes.data ?? []).map((box) => (
            <div key={box.id} className="flex flex-wrap items-center justify-between gap-2 border px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  {box.isDefault && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />}
                  <span className="truncate">{box.address}</span>
                  {!box.active && <span className="pill pill-gray">inativo</span>}
                </div>
                {(box.displayName || box.purpose) && (
                  <div className="text-xs text-muted-foreground">{[box.displayName, box.purpose].filter(Boolean).join(' · ')}</div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {!box.isDefault && <Button size="sm" variant="ghost" onClick={() => setDefault.mutate(box.id)} title="Tornar padrão"><Star className="h-4 w-4" /></Button>}
                <Button size="sm" variant="ghost" onClick={() => toggleBox.mutate(box)}>{box.active ? 'Desativar' : 'Ativar'}</Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => delBox.mutate(box.id)} title="Remover"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
          {(mailboxes.data ?? []).length === 0 && <EmptyState title="Nenhum remetente cadastrado" />}
        </div>

        <div className="mt-3 space-y-2 border-t pt-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input value={newBox.address} onChange={(e) => setNewBox((p) => ({ ...p, address: e.target.value }))} placeholder="contato@gestao360.org" />
            <Input value={newBox.displayName} onChange={(e) => setNewBox((p) => ({ ...p, displayName: e.target.value }))} placeholder="Nome de exibição" />
            <Input value={newBox.purpose} onChange={(e) => setNewBox((p) => ({ ...p, purpose: e.target.value }))} placeholder="Finalidade (ex.: contato)" />
          </div>
          <Button size="sm" onClick={() => addBox.mutate()} disabled={addBox.isPending || !newBox.address.trim()}>
            <Plus className="mr-2 h-4 w-4" />Adicionar remetente
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function InboxSection() {
  const [tab, setTab] = useState<'contacts' | 'support'>('contacts');
  const queryClient = useQueryClient();

  // --- Contatos ---
  const [contactSearch, setContactSearch] = useState('');
  const [contactFilter, setContactFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  const contactsQuery = useQuery({
    queryKey: ['platform-admin', 'inbox', 'contacts', contactSearch, contactFilter],
    queryFn: () => {
      let url = `/platform-admin/inbox/contacts?q=${encodeURIComponent(contactSearch)}`;
      if (contactFilter === 'unread') url += '&read=false';
      if (contactFilter === 'read') url += '&read=true';
      return platformAdminApi<any[]>(url);
    },
  });

  const markContactRead = useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      platformAdminApi(`/platform-admin/inbox/contacts/${id}/read`, { method: 'PATCH', json: { read } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'inbox', 'contacts'] });
      setSelectedContact((prev: any) => prev ? { ...prev, read: !prev.read } : null);
      toast.success('Status da mensagem atualizado');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao atualizar contato'),
  });

  const deleteContact = useMutation({
    mutationFn: (id: string) =>
      platformAdminApi(`/platform-admin/inbox/contacts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'inbox', 'contacts'] });
      setSelectedContact(null);
      toast.success('Mensagem excluída com sucesso');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao excluir contato'),
  });

  // --- Suporte ---
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const ticketsQuery = useQuery({
    queryKey: ['platform-admin', 'inbox', 'tickets', ticketSearch, ticketStatusFilter],
    queryFn: () => {
      let url = `/platform-admin/inbox/support-tickets?q=${encodeURIComponent(ticketSearch)}`;
      if (ticketStatusFilter !== 'all') url += `&status=${encodeURIComponent(ticketStatusFilter)}`;
      return platformAdminApi<any[]>(url);
    },
  });

  const ticketDetailsQuery = useQuery({
    queryKey: ['platform-admin', 'inbox', 'tickets', selectedTicketId],
    queryFn: () => platformAdminApi<any>(`/platform-admin/inbox/support-tickets/${selectedTicketId}`),
    enabled: Boolean(selectedTicketId),
  });

  const sendReply = useMutation({
    mutationFn: ({ id, message, isInternal }: { id: string; message: string; isInternal: boolean }) =>
      platformAdminApi(`/platform-admin/inbox/support-tickets/${id}/messages`, {
        method: 'POST',
        json: { message, isInternal },
      }),
    onSuccess: () => {
      setReplyText('');
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'inbox', 'tickets', selectedTicketId] });
      toast.success('Resposta enviada com sucesso');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao enviar resposta'),
  });

  const updateTicketStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      platformAdminApi(`/platform-admin/inbox/support-tickets/${id}`, {
        method: 'PATCH',
        json: { status },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'inbox', 'tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['platform-admin', 'inbox', 'tickets', selectedTicketId] });
      toast.success('Status do chamado atualizado');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status'),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Caixa de Entrada</h1>
          <p className="text-sm text-muted-foreground">Gerencie contatos do site institucional e chamados de suporte técnico global.</p>
        </div>

        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
          <button
            onClick={() => setTab('contacts')}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
              tab === 'contacts' ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            Contatos do Site
          </button>
          <button
            onClick={() => setTab('support')}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
              tab === 'support' ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            Suporte Técnico
          </button>
        </div>
      </div>

      {tab === 'contacts' ? (
        <div className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
          <Panel title="Mensagens de Visitantes" description="Formulários de contato, SAC, comercial e LGPD preenchidos no site.">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center justify-between">
              <div className="relative flex-1 mr-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8 h-9"
                  placeholder="Pesquisar mensagens..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <NativeSelect
                  className="h-9 text-xs"
                  value={contactFilter}
                  onChange={(e: any) => setContactFilter(e.target.value)}
                >
                  <option value="all">Todas as mensagens</option>
                  <option value="unread">Não lidas</option>
                  <option value="read">Lidas</option>
                </NativeSelect>
              </div>
            </div>

            <div className="divide-y max-h-[500px] overflow-y-auto pr-1">
              {contactsQuery.isLoading && <div className="py-6 text-center text-xs text-muted-foreground">Carregando mensagens...</div>}
              {contactsQuery.data?.map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => {
                    setSelectedContact(contact);
                    if (!contact.read) {
                      markContactRead.mutate({ id: contact.id, read: true });
                    }
                  }}
                  className={cn(
                    "flex flex-col gap-1 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors border-l-2",
                    contact.read ? "border-l-transparent opacity-75" : "border-l-cyan-500 bg-cyan-50/10"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-sm">{contact.name}</span>
                    <span className="text-xs text-muted-foreground">{new Date(contact.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{contact.company}</span>
                    <span>•</span>
                    <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[10px]">{contact.requestType}</span>
                  </div>
                  <p className="text-xs line-clamp-2 text-slate-600 dark:text-slate-300 mt-1">{contact.message}</p>
                </div>
              ))}
              {(contactsQuery.data ?? []).length === 0 && !contactsQuery.isLoading && (
                <EmptyState title="Nenhuma mensagem recebida" />
              )}
            </div>
          </Panel>

          <div>
            {selectedContact ? (
              <Panel title="Detalhes do Contato" description="Informações completas do remetente e mensagem.">
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-2 border-b pb-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Remetente</Label>
                      <div className="font-semibold">{selectedContact.name}</div>
                      <div className="text-xs text-muted-foreground">{selectedContact.role || 'Sem cargo'}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Empresa</Label>
                      <div className="font-semibold">{selectedContact.company}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-b pb-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">E-mail</Label>
                      <div>
                        <a href={`mailto:${selectedContact.email}`} className="text-cyan-500 hover:underline">{selectedContact.email}</a>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Telefone</Label>
                      <div>{selectedContact.phone || 'Não informado'}</div>
                    </div>
                  </div>

                  <div className="border-b pb-3">
                    <Label className="text-xs text-muted-foreground">Assunto / Tipo</Label>
                    <div className="mt-1">
                      <span className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded font-semibold text-xs">{selectedContact.requestType}</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Mensagem</Label>
                    <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 font-sans whitespace-pre-wrap">
                      {selectedContact.message}
                    </p>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markContactRead.mutate({ id: selectedContact.id, read: !selectedContact.read })}
                    >
                      {selectedContact.read ? 'Marcar como não lida' : 'Marcar como lida'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => {
                        if (confirm('Tem certeza que deseja excluir esta mensagem de contato?')) {
                          deleteContact.mutate(selectedContact.id);
                        }
                      }}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              </Panel>
            ) : (
              <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground dark:border-slate-850">
                Selecione uma mensagem para ler os detalhes.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr,1.8fr]">
          <Panel title="Lista de Chamados" description="Todos os chamados de suporte abertos nas empresas.">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center justify-between">
              <div className="relative flex-1 mr-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8 h-9"
                  placeholder="Pesquisar chamados..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                />
              </div>
              <div>
                <NativeSelect
                  className="h-9 text-xs"
                  value={ticketStatusFilter}
                  onChange={(e: any) => setTicketStatusFilter(e.target.value)}
                >
                  <option value="all">Todos os status</option>
                  <option value="Aberto">Aberto</option>
                  <option value="Em Atendimento">Em Atendimento</option>
                  <option value="Resolvido">Resolvido</option>
                  <option value="Cancelado">Cancelado</option>
                </NativeSelect>
              </div>
            </div>

            <div className="divide-y max-h-[500px] overflow-y-auto pr-1">
              {ticketsQuery.isLoading && <div className="py-6 text-center text-xs text-muted-foreground">Carregando chamados...</div>}
              {ticketsQuery.data?.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={cn(
                    "flex flex-col gap-1.5 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors border-l-2",
                    selectedTicketId === ticket.id ? "border-l-cyan-500 bg-cyan-50/10" : "border-l-transparent"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-sm line-clamp-1">{ticket.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{new Date(ticket.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{ticket.company?.name}</span>
                    <span>•</span>
                    <span>{ticket.requesterName}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide",
                      ticket.status === 'Aberto' ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" :
                      ticket.status === 'Em Atendimento' ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" :
                      ticket.status === 'Resolvido' ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" :
                      "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-400"
                    )}>
                      {ticket.status}
                    </span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                      ticket.priority === 'Alta' ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                      ticket.priority === 'Média' ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" :
                      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                    )}>
                      P: {ticket.priority}
                    </span>
                  </div>
                </div>
              ))}
              {(ticketsQuery.data ?? []).length === 0 && !ticketsQuery.isLoading && (
                <EmptyState title="Nenhum chamado de suporte" />
              )}
            </div>
          </Panel>

          <div>
            {selectedTicketId && ticketDetailsQuery.data ? (
              <Panel
                title={`Chamado #${ticketDetailsQuery.data.id.substring(0, 8)}`}
                description={`Aberto por ${ticketDetailsQuery.data.requesterName} (${ticketDetailsQuery.data.company?.name})`}
              >
                <div className="space-y-4">
                  <div className="border-b pb-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label className="text-xs text-muted-foreground shrink-0">Alterar Status:</Label>
                      <NativeSelect
                        className="h-8 text-xs py-0.5"
                        value={ticketDetailsQuery.data.status}
                        onChange={(e: any) => updateTicketStatus.mutate({ id: ticketDetailsQuery.data.id, status: e.target.value })}
                      >
                        <option value="Aberto">Aberto</option>
                        <option value="Em Atendimento">Em Atendimento</option>
                        <option value="Resolvido">Resolvido</option>
                        <option value="Cancelado">Cancelado</option>
                      </NativeSelect>

                      <span className="text-xs text-muted-foreground ml-auto">Prioridade: <strong>{ticketDetailsQuery.data.priority}</strong></span>
                    </div>

                    <div>
                      <h3 className="font-bold text-base">{ticketDetailsQuery.data.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 mt-1.5 whitespace-pre-wrap">{ticketDetailsQuery.data.description}</p>
                    </div>
                  </div>

                  {/* Chat de mensagens */}
                  <div className="space-y-3 max-h-[300px] overflow-y-auto border rounded-lg p-3 bg-slate-50/50 dark:bg-slate-900/30 dark:border-slate-800">
                    <div className="text-center text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Histórico de Mensagens</div>
                    {ticketDetailsQuery.data.messages?.map((msg: any) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "p-2.5 rounded-lg text-xs max-w-[85%] space-y-1 shadow-sm border",
                          msg.user?.email === ticketDetailsQuery.data.requesterEmail
                            ? "bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 mr-auto"
                            : msg.isInternal
                              ? "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-200 ml-auto"
                              : "bg-cyan-50 border-cyan-200 text-cyan-900 dark:bg-cyan-950/20 dark:border-cyan-900 dark:text-cyan-200 ml-auto"
                        )}
                      >
                        <div className="flex justify-between items-center gap-4 font-semibold text-[10px]">
                          <span>{msg.user?.name} {msg.isInternal && '(Interno)'}</span>
                          <span className="opacity-60">{new Date(msg.createdAt).toLocaleDateString('pt-BR')} {new Date(msg.createdAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    ))}
                    {(ticketDetailsQuery.data.messages ?? []).length === 0 && (
                      <div className="text-center text-xs text-muted-foreground py-4">Nenhuma mensagem adicional.</div>
                    )}
                  </div>

                  {/* Form de resposta */}
                  <div className="space-y-3 pt-2">
                    <Textarea
                      className="text-xs h-20"
                      placeholder="Escreva sua resposta de suporte..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isInternal}
                          onChange={(e) => setIsInternal(e.target.checked)}
                          className="rounded border-slate-300 dark:border-slate-700"
                        />
                        <span>Mensagem Interna (Apenas para equipe)</span>
                      </label>

                      <Button
                        size="sm"
                        disabled={sendReply.isPending || !replyText.trim()}
                        onClick={() => sendReply.mutate({ id: ticketDetailsQuery.data.id, message: replyText, isInternal })}
                      >
                        Enviar Resposta
                      </Button>
                    </div>
                  </div>
                </div>
              </Panel>
            ) : (
              <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground dark:border-slate-800">
                Selecione um chamado para visualizar e interagir.
              </div>
            )}
          </div>
        </div>
      )}
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
      <Panel title="Ambientes e versões" icon={ServerCog}>
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
      <Panel title="Integrações e jobs" icon={Wrench}>
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

function companyToForm(company: CompanyRow, profile: CompanyRow['profile'] = company.profile): CompanyForm {
  return {
    name: company.name ?? '',
    tradeName: company.tradeName ?? '',
    cnpj: company.cnpj ?? '',
    slug: company.slug ?? '',
    customDomain: company.customDomain ?? '',
    email: company.email ?? '',
    phone: company.phone ?? '',
    segment: company.segment ?? '',
    addressLine: company.addressLine ?? '',
    city: company.city ?? '',
    state: company.state ?? '',
    maxUsers: company.maxUsers === null || company.maxUsers === undefined ? '' : String(company.maxUsers),
    status: company.status ?? 'ACTIVE',
    lifecycleStatus: profile?.lifecycleStatus ?? company.status ?? 'ACTIVE',
    areaAccessEnabled: company.areaAccessEnabled !== false,
    planCode: profile?.planCode ?? 'ESSENCIAL',
    notes: company.notes ?? '',
  };
}

function companyFormPayload(form: CompanyForm) {
  const maxUsers = form.maxUsers.trim() ? Number(form.maxUsers) : null;
  return {
    name: form.name.trim(),
    tradeName: blankToNull(form.tradeName),
    cnpj: blankToNull(form.cnpj),
    slug: blankToNull(form.slug),
    customDomain: blankToNull(form.customDomain),
    email: blankToNull(form.email),
    phone: blankToNull(form.phone),
    segment: blankToNull(form.segment),
    addressLine: blankToNull(form.addressLine),
    city: blankToNull(form.city),
    state: blankToNull(form.state),
    maxUsers: Number.isFinite(maxUsers) ? maxUsers : null,
    status: form.status,
    lifecycleStatus: form.lifecycleStatus,
    areaAccessEnabled: form.areaAccessEnabled,
    planCode: form.planCode,
    notes: blankToNull(form.notes),
  };
}

function blankToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function AuditDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border bg-muted/25 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function AuditPayload({ title, value }: { title: string; value: string | null }) {
  return (
    <div>
      <div className="mb-1 text-sm font-semibold">{title}</div>
      <pre className="max-h-56 overflow-auto border bg-muted/35 p-3 text-xs">{prettyAuditValue(value)}</pre>
    </div>
  );
}

function prettyAuditValue(value: string | null) {
  if (!value) return '-';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
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
            <th>Usuário</th>
            <th>Ação</th>
            <th>Alvo</th>
            <th>Módulo</th>
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
