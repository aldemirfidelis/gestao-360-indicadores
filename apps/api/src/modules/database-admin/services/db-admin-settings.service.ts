import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { DbAdminAuditService } from './db-admin-audit.service';
import { DB_ADMIN_LIMITS, PROTECTED_TABLES } from '../database-admin.constants';

const GROUP = 'database-admin';

/** Configurações Avançadas do módulo, persistidas em AppSetting (group=database-admin). */
@Injectable()
export class DbAdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: DbAdminAuditService,
  ) {}

  async get() {
    const settings = await this.prisma.appSetting.findMany({ where: { group: GROUP }, orderBy: { key: 'asc' } });
    return {
      defaults: {
        protectedTables: PROTECTED_TABLES,
        limits: DB_ADMIN_LIMITS,
      },
      settings,
    };
  }

  async set(key: string, value: string, user: AuthPayload) {
    const existing = await this.prisma.appSetting.findFirst({ where: { group: GROUP, key } });
    const before = existing?.value ?? null;
    const saved = existing
      ? await this.prisma.appSetting.update({ where: { id: existing.id }, data: { value } })
      : await this.prisma.appSetting.create({ data: { companyId: null, group: GROUP, key, value, valueType: 'text', active: true } });
    await this.audit.record({
      user, submenu: 'settings', action: 'UPDATE', targetTable: 'AppSetting',
      beforeValue: { key, value: before }, afterValue: { key, value }, result: 'SUCCESS', message: `Config ${key}`,
    });
    return saved;
  }
}
