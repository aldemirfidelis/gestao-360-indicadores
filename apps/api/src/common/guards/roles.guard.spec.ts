import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRoleEnum } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

function context(user: any) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;
}

describe('RolesGuard', () => {
  it('lets audited admin guards enforce and audit denied access', async () => {
    const reflector = {
      getAllAndOverride: vi.fn((key: string) => {
        if (key === ROLES_KEY) return [UserRoleEnum.SUPER_ADMIN];
        return undefined;
      }),
      getAllAndMerge: vi.fn((key: string) => (key === GUARDS_METADATA ? [class SuperAdminDbGuard {}] : [])),
    };
    const prisma = { user: { findUnique: vi.fn() } };
    const guard = new RolesGuard(reflector as any, prisma as any);

    await expect(
      guard.canActivate(
        context({
          sub: 'user-1',
          role: UserRoleEnum.COMPANY_ADMIN,
          companyId: 'company-1',
        }),
      ),
    ).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('still blocks role mismatches without an audited admin guard', async () => {
    const reflector = {
      getAllAndOverride: vi.fn((key: string) => {
        if (key === ROLES_KEY) return [UserRoleEnum.SUPER_ADMIN];
        return undefined;
      }),
      getAllAndMerge: vi.fn().mockReturnValue([]),
    };
    const guard = new RolesGuard(reflector as any, { user: { findUnique: vi.fn() } } as any);

    await expect(
      guard.canActivate(
        context({
          sub: 'user-1',
          role: UserRoleEnum.COMPANY_ADMIN,
          companyId: 'company-1',
        }),
      ),
    ).resolves.toBe(false);
  });

  it('blocks users without the required permission', async () => {
    const reflector = {
      getAllAndOverride: vi.fn((key: string) => {
        if (key === PERMISSIONS_KEY) return ['integrations:manage'];
        return undefined;
      }),
      getAllAndMerge: vi.fn().mockReturnValue([]),
    };
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          permissions: [],
          accessProfile: { permissions: [] },
        }),
      },
    };
    const guard = new RolesGuard(reflector as any, prisma as any);

    await expect(
      guard.canActivate(
        context({
          sub: 'user-1',
          role: UserRoleEnum.VIEWER,
          companyId: 'company-1',
        }),
      ),
    ).resolves.toBe(false);
  });

  it('does not grant every permission to a company admin with an empty profile', async () => {
    const reflector = {
      getAllAndOverride: vi.fn((key: string) => {
        if (key === PERMISSIONS_KEY) return ['users:manage'];
        return undefined;
      }),
      getAllAndMerge: vi.fn().mockReturnValue([]),
    };
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          permissions: [],
          accessProfile: { permissions: [] },
        }),
      },
    };
    const guard = new RolesGuard(reflector as any, prisma as any);

    await expect(
      guard.canActivate(
        context({
          sub: 'admin-1',
          role: UserRoleEnum.COMPANY_ADMIN,
          companyId: 'company-1',
        }),
      ),
    ).resolves.toBe(false);
  });
});
