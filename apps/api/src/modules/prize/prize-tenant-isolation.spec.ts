import { describe, expect, it, vi } from 'vitest';
import { PrizeCalcService } from './prize-calc.service';
import { PrizeEligibleService } from './prize-eligible.service';
import { PrizeProgramsService } from './prize-programs.service';

const me: any = { companyId: 'company-1', sub: 'user-1', email: 'user@company.test', role: 'USER' };
const auditStub: any = { log: vi.fn(async () => undefined) };
const catalogStub: any = {};

describe('Prize tenant isolation', () => {
  it('does not grant salary visibility from a user in another company', async () => {
    const prisma: any = {
      user: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new PrizeEligibleService(prisma, auditStub, catalogStub);

    await expect(service.canSeeSalary(me)).resolves.toBe(false);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'user-1', companyId: 'company-1' },
      select: {
        permissions: { select: { permission: { select: { key: true } } } },
        accessProfile: { select: { permissions: { select: { permission: { select: { key: true } } } } } },
      },
    });
  });

  it('loads prize program snapshots with company scope', async () => {
    const created = { id: 'program-1', code: 'PRG-001', name: 'Premio', companyId: 'company-1' };
    const prisma: any = {
      prizeProgram: {
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(created),
        create: vi.fn().mockResolvedValue(created),
      },
      prizeProgramVersion: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'version-1' }),
      },
    };
    const service = new PrizeProgramsService(prisma, auditStub);

    await service.create(me, { name: 'Premio' });

    expect(prisma.prizeProgram.findFirst).toHaveBeenLastCalledWith({
      where: { id: 'program-1', companyId: 'company-1' },
    });
  });

  it('does not load an indicator parameter without company ownership', async () => {
    const prisma: any = {
      prizeCompetence: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'competence-1',
          companyId: 'company-1',
          programId: 'program-1',
          year: 2026,
          month: 6,
        }),
      },
      prizeEmployeeSnapshot: {
        findMany: vi.fn().mockResolvedValue([
          {
            registration: 'MAT-1',
            name: 'Pessoa Teste',
            baseSalary: 1000,
            workedDays: 30,
            admissionDate: null,
            blocked: false,
            eligible: true,
          },
        ]),
      },
      prizeIndicator: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'indicator-1',
            code: 'IND-1',
            name: 'Indicador',
            kind: 'COLLECTIVE',
            direction: 'HIGHER_BETTER',
            weight: 100,
            ranges: [],
            annexVersionId: null,
          },
        ]),
      },
      prizeActualResult: { findMany: vi.fn().mockResolvedValue([{ indicatorId: 'indicator-1', parameterId: 'param-other', realized: 100 }]) },
      prizeEmployeeEvent: { findMany: vi.fn().mockResolvedValue([]) },
      prizeModeratorRule: { findMany: vi.fn().mockResolvedValue([]) },
      prizeManualAdjustment: { findMany: vi.fn().mockResolvedValue([]) },
      prizeException: { findMany: vi.fn().mockResolvedValue([]) },
      prizeTemporaryAllocation: { findMany: vi.fn().mockResolvedValue([]) },
      prizeAnnexVersion: { findMany: vi.fn().mockResolvedValue([]) },
      prizeProgram: { findFirst: vi.fn().mockResolvedValue({ id: 'program-1', companyId: 'company-1', roundingRule: 'HALF_UP_2' }) },
      prizeCalculationRun: {
        aggregate: vi.fn().mockResolvedValue({ _max: { version: null } }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: 'run-1' }),
        update: vi.fn().mockResolvedValue({ id: 'run-1', status: 'SUCCESS' }),
      },
      prizeIndicatorParameter: { findFirst: vi.fn().mockResolvedValue(null) },
      prizeCalculationResult: { create: vi.fn().mockResolvedValue({ id: 'result-1' }) },
      prizeCalculationLine: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    const service = new PrizeCalcService(prisma, auditStub);

    await service.run(me, 'competence-1');

    expect(prisma.prizeProgram.findFirst).toHaveBeenCalledWith({
      where: { id: 'program-1', companyId: 'company-1' },
    });
    expect(prisma.prizeIndicatorParameter.findFirst).toHaveBeenCalledWith({
      where: { id: 'param-other', indicator: { companyId: 'company-1' } },
    });
  });
});
