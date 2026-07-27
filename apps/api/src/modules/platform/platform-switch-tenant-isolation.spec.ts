import { UserRoleEnum } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PlatformService } from './platform.service';

describe('Platform company switch tenant isolation', () => {
  it('moves push subscriptions and invalidates every realtime session of the account', async () => {
    const prisma: any = {
      company: { findFirst: vi.fn().mockResolvedValue({ id: 'company-b', name: 'Empresa B' }) },
      user: { update: vi.fn().mockResolvedValue({}) },
      pushSubscription: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      $transaction: vi.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const access: any = { invalidate: vi.fn() };
    const auditWriter: any = { record: vi.fn().mockResolvedValue(undefined) };
    const realtime: any = { changeCompanyContext: vi.fn() };
    const service = new PlatformService(prisma, access, auditWriter, realtime);
    const me: any = {
      sub: 'admin',
      companyId: 'company-a',
      homeCompanyId: 'home-company',
      role: UserRoleEnum.SUPER_ADMIN,
    };

    await service.switchCompany(me, 'company-b');

    expect(prisma.pushSubscription.updateMany).toHaveBeenCalledWith({
      where: { userId: 'admin' },
      data: { companyId: 'company-b' },
    });
    expect(access.invalidate).toHaveBeenCalledWith('admin');
    expect(realtime.changeCompanyContext).toHaveBeenCalledWith('admin', 'company-b');
  });
});
