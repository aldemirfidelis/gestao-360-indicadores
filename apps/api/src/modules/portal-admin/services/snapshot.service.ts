import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { PortalAuditService } from './portal-audit.service';
import { CRITICAL_CONFIRMATION_PHRASE } from '../portal-admin.constants';

interface ConfigDump {
  modules: { code: string; status: string }[];
  pages: { code: string; status: string }[];
  features: { code: string; status: string }[];
  flags: { key: string; enabled: boolean; rolloutPercentage: number | null }[];
  navOverrides: { itemKey: string; hidden: boolean; order: number | null }[];
}

@Injectable()
export class SnapshotService {
  constructor(private readonly prisma: PrismaService, private readonly audit: PortalAuditService) {}

  private async dump(): Promise<ConfigDump> {
    const [modules, pages, features, flags, navOverrides] = await Promise.all([
      this.prisma.portalModule.findMany({ select: { code: true, status: true } }),
      this.prisma.portalPage.findMany({ select: { code: true, status: true } }),
      this.prisma.portalFeature.findMany({ select: { code: true, status: true } }),
      this.prisma.portalFeatureFlag.findMany({ select: { key: true, enabled: true, rolloutPercentage: true } }),
      this.prisma.portalNavOverride.findMany({ select: { itemKey: true, hidden: true, order: true } }),
    ]);
    return { modules, pages, features, flags, navOverrides };
  }

  async create(label: string, reason: string | null, kind: 'MANUAL' | 'PRE_OP' | 'AUTO', user?: AuthPayload) {
    const data = await this.dump();
    const json = JSON.stringify(data);
    const checksum = createHash('sha256').update(json).digest('hex');
    const snap = await this.prisma.portalConfigSnapshot.create({
      data: { label: label || `Snapshot ${new Date().toISOString()}`, reason, kind, data: json, checksum, sizeBytes: Buffer.byteLength(json), createdBy: user?.sub ?? null, createdByEmail: user?.email ?? null },
    });
    if (user) await this.audit.record({ user, tab: 'snapshots', action: 'CREATE', targetType: 'snapshot', targetCode: snap.id, snapshotId: snap.id, message: label });
    return { id: snap.id, label: snap.label, createdAt: snap.createdAt, sizeBytes: snap.sizeBytes };
  }

  list() {
    return this.prisma.portalConfigSnapshot.findMany({ where: { status: { not: 'DELETED' } }, orderBy: { createdAt: 'desc' }, select: { id: true, label: true, reason: true, kind: true, sizeBytes: true, status: true, createdByEmail: true, createdAt: true, restoredAt: true } });
  }

  async diff(id: string) {
    const snap = await this.prisma.portalConfigSnapshot.findUnique({ where: { id } });
    if (!snap) throw new BadRequestException('Snapshot não encontrado.');
    const past = JSON.parse(snap.data) as ConfigDump;
    const current = await this.dump();
    const changes: { type: string; code: string; from: string; to: string }[] = [];
    const cmp = (kind: string, a: { code: string; status: string }[], b: { code: string; status: string }[]) => {
      const map = new Map(b.map((x) => [x.code, x.status]));
      for (const x of a) { const now = map.get(x.code); if (now !== undefined && now !== x.status) changes.push({ type: kind, code: x.code, from: x.status, to: now }); }
    };
    cmp('module', past.modules, current.modules);
    cmp('page', past.pages, current.pages);
    cmp('feature', past.features, current.features);
    const fmap = new Map(current.flags.map((f) => [f.key, f.enabled]));
    for (const f of past.flags) { const now = fmap.get(f.key); if (now !== undefined && now !== f.enabled) changes.push({ type: 'flag', code: f.key, from: String(f.enabled), to: String(now) }); }
    return { snapshot: { id: snap.id, label: snap.label, createdAt: snap.createdAt }, changes };
  }

  async restore(id: string, confirmationPhrase: string | undefined, user: AuthPayload) {
    if (confirmationPhrase !== CRITICAL_CONFIRMATION_PHRASE) {
      throw new BadRequestException(`Restauração exige a frase: "${CRITICAL_CONFIRMATION_PHRASE}".`);
    }
    const snap = await this.prisma.portalConfigSnapshot.findUnique({ where: { id } });
    if (!snap) throw new BadRequestException('Snapshot não encontrado.');
    // Snapshot preventivo do estado atual
    const preventive = await this.create(`Pré-restauração de ${snap.label}`, 'Backup automático antes de restaurar', 'AUTO', user);
    const past = JSON.parse(snap.data) as ConfigDump;

    await this.prisma.$transaction(async (tx) => {
      for (const m of past.modules) await tx.portalModule.updateMany({ where: { code: m.code }, data: { status: m.status, updatedBy: user.sub } });
      for (const p of past.pages) await tx.portalPage.updateMany({ where: { code: p.code }, data: { status: p.status, updatedBy: user.sub } });
      for (const f of past.features) await tx.portalFeature.updateMany({ where: { code: f.code }, data: { status: f.status, updatedBy: user.sub } });
      for (const fl of past.flags) await tx.portalFeatureFlag.updateMany({ where: { key: fl.key }, data: { enabled: fl.enabled, rolloutPercentage: fl.rolloutPercentage, updatedBy: user.sub } });
      for (const n of past.navOverrides) await tx.portalNavOverride.updateMany({ where: { itemKey: n.itemKey }, data: { hidden: n.hidden, order: n.order } });
    });

    await this.prisma.portalConfigSnapshot.update({ where: { id }, data: { status: 'RESTORED', restoredAt: new Date() } });
    await this.audit.record({ user, tab: 'snapshots', action: 'RESTORE', targetType: 'snapshot', targetCode: id, snapshotId: preventive.id, message: `Restaurado de ${snap.label}` });
    return { ok: true, preventiveSnapshotId: preventive.id };
  }

  async remove(id: string, user: AuthPayload) {
    await this.prisma.portalConfigSnapshot.updateMany({ where: { id }, data: { status: 'DELETED' } });
    await this.audit.record({ user, tab: 'snapshots', action: 'DELETE', targetType: 'snapshot', targetCode: id });
    return { ok: true };
  }
}
