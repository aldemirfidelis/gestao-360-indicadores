import { describe, expect, it, vi } from 'vitest';
import { NotificationsProcessor } from './notifications.processor';

describe('NotificationsProcessor', () => {
  it('gera alertas para todas as empresas ativas e soma o total', async () => {
    const prisma: any = { company: { findMany: vi.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]) } };
    const notifications: any = { generateAlerts: vi.fn().mockResolvedValue({ generated: 2 }) };
    const proc = new NotificationsProcessor(prisma, notifications);

    const res = await proc.process({ name: 'generate-alerts' } as any);

    expect(prisma.company.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, active: true },
      select: { id: true },
    });
    expect(notifications.generateAlerts).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ companies: 2, generated: 4 });
  });

  it('isola falha de uma empresa sem derrubar o job', async () => {
    const prisma: any = { company: { findMany: vi.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]) } };
    const notifications: any = {
      generateAlerts: vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ generated: 3 }),
    };
    const proc = new NotificationsProcessor(prisma, notifications);

    const res = await proc.process({ name: 'generate-alerts' } as any);

    expect(res).toEqual({ companies: 2, generated: 3 });
  });
});
