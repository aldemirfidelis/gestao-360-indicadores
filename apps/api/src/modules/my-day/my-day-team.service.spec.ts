import { describe, it, expect, vi } from 'vitest';
import { UserRoleEnum } from '@prisma/client';
import { MyDayTeamService } from './my-day-team.service';
import type { AuthPayload } from '../auth/auth.types';

const me: AuthPayload = { sub: 'mgr', email: 'm@x.com', name: 'Mgr', role: UserRoleEnum.COLLABORATOR, companyId: 'c1' };

function setup() {
  const prisma: any = {
    orgNode: {
      findMany: vi.fn().mockResolvedValue([{ id: 'n1' }]),
      count: vi.fn().mockResolvedValue(1),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'u1', name: 'Ana', defaultNodeId: 'n1' },
        { id: 'u2', name: 'Bruno', defaultNodeId: 'n2' },
      ]),
    },
    workItemIndex: {
      findMany: vi.fn().mockResolvedValue([
        { assignedUserId: 'u1', priority: 'CRITICAL', overdueDays: 5, itemType: 'TASK' },
        { assignedUserId: 'u1', priority: 'MEDIUM', overdueDays: 0, itemType: 'TASK' },
        { assignedUserId: 'u2', priority: 'HIGH', overdueDays: 0, itemType: 'APPROVAL' },
      ]),
      count: vi.fn().mockResolvedValue(0),
    },
    actionPlan: { count: vi.fn().mockResolvedValue(0) },
  };
  const aggregation: any = { rebuildFor: vi.fn().mockResolvedValue(0) };
  const access: any = { expandWithDescendants: vi.fn().mockResolvedValue(['n1', 'n2']) };
  return { svc: new MyDayTeamService(prisma, aggregation, access) };
}

describe('MyDayTeamService', () => {
  it('isManager retorna true para responsavel por no organizacional', async () => {
    const { svc } = setup();
    expect(await svc.isManager(me)).toBe(true);
  });

  it('workload agrega por usuario e ordena por vencidos', async () => {
    const { svc } = setup();
    const w = await svc.getWorkload(me);
    expect(w).toHaveLength(2);
    expect(w[0].userId).toBe('u1'); // quem tem mais vencidos primeiro
    expect(w[0]).toMatchObject({ total: 2, overdue: 1, critical: 1, approvals: 0 });
    expect(w.find((x: any) => x.userId === 'u2')).toMatchObject({ total: 1, approvals: 1, overdue: 0 });
  });
});
