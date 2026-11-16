import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ProcessPmoService } from './process-pmo.service';
import type { AuthPayload } from '../auth/auth.types';

const me = { sub: 'u1', companyId: 'c1', name: 'Ana', email: 'ana@example.test', role: 'ANALYST' } as AuthPayload;

function makeService(opts: {
  process?: Record<string, unknown>;
  processes?: unknown[];
  links?: unknown[];
  projects?: unknown[];
  permissions?: string[];
  canRead?: boolean;
} = {}) {
  const prisma: any = {
    processIntegration: {
      findMany: vi.fn().mockResolvedValue(opts.links ?? []),
      create: vi.fn().mockResolvedValue({ id: 'link-1' }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    traceabilityEvent: { create: vi.fn().mockResolvedValue({}) },
    project: { update: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((work: (tx: any) => unknown) => work(prisma));
  const processes: any = {
    getById: vi.fn().mockResolvedValue({ id: 'proc-1', status: 'ACTIVE', areaId: 'area-1', ...(opts.process ?? {}) }),
    list: vi.fn().mockResolvedValue(opts.processes ?? []),
  };
  const links: any = {
    context: vi.fn().mockResolvedValue({ admin: false, permissions: new Set(opts.permissions ?? ['projects:view', 'projects:create']), modules: new Set(['projects']), user: me }),
    canRead: vi.fn().mockReturnValue(opts.canRead ?? true),
  };
  const projects: any = {
    create: vi.fn().mockResolvedValue({ id: 'p-new', code: 'PRJ-0007', name: 'Reduzir retrabalho' }),
    list: vi.fn().mockResolvedValue(opts.projects ?? []),
  };
  const access: any = { assertCanWrite: vi.fn().mockResolvedValue(undefined) };
  return { service: new ProcessPmoService(prisma, processes, links, projects, access), prisma, processes, links, projects, access };
}

const project = (overrides: Record<string, unknown>) => ({
  id: 'p1', code: 'PRJ-0001', name: 'Projeto', status: 'IN_PROGRESS', budget: 1000, progressOverall: 50, expectedProgress: 60,
  pmoStatus: 'ON_TRACK', tasksOverdue: 0, milestonesOverdue: 0, openRisks: 0, openIssues: 0, finance: { actualCost: 200 }, milestones: [],
  ...overrides,
});

describe('ProcessPmoService - projeto de melhoria criado a partir do processo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('recusa processo arquivado antes de criar o projeto', async () => {
    const { service, projects } = makeService({ process: { status: 'ARCHIVED' } });
    await expect(service.createImprovementProject(me, 'proc-1', { name: 'X' })).rejects.toBeInstanceOf(ConflictException);
    expect(projects.create).not.toHaveBeenCalled();
  });

  it('exige poder editar a área do processo', async () => {
    const { service, access, projects } = makeService();
    access.assertCanWrite.mockRejectedValueOnce(new ForbiddenException());
    await expect(service.createImprovementProject(me, 'proc-1', { name: 'X' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(access.assertCanWrite).toHaveBeenCalledWith('u1', 'area-1', 'processes', 'edit');
    expect(projects.create).not.toHaveBeenCalled();
  });

  it('exige permissão de criar projetos e acesso ao módulo Projetos', async () => {
    const withoutPermission = makeService({ permissions: ['projects:view'] });
    await expect(withoutPermission.service.createImprovementProject(me, 'proc-1', { name: 'X' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(withoutPermission.projects.create).not.toHaveBeenCalled();
    const moduleOff = makeService({ canRead: false });
    await expect(moduleOff.service.createImprovementProject(me, 'proc-1', { name: 'X' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(moduleOff.projects.create).not.toHaveBeenCalled();
  });

  it('cria o projeto, o vínculo com o processo e o registro de auditoria', async () => {
    const { service, prisma, projects } = makeService();
    const created = await service.createImprovementProject(me, 'proc-1', { name: 'Reduzir retrabalho', priority: 'HIGH' });
    expect(created).toMatchObject({ id: 'p-new' });
    expect(projects.create).toHaveBeenCalledWith(me, { name: 'Reduzir retrabalho', priority: 'HIGH' });
    expect(prisma.processIntegration.create).toHaveBeenCalledWith({ data: {
      processId: 'proc-1', scopeKey: 'PROCESS', targetKey: 'PROJECT:p-new', projectId: 'p-new', label: 'Projeto de melhoria',
    } });
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({ companyId: 'c1', entityId: 'proc-1', action: 'LINK_PROCESS' });
    expect(prisma.traceabilityEvent.create.mock.calls[0][0].data).toMatchObject({ entityType: 'PROCESS', entityId: 'proc-1', title: 'Projeto de melhoria criado' });
  });

  it('se o vínculo falhar, retira o projeto recém-criado do portfólio', async () => {
    const { service, prisma } = makeService();
    prisma.processIntegration.create.mockRejectedValueOnce(new Error('falha'));
    await expect(service.createImprovementProject(me, 'proc-1', { name: 'X' })).rejects.toThrow('falha');
    expect(prisma.project.update).toHaveBeenCalledWith({ where: { id: 'p-new' }, data: { deletedAt: expect.any(Date) } });
  });
});

describe('ProcessPmoService - painel PMO dos processos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sem acesso ao módulo Projetos não consulta nada', async () => {
    const { service, processes, projects } = makeService({ canRead: false });
    await expect(service.overview(me)).resolves.toEqual({ available: false, canCreate: false });
    expect(processes.list).not.toHaveBeenCalled();
    expect(projects.list).not.toHaveBeenCalled();
  });

  it('consolida por processo, conta projetos fora do alcance e ordena pelos críticos', async () => {
    const { service, projects, prisma } = makeService({
      processes: [
        { id: 'proc-a', number: 1, name: 'Atendimento', status: 'ACTIVE', orgNode: { id: 'n1', name: 'Comercial' }, owner: null },
        { id: 'proc-b', number: 2, name: 'Compras', status: 'ACTIVE', orgNode: null, owner: { id: 'u9', name: 'Bia' } },
        { id: 'proc-c', number: 3, name: 'Sem projetos', status: 'DRAFT', orgNode: null, owner: null },
      ],
      links: [
        { processId: 'proc-a', projectId: 'p1' },
        { processId: 'proc-a', projectId: 'p1' },
        { processId: 'proc-b', projectId: 'p1' },
        { processId: 'proc-b', projectId: 'p2' },
        { processId: 'proc-b', projectId: 'p-hidden' },
      ],
      projects: [
        project({ id: 'p1', milestones: [{ name: 'Piloto', dueDate: new Date('2026-12-01'), done: false }] }),
        project({ id: 'p2', status: 'IN_PROGRESS', pmoStatus: 'CRITICAL', progressOverall: 10, expectedProgress: 40, tasksOverdue: 2, budget: 500, finance: { actualCost: 700 }, openIssues: 1,
          milestones: [{ name: 'Contrato', dueDate: new Date('2026-11-20'), done: false }, { name: 'Antigo', dueDate: new Date('2026-01-01'), done: true }] }),
      ],
    });
    const result: any = await service.overview(me);
    expect(prisma.processIntegration.findMany.mock.calls[0][0].where.processId).toEqual({ in: ['proc-a', 'proc-b', 'proc-c'] });
    expect(projects.list).toHaveBeenCalledWith(me, { ids: ['p1', 'p2', 'p-hidden'] });
    expect(result.available).toBe(true);
    expect(result.processes.map((row: any) => row.process.id)).toEqual(['proc-b', 'proc-a']);
    const compras = result.processes[0];
    expect(compras).toMatchObject({ projects: 2, active: 2, critical: 1, tasksOverdue: 2, openIssues: 1, budget: 1500, actualCost: 900, avgProgress: 30, expectedProgress: 50, pmoStatus: 'CRITICAL' });
    expect(compras.nextMilestone).toMatchObject({ name: 'Contrato', project: { id: 'p2' } });
    expect(result.processes[1]).toMatchObject({ projects: 1, pmoStatus: 'ON_TRACK' });
    expect(result.totals).toMatchObject({ processes: 3, withProjects: 2, hiddenProjects: 1, projects: 2, critical: 1 });
  });

  it('projetos cancelados não entram em avanço nem custo', async () => {
    const { service } = makeService({
      processes: [{ id: 'proc-a', number: 1, name: 'Atendimento', status: 'ACTIVE' }],
      links: [{ processId: 'proc-a', projectId: 'p1' }, { processId: 'proc-a', projectId: 'p2' }],
      projects: [project({ id: 'p1', progressOverall: 80 }), project({ id: 'p2', status: 'CANCELLED', progressOverall: 0, budget: 9000, finance: { actualCost: 9000 } })],
    });
    const result: any = await service.overview(me);
    expect(result.processes[0]).toMatchObject({ projects: 2, active: 1, avgProgress: 80, budget: 1000, actualCost: 200 });
  });
});
