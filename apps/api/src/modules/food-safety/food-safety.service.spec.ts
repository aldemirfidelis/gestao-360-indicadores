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
  matrix?: unknown;
  hazards?: unknown[];
  hazard?: unknown;
  lastHazard?: unknown;
  controlPlan?: unknown;
  controlPlans?: unknown[];
  records?: unknown[];
  standards?: unknown[];
  standard?: unknown;
  versions?: unknown[];
  version?: unknown;
  requirements?: unknown[];
  requirement?: unknown;
  suppliers?: unknown[];
  supplier?: unknown;
  materials?: unknown[];
  material?: unknown;
  lots?: unknown[];
  lot?: unknown;
  traceLinks?: unknown[];
  recalls?: unknown[];
  recall?: unknown;
  recallItem?: unknown;
}) {
  const defaultMatrix = { id: 'm1', companyId: 'companyA', severityScale: 5, probabilityScale: 5, useDetection: false, detectionScale: 5, thresholdLow: 4, thresholdModerate: 9, thresholdHigh: 15 };
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
    foodSafetyRiskMatrix: {
      findFirst: vi.fn().mockResolvedValue(opts?.matrix ?? defaultMatrix),
      create: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'm1', ...args.data })),
      update: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'm1', ...args.data })),
    },
    foodSafetyHazard: {
      findMany: vi.fn().mockResolvedValue(opts?.hazards ?? []),
      findFirst: vi.fn().mockImplementation((args: any) => {
        if (args?.orderBy?.number) return Promise.resolve(opts?.lastHazard ?? null);
        return Promise.resolve(opts?.hazard ?? null);
      }),
      create: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'h1', ...args.data })),
      update: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'h1', ...args.data })),
    },
    foodSafetyControlPlan: {
      findMany: vi.fn().mockResolvedValue(opts?.controlPlans ?? []),
      findFirst: vi.fn().mockResolvedValue(opts?.controlPlan ?? null),
      create: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'cp1', ...args.data })),
      update: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'cp1', ...args.data })),
    },
    foodSafetyMonitoringRecord: {
      findMany: vi.fn().mockResolvedValue(opts?.records ?? []),
      create: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'mr1', ...args.data })),
    },
    foodSafetyStandard: {
      findMany: vi.fn().mockResolvedValue(opts?.standards ?? []),
      findFirst: vi.fn().mockResolvedValue(opts?.standard ?? null),
      create: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'std1', ...args.data })),
      update: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'std1', ...args.data })),
    },
    foodSafetyStandardVersion: {
      findMany: vi.fn().mockResolvedValue(opts?.versions ?? []),
      findFirst: vi.fn().mockResolvedValue(opts?.version ?? null),
      create: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'ver1', ...args.data })),
      update: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'ver1', ...args.data })),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    foodSafetyRequirement: {
      findMany: vi.fn().mockResolvedValue(opts?.requirements ?? []),
      findFirst: vi.fn().mockResolvedValue(opts?.requirement ?? null),
      create: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'req1', ...args.data })),
      update: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'req1', ...args.data })),
    },
    foodSafetyRequirementAssessment: {
      create: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'as1', ...args.data })),
    },
    foodSafetySupplier: {
      findMany: vi.fn().mockResolvedValue(opts?.suppliers ?? []),
      findFirst: vi.fn().mockResolvedValue(opts?.supplier ?? null),
      create: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'sup1', ...args.data })),
      update: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'sup1', ...args.data })),
    },
    foodSafetyMaterial: {
      findMany: vi.fn().mockResolvedValue(opts?.materials ?? []),
      findFirst: vi.fn().mockResolvedValue(opts?.material ?? null),
      create: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'mat1', ...args.data })),
      update: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'mat1', ...args.data })),
    },
    foodSafetyLot: {
      findMany: vi.fn().mockResolvedValue(opts?.lots ?? []),
      findFirst: vi.fn().mockResolvedValue(opts?.lot ?? null),
      create: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'lot1', ...args.data })),
      update: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'lot1', ...args.data })),
    },
    foodSafetyTraceLink: {
      findMany: vi.fn().mockResolvedValue(opts?.traceLinks ?? []),
      create: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'tl1', ...args.data })),
    },
    foodSafetyRecall: {
      findMany: vi.fn().mockResolvedValue(opts?.recalls ?? []),
      findFirst: vi.fn().mockResolvedValue(opts?.recall ?? null),
      create: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'rec1', ...args.data, items: args.data.items?.create ?? [] })),
      update: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'rec1', ...args.data })),
    },
    foodSafetyRecallItem: {
      findFirst: vi.fn().mockResolvedValue(opts?.recallItem ?? null),
      create: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'ri1', ...args.data })),
      update: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: 'ri1', ...args.data })),
    },
    orgNode: { findFirst: vi.fn().mockResolvedValue(opts?.orgNode ?? null), findMany: vi.fn().mockResolvedValue([]) },
    user: { findFirst: vi.fn().mockResolvedValue(opts?.user ?? null), findMany: vi.fn().mockResolvedValue([]) },
  };
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));

  const access = {
    listAreaFilter: vi.fn().mockResolvedValue(opts?.listAreaFilter ?? null),
    assertCanWrite: vi.fn().mockResolvedValue(undefined),
  } as any;

  const nonConformities = { create: vi.fn().mockResolvedValue({ id: 'nc1', number: 1 }) } as any;
  const service = new FoodSafetyService(prisma, access, nonConformities);
  return { service, prisma, access, nonConformities };
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

  it('createHazard: calcula indice/nivel de risco, numera e checa area', async () => {
    const { service, prisma, access } = makeService({
      process: { id: 'pr1', companyId: 'companyA', orgNodeId: 'areaA', steps: [] },
      lastHazard: { number: 2 },
    });
    await service.createHazard(me, { processId: 'pr1', name: 'Salmonella', category: 'BIOLOGICAL', severity: 4, probability: 3, controlType: 'CCP' });
    expect(access.assertCanWrite).toHaveBeenCalledWith('user-1', 'areaA', 'food-safety', 'create');
    const data = prisma.foodSafetyHazard.create.mock.calls[0][0].data;
    expect(data.companyId).toBe('companyA');
    expect(data.number).toBe(3);
    expect(data.riskIndex).toBe(12); // 4 x 3
    expect(data.riskLevel).toBe('HIGH'); // 9 < 12 <= 15
    expect(data.controlType).toBe('CCP');
  });

  it('createHazard: severidade fora da escala -> erro e nao grava', async () => {
    const { service, prisma } = makeService({ process: { id: 'pr1', companyId: 'companyA', orgNodeId: null, steps: [] } });
    await expect(service.createHazard(me, { processId: 'pr1', name: 'X', severity: 9 })).rejects.toThrow();
    expect(prisma.foodSafetyHazard.create).not.toHaveBeenCalled();
  });

  it('updateRiskMatrix: limites nao crescentes -> erro', async () => {
    const { service } = makeService();
    await expect(service.updateRiskMatrix(me, { thresholdLow: 10, thresholdModerate: 5 })).rejects.toThrow();
  });

  it('listHazards: aplica filtro de area no processo', async () => {
    const { service, prisma } = makeService({ listAreaFilter: ['areaA'] });
    await service.listHazards(me, { processId: 'pr1' });
    const where = prisma.foodSafetyHazard.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.processId).toBe('pr1');
    expect(where.AND[0].process.OR).toContainEqual({ orgNodeId: { in: ['areaA'] } });
  });

  it('createControlPlan: herda controlType do perigo e checa area', async () => {
    const { service, prisma, access } = makeService({
      hazard: { id: 'h1', companyId: 'companyA', controlType: 'OPRP', process: { orgNodeId: 'areaA' }, steps: [] },
    });
    await service.createControlPlan(me, { hazardId: 'h1', parameter: 'pH' });
    expect(access.assertCanWrite).toHaveBeenCalledWith('user-1', 'areaA', 'food-safety', 'create');
    const data = prisma.foodSafetyControlPlan.create.mock.calls[0][0].data;
    expect(data.controlType).toBe('OPRP');
    expect(data.requiresNonConformity).toBe(true);
  });

  const planFixture = (over: Record<string, unknown> = {}) => ({
    id: 'cp1',
    companyId: 'companyA',
    controlType: 'CCP',
    requiresLotBlock: true,
    requiresNonConformity: true,
    criticalMin: 70,
    criticalMax: null,
    alertMin: null,
    alertMax: null,
    parameter: 'Temperatura',
    correction: 'Reprocessar',
    hazard: { name: 'Salmonella', process: { id: 'pr1', name: 'Cozimento', orgNodeId: 'areaA' } },
    ...over,
  });

  it('recordMonitoring: valor fora do limite -> OUT, bloqueia lote e abre NC', async () => {
    const { service, prisma, nonConformities } = makeService({ controlPlan: planFixture() });
    await service.recordMonitoring(me, 'cp1', { valueNum: 65 });
    expect(nonConformities.create).toHaveBeenCalledWith(me, expect.objectContaining({ source: 'PROCESS', severity: 'CRITICAL', orgNodeId: 'areaA' }));
    const data = prisma.foodSafetyMonitoringRecord.create.mock.calls[0][0].data;
    expect(data.result).toBe('OUT');
    expect(data.lotBlocked).toBe(true);
    expect(data.nonConformityId).toBe('nc1');
  });

  it('recordMonitoring: valor dentro do limite -> OK, sem NC', async () => {
    const { service, prisma, nonConformities } = makeService({ controlPlan: planFixture() });
    await service.recordMonitoring(me, 'cp1', { valueNum: 75 });
    expect(nonConformities.create).not.toHaveBeenCalled();
    const data = prisma.foodSafetyMonitoringRecord.create.mock.calls[0][0].data;
    expect(data.result).toBe('OK');
    expect(data.lotBlocked).toBe(false);
    expect(data.nonConformityId).toBeNull();
  });

  it('complianceSummary: % conformidade usa aplicaveis (total - NA)', async () => {
    const { service } = makeService({
      requirements: [
        { id: 'r1', assessments: [{ result: 'MET' }] },
        { id: 'r2', assessments: [{ result: 'PARTIAL' }] },
        { id: 'r3', assessments: [{ result: 'NOT_APPLICABLE' }] },
        { id: 'r4', assessments: [] },
      ],
    });
    const res = await service.complianceSummary(me);
    expect(res.requirements).toBe(4);
    expect(res.notApplicable).toBe(1);
    expect(res.applicable).toBe(3);
    expect(res.met).toBe(1);
    expect(res.pending).toBe(1);
    expect(res.compliancePct).toBe(33); // 1 de 3 aplicaveis
  });

  it('assessRequirement: cria avaliacao e calcula proxima por periodicidade', async () => {
    const { service, prisma } = makeService({ requirement: { id: 'r1', companyId: 'companyA', periodicityDays: 30, assessments: [] } });
    await service.assessRequirement(me, 'r1', { result: 'MET', assessedAt: '2026-01-01' });
    const data = prisma.foodSafetyRequirementAssessment.create.mock.calls[0][0].data;
    expect(data.result).toBe('MET');
    expect(data.requirementId).toBe('r1');
    expect(data.nextAssessmentAt).toBeInstanceOf(Date);
  });

  it('updateVersion -> ACTIVE: supersede as demais versoes ativas da norma', async () => {
    const { service, prisma } = makeService({ version: { id: 'ver1', companyId: 'companyA', standardId: 'std1', standard: {} } });
    await service.updateVersion(me, 'ver1', { status: 'ACTIVE' });
    expect(prisma.foodSafetyStandardVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ standardId: 'std1', status: 'ACTIVE' }), data: { status: 'SUPERSEDED' } }),
    );
  });

  it('createSupplier: valida area, responsavel e grava escopo da empresa', async () => {
    const { service, prisma, access } = makeService({ program: { id: 'pg1', companyId: 'companyA' }, orgNode: { id: 'areaA' }, user: { id: 'u2' } });
    await service.createSupplier(me, { programId: 'pg1', orgNodeId: 'areaA', responsibleUserId: 'u2', name: 'Fornecedor A', criticality: 'CRITICAL', status: 'APPROVED' });
    expect(access.assertCanWrite).toHaveBeenCalledWith('user-1', 'areaA', 'food-safety', 'create');
    const data = prisma.foodSafetySupplier.create.mock.calls[0][0].data;
    expect(data.companyId).toBe('companyA');
    expect(data.programId).toBe('pg1');
    expect(data.responsibleUserId).toBe('u2');
    expect(data.criticality).toBe('CRITICAL');
    expect(data.status).toBe('APPROVED');
  });

  it('createLot: herda fornecedor/unidade do material e checa processo', async () => {
    const { service, prisma, access } = makeService({
      material: { id: 'mat1', companyId: 'companyA', supplierId: 'sup1', programId: 'pg1', unit: 'kg' },
      supplier: { id: 'sup1', companyId: 'companyA' },
      process: { id: 'pr1', companyId: 'companyA', programId: 'pg1', orgNodeId: 'areaA', steps: [] },
      program: { id: 'pg1', companyId: 'companyA' },
    });
    await service.createLot(me, { materialId: 'mat1', processId: 'pr1', code: 'LT-001', type: 'RECEIVED', quantity: 100 });
    expect(access.assertCanWrite).toHaveBeenCalledWith('user-1', 'areaA', 'food-safety', 'create');
    const data = prisma.foodSafetyLot.create.mock.calls[0][0].data;
    expect(data.companyId).toBe('companyA');
    expect(data.programId).toBe('pg1');
    expect(data.supplierId).toBe('sup1');
    expect(data.unit).toBe('kg');
    expect(data.status).toBe('QUARANTINED');
  });

  it('traceLot: monta rastreabilidade para tras e para frente por profundidade', async () => {
    const { service } = makeService({
      lot: { id: 'lotB', companyId: 'companyA', code: 'B' },
      traceLinks: [
        { id: 'l1', fromLotId: 'lotA', toLotId: 'lotB' },
        { id: 'l2', fromLotId: 'lotB', toLotId: 'lotC' },
        { id: 'l3', fromLotId: 'lotC', toLotId: 'lotD' },
      ],
    });
    const res = await service.traceLot(me, 'lotB', 2);
    expect(res.backwardLotIds).toEqual(['lotA']);
    expect(res.forwardLotIds).toEqual(['lotC', 'lotD']);
    expect(res.forward).toHaveLength(2);
  });

  it('createRecall: sem itens explicitos usa trace forward para simular lotes impactados', async () => {
    const { service, prisma } = makeService({
      lot: { id: 'lotB', companyId: 'companyA', code: 'B', programId: 'pg1', unit: 'kg' },
      program: { id: 'pg1', companyId: 'companyA' },
      traceLinks: [
        { id: 'l1', fromLotId: 'lotB', toLotId: 'lotC' },
        { id: 'l2', fromLotId: 'lotC', toLotId: 'lotD' },
      ],
    });
    await service.createRecall(me, { rootLotId: 'lotB', title: 'Simulado lote B', severity: 'HIGH' });
    const data = prisma.foodSafetyRecall.create.mock.calls[0][0].data;
    expect(data.status).toBe('SIMULATION');
    expect(data.rootLotId).toBe('lotB');
    expect(data.items.create.map((x: any) => x.lotId)).toEqual(['lotB', 'lotC', 'lotD']);
  });

  it('supplierScorecard: calcula score e drivers de risco de fornecedor', async () => {
    const { service } = makeService({
      suppliers: [
        {
          id: 'sup1',
          code: 'F1',
          name: 'Fornecedor Critico',
          status: 'CONDITIONAL',
          criticality: 'CRITICAL',
          score: null,
          documentsStatus: 'pendente',
          nextReviewAt: new Date('2020-01-01'),
          materials: [{ status: 'BLOCKED' }],
          lots: [{ status: 'BLOCKED' }],
          responsible: null,
        },
      ],
    });
    const rows = await service.supplierScorecard(me);
    expect(rows[0].score).toBeLessThan(50);
    expect(rows[0].riskLevel).toBe('CRITICAL');
    expect(rows[0].drivers).toContain('Revisao vencida');
  });

  it('assistantInsights: gera recomendacao quando ha fornecedor critico', async () => {
    const { service } = makeService({
      processes: [],
      hazards: [],
      requirements: [],
      suppliers: [
        {
          id: 'sup1',
          name: 'Fornecedor Bloqueado',
          status: 'BLOCKED',
          criticality: 'HIGH',
          score: null,
          documentsStatus: null,
          nextReviewAt: null,
          materials: [],
          lots: [],
          responsible: null,
        },
      ],
    });
    const result = await service.assistantInsights(me);
    expect(result.insights.some((i) => i.title === 'Fornecedores com score de risco')).toBe(true);
  });

  it('exportData: exporta fornecedores em CSV', async () => {
    const { service } = makeService({
      suppliers: [{ id: 'sup1', code: 'F1', name: 'Fornecedor A', status: 'APPROVED', criticality: 'LOW', score: 92, documentsStatus: 'ok', nextReviewAt: null }],
    });
    const result = await service.exportData(me, 'suppliers');
    expect(result.filename).toContain('fornecedores');
    expect(result.content).toContain('Fornecedor A');
    expect(result.rowCount).toBe(1);
  });

  it('importData: importa fornecedores em lote e reporta criados', async () => {
    const { service, prisma } = makeService({ program: { id: 'pg1', companyId: 'companyA' } });
    const result = await service.importData(me, { dataset: 'suppliers', programId: 'pg1', rows: [{ name: 'Novo fornecedor' }] });
    expect(result.created).toBe(1);
    expect(prisma.foodSafetySupplier.create).toHaveBeenCalled();
  });
});
