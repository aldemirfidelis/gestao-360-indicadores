import { BadRequestException, Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { AuthPayload } from '../../auth/auth.types';
import { PostgreSQLAdapter } from '../adapters/postgresql.adapter';
import { SchemaInspectionService } from './schema-inspection.service';
import { QueryValidationService } from './query-validation.service';
import { DbAdminAuditService } from './db-admin-audit.service';
import { assertInAllowlist, quoteIdent } from '../util/identifier.util';
import { toCsv } from '../util/csv';
import { ReqMeta } from './record-management.service';

export type ExportFormat = 'csv' | 'json' | 'sql' | 'xlsx';

export interface ExportPayload {
  filename: string;
  mimeType: string;
  encoding: 'utf8' | 'base64';
  content: string;
  rowCount: number;
}

const EXPORT_ROW_CAP = 50_000;

@Injectable()
export class ExportService {
  constructor(
    private readonly pg: PostgreSQLAdapter,
    private readonly schema: SchemaInspectionService,
    private readonly validation: QueryValidationService,
    private readonly audit: DbAdminAuditService,
  ) {}

  async exportTable(table: string, format: ExportFormat, user: AuthPayload, meta: ReqMeta): Promise<ExportPayload> {
    const allow = await this.schema.getAllowlist();
    assertInAllowlist(table, allow, 'tabela');
    const res = await this.pg.runReadOnly(`SELECT * FROM ${quoteIdent(table, 'tabela')} LIMIT ${EXPORT_ROW_CAP + 1}`);
    const rows = res.rows.slice(0, EXPORT_ROW_CAP);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : (await this.schema.getColumns(table)).map((c) => c.name);
    const payload = await this.build(table, columns, rows, format);
    await this.audit.record({ user, submenu: 'import-export', action: 'EXPORT', targetTable: table, rowsAffected: rows.length, result: 'SUCCESS', message: `Export ${format}`, ip: meta.ip, userAgent: meta.userAgent });
    return payload;
  }

  async exportQuery(sql: string, format: ExportFormat, user: AuthPayload, meta: ReqMeta): Promise<ExportPayload> {
    const v = this.validation.analyze(sql);
    if (!v.isReadOnly) throw new BadRequestException('Apenas consultas de leitura (SELECT) podem ser exportadas.');
    const cleaned = sql.trim().replace(/;\s*$/, '');
    const res = await this.pg.runReadOnly(`SELECT * FROM (${cleaned}) AS _q LIMIT ${EXPORT_ROW_CAP + 1}`);
    const rows = res.rows.slice(0, EXPORT_ROW_CAP);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const payload = await this.build('consulta', columns, rows, format);
    await this.audit.record({ user, submenu: 'import-export', action: 'EXPORT', sqlText: sql.slice(0, 2000), rowsAffected: rows.length, result: 'SUCCESS', message: `Export consulta ${format}`, ip: meta.ip, userAgent: meta.userAgent });
    return payload;
  }

  private async build(name: string, columns: string[], rows: Record<string, unknown>[], format: ExportFormat): Promise<ExportPayload> {
    const base = name.replace(/[^A-Za-z0-9_-]/g, '_');
    switch (format) {
      case 'csv':
        return { filename: `${base}.csv`, mimeType: 'text/csv;charset=utf-8', encoding: 'utf8', content: toCsv(columns, rows), rowCount: rows.length };
      case 'json':
        return { filename: `${base}.json`, mimeType: 'application/json', encoding: 'utf8', content: JSON.stringify(rows, null, 2), rowCount: rows.length };
      case 'sql':
        return { filename: `${base}.sql`, mimeType: 'application/sql', encoding: 'utf8', content: this.toSqlInserts(name, columns, rows), rowCount: rows.length };
      case 'xlsx': {
        const wb = new Workbook();
        const ws = wb.addWorksheet(base.slice(0, 31) || 'dados');
        ws.addRow(columns);
        for (const r of rows) ws.addRow(columns.map((c) => normalizeCell(r[c])));
        const buf = await wb.xlsx.writeBuffer();
        return { filename: `${base}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', encoding: 'base64', content: Buffer.from(buf).toString('base64'), rowCount: rows.length };
      }
      default:
        throw new BadRequestException(`Formato inválido: ${format}`);
    }
  }

  private toSqlInserts(table: string, columns: string[], rows: Record<string, unknown>[]): string {
    const colSql = columns.map((c) => `"${c}"`).join(', ');
    const lines = rows.map((r) => {
      const vals = columns.map((c) => sqlLiteral(r[c])).join(', ');
      return `INSERT INTO "${table}" (${colSql}) VALUES (${vals});`;
    });
    return [`-- Export de ${table} (${rows.length} linhas)`, ...lines].join('\n');
  }
}

function normalizeCell(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  return String(v);
}

function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return `'${s.replace(/'/g, "''")}'`;
}
