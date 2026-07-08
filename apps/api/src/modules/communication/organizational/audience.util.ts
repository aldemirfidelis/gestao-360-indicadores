/**
 * Regra de audiência dos comunicados — extraída do service para permitir
 * reuso fora do módulo (ex.: coletor do Meu Dia) sem dependência de DI.
 */
export interface AudienceRule {
  scope: 'ALL_COMPANY' | 'AREAS' | 'USERS' | 'MANAGERS' | 'DIRECTORS' | 'ACTIVE_USERS';
  areaIds?: string[];
  userIds?: string[];
  roles?: string[];
  description?: string;
}

export interface AudienceUser {
  id: string;
  defaultNodeId?: string | null;
  role?: string | null;
}

export function matchesAudience(user: AudienceUser, audience: AudienceRule | null | undefined): boolean {
  if (!audience) return true;
  if (audience.scope === 'ALL_COMPANY' || audience.scope === 'ACTIVE_USERS') return true;
  if (audience.scope === 'USERS') return Boolean(audience.userIds?.includes(user.id));
  if (audience.scope === 'AREAS') return Boolean(user.defaultNodeId && audience.areaIds?.includes(user.defaultNodeId));
  if (audience.scope === 'MANAGERS') return user.role === 'MANAGER';
  if (audience.scope === 'DIRECTORS') return user.role === 'DIRECTOR';
  return true;
}
