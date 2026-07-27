import { describe, expect, it, vi } from 'vitest';
import { TrainingAssignmentStatus, TrainingValidityKind } from '@prisma/client';
import { TrainingMatrixService } from './training-matrix.service';

function service(prisma: any = {}) {
  return new TrainingMatrixService(prisma as any);
}

const training = (kind: TrainingValidityKind, value: number | null = null) => ({
  validityKind: kind,
  validityValue: value,
});

describe('TrainingMatrixService — cálculo de validade', () => {
  it('sem vencimento não gera data de validade', () => {
    expect(service().computeValidUntil(new Date('2026-01-10'), training(TrainingValidityKind.NONE))).toBeNull();
  });

  it('validade em dias, meses e anos', () => {
    const base = new Date('2026-01-10T12:00:00Z');
    const dias = service().computeValidUntil(base, training(TrainingValidityKind.DAYS, 30));
    const meses = service().computeValidUntil(base, training(TrainingValidityKind.MONTHS, 12));
    const anos = service().computeValidUntil(base, training(TrainingValidityKind.YEARS, 2));

    expect(dias?.toISOString().slice(0, 10)).toBe('2026-02-09');
    expect(meses?.toISOString().slice(0, 10)).toBe('2027-01-10');
    expect(anos?.toISOString().slice(0, 10)).toBe('2028-01-10');
  });

  it('a regra da exigência vence a validade padrão do treinamento', () => {
    // Norma exige reciclagem anual, embora o curso valha 2 anos.
    const result = service().computeValidUntil(
      new Date('2026-01-10T12:00:00Z'),
      training(TrainingValidityKind.YEARS, 2),
      { validityKind: TrainingValidityKind.YEARS, validityValue: 1 },
    );
    expect(result?.toISOString().slice(0, 10)).toBe('2027-01-10');
  });

  it('validade herdada do documento usa a vigência do próprio documento', () => {
    const docValidity = new Date('2026-06-30T00:00:00Z');
    const result = service().computeValidUntil(
      new Date('2026-01-10'),
      training(TrainingValidityKind.FROM_DOCUMENT),
      null,
      docValidity,
    );
    expect(result).toEqual(docValidity);
  });

  it('validade inválida (zero ou negativa) não inventa vencimento', () => {
    expect(service().computeValidUntil(new Date('2026-01-10'), training(TrainingValidityKind.MONTHS, 0))).toBeNull();
  });
});

describe('TrainingMatrixService — situação por vencimento', () => {
  const now = new Date('2026-01-10T00:00:00Z');

  it('sem validade permanece válido', () => {
    expect(service().statusFromValidity(null, 30, now)).toBe(TrainingAssignmentStatus.VALID);
  });

  it('data futura fora da faixa continua válido', () => {
    expect(service().statusFromValidity(new Date('2026-06-01'), 30, now)).toBe(TrainingAssignmentStatus.VALID);
  });

  it('dentro da antecedência vira próximo do vencimento', () => {
    expect(service().statusFromValidity(new Date('2026-01-25'), 30, now)).toBe(TrainingAssignmentStatus.DUE_SOON);
  });

  it('data passada vira vencido', () => {
    expect(service().statusFromValidity(new Date('2026-01-09'), 30, now)).toBe(TrainingAssignmentStatus.EXPIRED);
  });

  it('vencimento exatamente hoje já conta como vencido', () => {
    expect(service().statusFromValidity(now, 30, now)).toBe(TrainingAssignmentStatus.EXPIRED);
  });
});

describe('TrainingMatrixService — prazo de conclusão', () => {
  it('sem prazo configurado não define data limite', () => {
    expect(service().computeDueAt(new Date('2026-01-10'), null)).toBeNull();
    expect(service().computeDueAt(new Date('2026-01-10'), 0)).toBeNull();
  });

  it('soma os dias a partir do evento', () => {
    expect(service().computeDueAt(new Date('2026-01-10T12:00:00Z'), 15)?.toISOString().slice(0, 10)).toBe('2026-01-25');
  });
});

