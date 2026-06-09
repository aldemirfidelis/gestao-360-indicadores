import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Compass,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  FileWarning,
  GanttChartSquare,
  Goal,
  LayoutDashboard,
  ListTodo,
  Network,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Gauge,
  ClipboardList,
  TrendingUp,
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
    description: 'Painéis, árvore, mapas e acompanhamento executivo',
    intent: 'view',
    icon: LayoutDashboard,
    items: [
      { href: '/meu-dia', label: 'Meu Dia', description: 'Central de trabalho: tudo que exige sua atenção hoje', icon: ListTodo, permissions: [], exact: true },
      { href: '/dashboard', label: 'Visão Geral', description: 'Resumo, pendências e atalhos', icon: LayoutDashboard, permissions: ['dashboard:view'], exact: true },
      { href: '/visualization', label: 'Dashboard Executivo', description: 'Visão 360 para decisão', icon: BarChart3, permissions: ['visualization:view', 'dashboard:view'] },
      { href: '/org', label: 'Árvore Organizacional', description: 'Áreas, setores, pilares e diretrizes', icon: Network, permissions: ['org:view'] },
      { href: '/strategy', label: 'Mapa Estratégico', description: 'Perspectivas, objetivos e impactos', icon: Compass, permissions: ['strategy:view'] },
      { href: '/indicators', label: 'Indicadores', description: 'Farol, ranking e histórico', icon: Target, permissions: ['indicators:view'], exact: true },
      { href: '/projects', label: 'Cronogramas', description: 'Projetos, marcos e tarefas', icon: GanttChartSquare, permissions: ['projects:view'] },
      { href: '/insights', label: 'Insights', description: 'Alertas, tendências e insights', icon: Sparkles, permissions: ['insights:view'] },
      { href: '/central-impactos', label: 'Central de Impactos', description: 'Análise 360° e simulações de impacto', icon: AlertTriangle, permissions: ['vision360:view'] },
    ],
  },
  {
    heading: 'Lançamentos',
    description: 'Entradas e tratamento do dia a dia',
    intent: 'launch',
    icon: Upload,
    items: [
      { href: '/deviations', label: 'Desvios', description: 'Indicadores fora da meta, causas e tratativas', icon: AlertTriangle, permissions: ['deviations:view'] },
      { href: '/imports', label: 'Importações', description: 'Importação estruturada de dados', icon: Upload, permissions: ['imports:view', 'imports:create'] },
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
      { href: '/risks', label: 'Riscos', description: 'Registro de riscos e mitigacoes', icon: AlertTriangle, permissions: ['risks:view'] },
      { href: '/nonconformities', label: 'Não Conformidades', description: 'NCs, causa raiz, ação corretiva e eficácia', icon: FileWarning, permissions: ['nc:view'] },
      { href: '/documents', label: 'Documentos', description: 'Políticas, procedimentos, validade e aprovação', icon: FileText, permissions: ['doc:view'] },
      { href: '/audits', label: 'Auditorias', description: 'Auditorias, constatações e geração de NCs', icon: ClipboardCheck, permissions: ['audits:view'] },
      { href: '/processes', label: 'Processos', description: 'Mapeamento SIPOC, fluxo e donos', icon: Network, permissions: ['processes:view'] },
      { href: '/seguranca-alimentos', label: 'Segurança dos Alimentos', description: 'Programas, processos, perigos e controles (FSMS)', icon: ShieldCheck, permissions: ['fsms:view'] },
      { href: '/forms', label: 'Formulários', description: 'Templates, checklists e preenchimentos', icon: FileSpreadsheet, permissions: ['forms:view'] },
      { href: '/meetings', label: 'Reuniões', description: 'Agenda, atas e decisões', icon: CalendarDays, permissions: ['meetings:view'] },
      { href: '/okrs', label: 'OKRs', description: 'Ciclos e resultados-chave', icon: Goal, permissions: ['okrs:view'] },
      { href: '/central-automacoes', label: 'Central de Automações', description: 'Motor visual de automações e workflows', icon: Sparkles, permissions: ['automations:view'] },
    ],
  },
  {
    heading: 'Gestão de Prêmio',
    description: 'Remuneração variável: anexos, competências, apuração e espelho',
    intent: 'management',
    icon: Trophy,
    permissions: ['prize:view'],
    items: [
      { href: '/gestao-premio', label: 'Visão Geral', description: 'Painel executivo da competência selecionada', icon: Gauge, permissions: ['prize:view'], exact: true },
      { href: '/gestao-premio/programas', label: 'Programas de Prêmio', description: 'Programas de remuneração variável e suas regras gerais', icon: Trophy, permissions: ['prize:view'] },
      { href: '/gestao-premio/competencias', label: 'Competências', description: 'Ciclo mensal: abertura, validação e fechamento', icon: CalendarDays, permissions: ['prize:view'] },
      { href: '/gestao-premio/anexos', label: 'Anexos e Regras', description: 'Governança, versões e workflow de aprovação dos anexos', icon: FileText, permissions: ['prize:view'] },
      { href: '/gestao-premio/indicadores', label: 'Indicadores', description: 'Indicadores, metas, zeros, pesos e faixas', icon: Target, permissions: ['prize:view'] },
      { href: '/gestao-premio/realizado', label: 'Lançamento do Realizado', description: 'Lançar/importar o realizado por indicador e competência', icon: ClipboardList, permissions: ['prize:view'] },
      { href: '/gestao-premio/previsto-realizado', label: 'Previsto × Realizado', description: 'Acompanhamento de desvios e atingimento antes do fechamento', icon: TrendingUp, permissions: ['prize:view'] },
    ],
  },
  {
    heading: 'Relatórios',
    description: 'Análises, auditoria e exportações',
    intent: 'reports',
    icon: FileBarChart,
    items: [
      { href: '/reports', label: 'Relatórios e Exportações', description: 'Indicadores, resultados, metas, desvios e áreas', icon: FileSpreadsheet, permissions: ['reports:view', 'reports:export'] },
    ],
  },
];

