import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_INTEGRATIONS } from '../portal-admin/services/integration.service';

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    await this.ensureDefaults();
    const [integrations, preferences] = await Promise.all([
      this.prisma.portalIntegration.findMany({ orderBy: [{ name: 'asc' }] }),
      this.prisma.userIntegrationPreference.findMany({ where: { userId } }),
    ]);
    const prefByCode = new Map(preferences.map((item) => [item.code, item]));
    return integrations.map((item) => {
      const pref = prefByCode.get(item.code);
      return {
        id: item.id,
        code: item.code,
        name: item.name,
        type: item.type,
        status: item.status,
        lastRunAt: item.lastRunAt,
        lastError: item.lastError,
        lastLatencyMs: item.lastLatencyMs,
        recentFailures: item.recentFailures,
        userEnabled: pref?.enabled ?? item.status === 'enabled',
        userConfig: parseJson(pref?.config ?? '{}'),
        updatedAt: item.updatedAt,
      };
    });
  }

  async setPreference(userId: string, code: string, input: { enabled?: boolean; config?: Record<string, unknown> }) {
    await this.ensureDefaults();
    const integration = await this.prisma.portalIntegration.findUnique({ where: { code } });
    if (!integration) throw new NotFoundException('Integracao nao encontrada.');
    const config = JSON.stringify(input.config ?? {});
    return this.prisma.userIntegrationPreference.upsert({
      where: { userId_code: { userId, code } },
      create: { userId, code, enabled: !!input.enabled, config },
      update: { enabled: !!input.enabled, config },
    });
  }

  private async ensureDefaults() {
    for (const item of DEFAULT_INTEGRATIONS) {
      await this.prisma.portalIntegration.upsert({
        where: { code: item.code },
        create: {
          code: item.code,
          name: item.name,
          type: item.type,
          status: 'enabled',
          configMasked: JSON.stringify(maskEnv(item.env)),
        },
        update: { name: item.name, type: item.type, configMasked: JSON.stringify(maskEnv(item.env)) },
      });
    }
  }
}

function parseJson(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function maskEnv(env: string | null): Record<string, string> {
  if (!env) return { configured: 'n/a' };
  const value = process.env[env];
  return { [env]: value ? '******' : '(nao definido)', configured: value ? 'sim' : 'nao' };
}
