import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { FoodSafetyService } from './food-safety.service';
import type { AuthPayload } from '../auth/auth.types';

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(opts?: {
  programs?: unknown[];
  program?: unknown;
  processes?: unknown[];
  process?: unknown;
  step?: unknown;
  last?: unknown;
  listAreaFilter?: unknown;
  orgNode?: unknown;
  user?: unknown;
}) {
  const prisma: any = {
    foodSafetyProgram: {
      findMany: vi.fn().mockResolvedValue(opts?.programs ?? []),
      findFirst: vi.fn().mockResolvedValue(opts?.program ?? null),
      create: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'pg1', ...args.data })),
      update: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'pg1', ...args.data })),
    },
    foodSafetyProcess: {
      findMany: vi.fn().mockResolvedValue(opts?.processes ?? []),
      findFirst: vi.fn().mockImplementation((args: any) => {
        if (args?.orderBy?.number) return Promise.resolve(opts?.last ?? null);
        return Promise.resolve(opts?.process ?? null);
      }),
      create: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'pr1', steps: [], ...args.data })),
      update: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'pr1', steps: [], ...args.data })),
    },
    foodSafetyProcessStep: {
      findFirst: vi.fn().mockResolvedValue(opts?.step ?? null),
      create: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'st1', ...args.data })),
      update: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'st1', ...args.data })),
    },
    orgNode: { findFirst: vi.fn().mockResolvedValue(opts?.orgNode ?? null), findMany: vi.fn().mockResolvedValue([]) },
    user: { findFirst: vi.fn().mockResolvedValue(opts?.user ?? null), findMany: vi.fn().mockResolvedValue([]) },
  };
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));

  const access = {
    listAreaFilter: vi.fn().mockResolvedValue(opts?.listAreaFilter ?? null),
    assertCanWrite: vi.fn().mockResolvedValue(undefined),
  } as any;

  const service = new FoodSafetyService(prisma, access);
  return { service, prisma, access };
}

describe('FoodSafetyService - Fase 1 (programas/processos/etapas)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listPrograms: escopo de empresa e soft-delete', async () => {
    const { service, prisma } = makeService();
    await service.listPrograms(me, { search: 'eqm' });
    const where = prisma.foodSafetyProgram.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.deletedAt).toBeNull();
    expect(where.OR[0].name).toEqual({ contains: 'eqm', mode: 'insensitive' });
  });

  it('getProgram: programa de outra empresa -> NotFound', async () => {
    const { service, prisma } = makeService({ program: null });
    await expect(service.getProgram(me, 'pg-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.foodSafetyProgram.findFirst.mock.calls[0][0].where.companyId).toBe('companyA');
  });

  it('createProgram: exige nome, default PRIVATE/ACTIVE e numera por empresa', async () => {
    const { service, prisma } = makeService();
    await service.createProgram(me, { name: 'Seguranca dos Alimentos - EQM' });
    const data = prisma.foodSafetyProgram.create.mock.calls[0][0].data;
    expect(data.companyId).toBe('companyA');
    expect(data.visibility).toBe('PRIVATE');
    expect(data.status).toBe('ACTIVE');
    expect(data.createdById).toBe('user-1');
  });

  it('createProgram: sem nome -> BadRequest', async () => {
    const { service, prisma } = makeService();
    await expect(service.createProgram(me, {})).rejects.toThrow();
    expect(prisma.foodSafetyProgram.create).not.toHaveBeenCalled();
  });

  it('listProcesses: aplica filtro de area do AccessService', async () => {
    const { service, prisma } = makeService({ listAreaFilter: ['areaA'] });
    await service.listProcesses(me, { programId: 'pg1' });
    const where = prisma.foodSafetyProcess.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.programId).toBe('pg1');
    expect(where.AND[0].OR).toContainEqual({ orgNodeId: { in: ['areaA'] } });
    expect(where.AND[0].OR).toContainEqual({ orgNodeId: null });
  });

  it('getProcess: area nao permitida -> Forbidden', async () => {
    const { service } = makeService({ process: { id: 'pr1', companyId: 'companyA', orgNodeId: 'areaB', steps: [] }, listAreaFilter: ['areaA'] });
    await expect(service.getProcess(me, 'pr1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('createProcess: valida programa da empresa, numera e checa area de escrita', async () => {
    const { service, prisma, access } = makeService({ program: { id: 'pg1', companyId: 'companyA' }, orgNode: { id: 'areaA' }, last: { number: 4 } });
    await service.createProcess(me, { programId: 'pg1', name: 'Producao de hamburguer', orgNodeId: 'areaA' });
    expect(access.assertCanWrite).toHaveBeenCalledWith('user-1', 'areaA', 'food-safety', 'create');
    const data = prisma.foodSafetyProcess.create.mock.calls[0][0].data;
    expect(data.companyId).toBe('companyA');
    expect(data.programId).toBe('pg1');
    expect(data.number).toBe(5);
    expect(data.status).toBe('DRAFT');
  });

  it('createProcess: programa de outra empresa -> NotFound e nao grava', async () => {
    const { service, prisma } = makeService({ program: null });
    await expect(service.createProcess(me, { programId: 'pg-outra', name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.foodSafetyProcess.create).not.toHaveBeenCalled();
  });

  it('updateProgram: ignora id/companyId forjados', async () => {
    const { service, prisma } = makeService({ program: { id: 'pg1', companyId: 'companyA' } });
    await service.updateProgram(me, 'pg1', { id: 'hack', companyId: 'companyB', name: 'Novo nome' });
    const data = prisma.foodSafetyProgram.update.mock.calls[0][0].data;
    expect(data.id).toBeUndefined();
    expect(data.companyId).toBeUndefined();
    expect(data.name).toBe('Novo nome');
  });

  it('summary: conta processos por status e pontos de controle', async () => {
    const { service } = makeService({
      processes: [
        { id: 'a', status: 'PUBLISHED', steps: [{ isControlPoint: true }, { isControlPoint: false }] },
        { id: 'b', status: 'DRAFT', steps: [] },
        { id: 'c', status: 'PUBLISHED', steps: [{ isControlPoint: true }] },
      ],
    });
    const res = await service.summary(me);
    expect(res.processes).toBe(3);
    expect(res.published).toBe(2);
    expect(res.draft).toBe(1);
    expect(res.steps).toBe(3);
    expect(res.controlPoints).toBe(2);
  });
});
