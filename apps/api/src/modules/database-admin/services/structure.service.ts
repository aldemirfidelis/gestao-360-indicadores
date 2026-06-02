import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthPayload } from '../../auth/auth.types';
import { PostgreSQLAdapter } from '../adapters/postgresql.adapter';
import { SchemaInspectionService } from './schema-inspection.service';
import { BackupService } from './backup.service';
import { DbAdminAuditService } from './db-admin-audit.service';
import { assertInAllowlist, assertValidIdentifier, quoteIdent } from '../util/identifier.util';
import { normalizeType } from '../util/sql-type';
import { translatePgError } from '../util/pg-error';
import { CRITICAL_CONFIRMATION_PHRASE, DB_ADMIN_LIMITS, isProtectedTable } from '../database-admin.constants';
import { ReqMeta } from './record-management.service';

type Risk = 'low' | 'medium' | 'high';

export interface DdlPlan {
  sql: string;
  risk: Risk;
  warnings: string[];
  requiresConfirmationPhrase: boolean;
  confirmationPhrase: string;
  snapshotTable?: string | null;
}

interface ColumnDef {
  name: string;
  type: string;
  nullable?: boolean;
  default?: string | null;
  primaryKey?: boolean;
}

const SAFE_DEFAULT = /^(now\(\)|current_timestamp|gen_random_uuid\(\)|uuid_generate_v4\(\)|true|false|null|-?\d+(\.\d+)?)$/i;

@Injectable()
export class StructureService {
  constructor(
    private readonly pg: PostgreSQLAdapter,
    private readonly schema: SchemaInspectionService,
    private readonly backup: BackupService,
    private readonly audit: DbAdminAuditService,
  ) {}

