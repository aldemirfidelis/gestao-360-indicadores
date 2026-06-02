import { Injectable } from '@nestjs/common';
import { PostgreSQLAdapter } from '../adapters/postgresql.adapter';
import { quoteQualified } from '../util/identifier.util';
import { ALLOWED_SCHEMAS, isProtectedTable } from '../database-admin.constants';

export interface ColumnInfo {
  name: string;
  dataType: string;
  udtName: string;
  nullable: boolean;
  default: string | null;
  maxLength: number | null;
  position: number;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: { table: string; column: string } | null;
}

export interface ConstraintInfo {
  name: string;
  type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK' | string;
  columns: string[];
  definition: string;
  referencedTable?: string | null;
}

export interface IndexInfo {
  name: string;
  table: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  definition: string;
}

export interface TableSummary {
  name: string;
  estimatedRows: number;
  columnCount: number;
  indexCount: number;
  foreignKeyCount: number;
  primaryKey: string[];
  sizeBytes: number;
  sizePretty: string;
  comment: string | null;
  kind: 'system' | 'business';
  protected: boolean;
}

export interface RelationshipInfo {
  name: string;
  sourceTable: string;
  sourceColumns: string[];
  targetTable: string;
  targetColumns: string[];
}

const SCHEMA = ALLOWED_SCHEMAS[0];

@Injectable()
export class SchemaInspectionService {
  private allowlistCache: { at: number; set: Set<string> } | null = null;

  constructor(private readonly pg: PostgreSQLAdapter) {}

  /** Conjunto de nomes de tabela existentes (cache de 30s) — base da allowlist. */
  async getAllowlist(): Promise<Set<string>> {
    if (this.allowlistCache && Date.now() - this.allowlistCache.at < 30_000) {
      return this.allowlistCache.set;
    }
    const { rows } = await this.pg.runReadOnly(
      `SELECT c.relname AS name
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relkind IN ('r','v','m')`,
      { params: [SCHEMA] },
    );
    const set = new Set(rows.map((r) => String(r.name)));
    this.allowlistCache = { at: Date.now(), set };
    return set;
  }

  async listTables(): Promise<TableSummary[]> {
    const { rows } = await this.pg.runReadOnly(
      `SELECT c.relname AS name,
              c.reltuples::bigint AS est_rows,
              pg_total_relation_size(c.oid) AS size_bytes,
              pg_size_pretty(pg_total_relation_size(c.oid)) AS size_pretty,
              obj_description(c.oid) AS comment,
              (SELECT count(*) FROM information_schema.columns col
                 WHERE col.table_schema = n.nspname AND col.table_name = c.relname) AS column_count,
              (SELECT count(*) FROM pg_index i WHERE i.indrelid = c.oid) AS index_count,
              (SELECT count(*) FROM pg_constraint con WHERE con.conrelid = c.oid AND con.contype = 'f') AS fk_count
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relkind = 'r'
        ORDER BY c.relname`,
      { params: [SCHEMA] },
    );
    const pkByTable = await this.primaryKeysByTable();
    return rows.map((r) => {
      const name = String(r.name);
      const systemTable = name.startsWith('_') || isProtectedTable(name);
      return {
        name,
        estimatedRows: Math.max(0, Number(r.est_rows ?? 0)),
        columnCount: Number(r.column_count ?? 0),
        indexCount: Number(r.index_count ?? 0),
        foreignKeyCount: Number(r.fk_count ?? 0),
        primaryKey: pkByTable.get(name) ?? [],
        sizeBytes: Number(r.size_bytes ?? 0),
        sizePretty: String(r.size_pretty ?? '0 bytes'),
        comment: r.comment ? String(r.comment) : null,
        kind: systemTable ? 'system' : 'business',
        protected: isProtectedTable(name),
      };
    });
  }

  private async primaryKeysByTable(): Promise<Map<string, string[]>> {
    const { rows } = await this.pg.runReadOnly(
      `SELECT c.relname AS table,
              array_agg(a.attname ORDER BY array_position(i.indkey, a.attnum)) AS columns
         FROM pg_index i
         JOIN pg_class c ON c.oid = i.indrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indisprimary AND n.nspname = $1
        GROUP BY c.relname`,
      { params: [SCHEMA] },
    );
    const map = new Map<string, string[]>();
    for (const r of rows) map.set(String(r.table), (r.columns as string[]) ?? []);
    return map;
  }

