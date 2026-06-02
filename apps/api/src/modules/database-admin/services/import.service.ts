import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthPayload } from '../../auth/auth.types';
import { PostgreSQLAdapter } from '../adapters/postgresql.adapter';
import { SchemaInspectionService } from './schema-inspection.service';
import { BackupService } from './backup.service';
import { DbAdminAuditService } from './db-admin-audit.service';
import { assertInAllowlist, quoteIdent } from '../util/identifier.util';
import { castSuffix, coerceParam } from '../util/value-cast';
import { parseCsv } from '../util/csv';
import { translatePgError } from '../util/pg-error';
import { DB_ADMIN_LIMITS, isProtectedTable } from '../database-admin.constants';
import { ReqMeta } from './record-management.service';

export type ImportFormat = 'csv' | 'json';
export type ImportStrategy = 'insert' | 'ignoreDuplicates' | 'upsert' | 'replace' | 'onlyValid';

const IMPORT_CAP = 50_000;

function parseContent(format: ImportFormat, content: string): { sourceColumns: string[]; records: Record<string, unknown>[] } {
  if (format === 'json') {
    const data = JSON.parse(content);
    const arr = Array.isArray(data) ? data : [data];
    const cols = new Set<string>();
    arr.forEach((r) => r && typeof r === 'object' && Object.keys(r).forEach((k) => cols.add(k)));
    return { sourceColumns: [...cols], records: arr };
  }
  const { header, rows } = parseCsv(content);
  const records = rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? null])));
  return { sourceColumns: header, records };
}

@Injectable()
export class ImportService {
  constructor(
    private readonly pg: PostgreSQLAdapter,
    private readonly schema: SchemaInspectionService,
    private readonly backup: BackupService,
    private readonly audit: DbAdminAuditService,
  ) {}

  async preview(table: string, format: ImportFormat, content: string) {
    const allow = await this.schema.getAllowlist();
    assertInAllowlist(table, allow, 'tabela');
    const columns = await this.schema.getColumns(table);
    const { sourceColumns, records } = parseContent(format, content);
    const tableColNames = columns.map((c) => c.name);
    const suggestedMapping: Record<string, string> = {};
    for (const sc of sourceColumns) {
      const match = tableColNames.find((tc) => tc.toLowerCase() === sc.toLowerCase());
      if (match) suggestedMapping[sc] = match;
    }
    return {
      table,
      sourceColumns,
      tableColumns: columns,
      totalRows: records.length,
      sampleRows: records.slice(0, 20),
      suggestedMapping,
    };
  }

