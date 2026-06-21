import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CompensationService } from './compensation.service';
import type { AuthPayload } from '../auth/auth.types';

const me: AuthPayload = {
  sub: 'user-1',
  email: 'rh@example.com',
  name: 'RH',
  role: 'MANAGER',
  companyId: 'company-1',
};

// Stub do NotificationsService: as notificacoes sao best-effort e nao afetam os testes.
const notificationsStub: any = { create: vi.fn().mockResolvedValue({}) };
// Stub do DocumentsService: usado apenas no export para o GED.
const documentsStub: any = { create: vi.fn().mockResolvedValue({ id: 'doc-1', code: 'DOC-1' }) };

describe('CompensationService', () => {
  it('masks individual salary when user has no nominal permission', async () => {
    const prisma: any = {
      orgEmployee: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'emp-1',
            registrationId: '123',
            name: 'Ana',
            band: 'B',
            orgNode: { name: 'RH' },
            job: { id: 'job-1', name: 'Analista' },
          },
        ]),
      },
      compensationPosition: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new CompensationService(prisma, notificationsStub, documentsStub);
    (service as any).ensureBaseline = vi.fn();
    (service as any).hasAnyPermission = vi.fn().mockResolvedValue(false);
    (service as any).latestSalarySnapshots = vi.fn().mockResolvedValue([
      {
        employeeId: 'emp-1',
        currentSalary: new Prisma.Decimal(4000),
        effectiveFrom: new Date('2026-01-01'),
        salaryRange: {
          minSalary: new Prisma.Decimal(3000),
          midpointSalary: new Prisma.Decimal(4000),
          maxSalary: new Prisma.Decimal(5000),
          band: 'B',
        },
      },
    ]);

    const rows = await service.salaryFit(me, {});

    expect(rows[0].salaryMasked).toBe(true);
    expect(rows[0].currentSalary).toBeNull();
    expect(rows[0].compaRatio).toBeNull();
    expect(rows[0].situation).toBe('PROXIMO_AO_PONTO_MEDIO');
  });

  it('blocks movement when proposed impact exceeds available budget', async () => {
    const service = new CompensationService({} as any, notificationsStub, documentsStub);

    await expect(
      service.createMovement(me, {
        type: 'PROMOCAO',
        currentSalary: 5000,
        proposedSalary: 6200,
        availableBudget: 500,
        effectiveAt: '2026-07-01',
        reason: 'Promocao aprovada no ciclo',
        justification: 'Impacto acima do saldo deve ser bloqueado',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('calculates monthly and annual impact when creating a movement', async () => {
    const created = { id: 'mov-1', protocol: 'MOV-2026-0001' };
    const prisma: any = {
      compensationMovementRequest: { create: vi.fn().mockResolvedValue(created) },
      orgEmployee: { findFirst: vi.fn().mockResolvedValue({ id: 'emp-1' }) },
      compensationPosition: { findFirst: vi.fn().mockResolvedValue(null) },
      orgJob: { findFirst: vi.fn().mockResolvedValue(null) },
      user: { findFirst: vi.fn().mockResolvedValue(null) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const service = new CompensationService(prisma, notificationsStub, documentsStub);
    (service as any).nextMovementProtocol = vi.fn().mockResolvedValue('MOV-2026-0001');

    const result = await service.createMovement(me, {
      type: 'ENQUADRAMENTO',
      employeeId: 'emp-1',
      currentSalary: 5000,
      proposedSalary: 5500,
      availableBudget: 1000,
      effectiveAt: '2026-07-01',
      reason: 'Ajuste de faixa',
      justification: 'Colaborador abaixo do ponto medio',
    });

    expect(result).toBe(created);
    expect(prisma.compensationMovementRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          monthlyImpact: new Prisma.Decimal(500),
          annualImpact: new Prisma.Decimal(6000),
          changePercent: new Prisma.Decimal(0.1),
          status: 'REQUESTED',
        }),
      }),
    );
  });

  it('advances multi-tier approval: stays IN_APPROVAL until the last step approves', async () => {
    const prisma: any = {
      compensationMovementRequest: { update: vi.fn().mockImplementation(({ data }: any) => ({ id: 'mov-1', protocol: 'MOV-1', ...data })) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'a' }) },
    };
    const service = new CompensationService(prisma, notificationsStub, documentsStub);
    (service as any).getMovement = vi.fn().mockResolvedValue({
      id: 'mov-1',
      protocol: 'MOV-1',
      status: 'REQUESTED',
      requesterId: 'req-1',
      notes: null,
      approvalSteps: [
        { role: 'RH', status: 'PENDING' },
        { role: 'GESTOR', status: 'PENDING' },
      ],
    });

    const afterFirst = await service.decideMovement(me, 'mov-1', 'APPROVED', '');
    expect(afterFirst.status).toBe('IN_APPROVAL');
    const stepsAfterFirst = afterFirst.approvalSteps as any[];
    expect(stepsAfterFirst[0].status).toBe('APPROVED');
    expect(stepsAfterFirst[1].status).toBe('PENDING');
  });

  it('rejects a movement at any approval step', async () => {
    const prisma: any = {
      compensationMovementRequest: { update: vi.fn().mockImplementation(({ data }: any) => ({ id: 'mov-2', protocol: 'MOV-2', ...data })) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'a' }) },
    };
    const service = new CompensationService(prisma, notificationsStub, documentsStub);
    (service as any).getMovement = vi.fn().mockResolvedValue({
      id: 'mov-2',
      protocol: 'MOV-2',
      status: 'IN_APPROVAL',
      requesterId: 'req-1',
      notes: null,
      approvalSteps: [{ role: 'RH', status: 'APPROVED' }, { role: 'GESTOR', status: 'PENDING' }],
    });

    const rejected = await service.decideMovement(me, 'mov-2', 'REJECTED', 'Fora da política');
    expect(rejected.status).toBe('REJECTED');
  });

  it('blocks movement creation with employee from another company', async () => {
    const prisma: any = {
      compensationMovementRequest: { create: vi.fn() },
      orgEmployee: { findFirst: vi.fn().mockResolvedValue(null) },
      compensationPosition: { findFirst: vi.fn().mockResolvedValue(null) },
      orgJob: { findFirst: vi.fn().mockResolvedValue(null) },
      user: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new CompensationService(prisma, notificationsStub, documentsStub);
    (service as any).nextMovementProtocol = vi.fn().mockResolvedValue('MOV-2026-0002');

    await expect(
      service.createMovement(me, {
        type: 'ENQUADRAMENTO',
        employeeId: 'emp-other',
        effectiveAt: '2026-07-01',
        reason: 'Ajuste de faixa',
        justification: 'Nao deve aceitar colaborador de outra empresa',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.orgEmployee.findFirst).toHaveBeenCalledWith({
      where: { id: 'emp-other', companyId: 'company-1' },
      select: { id: true },
    });
    expect(prisma.compensationMovementRequest.create).not.toHaveBeenCalled();
  });

  it('applies movement without updating a target position from another company', async () => {
    const tx: any = {
      orgEmployee: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      compensationPosition: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      compensationSalarySnapshot: { create: vi.fn() },
      compensationAllocationHistory: { create: vi.fn() },
      compensationMovementRequest: { update: vi.fn() },
    };
    const prisma: any = {
      $transaction: vi.fn(async (fn: any) => fn(tx)),
      auditLog: { create: vi.fn() },
    };
    const service = new CompensationService(prisma, notificationsStub, documentsStub);
    (service as any).getMovement = vi.fn().mockResolvedValue({
      id: 'mov-1',
      protocol: 'MOV-1',
      status: 'APPROVED',
      requesterId: 'req-1',
      employeeId: 'emp-1',
      targetPositionId: 'pos-other',
      targetJobId: null,
      currentJobId: null,
      targetBand: null,
      proposedSalary: null,
      effectiveAt: new Date('2026-07-01'),
      reason: 'Ajuste',
      justification: 'Teste',
    });

    await expect(service.applyMovement(me, 'mov-1')).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.compensationPosition.updateMany).toHaveBeenCalledWith({
      where: { id: 'pos-other', companyId: 'company-1', deletedAt: null },
      data: expect.objectContaining({ currentEmployeeId: 'emp-1' }),
    });
    expect(tx.compensationMovementRequest.update).not.toHaveBeenCalled();
  });

  it('checks movement permissions only on the current company user', async () => {
    const prisma: any = {
      user: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new CompensationService(prisma, notificationsStub, documentsStub);

    const allowed = await (service as any).hasAnyPermission(me, ['compensation:movements:approve']);

    expect(allowed).toBe(false);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'user-1', companyId: 'company-1' },
      select: {
        role: true,
        permissions: { select: { permission: { select: { key: true } } } },
        accessProfile: { select: { permissions: { select: { permission: { select: { key: true } } } } } },
      },
    });
  });
});
