import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PortalConfigService } from '../services/portal-config.service';
import { PORTAL_GATE_KEY, PortalGateMetadata } from '../decorators/portal-gate.decorator';
import { IS_PUBLIC_KEY } from '../../auth/jwt-auth.guard';
import { AuthPayload } from '../../auth/auth.types';

@Injectable()
export class PortalGateGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: PortalConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Verificar se é rota pública
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest();
    const user: AuthPayload | undefined = req.user;

    // Se for rota pública e não houver usuário, tratamos como anônimo básico
    const mockUser: AuthPayload = user ?? {
      sub: 'anonymous',
      email: 'anonymous@gestao360.com',
      name: 'Anonymous',
      role: 'VIEWER', // Perfil baixo padrão
      companyId: '',
    };

    const isSuper = user?.role === 'SUPER_ADMIN';

    // 2. Resolver metadados explícitos ou tentar inferir via rota
    const gateMeta = this.reflector.getAllAndOverride<PortalGateMetadata | undefined>(PORTAL_GATE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    let moduleCode = gateMeta?.module;
    const pageCode = gateMeta?.page;
    const featureCode = gateMeta?.feature;

    // Fallback: se não tiver decorator explícito, tenta inferir pelo prefixo da URL da API
    if (!moduleCode && !pageCode && !featureCode && req.url) {
      const url = req.url;
      if (url.startsWith('/api/indicators') || url.startsWith('/indicators')) moduleCode = 'indicators';
      else if (url.startsWith('/api/actions') || url.startsWith('/actions')) moduleCode = 'actions';
      else if (url.startsWith('/api/deviations') || url.startsWith('/deviations')) moduleCode = 'deviations';
      else if (url.startsWith('/api/meetings') || url.startsWith('/meetings')) moduleCode = 'meetings';
      else if (url.startsWith('/api/reports') || url.startsWith('/reports')) moduleCode = 'reports';
      else if (url.startsWith('/api/periods') || url.startsWith('/periods')) moduleCode = 'periods';
      else if (url.startsWith('/api/projects') || url.startsWith('/projects')) moduleCode = 'projects';
      else if (url.startsWith('/api/insights') || url.startsWith('/insights')) moduleCode = 'insights';
      else if (url.startsWith('/api/treatments') || url.startsWith('/treatments')) moduleCode = 'treatments';
      else if (url.startsWith('/api/imports') || url.startsWith('/imports')) moduleCode = 'imports';
      else if (url.startsWith('/api/okrs') || url.startsWith('/okrs')) moduleCode = 'okrs';
      else if (url.startsWith('/api/db-admin') || url.startsWith('/db-admin')) moduleCode = 'database-admin';
      else if (url.startsWith('/api/admin/portal')) moduleCode = 'portal-admin';
    }

    // Se nenhum recurso puder ser identificado, e a rota não for pública e não houver usuário,
    // o JwtAuthGuard já cuidou ou vai cuidar. Deixamos passar no gate.
    if (!moduleCode && !pageCode && !featureCode && isPublic) {
      return true;
    }

    // 3. Obter configuração efetiva (overlay resolvido)
    const config = await this.configService.getEffectiveConfig(mockUser);

    // 4. Manutenção Global
    if (config.maintenance.global.active) {
      // Se for Super Admin e a manutenção global permitir acesso excepcional
      if (isSuper && config.maintenance.global.allowSuperAdmin) {
        return true;
      }
      throw new ServiceUnavailableException(
        config.maintenance.global.message || 'O portal está sob manutenção geral temporária.'
      );
    }

    // 5. Validação de Módulo
    if (moduleCode) {
      const mod = config.modules.find((m) => m.code === moduleCode);
      if (mod) {
        // Se estiver em manutenção
        if (mod.maintenance || config.maintenance.modules.includes(moduleCode)) {
          if (isSuper) {
            // Super Admin ignora manutenção de módulo individual
          } else {
            throw new ServiceUnavailableException(
              mod.unavailableMessage || `O módulo "${mod.code}" está temporariamente em manutenção.`
            );
          }
        }
        // Se estiver inativo/bloqueado
        else if (mod.unavailable) {
          throw new ForbiddenException(
            mod.unavailableMessage || `O módulo "${mod.code}" está desativado no portal.`
          );
        }

        // Restrição por perfil
        if (mod.allowedRoles.length > 0 && !isSuper) {
          if (!mod.allowedRoles.includes(mockUser.role)) {
            throw new ForbiddenException(`Acesso ao módulo "${mod.code}" não autorizado para o seu perfil.`);
          }
        }
      }
    }

    // 6. Validação de Página
    if (pageCode) {
      const page = config.pages.find((p) => p.code === pageCode);
      if (page) {
        if (page.maintenance || config.maintenance.pages.includes(pageCode)) {
          if (isSuper) {
            // Super Admin ignora
          } else {
            throw new ServiceUnavailableException(
              page.unavailableMessage || `A página "${page.code}" está em manutenção.`
            );
          }
        } else if (page.unavailable) {
          throw new ForbiddenException(
            page.unavailableMessage || `A página "${page.code}" está temporariamente bloqueada.`
          );
        }

        // Restrição por perfil
        if (page.allowedRoles.length > 0 && !isSuper) {
          if (!page.allowedRoles.includes(mockUser.role)) {
            throw new ForbiddenException(`Acesso à página "${page.code}" não autorizado para o seu perfil.`);
          }
        }
      }
    }

    // 7. Validação de Feature
    if (featureCode) {
      // Procuramos no banco a feature correspondente
      const dbFeat = await this.configService.getFeatureState(featureCode);
      if (dbFeat) {
        if (dbFeat.status === 'INACTIVE' || dbFeat.status === 'BLOCKED') {
          throw new ForbiddenException(`A funcionalidade "${featureCode}" está temporariamente desabilitada.`);
        }
        // Se tiver flag associada
        if (dbFeat.flagKey && !config.flags[dbFeat.flagKey]) {
          throw new ForbiddenException(`A funcionalidade experimental "${featureCode}" requer ativação de flag.`);
        }
      }
    }

    return true;
  }
}
