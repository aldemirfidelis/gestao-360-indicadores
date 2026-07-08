import { describe, expect, it, vi } from 'vitest';
import { TasksService } from './tasks.service';

// Guard-rail de regressão (Fase 2 do hardening): assertTaskAccess() filtra por
// companyId, então uma tarefa de outra empresa resolve para null e o update
// precisa recusar ANTES de escrever (padrão scoped-read-before-mutate).
const me: any = { sub: 'user-1', companyId: 'company-1', email: 'user@company.test', role: 'USER' };

describe('Tasks tenant isolation', () => {
  it('does not update a task from another company', async () => {
    const prisma: any = {
      workspaceTask: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
    };
    const aggregation: any = {};
    const service = new TasksService(prisma, aggregation);

    await expect(service.updateTask(me, 'task-from-other-company', { title: 'x' })).rejects.toThrow();

    expect(prisma.workspaceTask.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'task-from-other-company', companyId: 'company-1' }),
      }),
    );
    expect(prisma.workspaceTask.update).not.toHaveBeenCalled();
  });
});
