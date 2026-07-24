import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../../modules/auth/jwt-auth.guard';
import { ExclusiveAccessProfileGuard } from './exclusive-access-profile.guard';

function context(user: any, originalUrl: string) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({ user, originalUrl }),
    }),
  } as any;
}

describe('ExclusiveAccessProfileGuard', () => {
  it('blocks an authenticated Totem session outside authentication endpoints', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };
    const guard = new ExclusiveAccessProfileGuard(reflector as any);

    expect(() =>
      guard.canActivate(context({ accessProfileCode: 'TOTEM' }, '/api/my-day')),
    ).toThrow(ForbiddenException);
  });

  it('allows the Totem session to refresh its own profile', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };
    const guard = new ExclusiveAccessProfileGuard(reflector as any);

    expect(guard.canActivate(context({ accessProfileCode: 'TOTEM' }, '/api/auth/me'))).toBe(true);
  });

  it('does not interfere with public kiosk device requests', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key: string) => key === IS_PUBLIC_KEY),
    };
    const guard = new ExclusiveAccessProfileGuard(reflector as any);

    expect(
      guard.canActivate(context(undefined, '/api/personnel/kiosk/identify-punch')),
    ).toBe(true);
  });
});
