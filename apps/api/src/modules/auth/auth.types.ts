import { UserRoleEnum } from '@prisma/client';

export interface AuthPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRoleEnum;
  companyId: string;
}
