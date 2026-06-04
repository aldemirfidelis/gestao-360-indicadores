import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRoleEnum } from '@prisma/client';
import { ReportsService } from './reports.service';
import type { AuthPayload } from '../auth/auth.types';

/** Exportações NUNCA podem vazar áreas fora do escopo do usuário (anti-exfiltração). */

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(permitted: unknown) {
  const prisma = {
    indicator: { findMany: vi.fn().mockResolvedValue([]) },
    indicatorResult: { findMany: vi.fn().mockResolvedValue([]) },
    actionPlan: { findMany: vi.fn().mockResolvedValue([]) },
    deviation: { findMany: vi.fn().mockResolvedValue([]) },
  } as any;
  const access = { listAreaFilter: vi.fn().mockResolvedValue(permitted) } as any;
  const service = new ReportsService(prisma, access);
  return { service, prisma, access };
}

describe('ReportsService — exportações respeitam a área (export)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('indicatorsCsv: restringe às áreas exportáveis', async () => {
    const { service, prisma, access } = makeService(['areaA']);
    await service.indicatorsCsv(me);
    expect(access.listAreaFilter).toHaveBeenCalledWith('user-1', 'indicators', 'export');
    const where = prisma.indicator.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.ownerNodeId).toEqual({ in: ['areaA'] });
  });

  it('indicatorsCsv: admin/diretor (null) exporta tudo da empresa, sem filtro de área', async () => {
    const { service, prisma } = makeService(null);
    await service.indicatorsCsv(me);
    const where = prisma.indicator.findMany.mock.calls[0][0].where;
    expect(where.ownerNodeId).toBeUndefined();
  });

  it('resultsCsv: filtra resultados pela área do indicador', async () => {
    const { service, prisma } = makeService(['areaA']);
    await service.resultsCsv(me);
    const where = prisma.indicatorResult.findMany.mock.calls[0][0].where;
    expect(where.indicator.companyId).toBe('companyA');
    expect(where.indicator.ownerNodeId).toEqual({ in: ['areaA'] });
  });

  it('actionsCsv: filtra ações pela área do plano (ownerNodeId)', async () => {
    const { service, prisma } = makeService(['areaA']);
    await service.actionsCsv(me);
    const where = prisma.actionPlan.findMany.mock.calls[0][0].where;
    expect(where.ownerNodeId).toEqual({ in: ['areaA'] });
  });

  it('deviationsCsv: filtra desvios pela área do indicador', async () => {
    const { service, prisma } = makeService(['areaA']);
    await service.deviationsCsv(me);
    const where = prisma.deviation.findMany.mock.calls[0][0].where;
    expect(where.indicator).toEqual({ ownerNodeId: { in: ['areaA'] } });
  });

  it('sem áreas visíveis ([]) → filtro vazio (exporta nada)', async () => {
    const { service, prisma } = makeService([]);
    await service.indicatorsCsv(me);
    const where = prisma.indicator.findMany.mock.calls[0][0].where;
    expect(where.ownerNodeId).toEqual({ in: [] });
  });
});
