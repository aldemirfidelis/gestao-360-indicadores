import { BadRequestException, ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { PortalAuditService } from './portal-audit.service';
import { CATALOG_FEATURES, CATALOG_MODULES, CATALOG_PAGES } from '../portal-catalog';
import { CRITICAL_CONFIRMATION_PHRASE, isNonBlockable, UNAVAILABLE_STATUSES } from '../portal-admin.constants';

const DEPRECATED_PAGE_CODES = ['processes.sipoc'];

@Injectable()
export class RegistryService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PortalAuditService,
  ) {}

  async onModuleInit() {
    await this.sync();
  }

  /** Sync ADITIVO do catálogo: cria o que falta, atualiza só metadados; nunca apaga overrides. */
  async sync(user?: AuthPayload) {
    let created = 0;
    for (const m of CATALOG_MODULES) {
      const existing = await this.prisma.portalModule.findUnique({ where: { code: m.code } });
      if (!existing) {
        await this.prisma.portalModule.create({
          data: {
            code: m.code, name: m.name, description: m.description ?? null, category: m.category, icon: m.icon ?? null,
            route: m.route ?? null, menuOrder: m.menuOrder, criticality: m.criticality,
            systemRequired: m.systemRequired ?? false, nonBlockable: m.nonBlockable ?? isNonBlockable(m.code),
            dependencies: JSON.stringify(m.dependencies ?? []),
          },
        });
        created++;
      } else {
        await this.prisma.portalModule.update({
          where: { code: m.code },
          data: { name: m.name, category: m.category, route: m.route ?? null, menuOrder: m.menuOrder, criticality: m.criticality, systemRequired: m.systemRequired ?? existing.systemRequired, nonBlockable: (m.nonBlockable ?? isNonBlockable(m.code)) || existing.nonBlockable },
        });
      }
    }
    for (const p of CATALOG_PAGES) {
      const exists = await this.prisma.portalPage.findUnique({ where: { code: p.code } });
      if (!exists) {
        await this.prisma.portalPage.create({
          data: { code: p.code, moduleCode: p.moduleCode, name: p.name, title: p.title, route: p.route, menuOrder: p.menuOrder ?? 0 },
        });
        created++;
      } else {
        await this.prisma.portalPage.update({
          where: { code: p.code },
          data: { moduleCode: p.moduleCode, name: p.name, title: p.title, route: p.route, menuOrder: p.menuOrder ?? exists.menuOrder },
        });
      }
    }
    await this.prisma.portalPage.updateMany({
      where: { code: { in: DEPRECATED_PAGE_CODES } },
      data: { status: 'HIDDEN', menuOrder: 9999, updateReason: 'Substituida pela tela unica de Processos.' },
    });
    for (const f of CATALOG_FEATURES) {
      const exists = await this.prisma.portalFeature.findUnique({ where: { code: f.code } });
      if (!exists) { await this.prisma.portalFeature.create({ data: { code: f.code, moduleCode: f.moduleCode, name: f.name, criticality: f.criticality ?? 'medium' } }); created++; }
    }
    if (user) await this.audit.record({ user, tab: 'advanced', action: 'SYNC', targetType: 'registry', message: `Sync do registro: ${created} novo(s).` });
    return { created };
  }

  listModules() { return this.prisma.portalModule.findMany({ orderBy: { menuOrder: 'asc' } }); }
  listPages() { return this.prisma.portalPage.findMany({ orderBy: [{ moduleCode: 'asc' }, { menuOrder: 'asc' }] }); }
  listFeatures() { return this.prisma.portalFeature.findMany({ orderBy: [{ moduleCode: 'asc' }, { name: 'asc' }] }); }

  async setModuleStatus(code: string, status: string, opts: { confirmationPhrase?: string; reason?: string }, user: AuthPayload) {
    const mod = await this.prisma.portalModule.findUnique({ where: { code } });
    if (!mod) throw new BadRequestException(`Módulo não encontrado: ${code}`);
    const makesUnavailable = UNAVAILABLE_STATUSES.includes(status) || status === 'HIDDEN';
    if (makesUnavailable && (mod.nonBlockable || isNonBlockable(code))) {
      await this.audit.record({ user, tab: 'modules', action: 'BLOCK', targetType: 'module', targetCode: code, result: 'DENIED', message: 'Módulo essencial: bloqueio não permitido (anti-auto-bloqueio).' });
      throw new ForbiddenException(`Módulo essencial "${code}" não pode ser desabilitado/bloqueado.`);
    }
    if ((mod.criticality === 'critical' || mod.criticality === 'high') && makesUnavailable && opts.confirmationPhrase !== CRITICAL_CONFIRMATION_PHRASE) {
      throw new BadRequestException(`Alteração crítica. Para confirmar, digite exatamente: "${CRITICAL_CONFIRMATION_PHRASE}".`);
    }
    const updated = await this.prisma.portalModule.update({ where: { code }, data: { status, updatedBy: user.sub, updateReason: opts.reason ?? null } });
    await this.audit.record({ user, tab: 'modules', action: 'STATUS', targetType: 'module', targetCode: code, beforeValue: { status: mod.status }, afterValue: { status }, reason: opts.reason ?? null });
    return updated;
  }

  async updateModule(code: string, patch: Record<string, unknown>, user: AuthPayload) {
    const mod = await this.prisma.portalModule.findUnique({ where: { code } });
    if (!mod) throw new BadRequestException(`Módulo não encontrado: ${code}`);
    const allowed: Record<string, unknown> = {};
    for (const k of ['name', 'description', 'category', 'icon', 'menuOrder', 'unavailableMessage', 'experimental', 'scheduledActivationAt', 'scheduledDeactivationAt']) {
      if (k in patch) allowed[k] = patch[k];
    }
    if ('allowedRoles' in patch) allowed.allowedRoles = JSON.stringify(patch.allowedRoles ?? []);
    if ('allowedScopes' in patch) allowed.allowedScopes = JSON.stringify(patch.allowedScopes ?? []);
    allowed.updatedBy = user.sub;
    const updated = await this.prisma.portalModule.update({ where: { code }, data: allowed });
    await this.audit.record({ user, tab: 'modules', action: 'UPDATE', targetType: 'module', targetCode: code, beforeValue: mod, afterValue: updated });
    return updated;
  }

  async setPageStatus(code: string, status: string, opts: { confirmationPhrase?: string; reason?: string }, user: AuthPayload) {
    const page = await this.prisma.portalPage.findUnique({ where: { code } });
    if (!page) throw new BadRequestException(`Página não encontrada: ${code}`);
    if (page.moduleCode && isNonBlockable(page.moduleCode) && (UNAVAILABLE_STATUSES.includes(status) || status === 'HIDDEN')) {
      throw new ForbiddenException(`Página de módulo essencial "${page.moduleCode}" não pode ser bloqueada.`);
    }
    const updated = await this.prisma.portalPage.update({ where: { code }, data: { status, updatedBy: user.sub, updateReason: opts.reason ?? null } });
    await this.audit.record({ user, tab: 'pages', action: 'STATUS', targetType: 'page', targetCode: code, beforeValue: { status: page.status }, afterValue: { status }, reason: opts.reason ?? null });
    return updated;
  }

  async setFeatureStatus(code: string, status: string, user: AuthPayload) {
    const feat = await this.prisma.portalFeature.findUnique({ where: { code } });
    if (!feat) throw new BadRequestException(`Funcionalidade não encontrada: ${code}`);
    const updated = await this.prisma.portalFeature.update({ where: { code }, data: { status, updatedBy: user.sub } });
    await this.audit.record({ user, tab: 'features', action: 'STATUS', targetType: 'feature', targetCode: code, beforeValue: { status: feat.status }, afterValue: { status } });
    return updated;
  }

  async updatePage(code: string, patch: Record<string, unknown>, user: AuthPayload) {
    const page = await this.prisma.portalPage.findUnique({ where: { code } });
    if (!page) throw new BadRequestException(`Página não encontrada: ${code}`);
    const allowed: Record<string, unknown> = {};
    for (const k of ['name', 'title', 'route', 'description', 'menuOrder', 'unavailableMessage']) {
      if (k in patch) allowed[k] = patch[k];
    }
    if ('allowedRoles' in patch) allowed.allowedRoles = JSON.stringify(patch.allowedRoles ?? []);
    if ('allowedScopes' in patch) allowed.allowedScopes = JSON.stringify(patch.allowedScopes ?? []);
    allowed.updatedBy = user.sub;
    const updated = await this.prisma.portalPage.update({ where: { code }, data: allowed });
    await this.audit.record({ user, tab: 'pages', action: 'UPDATE', targetType: 'page', targetCode: code, beforeValue: page, afterValue: updated });
    return updated;
  }

  async updateFeature(code: string, patch: Record<string, unknown>, user: AuthPayload) {
    const feat = await this.prisma.portalFeature.findUnique({ where: { code } });
    if (!feat) throw new BadRequestException(`Funcionalidade não encontrada: ${code}`);
    const allowed: Record<string, unknown> = {};
    for (const k of ['name', 'description', 'flagKey']) {
      if (k in patch) allowed[k] = patch[k];
    }
    if ('allowedRoles' in patch) allowed.allowedRoles = JSON.stringify(patch.allowedRoles ?? []);
    if ('allowedScopes' in patch) allowed.allowedScopes = JSON.stringify(patch.allowedScopes ?? []);
    if ('dependencies' in patch) allowed.dependencies = JSON.stringify(patch.dependencies ?? []);
    allowed.updatedBy = user.sub;
    const updated = await this.prisma.portalFeature.update({ where: { code }, data: allowed });
    await this.audit.record({ user, tab: 'features', action: 'UPDATE', targetType: 'feature', targetCode: code, beforeValue: feat, afterValue: updated });
    return updated;
  }
}