  /** Constrói o SQL e a análise de risco de uma operação estrutural (sem executar). */
  async plan(operation: string, params: Record<string, unknown>): Promise<DdlPlan> {
    const allow = await this.schema.getAllowlist();
    const warnings: string[] = [];
    const phrase = CRITICAL_CONFIRMATION_PHRASE;
    const mk = (sql: string, risk: Risk, snapshotTable?: string | null): DdlPlan => ({
      sql, risk, warnings, requiresConfirmationPhrase: risk === 'high', confirmationPhrase: phrase, snapshotTable: snapshotTable ?? null,
    });
    const table = () => assertInAllowlist(String(params.table), allow, 'tabela');
    const blockProtected = (t: string, action: string) => {
      if (isProtectedTable(t)) throw new ForbiddenException(`Tabela protegida: ${action} bloqueado em "${t}".`);
    };

    switch (operation) {
      case 'createTable': {
        const name = assertValidIdentifier(String(params.table), 'tabela');
        const cols = (params.columns as ColumnDef[]) ?? [];
        if (cols.length === 0) throw new BadRequestException('Informe ao menos uma coluna.');
        const defs = cols.map((c) => this.columnDef(c));
        const pkCols = cols.filter((c) => c.primaryKey).map((c) => quoteIdent(c.name, 'coluna'));
        const pk = pkCols.length ? `,\n  PRIMARY KEY (${pkCols.join(', ')})` : '';
        return mk(`CREATE TABLE ${quoteIdent(name, 'tabela')} (\n  ${defs.join(',\n  ')}${pk}\n);`, 'medium');
      }
      case 'renameTable': {
        const t = table();
        const nn = assertValidIdentifier(String(params.newName), 'tabela');
        return mk(`ALTER TABLE ${quoteIdent(t, 'tabela')} RENAME TO ${quoteIdent(nn, 'tabela')};`, 'medium');
      }
      case 'dropTable': {
        const t = table();
        blockProtected(t, 'DROP TABLE');
        warnings.push('Remove a tabela e todos os seus dados. Um snapshot lógico será criado.');
        return mk(`DROP TABLE ${quoteIdent(t, 'tabela')};`, 'high', t);
      }
      case 'truncateTable': {
        const t = table();
        blockProtected(t, 'TRUNCATE');
        warnings.push('Remove TODOS os registros da tabela. Snapshot lógico será criado.');
        return mk(`TRUNCATE TABLE ${quoteIdent(t, 'tabela')};`, 'high', t);
      }
      case 'addColumn': {
        const t = table();
        const col = params.column as ColumnDef;
        return mk(`ALTER TABLE ${quoteIdent(t, 'tabela')} ADD COLUMN ${this.columnDef(col)};`, 'medium');
      }
      case 'renameColumn': {
        const t = table();
        const c = assertValidIdentifier(String(params.column), 'coluna');
        const nn = assertValidIdentifier(String(params.newName), 'coluna');
        return mk(`ALTER TABLE ${quoteIdent(t, 'tabela')} RENAME COLUMN ${quoteIdent(c, 'coluna')} TO ${quoteIdent(nn, 'coluna')};`, 'medium');
      }
      case 'alterColumnType': {
        const t = table();
        const c = assertValidIdentifier(String(params.column), 'coluna');
        const type = normalizeType(String(params.newType));
        const using = params.using ? ` USING ${quoteIdent(c, 'coluna')}::${type}` : '';
        warnings.push('Alterar o tipo pode falhar/perder dados se a conversão não for compatível.');
        return mk(`ALTER TABLE ${quoteIdent(t, 'tabela')} ALTER COLUMN ${quoteIdent(c, 'coluna')} TYPE ${type}${using};`, 'high', t);
      }
      case 'setColumnNullable': {
        const t = table();
        const c = assertValidIdentifier(String(params.column), 'coluna');
        const op = params.nullable ? 'DROP NOT NULL' : 'SET NOT NULL';
        return mk(`ALTER TABLE ${quoteIdent(t, 'tabela')} ALTER COLUMN ${quoteIdent(c, 'coluna')} ${op};`, 'medium');
      }
      case 'setColumnDefault': {
        const t = table();
        const c = assertValidIdentifier(String(params.column), 'coluna');
        if (params.default === null || params.default === undefined || params.default === '') {
          return mk(`ALTER TABLE ${quoteIdent(t, 'tabela')} ALTER COLUMN ${quoteIdent(c, 'coluna')} DROP DEFAULT;`, 'medium');
        }
        return mk(`ALTER TABLE ${quoteIdent(t, 'tabela')} ALTER COLUMN ${quoteIdent(c, 'coluna')} SET DEFAULT ${this.defaultExpr(String(params.default))};`, 'medium');
      }
      case 'dropColumn': {
        const t = table();
        blockProtected(t, 'DROP COLUMN');
        const c = assertValidIdentifier(String(params.column), 'coluna');
        warnings.push('Remove a coluna e seus dados. Snapshot lógico da tabela será criado.');
        return mk(`ALTER TABLE ${quoteIdent(t, 'tabela')} DROP COLUMN ${quoteIdent(c, 'coluna')};`, 'high', t);
      }
      case 'createIndex': {
        const t = table();
        const cols = (params.columns as string[]) ?? [];
        if (cols.length === 0) throw new BadRequestException('Informe as colunas do índice.');
        const colSql = cols.map((c) => quoteIdent(c, 'coluna')).join(', ');
        const unique = params.unique ? 'UNIQUE ' : '';
        const name = params.name ? assertValidIdentifier(String(params.name), 'índice') : `idx_${t}_${cols.join('_')}`.slice(0, 63);
        return mk(`CREATE ${unique}INDEX ${quoteIdent(name, 'índice')} ON ${quoteIdent(t, 'tabela')} (${colSql});`, 'medium');
      }
      case 'dropIndex': {
        const name = assertValidIdentifier(String(params.name), 'índice');
        warnings.push('Remove o índice.');
        return mk(`DROP INDEX ${quoteIdent(name, 'índice')};`, 'high');
      }
      case 'addUnique': {
        const t = table();
        const cols = (params.columns as string[]) ?? [];
        const name = params.name ? assertValidIdentifier(String(params.name), 'constraint') : `uq_${t}_${cols.join('_')}`.slice(0, 63);
        return mk(`ALTER TABLE ${quoteIdent(t, 'tabela')} ADD CONSTRAINT ${quoteIdent(name, 'constraint')} UNIQUE (${cols.map((c) => quoteIdent(c, 'coluna')).join(', ')});`, 'medium');
      }
      case 'addPrimaryKey': {
        const t = table();
        const cols = (params.columns as string[]) ?? [];
        const name = `${t}_pkey`.slice(0, 63);
        return mk(`ALTER TABLE ${quoteIdent(t, 'tabela')} ADD CONSTRAINT ${quoteIdent(name, 'constraint')} PRIMARY KEY (${cols.map((c) => quoteIdent(c, 'coluna')).join(', ')});`, 'medium');
      }
      case 'addForeignKey': {
        const t = table();
        const c = assertValidIdentifier(String(params.column), 'coluna');
        const rt = assertInAllowlist(String(params.refTable), allow, 'tabela');
        const rc = assertValidIdentifier(String(params.refColumn), 'coluna');
        const name = params.name ? assertValidIdentifier(String(params.name), 'constraint') : `fk_${t}_${c}`.slice(0, 63);
        return mk(`ALTER TABLE ${quoteIdent(t, 'tabela')} ADD CONSTRAINT ${quoteIdent(name, 'constraint')} FOREIGN KEY (${quoteIdent(c, 'coluna')}) REFERENCES ${quoteIdent(rt, 'tabela')} (${quoteIdent(rc, 'coluna')});`, 'medium');
      }
      case 'dropConstraint': {
        const t = table();
        blockProtected(t, 'DROP CONSTRAINT');
        const name = assertValidIdentifier(String(params.name), 'constraint');
        warnings.push('Remove a constraint (PK/FK/UNIQUE/CHECK).');
        return mk(`ALTER TABLE ${quoteIdent(t, 'tabela')} DROP CONSTRAINT ${quoteIdent(name, 'constraint')};`, 'high');
      }
      default:
        throw new BadRequestException(`Operação estrutural desconhecida: ${operation}`);
    }
  }

