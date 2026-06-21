import { describe, expect, it, vi } from 'vitest';
import { MonthlyResultsService } from './monthly-results.service';

// Regression guard: a meeting that belongs to another company must never be
// reachable by id alone. assertMeeting() scopes by companyId, so a cross-company
// id resolves to null and the mutation must be refused before any write.
const me: any = { sub: 'user-1', companyId: 'company-1', email: 'user@company.test', role: 'USER' };
const stub: any = {};

describe('Monthly results tenant isolation', () => {
  it('does not delete a meeting from another company', async () => {
    const prisma: any = {
      monthlyMeeting: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
    };
    const service = new MonthlyResultsService(prisma, stub, stub, stub, stub);

    await expect(service.deleteMeeting(me, 'meeting-from-other-company')).rejects.toThrow();

    expect(prisma.monthlyMeeting.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'meeting-from-other-company', companyId: 'company-1' }),
      }),
    );
    expect(prisma.monthlyMeeting.update).not.toHaveBeenCalled();
  });
});
