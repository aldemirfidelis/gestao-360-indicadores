import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { AssetSecurityService } from './asset-security.service';
import type { AuthPayload } from '../auth/auth.types';

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(opts?: {
  packageRow?: unknown;
  movement?: Record<string, unknown> | null;
  block?: unknown;
  listAreaFilter?: unknown;
}) {
  const baseMovement = opts?.movement === undefined
    ? {
        id: 'mov1',
        companyId: 'companyA',
        code: 'MOV-1',
        status: 'OPEN',
        entryAt: new Date('2026-06-10T10:00:00.000Z'),
        notes: null,
        evidenceRefs: null,
      }
    : opts.movement;

  const prisma: any = {
    securityPackageActivation: {
      findFirst: vi.fn().mockResolvedValue(opts?.packageRow ?? null),
    },
    securityGate: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'gate1', ...data })),
    },
    securityPost: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    securityPerson: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    securityVehicle: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    securityContractorCompany: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    securityAuthorization: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue({}) },
    securityBlocklist: { findFirst: vi.fn().mockResolvedValue(opts?.block ?? null) },
    securityAccessMovement: {
      findFirst: vi.fn().mockResolvedValue(baseMovement),
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'mov-new', ...data })),
      update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...baseMovement, ...data })),
      count: vi.fn().mockResolvedValue(0),
    },
    securityAuditLog: { create: vi.fn().mockResolvedValue({ id: 'sal1' }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'al1' }) },
    workItemIndex: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn().mockResolvedValue({ id: 'wi1' }),
    },
    orgNode: { findFirst: vi.fn().mockResolvedValue(null) },
  };

  const access = {
    listAreaFilter: vi.fn().mockResolvedValue(opts?.listAreaFilter ?? null),
    assertCanWrite: vi.fn().mockResolvedValue(undefined),
  } as any;

  return { service: new AssetSecurityService(prisma, access, { record: vi.fn().mockResolvedValue(undefined) } as any, { create: vi.fn().mockResolvedValue({}) } as any), prisma, access };
}

describe('AssetSecurityService - portarias e seguranca patrimonial', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listGates: aplica empresa, soft-delete, busca e escopo de unidade', async () => {
    const { service, prisma } = makeService({ listAreaFilter: ['unitA'] });
    await service.listGates(me, { search: 'principal' });

    const where = prisma.securityGate.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.deletedAt).toBeNull();
    expect(where.OR[0].name).toEqual({ contains: 'principal', mode: 'insensitive' });
    expect(where.AND[0].OR).toContainEqual({ unitId: null });
    expect(where.AND[0].OR).toContainEqual({ unitId: { in: ['unitA'] } });
    expect(JSON.stringify(where)).not.toContain('destinationAreaId');
  });

  it('createGate: bloqueia escrita quando pacote esta somente leitura', async () => {
    const { service, prisma } = makeService({ packageRow: { id: 'pkg1', status: 'READ_ONLY' } });

    await expect(service.createGate(me, { name: 'Portaria 1' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.securityGate.create).not.toHaveBeenCalled();
  });

  it('registerExit: encerra entrada aberta dentro da empresa e baixa pendencias', async () => {
    const { service, prisma } = makeService();
    const exitAt = '2026-06-10T12:15:00.000Z';

    const result = await service.registerExit(me, { id: 'mov1', exitAt });

    expect(prisma.securityAccessMovement.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 'mov1',
      companyId: 'companyA',
      deletedAt: null,
      status: 'OPEN',
    });
    const update = prisma.securityAccessMovement.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'mov1' });
    expect(update.data.status).toBe('CLOSED');
    expect(update.data.durationMinutes).toBe(135);
    expect(prisma.workItemIndex.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ companyId: 'companyA', sourceModule: 'asset-security', sourceEntityType: 'SecurityAccessMovement', sourceEntityId: 'mov1' }),
    }));
    expect(result.status).toBe('CLOSED');
  });

  it('registerExit: falha sem entrada aberta e nao atualiza movimento', async () => {
    const { service, prisma } = makeService({ movement: null });

    await expect(service.registerExit(me, { id: 'mov-x' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.securityAccessMovement.update).not.toHaveBeenCalled();
  });

  it('registerEntry: bloqueio ativo impede entrada sem excecao aprovada', async () => {
    const { service, prisma } = makeService({
      block: { id: 'block1', reason: 'Documento bloqueado', status: 'ACTIVE' },
    });

    await expect(service.registerEntry(me, { documentNumber: '123.456.789-00', plate: 'abc1234' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.securityBlocklist.findFirst.mock.calls[0][0].where.companyId).toBe('companyA');
    expect(prisma.securityAccessMovement.create).not.toHaveBeenCalled();
    expect(prisma.securityAuditLog.create.mock.calls[0][0].data.action).toBe('BLOCKED_ENTRY_ATTEMPT');
  });
});