  async execute(operation: string, params: Record<string, unknown>, confirmationPhrase: string | undefined, user: AuthPayload, meta: ReqMeta) {
    const plan = await this.plan(operation, params);
    if (plan.requiresConfirmationPhrase && confirmationPhrase !== plan.confirmationPhrase) {
      throw new BadRequestException(`Operação de alto risco. Para confirmar, digite exatamente: "${plan.confirmationPhrase}".`);
    }

    // Snapshot lógico antes de operações que removem dados
    let backupId: string | null = null;
    if (plan.snapshotTable) {
      try {
        const rows = await this.pg.runReadOnly(`SELECT * FROM ${quoteIdent(plan.snapshotTable, 'tabela')} LIMIT ${DB_ADMIN_LIMITS.maxSnapshotRows}`);
        const snap = await this.backup.snapshot({
          table: plan.snapshotTable, rows: rows.rows, type: 'PRE_OP', reason: `DDL: ${operation}`, relatedOperation: `structure.${operation}`,
          userId: user.sub, userEmail: user.email,
        });
        backupId = snap.backupId;
      } catch {
        /* tabela pode não existir ainda (createTable) */
      }
    }

    try {
      const { transactionId } = await this.pg.runInTransaction(async (tx) => tx.execute(plan.sql));
      await this.audit.record({
        user, submenu: 'structure', action: 'DDL', mode: 'advanced',
        targetTable: typeof params.table === 'string' ? params.table : null,
        sqlText: plan.sql, transactionId, backupId, result: 'SUCCESS', message: `DDL: ${operation}`,
        ip: meta.ip, userAgent: meta.userAgent,
      });
      return { ok: true, sql: plan.sql, transactionId, backupId };
    } catch (err) {
      const message = translatePgError(err);
      await this.audit.record({
        user, submenu: 'structure', action: 'DDL', mode: 'advanced',
        targetTable: typeof params.table === 'string' ? params.table : null,
        sqlText: plan.sql, backupId, result: 'ERROR', message, ip: meta.ip, userAgent: meta.userAgent,
      });
      throw new BadRequestException(message);
    }
  }

  private columnDef(c: ColumnDef): string {
    const name = quoteIdent(c.name, 'coluna');
    const type = normalizeType(c.type);
    const nn = c.nullable === false ? ' NOT NULL' : '';
    const def = c.default !== undefined && c.default !== null && c.default !== '' ? ` DEFAULT ${this.defaultExpr(String(c.default))}` : '';
    return `${name} ${type}${nn}${def}`;
  }

  private defaultExpr(value: string): string {
    if (SAFE_DEFAULT.test(value.trim())) return value.trim();
    return `'${value.replace(/'/g, "''")}'`;
  }
}
