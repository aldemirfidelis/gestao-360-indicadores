import { describe, expect, it, vi } from 'vitest';
import { UserRoleEnum } from '@prisma/client';
import { MyDayService } from './my-day.service';
import type { AuthPayload } from '../auth/auth.types';

const me: AuthPayload = { sub: 'u1', email: 'u@x.com', name: 'U', role: UserRoleEnum.COLLABORATOR, companyId: 'c1' };

function makeService(over: Record<string, any> = {}) {
  const item = {
    id: 'wi1',
    companyId: 'c1',
    assignedUserId: 'u1',
    sourceModule: 'actions',
    sourceEntityType: 'ACTION_PLAN',
    sourceEntityId: 'a1',
    itemType: 'TASK',
    title: 'Plano acompanhado',
  };
  const prisma: any = {
    workItemIndex: {
      findFirst: vi.fn().mockResolvedValue(over.item ?? item),
      findMany: vi.fn().mockResolvedValue(over.items ?? []),
      count: vi.fn().mockResolvedValue(0),
    },
    workItemFollow: {
      upsert: vi.fn().mockResolvedValue({ id: 'f1' }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue(over.follows ?? []),
    },
    userDelegation: {
      create: vi.fn().mockResolvedValue({ id: 'd1' }),
      findFirst: vi.fn().mockResolvedValue(over.delegation ?? null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ id: 'd1', status: 'REVOKED' }),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue(over.user ?? { id: 'u2' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    userDashboardPreference: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
    },
    appSetting: { findUnique: vi.fn().mockResolvedValue(null) },
    myDayAssistantLog: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({ id: 'ai1' }),
    },
    notification: { count: vi.fn().mockResolvedValue(0), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const svc = new MyDayService(
    prisma,
    { rebuildForUser: vi.fn().mockResolvedValue(0), rebuildFor: vi.fn().mockResolvedValue(0) } as any,
    {} as any,
    {} as any,
    { onDirty: vi.fn() } as any,
    { isManager: vi.fn().mockResolvedValue(false) } as any,
    {
      approveEditRequest: vi.fn(),
      rejectEditRequest: vi.fn(),
      completeEditRequest: vi.fn(),
    } as any,
  );
  return { svc, prisma };
}

describe('MyDayService - Fase 4 inc.2', () => {
  it('followItem fixa usando a identidade da origem do item', async () => {
    const { svc, prisma } = makeService();
    await svc.followItem(me, 'wi1', { pinned: true });
    expect(prisma.workItemFollow.upsert).toHaveBeenCalledTimes(1);
    const arg = prisma.workItemFollow.upsert.mock.calls[0][0];
    expect(arg.where.companyId_userId_sourceEntityType_sourceEntityId_itemType).toMatchObject({
      companyId: 'c1',
      userId: 'u1',
      sourceEntityType: 'ACTION_PLAN',
      sourceEntityId: 'a1',
      itemType: 'TASK',
    });
    expect(arg.create.pinned).toBe(true);
  });

  it('createDelegation rejeita delegar para si mesmo', async () => {
    const { svc } = makeService();
    await expect(svc.createDelegation(me, { delegateUserId: 'u1' })).rejects.toThrow('substituto');
  });

  it('getAssistantSummary gera recomendacao e registra auditoria', async () => {
    const { svc, prisma } = makeService();
    const result = await svc.getAssistantSummary(me);
    expect(result.enabled).toBe(true);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(prisma.myDayAssistantLog.upsert).toHaveBeenCalled();
  });
});
