import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { DocumentsService } from './documents.service';
import type { AuthPayload } from '../auth/auth.types';

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(opts?: {
  docs?: unknown[];
  doc?: unknown;
  listAreaFilter?: unknown;
  orgNode?: unknown;
  indicator?: unknown;
  user?: unknown;
}) {
  const prisma: any = {
    document: {
      findMany: vi.fn().mockResolvedValue(opts?.docs ?? []),
      findFirst: vi.fn().mockResolvedValue(opts?.doc ?? null),
      create: vi.fn().mockResolvedValue({ id: 'd1', number: 1, companyId: 'companyA', title: 'Doc', status: 'PUBLISHED', type: 'PROCEDURE', version: 1, indicatorId: opts?.indicator ? 'i1' : null }),
      update: vi.fn().mockResolvedValue({ id: 'd1', number: 1, companyId: 'companyA', title: 'Doc', status: 'APPROVED', type: 'PROCEDURE', version: 1, indicatorId: null }),
    },
    orgNode: { findFirst: vi.fn().mockResolvedValue(opts?.orgNode ?? null), findMany: vi.fn().mockResolvedValue([]) },
    indicator: { findFirst: vi.fn().mockResolvedValue(opts?.indicator ?? null), findMany: vi.fn().mockResolvedValue([]) },
    user: { findFirst: vi.fn().mockResolvedValue(opts?.user ?? null), findMany: vi.fn().mockResolvedValue([]) },
  };
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));

  const traceability = { record: vi.fn().mockResolvedValue(undefined) } as any;
  const access = {
    listAreaFilter: vi.fn().mockResolvedValue(opts?.listAreaFilter ?? null),
    assertCanWrite: vi.fn().mockResolvedValue(undefined),
  } as any;

  const service = new DocumentsService(prisma, traceability, access);
  return { service, prisma, traceability, access };
}

describe('DocumentsService - gestao documental', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list: escopo de empresa + filtro de area (documentos gerais visiveis)', async () => {
    const { service, prisma } = makeService({ listAreaFilter: ['areaA'] });
    await service.list(me);
    const where = prisma.document.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.deletedAt).toBeNull();
    expect(where.AND[0].OR).toContainEqual({ orgNodeId: { in: ['areaA'] } });
    expect(where.AND[0].OR).toContainEqual({ orgNodeId: null, indicatorId: null });
  });

  it('list: status/tipo/busca sem trocar empresa', async () => {
    const { service, prisma } = makeService();
    await service.list(me, { status: 'PUBLISHED', type: 'POLICY', search: 'lgpd' });
    const where = prisma.document.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.status).toBe('PUBLISHED');
    expect(where.type).toBe('POLICY');
    expect(where.AND[0].OR[0].title).toEqual({ contains: 'lgpd', mode: 'insensitive' });
  });

  it('summary: vencidos e a vencer a partir da listagem visivel', async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const soon = new Date(Date.now() + 86400000 * 20).toISOString();
    const { service } = makeService({
      docs: [
        baseDoc({ id: 'd1', status: 'PUBLISHED', validUntil: past }),
        baseDoc({ id: 'd2', status: 'PUBLISHED', validUntil: soon }),
        baseDoc({ id: 'd3', status: 'DRAFT' }),
      ],
    });
    const res = await service.summary(me);
    expect(res.total).toBe(3);
    expect(res.published).toBe(2);
    expect(res.draft).toBe(1);
    expect(res.expired).toBe(1);
    expect(res.needsReview).toBe(1);
    expect(res.expiringSoon[0].id).toBe('d1');
  });

  it('getById: documento de outra empresa -> NotFound', async () => {
    const { service, prisma } = makeService({ doc: null });
    await expect(service.getById(me, 'd-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.document.findFirst.mock.calls[0][0].where.companyId).toBe('companyA');
  });

  it('getById: area nao permitida -> Forbidden', async () => {
    const { service } = makeService({ doc: baseDoc({ orgNodeId: 'areaB' }), listAreaFilter: ['areaA'] });
    await expect(service.getById(me, 'd1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create: valida vinculos, numera por empresa e publica com timestamps', async () => {
    const { service, prisma, access } = makeService({ indicator: { ownerNodeId: 'areaA' }, user: { id: 'u2' } });
    await service.create(me, { title: 'Politica de Seguranca', indicatorId: 'i1', ownerUserId: 'u2', status: 'PUBLISHED', type: 'POLICY' });
    expect(access.assertCanWrite).toHaveBeenCalledWith('user-1', 'areaA', 'documents', 'create');
    const data = prisma.document.create.mock.calls[0][0].data;
    expect(data.companyId).toBe('companyA');
    expect(data.number).toBe(1);
    expect(data.createdById).toBe('user-1');
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(data.approvedAt).toBeInstanceOf(Date);
  });

  it('create: indicador de outra empresa -> NotFound e nao grava', async () => {
    const { service, prisma } = makeService({ indicator: null });
    await expect(service.create(me, { title: 'Doc', indicatorId: 'i-outra' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it('create: vinculos em areas diferentes -> Conflict', async () => {
    const { service, prisma } = makeService({ orgNode: { id: 'areaA' }, indicator: { ownerNodeId: 'areaB' } });
    await expect(service.create(me, { title: 'Doc', orgNodeId: 'areaA', indicatorId: 'i1' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it('update: nao persiste id/companyId forjados e aprova com approvedAt', async () => {
    const { service, prisma } = makeService({ doc: baseDoc({ orgNodeId: null, approvedAt: null, publishedAt: null }) });
    await service.update(me, 'd1', { id: 'hack', companyId: 'companyB', status: 'APPROVED', title: 'Rev2' });
    const data = prisma.document.update.mock.calls[0][0].data;
    expect(data.id).toBeUndefined();
    expect(data.companyId).toBeUndefined();
    expect(data.title).toBe('Rev2');
    expect(data.approvedAt).toBeInstanceOf(Date);
    expect(data.publishedAt).toBeNull();
  });
});

function baseDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    companyId: 'companyA',
    number: 1,
    code: null,
    orgNodeId: null,
    indicatorId: null,
    ownerUserId: null,
    approverUserId: null,
    createdById: 'user-1',
    title: 'Doc',
    description: null,
    type: 'PROCEDURE',
    status: 'DRAFT',
    version: 1,
    content: null,
    externalUrl: null,
    changeNote: null,
    validFrom: null,
    validUntil: null,
    reviewIntervalMonths: null,
    approvedAt: null,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    orgNode: null,
    indicator: null,
    owner: null,
    approver: null,
    createdBy: null,
    ...overrides,
  };
}
