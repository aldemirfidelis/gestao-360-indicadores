import { lastValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuditInterceptor } from './audit.interceptor';

function contextFor(body: unknown) {
  const handler = () => undefined;
  class TestController {}
  const request = {
    method: 'POST',
    path: '/api/personnel/kiosk/identify-punch',
    originalUrl: '/api/personnel/kiosk/identify-punch',
    body,
    params: {},
    query: {},
    headers: { 'user-agent': 'unit-test' },
    ip: '127.0.0.1',
  };
  return {
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler,
      getClass: () => TestController,
    } as any,
  };
}

describe('AuditInterceptor - sensitive request bodies', () => {
  it('suppresses the complete body when @SensitiveBody metadata is active', async () => {
    const create = vi.fn().mockResolvedValue({});
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(true) };
    const interceptor = new AuditInterceptor({ auditLog: { create } } as any, reflector as any);
    const body = {
      deviceToken: 'raw-device-token-sentinel',
      descriptor: ['raw-face-descriptor-sentinel'],
      nonce: 'raw-nonce-sentinel',
      harmless: 'this is intentionally suppressed too',
    };
    const { context } = contextFor(body);

    await lastValueFrom(interceptor.intercept(context, { handle: () => of({ ok: true }) } as any));

    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    const persisted = JSON.stringify(data);
    expect(data.afterValue).toBe(JSON.stringify({ body: '[redacted-sensitive-body]' }));
    expect(JSON.parse(data.payload)).toMatchObject({ bodySuppressed: true });
    expect(persisted).not.toContain('raw-device-token-sentinel');
    expect(persisted).not.toContain('raw-face-descriptor-sentinel');
    expect(persisted).not.toContain('raw-nonce-sentinel');
  });

  it('still redacts biometric fields when metadata is absent', async () => {
    const create = vi.fn().mockResolvedValue({});
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };
    const interceptor = new AuditInterceptor({ auditLog: { create } } as any, reflector as any);
    const { context } = contextFor({
      ordinaryField: 'auditable-value',
      deviceToken: 'raw-device-token-sentinel',
      descriptor: ['raw-face-descriptor-sentinel'],
      challengeId: 'raw-challenge-sentinel',
    });

    await lastValueFrom(interceptor.intercept(context, { handle: () => of({ ok: true }) } as any));

    const data = create.mock.calls[0][0].data;
    const storedBody = JSON.parse(data.afterValue);
    expect(storedBody.ordinaryField).toBe('auditable-value');
    expect(storedBody.deviceToken).toBe('[redacted]');
    expect(storedBody.descriptor).toBe('[redacted]');
    expect(storedBody.challengeId).toBe('[redacted]');
    expect(JSON.stringify(data)).not.toContain('raw-device-token-sentinel');
    expect(JSON.stringify(data)).not.toContain('raw-face-descriptor-sentinel');
    expect(JSON.stringify(data)).not.toContain('raw-challenge-sentinel');
  });

  it('does not persist an exception message that accidentally echoes sensitive input', async () => {
    const create = vi.fn().mockResolvedValue({});
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(true) };
    const interceptor = new AuditInterceptor({ auditLog: { create } } as any, reflector as any);
    const { context } = contextFor({ deviceToken: 'echoed-secret-sentinel' });

    await expect(
      lastValueFrom(
        interceptor.intercept(context, {
          handle: () => throwError(() => ({ status: 400, message: 'invalid echoed-secret-sentinel' })),
        } as any),
      ),
    ).rejects.toMatchObject({ status: 400 });

    const data = create.mock.calls[0][0].data;
    expect(data.result).toBe('ERROR');
    expect(data.afterValue).toBe(JSON.stringify({ body: '[redacted-sensitive-body]' }));
    expect(JSON.stringify(data)).not.toContain('echoed-secret-sentinel');
  });
});
