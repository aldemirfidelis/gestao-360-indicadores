import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Brain,
  Briefcase,
  Calculator,
  CalendarDays,
  CarFront,
  CheckSquare,
  ClipboardCheck,
  Compass,
  DoorOpen,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  FileWarning,
  GanttChartSquare,
  Gauge,
  Goal,
  Image as ImageIcon,
  KeyRound,
  Layers3,
  ListTodo,
  Megaphone,
  MessageSquare,
  Network,
  PackageCheck,
  Plus,
  QrCode,
  Radio,
  RadioTower,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Truck,
  UserCheck,
  Users,
  Workflow,
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
  /** Seção de item único renderizada como link direto (sem accordion/sub-menu). */
  flat?: boolean;
}

export const SUPER_ADMIN_ONLY_PERMISSION = 'super-admin:only';

export const companyUsersNavItem: NavItem = {
  href: '/users',
  label: 'Usuários',
  description: 'Criação e manutenção dos usuários da própria empresa',
  icon: Users,
  permissions: ['users:view', 'users:manage'],
};

export const navSections: NavSection[] = [
  {
    heading: 'Meu Dia',
    description: 'Central de trabalho e prioridades do usuário',
    intent: 'view',
    icon: ListTodo,
    flat: true,
    items: [
      { href: '/meu-dia', label: 'Meu Dia', description: 'Central de trabalho: tudo que exige sua atenção hoje', icon: ListTodo, permissions: [], exact: true },
    ],
  },
  {
    heading: 'Tarefas',
    description: 'Pendências operacionais e documentos liberados para edição',
    intent: 'view',
    icon: ClipboardCheck,
    flat: true,
    items: [
      { href: '/tarefas', label: 'Tarefas', description: 'Tarefas do usuário, incluindo documentos liberados para edição', icon: ClipboardCheck, permissions: [], exact: true },
    ],
  },
  {
    heading: 'Gestão à Vista',
    description: 'Painel executivo, estratégia, indicadores e ritos de gestão',
    intent: 'view',
    icon: Compass,
    items: [
      { href: '/visualization', label: 'Painel Executivo', description: 'Visão 360 para decisão', icon: BarChart3, permissions: ['visualization:view', 'dashboard:view'] },
      { href: '/org', label: 'Árvore Organizacional', description: 'Áreas, setores, pilares e diretrizes', icon: Network, permissions: ['org:view', 'org:view_all'] },
      { href: '/strategy', label: 'Mapa Estratégico', description: 'Perspectivas, objetivos e impactos', icon: Compass, permissions: ['strategy:view'] },
      { href: '/indicators', label: 'Indicadores', description: 'Farol, ranking e histórico', icon: Target, permissions: ['indicators:view'], exact: true },
      { href: '/deviations', label: 'Desvios', description: 'Indicadores fora da meta, causas e tratativas', icon: AlertTriangle, permissions: ['deviations:view'] },
      { href: '/actions', label: 'Plano de Ação', description: 'Ações, execução, evidências e eficácia', icon: CheckSquare, permissions: ['actions:view'] },
      { href: '/meetings', label: 'Reuniões', description: 'Agenda, atas e decisões', icon: CalendarDays, permissions: ['meetings:view'] },
      { href: '/monthly-results', label: 'Reunião Mensal', description: 'Fechamento de resultados, pauta, ata e acompanhamento semanal', icon: CalendarDays, permissions: ['monthly:view'] },
      { href: '/okrs', label: 'OKRs', description: 'Ciclos e resultados-chave', icon: Goal, permissions: ['okrs:view'] },
    ],
  },
  {
    heading: 'Administração',
    description: 'Aprovações, períodos, automações, usuários e relatórios',
    intent: 'management',
    icon: Briefcase,
    items: [
      { href: '/aprovacoes-cargo', label: 'Aprovações', description: 'Cargo, eficácia e aprovações gerais', icon: ClipboardCheck, permissions: ['org:positions:approve', 'eficacia:view', 'actions:effectiveness', 'actions:delete', 'actions:approve', 'actions:manage'] },
      { href: '/periods', label: 'Períodos', description: 'Ano de trabalho, abertura e fechamento anual', icon: CalendarDays, permissions: ['settings:manage'] },
      { href: '/central-automacoes', label: 'Central de Automações', description: 'Motor visual de automações e fluxos de trabalho', icon: Sparkles, permissions: ['automations:view'] },
      companyUsersNavItem,
      { href: '/reports', label: 'Relatórios e Exportações', description: 'Indicadores, resultados, metas, desvios e áreas', icon: FileBarChart, permissions: ['reports:view', 'reports:export'] },
    ],
  },
  {
    heading: 'Qualidade e Compliance',
    description: 'Riscos, conformidade, documentos, processos e impactos',
    intent: 'management',
    icon: ShieldCheck,
    items: [
      { href: '/risks', label: 'Riscos', description: 'Registro de riscos e mitigações', icon: AlertTriangle, permissions: ['risks:view'] },
      { href: '/nonconformities', label: 'Não Conformidades', description: 'NCs, causa raiz, ação corretiva e eficácia', icon: FileWarning, permissions: ['nc:view'] },
      { href: '/audits', label: 'Auditorias', description: 'Auditorias, constatações e geração de NCs', icon: ClipboardCheck, permissions: ['audits:view'] },
      { href: '/documents', label: 'Documentos', description: 'Políticas, procedimentos, validade e aprovação', icon: FileText, permissions: ['doc:view'] },
      { href: '/processes', label: 'SIPOC', description: 'Mapeamento SIPOC, fluxo e responsáveis', icon: Network, permissions: ['processes:view'], exact: true },
      { href: '/forms', label: 'Formulários', description: 'Modelos, listas de verificação e preenchimentos', icon: FileSpreadsheet, permissions: ['forms:view'] },
      { href: '/projects', label: 'Cronogramas', description: 'Projetos, marcos e tarefas', icon: GanttChartSquare, permissions: ['projects:view'] },
      { href: '/central-impactos', label: 'Impactos', description: 'Análise 360° e simulações de impacto', icon: AlertTriangle, permissions: ['vision360:view'] },
      { href: '/processes?view=processo', label: 'Processo', description: 'Cadastro e análise de processos vinculados ao SIPOC', icon: Workflow, permissions: ['processes:view'] },
    ],
  },
  {
    heading: 'Segurança dos Alimentos',
    description: 'FSMS, APPCC, monitoramento, cadeia e inteligência',
    intent: 'management',
    icon: ShieldCheck,
    permissions: ['fsms:view'],
    items: [
      { href: '/seguranca-alimentos?tab=flow', label: 'Fluxograma', description: 'Fluxograma de processos e etapas', icon: Workflow, permissions: ['fsms:view'] },
      { href: '/seguranca-alimentos?tab=overview', label: 'Visão Geral', description: 'Painel do programa de segurança dos alimentos', icon: Gauge, permissions: ['fsms:view'] },
      { href: '/seguranca-alimentos?tab=processes', label: 'Processos', description: 'Processos, linhas e etapas', icon: Network, permissions: ['fsms:view'] },
      { href: '/seguranca-alimentos?tab=hazards', label: 'Perigos / APPCC', description: 'Perigos, PCC, PPRO e controles', icon: AlertTriangle, permissions: ['fsms:view'] },
      { href: '/seguranca-alimentos?tab=monitoring', label: 'Monitoramento', description: 'Planos e registros de monitoramento', icon: Gauge, permissions: ['fsms:view'] },
      { href: '/seguranca-alimentos?tab=compliance', label: 'Compliance', description: 'Normas, auditorias e requisitos', icon: ClipboardCheck, permissions: ['fsms:view'] },
      { href: '/seguranca-alimentos?tab=chain', label: 'Cadeia e Recall', description: 'Fornecedores, lotes, rastreabilidade e recall', icon: Truck, permissions: ['fsms:view'] },
      { href: '/seguranca-alimentos?tab=intelligence', label: 'Inteligência', description: 'Sinais, recomendações e análise assistida', icon: Brain, permissions: ['fsms:view'] },
      { href: '/seguranca-alimentos?tab=matrix', label: 'Matriz Geral', description: 'Matriz consolidada de processos e perigos', icon: Layers3, permissions: ['fsms:view'] },
    ],
  },
  {
    heading: 'Segurança Patrimonial',
    description: 'Portarias, acessos, rondas, ocorrências, materiais e chaves',
    intent: 'management',
    icon: ShieldCheck,
    permissions: ['asset-security:view'],
    items: [
      { href: '/seguranca-patrimonial?tab=operation', label: 'Operação', description: 'Entradas, saídas e pendências de portaria', icon: DoorOpen, permissions: ['asset-security:view'] },
      { href: '/seguranca-patrimonial?tab=people', label: 'Pessoas e Veículos', description: 'Pessoas, veículos e empresas prestadoras', icon: CarFront, permissions: ['asset-security:view'] },
      { href: '/seguranca-patrimonial?tab=authorizations', label: 'Autorizações', description: 'Autorizações, convites e QR Codes', icon: QrCode, permissions: ['asset-security:view'] },
      { href: '/seguranca-patrimonial?tab=rounds', label: 'Rondas e Ocorrências', description: 'Rondas, ocorrências e livro eletrônico', icon: RadioTower, permissions: ['asset-security:view'] },
      { href: '/seguranca-patrimonial?tab=assets', label: 'Materiais e Chaves', description: 'Chaves, materiais, cargas e correspondências', icon: KeyRound, permissions: ['asset-security:view'] },
      { href: '/seguranca-patrimonial?tab=settings', label: 'Configurações', description: 'Portarias, postos, documentos, bloqueios e auditoria', icon: PackageCheck, permissions: ['asset-security:view'] },
    ],
  },
  {
    heading: 'Cargos e Salários',
    description: 'Estrutura, catálogo, tabelas salariais e movimentações',
    intent: 'management',
    icon: Briefcase,
    permissions: ['compensation:view', 'org:positions:view'],
    items: [
      { href: '/cargos-salarios', label: 'Visão Geral', description: 'Painel de cargos e salários', icon: Gauge, permissions: ['compensation:view', 'org:positions:view'], exact: true },
      { href: '/cargos-salarios/estrutura-quadro', label: 'Estrutura e Quadro', description: 'Estrutura e quadro de pessoal', icon: Network, permissions: ['compensation:view', 'org:positions:view'] },
      { href: '/cargos-salarios/catalogo', label: 'Catálogo de Cargos', description: 'Catálogo e famílias de cargos', icon: Briefcase, permissions: ['compensation:view', 'org:positions:view'] },
      { href: '/cargos-salarios/descricoes', label: 'Descrições', description: 'Descrições de cargo e responsabilidades', icon: FileText, permissions: ['compensation:view', 'org:positions:view'] },
      { href: '/cargos-salarios/tabelas-salariais', label: 'Tabelas Salariais', description: 'Tabelas, faixas e referências salariais', icon: Banknote, permissions: ['compensation:view', 'org:positions:view'] },
      { href: '/cargos-salarios/enquadramento', label: 'Enquadramento', description: 'Enquadramento salarial e compa-ratio', icon: Target, permissions: ['compensation:view', 'org:positions:view'] },
      { href: '/cargos-salarios/movimentacoes', label: 'Movimentações', description: 'Movimentações e histórico salarial', icon: TrendingUp, permissions: ['compensation:view', 'org:positions:view'] },
      { href: '/cargos-salarios/ciclos', label: 'Ciclos de Mérito', description: 'Ciclos de mérito e revisão', icon: CalendarDays, permissions: ['compensation:view', 'org:positions:view'] },
      { href: '/cargos-salarios/orcamento', label: 'Orçamento de Pessoal', description: 'Orçamento e simulações de folha', icon: Calculator, permissions: ['compensation:view', 'org:positions:view'] },
      { href: '/cargos-salarios/pesquisas', label: 'Pesquisas Salariais', description: 'Pesquisas e benchmark salarial', icon: FileSpreadsheet, permissions: ['compensation:view', 'org:positions:view'] },
      { href: '/cargos-salarios/simulacoes', label: 'Simulações', description: 'Cenários e simulações salariais', icon: SlidersHorizontal, permissions: ['compensation:view', 'org:positions:view'] },
      { href: '/cargos-salarios/aprovacoes', label: 'Aprovações', description: 'Aprovações de cargos e movimentações', icon: ClipboardCheck, permissions: ['compensation:view', 'org:positions:view'] },
      { href: '/cargos-salarios/configuracoes', label: 'Configurações', description: 'Parâmetros do módulo', icon: Settings, permissions: ['compensation:view', 'org:positions:view'] },
      { href: '/cargos-salarios/relatorios', label: 'Relatórios', description: 'Relatórios e auditoria de cargos e salários', icon: FileBarChart, permissions: ['compensation:reports:view', 'compensation:view'] },
    ],
  },
  {
    heading: 'Comunicação',
    description: 'Mural, central, campanhas, mídias, métricas e chat',
    intent: 'management',
    icon: Megaphone,
    permissions: ['communication:view'],
    items: [
      { href: '/comunicacao?tab=mural', label: 'Meu Mural', description: 'Comunicados e pendências obrigatórias', icon: Megaphone, permissions: ['communication:view'] },
      { href: '/comunicacao?tab=central', label: 'Central', description: 'Central de comunicados publicados e agendados', icon: FileText, permissions: ['communication:view'] },
      { href: '/comunicacao?tab=criar', label: 'Criar', description: 'Criar novo comunicado', icon: Plus, permissions: ['communication:create', 'communication:manage'] },
      { href: '/comunicacao?tab=campanhas', label: 'Campanhas', description: 'Campanhas internas', icon: Radio, permissions: ['communication:view'] },
      { href: '/comunicacao?tab=midias', label: 'Mídias', description: 'Biblioteca de mídias e modelos', icon: ImageIcon, permissions: ['communication:view'] },
      { href: '/comunicacao?tab=metricas', label: 'Métricas', description: 'Métricas e relatórios de comunicação', icon: FileBarChart, permissions: ['communication:reports', 'communication:view'] },
      { href: '/comunicacao?tab=chat', label: 'Chat', description: 'Conversas internas', icon: MessageSquare, permissions: ['communication:view'] },
    ],
  },
  {
    heading: 'Gestão de Prêmio',
    description: 'Remuneração variável: anexos, competências, apuração, folha e espelho',
    intent: 'management',
    icon: Trophy,
    permissions: ['prize:view'],
    items: [
      { href: '/gestao-premio', label: 'Visão Geral', description: 'Painel executivo da competência selecionada', icon: Gauge, permissions: ['prize:view'], exact: true },
      { href: '/gestao-premio/programas', label: 'Programas de Prêmio', description: 'Programas de remuneração variável e suas regras gerais', icon: Trophy, permissions: ['prize:view'] },
      { href: '/gestao-premio/competencias', label: 'Competências', description: 'Ciclo mensal: abertura, validação e fechamento', icon: CalendarDays, permissions: ['prize:view'] },
      { href: '/gestao-premio/anexos', label: 'Anexos e Regras', description: 'Governança, versões, indicadores, pesos e faixas dos anexos', icon: FileText, permissions: ['prize:view'] },
      { href: '/gestao-premio/realizado', label: 'Realizado', description: 'Sincronização dos lançamentos, conferência e Previsto x Realizado', icon: TrendingUp, permissions: ['prize:view'] },
      { href: '/gestao-premio/colaboradores', label: 'Colaboradores Elegíveis', description: 'Base elegível por competência, retrato e conciliação', icon: UserCheck, permissions: ['prize:view'] },
      { href: '/gestao-premio/apuracao', label: 'Apuração Mensal', description: 'Motor de cálculo, memória de cálculo e conferência', icon: Calculator, permissions: ['prize:view'] },
      { href: '/gestao-premio/ajustes', label: 'Ajustes e Exceções', description: 'Ajustes manuais, exceções, transitoriedade e moderadores', icon: SlidersHorizontal, permissions: ['prize:view'] },
      { href: '/gestao-premio/espelhos', label: 'Espelhos do Prêmio', description: 'Demonstrativo individual, publicação e ciência', icon: FileText, permissions: ['prize:view'] },
      { href: '/gestao-premio/relatorios', label: 'Relatório e Auditoria', description: 'Apuração, pendências, trilha de auditoria e resumo executivo', icon: FileBarChart, permissions: ['prize:reports:view', 'prize:view'] },
      { href: '/gestao-premio/folha', label: 'Integração com a Folha', description: 'Lote de pagamento, exportação e retorno da folha', icon: Banknote, permissions: ['prize:view'] },
    ],
  },
];

