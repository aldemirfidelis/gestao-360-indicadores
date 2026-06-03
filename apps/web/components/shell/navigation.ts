import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckSquare,
  Compass,
  FileBarChart,
  FileSpreadsheet,
  Contact,
  GanttChartSquare,
  Goal,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Network,
  Plug,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  UploadCloud,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavUser {
  role?: string;
  permissions?: string[];
}

export interface NavItem {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  permissions?: string[];
  exact?: boolean;
}

export interface NavSection {
  heading: string;
  description: string;
  intent: 'view' | 'launch' | 'management' | 'reports';
  icon: LucideIcon;
  permissions?: string[];
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    heading: 'Visualizações',
    description: 'Painéis, árvore, mapas e acompanhamento executivo',
    intent: 'view',
    icon: LayoutDashboard,
    items: [
      { href: '/dashboard', label: 'Visão Geral', description: 'Resumo, pendências e atalhos', icon: LayoutDashboard, permissions: ['dashboard:view'], exact: true },
      { href: '/visualization', label: 'Dashboard Executivo', description: 'Visão 360 para decisão', icon: BarChart3, permissions: ['visualization:view', 'dashboard:view'] },
      { href: '/org', label: 'Árvore Organizacional', description: 'Áreas, setores, pilares e diretrizes', icon: Network, permissions: ['org:view'] },
      { href: '/strategy', label: 'Mapa Estratégico', description: 'Perspectivas, objetivos e impactos', icon: Compass, permissions: ['strategy:view'] },
      { href: '/indicators', label: 'Indicadores', description: 'Farol, ranking e histórico', icon: Target, permissions: ['indicators:view'], exact: true },
      { href: '/projects', label: 'Cronogramas', description: 'Projetos, marcos e tarefas', icon: GanttChartSquare, permissions: ['projects:view'] },
      { href: '/insights', label: 'Insights', description: 'Alertas, tendências e insights', icon: Sparkles, permissions: ['insights:view'] },
    ],
  },
  {
    heading: 'Comunicação',
    description: 'Pessoas, presença e mensagens da equipe',
    intent: 'view',
    icon: MessageSquare,
    items: [
      { href: '/comunicacao', label: 'Comunicação', description: 'Conversas e mensagens da equipe', icon: MessageSquare },
      { href: '/pessoas', label: 'Pessoas', description: 'Diretório corporativo e presença online', icon: Contact },
      { href: '/integracoes', label: 'Integrações', description: 'Conectores internos e status operacional', icon: Plug },
      { href: '/ajuda', label: 'Ajuda', description: 'Artigos e orientações do sistema', icon: LifeBuoy },
    ],
  },
  {
    heading: 'Lançamentos',
    description: 'Análises de causa, evidências e lançamentos',
    intent: 'launch',
    icon: AlertTriangle,
    items: [
      { href: '/deviations', label: 'Análise de Causa', description: 'Desvios, FCA e planos decorrentes', icon: AlertTriangle, permissions: ['deviations:view'] },
      { href: '/imports', label: 'Registrar Evidência', description: 'Arquivos, CSV e documentos', icon: UploadCloud, permissions: ['imports:view', 'imports:create'] },
    ],
  },
  {
    heading: 'Gestão',
    description: 'Cadastros e objetos de gestão do dia a dia',
    intent: 'management',
    icon: Briefcase,
    items: [
      { href: '/organograma', label: 'Organograma', description: 'Estrutura de cargos, faixas, turnos e orçamento', icon: Users, permissions: ['org:positions:view', 'org:view'] },
      { href: '/aprovacoes-cargo', label: 'Aprovações', description: 'Cargo, eficácia e aprovações gerais', icon: ShieldCheck, permissions: ['org:positions:approve', 'eficacia:view', 'actions:effectiveness', 'actions:delete', 'actions:approve', 'actions:manage'] },
      { href: '/periods', label: 'Períodos', description: 'Ano de trabalho, abertura e fechamento anual', icon: CalendarDays, permissions: ['settings:manage'] },
      { href: '/actions', label: 'Plano de Ação', description: 'Ações, execução, evidências e eficácia', icon: CheckSquare, permissions: ['actions:view'] },
      { href: '/meetings', label: 'Reuniões', description: 'Agenda, atas e decisões', icon: CalendarDays, permissions: ['meetings:view'] },
      { href: '/okrs', label: 'OKRs', description: 'Ciclos e resultados-chave', icon: Goal, permissions: ['okrs:view'] },
    ],
  },
  {
    heading: 'Relatórios',
    description: 'Análises, auditoria e exportações',
    intent: 'reports',
    icon: FileBarChart,
    items: [
      { href: '/reports', label: 'Relatórios e Exportações', description: 'Indicadores, resultados, metas, desvios e áreas', icon: FileSpreadsheet, permissions: ['reports:view', 'reports:export'] },
      { href: '/audit', label: 'Auditoria', description: 'Relatório de ações do sistema', icon: ShieldCheck, permissions: ['audit:view'] },
    ],
  },
];

