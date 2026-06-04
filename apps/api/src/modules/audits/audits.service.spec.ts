import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { AuditsService } from './audits.service';
import type { AuthPayload } from '../auth/auth.types';

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(opts?: {
  audits?: unknown[];
  audit?: unknown;
  finding?: unknown;
  listAreaFilter?: unknown;
  orgNode?: unknown;
  user?: unknown;
}) {
  const prisma: any = {
    audit: {
      findMany: vi.fn().mockResolvedValue(opts?.audits ?? []),
      findFirst: vi.fn().mockResolvedValue(opts?.audit ?? null),
      create: vi.fn().mockResolvedValue({ id: 'a1', number: 1, companyId: 'companyA', title: 'Auditoria', type: 'INTERNAL', status: 'COMPLETED', findings: [] }),
      update: vi.fn().mockResolvedValue({ id: 'a1', number: 1, companyId: 'companyA', title: 'Auditoria', type: 'INTERNAL', status: 'COMPLETED', completedAt: new Date(), findings: [] }),
    },
    auditFinding: {
      findFirst: vi.fn().mockResolvedValue(opts?.finding ?? null),
      create: vi.fn().mockResolvedValue({ id: 'f1', auditId: 'a1', type: 'NONCONFORMITY', description: 'desc', nonConformity: null }),
      update: vi.fn().mockResolvedValue({ id: 'f1', nonConformityId: 'nc1', status: 'IN_TREATMENT', nonConformity: { id: 'nc1', number: 5, title: 'NC', status: 'OPEN' } }),
      delete: vi.fn().mockResolvedValue({ id: 'f1' }),
    },
    orgNode: { findFirst: vi.fn().mockResolvedValue(opts?.orgNode ?? null), findMany: vi.fn().mockResolvedValue([]) },
    user: { findFirst: vi.fn().mockResolvedValue(opts?.user ?? null), findMany: vi.fn().mockResolvedValue([]) },
  };
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));

  const traceability = { record: vi.fn().mockResolvedValue(undefined) } as any;
  const access = {
    listAreaFilter: vi.fn().mockResolvedValue(opts?.listAreaFilter ?? null),
    assertCanWrite: vi.fn().mockResolvedValue(undefined),
  } as any;
  const nonconformities = { create: vi.fn().mockResolvedValue({ id: 'nc1', number: 5, title: 'NC gerada' }) } as any;

  const service = new AuditsService(prisma, traceability, access, nonconformities);
  return { service, prisma, access, nonconformities };
}

describe('AuditsService - auditorias e compliance', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list: escopo de empresa + filtro de area (auditorias gerais visiveis)', async () => {
    const { service, prisma } = makeService({ listAreaFilter: ['areaA'] });
    await service.list(me);
    const where = prisma.audit.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.deletedAt).toBeNull();
    expect(where.AND[0].OR).toContainEqual({ orgNodeId: { in: ['areaA'] } });
    expect(where.AND[0].OR).toContainEqual({ orgNodeId: null });
  });

  it('list: status/tipo/busca sem trocar empresa', async () => {
    const { service, prisma } = makeService();
    await service.list(me, { status: 'IN_PROGRESS', type: 'SUPPLIER', search: 'iso' });
    const where = prisma.audit.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.status).toBe('IN_PROGRESS');
    expect(where.type).toBe('SUPPLIER');
    expect(where.AND[0].OR[0].title).toEqual({ contains: 'iso', mode: 'insensitive' });
  });

  it('getById: auditoria de outra empresa -> NotFound', async () => {
    const { service, prisma } = makeService({ audit: null });
    await expect(service.getById(me, 'a-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.audit.findFirst.mock.calls[0][0].where.companyId).toBe('companyA');
  });

  it('getById: area nao permitida -> Forbidden', async () => {
    const { service } = makeService({ audit: { id: 'a1', companyId: 'companyA', orgNodeId: 'areaB', orgNode: { id: 'areaB' }, findings: [] }, listAreaFilter: ['areaA'] });
    await expect(service.getById(me, 'a1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create: valida vinculos, numera por empresa e carimba completedAt', async () => {
    const { service, prisma, access } = makeService({ orgNode: { id: 'areaA' }, user: { id: 'u2' } });
    await service.create(me, { title: 'Auditoria de processo', orgNodeId: 'areaA', leadAuditorUserId: 'u2', status: 'COMPLETED', type: 'PROCESS' });
    expect(access.assertCanWrite).toHaveBeenCalledWith('user-1', 'areaA', 'audits', 'create');
    const data = prisma.audit.create.mock.calls[0][0].data;
    expect(data.companyId).toBe('companyA');
    expect(data.number).toBe(1);
    expect(data.createdById).toBe('user-1');
    expect(data.completedAt).toBeInstanceOf(Date);
    expect(data.startedAt).toBeInstanceOf(Date);
  });

  it('addFinding: auditoria de outra empresa -> NotFound', async () => {
    const { service, prisma } = makeService({ audit: null });
    await expect(service.addFinding(me, 'a-outra', { description: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.auditFinding.create).not.toHaveBeenCalled();
  });

  it('addFinding: cria constatacao com enforce de area da auditoria', async () => {
    const { service, prisma, access } = makeService({ audit: { id: 'a1', companyId: 'companyA', number: 2, orgNodeId: 'areaA', orgNode: { id: 'areaA' }, findings: [] } });
    await service.addFinding(me, 'a1', { description: 'Falta de registro', type: 'NONCONFORMITY', severity: 'MAJOR' });
    expect(access.assertCanWrite).toHaveBeenCalledWith('user-1', 'areaA', 'audits', 'edit');
    expect(prisma.auditFinding.create.mock.calls[0][0].data.description).toBe('Falta de registro');
  });

  it('generateNonConformity: cria NC (source AUDIT) e vincula a constatacao', async () => {
    const finding = { id: 'f1', nonConformityId: null, description: 'desc', evidence: null, severity: 'MAJOR', audit: { number: 3, orgNodeId: 'areaA' } };
    const { service, prisma, nonconformities } = makeService({ finding });
    const res: any = await service.generateNonConformity(me, 'f1', {});
    expect(nonconformities.create).toHaveBeenCalled();
    expect(nonconformities.create.mock.calls[0][1].source).toBe('AUDIT');
    expect(prisma.auditFinding.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'f1' }, data: { nonConformityId: 'nc1', status: 'IN_TREATMENT' } }));
    expect(res.nonConformityId).toBe('nc1');
  });

  it('generateNonConformity: constatacao ja vinculada -> BadRequest', async () => {
    const finding = { id: 'f1', nonConformityId: 'nc-old', description: 'desc', audit: { number: 3, orgNodeId: null } };
    const { service, nonconformities } = makeService({ finding });
    await expect(service.generateNonConformity(me, 'f1', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(nonconformities.create).not.toHaveBeenCalled();
  });
});