  async commit(
    table: string,
    format: ImportFormat,
    content: string,
    mapping: Record<string, string>,
    strategy: ImportStrategy,
    keyColumns: string[],
    user: AuthPayload,
    meta: ReqMeta,
  ) {
    const allow = await this.schema.getAllowlist();
    assertInAllowlist(table, allow, 'tabela');
    const columns = await this.schema.getColumns(table);
    const byName = new Map(columns.map((c) => [c.name, c]));
    const { records } = parseContent(format, content);
    if (records.length === 0) throw new BadRequestException('Arquivo sem registros.');
    if (records.length > IMPORT_CAP) throw new BadRequestException(`Importação limitada a ${IMPORT_CAP} registros.`);

    // Mapeia source->target (default: identidade quando target existe)
    const effectiveMap: Record<string, string> = { ...mapping };
    if (Object.keys(effectiveMap).length === 0) {
      for (const c of columns) effectiveMap[c.name] = c.name;
    }
    const targets = [...new Set(Object.values(effectiveMap))].filter((t) => byName.has(t));
    if (targets.length === 0) throw new BadRequestException('Nenhuma coluna mapeada para a tabela de destino.');

    if (strategy === 'replace') {
      if (isProtectedTable(table)) throw new ForbiddenException(`Tabela protegida: estratégia "replace" bloqueada em "${table}".`);
    }
    if (strategy === 'upsert' && keyColumns.length === 0) {
      throw new BadRequestException('A estratégia "upsert" exige coluna(s) chave.');
    }

    // Snapshot antes de operações que removem/alteram dados existentes
    let backupId: string | null = null;
    if (strategy === 'replace' || strategy === 'upsert') {
      const snapRows = await this.pg.runReadOnly(`SELECT * FROM ${quoteIdent(table, 'tabela')} LIMIT ${DB_ADMIN_LIMITS.maxSnapshotRows}`);
      const snap = await this.backup.snapshot({ table, rows: snapRows.rows, type: 'PRE_OP', reason: `Import (${strategy})`, relatedOperation: 'import.commit', userId: user.sub, userEmail: user.email });
      backupId = snap.backupId;
    }

    const report = { totalRows: records.length, inserted: 0, updated: 0, skipped: 0, failed: 0, errors: [] as { row: number; message: string }[] };

    try {
      const { transactionId } = await this.pg.runInTransaction(async (tx) => {
        if (strategy === 'replace') {
          await tx.execute(`TRUNCATE TABLE ${quoteIdent(table, 'tabela')}`);
        }
        for (let i = 0; i < records.length; i++) {
          const src = records[i];
          const params: unknown[] = [];
          const cols: string[] = [];
          const placeholders: string[] = [];
          for (const [sc, tc] of Object.entries(effectiveMap)) {
            const col = byName.get(tc);
            if (!col) continue;
            if (!(sc in src)) continue;
            cols.push(tc);
            try {
              params.push(coerceParam(col, src[sc]));
            } catch (e) {
              throw new Error((e as Error).message);
            }
            placeholders.push(`$${params.length}${castSuffix(col)}`);
          }
          if (cols.length === 0) { report.skipped++; continue; }

          const colSql = cols.map((c) => quoteIdent(c, 'coluna')).join(', ');
          let sql: string;
          if (strategy === 'ignoreDuplicates') {
            sql = `INSERT INTO ${quoteIdent(table, 'tabela')} (${colSql}) VALUES (${placeholders.join(', ')}) ON CONFLICT DO NOTHING`;
          } else if (strategy === 'upsert') {
            const updates = cols.filter((c) => !keyColumns.includes(c)).map((c) => `${quoteIdent(c, 'coluna')} = EXCLUDED.${quoteIdent(c, 'coluna')}`).join(', ');
            const conflict = keyColumns.map((c) => quoteIdent(c, 'coluna')).join(', ');
            sql = `INSERT INTO ${quoteIdent(table, 'tabela')} (${colSql}) VALUES (${placeholders.join(', ')}) ON CONFLICT (${conflict}) DO ${updates ? `UPDATE SET ${updates}` : 'NOTHING'}`;
          } else {
            sql = `INSERT INTO ${quoteIdent(table, 'tabela')} (${colSql}) VALUES (${placeholders.join(', ')})`;
          }

          try {
            const affected = await tx.execute(sql, params);
            if (affected > 0) report.inserted++;
            else report.skipped++;
          } catch (err) {
            const message = translatePgError(err);
            if (strategy === 'onlyValid') {
              report.failed++;
              if (report.errors.length < 100) report.errors.push({ row: i + 1, message });
            } else {
              throw err; // aborta a transação inteira
            }
          }
        }
      });

      await this.audit.record({
        user, submenu: 'import-export', action: 'IMPORT', mode: 'advanced', targetTable: table,
        rowsAffected: report.inserted + report.updated, transactionId, backupId, result: 'SUCCESS',
        message: `Import ${strategy}: +${report.inserted} / skip ${report.skipped} / falhas ${report.failed}`,
        ip: meta.ip, userAgent: meta.userAgent,
      });
      return { ...report, backupId };
    } catch (err) {
      const message = translatePgError(err);
      await this.audit.record({ user, submenu: 'import-export', action: 'IMPORT', targetTable: table, result: 'ERROR', message, backupId, ip: meta.ip, userAgent: meta.userAgent });
      throw new BadRequestException(`Importação revertida: ${message}`);
    }
  }
}
