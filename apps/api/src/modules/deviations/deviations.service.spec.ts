import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { DeviationsService } from './deviations.service';
import type { AuthPayload } from '../auth/auth.types';

/**
 * Testes de isolamento do módulo de desvios (multiempresa + visibilidade por área).
 * Prisma/Access/Traceability são mockados — foco no enforcement, não na persistência.
 */

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(overrides?: {
  listAreaFilter?: unknown;
  visibilityLevel?: unknown;
  deviationFindFirst?: unknown;
}) {
  const prisma = {
    deviation: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(overrides?.deviationFindFirst ?? null),
      update: vi.fn().mockResolvedValue({ id: 'd1', companyId: 'companyA', indicatorId: 'i1', number: 1, title: 't', status: 'CLOSED' }),
    },
    deviationCause: {
      findFirst: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue({ id: 'c1' }),
    },
  } as any;

  const traceability = { record: vi.fn().mockResolvedValue(undefined) } as any;

  const access = {
    listAreaFilter: vi.fn().mockResolvedValue(overrides?.listAreaFilter ?? null),
    visibilityLevel: vi.fn().mockResolvedValue(overrides?.visibilityLevel ?? 'FULL'),
    assertCanWrite: vi.fn().mockResolvedValue(undefined),
  } as any;

  const service = new DeviationsService(prisma, traceability, access);
  return { service, prisma, traceability, access };
}

describe('DeviationsService — isolamento por empresa e área', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list: aplica o filtro de área (indicator.ownerNodeId in permitidas) e escopo de empresa', async () => {
    const { service, prisma } = makeService({ listAreaFilter: ['areaA'] });
    await service.list(me);
    const where = prisma.deviation.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.indicator).toEqual({ ownerNodeId: { in: ['areaA'] } });
  });

  it('list: sem áreas visíveis ([]) retorna vazio sem consultar o banco', async () => {
    const { service, prisma } = makeService({ listAreaFilter: [] });
    const res = await service.list(me);
    expect(res).toEqual([]);
    expect(prisma.deviation.findMany).not.toHaveBeenCalled();
  });

  it('list: admin/diretor (filtro null) não restringe por área', async () => {
    const { service, prisma } = makeService({ listAreaFilter: null });
    await service.list(me);
    const where = prisma.deviation.findMany.mock.calls[0][0].where;
    expect(where.indicator).toBeUndefined();
  });

  it('getById: desvio de OUTRA empresa não é encontrado (findFirst escopado retorna null)', async () => {
    const { service, prisma } = makeService({ deviationFindFirst: null });
    await expect(service.getById(me, 'd-de-outra-empresa')).rejects.toBeInstanceOf(NotFoundException);
    // a consulta sempre carrega companyId da sessão
    expect(prisma.deviation.findFirst.mock.calls[0][0].where.companyId).toBe('companyA');
  });

  it('getById: área não permitida → Forbidden', async () => {
    const dev = baseDeviation('areaB');
    const { service } = makeService({ deviationFindFirst: dev, listAreaFilter: ['areaA'] });
    await expect(service.getById(me, 'd1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getById: nível SUMMARY retorna projeção resumida (oculta fato/causas)', async () => {
    const dev = baseDeviation('areaA');
    const { service } = makeService({ deviationFindFirst: dev, listAreaFilter: ['areaA'], visibilityLevel: 'SUMMARY' });
    const res: any = await service.getById(me, 'd1');
    expect(res.summary).toBe(true);
    expect(res.fact).toBeUndefined();
    expect(res._count).toEqual({ causes: 0, analyses: 0, actions: 0 });
  });

  it('update: valida empresa+área antes de gravar (assertCanWrite com a área do indicador)', async () => {
    const dev = { id: 'd1', companyId: 'companyA', indicatorId: 'i1', number: 1, status: 'OPEN', indicator: { ownerNodeId: 'areaA' } };
    const { service, access } = makeService({ deviationFindFirst: dev });
    await service.update(me, 'd1', { title: 'novo' } as any);
    expect(access.assertCanWrite).toHaveBeenCalledWith('user-1', 'areaA', 'deviations', 'edit');
  });

  it('update: desvio inexistente/outra empresa → NotFound (sem gravar)', async () => {
    const { service, prisma } = makeService({ deviationFindFirst: null });
    await expect(service.update(me, 'd1', {} as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.deviation.update).not.toHaveBeenCalled();
  });

  it('removeCause: causa de desvio de outra empresa → NotFound', async () => {
    const { service, prisma } = makeService();
    prisma.deviationCause.findFirst.mockResolvedValue(null);
    await expect(service.removeCause(me, 'c-outra-empresa')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.deviationCause.delete).not.toHaveBeenCalled();
  });
});

function baseDeviation(ownerNodeId: string) {
  return {
    id: 'd1',
    companyId: 'companyA',
    number: 1,
    title: 'Desvio',
    periodRef: '2026-01',
    severity: 'MODERATE',
    status: 'OPEN',
    method: 'FCA',
    fact: 'fato sensível',
    rootCause: 'causa raiz sensível',
    impact: 'impacto',
    dueDate: null,
    openedAt: new Date(),
    closedAt: null,
    indicator: { id: 'i1', name: 'Ind', code: 'IND-1', ownerNodeId },
    responsibleUser: { id: 'u2', name: 'Resp' },
    causes: [],
    analyses: [],
    actions: [],
  };
}
