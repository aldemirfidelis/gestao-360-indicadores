import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { ProjectsService } from './projects.service';
import type { AuthPayload } from '../auth/auth.types';

/** Isolamento de projetos: empresa sempre; área via indicador vinculado (quando houver). */

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(opts?: { project?: unknown; milestone?: unknown; task?: unknown; indicator?: unknown; listAreaFilter?: unknown }) {
  const prisma = {
    project: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(opts?.project ?? null),
      create: vi.fn().mockResolvedValue({ id: 'p1' }),
      update: vi.fn().mockResolvedValue({ id: 'p1' }),
    },
    projectMilestone: { findFirst: vi.fn().mockResolvedValue(opts?.milestone ?? null), update: vi.fn().mockResolvedValue({ id: 'm1' }) },
    projectTask: { findFirst: vi.fn().mockResolvedValue(opts?.task ?? null), count: vi.fn().mockResolvedValue(0), delete: vi.fn().mockResolvedValue({ id: 't1' }), update: vi.fn().mockResolvedValue({ id: 't1' }) },
    indicator: { findFirst: vi.fn().mockResolvedValue(opts?.indicator ?? null) },
  } as any;
  const access = {
    listAreaFilter: vi.fn().mockResolvedValue(opts?.listAreaFilter ?? null),
    assertCanWrite: vi.fn().mockResolvedValue(undefined),
  } as any;
  const service = new ProjectsService(prisma, access);
  return { service, prisma, access };
}

describe('ProjectsService — isolamento por empresa e área', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list: filtro de área cobre projetos gerais + área permitida', async () => {
    const { service, prisma } = makeService({ listAreaFilter: ['areaA'] });
    await service.list(me);
    const where = prisma.project.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.OR).toEqual([{ indicatorId: null }, { indicator: { ownerNodeId: { in: ['areaA'] } } }]);
  });

  it('getById: projeto de outra empresa → NotFound', async () => {
    const { service, prisma } = makeService({ project: null });
    await expect(service.getById(me, 'p-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.project.findFirst.mock.calls[0][0].where.companyId).toBe('companyA');
  });

  it('getById: projeto de indicador de área não permitida → Forbidden', async () => {
    const project = { id: 'p1', companyId: 'companyA', indicator: { ownerNodeId: 'areaB' }, milestones: [], tasks: [] };
    const { service } = makeService({ project, listAreaFilter: ['areaA'] });
    await expect(service.getById(me, 'p1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getById: projeto geral (sem indicador) é visível com restrição de área', async () => {
    const project = { id: 'p1', companyId: 'companyA', indicator: null, milestones: [], tasks: [] };
    const { service, access } = makeService({ project, listAreaFilter: ['areaA'] });
    const res: any = await service.getById(me, 'p1');
    expect(res.id).toBe('p1');
    expect(access.listAreaFilter).not.toHaveBeenCalled();
  });

  it('update: projeto de outra empresa → NotFound (sem gravar)', async () => {
    const { service, prisma } = makeService({ project: null });
    await expect(service.update(me, 'p1', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('update: não persiste companyId/id forjados', async () => {
    const project = { id: 'p1', companyId: 'companyA', indicator: { ownerNodeId: 'areaA' } };
    const { service, prisma } = makeService({ project });
    await service.update(me, 'p1', { name: 'novo', companyId: 'companyB', id: 'hack' });
    const data = prisma.project.update.mock.calls[0][0].data;
    expect(data.companyId).toBeUndefined();
    expect(data.name).toBe('novo');
  });

  it('create: indicador de outra empresa → NotFound', async () => {
    const { service, prisma } = makeService({ indicator: null });
    await expect(service.create(me, { name: 'P', indicatorId: 'i-outra' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it('toggleMilestone: marco de outra empresa → NotFound', async () => {
    const { service, prisma } = makeService({ milestone: null });
    await expect(service.toggleMilestone(me, 'm-outra', true)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.projectMilestone.update).not.toHaveBeenCalled();
  });

  it('removeTask: tarefa de outra empresa → NotFound', async () => {
    const { service, prisma } = makeService({ task: null });
    await expect(service.removeTask(me, 't-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.projectTask.delete).not.toHaveBeenCalled();
  });
});
