import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { DocumentDistributionService } from './document-distribution.service';
import type { AuthPayload } from '../auth/auth.types';

const me: AuthPayload = { sub: 'u1', email: 'u1@x.com', name: 'Ana', role: UserRoleEnum.ANALYST, companyId: 'companyA' };

function makeDistribution(opts: { targets?: any[]; existing?: any[]; inactive?: string[]; doc?: any } = {}) {
  const prisma: any = {
    documentDistribution: {
      findMany: vi.fn().mockResolvedValue(opts.targets ?? [{ userId: 'u2' }, { orgNodeId: 'areaA' }, { groupId: 'g1' }]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findMany: vi.fn(async ({ where }: any) => {
        if (where?.defaultNodeId) return [{ id: 'u3' }];
        const ids: string[] = where?.id?.in ?? [];
        return ids.filter((id) => !(opts.inactive ?? []).includes(id)).map((id) => ({ id, name: id.toUpperCase(), email: '' }));
      }),
      count: vi.fn(async ({ where }: any) => (where?.id?.in ?? []).length),
    },
    userAreaAssignment: { findMany: vi.fn().mockResolvedValue([{ userId: 'u4' }]) },
    documentAccessGroup: { findMany: vi.fn().mockResolvedValue([{ id: 'g1', name: 'Brigada' }]), count: vi.fn().mockResolvedValue(1) },
    documentAccessGroupUser: { findMany: vi.fn().mockResolvedValue([{ userId: 'u5' }, { userId: 'u9' }]) },
    orgNode: { findMany: vi.fn().mockResolvedValue([{ id: 'areaA', name: 'Produção' }]), count: vi.fn().mockResolvedValue(1) },
    document: {
      findFirst: vi.fn().mockResolvedValue(opts.doc ?? { id: 'd1', companyId: 'companyA', code: 'POP-001', number: 1, title: 'Higienização', status: 'PUBLISHED', readRequired: true, readDueDays: 5 }),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    documentVersion: {
      findFirst: vi.fn().mockResolvedValue({ id: 'v1', versionLabel: 'Rev. 01', publicationDate: new Date() }),
    },
    documentReadConfirmation: {
      findMany: vi.fn().mockResolvedValue(opts.existing ?? []),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(async ({ data }: any) => ({ id: 'rc1', ...data })),
      create: vi.fn(async ({ data }: any) => ({ id: 'rc-new', ...data })),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    documentAuditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));
  const access = { expandWithDescendants: vi.fn(async (_c: string, ids: string[]) => [...ids, 'areaA-1']) } as any;
  const notifications = { create: vi.fn().mockResolvedValue({}) } as any;
  const workItems = { markDirty: vi.fn() } as any;
  return { service: new DocumentDistributionService(prisma, access, notifications, workItems), prisma, notifications, access, workItems };
}

describe('DocumentDistributionService - leitura obrigatória', () => {
  beforeEach(() => vi.clearAllMocks());

  it('público-alvo: pessoas + áreas (com setores filhos) + grupos, só ativos', async () => {
    const { service, access } = makeDistribution({ inactive: ['u9'] });
    const users = await service.resolveUsers('companyA', 'd1');
    expect(access.expandWithDescendants).toHaveBeenCalledWith('companyA', ['areaA']);
    expect(users.sort()).toEqual(['u2', 'u3', 'u4', 'u5']);
  });

  it('distribui só para quem ainda não tem leitura da revisão vigente, com prazo', async () => {
    const { service, prisma, notifications } = makeDistribution({ existing: [{ userId: 'u2' }] });
    const created = await service.syncAssignments('companyA', 'd1');
    expect(created).toBe(4);
    const rows = prisma.documentReadConfirmation.createMany.mock.calls[0][0].data;
    expect(rows.map((row: any) => row.userId).sort()).toEqual(['u3', 'u4', 'u5', 'u9']);
    expect(rows.every((row: any) => row.status === 'PENDING' && row.versionId === 'v1')).toBe(true);
    const days = Math.round((rows[0].dueAt.getTime() - Date.now()) / 86_400_000);
    expect(days).toBe(5);
    expect(notifications.create).toHaveBeenCalledTimes(4);
    expect(notifications.create.mock.calls[0][5]).toBe('/documents/d1/leitor');
  });

  it('documento sem leitura obrigatória ou não vigente não distribui', async () => {
    const { service, prisma } = makeDistribution({ doc: { id: 'd1', status: 'DRAFT', readRequired: true } });
    expect(await service.syncAssignments('companyA', 'd1')).toBe(0);
    expect(prisma.documentReadConfirmation.createMany).not.toHaveBeenCalled();
  });

  it('confirmação: fecha a leitura pendente da revisão vigente', async () => {
    const { service, prisma } = makeDistribution();
    prisma.documentReadConfirmation.findFirst = vi.fn().mockResolvedValue({ id: 'rc1', status: 'PENDING' });
    const result = await service.confirm(me, { id: 'd1', status: 'PUBLISHED' });
    expect(prisma.documentReadConfirmation.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'rc1' }, data: expect.objectContaining({ status: 'CONFIRMED' }) }));
    expect(result.versionLabel).toBe('Rev. 01');
    expect(prisma.documentAuditLog.create).toHaveBeenCalled();
  });

  it('confirmação só vale para documento vigente', async () => {
    const { service } = makeDistribution();
    await expect(service.confirm(me, { id: 'd1', status: 'IN_REVIEW' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('leitura obrigatória exige público-alvo', async () => {
    const { service } = makeDistribution();
    await expect(service.setDistribution(me, { id: 'd1', status: 'DRAFT' }, { readRequired: true })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resumo: adesão e atrasos da revisão vigente', async () => {
    const past = new Date(Date.now() - 86_400_000);
    const { service } = makeDistribution({
      existing: [
        { userId: 'u2', status: 'CONFIRMED', confirmedAt: new Date(), readAt: new Date() },
        { userId: 'u3', status: 'PENDING', dueAt: past },
        { userId: 'u4', status: 'PENDING', dueAt: new Date(Date.now() + 86_400_000) },
        { userId: 'u5', status: 'CONFIRMED', confirmedAt: new Date(), readAt: new Date() },
      ],
    });
    const summary = await service.summary('companyA', { id: 'd1', readRequired: true, readDueDays: 5 }, 'u3');
    expect(summary).toMatchObject({ total: 4, confirmed: 2, pending: 2, overdue: 1, adhesion: 50 });
    expect(summary.mine).toMatchObject({ status: 'PENDING' });
  });
});
