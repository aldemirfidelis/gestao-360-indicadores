import {
  AlertTriangle,
  BarChart3,
  Building2,
  Calendar,
  ClipboardList,
  Crosshair,
  FileBarChart,
  FolderKanban,
  Home,
  LayoutDashboard,
  LineChart,
  Map,
  Network,
  PencilLine,
  SearchCheck,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
}

export interface NavSection {
  heading: string;
  intent: 'home' | 'launch' | 'view' | 'admin';
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    heading: 'Início',
    intent: 'home',
    items: [
      {
        href: '/',
        label: 'Visão geral',
        description: 'Resumo, pendências e atalhos',
        icon: Home,
      },
    ],
  },
  {
    heading: 'Lançamentos',
    intent: 'launch',
    items: [
      { href: '/launches', label: 'Central operacional', description: 'Entrada rápida de dados', icon: PencilLine },
      { href: '/results', label: 'Resultados', description: 'Realizado dos indicadores', icon: LineChart },
      { href: '/indicators/new', label: 'Novo indicador', description: 'Cadastro de KPI e meta', icon: Target },
      { href: '/actions', label: 'Planos de ação', description: 'Ações, prazos e evidências', icon: ClipboardList },
      { href: '/deviations', label: 'Não conformidades', description: 'FCA e tratativas', icon: AlertTriangle },
      { href: '/projects', label: 'Projetos', description: 'Cronogramas e tarefas', icon: FolderKanban },
      { href: '/meetings', label: 'Reuniões', description: 'Atas, decisões e pendências', icon: Calendar },
      { href: '/imports', label: 'Arquivos e documentos', description: 'Upload, CSV e evidências', icon: Upload },
    ],
  },
  {
    heading: 'Visualização',
    intent: 'view',
    items: [
      { href: '/visualization', label: 'Dashboard executivo', description: 'Visão 360 para decisão', icon: LayoutDashboard },
      { href: '/indicators', label: 'Dashboard de indicadores', description: 'Farol, ranking e histórico', icon: BarChart3 },
      { href: '/org', label: 'Árvore de gestão', description: 'Setores, áreas e processos', icon: Network },
      { href: '/tree', label: 'Mapa de relações', description: 'Impacto entre indicadores', icon: SearchCheck },
      { href: '/strategy', label: 'Mapa estratégico', description: 'BSC e objetivos', icon: Map },
      { href: '/okrs', label: 'OKRs', description: 'Ciclos e resultados-chave', icon: Crosshair },
      { href: '/insights', label: 'Análises e insights', description: 'Alertas gerenciais', icon: Sparkles },
      { href: '/reports', label: 'Relatórios', description: 'PDF, CSV e exportações', icon: FileBarChart },
    ],
  },
  {
    heading: 'Configurações',
    intent: 'admin',
    items: [
      { href: '/users', label: 'Usuários', description: 'Responsáveis e acessos', icon: Users },
      { href: '/audit', label: 'Auditoria', description: 'Histórico e rastreabilidade', icon: ShieldCheck },
      { href: '/settings', label: 'Parâmetros', description: 'Preferências e cadastros base', icon: Settings },
    ],
  },
];

export const mobileNavItems: NavItem[] = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/launches', label: 'Lançamentos', icon: PencilLine },
  { href: '/visualization', label: 'Dashboards', icon: LayoutDashboard },
  { href: '/indicators', label: 'Indicadores', icon: Target },
  { href: '/settings', label: 'Ajustes', icon: Settings },
];

export const productAreas = [
  {
    title: 'Lançamentos',
    description: 'Cadastros, resultados, evidências, planos e movimentação operacional.',
    href: '/launches',
    icon: PencilLine,
  },
  {
    title: 'Visualização',
    description: 'Dashboards, faróis, histórico, rankings, tendências e relatórios.',
    href: '/visualization',
    icon: LayoutDashboard,
  },
  {
    title: 'Configurações',
    description: 'Usuários, permissões, parâmetros, categorias e preferências do sistema.',
    href: '/settings',
    icon: Building2,
  },
];
