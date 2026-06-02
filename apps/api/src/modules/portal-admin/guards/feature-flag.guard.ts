import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthPayload } from '../../auth/auth.types';
import { FeatureFlagService } from '../services/feature-flag.service';

export const REQUIRE_FEATURE_KEY = 'requireFeature';

/**
 * Marca um endpoint como dependente de uma feature flag. Se a flag estiver
 * desabilitada para o usuário, o endpoint é recusado (enforcement real no backend).
 * Uso: `@UseGuards(FeatureFlagGuard) @RequireFeature('enable_x')`.
 * Reutilizável por qualquer módulo que importe PortalAdminModule (exporta FeatureFlagService).
 */
export const RequireFeature = (key: string) => SetMetadata(REQUIRE_FEATURE_KEY, key);

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private readonly flags: FeatureFlagService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = this.reflector.getAllAndOverride<string>(REQUIRE_FEATURE_KEY, [context.getHandler(), context.getClass()]);
    if (!key) return true;
    const req = context.switchToHttp().getRequest<{ user?: AuthPayload }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Não autenticado.');
    const ok = await this.flags.isEnabled(key, {
      userId: user.sub, role: user.role, environment: process.env.NODE_ENV ?? 'development',
      scopeIds: [user.companyId, user.sub, user.role].filter(Boolean) as string[],
    });
    if (!ok) throw new ForbiddenException(`Funcionalidade "${key}" indisponível.`);
    return true;
  }
}