describe('TrainingMatrixService — recomputação da matriz', () => {
  function prismaWith(overrides: Record<string, any> = {}) {
    return {
      orgEmployee: {
        findFirst: vi.fn().mockResolvedValue({ id: 'emp-1', jobId: 'job-1', orgNodeId: 'node-1', status: 'ACTIVE' }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      orgNode: { findMany: vi.fn().mockResolvedValue([{ id: 'node-1', parentId: null }]) },
      trainingRequirement: { findMany: vi.fn().mockResolvedValue([]) },
      trainingAssignment: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn(),
        findUnique: vi.fn(),
      },
      trainingHistoryEntry: { createMany: vi.fn(), create: vi.fn() },
      trainingEffectivenessReview: { create: vi.fn() },
      document: { findUnique: vi.fn() },
      ...overrides,
    };
  }

  it('colaborador desligado sai das pendências abertas sem perder histórico', async () => {
    const prisma = prismaWith({
      orgEmployee: {
        findFirst: vi.fn().mockResolvedValue({ id: 'emp-1', jobId: 'job-1', orgNodeId: null, status: 'TERMINATED' }),
        findMany: vi.fn(),
      },
      trainingAssignment: {
        findMany: vi.fn().mockResolvedValue([{ id: 'a1', trainingId: 't1', status: 'PENDING' }]),
        createMany: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      trainingHistoryEntry: { createMany: vi.fn(), create: vi.fn() },
    });

    const result = await service(prisma).recomputeEmployee('empresa-1', 'emp-1', { reason: 'TERMINATION' });

    expect(result.closed).toBe(1);
    expect(result.created).toBe(0);
    // Encerra com NOT_APPLICABLE — não apaga.
    expect(prisma.trainingAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: TrainingAssignmentStatus.NOT_APPLICABLE } }),
    );
    expect(prisma.trainingHistoryEntry.createMany).toHaveBeenCalled();
  });

  it('não duplica pendência de treinamento já válido por outra origem', async () => {
    const prisma = prismaWith({
      trainingRequirement: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'req-novo',
            trainingId: 'training-1',
            mandatory: true,
            admissionDeadlineDays: null,
            movementDeadlineDays: null,
            training: { id: 'training-1', validityKind: 'YEARS', validityValue: 1, dueSoonDays: 30, deadlineDays: 30, documentId: null, documentVersion: null },
          },
        ]),
      },
      trainingAssignment: {
        // Mesmo treinamento já concluído e válido por outra exigência.
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            { id: 'a1', trainingId: 'training-1', requirementId: 'req-antigo', status: 'VALID', validUntil: new Date('2027-01-01'), mandatory: true },
          ])
          .mockResolvedValue([]),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    });

    const result = await service(prisma).recomputeEmployee('empresa-1', 'emp-1', { reason: 'JOB_CHANGED' });

    expect(result.created).toBe(0);
    expect(prisma.trainingAssignment.createMany).not.toHaveBeenCalled();
  });

  it('exigência nova de cargo gera pendência com prazo de movimentação', async () => {
    const prisma = prismaWith({
      trainingRequirement: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'req-1',
            trainingId: 'training-1',
            mandatory: true,
            admissionDeadlineDays: 10,
            movementDeadlineDays: 5,
            training: { id: 'training-1', validityKind: 'NONE', validityValue: null, dueSoonDays: 30, deadlineDays: 60, documentId: null, documentVersion: null },
          },
        ]),
      },
      trainingAssignment: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    });

    const from = new Date('2026-01-10T12:00:00Z');
    const result = await service(prisma).recomputeEmployee('empresa-1', 'emp-1', {
      reason: 'JOB_CHANGED',
      deadlineFrom: from,
    });

    expect(result.created).toBe(1);
    const created = prisma.trainingAssignment.createMany.mock.calls[0]![0].data[0];
    expect(created.status).toBe(TrainingAssignmentStatus.PENDING);
    // Usou o prazo de movimentação (5 dias), não o de admissão nem o padrão.
    expect(created.dueAt.toISOString().slice(0, 10)).toBe('2026-01-15');
  });

  it('exigência que deixou de valer é encerrada, não apagada', async () => {
    const prisma = prismaWith({
      trainingRequirement: { findMany: vi.fn().mockResolvedValue([]) },
      trainingAssignment: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            { id: 'a1', trainingId: 't1', requirementId: 'req-antigo', status: 'PENDING', validUntil: null, mandatory: true },
            { id: 'a2', trainingId: 't2', requirementId: 'req-antigo-2', status: 'VALID', validUntil: new Date('2030-01-01'), mandatory: true },
          ])
          .mockResolvedValue([]),
        createMany: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    });

    const result = await service(prisma).recomputeEmployee('empresa-1', 'emp-1', { reason: 'JOB_CHANGED' });

    expect(result.closed).toBe(1);
    // Só a pendência aberta foi encerrada; o concluído/válido permanece.
    const ids = prisma.trainingAssignment.updateMany.mock.calls[0]![0].where.id.in;
    expect(ids).toEqual(['a1']);
  });

  it('a exigência de uma diretoria alcança o colaborador do setor abaixo', async () => {
    const prisma = prismaWith({
      orgEmployee: {
        findFirst: vi.fn().mockResolvedValue({ id: 'emp-1', jobId: 'job-1', orgNodeId: 'setor', status: 'ACTIVE' }),
        findMany: vi.fn(),
      },
      orgNode: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'diretoria', parentId: null },
          { id: 'gerencia', parentId: 'diretoria' },
          { id: 'setor', parentId: 'gerencia' },
        ]),
      },
    });

    await service(prisma).recomputeEmployee('empresa-1', 'emp-1', { reason: 'MATRIX_CHANGED' });

    const where = prisma.trainingRequirement.findMany.mock.calls[0]![0].where;
    const orgTarget = where.OR.find((item: any) => item.target === 'ORG_NODE');
    expect(orgTarget.targetId.in.sort()).toEqual(['diretoria', 'gerencia', 'setor']);
  });
});
