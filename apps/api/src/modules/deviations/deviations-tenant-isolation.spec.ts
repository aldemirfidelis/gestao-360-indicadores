import { describe, expect, it, vi } from 'vitest';
import { DeviationsService } from './deviations.service';

// Guard-rail de regressão (Fase 2 do hardening): loadScoped() filtra por
// companyId, então um desvio de outra empresa resolve para null e o update
// precisa recusar ANTES de escrever (padrão scoped-read-before-mutate).
const me: any = { sub: 'user-1', companyId: 'company-1', email: 'user@company.test', role: 'USER' };

describe('Deviations tenant isolation', () => {
  it('does not update a deviation from another company', async () => {
    const prisma: any = {
      deviation: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
    };
    const access: any = { assertCanWrite: vi.fn(), listAreaFilter: vi.fn().mockResolvedValue(null) };
    const traceability: any = { record: vi.fn() };
    const service = new DeviationsService(prisma, traceability, access);

    await expect(service.update(me, 'deviation-from-other-company', { title: 'x' } as any)).rejects.toThrow();

    expect(prisma.deviation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'deviation-from-other-company', companyId: 'company-1' }),
      }),
    );
    expect(prisma.deviation.update).not.toHaveBeenCalled();
  });
});
