import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, PreconditionFailedException } from '@nestjs/common';
import { KioskService } from './kiosk.service';

describe('KioskService security boundary', () => {
  const originalFlag = process.env.PERSONNEL_KIOSK_ENABLED;
  let prisma: any;
  let service: KioskService;

  beforeEach(() => {
    process.env.PERSONNEL_KIOSK_ENABLED = 'true';
    prisma = {
      personnelKioskDevice: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'device-1',
          companyId: 'company-1',
          active: true,
          tokenExpiresAt: new Date(Date.now() + 60_000),
          branchId: null,
          latitude: null,
          longitude: null,
          radiusMeters: null,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      personnelKioskChallenge: {
        create: vi.fn().mockResolvedValue({ id: 'challenge-1', expiresAt: new Date(Date.now() + 60_000) }),
        updateMany: vi.fn(),
      },
      timeClockEntry: { findFirst: vi.fn().mockResolvedValue(null) },
      personnelBiometricProfile: { findMany: vi.fn() },
    };
    service = new KioskService(prisma, { record: vi.fn() } as any, {} as any);
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.PERSONNEL_KIOSK_ENABLED;
    else process.env.PERSONNEL_KIOSK_ENABLED = originalFlag;
  });

  it('mantém o piloto bloqueado por padrão', async () => {
    process.env.PERSONNEL_KIOSK_ENABLED = 'false';
    await expect(service.challenge('x'.repeat(43))).rejects.toBeInstanceOf(PreconditionFailedException);
    expect(prisma.personnelKioskDevice.findUnique).not.toHaveBeenCalled();
  });

  it('emite nonce de uso único e persiste somente seu hash', async () => {
    const result = await service.challenge('x'.repeat(43));
    expect(result.nonce).toHaveLength(43);
    const data = prisma.personnelKioskChallenge.create.mock.calls[0][0].data;
    expect(data.nonceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(data.nonceHash).not.toBe(result.nonce);
    expect(data.deviceId).toBe('device-1');
  });

  it('rejeita challenge expirado/usado antes de consultar templates faciais', async () => {
    prisma.personnelKioskChallenge.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.identifyAndPunch(
        'x'.repeat(43),
        {
          syncId: 'sync-12345678',
          challengeId: 'challenge-1',
          nonce: 'n'.repeat(43),
          descriptorVersion: 'face-api-128-v1',
          faceCount: 1,
          detectionScore: 0.95,
          descriptor: Array(128).fill(0.01),
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.personnelBiometricProfile.findMany).not.toHaveBeenCalled();
  });

  it('rejeita credencial expirada com mensagem genérica', async () => {
    prisma.personnelKioskDevice.findUnique.mockResolvedValue({ active: true, tokenExpiresAt: new Date(0) });
    await expect(service.challenge('x'.repeat(43))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
