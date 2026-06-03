import { describe, expect, it } from 'vitest';
import { UserRoleEnum } from '@prisma/client';
import { effectiveCompanyId } from './effective-company';

describe('effectiveCompanyId', () => {
  it('Super Admin com activeCompanyId entra na empresa ativa', () => {
    expect(
      effectiveCompanyId({ role: UserRoleEnum.SUPER_ADMIN, companyId: 'home', activeCompanyId: 'acme' }),
    ).toBe('acme');
  });

  it('Super Admin sem activeCompanyId usa a empresa de origem', () => {
    expect(effectiveCompanyId({ role: UserRoleEnum.SUPER_ADMIN, companyId: 'home', activeCompanyId: null })).toBe('home');
    expect(effectiveCompanyId({ role: UserRoleEnum.SUPER_ADMIN, companyId: 'home' })).toBe('home');
  });

  it('papéis != SUPER_ADMIN IGNORAM activeCompanyId (sempre empresa de origem)', () => {
    for (const role of [
      UserRoleEnum.COMPANY_ADMIN,
      UserRoleEnum.DIRECTOR,
      UserRoleEnum.MANAGER,
      UserRoleEnum.ANALYST,
      UserRoleEnum.COLLABORATOR,
      UserRoleEnum.VIEWER,
    ]) {
      expect(effectiveCompanyId({ role, companyId: 'home', activeCompanyId: 'acme' })).toBe('home');
    }
  });
});
