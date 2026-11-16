import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { ProjectsService } from './projects.service';
import type { AuthPayload } from '../auth/auth.types';

/** Isolamento de projetos: empresa sempre; area via indicador vinculado (quando houver). */

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(opts?: {
  project?: unknown;
  projects?: unknown[];
  milestone?: unknown;
  task?: unknown;
  indicator?: unknown;
  indicators?: unknown[];
  listAreaFilter?: unknown;
}) {
  const prisma = {
    project: {
      findMany: vi.fn().mockResolvedValue(opts?.projects ?? []),
      findFirst: vi.fn().mockResolvedValue(opts?.project ?? null),
      findUniqueOrThrow: vi.fn().mockResolvedValue(opts?.project ?? { tasks: [], milestones: [] }),
      create: vi.fn().mockResolvedValue({ id: 'p1' }),
      update: vi.fn().mockResolvedValue({ id: 'p1' }),
    },
    projectMilestone: {
      create: vi.fn().mockResolvedValue({ id: 'm1' }),
      findFirst: vi.fn().mockResolvedValue(opts?.milestone ?? null),
      update: vi.fn().mockResolvedValue({ id: 'm1' }),
    },
    projectTask: {
      create: vi.fn().mockResolvedValue({ id: 't1' }),
      findFirst: vi.fn().mockResolvedValue(opts?.task ?? null),
      count: vi.fn().mockResolvedValue(0),
      delete: vi.fn().mockResolvedValue({ id: 't1' }),
      update: vi.fn().mockResolvedValue({ id: 't1' }),
    },
    indicator: {
      findFirst: vi.fn().mockResolvedValue(opts?.indicator ?? null),
      findMany: vi.fn().mockResolvedValue(opts?.indicators ?? []),
    },
    projectProgressSnapshot: { upsert: vi.fn().mockResolvedValue({ id: 's1' }) },
    $queryRaw: vi.fn().mockResolvedValue([{ id: 'p1' }]),
    $transaction: vi.fn(),
  } as any;
  prisma.$transaction.mockImplementation((callback: (tx: any) => unknown) => callback(prisma));
  const access = {
    listAreaFilter: vi.fn().mockResolvedValue(opts?.listAreaFilter ?? null),
    assertCanWrite: vi.fn().mockResolvedValue(undefined),
  } as any;
  const service = new ProjectsService(prisma, access);
  return { service, prisma, access };
}

