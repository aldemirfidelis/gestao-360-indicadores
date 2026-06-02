import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { PortalAuditService } from './portal-audit.service';

@Injectable()
export class NavigationService {
  constructor(private readonly prisma: PrismaService, private readonly audit: PortalAuditService) {}

  list() {
    return this.prisma.portalNavOverride.findMany({ orderBy: [{ order: 'asc' }, { itemKey: 'asc' }] });
  }

  async upsert(itemKey: string, patch: { kind?: string; hidden?: boolean; order?: number | null; labelOverride?: string | null; iconOverride?: string | null; groupOverride?: string | null }, user: AuthPayload) {
    const existing = await this.prisma.portalNavOverride.findUnique({ where: { itemKey } });
    const data = {
      kind: patch.kind ?? existing?.kind ?? 'item',
      hidden: patch.hidden ?? existing?.hidden ?? false,
      order: patch.order !== undefined ? patch.order : existing?.order ?? null,
      labelOverride: patch.labelOverride !== undefined ? patch.labelOverride : existing?.labelOverride ?? null,
      iconOverride: patch.iconOverride !== undefined ? patch.iconOverride : existing?.iconOverride ?? null,
      groupOverride: patch.groupOverride !== undefined ? patch.groupOverride : existing?.groupOverride ?? null,
      updatedBy: user.sub,
    };
    const saved = existing
      ? await this.prisma.portalNavOverride.update({ where: { itemKey }, data })
      : await this.prisma.portalNavOverride.create({ data: { itemKey, ...data } });
    await this.audit.record({ user, tab: 'navigation', action: existing ? 'UPDATE' : 'CREATE', targetType: 'nav', targetCode: itemKey, afterValue: saved });
    return saved;
  }

  async reorder(items: { itemKey: string; order: number }[], user: AuthPayload) {
    for (const it of items) {
      await this.prisma.portalNavOverride.upsert({
        where: { itemKey: it.itemKey },
        update: { order: it.order, updatedBy: user.sub },
        create: { itemKey: it.itemKey, order: it.order, updatedBy: user.sub },
      });
    }
    await this.audit.record({ user, tab: 'navigation', action: 'REORDER', targetType: 'nav', message: `${items.length} item(ns) reordenado(s).` });
    return { ok: true };
  }

  async remove(itemKey: string, user: AuthPayload) {
    await this.prisma.portalNavOverride.deleteMany({ where: { itemKey } });
    await this.audit.record({ user, tab: 'navigation', action: 'DELETE', targetType: 'nav', targetCode: itemKey });
    return { ok: true };
  }
}