export const settingsNavItem: NavItem = {
  href: '/settings',
  label: 'Configurações',
  description: 'Usuários, permissões, auditoria, parâmetros e sistema',
  icon: Settings,
  permissions: ['settings:view', 'settings:manage'],
};

export const mobileNavItems: NavItem[] = [
  { href: '/', label: 'Visão', icon: LayoutDashboard, permissions: ['dashboard:view'], exact: true },
  { href: '/indicators', label: 'Indicadores', icon: Target, permissions: ['indicators:view'], exact: true },
  { href: '/strategy', label: 'Mapa', icon: Compass, permissions: ['strategy:view'] },
  { href: '/org', label: 'Árvore', icon: Network, permissions: ['org:view'] },
  { href: '/reports', label: 'Relatórios', icon: FileSpreadsheet, permissions: ['reports:view', 'reports:export'] },
  settingsNavItem,
];

export const productAreas = [
  {
    title: 'Visualizações',
    description: 'Dashboards, mapas, faróis, histórico, rankings e tendências.',
    href: '/visualization',
    icon: LayoutDashboard,
  },
  {
    title: 'Configurações',
    description: 'Usuários, permissões, parâmetros, auditoria e preferências do sistema.',
    href: '/settings',
    icon: SlidersHorizontal,
  },
];

// Mapeamento centralizado URL -> permissoes necessarias.
// Usado pelo RouteGuard para bloquear acesso direto via URL.
export const ROUTE_PERMISSIONS: Array<{ prefix: string; permissions: string[]; exact?: boolean }> = [
  { prefix: '/dashboard', permissions: ['dashboard:view'] },
  { prefix: '/visualization', permissions: ['visualization:view', 'dashboard:view'] },
  { prefix: '/insights', permissions: ['insights:view'] },
  { prefix: '/indicators/new', permissions: ['indicators:create'] },
  { prefix: '/indicators', permissions: ['indicators:view'] },
  { prefix: '/strategy', permissions: ['strategy:view'] },
  { prefix: '/org', permissions: ['org:view'] },
  { prefix: '/organograma', permissions: ['org:positions:view', 'org:view'] },
  { prefix: '/aprovacoes-cargo', permissions: ['org:positions:approve', 'eficacia:view', 'actions:effectiveness', 'actions:delete', 'actions:approve', 'actions:manage'] },
  { prefix: '/projects', permissions: ['projects:view'] },
  { prefix: '/deviations', permissions: ['deviations:view'] },
  { prefix: '/imports', permissions: ['imports:view', 'imports:create'] },
  { prefix: '/eficacia', permissions: ['eficacia:view', 'actions:effectiveness'] },
  { prefix: '/periods', permissions: ['settings:manage'] },
  { prefix: '/actions', permissions: ['actions:view'] },
  { prefix: '/meetings', permissions: ['meetings:view'] },
  { prefix: '/okrs', permissions: ['okrs:view'] },
  { prefix: '/reports', permissions: ['reports:view', 'reports:export'] },
  { prefix: '/audit', permissions: ['audit:view'] },
  { prefix: '/comunicacao', permissions: [] },
  { prefix: '/pessoas', permissions: [] },
  { prefix: '/perfil', permissions: [] },
  { prefix: '/integracoes', permissions: [] },
  { prefix: '/ajuda', permissions: [] },
  { prefix: '/users', permissions: ['users:view', 'users:manage'] },
  // Administração do Banco / Central do Portal: permissões 'database:admin' e
  // 'portal:admin' nunca são concedidas, logo apenas SUPER_ADMIN (bypass em
  // canAccess) acessa. Prefixos mais longos que '/settings' têm precedência.
  { prefix: '/settings/database', permissions: ['database:admin'] },
  { prefix: '/settings/portal', permissions: ['portal:admin'] },
  { prefix: '/settings', permissions: ['settings:view', 'settings:manage'] },
];

export function findRoutePermissions(pathname: string): string[] | null {
  const ordered = [...ROUTE_PERMISSIONS].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const route of ordered) {
    if (pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)) {
      return route.permissions;
    }
  }
  return null;
}

export function visibleNavSections(user: NavUser | null | undefined) {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccess(user, item.permissions)),
    }))
    .filter((section) => section.items.length > 0);
}

export function visibleMobileItems(user: NavUser | null | undefined) {
  return mobileNavItems.filter((item) => canAccess(user, item.permissions));
}

export function canAccessSettings(user: NavUser | null | undefined) {
  return canAccess(user, settingsNavItem.permissions);
}

export function canAccess(user: NavUser | null | undefined, permissions?: string[]) {
  if (!permissions || permissions.length === 0) return true;
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  const granted = new Set(user.permissions ?? []);
  return permissions.some((permission) => granted.has(permission) || granted.has(`${permission.split(':')[0]}:manage`));
}

export function isActivePath(pathname: string, href: string, exact = false) {
  const cleanHref = href.split('?')[0];
  if (href === '/' || exact) return pathname === href;
  return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`);
}
