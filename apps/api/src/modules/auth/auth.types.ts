import { UserRoleEnum } from '@prisma/client';

export interface AuthPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRoleEnum;
  /** Empresa EFETIVA da sessão (a de origem ou, p/ Super Admin, a empresa ativa escolhida). */
  companyId: string;
  /** Empresa de origem do usuário (User.companyId). Só difere de companyId quando impersonando. */
  homeCompanyId?: string;
  /** true quando o Super Admin está administrando uma empresa diferente da sua origem. */
  impersonating?: boolean;
}
