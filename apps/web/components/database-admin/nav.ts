import {
  Database,
  Table2,
  Pencil,
  Terminal,
  Boxes,
  Network,
  KeyRound,
  ArrowLeftRight,
  Archive,
  ScrollText,
  Stethoscope,
  Settings2,
  type LucideIcon,
} from 'lucide-react';

export interface DbAdminNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const DB_ADMIN_BASE = '/settings/database';

/** Os 12 submenus do grupo "Banco de Dados" (Seção 3 do pedido). */
export const dbAdminNav: DbAdminNavItem[] = [
  { href: DB_ADMIN_BASE, label: 'Visão Geral', description: 'Painel técnico do banco', icon: Database },
  { href: `${DB_ADMIN_BASE}/tables`, label: 'Tabelas', description: 'Listagem e ações por tabela', icon: Table2 },
  { href: `${DB_ADMIN_BASE}/records`, label: 'Editor de Registros', description: 'CRUD de linhas', icon: Pencil },
  { href: `${DB_ADMIN_BASE}/sql`, label: 'Editor SQL', description: 'Consultas e comandos', icon: Terminal },
  { href: `${DB_ADMIN_BASE}/query-builder`, label: 'Construtor de Consultas', description: 'Montagem visual de SELECT', icon: Boxes },
  { href: `${DB_ADMIN_BASE}/structure`, label: 'Estrutura e Relacionamentos', description: 'Diagrama ER', icon: Network },
  { href: `${DB_ADMIN_BASE}/indexes`, label: 'Índices e Constraints', description: 'Índices, PK, FK, unique', icon: KeyRound },
  { href: `${DB_ADMIN_BASE}/import-export`, label: 'Importar e Exportar', description: 'CSV, Excel, JSON, SQL', icon: ArrowLeftRight },
  { href: `${DB_ADMIN_BASE}/backups`, label: 'Backup e Restauração', description: 'Retratos lógicos e recuperação em ponto no tempo', icon: Archive },
  { href: `${DB_ADMIN_BASE}/audit`, label: 'Auditoria', description: 'Ações administrativas', icon: ScrollText },
  { href: `${DB_ADMIN_BASE}/diagnostics`, label: 'Integridade e Diagnóstico', description: 'Verificações e sugestões', icon: Stethoscope },
  { href: `${DB_ADMIN_BASE}/advanced`, label: 'Configurações Avançadas', description: 'Limites e proteções', icon: Settings2 },
];
