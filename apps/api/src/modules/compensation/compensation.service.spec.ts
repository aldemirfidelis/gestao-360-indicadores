import { ConflictException } from '@nestjs/common';
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
    const service = new CompensationService(prisma);
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
    const service = new CompensationService({} as any);

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
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const service = new CompensationService(prisma);
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
});

