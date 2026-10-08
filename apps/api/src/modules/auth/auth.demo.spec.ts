import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PUBLIC_DEMO_EMAIL, PUBLIC_DEMO_PROFILE, PUBLIC_DEMO_COMPANY_SLUG } from '@g360/shared';

describe('login público exclusivo da demonstração', () => {
  const user = { id: 'visitor', email: PUBLIC_DEMO_EMAIL, name: 'Visitante', companyId: 'demo-company', role: 'COMPANY_ADMIN', active: true, status: 'ACTIVE', deletedAt: null, activeCompanyId: null, accessProfile: { code: PUBLIC_DEMO_PROFILE }, company: { slug: PUBLIC_DEMO_COMPANY_SLUG, status: 'ACTIVE', deletedAt: null } };
  function fixture(value: unknown) {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(value) }, refreshToken: { create: vi.fn() } };
    const jwt = { signAsync: vi.fn().mockResolvedValue('short-lived-demo-token') };
    const service = new AuthService(prisma as never, jwt as never, {} as never);
    vi.spyOn(service, 'userProfile' as never).mockResolvedValue({ isDemo: true, companyId: user.companyId } as never);
    return { prisma, jwt, service };
  }
  it('não aceita empresa ou usuário fornecidos pelo visitante e não persiste refresh', async () => {
    const { prisma, jwt, service } = fixture(user);
    process.env.JWT_ACCESS_SECRET = 'test-demo-secret-with-at-least-32-characters';
    const result = await service.demo();
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: PUBLIC_DEMO_EMAIL } }));
    expect(jwt.signAsync).toHaveBeenCalledWith(expect.objectContaining({ companyId: 'demo-company', accessProfileCode: PUBLIC_DEMO_PROFILE }), expect.objectContaining({ expiresIn: '1h' }));
    expect(result.refreshToken).toBe('');
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });
  it.each([null, { ...user, active: false }, { ...user, role: 'SUPER_ADMIN' }, { ...user, activeCompanyId: 'other-company' }, { ...user, accessProfile: { code: 'ADMIN' } }, { ...user, company: { ...user.company, slug: 'other-company' } }, { ...user, company: { ...user.company, status: 'SUSPENDED' } }])('falha fechada se a identidade reservada é inválida', async value => {
    const { service, jwt } = fixture(value);
    await expect(service.demo()).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
});
