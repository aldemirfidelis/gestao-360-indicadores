/**
 * Constantes e limites de segurança do módulo de Administração do Banco de Dados.
 * Centraliza a allowlist de identificadores, tabelas críticas e limites de execução.
 */

export const DB_ADMIN_SUBMENUS = [
  'overview',
  'tables',
  'records',
  'query',
  'query-builder',
  'structure',
  'indexes',
  'import-export',
  'backup',
  'audit',
  'diagnostics',
  'settings',
] as const;
export type DbAdminSubmenu = (typeof DB_ADMIN_SUBMENUS)[number];

/**
 * Tabelas críticas do sistema. Operações destrutivas (TRUNCATE/DROP/limpeza)
 * são bloqueadas por padrão; demais operações exigem confirmação reforçada.
 * A lista pode ser estendida via AppSetting (Configurações Avançadas).
 */
export const PROTECTED_TABLES: string[] = [
  'User',
  'Permission',
  'UserPermission',
  'AccessProfile',
  'ProfilePermission',
  'RefreshToken',
  'AuditLog',
  'Company',
  'DbAdminAuditLog',
  'DbAdminBackup',
  'DbAdminSavedQuery',
  'DbAdminQueryHistory',
  '_prisma_migrations',
];

/** Schemas do PostgreSQL que o módulo é autorizado a inspecionar/operar. */
export const ALLOWED_SCHEMAS = ['public'];

/** Identificador SQL válido (tabela/coluna). Permite PascalCase do Prisma e nomes com `_`. */
export const IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_$]*$/;

/** Frase exigida para operações de altíssimo risco. */
export const CRITICAL_CONFIRMATION_PHRASE = 'CONFIRMAR ALTERAÇÃO CRÍTICA';

/** Limites padrão (sobrescrevíveis em Configurações Avançadas). */
export const DB_ADMIN_LIMITS = {
  /** Máx. de linhas retornadas pelo editor SQL / leitura de registros. */
  maxRows: 1000,
  /** Tamanho de página padrão no editor de registros. */
  defaultPageSize: 50,
  maxPageSize: 200,
  /** Timeout de statement no modo seguro (ms). */
  safeStatementTimeoutMs: 15_000,
  /** Timeout de statement no modo avançado (ms). */
  advancedStatementTimeoutMs: 60_000,
  /** Máx. de linhas a copiar para um snapshot lógico automático antes de operação destrutiva. */
  maxSnapshotRows: 100_000,
};

export function isProtectedTable(table: string, extra: string[] = []): boolean {
  return PROTECTED_TABLES.includes(table) || extra.includes(table);
}
