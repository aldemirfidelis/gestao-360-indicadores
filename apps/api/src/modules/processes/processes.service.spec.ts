import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { ProcessesService } from './processes.service';
import type { AuthPayload } from '../auth/auth.types';

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(opts?: {
  processes?: unknown[];
  process?: unknown;
  step?: unknown;
  listAreaFilter?: unknown;
  orgNode?: unknown;
  indicator?: unknown;
  user?: unknown;
  last?: unknown;
}) {
  const prisma: any = {
    process: {
      findMany: vi.fn().mockResolvedValue(opts?.processes ?? []),
      findFirst: vi.fn().mockImplementation((args: any) => {
        if (args?.orderBy?.number) return Promise.resolve(opts?.last ?? null);
        return Promise.resolve(opts?.process ?? null);
      }),
      create: vi.fn().mockResolvedValue(baseProcess({ id: 'p1', number: 1, name: 'Compras', indicatorId: opts?.indicator ? 'i1' : null })),
      update: vi.fn().mockResolvedValue(baseProcess({ id: 'p1', number: 1, name: 'Compras revisado', status: 'ACTIVE' })),
    },
    processStep: {
      findFirst: vi.fn().mockResolvedValue(opts?.step ?? null),
      create: vi.fn().mockResolvedValue(baseStep({ id: 's1', processId: 'p1', order: 2, name: 'Aprovar compra' })),
      update: vi.fn().mockResolvedValue(baseStep({ id: 's1', processId: 'p1', order: 3, name: 'Aprovar compra revisada' })),
      delete: vi.fn().mockResolvedValue(baseStep({ id: 's1', processId: 'p1', order: 2, name: 'Aprovar compra' })),
    },
    orgNode: { findFirst: vi.fn().mockResolvedValue(opts?.orgNode ?? null), findMany: vi.fn().mockResolvedValue([]) },
    indicator: { findFirst: vi.fn().mockResolvedValue(opts?.indicator ?? null), findMany: vi.fn().mockResolvedValue([]) },
    user: { findFirst: vi.fn().mockResolvedValue(opts?.user ?? null), findMany: vi.fn().mockResolvedValue([]) },
  };
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));

  const traceability = { record: vi.fn().mockResolvedValue(undefined) } as any;
  const access = {
    listAreaFilter: vi.fn().mockResolvedValue(opts?.listAreaFilter ?? null),
    assertCanWrite: vi.fn().mockResolvedValue(undefined),
  } as any;

  const service = new ProcessesService(prisma, traceability, access);
  return { service, prisma, traceability, access };
}

