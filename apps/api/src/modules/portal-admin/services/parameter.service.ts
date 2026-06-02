import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { PortalAuditService } from './portal-audit.service';

const GROUP = 'portal';
const SENSITIVE = /password|token|secret|key|url/i;

/** Parâmetros gerais do portal, persistidos em AppSetting (group=portal). */
@Injectable()
export class ParameterService {
  constructor(private readonly prisma: PrismaService, private readonly audit: PortalAuditService) {}

  async list() {
    const items = await this.prisma.appSetting.findMany({ where: { group: GROUP }, orderBy: { key: 'asc' } });
    // Mascara valores de parâmetros sensíveis.
    return items.map((s) => ({ ...s, value: SENSITIVE.test(s.key) ? '••••••' : s.value }));
  }

  async set(key: string, value: string, valueType: string | null, user: AuthPayload) {
    const existing = await this.prisma.appSetting.findFirst({ where: { group: GROUP, key } });
    const saved = existing
      ? await this.prisma.appSetting.update({ where: { id: existing.id }, data: { value, valueType: valueType ?? existing.valueType } })
      : await this.prisma.appSetting.create({ data: { companyId: null, group: GROUP, key, value, valueType: valueType ?? 'text', active: true } });
    await this.audit.record({ user, tab: 'parameters', action: existing ? 'UPDATE' : 'CREATE', targetType: 'parameter', targetCode: key, beforeValue: existing ? { key, value: SENSITIVE.test(key) ? '••••••' : existing.value } : undefined, afterValue: { key, value: SENSITIVE.test(key) ? '••••••' : value } });
    return { id: saved.id, key: saved.key };
  }
}
