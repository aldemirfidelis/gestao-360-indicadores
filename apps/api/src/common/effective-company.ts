import { UserRoleEnum } from '@prisma/client';

/**
 * Empresa "efetiva" da sessão.
 *
 * Regra única (fonte da verdade) usada por jwt.strategy, auth.service e AccessService:
 * apenas o SUPER_ADMIN pode "entrar" em outra empresa (impersonação) via `activeCompanyId`.
 * Para qualquer outro papel, `activeCompanyId` é IGNORADO e a empresa é sempre a de origem.
 *
 * Nunca derive a empresa de um valor enviado pelo frontend — sempre desta função,
 * a partir do registro do usuário no banco.
 */
export function effectiveCompanyId(u: {
  role: string;
  companyId: string;
  activeCompanyId?: string | null;
}): string {
  if (u.role === UserRoleEnum.SUPER_ADMIN && u.activeCompanyId) return u.activeCompanyId;
  return u.companyId;
}
