import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { swallow } from '../../../common/logging/swallow';
import { FeatureFlagService } from './feature-flag.service';
import { parseArray } from '../util/json';
import { PLATFORM_PLANS } from '../../platform-admin/platform-admin.catalog';
import { alwaysOnModuleCodes } from '../business-modules';

// Núcleo/sistema sempre ativos — mesma fonte usada pelo guard e pelos planos.
const COMPANY_CORE_MODULE_CODES = new Set(alwaysOnModuleCodes());

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

    const [flags, modules, pages, navOverrides, maintenanceWindows, announcements, companyModules, companyProfile, planModules] = await Promise.all([
      this.flags.evaluateAllForUser({ userId: user.sub, role: user.role, environment: env, scopeIds: this.scopeIdsOf(user), now }),
      this.prisma.portalModule.findMany(),
      this.prisma.portalPage.findMany(),
      this.prisma.portalNavOverride.findMany(),
      this.prisma.portalMaintenanceWindow.findMany({ where: { active: true } }),
      this.prisma.portalAnnouncement.findMany({ where: { active: true } }),
      user.companyId ? this.prisma.platformCompanyModule.findMany({ where: { companyId: user.companyId } }).catch(swallow([], 'portalConfig.companyModules', 'debug')) : Promise.resolve([]),
      user.companyId ? this.prisma.platformCompanyProfile.findUnique({ where: { companyId: user.companyId }, select: { planCode: true } }).catch(swallow(null, 'portalConfig.companyProfile', 'debug')) : Promise.resolve(null),
      this.prisma.platformPlanModule.findMany({
        select: { moduleCode: true, included: true, plan: { select: { code: true } } },
      }).catch(swallow([], 'portalConfig.planModules', 'debug')),
    ]);

    const activeMaint = maintenanceWindows.filter((w) => withinWindow(w.startsAt, w.endsAt, now));
    const globalMaint = activeMaint.find((w) => w.scope === 'global') ?? null;
    const planCode = companyProfile?.planCode ?? 'ESSENCIAL';
    const planEntries = planEntriesByPlan(planModules);

    return {
      role: user.role,
      flags,
      maintenance: {
        global: globalMaint ? { active: true, message: globalMaint.message, allowSuperAdmin: globalMaint.allowSuperAdmin } : { active: false },
        modules: activeMaint.filter((w) => w.scope === 'module').map((w) => w.targetCode),
        pages: activeMaint.filter((w) => w.scope === 'page').map((w) => w.targetCode),
      },
      modules: modules.map((m) => {
        const companyModule = companyModules.find((item) => item.moduleCode === m.code);
        const planStatus = user.companyId ? statusFromPlan(planCode, m.code, planEntries) : null;
        // "Herdado do plano" (ou sem registro) resolve pelo plano ATUAL da
        // empresa — trocar o plano reflete na hora. Só exceções manuais
        // (ATIVO/BLOQUEADO/etc.) gravadas no registro da empresa divergem.
        const storedStatus = companyModule?.status;
        const rawStatus =
          storedStatus && storedStatus.toUpperCase() !== 'HERDADO_DO_PLANO'
            ? storedStatus
            : planStatus ?? storedStatus ?? m.status;
        const effectiveStatus = toPortalStatus(rawStatus);
        return {
          code: m.code, status: effectiveStatus, route: m.route, category: m.category,
          hidden: effectiveStatus === 'HIDDEN', maintenance: effectiveStatus === 'MAINTENANCE',
          unavailable: ['INACTIVE', 'BLOCKED', 'DISCONTINUED', 'MAINTENANCE'].includes(effectiveStatus),
          unavailableMessage: companyModule?.note ?? (rawStatus === 'BLOQUEADO' ? `Modulo fora do plano ${planCode}.` : m.unavailableMessage),
          companyModuleStatus: rawStatus,
          companyModuleReadOnly: companyModule?.readOnly ?? false,
          allowedRoles: parseArray(m.allowedRoles),
        };
      }),
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

function toPortalStatus(status: string): string {
  const normalized = status.toUpperCase();
  if (['BLOQUEADO', 'SUSPENSO', 'BLOCKED', 'SUSPENDED'].includes(normalized)) return 'BLOCKED';
  if (['INATIVO', 'INACTIVE'].includes(normalized)) return 'INACTIVE';
  if (['MANUTENCAO', 'MAINTENANCE'].includes(normalized)) return 'MAINTENANCE';
  return status;
}

function planEntriesByPlan(rows: Array<{ moduleCode: string; included: boolean; plan: { code: string } }>): Map<string, Map<string, boolean>> {
  const entries = new Map<string, Map<string, boolean>>();
  for (const row of rows) {
    const planEntries = entries.get(row.plan.code) ?? new Map<string, boolean>();
    planEntries.set(row.moduleCode, row.included);
    entries.set(row.plan.code, planEntries);
  }
  return entries;
}

function statusFromPlan(planCode: string, moduleCode: string, entries: Map<string, Map<string, boolean>>): string {
  if (COMPANY_CORE_MODULE_CODES.has(moduleCode)) return 'HERDADO_DO_PLANO';
  const explicitPlanEntry = entries.get(planCode)?.get(moduleCode);
  if (explicitPlanEntry !== undefined) return explicitPlanEntry ? 'HERDADO_DO_PLANO' : 'BLOQUEADO';
  const defaultPlan = PLATFORM_PLANS.find((plan) => plan.code === planCode);
  return (defaultPlan?.modules as readonly string[] | undefined)?.includes(moduleCode) ? 'HERDADO_DO_PLANO' : 'BLOQUEADO';
}
