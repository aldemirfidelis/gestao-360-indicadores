import { describe, expect, it, vi } from 'vitest';
import { FoodSafetyService } from './food-safety.service';

// Regression guard: loadStandard() scopes by companyId, so a standard owned by
// another company resolves to null and removeStandard must refuse before writing.
const me: any = { sub: 'user-1', companyId: 'company-1', email: 'user@company.test', role: 'USER' };
const stub: any = {};

describe('Food safety tenant isolation', () => {
  it('does not remove a standard from another company', async () => {
    const prisma: any = {
      foodSafetyStandard: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
    };
    const service = new FoodSafetyService(prisma, stub, stub);

    await expect(service.removeStandard(me, 'standard-from-other-company')).rejects.toThrow();

    expect(prisma.foodSafetyStandard.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'standard-from-other-company', companyId: 'company-1' }),
      }),
    );
    expect(prisma.foodSafetyStandard.update).not.toHaveBeenCalled();
  });
});