export const mobileNavItems: NavItem[] = [
  { href: '/meu-dia', label: 'Meu Dia', icon: ListTodo, permissions: [], exact: true },
  { href: '/tarefas', label: 'Tarefas', icon: ClipboardCheck, permissions: [], exact: true },
  { href: '/indicators', label: 'Indicadores', icon: Target, permissions: ['indicators:view'], exact: true },
  { href: '/visualization', label: 'Painel', icon: BarChart3, permissions: ['visualization:view', 'dashboard:view'] },
  companyUsersNavItem,
];

// Mapeamento centralizado URL -> permissoes necessarias.
// Usado pelo RouteGuard para bloquear acesso direto via URL.
export const ROUTE_PERMISSIONS: Array<{ prefix: string; permissions: string[]; exact?: boolean }> = [
  { prefix: '/meu-dia', permissions: [] },
  { prefix: '/tarefas', permissions: [] },
  { prefix: '/dashboard', permissions: [] },
  { prefix: '/central-automacoes', permissions: ['automations:view'] },
  { prefix: '/central-impactos', permissions: ['vision360:view'] },
  { prefix: '/visualization', permissions: ['visualization:view', 'dashboard:view'] },
  { prefix: '/insights', permissions: ['insights:view'] },
  { prefix: '/indicators/new', permissions: ['indicators:create'] },
  { prefix: '/indicators', permissions: ['indicators:view'] },
  { prefix: '/strategy', permissions: ['strategy:view'] },
  { prefix: '/org', permissions: ['org:view', 'org:view_all'] },
  { prefix: '/cargos-salarios', permissions: ['compensation:view', 'org:positions:view'] },
  { prefix: '/organograma', permissions: ['compensation:view', 'org:positions:view', 'org:view'] },
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
  { prefix: '/seguranca-patrimonial', permissions: ['asset-security:view'] },
  { prefix: '/forms', permissions: ['forms:view'] },
  { prefix: '/monthly-results', permissions: ['monthly:view'] },
  { prefix: '/meetings', permissions: ['meetings:view'] },
  { prefix: '/okrs', permissions: ['okrs:view'] },
  { prefix: '/gestao-premio/integracoes', permissions: [] },
  { prefix: '/gestao-premio', permissions: ['prize:view'] },
  { prefix: '/plataforma', permissions: ['platform:admin'] },
  { prefix: '/selecionar-empresa', permissions: ['platform:admin'] },
  { prefix: '/reports', permissions: ['reports:view', 'reports:export'] },
  { prefix: '/audit', permissions: ['users:view', 'users:manage'] },
  { prefix: '/comunicacao', permissions: ['communication:view'] },
  { prefix: '/pessoas', permissions: [] },
  { prefix: '/perfil', permissions: [] },
  { prefix: '/integracoes', permissions: [] },
  { prefix: '/ajuda', permissions: [] },
  { prefix: '/users', permissions: ['users:view', 'users:manage'] },
  // Rotas antigas de Configuracoes no app da empresa. O layout de /settings
  // redireciona para /users; o restante foi centralizado no Portal Admin Global.
  { prefix: '/settings/database', permissions: [SUPER_ADMIN_ONLY_PERMISSION] },
  { prefix: '/settings/portal', permissions: [SUPER_ADMIN_ONLY_PERMISSION] },
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

export function canAccess(user: NavUser | null | undefined, permissions?: string[]) {
  if (!permissions || permissions.length === 0) return true;
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  if (permissions.includes(SUPER_ADMIN_ONLY_PERMISSION)) return false;
  const granted = new Set(user.permissions ?? []);
  return permissions.some((permission) => granted.has(permission) || granted.has(`${permission.split(':')[0]}:manage`));
}

export function isActivePath(pathname: string, href: string, exact = false, currentSearch = '') {
  const [cleanHref, expectedSearch] = href.split('?');
  if (expectedSearch) {
    if (pathname !== cleanHref) return false;
    const expected = new URLSearchParams(expectedSearch);
    const current = new URLSearchParams(currentSearch);
    for (const [key, value] of expected.entries()) {
      if (current.get(key) !== value) return false;
    }
    return true;
  }
  if (href === '/' || exact) return pathname === cleanHref;
  return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`);
}
