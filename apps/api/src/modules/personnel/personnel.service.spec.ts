import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonnelService } from './personnel.service';

const me = { sub: 'admin-sem-cadastro', companyId: 'company-1', role: 'ADMIN' } as any;

describe('PersonnelService — universo do ponto', () => {
  let prisma: any;
  let service: PersonnelService;

  beforeEach(() => {
    prisma = {
      personnelEmployeeProfile: { findMany: vi.fn().mockResolvedValue([{ userId: 'user-colaborador' }]) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
      timeClockEntry: { findMany: vi.fn().mockResolvedValue([]) },
      timeAdjustmentRequest: { findMany: vi.fn().mockResolvedValue([]) },
      workScheduleAssignment: { findMany: vi.fn().mockResolvedValue([]) },
      companyHoliday: { findMany: vi.fn().mockResolvedValue([]) },
    };
    service = new PersonnelService(
      prisma,
      { record: vi.fn() } as any,
      { emit: vi.fn() } as any,
      { coverageForUsers: vi.fn().mockResolvedValue(new Map()) } as any,
      { listAreaFilter: vi.fn().mockResolvedValue(null) } as any,
      {} as any,
    );
  });

  it('lista apenas logins com cadastro de colaborador, mesmo sem filtro de área', async () => {
    await service.teamMirror(me);

    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.id).toEqual({ in: ['user-colaborador'] });
    expect(where.id.in).not.toContain(me.sub);
  });

  it('não devolve ninguém quando a empresa não tem colaborador cadastrado', async () => {
    prisma.personnelEmployeeProfile.findMany.mockResolvedValue([]);

    await service.teamMirror(me);

    expect(prisma.user.findMany.mock.calls[0][0].where.id).toEqual({ in: [] });
  });

  it('restringe o universo às áreas visíveis quando há filtro de acesso', async () => {
    const access = { listAreaFilter: vi.fn().mockResolvedValue(['node-1']) };
    service = new PersonnelService(
      prisma,
      { record: vi.fn() } as any,
      { emit: vi.fn() } as any,
      { coverageForUsers: vi.fn().mockResolvedValue(new Map()) } as any,
      access as any,
      {} as any,
    );

    await service.teamMirror(me);

    expect(prisma.personnelEmployeeProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employee: { is: { orgNodeId: { in: ['node-1'] } } } }),
      }),
    );
  });
});
