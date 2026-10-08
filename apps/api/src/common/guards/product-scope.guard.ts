import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isDemoReadAllowed, isProductApiActive, PUBLIC_DEMO_PROFILE } from '@g360/shared';
import { AuthPayload } from '../../modules/auth/auth.types';

@Injectable()
export class ProductScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<{ originalUrl: string; method: string; user?: AuthPayload }>();
    const prefix = `/${process.env.API_PREFIX ?? 'api'}`;
    const url = req.originalUrl.split('?')[0];
    const path = url.startsWith(`${prefix}/`) ? url.slice(prefix.length) : url;
    if (!isProductApiActive(path)) throw new NotFoundException('Módulo aguardando reativação.');
    if (req.user?.accessProfileCode === PUBLIC_DEMO_PROFILE) {
      if (req.method === 'POST' && path === '/auth/logout') return true;
      if (!['GET', 'HEAD'].includes(req.method) || !isDemoReadAllowed(path)) {
        throw new ForbiddenException('A demonstração permite apenas consulta dos módulos apresentados.');
      }
    }
    return true;
  }
}