describe('ProjectsService - isolamento e PMO', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list: filtro de area cobre projetos gerais + area permitida', async () => {
    const { service, prisma } = makeService({ listAreaFilter: ['areaA'] });
    await service.list(me);
    const where = prisma.project.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.AND).toContainEqual({ OR: [{ indicatorId: null }, { indicator: { ownerNodeId: { in: ['areaA'] } } }] });
  });

  it('list: aplica filtros de indicador, status e busca sem trocar empresa', async () => {
    const { service, prisma } = makeService({ listAreaFilter: null });
    await service.list(me, { indicatorId: 'i1', status: 'IN_PROGRESS' as any, search: 'obra' });
    const where = prisma.project.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.indicatorId).toBe('i1');
    expect(where.status).toBe('IN_PROGRESS');
    expect(where.AND[0].OR[0].name).toEqual({ contains: 'obra', mode: 'insensitive' });
  });

  it('portfolio: consolida portfolio e identifica projeto critico', async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const future = new Date(Date.now() + 86400000 * 5).toISOString();
    const { service } = makeService({
      projects: [
        {
          id: 'p1',
          name: 'Projeto critico',
          status: 'IN_PROGRESS',
          startsAt: past,
          endsAt: past,
          budget: 1000,
          responsible: 'Ana',
          milestones: [{ id: 'm1', done: false, dueDate: past }],
          tasks: [{ progress: 20, endDate: past }],
          _count: { tasks: 1, milestones: 1 },
          indicator: { id: 'i1', name: 'KPI', code: 'K1' },
        },
        {
          id: 'p2',
          name: 'Projeto ok',
          status: 'PLANNED',
          startsAt: past,
          endsAt: future,
          budget: 500,
          milestones: [],
          tasks: [],
          _count: { tasks: 0, milestones: 0 },
          indicator: null,
        },
      ],
    });
    const res = await service.portfolio(me);
    expect(res.totalProjects).toBe(2);
    expect(res.activeProjects).toBe(2);
    expect(res.budgetTotal).toBe(1500);
    expect(res.milestonesOverdue).toBe(1);
    expect(res.tasksOverdue).toBe(1);
    expect(res.criticalProjects[0].id).toBe('p1');
  });

  it('portfolio: respeita filtros do recorte executivo', async () => {
    const { service, prisma } = makeService({ listAreaFilter: null });
    await service.portfolio(me, { indicatorId: 'i1', status: 'IN_PROGRESS' as any, search: 'obra' });
    const where = prisma.project.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.indicatorId).toBe('i1');
    expect(where.status).toBe('IN_PROGRESS');
    expect(where.AND[0].OR[0].name).toEqual({ contains: 'obra', mode: 'insensitive' });
  });

  it('listIndicators: restringe opcoes de KPI a area visivel', async () => {
    const { service, prisma } = makeService({ listAreaFilter: ['areaA'] });
    await service.listIndicators(me);
    const where = prisma.indicator.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.ownerNodeId).toEqual({ in: ['areaA'] });
  });

  it('getById: projeto de outra empresa -> NotFound', async () => {
    const { service, prisma } = makeService({ project: null });
    await expect(service.getById(me, 'p-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.project.findFirst.mock.calls[0][0].where.companyId).toBe('companyA');
  });

  it('getById: projeto de indicador de area nao permitida -> Forbidden', async () => {
    const project = { id: 'p1', companyId: 'companyA', indicator: { ownerNodeId: 'areaB' }, milestones: [], tasks: [] };
    const { service } = makeService({ project, listAreaFilter: ['areaA'] });
    await expect(service.getById(me, 'p1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getById: projeto geral (sem indicador) e visivel com restricao de area', async () => {
    const project = { id: 'p1', companyId: 'companyA', indicator: null, milestones: [], tasks: [] };
    const { service, access } = makeService({ project, listAreaFilter: ['areaA'] });
    const res: any = await service.getById(me, 'p1');
    expect(res.id).toBe('p1');
    expect(access.listAreaFilter).not.toHaveBeenCalled();
  });

  it('update: projeto de outra empresa -> NotFound (sem gravar)', async () => {
    const { service, prisma } = makeService({ project: null });
    await expect(service.update(me, 'p1', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('update: nao persiste companyId/id forjados', async () => {
    const project = { id: 'p1', companyId: 'companyA', indicator: { ownerNodeId: 'areaA' } };
    const { service, prisma } = makeService({ project });
    await service.update(me, 'p1', { name: 'novo', companyId: 'companyB', id: 'hack', company: { connect: { id: 'companyB' } }, progressSnapshots: { deleteMany: {} } });
    const data = prisma.project.update.mock.calls[0][0].data;
    expect(data.companyId).toBeUndefined();
    expect(data.company).toBeUndefined();
    expect(data.progressSnapshots).toBeUndefined();
    expect(data.name).toBe('novo');
  });

  it('create: indicador de outra empresa -> NotFound', async () => {
    const { service, prisma } = makeService({ indicator: null });
    await expect(service.create(me, { name: 'P', indicatorId: 'i-outra' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it('toggleMilestone: marco de outra empresa -> NotFound', async () => {
    const { service, prisma } = makeService({ milestone: null });
    await expect(service.toggleMilestone(me, 'm-outra', true)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.projectMilestone.update).not.toHaveBeenCalled();
  });

  it('removeTask: tarefa de outra empresa -> NotFound', async () => {
    const { service, prisma } = makeService({ task: null });
    await expect(service.removeTask(me, 't-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.projectTask.delete).not.toHaveBeenCalled();
  });

  it('updateTask: grava avanço e medição no mesmo dia em uma transação com bloqueio do projeto', async () => {
    const { service, prisma } = makeService({
      task: { id: 't1', projectId: 'p1', project: { indicator: null } },
      project: { id: 'p1', tasks: [{ progress: 80 }], milestones: [{ done: false }] },
    });
    await service.updateTask(me, 't1', { progress: 80, projectId: 'outra', project: { connect: { id: 'outra' } } });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
    expect(prisma.projectTask.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { progress: 80 } });
    expect(prisma.projectProgressSnapshot.upsert).toHaveBeenCalledWith({
      where: { projectId_measuredOn: { projectId: 'p1', measuredOn: expect.any(Date) } },
      create: { projectId: 'p1', measuredOn: expect.any(Date), progress: 40 }, update: { progress: 40 },
    });
  });

  it('toggleMilestone: registra a medição após concluir um marco', async () => {
    const { service, prisma } = makeService({
      milestone: { id: 'm1', projectId: 'p1', project: { indicator: { ownerNodeId: 'areaA' } } },
      project: { id: 'p1', tasks: [], milestones: [{ done: true }] },
    });
    await service.toggleMilestone(me, 'm1', true);
    expect(prisma.projectProgressSnapshot.upsert.mock.calls[0][0].update.progress).toBe(100);
  });

  it('create: inicia o histórico diário do projeto com avanço zero', async () => {
    const { service, prisma } = makeService();
    await service.create(me, { name: 'Novo' });
    expect(prisma.project.create.mock.calls[0][0].data.progressSnapshots.create).toEqual({ measuredOn: expect.any(Date), progress: 0 });
  });

  it.each([-1, 101, Number.NaN, '50'])('updateTask: rejeita progresso inválido %s antes de gravar', async (progress) => {
    const { service, prisma } = makeService({ task: { id: 't1', projectId: 'p1', project: { indicator: null } } });
    await expect(service.updateTask(me, 't1', { progress })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('updateTask: rejeita dependência de outro projeto sem alterar a tarefa', async () => {
    const { service, prisma } = makeService({ task: { id: 't1', projectId: 'p1', project: { indicator: null } } });
    prisma.projectTask.findFirst.mockResolvedValueOnce({ id: 't1', projectId: 'p1', project: { indicator: null } }).mockResolvedValueOnce(null);
    await expect(service.updateTask(me, 't1', { dependencyId: 'outro-projeto' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.projectTask.update).not.toHaveBeenCalled();
    expect(prisma.projectProgressSnapshot.upsert).not.toHaveBeenCalled();
  });

  it('updateTask: impede ciclos indiretos no cronograma', async () => {
    const { service, prisma } = makeService();
    prisma.projectTask.findFirst.mockResolvedValueOnce({ id: 't1', projectId: 'p1', project: { indicator: null } })
      .mockResolvedValueOnce({ id: 't2', dependencyId: 't1' }).mockResolvedValueOnce({ id: 't1' });
    await expect(service.updateTask(me, 't1', { dependencyId: 't2' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.projectTask.update).not.toHaveBeenCalled();
  });
});
