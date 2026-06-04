import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { OkrsService } from './okrs.service';
import type { AuthPayload } from '../auth/auth.types';

/** OKRs não têm área: o isolamento é puramente por EMPRESA (via ciclo). */

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(opts?: { cycle?: unknown; objective?: unknown; keyResult?: unknown }) {
  const prisma = {
    oKRCycle: { findFirst: vi.fn().mockResolvedValue(opts?.cycle ?? null) },
    oKRObjective: {
      findFirst: vi.fn().mockResolvedValue(opts?.objective ?? null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'o1' }),
      update: vi.fn().mockResolvedValue({ id: 'o1' }),
    },
    keyResult: {
      findFirst: vi.fn().mockResolvedValue(opts?.keyResult ?? null),
      create: vi.fn().mockResolvedValue({ id: 'k1' }),
      update: vi.fn().mockResolvedValue({ id: 'k1' }),
      delete: vi.fn().mockResolvedValue({ id: 'k1' }),
    },
    oKRCheckin: { create: vi.fn().mockResolvedValue({ id: 'c1' }) },
    strategicObjective: { count: vi.fn().mockResolvedValue(0) },
  } as any;

  const service = new OkrsService(prisma);
  return { service, prisma };
}

describe('OkrsService — isolamento por empresa', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listObjectives: ciclo de outra empresa → NotFound', async () => {
    const { service, prisma } = makeService({ cycle: null });
    await expect(service.listObjectives(me, 'cycle-de-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.oKRObjective.findMany).not.toHaveBeenCalled();
  });

  it('getObjective: objetivo de outra empresa → NotFound (filtro cycle.companyId)', async () => {
    const { service, prisma } = makeService({ objective: null });
    await expect(service.getObjective(me, 'o-de-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.oKRObjective.findFirst.mock.calls[0][0].where.cycle).toEqual({ companyId: 'companyA' });
  });

  it('createObjective: ciclo de outra empresa → NotFound (sem criar)', async () => {
    const { service, prisma } = makeService({ cycle: null });
    await expect(service.createObjective(me, 'cycle-de-outra', { name: 'O' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.oKRObjective.create).not.toHaveBeenCalled();
  });

  it('updateObjective: bloqueia troca de ciclo/id e exige objetivo da empresa', async () => {
    const { service, prisma } = makeService({ objective: { id: 'o1' } });
    await service.updateObjective(me, 'o1', { name: 'novo', cycleId: 'outro', id: 'hack' });
    const data = prisma.oKRObjective.update.mock.calls[0][0].data;
    expect(data).toEqual({ name: 'novo' });
  });

  it('removeKeyResult: KR de outra empresa → NotFound (sem deletar)', async () => {
    const { service, prisma } = makeService({ keyResult: null });
    await expect(service.removeKeyResult(me, 'k-de-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.keyResult.delete).not.toHaveBeenCalled();
  });

  it('checkin: objetivo de outra empresa → NotFound (sem registrar)', async () => {
    const { service, prisma } = makeService({ objective: null });
    await expect(service.checkin(me, 'o-de-outra', { weekRef: '2026-W01', confidence: 0.5, progress: 0.2 })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.oKRCheckin.create).not.toHaveBeenCalled();
  });
});