  async getColumns(table: string): Promise<ColumnInfo[]> {
    const constraints = await this.getConstraints(table);
    const pk = new Set(constraints.filter((c) => c.type === 'PRIMARY KEY').flatMap((c) => c.columns));
    const fkMap = new Map<string, { table: string; column: string }>();
    for (const c of constraints.filter((c) => c.type === 'FOREIGN KEY')) {
      // pg_get_constraintdef: FOREIGN KEY (col) REFERENCES "Tab"(refcol)
      const ref = /REFERENCES\s+"?([A-Za-z0-9_$]+)"?\s*\(\s*"?([A-Za-z0-9_$]+)"?\s*\)/i.exec(c.definition);
      if (ref) c.columns.forEach((col) => fkMap.set(col, { table: ref[1], column: ref[2] }));
    }
    const { rows } = await this.pg.runReadOnly(
      `SELECT column_name, data_type, udt_name, is_nullable, column_default,
              character_maximum_length, ordinal_position
         FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position`,
      { params: [SCHEMA, table] },
    );
    return rows.map((r) => {
      const name = String(r.column_name);
      return {
        name,
        dataType: String(r.data_type),
        udtName: String(r.udt_name),
        nullable: r.is_nullable === 'YES',
        default: r.column_default != null ? String(r.column_default) : null,
        maxLength: r.character_maximum_length != null ? Number(r.character_maximum_length) : null,
        position: Number(r.ordinal_position),
        isPrimaryKey: pk.has(name),
        isForeignKey: fkMap.has(name),
        references: fkMap.get(name) ?? null,
      };
    });
  }

  async getConstraints(table: string): Promise<ConstraintInfo[]> {
    const regclass = quoteQualified(SCHEMA, table);
    const { rows } = await this.pg.runReadOnly(
      `SELECT con.conname AS name, con.contype AS type,
              pg_get_constraintdef(con.oid) AS definition,
              array(SELECT a.attname FROM pg_attribute a
                     WHERE a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)) AS columns,
              CASE WHEN con.confrelid <> 0 THEN con.confrelid::regclass::text END AS referenced_table
         FROM pg_constraint con
        WHERE con.conrelid = $1::regclass`,
      { params: [regclass] },
    );
    const typeMap: Record<string, ConstraintInfo['type']> = { p: 'PRIMARY KEY', f: 'FOREIGN KEY', u: 'UNIQUE', c: 'CHECK' };
    return rows.map((r) => ({
      name: String(r.name),
      type: typeMap[String(r.type)] ?? String(r.type),
      columns: (r.columns as string[]) ?? [],
      definition: String(r.definition ?? ''),
      referencedTable: r.referenced_table ? stripQualified(String(r.referenced_table)) : null,
    }));
  }

  async getIndexes(table?: string): Promise<IndexInfo[]> {
    const where = table ? 'n.nspname = $1 AND c.relname = $2' : 'n.nspname = $1';
    const params = table ? [SCHEMA, table] : [SCHEMA];
    const { rows } = await this.pg.runReadOnly(
      `SELECT ic.relname AS name, c.relname AS table, ix.indisunique AS is_unique,
              ix.indisprimary AS is_primary, pg_get_indexdef(ix.indexrelid) AS definition,
              array(SELECT pg_get_indexdef(ix.indexrelid, k + 1, true)
                      FROM generate_subscripts(ix.indkey, 1) k) AS columns
         FROM pg_index ix
         JOIN pg_class c ON c.oid = ix.indrelid
         JOIN pg_class ic ON ic.oid = ix.indexrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE ${where}
        ORDER BY c.relname, ic.relname`,
      { params },
    );
    return rows.map((r) => ({
      name: String(r.name),
      table: String(r.table),
      columns: ((r.columns as string[]) ?? []).filter(Boolean),
      isUnique: Boolean(r.is_unique),
      isPrimary: Boolean(r.is_primary),
      definition: String(r.definition ?? ''),
    }));
  }

  async getRelationships(): Promise<RelationshipInfo[]> {
    const { rows } = await this.pg.runReadOnly(
      `SELECT con.conname AS name,
              con.conrelid::regclass::text AS source_table,
              con.confrelid::regclass::text AS target_table,
              array(SELECT a.attname FROM pg_attribute a
                     WHERE a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)) AS source_columns,
              array(SELECT a.attname FROM pg_attribute a
                     WHERE a.attrelid = con.confrelid AND a.attnum = ANY(con.confkey)) AS target_columns
         FROM pg_constraint con
         JOIN pg_namespace n ON n.oid = con.connamespace
        WHERE con.contype = 'f' AND n.nspname = $1`,
      { params: [SCHEMA] },
    );
    return rows.map((r) => ({
      name: String(r.name),
      sourceTable: stripQualified(String(r.source_table)),
      targetTable: stripQualified(String(r.target_table)),
      sourceColumns: (r.source_columns as string[]) ?? [],
      targetColumns: (r.target_columns as string[]) ?? [],
    }));
  }

  async listViews(): Promise<string[]> {
    const { rows } = await this.pg.runReadOnly(
      `SELECT table_name FROM information_schema.views WHERE table_schema = $1 ORDER BY table_name`,
      { params: [SCHEMA] },
    );
    return rows.map((r) => String(r.table_name));
  }
}

/** Remove prefixo de schema e aspas de um nome qualificado vindo de ::regclass::text. */
function stripQualified(value: string): string {
  const noSchema = value.includes('.') ? value.slice(value.indexOf('.') + 1) : value;
  return noSchema.replace(/^"|"$/g, '');
}
