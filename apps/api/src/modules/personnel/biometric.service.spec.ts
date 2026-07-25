import { createHash } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BiometricService } from './biometric.service';

const me = {
  sub: 'operator-1',
  companyId: 'company-1',
  email: 'rh@example.com',
  name: 'Responsável RH',
  role: 'MANAGER',
} as any;

const faceSample = (offset = 0) =>
  Array.from({ length: 128 }, (_, index) => ((index % 9) + 1) / 100 + offset);

describe('BiometricService employee enrollment', () => {
  let prisma: any;
  let audit: any;
  let service: BiometricService;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-secret-for-biometric-service';
    prisma = {
      orgEmployee: { findMany: vi.fn(), findFirst: vi.fn() },
      personnelBiometricChallenge: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      personnelBiometricProfile: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      personnelEmployeeProfile: {
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    service = new BiometricService(prisma, audit, {} as any);
  });

  it('lista a situação facial usando o colaborador como entidade principal', async () => {
    prisma.orgEmployee.findMany.mockResolvedValue([
      {
        id: 'employee-1',
        name: 'Ana Operadora',
        registrationId: '0001',
        status: 'ACTIVE',
        biometricProfile: { status: 'ACTIVE' },
      },
      {
        id: 'employee-2',
        name: 'Bruno Operador',
        registrationId: '0002',
        status: 'ACTIVE',
        biometricProfile: null,
      },
    ]);

    const result = await service.listEmployeeProfiles(me);

    expect(result.summary).toEqual({ total: 2, active: 1, pending: 1 });
    expect(prisma.orgEmployee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-1' }) }),
    );
  });

  it('vincula o descritor à matrícula e reaproveita a identidade técnica existente', async () => {
    const employee = {
      id: 'employee-1',
      companyId: 'company-1',
      name: 'Ana Operadora',
      registrationId: '0001',
      status: 'ACTIVE',
      orgNodeId: null,
      personnelProfile: { id: 'profile-1', userId: 'clock-user-1' },
    };
    prisma.orgEmployee.findFirst.mockResolvedValue(employee);
    prisma.personnelBiometricChallenge.create.mockImplementation(({ data }: any) => ({
      id: 'challenge-1',
      purpose: data.purpose,
      expiresAt: data.expiresAt,
    }));

    const challenge = await service.employeeEnrollmentChallenge(me, employee.id);
    prisma.personnelBiometricChallenge.findFirst.mockResolvedValue({
      id: challenge.id,
      nonceHash: createHash('sha256').update(challenge.nonce).digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'clock-user-1',
      active: true,
      serviceAccount: true,
    });
    prisma.personnelBiometricProfile.findFirst.mockResolvedValue(null);
    prisma.personnelBiometricProfile.create.mockResolvedValue({
      id: 'biometric-1',
      status: 'ACTIVE',
      enrolledAt: new Date(),
      sampleCount: 3,
    });

    await service.enrollEmployee(me, employee.id, {
      challengeId: challenge.id,
      nonce: challenge.nonce,
      descriptors: [faceSample(), faceSample(0.001), faceSample(-0.001)],
      acceptedPrivacyNotice: true,
      noticeVersion: challenge.noticeVersion,
    });

    const data = prisma.personnelBiometricProfile.create.mock.calls[0][0].data;
    expect(data.employeeId).toBe('employee-1');
    expect(data.userId).toBe('clock-user-1');
    expect(data.descriptorEnc).toMatch(/^v1:/);
    expect(data).not.toHaveProperty('descriptors');
    expect(audit.record).toHaveBeenCalledWith(
      me,
      expect.objectContaining({
        action: 'BIOMETRIC_EMPLOYEE_ENROLLED',
        after: expect.objectContaining({ employeeId: 'employee-1', registrationId: '0001' }),
      }),
    );
  });

  it('cadastra colaborador sem conta de portal criando apenas identidade bloqueada para login', async () => {
    const employee = {
      id: 'employee-2',
      companyId: 'company-1',
      name: 'Bruno Operador',
      registrationId: '0002',
      status: 'ACTIVE',
      orgNodeId: 'node-1',
      personnelProfile: null,
    };
    prisma.orgEmployee.findFirst.mockResolvedValue(employee);
    prisma.personnelBiometricChallenge.create.mockImplementation(({ data }: any) => ({
      id: 'challenge-2',
      purpose: data.purpose,
      expiresAt: data.expiresAt,
    }));
    const challenge = await service.employeeEnrollmentChallenge(me, employee.id);
    prisma.personnelBiometricChallenge.findFirst.mockResolvedValue({
      id: challenge.id,
      nonceHash: createHash('sha256').update(challenge.nonce).digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    prisma.personnelEmployeeProfile.create.mockResolvedValue({ id: 'profile-2', userId: null });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'clock-user-2' });
    prisma.personnelBiometricProfile.findFirst.mockResolvedValue(null);
    prisma.personnelBiometricProfile.create.mockResolvedValue({
      id: 'biometric-2',
      status: 'ACTIVE',
      enrolledAt: new Date(),
      sampleCount: 3,
    });

    await service.enrollEmployee(me, employee.id, {
      challengeId: challenge.id,
      nonce: challenge.nonce,
      descriptors: [faceSample(), faceSample(0.001), faceSample(-0.001)],
      acceptedPrivacyNotice: true,
      noticeVersion: challenge.noticeVersion,
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-1',
        name: 'Bruno Operador',
        active: true,
        status: 'BLOCKED',
        serviceAccount: true,
        defaultNodeId: 'node-1',
      }),
    });
    expect(prisma.personnelEmployeeProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile-2' },
      data: { userId: 'clock-user-2' },
    });
    expect(prisma.personnelBiometricProfile.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ employeeId: 'employee-2', userId: 'clock-user-2' }),
    );
  });
});
