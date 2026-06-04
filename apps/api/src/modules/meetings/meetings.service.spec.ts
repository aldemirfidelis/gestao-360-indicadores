import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { MeetingsService } from './meetings.service';
import type { AuthPayload } from '../auth/auth.types';

/**
 * Isolamento do módulo de reuniões (multiempresa + visibilidade por área).
 * A área da reunião é derivada do indicador associado (direto ou via desvio);
 * reuniões "gerais" (sem vínculo) não são restringidas por área.
 */

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(opts?: { meeting?: unknown; indicator?: unknown; listAreaFilter?: unknown }) {
  const prisma = {
    meeting: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(opts?.meeting ?? null),
      update: vi.fn().mockResolvedValue({ id: 'm1', companyId: 'companyA', indicatorId: null, status: 'COMPLETED', title: 't' }),
      create: vi.fn().mockResolvedValue({ id: 'm1', companyId: 'companyA', title: 't', kind: 'TRATATIVA', startsAt: new Date(), location: null }),
    },
    indicator: { findFirst: vi.fn().mockResolvedValue(opts?.indicator ?? null) },
    deviation: { findFirst: vi.fn().mockResolvedValue(null) },
    meetingParticipant: { upsert: vi.fn().mockResolvedValue({ id: 'p1' }), update: vi.fn().mockResolvedValue({ id: 'p1' }) },
  } as any;

  const traceability = { record: vi.fn().mockResolvedValue(undefined) } as any;
  const access = {
    listAreaFilter: vi.fn().mockResolvedValue(opts?.listAreaFilter ?? null),
    assertCanWrite: vi.fn().mockResolvedValue(undefined),
    visibilityLevel: vi.fn().mockResolvedValue('FULL'),
  } as any;

  const service = new MeetingsService(prisma, traceability, access);
  return { service, prisma, access, traceability };
}

describe('MeetingsService — isolamento por empresa e área', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list: filtro de área cobre reuniões gerais + reuniões da área permitida', async () => {
    const { service, prisma } = makeService({ listAreaFilter: ['areaA'] });
    await service.list(me);
    const where = prisma.meeting.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.OR).toEqual([
      { indicatorId: null, deviationId: null },
      { indicator: { ownerNodeId: { in: ['areaA'] } } },
      { deviation: { indicator: { ownerNodeId: { in: ['areaA'] } } } },
    ]);
  });

  it('list: admin/diretor (null) não aplica OR de área', async () => {
    const { service, prisma } = makeService({ listAreaFilter: null });
    await service.list(me);
    const where = prisma.meeting.findMany.mock.calls[0][0].where;
    expect(where.OR).toBeUndefined();
  });

  it('getById: reunião de outra empresa → NotFound (findFirst escopado a companyA)', async () => {
    const { service, prisma } = makeService({ meeting: null });
    await expect(service.getById(me, 'm-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.meeting.findFirst.mock.calls[0][0].where.companyId).toBe('companyA');
  });

  it('getById: reunião de área não permitida → Forbidden', async () => {
    const meeting = { id: 'm1', companyId: 'companyA', indicator: { ownerNodeId: 'areaB' }, deviation: null };
    const { service } = makeService({ meeting, listAreaFilter: ['areaA'] });
    await expect(service.getById(me, 'm1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getById: reunião geral (sem vínculo) é visível mesmo com restrição de área', async () => {
    const meeting = { id: 'm1', companyId: 'companyA', indicator: null, deviation: null };
    const { service, access } = makeService({ meeting, listAreaFilter: ['areaA'] });
    const res = await service.getById(me, 'm1');
    expect(res).toBe(meeting);
    // reunião sem área não consulta o filtro de leitura
    expect(access.listAreaFilter).not.toHaveBeenCalled();
  });

  it('update: reunião de outra empresa → NotFound (sem gravar)', async () => {
    const { service, prisma } = makeService({ meeting: null });
    await expect(service.update(me, 'm1', { title: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.meeting.update).not.toHaveBeenCalled();
  });

  it('update: enforce de área e bloqueio de troca de vínculo (não persiste companyId/indicatorId/deviationId)', async () => {
    const meeting = { id: 'm1', companyId: 'companyA', indicator: { ownerNodeId: 'areaA' }, deviation: null };
    const { service, prisma, access } = makeService({ meeting });
    await service.update(me, 'm1', { title: 'novo', companyId: 'companyB', indicatorId: 'i2', deviationId: 'd2' } as any);
    expect(access.assertCanWrite).toHaveBeenCalledWith('user-1', 'areaA', 'meetings', 'edit');
    const data = prisma.meeting.update.mock.calls[0][0].data;
    expect(data).toEqual({ title: 'novo' });
    expect(data.companyId).toBeUndefined();
    expect(data.indicatorId).toBeUndefined();
    expect(data.deviationId).toBeUndefined();
  });

  it('create: indicador de outra empresa → NotFound (não confia no id do frontend)', async () => {
    const { service, prisma } = makeService({ indicator: null });
    await expect(
      service.create(me, { title: 'R', kind: 'TRATATIVA' as any, startsAt: new Date().toISOString(), indicatorId: 'i-de-outra' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.meeting.create).not.toHaveBeenCalled();
  });

  it('create: reunião vinculada exige escrita na área do indicador', async () => {
    const { service, access } = makeService({ indicator: { ownerNodeId: 'areaA' } });
    await service.create(me, { title: 'R', kind: 'TRATATIVA' as any, startsAt: new Date().toISOString(), indicatorId: 'i1' });
    expect(access.assertCanWrite).toHaveBeenCalledWith('user-1', 'areaA', 'meetings', 'create');
  });

  it('addParticipant: reunião de outra empresa → NotFound', async () => {
    const { service, prisma } = makeService({ meeting: null });
    await expect(service.addParticipant(me, 'm1', 'u9')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.meetingParticipant.upsert).not.toHaveBeenCalled();
  });
});
