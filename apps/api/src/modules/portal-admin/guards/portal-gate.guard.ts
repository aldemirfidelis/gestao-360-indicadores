import { CanActivate, ExecutionContext, Injectable, Logger, ServiceUnavailableException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PortalConfigService } from '../services/portal-config.service';
import { PORTAL_GATE_KEY, PortalGateMetadata } from '../decorators/portal-gate.decorator';
import { IS_PUBLIC_KEY } from '../../auth/jwt-auth.guard';
import { AuthPayload } from '../../auth/auth.types';
import { PrismaService } from '../../../prisma/prisma.service';
import { canUseCompanyModule } from '../../platform-admin/platform-admin.access';

/**
 * Enforcement de módulos/páginas/funcionalidades + manutenção, derivado da
 * Central de Administração do Portal. Aplicado globalmente, mas com salvaguardas:
 *  - Super Admin nunca é bloqueado (consistente com o overlay do frontend).
 *  - Só avalia quando um recurso (módulo/página/feature) é identificado — login,
 *    /portal/config e demais rotas não-mapeadas nunca são bloqueadas (anti-lockout).
 *  - FAIL-OPEN: qualquer erro ao resolver a config libera a requisição (nunca derruba a API).
 */
@Injectable()
export class PortalGateGuard implements CanActivate {
  private readonly logger = new Logger(PortalGateGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: PortalConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user: AuthPayload | undefined = req.user;

    // Super Admin nunca é bloqueado.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const gateMeta = this.reflector.getAllAndOverride<PortalGateMetadata | undefined>(PORTAL_GATE_KEY, [context.getHandler(), context.getClass()]);
    let moduleCode = gateMeta?.module;
    const pageCode = gateMeta?.page;
    const featureCode = gateMeta?.feature;

    if (!moduleCode && !pageCode && !featureCode) {
      moduleCode = this.inferModule(req.url ?? '');
    }
    // Nenhum recurso identificado => não há o que aplicar (não bloqueia login/config/etc.).
    if (!moduleCode && !pageCode && !featureCode) return true;

    if (moduleCode && user?.companyId) {
      const assignment = await this.prisma.platformCompanyModule
        .findUnique({ where: { companyId_moduleCode: { companyId: user.companyId, moduleCode } } })
        .catch(() => null);
      if (assignment) {
        const decision = canUseCompanyModule(assignment.status, req.method);
        if (!decision.allowed) {
          throw new ForbiddenException(assignment.note || decision.reason || `O modulo "${moduleCode}" nao esta disponivel para esta empresa.`);
        }
      }
    }

    if (user?.role === 'SUPER_ADMIN') return true;

    try {
      const config = await this.configService.getEffectiveConfig(user ?? anonymous());

      if (config.maintenance.global.active) {
        throw new ServiceUnavailableException(config.maintenance.global.message || 'O portal está em manutenção temporária.');
      }

      if (moduleCode) {
        const mod = config.modules.find((m) => m.code === moduleCode);
        if (mod) {
          if (mod.maintenance || config.maintenance.modules.includes(moduleCode)) {
            throw new ServiceUnavailableException(mod.unavailableMessage || `O módulo "${mod.code}" está em manutenção.`);
          }
          if (mod.unavailable) {
            throw new ForbiddenException(mod.unavailableMessage || `O módulo "${mod.code}" está desativado.`);
          }
          if (mod.allowedRoles.length > 0 && user && !mod.allowedRoles.includes(user.role)) {
            throw new ForbiddenException(`Acesso ao módulo "${mod.code}" não autorizado para o seu perfil.`);
          }
        }
      }

      if (pageCode) {
        const page = config.pages.find((p) => p.code === pageCode);
        if (page) {
          if (page.maintenance || config.maintenance.pages.includes(pageCode)) {
            throw new ServiceUnavailableException(page.unavailableMessage || `A página "${page.code}" está em manutenção.`);
          }
          if (page.unavailable) {
            throw new ForbiddenException(page.unavailableMessage || `A página "${page.code}" está bloqueada.`);
          }
          if (page.allowedRoles.length > 0 && user && !page.allowedRoles.includes(user.role)) {
            throw new ForbiddenException(`Acesso à página "${page.code}" não autorizado para o seu perfil.`);
          }
        }
      }

      if (featureCode) {
        const feat = await this.configService.getFeatureState(featureCode);
        if (feat) {
          if (feat.status === 'INACTIVE' || feat.status === 'BLOCKED') {
            throw new ForbiddenException(`A funcionalidade "${featureCode}" está desabilitada.`);
          }
          if (feat.flagKey && !config.flags[feat.flagKey]) {
            throw new ForbiddenException(`A funcionalidade "${featureCode}" requer ativação de flag.`);
          }
        }
      }

      return true;
    } catch (err) {
      // Bloqueios intencionais propagam; erros inesperados liberam (fail-open).
      if (err instanceof ForbiddenException || err instanceof ServiceUnavailableException) throw err;
      this.logger.warn(`PortalGateGuard fail-open: ${(err as Error).message}`);
      return true;
    }
  }

  private inferModule(url: string): string | undefined {
    const map: Array<[string, string]> = [
      ['/api/dashboard', 'dashboard'],
      ['/api/communication', 'communication'],
      ['/api/integrations', 'integrations'],
      ['/api/help', 'help-center'],
      ['/api/indicators', 'indicators'],
      ['/api/results', 'indicators'],
      ['/api/orgnodes', 'org'],
      ['/api/strategy', 'strategy'],
      ['/api/projects', 'projects'],
      ['/api/insights', 'insights'],
      ['/api/deviations', 'deviations'],
      ['/api/treatments', 'treatments'],
      ['/api/imports', 'imports'],
      ['/api/periods', 'periods'],
      ['/api/actions', 'actions'],
      ['/api/meetings', 'meetings'],
      ['/api/okrs', 'okrs'],
      ['/api/risks', 'risks'],
      ['/api/nonconformities', 'nonconformities'],
      ['/api/documents', 'documents'],
      ['/api/wopi', 'documents'],
      ['/api/audits', 'audits'],
      ['/api/processes', 'processes'],
      ['/api/forms', 'forms'],
      ['/api/reports', 'reports'],
      ['/api/audit', 'audit'],
      ['/api/users', 'users'],
      ['/api/access', 'access-control'],
      ['/api/admin/database', 'database-admin'],
      ['/api/admin/portal', 'portal-admin'],
    ];
    for (const [prefix, code] of map) if (url.startsWith(prefix)) return code;
    return undefined;
  }
}

function anonymous(): AuthPayload {
  return { sub: 'anonymous', email: 'anonymous@local', name: 'Anonymous', role: 'VIEWER', companyId: '' };
}
