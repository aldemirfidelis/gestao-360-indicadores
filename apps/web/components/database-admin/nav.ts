import {
  Database,
  Table2,
  Pencil,
  ArrowLeftRight,
  Archive,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';

export interface DbAdminNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const DB_ADMIN_BASE = '/settings/database';

/** Superfícies que podem operar com escopo empresarial verificável. */
export const dbAdminNav: DbAdminNavItem[] = [
  { href: DB_ADMIN_BASE, label: 'Visão Geral', description: 'Resumo da empresa selecionada', icon: Database },
  { href: `${DB_ADMIN_BASE}/tables`, label: 'Tabelas', description: 'Tabelas com escopo direto por empresa', icon: Table2 },
  { href: `${DB_ADMIN_BASE}/records`, label: 'Editor de Registros', description: 'CRUD limitado à empresa selecionada', icon: Pencil },
  { href: `${DB_ADMIN_BASE}/import-export`, label: 'Importar e Exportar', description: 'Operações limitadas à empresa', icon: ArrowLeftRight },
  { href: `${DB_ADMIN_BASE}/backups`, label: 'Backup e Restauração', description: 'Retratos lógicos da empresa', icon: Archive },
  { href: `${DB_ADMIN_BASE}/audit`, label: 'Auditoria', description: 'Ações da empresa selecionada', icon: ScrollText },
];
