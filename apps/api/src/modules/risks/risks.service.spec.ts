import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { RisksService } from './risks.service';
import type { AuthPayload } from '../auth/auth.types';

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(opts?: {
  risks?: unknown[];
  risk?: unknown;
  listAreaFilter?: unknown;
  orgNode?: unknown;
  indicator?: unknown;
  project?: unknown;
  action?: unknown;
  user?: unknown;
}) {
  const prisma = {
    riskRegister: {
      findMany: vi.fn().mockResolvedValue(opts?.risks ?? []),
      findFirst: vi.fn().mockResolvedValue(opts?.risk ?? null),
      create: vi.fn().mockResolvedValue({ id: 'r1', companyId: 'companyA', title: 'Risco', status: 'IDENTIFIED', category: 'OPERATIONAL', probability: 3, impact: 4, indicatorId: opts?.indicator ? 'i1' : null }),
      update: vi.fn().mockResolvedValue({ id: 'r1', companyId: 'companyA', title: 'Risco', status: 'CLOSED', category: 'OPERATIONAL', probability: 3, impact: 4, indicatorId: null }),
    },
    orgNode: {
      findFirst: vi.fn().mockResolvedValue(opts?.orgNode ?? null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    indicator: {
      findFirst: vi.fn().mockResolvedValue(opts?.indicator ?? null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    project: {
      findFirst: vi.fn().mockResolvedValue(opts?.project ?? null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    actionPlan: {
      findFirst: vi.fn().mockResolvedValue(opts?.action ?? null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue(opts?.user ?? null),
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as any;

  const traceability = { record: vi.fn().mockResolvedValue(undefined) } as any;
  const access = {
    listAreaFilter: vi.fn().mockResolvedValue(opts?.listAreaFilter ?? null),
    assertCanWrite: vi.fn().mockResolvedValue(undefined),
  } as any;

  const service = new RisksService(prisma, traceability, access);
  return { service, prisma, traceability, access };
}

describe('RisksService - registro de riscos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list: aplica escopo de empresa e filtro de area com riscos gerais visiveis', async () => {
    const { service, prisma } = makeService({ listAreaFilter: ['areaA'] });
    await service.list(me);
    const where = prisma.riskRegister.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.deletedAt).toBeNull();
    expect(where.AND[0].OR).toContainEqual({ orgNodeId: { in: ['areaA'] } });
    expect(where.AND[0].OR).toContainEqual({ orgNodeId: null, indicatorId: null, projectId: null, mitigationActionId: null });
  });

  it('list: aplica status, categoria, busca e vinculo sem trocar empresa', async () => {
    const { service, prisma } = makeService();
    await service.list(me, { status: 'MITIGATING', category: 'COMPLIANCE', search: 'lgpd', actionId: 'a1' });
    const where = prisma.riskRegister.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.status).toBe('MITIGATING');
    expect(where.category).toBe('COMPLIANCE');
    expect(where.mitigationActionId).toBe('a1');
    expect(where.AND[0].OR[0].title).toEqual({ contains: 'lgpd', mode: 'insensitive' });
  });

  it('summary: consolida somente riscos retornados pela listagem visivel', async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const { service } = makeService({
      risks: [
        baseRisk({ id: 'r1', probability: 5, impact: 5, dueDate: past }),
        baseRisk({ id: 'r2', status: 'CLOSED', probability: 2, impact: 2 }),
      ],
    });
    const res = await service.summary(me);
    expect(res.totalRisks).toBe(2);
    expect(res.openRisks).toBe(1);
    expect(res.criticalRisks).toBe(1);
    expect(res.overdueMitigations).toBe(1);
    expect(res.topRisks[0].id).toBe('r1');
  });

  it('getById: risco de outra empresa -> NotFound', async () => {
    const { service, prisma } = makeService({ risk: null });
    await expect(service.getById(me, 'r-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.riskRegister.findFirst.mock.calls[0][0].where.companyId).toBe('companyA');
  });

  it('getById: area nao permitida -> Forbidden', async () => {
    const { service } = makeService({ risk: baseRisk({ orgNodeId: 'areaB' }), listAreaFilter: ['areaA'] });
    await expect(service.getById(me, 'r1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create: valida vinculos da empresa e exige escrita na area resolvida', async () => {
    const { service, prisma, access } = makeService({
      indicator: { ownerNodeId: 'areaA' },
      action: { ownerNodeId: 'areaA', indicator: null },
      user: { id: 'u2' },
    });
    await service.create(me, {
      title: 'Falha no processo',
      indicatorId: 'i1',
      mitigationActionId: 'a1',
      responsibleUserId: 'u2',
      probability: 6,
      impact: 4,
    });
    expect(access.assertCanWrite).toHaveBeenCalledWith('user-1', 'areaA', 'risks', 'create');
    const data = prisma.riskRegister.create.mock.calls[0][0].data;
    expect(data.companyId).toBe('companyA');
    expect(data.createdById).toBe('user-1');
    expect(data.indicatorId).toBe('i1');
    expect(data.mitigationActionId).toBe('a1');
    expect(data.probability).toBe(5);
  });

  it('create: indicador de outra empresa -> NotFound e nao grava', async () => {
    const { service, prisma } = makeService({ indicator: null });
    await expect(service.create(me, { title: 'Risco', indicatorId: 'i-outra' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.riskRegister.create).not.toHaveBeenCalled();
  });

  it('create: vinculos em areas diferentes -> Conflict', async () => {
    const { service, prisma } = makeService({
      orgNode: { id: 'areaA' },
      indicator: { ownerNodeId: 'areaB' },
    });
    await expect(service.create(me, { title: 'Risco', orgNodeId: 'areaA', indicatorId: 'i1' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.riskRegister.create).not.toHaveBeenCalled();
  });

  it('update: nao persiste id/companyId forjados e fecha risco com closedAt', async () => {
    const { service, prisma } = makeService({ risk: baseRisk({ orgNodeId: null }) });
    await service.update(me, 'r1', { id: 'hack', companyId: 'companyB', status: 'CLOSED', title: 'Atualizado' });
    const data = prisma.riskRegister.update.mock.calls[0][0].data;
    expect(data.id).toBeUndefined();
    expect(data.companyId).toBeUndefined();
    expect(data.title).toBe('Atualizado');
    expect(data.closedAt).toBeInstanceOf(Date);
  });
});

function baseRisk(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    companyId: 'companyA',
    orgNodeId: null,
    indicatorId: null,
    projectId: null,
    mitigationActionId: null,
    responsibleUserId: null,
    createdById: 'user-1',
    title: 'Risco',
    description: null,
    category: 'OPERATIONAL',
    status: 'IDENTIFIED',
    probability: 3,
    impact: 3,
    mitigationPlan: null,
    contingencyPlan: null,
    dueDate: null,
    identifiedAt: new Date(),
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    orgNode: null,
    indicator: null,
    project: null,
    mitigationAction: null,
    responsibleUser: null,
    createdBy: null,
    ...overrides,
  };
}
