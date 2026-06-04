import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { NonConformitiesService } from './nonconformities.service';
import type { AuthPayload } from '../auth/auth.types';

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(opts?: {
  ncs?: unknown[];
  nc?: unknown;
  listAreaFilter?: unknown;
  orgNode?: unknown;
  indicator?: unknown;
  deviation?: unknown;
  action?: unknown;
  user?: unknown;
}) {
  const prisma: any = {
    nonConformity: {
      findMany: vi.fn().mockResolvedValue(opts?.ncs ?? []),
      findFirst: vi.fn().mockResolvedValue(opts?.nc ?? null),
      create: vi.fn().mockResolvedValue({ id: 'nc1', number: 1, companyId: 'companyA', title: 'NC', status: 'OPEN', source: 'INDICATOR', severity: 'MAJOR', indicatorId: opts?.indicator ? 'i1' : null }),
      update: vi.fn().mockResolvedValue({ id: 'nc1', number: 1, companyId: 'companyA', title: 'NC', status: 'CLOSED', source: 'INDICATOR', severity: 'MAJOR', indicatorId: null }),
    },
    orgNode: { findFirst: vi.fn().mockResolvedValue(opts?.orgNode ?? null), findMany: vi.fn().mockResolvedValue([]) },
    indicator: { findFirst: vi.fn().mockResolvedValue(opts?.indicator ?? null), findMany: vi.fn().mockResolvedValue([]) },
    deviation: { findFirst: vi.fn().mockResolvedValue(opts?.deviation ?? null), findMany: vi.fn().mockResolvedValue([]) },
    actionPlan: { findFirst: vi.fn().mockResolvedValue(opts?.action ?? null), findMany: vi.fn().mockResolvedValue([]) },
    user: { findFirst: vi.fn().mockResolvedValue(opts?.user ?? null), findMany: vi.fn().mockResolvedValue([]) },
  };
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));

  const traceability = { record: vi.fn().mockResolvedValue(undefined) } as any;
  const access = {
    listAreaFilter: vi.fn().mockResolvedValue(opts?.listAreaFilter ?? null),
    assertCanWrite: vi.fn().mockResolvedValue(undefined),
  } as any;

  const service = new NonConformitiesService(prisma, traceability, access);
  return { service, prisma, traceability, access };
}

describe('NonConformitiesService - registro de NCs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list: escopo de empresa + filtro de area (NCs gerais visiveis)', async () => {
    const { service, prisma } = makeService({ listAreaFilter: ['areaA'] });
    await service.list(me);
    const where = prisma.nonConformity.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.deletedAt).toBeNull();
    expect(where.AND[0].OR).toContainEqual({ indicator: { ownerNodeId: { in: ['areaA'] } } });
    expect(where.AND[0].OR).toContainEqual({ orgNodeId: null, indicatorId: null, deviationId: null, correctiveActionId: null });
  });

  it('list: status/origem/severidade/busca/vinculo sem trocar empresa', async () => {
    const { service, prisma } = makeService();
    await service.list(me, { status: 'ACTION', source: 'AUDIT', severity: 'CRITICAL', search: 'fuga', actionId: 'a1' });
    const where = prisma.nonConformity.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.status).toBe('ACTION');
    expect(where.source).toBe('AUDIT');
    expect(where.severity).toBe('CRITICAL');
    expect(where.correctiveActionId).toBe('a1');
    expect(where.AND[0].OR[0].title).toEqual({ contains: 'fuga', mode: 'insensitive' });
  });

  it('summary: consolida somente as NCs da listagem visivel', async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const { service } = makeService({
      ncs: [
        baseNc({ id: 'nc1', severity: 'CRITICAL', status: 'OPEN', dueDate: past }),
        baseNc({ id: 'nc2', severity: 'MINOR', status: 'CLOSED', effectivenessOk: true }),
      ],
    });
    const res = await service.summary(me);
    expect(res.total).toBe(2);
    expect(res.open).toBe(1);
    expect(res.critical).toBe(1);
    expect(res.overdue).toBe(1);
    expect(res.effective).toBe(1);
    expect(res.topOpen[0].id).toBe('nc1');
  });

  it('getById: NC de outra empresa -> NotFound', async () => {
    const { service, prisma } = makeService({ nc: null });
    await expect(service.getById(me, 'nc-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.nonConformity.findFirst.mock.calls[0][0].where.companyId).toBe('companyA');
  });

  it('getById: area nao permitida -> Forbidden', async () => {
    const { service } = makeService({ nc: baseNc({ orgNodeId: 'areaB' }), listAreaFilter: ['areaA'] });
    await expect(service.getById(me, 'nc1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create: valida vinculos, exige escrita na area e numera por empresa', async () => {
    const { service, prisma, access } = makeService({
      indicator: { ownerNodeId: 'areaA' },
      action: { ownerNodeId: 'areaA', indicator: null },
      user: { id: 'u2' },
    });
    await service.create(me, { title: 'Produto fora de spec', indicatorId: 'i1', correctiveActionId: 'a1', responsibleUserId: 'u2', severity: 'CRITICAL' });
    expect(access.assertCanWrite).toHaveBeenCalledWith('user-1', 'areaA', 'nonconformities', 'create');
    const data = prisma.nonConformity.create.mock.calls[0][0].data;
    expect(data.companyId).toBe('companyA');
    expect(data.createdById).toBe('user-1');
    expect(data.number).toBe(1);
    expect(data.indicatorId).toBe('i1');
    expect(data.severity).toBe('CRITICAL');
  });

  it('create: indicador de outra empresa -> NotFound e nao grava', async () => {
    const { service, prisma } = makeService({ indicator: null });
    await expect(service.create(me, { title: 'NC', indicatorId: 'i-outra' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.nonConformity.create).not.toHaveBeenCalled();
  });

  it('create: vinculos em areas diferentes -> Conflict', async () => {
    const { service, prisma } = makeService({ orgNode: { id: 'areaA' }, indicator: { ownerNodeId: 'areaB' } });
    await expect(service.create(me, { title: 'NC', orgNodeId: 'areaA', indicatorId: 'i1' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.nonConformity.create).not.toHaveBeenCalled();
  });

  it('update: nao persiste id/companyId forjados e fecha com closedAt', async () => {
    const { service, prisma } = makeService({ nc: baseNc({ orgNodeId: null }) });
    await service.update(me, 'nc1', { id: 'hack', companyId: 'companyB', status: 'CLOSED', title: 'Atualizada' });
    const data = prisma.nonConformity.update.mock.calls[0][0].data;
    expect(data.id).toBeUndefined();
    expect(data.companyId).toBeUndefined();
    expect(data.title).toBe('Atualizada');
    expect(data.closedAt).toBeInstanceOf(Date);
  });
});

function baseNc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nc1',
    companyId: 'companyA',
    number: 1,
    orgNodeId: null,
    indicatorId: null,
    deviationId: null,
    correctiveActionId: null,
    responsibleUserId: null,
    createdById: 'user-1',
    title: 'NC',
    description: null,
    source: 'INDICATOR',
    severity: 'MAJOR',
    status: 'OPEN',
    immediateAction: null,
    rootCause: null,
    correctivePlan: null,
    effectivenessCheck: null,
    effectivenessOk: null,
    dueDate: null,
    identifiedAt: new Date(),
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    orgNode: null,
    indicator: null,
    deviation: null,
    correctiveAction: null,
    responsibleUser: null,
    createdBy: null,
    ...overrides,
  };
}