describe('ProcessesService - processos e SIPOC', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list: escopo de empresa + filtro de area incluindo processos gerais', async () => {
    const { service, prisma } = makeService({ listAreaFilter: ['areaA'] });
    await service.list(me);
    const where = prisma.process.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.deletedAt).toBeNull();
    expect(where.AND[0].OR).toContainEqual({ orgNodeId: { in: ['areaA'] } });
    expect(where.AND[0].OR).toContainEqual({ orgNodeId: null, indicatorId: null });
  });

  it('list: status/tipo/busca sem trocar empresa', async () => {
    const { service, prisma } = makeService();
    await service.list(me, { status: 'ACTIVE', type: 'CORE', search: 'compras' });
    const where = prisma.process.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.status).toBe('ACTIVE');
    expect(where.type).toBe('CORE');
    expect(where.AND[0].OR[0].name).toEqual({ contains: 'compras', mode: 'insensitive' });
  });

  it('summary: calcula ativos, rascunhos e processos sem etapas pela listagem visivel', async () => {
    const { service } = makeService({
      processes: [
        baseProcess({ id: 'p1', status: 'ACTIVE', type: 'CORE', steps: [baseStep()] }),
        baseProcess({ id: 'p2', status: 'DRAFT', type: 'SUPPORT', steps: [] }),
        baseProcess({ id: 'p3', status: 'UNDER_REVIEW', type: 'MANAGEMENT', steps: [baseStep(), baseStep({ id: 's2' })] }),
      ],
    });
    const res = await service.summary(me);
    expect(res.total).toBe(3);
    expect(res.active).toBe(1);
    expect(res.draft).toBe(1);
    expect(res.underReview).toBe(1);
    expect(res.mappedSteps).toBe(3);
    expect(res.withoutSteps).toBe(1);
  });

  it('getById: processo de outra empresa -> NotFound', async () => {
    const { service, prisma } = makeService({ process: null });
    await expect(service.getById(me, 'p-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.process.findFirst.mock.calls[0][0].where.companyId).toBe('companyA');
  });

  it('getById: area nao permitida -> Forbidden', async () => {
    const { service } = makeService({ process: baseProcess({ orgNodeId: 'areaB' }), listAreaFilter: ['areaA'] });
    await expect(service.getById(me, 'p1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create: valida vinculos, numera por empresa e registra rastreabilidade', async () => {
    const { service, prisma, traceability, access } = makeService({ indicator: { ownerNodeId: 'areaA' }, user: { id: 'u2' } });
    await service.create(me, { name: 'Compras', indicatorId: 'i1', ownerUserId: 'u2', type: 'CORE', status: 'ACTIVE' });
    expect(access.assertCanWrite).toHaveBeenCalledWith('user-1', 'areaA', 'processes', 'create');
    const data = prisma.process.create.mock.calls[0][0].data;
    expect(data.companyId).toBe('companyA');
    expect(data.number).toBe(1);
    expect(data.createdById).toBe('user-1');
    expect(traceability.record).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'PROCESS', eventType: 'CREATED' }));
  });

  it('create: indicador de outra empresa -> NotFound e nao grava', async () => {
    const { service, prisma } = makeService({ indicator: null });
    await expect(service.create(me, { name: 'Compras', indicatorId: 'i-outra' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.process.create).not.toHaveBeenCalled();
  });

  it('create: vinculos em areas diferentes -> Conflict', async () => {
    const { service, prisma } = makeService({ orgNode: { id: 'areaA' }, indicator: { ownerNodeId: 'areaB' } });
    await expect(service.create(me, { name: 'Compras', orgNodeId: 'areaA', indicatorId: 'i1' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.process.create).not.toHaveBeenCalled();
  });

  it('update: nao persiste id/companyId forjados e atualiza status', async () => {
    const { service, prisma } = makeService({ process: baseProcess({ orgNodeId: null, status: 'DRAFT' }) });
    await service.update(me, 'p1', { id: 'hack', companyId: 'companyB', status: 'ACTIVE', name: 'Compras v2' });
    const data = prisma.process.update.mock.calls[0][0].data;
    expect(data.id).toBeUndefined();
    expect(data.companyId).toBeUndefined();
    expect(data.name).toBe('Compras v2');
    expect(data.status).toBe('ACTIVE');
  });

  it('addStep: calcula ordem, grava etapa e registra trace PROCESS_STEP', async () => {
    const process = baseProcess({ id: 'p1', number: 7, indicatorId: 'i1', steps: [baseStep({ order: 1 })] });
    const { service, prisma, traceability } = makeService({ process });
    await service.addStep(me, 'p1', { name: 'Aprovar compra' });
    const data = prisma.processStep.create.mock.calls[0][0].data;
    expect(data.order).toBe(2);
    expect(traceability.record).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'PROCESS_STEP', relatedType: 'PROCESS', relatedId: 'p1' }));
  });
});

function baseProcess(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    companyId: 'companyA',
    number: 1,
    code: null,
    orgNodeId: null,
    indicatorId: null,
    ownerUserId: null,
    createdById: 'user-1',
    name: 'Compras',
    description: null,
    objective: null,
    type: 'CORE',
    status: 'DRAFT',
    version: null,
    suppliers: null,
    inputs: null,
    outputs: null,
    customers: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    orgNode: null,
    indicator: null,
    owner: null,
    createdBy: null,
    steps: [],
    ...overrides,
  };
}

function baseStep(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    processId: 'p1',
    order: 1,
    name: 'Solicitar compra',
    description: null,
    responsible: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
