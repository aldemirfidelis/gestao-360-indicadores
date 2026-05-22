import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  Crosshair,
  FileBarChart,
  FileDown,
  FolderKanban,
  GitBranch,
  Home,
  LayoutDashboard,
  LineChart,
  Map,
  Network,
  PencilLine,
  SearchCheck,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Upload,
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
    description: 'Painéis, mapas e acompanhamento executivo',
    intent: 'view',
    icon: LayoutDashboard,
    items: [
      { href: '/', label: 'Visão Geral', description: 'Resumo, pendências e atalhos', icon: Home, permissions: ['dashboard:view'], exact: true },
      { href: '/visualization', label: 'Dashboard Executivo', description: 'Visão 360 para decisão', icon: BarChart3, permissions: ['dashboard:view'] },
      { href: '/strategy', label: 'Mapa Estratégico', description: 'Perspectivas, objetivos e impactos', icon: Map, permissions: ['strategy:view'] },
      { href: '/tree', label: 'Mapa de Relações', description: 'Rastreabilidade entre estratégia e operação', icon: SearchCheck, permissions: ['indicators:view', 'strategy:view'] },
      { href: '/org', label: 'Árvore Organizacional', description: 'Áreas, setores e processos', icon: Network, permissions: ['org:view'] },
      { href: '/indicators', label: 'Indicadores', description: 'Farol, ranking e histórico', icon: Target, permissions: ['indicators:view'] },
      { href: '/actions', label: 'Planos de Ação', description: 'Prazos, responsáveis e evidências', icon: ClipboardList, permissions: ['actions:view'] },
      { href: '/projects', label: 'Cronogramas', description: 'Projetos, marcos e tarefas', icon: FolderKanban, permissions: ['projects:view'] },
      { href: '/meetings', label: 'Reuniões', description: 'Agenda, atas e decisões', icon: Calendar, permissions: ['meetings:view'] },
      { href: '/insights', label: 'Acompanhamentos', description: 'Alertas, tendências e insights', icon: Sparkles, permissions: ['dashboard:view'] },
    ],
  },
  {
    heading: 'Lançamentos',
    description: 'Entrada operacional de dados e registros',
    intent: 'launch',
    icon: PencilLine,
    items: [
      { href: '/launches', label: 'Central de Lançamentos', description: 'Entrada rápida de dados', icon: PencilLine, permissions: ['launches:view', 'results:launch'] },
      { href: '/results', label: 'Lançar Resultado', description: 'Realizado mensal dos indicadores', icon: LineChart, permissions: ['results:launch'] },
      { href: '/indicators/new', label: 'Criar Indicador', description: 'Cadastro de KPI e meta', icon: Target, permissions: ['indicators:create'] },
      { href: '/deviations', label: 'Criar Análise de Causa', description: 'Desvios, FCA e tratativas', icon: AlertTriangle, permissions: ['deviations:manage'] },
      { href: '/meetings', label: 'Criar Reunião', description: 'Reuniões de análise e acompanhamento', icon: Calendar, permissions: ['meetings:manage'] },
      { href: '/actions', label: 'Criar Plano de Ação', description: 'Ações, prazos e responsáveis', icon: ClipboardCheck, permissions: ['actions:manage'] },
      { href: '/imports', label: 'Registrar Evidência', description: 'Arquivos, CSV e documentos', icon: Upload, permissions: ['actions:manage', 'reports:export'] },
    ],
  },
  {
    heading: 'Gestão',
    description: 'Cadastros e objetos de gestão do dia a dia',
    intent: 'management',
    icon: Building2,
    items: [
      { href: '/org', label: 'Estrutura Organizacional', description: 'Empresas, áreas, setores e processos', icon: Building2, permissions: ['org:manage'] },
      { href: '/strategy', label: 'Objetivos Estratégicos', description: 'Mapas, perspectivas e objetivos', icon: Crosshair, permissions: ['strategy:manage', 'strategy:objectives:update'] },
      { href: '/indicators', label: 'Indicadores', description: 'Gestão de KPIs e responsáveis', icon: BarChart3, permissions: ['indicators:update', 'indicators:create'] },
      { href: '/okrs', label: 'OKRs', description: 'Ciclos e resultados-chave', icon: Activity, permissions: ['okrs:manage'] },
      { href: '/projects', label: 'Projetos e Cronogramas', description: 'Projetos, marcos e tarefas', icon: FolderKanban, permissions: ['projects:manage'] },
      { href: '/meetings', label: 'Governança de Reuniões', description: 'Ritos, decisões e encaminhamentos', icon: Calendar, permissions: ['meetings:manage'] },
      { href: '/users', label: 'Responsáveis', description: 'Usuários e responsáveis operacionais', icon: Users, permissions: ['users:manage'] },
    ],
  },
  {
    heading: 'Relatórios',
    description: 'Consultas, auditoria e exportações',
    intent: 'reports',
    icon: FileBarChart,
    items: [
      { href: '/indicators', label: 'Indicadores', description: 'Relatórios de desempenho e histórico', icon: FileBarChart, permissions: ['reports:export', 'indicators:view'] },
      { href: '/actions', label: 'Planos de Ação', description: 'Relatório de planos e execução', icon: ClipboardList, permissions: ['actions:view'] },
      { href: '/meetings', label: 'Reuniões', description: 'Atas, decisões e pendências', icon: Calendar, permissions: ['meetings:view'] },
      { href: '/audit', label: 'Auditoria', description: 'Relatório de ações do sistema', icon: ShieldCheck, permissions: ['audit:view'] },
      { href: '/reports', label: 'Exportações', description: 'CSV, Excel e bases gerenciais', icon: FileDown, permissions: ['reports:export'] },
    ],
  },
];

export const settingsNavItem: NavItem = {
  href: '/settings',
  label: 'Configurações',
  description: 'Usuários, permissões, auditoria, parâmetros e sistema',
  icon: Settings,
  permissions: ['settings:view', 'settings:manage', 'users:manage', 'audit:view'],
};

export const mobileNavItems: NavItem[] = [
  { href: '/', label: 'Visão', icon: Home, permissions: ['dashboard:view'], exact: true },
  { href: '/launches', label: 'Lançar', icon: PencilLine, permissions: ['launches:view', 'results:launch'] },
  { href: '/strategy', label: 'Mapa', icon: Map, permissions: ['strategy:view'] },
  { href: '/reports', label: 'Relatórios', icon: FileBarChart, permissions: ['reports:export', 'indicators:view'] },
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
    title: 'Lançamentos',
    description: 'Resultados, evidências, planos, análises e movimentação operacional.',
    href: '/launches',
    icon: PencilLine,
  },
  {
    title: 'Configurações',
    description: 'Usuários, permissões, parâmetros, auditoria e preferências do sistema.',
    href: '/settings',
    icon: SlidersHorizontal,
  },
];

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
  if (href === '/' || exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
