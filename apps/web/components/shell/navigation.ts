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
    heading: 'Inicio',
    intent: 'home',
    items: [
      {
        href: '/',
        label: 'Visao geral',
        description: 'Resumo, pendencias e atalhos',
        icon: Home,
      },
    ],
  },
  {
    heading: 'Lancamentos',
    intent: 'launch',
    items: [
      { href: '/launches', label: 'Central operacional', description: 'Entrada rapida de dados', icon: PencilLine },
      { href: '/results', label: 'Resultados', description: 'Realizado dos indicadores', icon: LineChart },
      { href: '/indicators/new', label: 'Novo indicador', description: 'Cadastro de KPI e meta', icon: Target },
      { href: '/actions', label: 'Planos de acao', description: 'Acoes, prazos e evidencias', icon: ClipboardList },
      { href: '/deviations', label: 'Nao conformidades', description: 'FCA e tratativas', icon: AlertTriangle },
      { href: '/projects', label: 'Projetos', description: 'Cronogramas e tarefas', icon: FolderKanban },
      { href: '/meetings', label: 'Reunioes', description: 'Atas, decisoes e pendencias', icon: Calendar },
      { href: '/imports', label: 'Arquivos e documentos', description: 'Upload, CSV e evidencias', icon: Upload },
    ],
  },
  {
    heading: 'Visualizacao',
    intent: 'view',
    items: [
      { href: '/visualization', label: 'Dashboard executivo', description: 'Visao 360 para decisao', icon: LayoutDashboard },
      { href: '/indicators', label: 'Dashboard de indicadores', description: 'Farol, ranking e historico', icon: BarChart3 },
      { href: '/org', label: 'Arvore de gestao', description: 'Setores, areas e processos', icon: Network },
      { href: '/tree', label: 'Mapa de relacoes', description: 'Impacto entre indicadores', icon: SearchCheck },
      { href: '/strategy', label: 'Mapa estrategico', description: 'BSC e objetivos', icon: Map },
      { href: '/okrs', label: 'OKRs', description: 'Ciclos e resultados-chave', icon: Crosshair },
      { href: '/insights', label: 'Analises e insights', description: 'Alertas gerenciais', icon: Sparkles },
      { href: '/reports', label: 'Relatorios', description: 'PDF, CSV e exportacoes', icon: FileBarChart },
    ],
  },
  {
    heading: 'Configuracoes',
    intent: 'admin',
    items: [
      { href: '/users', label: 'Usuarios', description: 'Responsaveis e acessos', icon: Users },
      { href: '/audit', label: 'Auditoria', description: 'Historico e rastreabilidade', icon: ShieldCheck },
      { href: '/settings', label: 'Parametros', description: 'Preferencias e cadastros base', icon: Settings },
    ],
  },
];

export const mobileNavItems: NavItem[] = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/launches', label: 'Lancamentos', icon: PencilLine },
  { href: '/visualization', label: 'Dashboards', icon: LayoutDashboard },
  { href: '/indicators', label: 'Indicadores', icon: Target },
  { href: '/settings', label: 'Config', icon: Settings },
];

export const productAreas = [
  {
    title: 'Lancamentos',
    description: 'Cadastros, resultados, evidencias, planos e movimentacao operacional.',
    href: '/launches',
    icon: PencilLine,
  },
  {
    title: 'Visualizacao',
    description: 'Dashboards, farois, historico, rankings, tendencias e relatorios.',
    href: '/visualization',
    icon: LayoutDashboard,
  },
  {
    title: 'Configuracoes',
    description: 'Usuarios, permissoes, parametros, categorias e preferencias do sistema.',
    href: '/settings',
    icon: Building2,
  },
];