export const companyUsersNavItem: NavItem = {
  href: '/users',
  label: 'Usuários',
  description: 'Criação e manutenção dos usuários da própria empresa',
  icon: Users,
  permissions: ['users:view', 'users:manage'],
};

export const mobileNavItems: NavItem[] = [
  { href: '/', label: 'Visão', icon: LayoutDashboard, permissions: ['dashboard:view'], exact: true },
  { href: '/indicators', label: 'Indicadores', icon: Target, permissions: ['indicators:view'], exact: true },
  { href: '/strategy', label: 'Mapa', icon: Compass, permissions: ['strategy:view'] },
  { href: '/org', label: 'Árvore', icon: Network, permissions: ['org:view'] },
  { href: '/reports', label: 'Relatórios', icon: FileSpreadsheet, permissions: ['reports:view', 'reports:export'] },
  companyUsersNavItem,
];

// Mapeamento centralizado URL -> permissoes necessarias.
// Usado pelo RouteGuard para bloquear acesso direto via URL.
export const ROUTE_PERMISSIONS: Array<{ prefix: string; permissions: string[]; exact?: boolean }> = [
  { prefix: '/meu-dia', permissions: [] },
  { prefix: '/dashboard', permissions: ['dashboard:view'] },
  { prefix: '/central-automacoes', permissions: ['automations:view'] },
  { prefix: '/central-impactos', permissions: ['vision360:view'] },
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
  { prefix: '/risks', permissions: ['risks:view'] },
  { prefix: '/nonconformities', permissions: ['nc:view'] },
  { prefix: '/documents', permissions: ['doc:view'] },
  { prefix: '/audits', permissions: ['audits:view'] },
  { prefix: '/processes', permissions: ['processes:view'] },
  { prefix: '/seguranca-alimentos', permissions: ['fsms:view'] },
  { prefix: '/forms', permissions: ['forms:view'] },
  { prefix: '/meetings', permissions: ['meetings:view'] },
  { prefix: '/okrs', permissions: ['okrs:view'] },
  { prefix: '/gestao-premio', permissions: ['prize:view'] },
  { prefix: '/plataforma', permissions: ['platform:admin'] },
  { prefix: '/selecionar-empresa', permissions: ['platform:admin'] },
  { prefix: '/reports', permissions: ['reports:view', 'reports:export'] },
  { prefix: '/audit', permissions: ['users:view', 'users:manage'] },
  { prefix: '/comunicacao', permissions: [] },
  { prefix: '/pessoas', permissions: [] },
  { prefix: '/perfil', permissions: [] },
  { prefix: '/integracoes', permissions: [] },
  { prefix: '/ajuda', permissions: [] },
  { prefix: '/users', permissions: ['users:view', 'users:manage'] },
  // Rotas antigas de Configurações no app da empresa. O layout de /settings
  // redireciona para /users; o restante foi centralizado no Portal Admin Global.
  { prefix: '/settings/database', permissions: ['users:view', 'users:manage'] },
  { prefix: '/settings/portal', permissions: ['users:view', 'users:manage'] },
  { prefix: '/settings/empresas', permissions: ['users:view', 'users:manage'] },
  { prefix: '/settings/visibilidade', permissions: ['users:view', 'users:manage'] },
  { prefix: '/settings/integracoes', permissions: ['users:view', 'users:manage'] },
  { prefix: '/settings', permissions: ['users:view', 'users:manage'] },
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

export function canAccessCompanyUsers(user: NavUser | null | undefined) {
  return canAccess(user, companyUsersNavItem.permissions);
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
