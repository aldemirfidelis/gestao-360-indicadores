import { describe, expect, it, vi } from 'vitest';
import { ApiKeyGuard } from './api-key.guard';

function context(ip: string) {
  const request: any = { headers: { 'x-api-key': 'secret' }, ip, socket: {} };
  return {
    request,
    value: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
    } as any,
  };
}

function activeKey(overrides: Record<string, unknown> = {}) {
  return {
    id: 'key-1', companyId: 'company-1', scopes: ['results:write'], status: 'active', expiresAt: null,
    allowedIps: [], rateLimitPerMinute: null, ...overrides,
  };
}

describe('ApiKeyGuard - protecoes por chave', () => {
  it('recusa IP fora da lista autorizada', async () => {
    const prisma: any = { inboundApiKey: { findUnique: vi.fn().mockResolvedValue(activeKey({ allowedIps: ['203.0.113.10'] })), update: vi.fn() } };
    const reflector: any = { getAllAndOverride: vi.fn().mockReturnValue([]) };
    const guard = new ApiKeyGuard(reflector, prisma);
    const ctx = context('203.0.113.11');

    await expect(guard.canActivate(ctx.value)).rejects.toThrow('IP nao autorizado');
    expect(prisma.inboundApiKey.update).not.toHaveBeenCalled();
  });

  it('aplica limite por minuto individual e registra o IP normalizado', async () => {
    const prisma: any = {
      inboundApiKey: {
        findUnique: vi.fn().mockResolvedValue(activeKey({ rateLimitPerMinute: 1 })),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const reflector: any = { getAllAndOverride: vi.fn().mockReturnValue([]) };
    const guard = new ApiKeyGuard(reflector, prisma);
    const first = context('::ffff:198.51.100.20');
    const second = context('::ffff:198.51.100.20');

    await expect(guard.canActivate(first.value)).resolves.toBe(true);
    await expect(guard.canActivate(second.value)).rejects.toThrow('Limite por minuto');
    expect(prisma.inboundApiKey.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lastUsedIp: '198.51.100.20' }),
    }));
  });
});
