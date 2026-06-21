import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpressionEvaluator } from './expression-evaluator';
import { WorkflowApprovalService } from './workflow-approval.service';
import { WorkflowExecutionEngine } from './workflow-engine.service';
import { WorkflowTaskService } from './workflow-task.service';

describe('Workflow - ExpressionEvaluator', () => {
  const context = {
    value: 85,
    previousValue: 95,
    light: 'RED',
    indicator: {
      code: 'IND-01',
      attainment: 0.75,
    },
  };

  it('deve avaliar igualdade simples de string', () => {
    const rule: any = { field: 'light', operator: 'eq', value: 'RED' };
    expect(ExpressionEvaluator.evaluate(rule, context)).toBe(true);

    const rule2: any = { field: 'light', operator: 'eq', value: 'GREEN' };
    expect(ExpressionEvaluator.evaluate(rule2, context)).toBe(false);
  });

  it('deve avaliar desigualdade simples de string', () => {
    const rule: any = { field: 'light', operator: 'neq', value: 'GREEN' };
    expect(ExpressionEvaluator.evaluate(rule, context)).toBe(true);
  });

  it('deve avaliar maior que numérico', () => {
    const rule: any = { field: 'value', operator: 'gt', value: 80 };
    expect(ExpressionEvaluator.evaluate(rule, context)).toBe(true);

    const rule2: any = { field: 'value', operator: 'gt', value: 90 };
    expect(ExpressionEvaluator.evaluate(rule2, context)).toBe(false);
  });

  it('deve resolver propriedades aninhadas de objeto', () => {
    const rule: any = { field: 'indicator.code', operator: 'eq', value: 'IND-01' };
    expect(ExpressionEvaluator.evaluate(rule, context)).toBe(true);
  });

  it('deve avaliar grupos lógicos complexos (AND / OR)', () => {
    const group: any = {
      type: 'AND',
      conditions: [
        { field: 'value', operator: 'gt', value: 80 },
        { field: 'light', operator: 'eq', value: 'RED' },
      ],
    };
    expect(ExpressionEvaluator.evaluate(group, context)).toBe(true);

    const group2: any = {
      type: 'OR',
      conditions: [
        { field: 'value', operator: 'gt', value: 90 },
        { field: 'light', operator: 'eq', value: 'RED' },
      ],
    };
    expect(ExpressionEvaluator.evaluate(group2, context)).toBe(true);
  });
});

describe('Workflow - WorkflowExecutionEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve carregar instancia e processar no de condicao retornando verdadeiro', async () => {
    const nodes = [
      {
        nodeKey: 'node-cond-1',
        nodeType: 'CONDITION',
        name: 'Valor > 80',
        configuration: JSON.stringify({
          condition: { field: 'value', operator: 'gt', value: 80 },
        }),
      },
    ];

    const prismaMock: any = {
      workflowInstance: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'inst-1',
          companyId: 'company-1',
          status: 'RUNNING',
          currentState: JSON.stringify({ value: 85 }),
          workflowVersion: {
            id: 'ver-1',
            nodes,
            edges: [],
          },
        }),
        findFirst: vi.fn().mockResolvedValue({
          id: 'inst-1',
          companyId: 'company-1',
          status: 'RUNNING',
          currentState: JSON.stringify({ value: 85 }),
          workflowVersion: {
            id: 'ver-1',
            nodes,
            edges: [],
          },
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      workflowNodeExecution: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'exec-1' }),
        update: vi.fn().mockResolvedValue({}),
      },
      workflowExecutionLog: {
        create: vi.fn().mockResolvedValue({}),
      },
      workflowDeadLetter: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    const queueMock: any = {
      enqueue: vi.fn().mockResolvedValue(undefined),
    };

    const moduleRefMock: any = {
      get: vi.fn().mockReturnValue({
        notifyFailure: vi.fn().mockResolvedValue({}),
      }),
    };

    const engine = new WorkflowExecutionEngine(prismaMock, queueMock, moduleRefMock);
    await engine.processNode('inst-1', 'node-cond-1');

    // Executou a condicao como true e inseriu os logs correspondentes
    expect(prismaMock.workflowNodeExecution.create).toHaveBeenCalled();
    expect(prismaMock.workflowNodeExecution.update).toHaveBeenCalledWith({
      where: { id: 'exec-1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        outputData: JSON.stringify({ result: true }),
      }),
    });
  });

  it('nao processa instancia de outra empresa quando companyId e informado', async () => {
    const prismaMock: any = {
      workflowInstance: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      workflowNodeExecution: {
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    const engine = new WorkflowExecutionEngine(prismaMock, { enqueue: vi.fn() } as any, { get: vi.fn() } as any);
    await engine.processNode('inst-cross', 'node-1', 1, 'company-1');

    expect(prismaMock.workflowInstance.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inst-cross', companyId: 'company-1' },
      }),
    );
    expect(prismaMock.workflowNodeExecution.create).not.toHaveBeenCalled();
    expect(prismaMock.workflowInstance.findUnique).not.toHaveBeenCalled();
  });
});

describe('Workflow - tenant isolation helpers', () => {
  it('WorkflowTaskService: usuario explicito precisa pertencer a empresa', async () => {
    const prismaMock: any = {
      user: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new WorkflowTaskService(prismaMock, { markDirty: vi.fn() } as any);

    const resolved = await service.resolveResponsible('company-1', { type: 'USER', userId: 'user-other' }, {}, {});

    expect(resolved).toBeNull();
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'user-other', companyId: 'company-1', active: true },
      select: { id: true },
    });
  });

  it('WorkflowApprovalService: aprovador explicito precisa pertencer a empresa', async () => {
    const prismaMock: any = {
      user: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new WorkflowApprovalService(prismaMock, { markDirty: vi.fn() } as any);

    const resolved = await service.resolveApprover('company-1', { type: 'USER', userId: 'user-other' }, {}, {});

    expect(resolved).toBeNull();
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'user-other', companyId: 'company-1', active: true },
      select: { id: true },
    });
  });
});
