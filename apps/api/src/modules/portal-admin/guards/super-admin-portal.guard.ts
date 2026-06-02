import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UserRoleEnum } from '@prisma/client';
import { AuthPayload } from '../../auth/auth.types';
import { PortalAuditService } from '../services/portal-audit.service';
import { PORTAL_TAB_KEY } from '../decorators/portal-tab.decorator';

/**
 * Gate da Central de Administração do Portal. Exige SUPER_ADMIN e audita TODA
 * tentativa (inclusive negada). Não usa @Roles para que negações cheguem ao log.
 */
@Injectable()
export class SuperAdminPortalGuard implements CanActivate {
  constructor(
    private readonly audit: PortalAuditService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthPayload }>();
    const user = req.user;
    const tab = this.reflector.getAllAndOverride<string>(PORTAL_TAB_KEY, [context.getHandler(), context.getClass()]) ?? 'overview';
    if (user?.role !== UserRoleEnum.SUPER_ADMIN) {
      await this.audit.record({
        user, tab, action: 'DENIED', result: 'DENIED',
        message: `Acesso negado a ${req.method} ${req.originalUrl}`,
        ip: req.ip, userAgent: req.headers['user-agent'] ?? null,
      });
      throw new ForbiddenException('Acesso restrito ao Super Admin.');
    }
    return true;
  }
}
