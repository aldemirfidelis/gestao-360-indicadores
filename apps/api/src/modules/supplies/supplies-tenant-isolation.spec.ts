import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ProcurementService } from './procurement.service';

const me: any = { sub: 'buyer-1', companyId: 'company-1', email: 'buyer@test.local', name: 'Comprador', role: 'MANAGER' };

describe('Supplies tenant isolation', () => {
  it('atomically claims only a requisition from the current company', async () => {
    const prisma: any = {
      purchaseRequisition: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = new ProcurementService(prisma, {} as any, { record: vi.fn() } as any, { markDirty: vi.fn() } as any);

    await expect(service.claimRequisition(me, 'req-other-company')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.purchaseRequisition.updateMany).toHaveBeenCalledWith({
      where: { id: 'req-other-company', companyId: 'company-1', status: 'SUBMITTED', buyerId: null },
      data: expect.objectContaining({ buyerId: 'buyer-1', status: 'IN_TRIAGE' }),
    });
    expect(prisma.purchaseRequisition.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'req-other-company', companyId: 'company-1' },
    }));
  });
});
