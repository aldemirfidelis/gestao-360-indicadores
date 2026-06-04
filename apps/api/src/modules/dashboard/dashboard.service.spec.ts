import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRoleEnum } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import type { AuthPayload } from '../auth/auth.types';

/** O dashboard agrega apenas as áreas visíveis ao usuário (sem vazar agregado). */

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(permitted: unknown) {
  const zero = () => vi.fn().mockResolvedValue(0);
  const list = () => vi.fn().mockResolvedValue([]);
  const prisma = {
    indicator: { count: zero(), findMany: list() },
    indicatorResult: { findMany: list(), count: zero() },
    actionPlan: { count: zero(), findMany: list() },
    deviation: { count: zero(), findMany: list(), groupBy: list() },
    meeting: { count: zero() },
    treatmentCase: { count: zero(), findMany: list() },
    orgNode: { findMany: list() },
  } as any;
  const periods = {
    currentMonthlyRef: vi.fn().mockResolvedValue('2026-06'),
    currentAnchorDate: vi.fn().mockResolvedValue(new Date('2026-06-30T12:00:00Z')),
  } as any;
  const access = { listAreaFilter: vi.fn().mockResolvedValue(permitted) } as any;
  const service = new DashboardService(prisma, periods, access);
  return { service, prisma };
}

describe('DashboardService — agregados respeitam a área', () => {
  beforeEach(() => vi.clearAllMocks());

  it('overview: conta indicadores e desvios só das áreas permitidas', async () => {
    const { service, prisma } = makeService(['areaA']);
    await service.overview(me);
    const indWhere = prisma.indicator.count.mock.calls[0][0].where;
    expect(indWhere.ownerNodeId).toEqual({ in: ['areaA'] });
    const devWhere = prisma.deviation.count.mock.calls[0][0].where;
    expect(devWhere.indicator).toEqual({ ownerNodeId: { in: ['areaA'] } });
  });

  it('ranking: restringe os indicadores às áreas permitidas', async () => {
    const { service, prisma } = makeService(['areaA']);
    await service.ranking(me);
    expect(prisma.indicator.findMany.mock.calls[0][0].where.ownerNodeId).toEqual({ in: ['areaA'] });
  });

  it('worst: filtra pelos indicadores das áreas permitidas', async () => {
    const { service, prisma } = makeService(['areaA']);
    await service.worst(me);
    expect(prisma.indicatorResult.findMany.mock.calls[0][0].where.indicator.ownerNodeId).toEqual({ in: ['areaA'] });
  });

  it('pendingFillCount: conta pendências só das áreas permitidas', async () => {
    const { service, prisma } = makeService(['areaA']);
    await service.pendingFillCount(me);
    expect(prisma.indicator.count.mock.calls[0][0].where.ownerNodeId).toEqual({ in: ['areaA'] });
  });

  it('admin/diretor (null) não aplica filtro de área', async () => {
    const { service, prisma } = makeService(null);
    await service.ranking(me);
    expect(prisma.indicator.findMany.mock.calls[0][0].where.ownerNodeId).toBeUndefined();
  });
});
