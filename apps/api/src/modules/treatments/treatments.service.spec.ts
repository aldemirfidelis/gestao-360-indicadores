import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AnalysisMethod, UserRoleEnum } from '@prisma/client';
import { TreatmentsService } from './treatments.service';
import type { AuthPayload } from '../auth/auth.types';

/**
 * A tratativa é o hub do fluxo de indicador fora da meta. Isolamento por empresa
 * (via indicador) + área (regras do módulo de desvios).
 */

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(opts?: { treatment?: unknown; result?: unknown; listAreaFilter?: unknown; assertThrows?: boolean }) {
  const prisma = {
    treatmentCase: {
      findFirst: vi.fn().mockResolvedValue(opts?.treatment ?? null),
      update: vi.fn().mockResolvedValue({ id: 't1', title: 'T' }),
      upsert: vi.fn().mockResolvedValue({ id: 't1', title: 'T', status: 'AWAITING_CAUSE_ANALYSIS' }),
    },
    indicatorResult: { findFirst: vi.fn().mockResolvedValue(opts?.result ?? null) },
    deviation: { create: vi.fn().mockResolvedValue({ id: 'd1' }), update: vi.fn(), findFirst: vi.fn().mockResolvedValue({ number: 0 }) },
    deviationCause: { create: vi.fn().mockResolvedValue({ id: 'c1' }) },
    deviationAnalysis: { create: vi.fn().mockResolvedValue({ id: 'an1' }) },
  } as any;
  const traceability = { record: vi.fn().mockResolvedValue(undefined) } as any;
  const access = {
    listAreaFilter: vi.fn().mockResolvedValue(opts?.listAreaFilter ?? null),
    assertCanWrite: opts?.assertThrows
      ? vi.fn().mockRejectedValue(new ForbiddenException('sem área'))
      : vi.fn().mockResolvedValue(undefined),
  } as any;
  const service = new TreatmentsService(prisma, traceability, access);
  return { service, prisma, access };
}

const treatmentCtx = (ownerNodeId: string | null) => ({
  id: 't1',
  companyId: 'companyA',
  indicatorId: 'i1',
  periodRef: '2026-06',
  deviationId: null,
  analysisId: null,
  meetingId: null,
  actions: [],
  indicator: { id: 'i1', name: 'Ind', ownerNodeId, responsibleUserId: 'u2', targets: [], ownerNode: { id: ownerNodeId } },
  result: null,
});

describe('TreatmentsService — isolamento por empresa e área', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getById: tratativa de outra empresa → NotFound', async () => {
    const { service, prisma } = makeService({ treatment: null });
    await expect(service.getById(me, 't-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.treatmentCase.findFirst.mock.calls[0][0].where.companyId).toBe('companyA');
  });

  it('getById: tratativa de área não permitida → Forbidden', async () => {
    const { service } = makeService({ treatment: treatmentCtx('areaB'), listAreaFilter: ['areaA'] });
    await expect(service.getById(me, 't1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('startFromResult: resultado de outra empresa → NotFound (sem criar tratativa)', async () => {
    const { service, prisma } = makeService({ result: null });
    await expect(service.startFromResult(me, 'r-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.treatmentCase.upsert).not.toHaveBeenCalled();
  });

  it('createAnalysis: sem direito de escrita na área → bloqueia antes de criar o desvio', async () => {
    const { service, prisma } = makeService({ treatment: treatmentCtx('areaB'), assertThrows: true });
    await expect(
      service.createAnalysis(me, 't1', { problem: 'p', rootCause: 'r', method: AnalysisMethod.FCA }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.deviation.create).not.toHaveBeenCalled();
  });

  it('createAnalysis: tratativa de outra empresa → NotFound', async () => {
    const { service } = makeService({ treatment: null });
    await expect(
      service.createAnalysis(me, 't-outra', { problem: 'p', rootCause: 'r', method: AnalysisMethod.FCA }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
