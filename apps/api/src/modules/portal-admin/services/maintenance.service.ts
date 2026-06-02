import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { PortalAuditService } from './portal-audit.service';

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService, private readonly audit: PortalAuditService) {}

  list() {
    return this.prisma.portalMaintenanceWindow.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(input: { scope?: string; targetCode?: string | null; message?: string; startsAt?: string | null; endsAt?: string | null; allowSuperAdmin?: boolean }, user: AuthPayload) {
    const win = await this.prisma.portalMaintenanceWindow.create({
      data: {
        scope: input.scope ?? 'global',
        targetCode: input.targetCode ?? null,
        message: input.message ?? null,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        allowSuperAdmin: input.allowSuperAdmin ?? true,
        active: true,
        createdBy: user.sub,
      },
    });
    await this.audit.record({ user, tab: 'maintenance', action: 'CREATE', targetType: win.scope, targetCode: win.targetCode, afterValue: win, message: `Manutenção ${win.scope}` });
    return win;
  }

  async update(id: string, patch: { message?: string; startsAt?: string | null; endsAt?: string | null; active?: boolean; allowSuperAdmin?: boolean }, user: AuthPayload) {
    const data: Record<string, unknown> = {};
    if (patch.message !== undefined) data.message = patch.message;
    if (patch.active !== undefined) data.active = patch.active;
    if (patch.allowSuperAdmin !== undefined) data.allowSuperAdmin = patch.allowSuperAdmin;
    if (patch.startsAt !== undefined) data.startsAt = patch.startsAt ? new Date(patch.startsAt) : null;
    if (patch.endsAt !== undefined) data.endsAt = patch.endsAt ? new Date(patch.endsAt) : null;
    const win = await this.prisma.portalMaintenanceWindow.update({ where: { id }, data });
    await this.audit.record({ user, tab: 'maintenance', action: 'UPDATE', targetType: 'maintenance', targetCode: id, afterValue: win });
    return win;
  }

  async cancel(id: string, user: AuthPayload) {
    const win = await this.prisma.portalMaintenanceWindow.update({ where: { id }, data: { active: false } });
    await this.audit.record({ user, tab: 'maintenance', action: 'CANCEL', targetType: 'maintenance', targetCode: id });
    return win;
  }
}
