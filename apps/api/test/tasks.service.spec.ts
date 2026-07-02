import { describe, expect, it, vi } from 'vitest';
import { UserRoleEnum } from '@prisma/client';
import { TasksService } from '../src/modules/tasks/tasks.service';

const me = {
  sub: 'user-1',
  email: 'user@example.com',
  name: 'Ana Souza',
  role: UserRoleEnum.COLLABORATOR,
  companyId: 'company-1',
};

const columns = [
  { id: 'todo', boardId: 'board-1', name: 'A Fazer', statusKey: 'TODO', position: 1, color: '#f59e0b', icon: null, isDoneColumn: false },
  { id: 'done', boardId: 'board-1', name: 'Realizado', statusKey: 'DONE', position: 4, color: '#10b981', icon: null, isDoneColumn: true },
];

function workspaceTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    companyId: me.companyId,
    boardId: 'board-1',
    columnId: 'todo',
    title: 'Revisar procedimento',
    description: null,
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: null,
    startDate: null,
    completedAt: null,
    assigneeId: null,
    createdById: me.sub,
    areaId: null,
    projectId: null,
    position: 1000,
    color: 'yellow',
    icon: null,
    tags: [],
    dependencies: [],
    isArchived: false,
    isAutomatic: false,
    sourceKey: null,
    sourceType: 'MANUAL',
    sourceModule: null,
    sourceEntityId: null,
    sourceEntityLabel: null,
    sourceUrl: null,
    automationRuleId: null,
    generatedBy: 'USER',
    generatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { comments: 0, attachments: 0, checklistItems: 0, links: 0 },
    checklistItems: [],
    ...overrides,
  };
}

describe('TasksService', () => {
  it('cria tarefa manual no tenant atual e registra atividade', async () => {
    const created = workspaceTask();
    const prisma = {
      taskBoard: {
        upsert: vi.fn().mockResolvedValue({ id: 'board-1', key: 'CENTRAL_TRABALHO:company-1', columns }),
      },
      taskBoardColumn: {
        findFirst: vi.fn().mockResolvedValue(columns[0]),
      },
      workspaceTask: {
        aggregate: vi.fn().mockResolvedValue({ _max: { position: 0 } }),
        create: vi.fn().mockResolvedValue(created),
      },
      user: { findMany: vi.fn().mockResolvedValue([{ id: me.sub, name: me.name, avatarUrl: null, jobTitle: null }]) },
      orgNode: { findMany: vi.fn() },
      project: { findMany: vi.fn() },
      notification: { create: vi.fn() },
    };
    const service = new TasksService(prisma as never, { rebuildForUser: vi.fn() } as never);

    const result = await service.createTask(me, { title: 'Revisar procedimento', columnId: 'todo' });

    expect(result.id).toBe('task-1');
    expect(prisma.workspaceTask.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        companyId: me.companyId,
        createdById: me.sub,
        isAutomatic: false,
        sourceType: 'MANUAL',
        activities: { create: expect.objectContaining({ action: 'TASK_CREATED' }) },
      }),
    }));
  });

  it('protege o vínculo obrigatório de uma tarefa automática', async () => {
    const automatic = workspaceTask({
      assigneeId: me.sub,
      createdById: null,
      isAutomatic: true,
      sourceType: 'INDICATOR',
      sourceEntityId: 'indicator-1',
    });
    const prisma = {
      workspaceTask: { findFirst: vi.fn().mockResolvedValue(automatic) },
      taskLink: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'link-1',
          taskId: automatic.id,
          entityType: 'INDICATOR',
          entityId: 'indicator-1',
          entityLabel: 'Indicador',
        }),
      },
      user: { findFirst: vi.fn().mockResolvedValue({ defaultNodeId: null }), findMany: vi.fn() },
      userAreaAssignment: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new TasksService(prisma as never, { rebuildForUser: vi.fn() } as never);

    await expect(service.removeLink(me, automatic.id, 'link-1')).rejects.toThrow(
      'O vínculo de origem de uma tarefa automática não pode ser removido.',
    );
  });

  it('concluir um sticky de plano propaga a conclusão para a ActionTask de origem', async () => {
    const automatic = workspaceTask({
      assigneeId: me.sub,
      createdById: null,
      isAutomatic: true,
      sourceType: 'ACTION_PLAN',
      sourceEntityId: 'action-task-1',
      automationRuleId: 'ACTION_TASK',
    });
    const prisma = {
      workspaceTask: {
        findFirst: vi.fn().mockResolvedValue(automatic),
        aggregate: vi.fn().mockResolvedValue({ _max: { position: 1000 } }),
        update: vi.fn().mockResolvedValue({ ...automatic, columnId: 'done', status: 'DONE' }),
      },
      taskBoardColumn: {
        findFirst: vi.fn().mockResolvedValue(columns[1]),
        findUnique: vi.fn().mockResolvedValue(columns[0]),
      },
      taskActivity: { create: vi.fn().mockResolvedValue({ id: 'activity-1' }) },
      actionTask: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      user: { findFirst: vi.fn().mockResolvedValue({ defaultNodeId: null }), findMany: vi.fn() },
      userAreaAssignment: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn().mockImplementation((operations: Array<Promise<unknown>>) => Promise.all(operations)),
    };
    const service = new TasksService(prisma as never, { rebuildForUser: vi.fn() } as never);
    vi.spyOn(service, 'getTask').mockResolvedValue({ id: automatic.id } as never);

    await service.moveTask(me, automatic.id, { columnId: 'done' });

    expect(prisma.actionTask.updateMany).toHaveBeenCalledWith({
      where: { id: 'action-task-1', action: { companyId: me.companyId } },
      data: { done: true, completionNote: `Concluída pela Central de Trabalho por ${me.name}.` },
    });
    expect(prisma.taskActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'TASK_COMPLETED', fromValue: 'A Fazer', toValue: 'Realizado' }),
    });
  });
});
