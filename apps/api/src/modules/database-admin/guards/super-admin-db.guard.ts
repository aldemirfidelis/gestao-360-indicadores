import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UserRoleEnum } from '@prisma/client';
import { AuthPayload } from '../../auth/auth.types';
import { DbAdminAuditService } from '../services/db-admin-audit.service';
import { DB_ADMIN_SUBMENU_KEY } from '../decorators/db-admin-submenu.decorator';

/**
 * Gate de acesso do módulo de Administração do Banco de Dados.
 *
 * - Exige autenticação (o JwtAuthGuard global já populou req.user) E role SUPER_ADMIN.
 * - Registra TODA tentativa (permitida e negada) em DbAdminAuditLog. Por isso o gate
 *   fica AQUI e não em @Roles(): se usássemos o RolesGuard global, a negação
 *   curto-circuitaria antes de logarmos. Bloqueia acesso direto por URL/endpoint.
 */
@Injectable()
export class SuperAdminDbGuard implements CanActivate {
  constructor(
    private readonly audit: DbAdminAuditService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthPayload }>();
    const user = req.user;
    const submenu =
      this.reflector.getAllAndOverride<string>(DB_ADMIN_SUBMENU_KEY, [context.getHandler(), context.getClass()]) ??
      'overview';

    const isSuperAdmin = user?.role === UserRoleEnum.SUPER_ADMIN;
    if (!isSuperAdmin) {
      await this.audit.record({
        user,
        submenu,
        action: 'DENIED',
        result: 'DENIED',
        message: `Acesso negado a ${req.method} ${req.originalUrl}`,
        ip: req.ip,
        userAgent: req.headers['user-agent'] ?? null,
      });
      throw new ForbiddenException('Acesso restrito ao Super Admin.');
    }
    return true;
  }
}
