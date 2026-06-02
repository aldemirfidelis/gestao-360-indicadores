import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { PortalAuditService } from './portal-audit.service';
import { stringifyArray } from '../util/json';

@Injectable()
export class AnnouncementService {
  constructor(private readonly prisma: PrismaService, private readonly audit: PortalAuditService) {}

  list() {
    return this.prisma.portalAnnouncement.findMany({ orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] });
  }

  async create(input: Record<string, unknown>, user: AuthPayload) {
    const a = await this.prisma.portalAnnouncement.create({ data: this.toData(input, user) });
    await this.audit.record({ user, tab: 'announcements', action: 'CREATE', targetType: 'announcement', targetCode: a.id, afterValue: a });
    return a;
  }

  async update(id: string, input: Record<string, unknown>, user: AuthPayload) {
    const a = await this.prisma.portalAnnouncement.update({ where: { id }, data: this.toData(input, user, true) });
    await this.audit.record({ user, tab: 'announcements', action: 'UPDATE', targetType: 'announcement', targetCode: id, afterValue: a });
    return a;
  }

  async remove(id: string, user: AuthPayload) {
    await this.prisma.portalAnnouncement.deleteMany({ where: { id } });
    await this.audit.record({ user, tab: 'announcements', action: 'DELETE', targetType: 'announcement', targetCode: id });
    return { ok: true };
  }

  private toData(input: Record<string, unknown>, user: AuthPayload, partial = false) {
    const arr = (k: string) => (Array.isArray(input[k]) ? stringifyArray(input[k] as unknown[]) : undefined);
    const data: Record<string, unknown> = {
      title: input.title,
      message: input.message,
      type: input.type ?? 'info',
      priority: input.priority != null ? Number(input.priority) : 0,
      startsAt: input.startsAt ? new Date(String(input.startsAt)) : null,
      endsAt: input.endsAt ? new Date(String(input.endsAt)) : null,
      display: input.display ?? 'banner',
      pinned: Boolean(input.pinned),
      dismissible: input.dismissible !== false,
      active: input.active !== false,
      audienceRoles: arr('audienceRoles') ?? '[]',
      pages: arr('pages') ?? '[]',
      modules: arr('modules') ?? '[]',
      companies: arr('companies') ?? '[]',
      branches: arr('branches') ?? '[]',
      orgNodes: arr('orgNodes') ?? '[]',
      createdBy: user.sub,
    };
    if (partial) Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
    return data as never;
  }
}
