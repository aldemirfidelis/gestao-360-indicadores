import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { ResultsService } from './results.service';
import type { AuthPayload } from '../auth/auth.types';

/**
 * Isolamento dos lançamentos de resultados. A área segue a do indicador dono.
 * Fluxo de usuário (upsert) aplica área; fluxo de integração (upsertSystem)
 * mantém só o isolamento por empresa.
 */

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(opts?: {
  indicator?: unknown;
  result?: unknown;
  listAreaFilter?: unknown;
  assertThrows?: boolean;
}) {
  const prisma = {
    indicator: {
      findFirst: vi.fn().mockResolvedValue(opts?.indicator ?? null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    indicatorTarget: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null) },
    indicatorResult: {
      findFirst: vi.fn().mockResolvedValue(opts?.result ?? null),
      upsert: vi.fn().mockResolvedValue({ id: 'r1' }),
      update: vi.fn().mockResolvedValue({ id: 'r1' }),
    },
    closedMonth: { findMany: vi.fn().mockResolvedValue([]) },
  } as any;

  const traceability = { record: vi.fn().mockResolvedValue(undefined) } as any;
  const periods = {
    current: vi.fn().mockResolvedValue({ year: 2026 }),
    currentAnchorDate: vi.fn().mockResolvedValue(new Date('2026-06-30T12:00:00Z')),
  } as any;
  const closedMonths = { isMonthClosed: vi.fn().mockResolvedValue(false) } as any;
  const access = {
    listAreaFilter: vi.fn().mockResolvedValue(opts?.listAreaFilter ?? null),
    assertCanWrite: opts?.assertThrows
      ? vi.fn().mockRejectedValue(new ForbiddenException('sem área'))
      : vi.fn().mockResolvedValue(undefined),
  } as any;

  const service = new ResultsService(prisma, traceability, periods, closedMonths, access);
  return { service, prisma, access };
}

describe('ResultsService — isolamento por empresa e área', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pendingByCompany: restringe os indicadores às áreas permitidas', async () => {
    const { service, prisma } = makeService({ listAreaFilter: ['areaA'] });
    await service.pendingByCompany(me, {});
    const where = prisma.indicator.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.ownerNodeId).toEqual({ in: ['areaA'] });
  });

  it('pendingByCompany: filtro de área pedido fora do escopo → vazio sem consultar', async () => {
    const { service, prisma } = makeService({ listAreaFilter: ['areaA'] });
    const res = await service.pendingByCompany(me, { ownerNodeId: 'areaB' });
    expect(res).toEqual([]);
    expect(prisma.indicator.findMany).not.toHaveBeenCalled();
  });

  it('grainByMonth: indicador de área não permitida → Forbidden', async () => {
    const { service } = makeService({ indicator: { id: 'i1', ownerNodeId: 'areaB', ownerNode: { id: 'areaB', name: 'B' }, periodicity: 'MONTHLY' }, listAreaFilter: ['areaA'] });
    await expect(service.grainByMonth(me, 'i1', 'MONTHLY', '2026-06')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('upsert: indicador de outra empresa → NotFound (sem gravar)', async () => {
    const { service, prisma } = makeService({ indicator: null });
    await expect(service.upsert(me, { indicatorId: 'i-outra', periodRef: '2026-06', value: 1 } as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.indicatorResult.upsert).not.toHaveBeenCalled();
    expect(prisma.indicator.findFirst.mock.calls[0][0].where.companyId).toBe('companyA');
  });

  it('upsert: sem direito de escrita na área → bloqueia antes de gravar', async () => {
    const { service, prisma } = makeService({ indicator: { id: 'i1', companyId: 'companyA', ownerNodeId: 'areaB' }, assertThrows: true });
    await expect(service.upsert(me, { indicatorId: 'i1', periodRef: '2026-06', value: 1 } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.indicatorResult.upsert).not.toHaveBeenCalled();
  });

  it('upsertSystem: integração mantém isolamento por empresa mas NÃO consulta área', async () => {
    const { service, prisma, access } = makeService({ indicator: null });
    await expect(service.upsertSystem('companyA', { indicatorId: 'i1', periodRef: '2026-06', value: 1 } as any, 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.indicator.findFirst.mock.calls[0][0].where.companyId).toBe('companyA');
    expect(access.assertCanWrite).not.toHaveBeenCalled();
  });

  it('approve: resultado de outra empresa → NotFound', async () => {
    const { service, prisma } = makeService({ result: null });
    await expect(service.approve(me, 'r-outra', true)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.indicatorResult.update).not.toHaveBeenCalled();
  });
});
