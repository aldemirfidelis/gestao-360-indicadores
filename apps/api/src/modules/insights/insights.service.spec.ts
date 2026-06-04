import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRoleEnum } from '@prisma/client';
import { InsightsService } from './insights.service';
import type { AuthPayload } from '../auth/auth.types';

/** Insights (e o contexto enviado à IA) não podem incluir áreas fora do escopo. */

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(permitted: unknown) {
  const list = () => vi.fn().mockResolvedValue([]);
  const prisma = {
    indicatorResult: { findMany: list() },
    actionPlan: { count: vi.fn().mockResolvedValue(0) },
    deviation: { count: vi.fn().mockResolvedValue(0), findMany: list() },
    indicator: { findMany: list() },
  } as any;
  // IA desligada → usa apenas as regras determinísticas (sem chamar Gemini).
  const gemini = { isEnabled: false } as any;
  const access = { listAreaFilter: vi.fn().mockResolvedValue(permitted) } as any;
  const service = new InsightsService(prisma, gemini, access);
  return { service, prisma, access };
}

describe('InsightsService — respeita a área (inclusive contexto de IA)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('aplica filtro de área aos indicadores e desvios analisados', async () => {
    const { service, prisma, access } = makeService(['areaA']);
    await service.generate(me);
    expect(access.listAreaFilter).toHaveBeenCalledWith('user-1', 'insights', 'view');
    // worsening → indicator.findMany
    expect(prisma.indicator.findMany.mock.calls[0][0].where.ownerNodeId).toEqual({ in: ['areaA'] });
    // causeSuggestions → deviation.findMany filtrado pela área do indicador
    expect(prisma.deviation.findMany.mock.calls[0][0].where.indicator).toEqual({ ownerNodeId: { in: ['areaA'] } });
    // executiveSummary → indicatorResult.findMany aninhado
    expect(prisma.indicatorResult.findMany.mock.calls[0][0].where.indicator.ownerNodeId).toEqual({ in: ['areaA'] });
  });

  it('admin/diretor (null) não restringe por área', async () => {
    const { service, prisma } = makeService(null);
    await service.generate(me);
    expect(prisma.indicator.findMany.mock.calls[0][0].where.ownerNodeId).toBeUndefined();
  });
});
