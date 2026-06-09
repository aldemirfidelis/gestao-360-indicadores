import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionsService } from './actions.service';

/**
 * FASE 2 — fechamento do fluxo: validar/reabrir a eficácia de uma ação deve repercutir
 * no status da TRATATIVA (antes, a tratativa ficava "presa" após a eficácia).
 */

function makeService(opts: { actionsOfTreatment: Array<{ status: string; dueDate: Date | null }>; updatedStatus: string }) {
  const prisma = {
    actionPlan: {
      update: vi.fn().mockResolvedValue({
        id: 'a1',
        status: opts.updatedStatus,
        companyId: 'c1',
        indicatorId: 'i1',
        treatmentId: 't1',
        title: 'Ação',
      }),
      findMany: vi.fn().mockResolvedValue(opts.actionsOfTreatment),
    },
    actionHistory: { create: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    treatmentCase: { update: vi.fn().mockResolvedValue({}) },
  } as any;
  const traceability = { record: vi.fn().mockResolvedValue(undefined) } as any;
  const service = new ActionsService(prisma, traceability, {} as any, {} as any, { markDirty() {} } as any);
  // Evita a query rica de getById: a ação avaliada pertence à tratativa t1.
  vi.spyOn(service, 'getById').mockResolvedValue({
    id: 'a1',
    status: 'DONE',
    effectivenessStatus: 'PENDING',
    achievedResult: null,
    companyId: 'c1',
    indicatorId: 'i1',
    treatmentId: 't1',
    title: 'Ação',
  } as any);
  return { service, prisma };
}

describe('ActionsService.validateEffectiveness → propaga p/ tratativa', () => {
  beforeEach(() => vi.clearAllMocks());

  it('eficaz com todas as ações finais → tratativa em AWAITING_REEVALUATION', async () => {
    const { service, prisma } = makeService({
      actionsOfTreatment: [{ status: 'EFFECTIVE', dueDate: null }],
      updatedStatus: 'EFFECTIVE',
    });
    await service.validateEffectiveness('a1', { effective: true }, 'u1');
    expect(prisma.treatmentCase.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { status: 'AWAITING_REEVALUATION' },
    });
  });

  it('reabertura → tratativa volta a ACTIONS_IN_PROGRESS', async () => {
    const { service, prisma } = makeService({
      actionsOfTreatment: [{ status: 'REOPENED', dueDate: null }],
      updatedStatus: 'REOPENED',
    });
    await service.validateEffectiveness('a1', { reopen: true }, 'u1');
    expect(prisma.treatmentCase.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { status: 'ACTIONS_IN_PROGRESS' },
    });
  });
});
