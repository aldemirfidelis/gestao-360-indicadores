import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRoleEnum } from '@prisma/client';
import { SearchService } from './search.service';
import type { AuthPayload } from '../auth/auth.types';

/** A busca global não pode retornar registros de áreas fora do escopo do usuário. */

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(permitted: unknown) {
  const empty = vi.fn().mockResolvedValue([]);
  const prisma = {
    indicator: { findMany: vi.fn().mockResolvedValue([]) },
    orgNode: { findMany: vi.fn().mockResolvedValue([]) },
    actionPlan: { findMany: vi.fn().mockResolvedValue([]) },
    deviation: { findMany: vi.fn().mockResolvedValue([]) },
    meeting: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: empty },
    strategicObjective: { findMany: vi.fn().mockResolvedValue([]) },
  } as any;
  const access = { listAreaFilter: vi.fn().mockResolvedValue(permitted) } as any;
  const service = new SearchService(prisma, access);
  return { service, prisma, access };
}

describe('SearchService — busca respeita a área', () => {
  beforeEach(() => vi.clearAllMocks());

  it('termo curto retorna vazio sem consultar', async () => {
    const { service, prisma, access } = makeService(['areaA']);
    const res = await service.global(me, 'a');
    expect(res).toEqual([]);
    expect(prisma.indicator.findMany).not.toHaveBeenCalled();
    expect(access.listAreaFilter).not.toHaveBeenCalled();
  });

  it('aplica filtro de área por domínio quando restrito', async () => {
    const { service, prisma } = makeService(['areaA']);
    await service.global(me, 'meta');
    expect(prisma.indicator.findMany.mock.calls[0][0].where.ownerNodeId).toEqual({ in: ['areaA'] });
    expect(prisma.actionPlan.findMany.mock.calls[0][0].where.ownerNodeId).toEqual({ in: ['areaA'] });
    expect(prisma.deviation.findMany.mock.calls[0][0].where.indicator).toEqual({ ownerNodeId: { in: ['areaA'] } });
    expect(prisma.orgNode.findMany.mock.calls[0][0].where.id).toEqual({ in: ['areaA'] });
    // reuniões: cláusula de área dentro do AND (gerais + área permitida)
    const meetingAnd = prisma.meeting.findMany.mock.calls[0][0].where.AND;
    expect(meetingAnd).toHaveLength(2);
    expect(meetingAnd[1].OR).toContainEqual({ indicator: { ownerNodeId: { in: ['areaA'] } } });
  });

  it('admin/diretor (null) não restringe por área', async () => {
    const { service, prisma } = makeService(null);
    await service.global(me, 'meta');
    expect(prisma.indicator.findMany.mock.calls[0][0].where.ownerNodeId).toBeUndefined();
    expect(prisma.meeting.findMany.mock.calls[0][0].where.AND).toHaveLength(1);
  });
});
