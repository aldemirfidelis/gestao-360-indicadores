import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { FeatureFlagService } from './feature-flag.service';
import { parseArray } from '../util/json';

/**
 * Monta a configuração EFETIVA do portal para um usuário (overlay resolvido).
 * É o caminho de leitura consumido pelo shell do frontend (sidebar/RouteGate/flags).
 */
@Injectable()
export class PortalConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagService,
  ) {}

  scopeIdsOf(user: AuthPayload): string[] {
    return [user.companyId, user.sub, user.role].filter(Boolean) as string[];
  }

  async getEffectiveConfig(user: AuthPayload) {
    const now = new Date();
    const env = process.env.NODE_ENV ?? 'development';
    const isSuper = user.role === 'SUPER_ADMIN';

    const [flags, modules, pages, navOverrides, maintenanceWindows, announcements] = await Promise.all([
      this.flags.evaluateAllForUser({ userId: user.sub, role: user.role, environment: env, scopeIds: this.scopeIdsOf(user), now }),
      this.prisma.portalModule.findMany(),
      this.prisma.portalPage.findMany(),
      this.prisma.portalNavOverride.findMany(),
      this.prisma.portalMaintenanceWindow.findMany({ where: { active: true } }),
      this.prisma.portalAnnouncement.findMany({ where: { active: true } }),
    ]);

    const activeMaint = maintenanceWindows.filter((w) => withinWindow(w.startsAt, w.endsAt, now));
    const globalMaint = activeMaint.find((w) => w.scope === 'global') ?? null;

    return {
      role: user.role,
      flags,
      maintenance: {
        global: globalMaint ? { active: true, message: globalMaint.message, allowSuperAdmin: globalMaint.allowSuperAdmin } : { active: false },
        modules: activeMaint.filter((w) => w.scope === 'module').map((w) => w.targetCode),
        pages: activeMaint.filter((w) => w.scope === 'page').map((w) => w.targetCode),
      },
      modules: modules.map((m) => ({
        code: m.code, status: m.status, route: m.route, category: m.category,
        hidden: m.status === 'HIDDEN', maintenance: m.status === 'MAINTENANCE',
        unavailable: ['INACTIVE', 'BLOCKED', 'DISCONTINUED', 'MAINTENANCE'].includes(m.status),
        unavailableMessage: m.unavailableMessage,
        allowedRoles: parseArray(m.allowedRoles),
      })),
      pages: pages.map((p) => ({
        code: p.code, route: p.route, status: p.status,
        hidden: p.status === 'HIDDEN', maintenance: p.status === 'MAINTENANCE',
        unavailable: ['INACTIVE', 'BLOCKED', 'DISCONTINUED', 'MAINTENANCE'].includes(p.status),
        unavailableMessage: p.unavailableMessage,
        allowedRoles: parseArray(p.allowedRoles),
      })),
      navOverrides: navOverrides.map((n) => ({ itemKey: n.itemKey, kind: n.kind, hidden: n.hidden, order: n.order, labelOverride: n.labelOverride, iconOverride: n.iconOverride, groupOverride: n.groupOverride })),
      announcements: announcements
        .filter((a) => withinWindow(a.startsAt, a.endsAt, now))
        .filter((a) => audienceMatches(a, user))
        .sort((a, b) => b.priority - a.priority)
        .map((a) => ({ id: a.id, title: a.title, message: a.message, type: a.type, display: a.display, pinned: a.pinned, dismissible: a.dismissible })),
      isSuperAdmin: isSuper,
    };
  }

  async getFeatureState(code: string) {
    return this.prisma.portalFeature.findUnique({ where: { code } });
  }
}

function withinWindow(start: Date | null, end: Date | null, now: Date): boolean {
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

function audienceMatches(a: { audienceRoles: string; companies: string }, user: AuthPayload): boolean {
  const roles = parseArray(a.audienceRoles);
  const companies = parseArray(a.companies);
  if (roles.length > 0 && !roles.includes(user.role)) return false;
  if (companies.length > 0 && !companies.includes(user.companyId)) return false;
  return true;
}
