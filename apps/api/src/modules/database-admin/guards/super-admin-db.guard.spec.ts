import { ForbiddenException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SuperAdminDbGuard } from './super-admin-db.guard';

function context(user: any) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        method: 'GET',
        originalUrl: '/admin/database/schema',
        ip: '127.0.0.1',
        headers: { 'user-agent': 'vitest' },
      }),
    }),
  } as any;
}

describe('SuperAdminDbGuard', () => {
  it('returns 403 and audits when user is not SUPER_ADMIN', async () => {
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue('structure') };
    const guard = new SuperAdminDbGuard(audit as any, reflector as any);

    await expect(
      guard.canActivate(
        context({
          sub: 'user-1',
          email: 'admin@company.test',
          role: UserRoleEnum.COMPANY_ADMIN,
          companyId: 'company-1',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        submenu: 'structure',
        action: 'DENIED',
        result: 'DENIED',
        message: 'Acesso negado a GET /admin/database/schema',
      }),
    );
  });

  it('allows SUPER_ADMIN', async () => {
    const audit = { record: vi.fn() };
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue('structure') };
    const guard = new SuperAdminDbGuard(audit as any, reflector as any);

    await expect(
      guard.canActivate(
        context({
          sub: 'super-1',
          email: 'super@platform.test',
          role: UserRoleEnum.SUPER_ADMIN,
          companyId: 'company-1',
        }),
      ),
    ).resolves.toBe(true);
    expect(audit.record).not.toHaveBeenCalled();
  });
});
