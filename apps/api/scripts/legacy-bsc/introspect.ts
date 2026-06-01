/**
 * Introspeccao do banco SQL Server do BSC legado.
 *
 * Conecta (SOMENTE LEITURA) no backup restaurado e gera um relatorio com:
 *   - todas as tabelas e suas contagens de linhas
 *   - colunas (nome, tipo, nullability) de cada tabela
 *   - chaves estrangeiras (para reconstruir a hierarquia areas/indicadores)
 *   - uma amostra das primeiras linhas de cada tabela
 *
 * O resultado e salvo em scripts/legacy-bsc/output/introspect-<timestamp>.json.
 * Com ele em maos conseguimos escrever as queries de extracao reais em migrate.ts.
 *
 * Uso:
 *   BSC_SQL_SERVER=localhost BSC_SQL_DATABASE=BSC BSC_SQL_USER=ro_user \
 *   BSC_SQL_PASSWORD=*** pnpm --filter @g360/api exec tsx scripts/legacy-bsc/introspect.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sql from 'mssql';
import { sqlServerConfig } from './config';

const SAMPLE_ROWS = Number(process.env.BSC_SAMPLE_ROWS ?? 5);

interface ColumnInfo {
  name: string;
  type: string;
  maxLength: number | null;
  nullable: boolean;
}

interface ForeignKeyInfo {
  name: string;
  column: string;
  refTable: string;
  refColumn: string;
}

interface TableReport {
  schema: string;
  table: string;
  rowCount: number;
  columns: ColumnInfo[];
  foreignKeys: ForeignKeyInfo[];
  sample: Record<string, unknown>[];
}

async function main() {
  const pool = await sql.connect(sqlServerConfig());
  try {
    const tablesRes = await pool.request().query<{ schema: string; name: string }>(`
      SELECT s.name AS [schema], t.name AS [name]
      FROM sys.tables t
      JOIN sys.schemas s ON s.schema_id = t.schema_id
      ORDER BY s.name, t.name
    `);

    const report: TableReport[] = [];

    for (const t of tablesRes.recordset) {
      const full = `[${t.schema}].[${t.name}]`;

      const columns = (
        await pool.request().input('table', t.name).input('schema', t.schema).query<{
          name: string;
          type: string;
          maxLength: number | null;
          nullable: number;
        }>(`
          SELECT c.COLUMN_NAME AS name, c.DATA_TYPE AS type,
                 c.CHARACTER_MAXIMUM_LENGTH AS maxLength,
                 CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS nullable
          FROM INFORMATION_SCHEMA.COLUMNS c
          WHERE c.TABLE_NAME = @table AND c.TABLE_SCHEMA = @schema
          ORDER BY c.ORDINAL_POSITION
        `)
      ).recordset.map((c) => ({ ...c, nullable: !!c.nullable }));

      const foreignKeys = (
        await pool.request().input('table', t.name).input('schema', t.schema).query<ForeignKeyInfo>(`
          SELECT fk.name AS name,
                 pc.name AS [column],
                 rt.name AS refTable,
                 rc.name AS refColumn
          FROM sys.foreign_keys fk
          JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
          JOIN sys.tables pt ON pt.object_id = fk.parent_object_id
          JOIN sys.schemas ps ON ps.schema_id = pt.schema_id
          JOIN sys.columns pc ON pc.object_id = pt.object_id AND pc.column_id = fkc.parent_column_id
          JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
          JOIN sys.columns rc ON rc.object_id = rt.object_id AND rc.column_id = fkc.referenced_column_id
          WHERE pt.name = @table AND ps.name = @schema
        `)
      ).recordset;

      let rowCount = 0;
      try {
        rowCount = (
          await pool.request().query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${full}`)
        ).recordset[0].n;
      } catch {
        rowCount = -1; // sem permissao ou view sem suporte
      }

      let sample: Record<string, unknown>[] = [];
      if (SAMPLE_ROWS > 0 && rowCount !== 0) {
        try {
          sample = (
            await pool.request().query(`SELECT TOP ${SAMPLE_ROWS} * FROM ${full}`)
          ).recordset as Record<string, unknown>[];
        } catch {
          sample = [];
        }
      }

      report.push({ schema: t.schema, table: t.name, rowCount, columns, foreignKeys, sample });
      // eslint-disable-next-line no-console
      console.log(`  ${full}: ${rowCount} linhas, ${columns.length} colunas, ${foreignKeys.length} FKs`);
    }

    const outDir = join(__dirname, 'output');
    mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outFile = join(outDir, `introspect-${stamp}.json`);
    writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8');

    // eslint-disable-next-line no-console
    console.log(`\nIntrospeccao concluida: ${report.length} tabelas -> ${outFile}`);
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Falha na introspeccao:', err);
  process.exit(1);
});
