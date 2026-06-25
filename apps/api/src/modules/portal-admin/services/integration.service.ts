import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { swallow } from '../../../common/logging/swallow';
import { PortalAuditService } from './portal-audit.service';

export const DEFAULT_INTEGRATIONS = [
  { code: 'email', name: 'Envio de E-mail', type: 'email', env: 'SMTP_HOST' },
  { code: 'ics', name: 'Convites ICS / Calendário', type: 'calendar', env: null },
  { code: 'ai', name: 'Serviço de IA', type: 'ai', env: 'GEMINI_API_KEY' },
  { code: 'database', name: 'Banco de Dados', type: 'database', env: 'DATABASE_URL' },
  { code: 'storage', name: 'Armazenamento', type: 'storage', env: null },
  { code: 'communication', name: 'Comunicacao Interna', type: 'communication', env: null },
  { code: 'help-center', name: 'Central de Ajuda', type: 'support', env: null },
];

@Injectable()
export class IntegrationService {
  constructor(private readonly prisma: PrismaService, private readonly audit: PortalAuditService) {}

  async list() {
    for (const d of DEFAULT_INTEGRATIONS) {
      await this.prisma.portalIntegration.upsert({
        where: { code: d.code },
        create: { code: d.code, name: d.name, type: d.type, status: 'enabled', configMasked: JSON.stringify(maskEnv(d.env)) },
        update: { name: d.name, type: d.type, configMasked: JSON.stringify(maskEnv(d.env)) },
      });
    }
    return this.prisma.portalIntegration.findMany({ orderBy: { name: 'asc' } });
  }

  async setStatus(code: string, status: 'enabled' | 'disabled', user: AuthPayload) {
    const updated = await this.prisma.portalIntegration.update({ where: { code }, data: { status, updatedBy: user.sub } });
    await this.audit.record({ user, tab: 'integrations', action: 'STATUS', targetType: 'integration', targetCode: code, afterValue: { status } });
    return updated;
  }

  /** Teste básico: banco faz ping real; demais verificam presença de configuração (sem expor valores). */
  async test(code: string, user: AuthPayload) {
    const started = Date.now();
    let ok = false;
    let note = '';
    try {
      if (code === 'database') {
        await this.prisma.$queryRawUnsafe('SELECT 1');
        ok = true;
        note = 'Conexão com o banco respondeu.';
      } else {
        const def = DEFAULT_INTEGRATIONS.find((d) => d.code === code);
        if (def?.env) {
          ok = Boolean(process.env[def.env]);
          note = ok ? 'Configuração presente.' : 'Variável de configuração ausente.';
        } else {
          ok = true;
          note = 'Sem teste automatizado disponível; verificação básica.';
        }
      }
    } catch (e) {
      ok = false;
      note = (e as Error).message.split('\n')[0].slice(0, 120);
    }
    const latency = Date.now() - started;
    await this.prisma.portalIntegration.updateMany({
      where: { code },
      data: ok
        ? { lastRunAt: new Date(), lastLatencyMs: latency, lastError: null, recentFailures: 0 }
        : { lastRunAt: new Date(), lastLatencyMs: latency, lastError: note, recentFailures: { increment: 1 } },
    }).catch(swallow(undefined, `portalIntegration.recordTestResult(code=${code})`, 'debug'));
    await this.audit.record({ user, tab: 'integrations', action: 'TEST', targetType: 'integration', targetCode: code, result: ok ? 'SUCCESS' : 'ERROR', message: note });
    return { ok, latencyMs: latency, note };
  }
}

function maskEnv(env: string | null): Record<string, string> {
  if (!env) return { configured: 'n/a' };
  const v = process.env[env];
  return { [env]: v ? '••••••' : '(não definido)', configured: v ? 'sim' : 'não' };
}
