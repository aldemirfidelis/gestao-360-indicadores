/**
 * Constantes da Central de Administração do Portal.
 * Proteção anti-auto-bloqueio: módulos essenciais não podem ser desabilitados/bloqueados.
 */

export const PORTAL_TABS = [
  'overview', 'modules', 'pages', 'features', 'navigation', 'permissions', 'scope',
  'maintenance', 'parameters', 'integrations', 'announcements', 'audit', 'snapshots',
  'diagnostics', 'advanced',
] as const;
export type PortalTab = (typeof PORTAL_TABS)[number];

/** Frase exigida para alterações críticas. */
export const CRITICAL_CONFIRMATION_PHRASE = 'CONFIRMAR ALTERAÇÃO CRÍTICA';

/**
 * Códigos de módulo que NUNCA podem ser bloqueados/desabilitados (anti-auto-bloqueio).
 * Inclui autenticação, controle de acesso, configurações essenciais, auditoria,
 * a própria central e a administração do banco.
 */
export const NON_BLOCKABLE_MODULES = [
  'auth', 'access-control', 'users', 'settings', 'audit',
  'portal-admin', 'database-admin',
];

export const MODULE_STATUSES = [
  'ACTIVE', 'INACTIVE', 'HIDDEN', 'MAINTENANCE', 'EXPERIMENTAL',
  'SCHEDULED', 'BLOCKED', 'DISCONTINUED', 'RESTRICTED_ROLE', 'RESTRICTED_SCOPE',
] as const;

export const CRITICALITY = ['low', 'medium', 'high', 'critical'] as const;

/** Status que tornam um módulo/página indisponível para usuários comuns. */
export const UNAVAILABLE_STATUSES = ['INACTIVE', 'BLOCKED', 'MAINTENANCE', 'DISCONTINUED'];

export function isNonBlockable(code: string): boolean {
  return NON_BLOCKABLE_MODULES.includes(code);
}
