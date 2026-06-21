import { describe, expect, it, vi } from 'vitest';
import { UserRoleEnum } from '@prisma/client';
import { AutomationsController } from './automations.controller';
import type { AuthPayload } from '../auth/auth.types';

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@example.com',
  name: 'User',
  role: UserRoleEnum.COMPANY_ADMIN,
  companyId: 'company-1',
};

describe('AutomationsController tenant isolation', () => {
  it('resolveDeadLetter only relaunches node execution from the same company and instance', async () => {
    const prisma: any = {
      workflowDeadLetter: {
        findFirstOrThrow: vi.fn().mockResolvedValue({
          id: 'dl-1',
          workflowInstanceId: 'inst-1',
          nodeExecutionId: 'exec-foreign',
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      workflowInstance: { update: vi.fn().mockResolvedValue({}) },
      workflowNodeExecution: {
        findFirstOrThrow: vi.fn().mockResolvedValue({ id: 'exec-1', nodeKey: 'node-1' }),
      },
    };
    const executionEngine = { processNode: vi.fn().mockResolvedValue(undefined) };
    const controller = new AutomationsController(
      prisma,
      {} as any,
      {} as any,
      executionEngine as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await controller.resolveDeadLetter(me, 'dl-1');

    expect(prisma.workflowDeadLetter.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'dl-1', companyId: 'company-1', status: 'UNRESOLVED' },
    });
    expect(prisma.workflowNodeExecution.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'exec-foreign', workflowInstanceId: 'inst-1', companyId: 'company-1' },
    });
    expect(executionEngine.processNode).toHaveBeenCalledWith('inst-1', 'node-1', 1, 'company-1');
  });
});
