import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PostgreSQLAdapter } from '../adapters/postgresql.adapter';
import { SchemaInspectionService } from './schema-inspection.service';

/**
 * Dashboard técnico (Visão Geral). NUNCA expõe credenciais/string de conexão:
 * apenas o nome lógico do banco e a versão do engine.
 */
@Injectable()
export class OverviewService {
  constructor(
    private readonly pg: PostgreSQLAdapter,
    private readonly prisma: PrismaService,
    private readonly schema: SchemaInspectionService,
  ) {}

  async getOverview(companyId: string) {
    const tables = await this.schema.listCompanyScopedTables(companyId);
    const [company, relationships, indexes] = await Promise.all([
      this.prisma.company.findFirst({ where: { id: companyId, deletedAt: null }, select: { name: true, tradeName: true } }),
      this.schema.getCompanyScopedRelationships(),
      this.schema.getCompanyScopedIndexes(),
    ]);

    let connection: { ok: boolean; latencyMs: number; engine: string; version: string } = {
      ok: false,
      latencyMs: 0,
      engine: 'PostgreSQL',
      version: 'desconhecida',
    };
    const dbName = company?.tradeName || company?.name || 'Empresa selecionada';
    const sizeBytes = 0;
    const sizePretty = 'escopo empresarial';
    try {
      const ping = await this.pg.ping();
      connection = { ok: ping.ok, latencyMs: ping.latencyMs, engine: 'PostgreSQL', version: shortVersion(ping.version) };
    } catch {
      /* mantém connection.ok = false */
    }

    const totalEstimatedRows = tables.reduce((sum, t) => sum + t.estimatedRows, 0);
    const biggestTables = [...tables].sort((a, b) => b.estimatedRows - a.estimatedRows).slice(0, 8);

    const [lastBackup, recentErrors, recentChanges, migrationCount] = await Promise.all([
      this.prisma.dbAdminBackup.findFirst({ where: { companyId, status: 'AVAILABLE' }, orderBy: { createdAt: 'desc' } }),
      this.prisma.dbAdminAuditLog.count({
        where: { companyId, result: 'ERROR', createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
      }),
      this.prisma.dbAdminAuditLog.findMany({
        where: { companyId, action: { in: ['INSERT', 'UPDATE', 'DELETE', 'IMPORT', 'RESTORE'] } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      Promise.resolve(0),
    ]);

    const alerts = this.buildAlerts({ tables, relationships, recentErrors, lastBackupAt: lastBackup?.createdAt ?? null });

    return {
      database: { name: dbName, engine: connection.engine, version: connection.version, sizeBytes, sizePretty },
      connection,
      counts: {
        tables: tables.length,
        views: 0,
        indexes: indexes.length,
        relationships: relationships.length,
        totalEstimatedRows,
        migrations: migrationCount,
      },
      integrity: { status: recentErrors === 0 ? 'OK' : 'ATENÇÃO', recentErrors },
      lastBackup: lastBackup
        ? { id: lastBackup.id, createdAt: lastBackup.createdAt, type: lastBackup.type, sizeBytes: lastBackup.sizeBytes }
        : null,
      biggestTables,
      recentChanges,
      alerts,
    };
  }

  private async migrationCount(): Promise<number> {
    try {
      const r = await this.pg.runReadOnly(`SELECT count(*)::int AS n FROM "_prisma_migrations"`);
      return Number(r.rows[0]?.n ?? 0);
    } catch {
      return 0;
    }
  }

  private buildAlerts(input: {
    tables: { name: string; primaryKey: string[]; estimatedRows: number; kind: string }[];
    relationships: unknown[];
    recentErrors: number;
    lastBackupAt: Date | null;
  }): { level: 'info' | 'warning' | 'critical'; message: string }[] {
    const alerts: { level: 'info' | 'warning' | 'critical'; message: string }[] = [];
    const noPk = input.tables.filter((t) => t.primaryKey.length === 0 && t.kind === 'business');
    if (noPk.length > 0) {
      alerts.push({ level: 'warning', message: `${noPk.length} tabela(s) de negócio sem chave primária.` });
    }
    if (input.recentErrors > 0) {
      alerts.push({ level: 'critical', message: `${input.recentErrors} erro(s) administrativo(s) nos últimos 7 dias.` });
    }
    if (!input.lastBackupAt) {
      alerts.push({ level: 'info', message: 'Nenhum backup lógico registrado ainda.' });
    }
    return alerts;
  }
}

function shortVersion(full: string): string {
  // "PostgreSQL 16.3 on x86_64..." -> "PostgreSQL 16.3"
  const m = /^(PostgreSQL\s+[\d.]+)/i.exec(full);
  return m ? m[1] : full.split(' ').slice(0, 2).join(' ');
}
