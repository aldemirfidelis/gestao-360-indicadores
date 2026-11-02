import { describe, expect, it, vi } from 'vitest';
import { ActionsService } from './actions.service';

describe('ActionsService — salvar análise de causa', () => {
  function setup() {
    const tx = {
      actionAnalysisSession: { upsert: vi.fn().mockResolvedValue({ id: 'session-1' }) },
      actionIshikawaCause: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = {
      actionPlan: {
        findFirst: vi.fn().mockResolvedValue({ id: 'a1', companyId: 'c1', indicatorId: 'i1', deviationId: null, analysisTool: null, title: 'Plano', problemDescription: null, rootCause: null }),
        update: vi.fn().mockResolvedValue({}),
      },
      actionIshikawaCause: { deleteMany: vi.fn(), createMany: vi.fn() },
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as any;
    const service = new ActionsService(prisma, { record: vi.fn().mockResolvedValue(undefined) } as any, {} as any, {} as any, { markDirty() {} } as any, { record: vi.fn().mockResolvedValue(undefined) } as any);
    vi.spyOn(service, 'recalcProgress').mockResolvedValue(undefined as any);
    vi.spyOn(service, 'getById').mockResolvedValue({ id: 'a1' } as any);
    vi.spyOn(service as any, 'recordHistory').mockResolvedValue(undefined);
    vi.spyOn(service as any, 'audit').mockResolvedValue(undefined);
    return { service, prisma, tx };
  }

  it('troca as causas do Ishikawa dentro da transação da sessão, mantendo ids gerados no navegador', async () => {
    const { service, prisma, tx } = setup();
    const clientId = '0b5c2f1e-8a43-4f7e-9a51-3d2c1b0a9f88';

    await service.saveAnalysis(
      'a1',
      {
        method: 'ISHIKAWA',
        problem: 'Atraso na entrega',
        rootCause: '',
        ishikawaCauses: [
          { id: clientId, category: 'METHOD', title: 'Falta de padrão', orderIndex: 0 },
          { id: 'temp-123', category: 'MACHINE', title: 'Máquina parada', orderIndex: 0 },
        ],
      },
      undefined,
      'c1',
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.actionIshikawaCause.deleteMany).toHaveBeenCalledWith({ where: { sessionId: 'session-1' } });
    const rows = tx.actionIshikawaCause.createMany.mock.calls[0][0].data;
    expect(rows[0]).toMatchObject({ id: clientId, sessionId: 'session-1', category: 'METHOD' });
    expect(rows[1].id).toBeUndefined();
    // Nada de apagar/recriar fora da transação.
    expect(prisma.actionIshikawaCause.deleteMany).not.toHaveBeenCalled();
    expect(prisma.actionIshikawaCause.createMany).not.toHaveBeenCalled();
  });
});
