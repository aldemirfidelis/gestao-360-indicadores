import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { PortalAuditService } from './portal-audit.service';
import { evaluateFlag, FlagContext } from '../util/flag-eval';
import { parseArray, stringifyArray } from '../util/json';

@Injectable()
export class FeatureFlagService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PortalAuditService,
  ) {}

  list() {
    return this.prisma.portalFeatureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  async upsert(input: {
    key: string; name?: string; description?: string; enabled?: boolean; rolloutPercentage?: number | null;
    allowedRoles?: string[]; allowedUserIds?: string[]; allowedScopes?: string[]; environment?: string | null;
    experimental?: boolean; scheduledOnAt?: string | null; scheduledOffAt?: string | null;
  }, user: AuthPayload) {
    const existing = await this.prisma.portalFeatureFlag.findUnique({ where: { key: input.key } });
    const data = {
      name: input.name ?? existing?.name ?? input.key,
      description: input.description ?? existing?.description ?? null,
      enabled: input.enabled ?? existing?.enabled ?? false,
      rolloutPercentage: input.rolloutPercentage ?? existing?.rolloutPercentage ?? null,
      allowedRoles: input.allowedRoles ? stringifyArray(input.allowedRoles) : existing?.allowedRoles ?? '[]',
      allowedUserIds: input.allowedUserIds ? stringifyArray(input.allowedUserIds) : existing?.allowedUserIds ?? '[]',
      allowedScopes: input.allowedScopes ? stringifyArray(input.allowedScopes) : existing?.allowedScopes ?? '[]',
      environment: input.environment !== undefined ? input.environment : existing?.environment ?? null,
      experimental: input.experimental ?? existing?.experimental ?? false,
      scheduledOnAt: input.scheduledOnAt !== undefined ? (input.scheduledOnAt ? new Date(input.scheduledOnAt) : null) : existing?.scheduledOnAt ?? null,
      scheduledOffAt: input.scheduledOffAt !== undefined ? (input.scheduledOffAt ? new Date(input.scheduledOffAt) : null) : existing?.scheduledOffAt ?? null,
      updatedBy: user.sub,
    };
    const saved = existing
      ? await this.prisma.portalFeatureFlag.update({ where: { key: input.key }, data })
      : await this.prisma.portalFeatureFlag.create({ data: { key: input.key, ...data } });
    await this.audit.record({ user, tab: 'features', action: existing ? 'UPDATE' : 'CREATE', targetType: 'flag', targetCode: input.key, beforeValue: existing ?? undefined, afterValue: saved });
    return saved;
  }

  async remove(key: string, user: AuthPayload) {
    await this.prisma.portalFeatureFlag.deleteMany({ where: { key } });
    await this.audit.record({ user, tab: 'features', action: 'DELETE', targetType: 'flag', targetCode: key });
    return { ok: true };
  }

  /** Avalia uma única flag para um usuário. Flag inexistente => true (não bloqueia). */
  async isEnabled(key: string, ctx: FlagContext): Promise<boolean> {
    const f = await this.prisma.portalFeatureFlag.findUnique({ where: { key } });
    if (!f) return true;
    return evaluateFlag(
      { key: f.key, enabled: f.enabled, rolloutPercentage: f.rolloutPercentage, allowedRoles: parseArray(f.allowedRoles), allowedUserIds: parseArray(f.allowedUserIds), allowedScopes: parseArray(f.allowedScopes), environment: f.environment, scheduledOnAt: f.scheduledOnAt, scheduledOffAt: f.scheduledOffAt },
      ctx,
    );
  }

  /** Resolve todas as flags para um usuário. */
  async evaluateAllForUser(ctx: FlagContext): Promise<Record<string, boolean>> {
    const flags = await this.prisma.portalFeatureFlag.findMany();
    const out: Record<string, boolean> = {};
    for (const f of flags) {
      out[f.key] = evaluateFlag(
        {
          key: f.key, enabled: f.enabled, rolloutPercentage: f.rolloutPercentage,
          allowedRoles: parseArray(f.allowedRoles), allowedUserIds: parseArray(f.allowedUserIds),
          allowedScopes: parseArray(f.allowedScopes), environment: f.environment,
          scheduledOnAt: f.scheduledOnAt, scheduledOffAt: f.scheduledOffAt,
        },
        ctx,
      );
    }
    return out;
  }
}
