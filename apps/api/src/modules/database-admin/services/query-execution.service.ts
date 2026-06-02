import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { PostgreSQLAdapter } from '../adapters/postgresql.adapter';
import { QueryValidationService, ValidationResult } from './query-validation.service';
import { DbAdminAuditService } from './db-admin-audit.service';
import { DB_ADMIN_LIMITS } from '../database-admin.constants';
import { translatePgError } from '../util/pg-error';
import { ReqMeta } from './record-management.service';

export interface ExecuteResult {
  mode: 'safe' | 'advanced';
  isReadOnly: boolean;
  statementType: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  rowsAffected: number | null;
  truncated: boolean;
  durationMs: number;
  transactionId: string | null;
  analysis: ValidationResult;
}

const RETURNS_ROWS = /^(SELECT|EXPLAIN|SHOW|WITH|VALUES|TABLE)\b/i;

@Injectable()
export class QueryExecutionService {
  constructor(
    private readonly pg: PostgreSQLAdapter,
    private readonly validation: QueryValidationService,
    private readonly prisma: PrismaService,
    private readonly audit: DbAdminAuditService,
  ) {}

  validate(sql: string) {
    return this.validation.analyze(sql);
  }

  async execute(
    sql: string,
    mode: 'safe' | 'advanced',
    confirmationPhrase: string | undefined,
    user: AuthPayload,
    meta: ReqMeta,
  ): Promise<ExecuteResult> {
    const analysis = this.validation.assertExecutable(sql, mode, confirmationPhrase);
    const started = Date.now();
    const cleaned = sql.trim().replace(/;\s*$/, '');
    const maxRows = DB_ADMIN_LIMITS.maxRows;
    const action = analysis.isReadOnly ? 'SELECT' : analysis.statementType;

    try {
      let rows: Record<string, unknown>[] = [];
      let rowsAffected: number | null = null;
      let truncated = false;
      let transactionId: string | null = null;

      if (analysis.isReadOnly) {
        // Cap de linhas: encapsula SELECT/WITH em subquery com LIMIT quando seguro.
        const canWrap = (analysis.statementType === 'SELECT' || analysis.statementType === 'WITH') && !/\bINTO\b/i.test(cleaned);
        const timeout = mode === 'safe' ? DB_ADMIN_LIMITS.safeStatementTimeoutMs : DB_ADMIN_LIMITS.advancedStatementTimeoutMs;
        if (canWrap) {
          const res = await this.pg.runReadOnly(`SELECT * FROM (${cleaned}) AS _q LIMIT ${maxRows + 1}`, { timeoutMs: timeout });
          rows = res.rows;
        } else {
          const res = await this.pg.runReadOnly(cleaned, { timeoutMs: timeout });
          rows = res.rows;
        }
        if (rows.length > maxRows) {
          truncated = true;
          rows = rows.slice(0, maxRows);
        }
      } else {
        // Escrita/DDL no Modo Avançado: transação (rollback automático em erro).
        const out = await this.pg.runInTransaction(async (tx) => {
          if (RETURNS_ROWS.test(cleaned) || /\bRETURNING\b/i.test(cleaned)) {
            const r = await tx.query(cleaned);
            return { rows: r, affected: r.length };
          }
          const affected = await tx.execute(cleaned);
          return { rows: [] as Record<string, unknown>[], affected };
        });
        transactionId = out.transactionId;
        rows = out.result.rows.slice(0, maxRows);
        truncated = out.result.rows.length > maxRows;
        rowsAffected = out.result.affected;
      }

      const durationMs = Date.now() - started;
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      await this.recordHistory(user.sub, sql, mode, durationMs, rows.length, true, null);
      await this.audit.record({
        user, submenu: 'query', action, mode,
        sqlText: mode === 'advanced' || !analysis.isReadOnly ? sql : sql.slice(0, 2000),
        rowsAffected, transactionId, result: 'SUCCESS',
        message: truncated ? `Resultado truncado em ${maxRows} linhas.` : null,
        ip: meta.ip, userAgent: meta.userAgent,
      });

      return {
        mode, isReadOnly: analysis.isReadOnly, statementType: analysis.statementType,
        columns, rows, rowCount: rows.length, rowsAffected, truncated, durationMs, transactionId, analysis,
      };
    } catch (err) {
      const message = translatePgError(err);
      const durationMs = Date.now() - started;
      await this.recordHistory(user.sub, sql, mode, durationMs, 0, false, message);
      await this.audit.record({ user, submenu: 'query', action, mode, sqlText: sql, result: 'ERROR', message, ip: meta.ip, userAgent: meta.userAgent });
      // Preserva 403/400 da validação; demais erros viram 400 com mensagem traduzida.
      throw err instanceof HttpException ? err : new BadRequestException(message);
    }
  }

  async explain(sql: string): Promise<Record<string, unknown>[]> {
    const cleaned = sql.trim().replace(/;\s*$/, '');
    return this.pg.explain(cleaned);
  }

  private async recordHistory(userId: string, sql: string, mode: string, durationMs: number, rowCount: number, success: boolean, message: string | null) {
    try {
      await this.prisma.dbAdminQueryHistory.create({
        data: { userId, sql: sql.slice(0, 10_000), mode, durationMs, rowCount, success, message },
      });
    } catch {
      /* histórico é best-effort */
    }
  }

  listHistory(userId: string) {
    return this.prisma.dbAdminQueryHistory.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  listFavorites(userId: string) {
    return this.prisma.dbAdminSavedQuery.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
  }

  saveFavorite(userId: string, name: string, sql: string) {
    return this.prisma.dbAdminSavedQuery.create({ data: { userId, name: name.slice(0, 200), sql: sql.slice(0, 10_000), isFavorite: true } });
  }

  deleteFavorite(userId: string, id: string) {
    return this.prisma.dbAdminSavedQuery.deleteMany({ where: { id, userId } });
  }
}
