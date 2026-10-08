import { describe, expect, it } from 'vitest';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProductScopeGuard } from './product-scope.guard';
import { PUBLIC_DEMO_PROFILE, isDemoReadAllowed, isProductRouteActive } from '@g360/shared';

function context(path: string, method = 'GET', demo = true): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ originalUrl: `/api${path}`, method, user: demo ? { accessProfileCode: PUBLIC_DEMO_PROFILE, role: 'COMPANY_ADMIN' } : { role: 'SUPER_ADMIN' } }) }),
  } as ExecutionContext;
}

describe('escopo de produto e demonstração', () => {
  const guard = new ProductScopeGuard();
  it.each(['/indicators', '/strategy', '/tasks/board', '/monthly-results', '/prize/overview', '/auth/me', '/portal/config'])('permite consultar %s', path => {
    expect(guard.canActivate(context(path))).toBe(true);
  });
  it.each(['POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'])('bloqueia escrita %s mesmo com papel administrativo', method => {
    expect(() => guard.canActivate(context('/indicators', method))).toThrow(ForbiddenException);
  });
  it.each(['/users', '/companies', '/platform/switch', '/database-admin', '/ai', '/prize/eligible/connectors', '/prize/eligible/jobs'])('bloqueia infraestrutura sensível %s', path => {
    expect(() => guard.canActivate(context(path))).toThrow(ForbiddenException);
  });
  it.each(['/documents/123', '/risks', '/forms', '/personnel', '/strategy/employees', '/actions/general-approvals', '/communication/conversations', '/communication/me/profile'])('módulo suspenso %s não é acessível nem para super admin', path => {
    expect(() => guard.canActivate(context(path, 'GET', false))).toThrow(NotFoundException);
  });
  it('mantém logout e as operações normais de clientes fora da demo', () => {
    expect(guard.canActivate(context('/auth/logout', 'POST'))).toBe(true);
    expect(guard.canActivate(context('/indicators', 'POST', false))).toBe(true);
  });
  it('usa limites de rota, sem confundir prefixos parecidos', () => {
    expect(isProductRouteActive('/documents/123?view=1')).toBe(false);
    expect(isProductRouteActive('/documents-other')).toBe(true);
    expect(isDemoReadAllowed('/auth/me-other')).toBe(false);
    expect(isDemoReadAllowed('/indicators-other')).toBe(false);
  });
});
