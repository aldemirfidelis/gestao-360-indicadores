import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthPayload } from '../../auth/auth.types';
import { PostgreSQLAdapter } from '../adapters/postgresql.adapter';
import { SchemaInspectionService, ColumnInfo } from './schema-inspection.service';
import { BackupService } from './backup.service';
import { DbAdminAuditService } from './db-admin-audit.service';
import { assertInAllowlist, quoteIdent } from '../util/identifier.util';
import { buildWhere, FilterCondition } from '../util/where-builder';
import { castSuffix, coerceParam } from '../util/value-cast';
import { DB_ADMIN_LIMITS } from '../database-admin.constants';
import { translatePgError } from '../util/pg-error';

export interface RowQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  dir?: 'asc' | 'desc';
  search?: string;
  filters?: FilterCondition[];
}

export interface ReqMeta {
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class RecordManagementService {
  constructor(
    private readonly pg: PostgreSQLAdapter,
    private readonly schema: SchemaInspectionService,
    private readonly backup: BackupService,
    private readonly audit: DbAdminAuditService,
  ) {}

  private async columnsOf(table: string): Promise<{ columns: ColumnInfo[]; set: Set<string>; pk: string[] }> {
    const allow = await this.schema.getAllowlist();
    assertInAllowlist(table, allow, 'tabela');
    const columns = await this.schema.getColumns(table);
    if (columns.length === 0) throw new BadRequestException(`Tabela sem colunas ou inexistente: ${table}`);
    const set = new Set(columns.map((c) => c.name));
    const pk = columns.filter((c) => c.isPrimaryKey).map((c) => c.name);
    return { columns, set, pk };
  }

  async getRows(table: string, q: RowQuery) {
    const { columns, set, pk } = await this.columnsOf(table);
    const pageSize = Math.min(Math.max(q.pageSize ?? DB_ADMIN_LIMITS.defaultPageSize, 1), DB_ADMIN_LIMITS.maxPageSize);
    const page = Math.max(q.page ?? 1, 1);
    const offset = (page - 1) * pageSize;
    const sort = q.sort && set.has(q.sort) ? q.sort : pk[0] ?? columns[0].name;
    const dir = q.dir === 'desc' ? 'DESC' : 'ASC';

    const params: unknown[] = [];
    const clauses: string[] = [];
    if (q.filters && q.filters.length > 0) {
      const w = buildWhere(q.filters, set, params.length + 1, 'AND');
      if (w.clause) {
        clauses.push(`(${w.clause})`);
        params.push(...w.params);
      }
    }
    const search = (q.search ?? '').trim();
    if (search) {
      const ors = columns.map((c) => {
        params.push(`%${search}%`);
        return `${quoteIdent(c.name, 'coluna')}::text ILIKE $${params.length}`;
      });
      clauses.push(`(${ors.join(' OR ')})`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const tbl = quoteIdent(table, 'tabela');

    const countRes = await this.pg.runReadOnly(`SELECT count(*)::int AS total FROM ${tbl} ${where}`, { params });
    const total = Number(countRes.rows[0]?.total ?? 0);

    const dataParams = [...params, pageSize, offset];
    const rowsRes = await this.pg.runReadOnly(
      `SELECT * FROM ${tbl} ${where} ORDER BY ${quoteIdent(sort, 'coluna')} ${dir} LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      { params: dataParams },
    );

    return { table, columns, primaryKey: pk, rows: rowsRes.rows, total, page, pageSize };
  }

  async insert(table: string, values: Record<string, unknown>, user: AuthPayload, meta: ReqMeta) {
    const { columns, set } = await this.columnsOf(table);
    const cols = Object.keys(values).filter((k) => set.has(k));
    if (cols.length === 0) throw new BadRequestException('Nenhuma coluna válida informada.');
    const byName = new Map(columns.map((c) => [c.name, c]));
    const params: unknown[] = [];
    const placeholders = cols.map((name) => {
      const col = byName.get(name)!;
      params.push(coerceParam(col, values[name]));
      return `$${params.length}${castSuffix(col)}`;
    });
    const sql = `INSERT INTO ${quoteIdent(table, 'tabela')} (${cols.map((c) => quoteIdent(c, 'coluna')).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;

    try {
      const { result, transactionId } = await this.pg.runInTransaction(async (tx) => tx.query(sql, params));
      const inserted = result[0] ?? null;
      await this.audit.record({
        user, submenu: 'records', action: 'INSERT', mode: 'advanced', targetTable: table,
        afterValue: inserted, rowsAffected: 1, transactionId, result: 'SUCCESS',
        ip: meta.ip, userAgent: meta.userAgent,
      });
      return inserted;
    } catch (err) {
      const message = translatePgError(err);
      await this.audit.record({ user, submenu: 'records', action: 'INSERT', targetTable: table, result: 'ERROR', message, ip: meta.ip, userAgent: meta.userAgent });
      throw new BadRequestException(message);
    }
  }

  async update(table: string, key: Record<string, unknown>, values: Record<string, unknown>, user: AuthPayload, meta: ReqMeta) {
    const { columns, set, pk } = await this.columnsOf(table);
    const byName = new Map(columns.map((c) => [c.name, c]));
    this.assertKey(key, pk, set);
    const cols = Object.keys(values).filter((k) => set.has(k));
    if (cols.length === 0) throw new BadRequestException('Nenhuma coluna válida para atualizar.');

    const before = await this.fetchByKey(table, key, byName);

    const params: unknown[] = [];
    const setSql = cols.map((name) => {
      const col = byName.get(name)!;
      params.push(coerceParam(col, values[name]));
      return `${quoteIdent(name, 'coluna')} = $${params.length}${castSuffix(col)}`;
    });
    const whereSql = Object.keys(key).map((name) => {
      const col = byName.get(name)!;
      params.push(coerceParam(col, key[name]));
      return `${quoteIdent(name, 'coluna')} = $${params.length}${castSuffix(col)}`;
    });
    const sql = `UPDATE ${quoteIdent(table, 'tabela')} SET ${setSql.join(', ')} WHERE ${whereSql.join(' AND ')} RETURNING *`;

    try {
      const { result, transactionId } = await this.pg.runInTransaction(async (tx) => tx.query(sql, params));
      if (result.length === 0) throw new BadRequestException('Nenhum registro encontrado para a chave informada.');
      await this.audit.record({
        user, submenu: 'records', action: 'UPDATE', mode: 'advanced', targetTable: table,
        targetRecordId: keyLabel(key), beforeValue: before, afterValue: result[0], rowsAffected: result.length,
        transactionId, result: 'SUCCESS', ip: meta.ip, userAgent: meta.userAgent,
      });
      return result[0];
    } catch (err) {
      const message = translatePgError(err);
      await this.audit.record({ user, submenu: 'records', action: 'UPDATE', targetTable: table, targetRecordId: keyLabel(key), result: 'ERROR', message, ip: meta.ip, userAgent: meta.userAgent });
      throw new BadRequestException(message);
    }
  }

  async deleteRows(table: string, keys: Record<string, unknown>[], user: AuthPayload, meta: ReqMeta) {
    const { columns, set, pk } = await this.columnsOf(table);
    const byName = new Map(columns.map((c) => [c.name, c]));
    if (!Array.isArray(keys) || keys.length === 0) throw new BadRequestException('Informe ao menos uma chave.');
    if (keys.length > DB_ADMIN_LIMITS.maxRows) throw new BadRequestException(`Exclusão limitada a ${DB_ADMIN_LIMITS.maxRows} registros por vez.`);
    keys.forEach((k) => this.assertKey(k, pk, set));

    // Snapshot prévio (backup automático) das linhas afetadas
    const snapshotRows: Record<string, unknown>[] = [];
    for (const k of keys) {
      const row = await this.fetchByKey(table, k, byName);
      if (row) snapshotRows.push(row);
    }
    const snap = snapshotRows.length
      ? await this.backup.snapshot({
          table, rows: snapshotRows, type: 'PRE_OP', reason: 'Exclusão de registros', relatedOperation: 'records.delete',
          userId: user.sub, userEmail: user.email,
        })
      : null;

    try {
      const { result, transactionId } = await this.pg.runInTransaction(async (tx) => {
        let affected = 0;
        for (const k of keys) {
          const params: unknown[] = [];
          const whereSql = Object.keys(k).map((name) => {
            const col = byName.get(name)!;
            params.push(coerceParam(col, k[name]));
            return `${quoteIdent(name, 'coluna')} = $${params.length}${castSuffix(col)}`;
          });
          affected += await tx.execute(`DELETE FROM ${quoteIdent(table, 'tabela')} WHERE ${whereSql.join(' AND ')}`, params);
        }
        return affected;
      });
      await this.audit.record({
        user, submenu: 'records', action: 'DELETE', mode: 'advanced', targetTable: table,
        beforeValue: snapshotRows, rowsAffected: result, transactionId, backupId: snap?.backupId ?? null,
        result: 'SUCCESS', message: `${result} registro(s) excluído(s).`, ip: meta.ip, userAgent: meta.userAgent,
      });
      return { deleted: result, backupId: snap?.backupId ?? null };
    } catch (err) {
      const message = translatePgError(err);
      await this.audit.record({ user, submenu: 'records', action: 'DELETE', targetTable: table, result: 'ERROR', message, backupId: snap?.backupId ?? null, ip: meta.ip, userAgent: meta.userAgent });
      throw new BadRequestException(message);
    }
  }

  private assertKey(key: Record<string, unknown>, pk: string[], set: Set<string>) {
    const cols = Object.keys(key ?? {});
    if (cols.length === 0) throw new BadRequestException('Chave do registro não informada.');
    for (const c of cols) if (!set.has(c)) throw new BadRequestException(`Coluna de chave inválida: ${c}`);
    if (pk.length > 0 && !pk.every((p) => cols.includes(p))) {
      throw new BadRequestException(`A chave deve conter a(s) coluna(s) de PK: ${pk.join(', ')}`);
    }
  }

  private async fetchByKey(table: string, key: Record<string, unknown>, byName: Map<string, ColumnInfo>): Promise<Record<string, unknown> | null> {
    const params: unknown[] = [];
    const whereSql = Object.keys(key).map((name) => {
      const col = byName.get(name)!;
      params.push(coerceParam(col, key[name]));
      return `${quoteIdent(name, 'coluna')} = $${params.length}${castSuffix(col)}`;
    });
    const res = await this.pg.runReadOnly(`SELECT * FROM ${quoteIdent(table, 'tabela')} WHERE ${whereSql.join(' AND ')} LIMIT 1`, { params });
    return res.rows[0] ?? null;
  }
}

function keyLabel(key: Record<string, unknown>): string {
  return Object.entries(key).map(([k, v]) => `${k}=${String(v)}`).join(', ');
}
