import { describe, it, expect, vi } from 'vitest';
import { UserRoleEnum } from '@prisma/client';
import { WorkItemAggregationService } from './work-item-aggregation.service';
import { WorkItemPriorityService } from './work-item-priority.service';
import type { AuthPayload } from '../auth/auth.types';

const me: AuthPayload = { sub: 'u1', email: 'u@x.com', name: 'U', role: UserRoleEnum.ANALYST, companyId: 'c1' };

function makePrisma(over: { actions?: unknown[] } = {}) {
  const empty = () => ({ findMany: vi.fn().mockResolvedValue([]) });
  return {
    actionPlan: { findMany: vi.fn().mockResolvedValue(over.actions ?? []) },
    workflowTask: empty(),
    workflowApproval: empty(),
    meeting: empty(),
    document: empty(),
    riskRegister: empty(),
    nonConformity: empty(),
    indicatorResult: empty(),
    notification: empty(),
    workItemIndex: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  } as any;
}

describe('WorkItemAggregationService', () => {
  it('agrega uma ação atrasada como OVERDUE_ACTION, faz upsert e poda os obsoletos', async () => {
    const past = new Date(Date.now() - 5 * 86_400_000);
    const prisma = makePrisma({
      actions: [{
        id: 'a1', title: 'Plano X', status: 'IN_PROGRESS', criticality: 'HIGH', priority: 'HIGH',
        dueDate: past, ownerNodeId: 'n1', progress: 20, evidenceRequired: false, origin: 'MANUAL',
        createdAt: new Date(), updatedAt: new Date(),
      }],
    });
    const svc = new WorkItemAggregationService(prisma, new WorkItemPriorityService());

    const count = await svc.rebuildForUser(me);

    expect(count).toBe(1);
    expect(prisma.workItemIndex.upsert).toHaveBeenCalledTimes(1);
    const arg = prisma.workItemIndex.upsert.mock.calls[0][0];
    expect(arg.where.dedupeKey).toBe('ACTION_PLAN:a1:OVERDUE_ACTION:u1');
    expect(arg.create.itemType).toBe('OVERDUE_ACTION');
    expect(arg.create.overdueDays).toBeGreaterThan(0);
    expect(arg.create.assignedUserId).toBe('u1');
    expect(prisma.workItemIndex.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('sem itens: poda tudo do usuário', async () => {
    const prisma = makePrisma();
    const svc = new WorkItemAggregationService(prisma, new WorkItemPriorityService());
    const count = await svc.rebuildForUser(me);
    expect(count).toBe(0);
    expect(prisma.workItemIndex.upsert).not.toHaveBeenCalled();
    expect(prisma.workItemIndex.deleteMany).toHaveBeenCalledTimes(1);
  });
});
