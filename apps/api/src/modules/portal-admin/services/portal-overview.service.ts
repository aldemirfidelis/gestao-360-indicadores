import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PortalOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const [
      modules, pages, features, flags, integrations, roles, superAdmins,
      recentChanges, deniedAttempts, lastSnapshot, recentActions, activeMaint, activeAnnouncements,
    ] = await Promise.all([
      this.prisma.portalModule.findMany({ select: { status: true, criticality: true } }),
      this.prisma.portalPage.findMany({ select: { status: true } }),
      this.prisma.portalFeature.findMany({ select: { status: true } }),
      this.prisma.portalFeatureFlag.findMany({ select: { enabled: true, experimental: true } }),
      this.prisma.portalIntegration.findMany({ select: { status: true, recentFailures: true } }),
      this.prisma.accessProfile.count(),
      this.prisma.user.count({ where: { role: 'SUPER_ADMIN', deletedAt: null } }),
      this.prisma.portalAdminAuditLog.count({ where: { createdAt: { gte: since7d } } }),
      this.prisma.portalAdminAuditLog.count({ where: { result: 'DENIED', createdAt: { gte: since7d } } }),
      this.prisma.portalConfigSnapshot.findFirst({ where: { status: 'AVAILABLE' }, orderBy: { createdAt: 'desc' } }),
      this.prisma.portalAdminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.portalMaintenanceWindow.count({ where: { active: true } }),
      this.prisma.portalAnnouncement.count({ where: { active: true } }),
    ]);

    const countBy = (arr: { status: string }[], s: string) => arr.filter((x) => x.status === s).length;
    const scheduled = await this.prisma.portalModule.count({ where: { OR: [{ scheduledActivationAt: { not: null } }, { scheduledDeactivationAt: { not: null } }] } });

    return {
      modules: {
        total: modules.length,
        active: countBy(modules, 'ACTIVE'),
        inactive: countBy(modules, 'INACTIVE'),
        maintenance: countBy(modules, 'MAINTENANCE'),
        critical: modules.filter((m) => m.criticality === 'critical').length,
      },
      pages: { total: pages.length, active: countBy(pages, 'ACTIVE'), blocked: countBy(pages, 'BLOCKED') + countBy(pages, 'INACTIVE') },
      features: { total: features.length, experimentalFlags: flags.filter((f) => f.experimental).length, restricted: countBy(features, 'RESTRICTED_ROLE') + countBy(features, 'RESTRICTED_SCOPE') },
      flags: { total: flags.length, enabled: flags.filter((f) => f.enabled).length },
      integrations: { total: integrations.length, active: integrations.filter((i) => i.status === 'enabled').length, failing: integrations.filter((i) => i.recentFailures > 0).length },
      roles,
      superAdmins,
      recentChanges,
      deniedAttempts,
      scheduledChanges: scheduled,
      activeMaintenance: activeMaint,
      activeAnnouncements,
      lastSnapshot: lastSnapshot ? { id: lastSnapshot.id, label: lastSnapshot.label, createdAt: lastSnapshot.createdAt } : null,
      recentActions,
      portalStatus: activeMaint > 0 ? 'MANUTENÇÃO' : 'OPERACIONAL',
    };
  }
}
