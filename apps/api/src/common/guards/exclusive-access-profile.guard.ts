import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthPayload } from '../../modules/auth/auth.types';
import { IS_PUBLIC_KEY } from '../../modules/auth/jwt-auth.guard';

/**
 * Perfis de terminal compartilhado não são usuários comuns. Mesmo que uma
 * rota autenticada não declare @RequirePermissions, o perfil TOTEM só pode
 * manter a sessão e abrir os endpoints públicos do dispositivo de ponto.
 */
@Injectable()
export class ExclusiveAccessProfileGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      user?: AuthPayload;
      originalUrl?: string;
      path?: string;
    }>();
    if (request.user?.accessProfileCode !== 'TOTEM') return true;

    const pathname = String(request.originalUrl ?? request.path ?? '').split('?')[0];
    if (pathname.endsWith('/auth/me') || pathname.endsWith('/auth/logout')) return true;

    throw new ForbiddenException('Perfil Totem possui acesso exclusivo ao terminal de ponto.');
  }
}
