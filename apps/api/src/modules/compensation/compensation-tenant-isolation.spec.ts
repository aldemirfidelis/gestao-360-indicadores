import { describe, expect, it, vi } from 'vitest';
import { CompensationService } from './compensation.service';

// Regression guard: getJob() scopes by companyId, so a job catalog entry owned by
// another company resolves to null and reactivateJob must refuse before writing.
const me: any = { sub: 'user-1', companyId: 'company-1', email: 'user@company.test', role: 'USER' };
const stub: any = {};

describe('Compensation tenant isolation', () => {
  it('does not reactivate a job from another company', async () => {
    const prisma: any = {
      compensationJobCatalog: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
    };
    const service = new CompensationService(prisma, stub, stub, { record: vi.fn().mockResolvedValue(undefined) } as any, stub);

    await expect(service.reactivateJob(me, 'job-from-other-company')).rejects.toThrow();

    expect(prisma.compensationJobCatalog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'job-from-other-company', companyId: 'company-1' }),
      }),
    );
    expect(prisma.compensationJobCatalog.update).not.toHaveBeenCalled();
  });
});
