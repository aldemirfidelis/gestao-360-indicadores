import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
  user?: unknown;
  child?: unknown;
  tasks?: unknown[];
}) {
  const child = () => ({
    create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'c1', ...data })),
    findFirst: vi.fn().mockResolvedValue(opts?.child ?? null),
    update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'c1', ...data })),
    delete: vi.fn().mockResolvedValue({ id: 'c1' }),
  });
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
      delete: vi.fn().mockResolvedValue({ id: 'm1' }),
    },
    projectMember: child(),
    projectCost: child(),
    projectRisk: child(),
    projectUpdate: child(),
    user: { findFirst: vi.fn().mockResolvedValue(opts?.user ?? null), findMany: vi.fn().mockResolvedValue([]) },
    projectTask: {
      create: vi.fn().mockResolvedValue({ id: 't1' }),
      findFirst: vi.fn().mockResolvedValue(opts?.task ?? null),
      findMany: vi.fn().mockResolvedValue(opts?.tasks ?? []),
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
  prisma.$transaction.mockImplementation((work: unknown) =>
    typeof work === 'function' ? (work as (tx: any) => unknown)(prisma) : Promise.all(work as unknown[]));
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
    const past = new Date(Date.now() - 86400000 * 2).toISOString();
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

describe('ProjectsService - gestão completa do projeto', () => {
  beforeEach(() => vi.clearAllMocks());

  const scoped = { id: 'p1', companyId: 'companyA', status: 'PLANNED', indicator: null };
  const childOf = (extra: Record<string, unknown> = {}) => ({ id: 'c1', projectId: 'p1', project: { indicator: null }, ...extra });

  it('create: exige nome e gera o próximo código sequencial da empresa', async () => {
    const { service, prisma } = makeService({ projects: [{ code: 'PRJ-0007' }, { code: 'PRJ-0012' }, { code: 'OBRA-1' }] });
    await expect(service.create(me, { name: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await service.create(me, { name: ' Novo projeto ' });
    const data = prisma.project.create.mock.calls[0][0].data;
    expect(data.name).toBe('Novo projeto');
    expect(data.code).toBe('PRJ-0013');
    expect(data.companyId).toBe('companyA');
    expect(prisma.project.findMany.mock.calls[0][0].where.companyId).toBe('companyA');
  });

  it('create: código gerado em conflito é recalculado; código informado em conflito responde 409', async () => {
    const { service, prisma } = makeService();
    prisma.project.create.mockRejectedValueOnce({ code: 'P2002' }).mockResolvedValueOnce({ id: 'p1' });
    await service.create(me, { name: 'Projeto' });
    expect(prisma.project.create).toHaveBeenCalledTimes(2);
    prisma.project.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(service.create(me, { name: 'Projeto', code: 'obra-1' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.project.create.mock.calls[2][0].data.code).toBe('OBRA-1');
  });

  it('create: gerente precisa ser pessoa da mesma empresa e passa a ser o responsável', async () => {
    const outside = makeService({ user: null });
    await expect(outside.service.create(me, { name: 'P', managerId: 'u-outra' })).rejects.toBeInstanceOf(BadRequestException);
    expect(outside.prisma.user.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'u-outra', companyId: 'companyA' });
    expect(outside.prisma.project.create).not.toHaveBeenCalled();

    const inside = makeService({ user: { id: 'u1', name: 'Ana Lima' } });
    await inside.service.create(me, { name: 'P', managerId: 'u1', responsible: 'Outro nome' });
    const data = inside.prisma.project.create.mock.calls[0][0].data;
    expect(data.managerId).toBe('u1');
    expect(data.responsible).toBe('Ana Lima');
  });

  it.each([
    [{ startsAt: '2026-05-10', endsAt: '2026-05-01' }],
    [{ status: 'ARCHIVED' }],
    [{ priority: 'URGENT' }],
    [{ budget: -1 }],
    [{ budget: '100' }],
    [{ startsAt: 'ontem' }],
    [{ name: '' }],
  ])('update: rejeita dados inválidos %j sem gravar', async (patch) => {
    const { service, prisma } = makeService({ project: scoped });
    await expect(service.update(me, 'p1', patch)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('update: mudança de status registra as datas reais e limpar campos grava nulo', async () => {
    const { service, prisma } = makeService({ project: scoped });
    await service.update(me, 'p1', { status: 'IN_PROGRESS', description: '', budget: null });
    const started = prisma.project.update.mock.calls[0][0].data;
    expect(started.status).toBe('IN_PROGRESS');
    expect(started.actualStartAt).toBeInstanceOf(Date);
    expect(started.description).toBeNull();
    expect(started.budget).toBeNull();

    const done = makeService({ project: { ...scoped, status: 'IN_PROGRESS', actualStartAt: new Date('2026-01-05') } });
    await done.service.update(me, 'p1', { status: 'DONE' });
    const finished = done.prisma.project.update.mock.calls[0][0].data;
    expect(finished.actualEndAt).toBeInstanceOf(Date);
    expect(finished.actualStartAt).toBeUndefined();

    const reopened = makeService({ project: { ...scoped, status: 'DONE', actualEndAt: new Date('2026-03-01') } });
    await reopened.service.update(me, 'p1', { status: 'IN_PROGRESS' });
    expect(reopened.prisma.project.update.mock.calls[0][0].data.actualEndAt).toBeNull();
  });

  it('update: código duplicado responde 409', async () => {
    const { service, prisma } = makeService({ project: scoped });
    prisma.project.update.mockRejectedValueOnce({ code: 'P2002' });
    await expect(service.update(me, 'p1', { code: 'PRJ-0001' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('list: aplica prioridade e gerente e rejeita filtro inválido', async () => {
    const { service, prisma } = makeService();
    await service.list(me, { priority: 'HIGH', managerId: 'u1' });
    const where = prisma.project.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ companyId: 'companyA', priority: 'HIGH', managerId: 'u1' });
    await expect(service.list(me, { priority: 'URGENT' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list(me, { status: 'ARCHIVED' as any })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('list e portfolio: consolidam custos, riscos e saúde sem expor os lançamentos', async () => {
    const { service } = makeService({
      projects: [{
        id: 'p1', name: 'Obra', status: 'IN_PROGRESS', priority: 'HIGH', budget: 1000,
        milestones: [], tasks: [], _count: { tasks: 0, milestones: 0 }, indicator: null,
        costs: [{ kind: 'PLANNED', amount: 900 }, { kind: 'ACTUAL', amount: 700 }, { kind: 'ACTUAL', amount: 500 }],
        projectRisks: [{ id: 'r1', kind: 'RISK', status: 'OPEN' }, { id: 'r2', kind: 'ISSUE', status: 'MITIGATING' }],
        updates: [{ health: 'YELLOW' }],
      }],
    });
    const [item]: any[] = await service.list(me);
    expect(item.finance).toEqual({ budget: 1000, plannedCost: 900, actualCost: 1200, balance: -200, consumedPct: 120, overBudget: true });
    expect(item.openRisks).toBe(1);
    expect(item.openIssues).toBe(1);
    expect(item.latestHealth).toBe('YELLOW');
    expect(item.costs).toBeUndefined();
    expect(item.projectRisks).toBeUndefined();
    const portfolio = await service.portfolio(me);
    expect(portfolio.actualCost).toBe(1200);
    expect(portfolio.plannedCost).toBe(900);
    expect(portfolio.overBudget).toBe(1);
    expect(portfolio.openRisks).toBe(1);
    expect(portfolio.openIssues).toBe(1);
    expect(portfolio.priorityCounts.HIGH).toBe(1);
  });

  it('updateTask: concluir registra a data de conclusão e reabrir a limpa', async () => {
    const open = makeService({ task: { id: 't1', projectId: 'p1', completedAt: null, project: { indicator: null } } });
    await open.service.updateTask(me, 't1', { progress: 100 });
    expect(open.prisma.projectTask.update.mock.calls[0][0].data).toEqual({ progress: 100, completedAt: expect.any(Date) });
    const closed = makeService({ task: { id: 't1', projectId: 'p1', completedAt: new Date(), project: { indicator: null } } });
    await closed.service.updateTask(me, 't1', { progress: 60 });
    expect(closed.prisma.projectTask.update.mock.calls[0][0].data).toEqual({ progress: 60, completedAt: null });
  });

  it('updateTask: responsável da empresa substitui o nome livre; datas invertidas são rejeitadas', async () => {
    const { service, prisma } = makeService({
      task: { id: 't1', projectId: 'p1', startDate: new Date('2026-02-10'), endDate: new Date('2026-02-20'), project: { indicator: null } },
      user: { id: 'u1', name: 'Bruno Sá' },
    });
    await service.updateTask(me, 't1', { assigneeId: 'u1' });
    expect(prisma.projectTask.update.mock.calls[0][0].data).toEqual({ assigneeId: 'u1', responsible: 'Bruno Sá' });
    await expect(service.updateTask(me, 't1', { endDate: '2026-02-01' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.projectTask.update).toHaveBeenCalledOnce();
  });

  it('addTask: valida o nome e posiciona a tarefa ao final do cronograma', async () => {
    const { service, prisma } = makeService({ project: { ...scoped, tasks: [], milestones: [] } });
    await expect(service.addTask(me, 'p1', { name: '' })).rejects.toBeInstanceOf(BadRequestException);
    prisma.projectTask.findFirst.mockResolvedValueOnce({ position: 4 });
    await service.addTask(me, 'p1', { name: 'Montagem', phase: 'Execução', startDate: '2026-03-01', endDate: '2026-03-15' });
    const data = prisma.projectTask.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ projectId: 'p1', name: 'Montagem', phase: 'Execução', position: 5 });
    expect(prisma.projectProgressSnapshot.upsert).toHaveBeenCalledOnce();
  });

  it('reorderTasks: exige exatamente as tarefas do projeto', async () => {
    const { service, prisma } = makeService({ project: scoped, tasks: [{ id: 't1' }, { id: 't2' }] });
    await expect(service.reorderTasks(me, 'p1', ['t1'])).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.reorderTasks(me, 'p1', ['t1', 't1'])).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.reorderTasks(me, 'p1', ['t1', 'outra'])).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.projectTask.update).not.toHaveBeenCalled();
    await service.reorderTasks(me, 'p1', ['t2', 't1']);
    expect(prisma.projectTask.update).toHaveBeenCalledWith({ where: { id: 't2' }, data: { position: 0 } });
    expect(prisma.projectTask.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { position: 1 } });
  });

  it('marcos: edição e exclusão respeitam a empresa e refazem a medição', async () => {
    const missing = makeService({ milestone: null });
    await expect(missing.service.updateMilestone(me, 'm-outra', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(missing.service.removeMilestone(me, 'm-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(missing.prisma.projectMilestone.findFirst.mock.calls[0][0].where.project.companyId).toBe('companyA');

    const { service, prisma } = makeService({
      milestone: { id: 'm1', projectId: 'p1', done: false, project: { indicator: null } },
      project: { id: 'p1', tasks: [], milestones: [] },
    });
    await service.updateMilestone(me, 'm1', { name: 'Entrega final', dueDate: '2026-06-30', done: true });
    const data = prisma.projectMilestone.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ name: 'Entrega final', done: true, completedAt: expect.any(Date) });
    await service.removeMilestone(me, 'm1');
    expect(prisma.projectMilestone.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    expect(prisma.projectProgressSnapshot.upsert).toHaveBeenCalledTimes(2);
  });

  it('equipe: usa o nome do usuário, aceita externo e impede duplicidade', async () => {
    const { service, prisma } = makeService({ project: scoped, user: { id: 'u1', name: 'Carla Dias' } });
    await service.addMember(me, 'p1', { userId: 'u1', role: 'Engenheira', allocation: 50 });
    expect(prisma.projectMember.create.mock.calls[0][0].data).toEqual({ projectId: 'p1', userId: 'u1', name: 'Carla Dias', role: 'Engenheira', allocation: 50 });
    await service.addMember(me, 'p1', { name: 'Consultor externo' });
    expect(prisma.projectMember.create.mock.calls[1][0].data).toMatchObject({ name: 'Consultor externo', allocation: null });
    await expect(service.addMember(me, 'p1', { name: 'X', allocation: 140 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.addMember(me, 'p1', {})).rejects.toBeInstanceOf(BadRequestException);
    prisma.projectMember.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(service.addMember(me, 'p1', { userId: 'u1' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('custos: valida os lançamentos e isola por empresa', async () => {
    const { service, prisma } = makeService({ project: scoped });
    await expect(service.addCost(me, 'p1', { description: 'Frete', amount: -5, date: '2026-04-01' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.addCost(me, 'p1', { description: 'Frete', amount: 10 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.addCost(me, 'p1', { description: 'Frete', amount: 10, date: '2026-04-01', kind: 'OUTRO' })).rejects.toBeInstanceOf(BadRequestException);
    await service.addCost(me, 'p1', { description: 'Frete', amount: 10.5, date: '2026-04-01', kind: 'PLANNED', category: 'Logística' });
    expect(prisma.projectCost.create.mock.calls[0][0].data).toMatchObject({
      projectId: 'p1', kind: 'PLANNED', description: 'Frete', amount: 10.5, category: 'Logística', createdById: 'user-1',
    });
    await expect(service.updateCost(me, 'c-outra', { amount: 1 })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.removeCost(me, 'c-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.projectCost.findFirst.mock.calls[0][0].where).toEqual({ id: 'c-outra', project: { companyId: 'companyA', deletedAt: null } });
    expect(prisma.projectCost.update).not.toHaveBeenCalled();
    expect(prisma.projectCost.delete).not.toHaveBeenCalled();
  });

  it('riscos: valida a matriz e controla a data de encerramento', async () => {
    const { service, prisma } = makeService({ project: scoped });
    await expect(service.addRisk(me, 'p1', { title: 'Atraso', probability: 6 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.addRisk(me, 'p1', { probability: 2 })).rejects.toBeInstanceOf(BadRequestException);
    await service.addRisk(me, 'p1', { title: 'Atraso do fornecedor', kind: 'ISSUE', probability: 4, impact: 5 });
    expect(prisma.projectRisk.create.mock.calls[0][0].data).toMatchObject({ projectId: 'p1', kind: 'ISSUE', probability: 4, impact: 5 });

    const open = makeService({ child: childOf({ status: 'OPEN' }) });
    await open.service.updateRisk(me, 'c1', { status: 'RESOLVED' });
    expect(open.prisma.projectRisk.update.mock.calls[0][0].data).toEqual({ status: 'RESOLVED', resolvedAt: expect.any(Date) });
    const closed = makeService({ child: childOf({ status: 'RESOLVED' }) });
    await closed.service.updateRisk(me, 'c1', { status: 'MITIGATING' });
    expect(closed.prisma.projectRisk.update.mock.calls[0][0].data).toEqual({ status: 'MITIGATING', resolvedAt: null });
  });

  it('status report: registra autor, saúde e o avanço calculado no momento', async () => {
    const { service, prisma } = makeService({ project: { ...scoped, tasks: [{ progress: 40 }], milestones: [] } });
    await expect(service.addUpdate(me, 'p1', { health: 'BLUE', summary: 'Ok' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.addUpdate(me, 'p1', { health: 'GREEN', summary: ' ' })).rejects.toBeInstanceOf(BadRequestException);
    await service.addUpdate(me, 'p1', { health: 'YELLOW', summary: 'Fundação concluída', nextSteps: 'Estrutura' });
    expect(prisma.projectUpdate.create.mock.calls[0][0].data).toMatchObject({
      projectId: 'p1', authorId: 'user-1', authorName: 'User', health: 'YELLOW', summary: 'Fundação concluída',
      nextSteps: 'Estrutura', progress: 40, reportDate: expect.any(Date),
    });
  });

  it('escrita em registros filhos respeita a área do indicador do projeto', async () => {
    const { service, access, prisma } = makeService({ child: { id: 'c1', projectId: 'p1', status: 'OPEN', project: { indicator: { ownerNodeId: 'areaB' } } } });
    access.assertCanWrite.mockRejectedValue(new ForbiddenException());
    await expect(service.updateRisk(me, 'c1', { title: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.removeMember(me, 'c1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.removeUpdate(me, 'c1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(access.assertCanWrite).toHaveBeenCalledWith('user-1', 'areaB', 'projects', 'edit');
    expect(prisma.projectRisk.update).not.toHaveBeenCalled();
    expect(prisma.projectMember.delete).not.toHaveBeenCalled();
    expect(prisma.projectUpdate.delete).not.toHaveBeenCalled();
  });

  it('duplicate: copia a estrutura com novo código, sem avanço, e desloca o cronograma', async () => {
    const source = {
      id: 'p1', companyId: 'companyA', name: 'Modelo', priority: 'HIGH', budget: 500, indicator: null,
      startsAt: new Date('2026-01-01T00:00:00Z'), endsAt: new Date('2026-01-31T00:00:00Z'),
      tasks: [
        { id: 't1', name: 'A', position: 0, progress: 100, startDate: new Date('2026-01-01T00:00:00Z'), endDate: new Date('2026-01-10T00:00:00Z'), dependencyId: null },
        { id: 't2', name: 'B', position: 1, progress: 30, startDate: new Date('2026-01-11T00:00:00Z'), endDate: new Date('2026-01-20T00:00:00Z'), dependencyId: 't1' },
      ],
      milestones: [{ id: 'm1', name: 'Entrega', dueDate: new Date('2026-01-31T00:00:00Z'), done: true }],
      members: [{ userId: 'u1', name: 'Ana', role: 'Líder', allocation: 100 }],
    };
    const { service, prisma } = makeService({ project: source });
    prisma.project.create.mockResolvedValue({ id: 'p2' });
    prisma.projectTask.create.mockResolvedValueOnce({ id: 'n1' }).mockResolvedValueOnce({ id: 'n2' });
    const created = await service.duplicate(me, 'p1', { startsAt: '2026-03-01T00:00:00Z' });
    expect(created).toEqual({ id: 'p2' });
    const project = prisma.project.create.mock.calls[0][0].data;
    expect(project).toMatchObject({ companyId: 'companyA', name: 'Modelo (cópia)', code: 'PRJ-0001', status: 'PLANNED', priority: 'HIGH', budget: 500 });
    expect(project.startsAt.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(project.endsAt.toISOString()).toBe('2026-03-31T00:00:00.000Z');
    const second = prisma.projectTask.create.mock.calls[1][0].data;
    expect(second.projectId).toBe('p2');
    expect(second.progress).toBeUndefined();
    expect(second.startDate.toISOString()).toBe('2026-03-11T00:00:00.000Z');
    expect(prisma.projectTask.update).toHaveBeenCalledWith({ where: { id: 'n2' }, data: { dependencyId: 'n1' } });
    const milestone = prisma.projectMilestone.create.mock.calls[0][0].data;
    expect(milestone.done).toBeUndefined();
    expect(milestone.dueDate.toISOString()).toBe('2026-03-31T00:00:00.000Z');
    expect(prisma.projectMember.create.mock.calls[0][0].data).toMatchObject({ projectId: 'p2', userId: 'u1', role: 'Líder' });
  });

  it('list e portfolio: filtram projetos de melhoria do processo e lista vazia de ids não consulta', async () => {
    const { service, prisma } = makeService();
    await service.list(me, { processId: 'proc-1' });
    const where = prisma.project.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.AND).toContainEqual({ processIntegrations: { some: { processId: 'proc-1' } } });
    await service.portfolio(me, { processId: 'proc-1' });
    expect(prisma.project.findMany.mock.calls[1][0].where.AND).toContainEqual({ processIntegrations: { some: { processId: 'proc-1' } } });
    await expect(service.list(me, { ids: [] })).resolves.toEqual([]);
    expect(prisma.project.findMany).toHaveBeenCalledTimes(2);
    await service.list(me, { ids: ['p1', 'p2'] });
    expect(prisma.project.findMany.mock.calls[2][0].where.id).toEqual({ in: ['p1', 'p2'] });
  });

  it('execution: agenda com marcos e tarefas em aberto, vencidos primeiro, e curva do portfólio', async () => {
    const day = (offset: number) => {
      const date = new Date();
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + offset));
    };
    const { service, prisma } = makeService({
      projects: [
        {
          id: 'p1', code: 'PRJ-0001', name: 'Em curso', status: 'IN_PROGRESS', startsAt: day(-30), endsAt: day(30),
          milestones: [{ id: 'm1', name: 'Vencido', dueDate: day(-5), done: false }, { id: 'm2', name: 'Futuro', dueDate: day(10), done: false }, { id: 'm3', name: 'Feito', dueDate: day(-10), done: true }],
          tasks: [
            { id: 't1', name: 'Atrasada', progress: 20, startDate: day(-20), endDate: day(-2) },
            { id: 't2', name: 'Vence logo', progress: 0, startDate: day(1), endDate: day(5) },
            { id: 't3', name: 'Distante', progress: 0, startDate: day(40), endDate: day(60) },
            { id: 't4', name: 'Concluída', progress: 100, startDate: day(-20), endDate: day(-15) },
          ],
          progressSnapshots: [],
        },
        {
          id: 'p2', code: 'PRJ-0002', name: 'Encerrado', status: 'DONE', startsAt: day(-60), endsAt: day(-1),
          milestones: [{ id: 'm4', name: 'Esquecido', dueDate: day(-3), done: false }],
          tasks: [{ id: 't5', name: 'Sobrou', progress: 50, startDate: day(-30), endDate: day(-4) }],
          progressSnapshots: [],
        },
      ],
    });
    const result: any = await service.execution(me, { processId: 'proc-1' });
    expect(prisma.project.findMany.mock.calls[0][0].where.AND).toContainEqual({ processIntegrations: { some: { processId: 'proc-1' } } });
    expect(result.milestones.map((m: any) => [m.id, m.overdue])).toEqual([['m1', true], ['m2', false]]);
    expect(result.tasks.map((t: any) => [t.id, t.overdue])).toEqual([['t1', true], ['t2', false]]);
    expect(result.tasks[0].project).toEqual({ id: 'p1', code: 'PRJ-0001', name: 'Em curso' });
    expect(result.totals).toEqual({ openMilestones: 2, overdueMilestones: 1, openTasks: 3, overdueTasks: 1, dueSoonTasks: 1 });
    expect(result.curve.projects).toBe(2);
    expect(result.curve.hasSchedule).toBe(true);
  });

  it('duplicate: projeto de outra empresa -> NotFound', async () => {
    const { service, prisma } = makeService({ project: null });
    await expect(service.duplicate(me, 'p-outra', {})).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.project.create).not.toHaveBeenCalled();
  });
});
