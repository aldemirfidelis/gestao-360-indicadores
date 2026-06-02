import { Injectable } from '@nestjs/common';
import { PostgreSQLAdapter } from '../adapters/postgresql.adapter';
import { SchemaInspectionService } from './schema-inspection.service';
import { quoteIdent } from '../util/identifier.util';

export interface DiagnosticFinding {
  id: string;
  level: 'info' | 'warning' | 'critical';
  category: string;
  title: string;
  table?: string;
  description: string;
  suggestion?: string;
  recommendedAction?: string;
}

export interface DiagnosticsReport {
  generatedAt: string;
  connection: { ok: boolean; latencyMs: number; version: string };
  schemaVersion: { migrations: number; lastMigration: string | null; appliedAt: string | null };
  summary: { critical: number; warning: number; info: number };
  findings: DiagnosticFinding[];
}

/**
 * Diagnósticos read-only. Apenas detecta e sugere — NUNCA corrige
 * automaticamente. Cada achado traz nível de risco e ação recomendada.
 */
@Injectable()
export class DiagnosticsService {
  constructor(
    private readonly pg: PostgreSQLAdapter,
    private readonly schema: SchemaInspectionService,
  ) {}

  async run(): Promise<DiagnosticsReport> {
    const findings: DiagnosticFinding[] = [];
    const allow = await this.schema.getAllowlist();

    let connection = { ok: false, latencyMs: 0, version: 'desconhecida' };
    try {
      const ping = await this.pg.ping();
      connection = { ok: ping.ok, latencyMs: ping.latencyMs, version: ping.version };
    } catch (err) {
      findings.push({
        id: 'connection',
        level: 'critical',
        category: 'Conexão',
        title: 'Falha de conexão',
        description: (err as Error).message,
        recommendedAction: 'Verificar disponibilidade do banco e variáveis DIRECT_URL/DATABASE_URL.',
      });
    }

    const tables = await this.schema.listTables();
    const relationships = await this.schema.getRelationships();
    const indexes = await this.schema.getIndexes();

    // 1) Tabelas de negócio sem PK
    for (const t of tables.filter((t) => t.kind === 'business' && t.primaryKey.length === 0)) {
      findings.push({
        id: `no-pk-${t.name}`,
        level: 'warning',
        category: 'Integridade',
        title: 'Tabela sem chave primária',
        table: t.name,
        description: `A tabela ${t.name} não possui chave primária.`,
        suggestion: 'Definir uma chave primária para garantir identificação única de registros.',
        recommendedAction: 'Estrutura > adicionar PK',
      });
    }

    // 2) Tabelas vazias (estimativa; confirma com COUNT nas candidatas)
    for (const t of tables.filter((t) => t.estimatedRows <= 0)) {
      try {
        const r = await this.pg.runReadOnly(`SELECT count(*)::int AS n FROM ${quoteIdent(t.name, 'tabela')}`);
        if (Number(r.rows[0]?.n ?? 0) === 0) {
          findings.push({
            id: `empty-${t.name}`,
            level: 'info',
            category: 'Uso',
            title: 'Tabela vazia',
            table: t.name,
            description: `A tabela ${t.name} não possui registros.`,
            suggestion: 'Avaliar se a tabela ainda é necessária.',
          });
        }
      } catch {
        /* ignora tabela que não pôde ser contada */
      }
    }

    // 3) Índices duplicados (mesma tabela + mesmo conjunto de colunas)
    const seen = new Map<string, string>();
    for (const idx of indexes) {
      const key = `${idx.table}::${[...idx.columns].sort().join(',')}`;
      if (idx.columns.length === 0) continue;
      if (seen.has(key)) {
        findings.push({
          id: `dup-index-${idx.name}`,
          level: 'warning',
          category: 'Índices',
          title: 'Índice possivelmente duplicado',
          table: idx.table,
          description: `Índice ${idx.name} cobre as mesmas colunas de ${seen.get(key)}.`,
          suggestion: 'Avaliar remoção do índice redundante para reduzir custo de escrita.',
          recommendedAction: 'Índices > remover',
        });
      } else {
        seen.set(key, idx.name);
      }
    }

    // 4) Colunas de FK sem índice (sugestão de índice ausente)
    const indexedFirstCols = new Set(indexes.map((i) => `${i.table}::${i.columns[0]}`));
    for (const rel of relationships) {
      if (rel.sourceColumns.length !== 1) continue;
      const key = `${rel.sourceTable}::${rel.sourceColumns[0]}`;
      if (!indexedFirstCols.has(key)) {
        findings.push({
          id: `missing-fk-index-${rel.name}`,
          level: 'info',
          category: 'Índices',
          title: 'FK sem índice',
          table: rel.sourceTable,
          description: `A coluna ${rel.sourceColumns[0]} de ${rel.sourceTable} é FK e não tem índice.`,
          suggestion: `Criar índice em ${rel.sourceTable}(${rel.sourceColumns[0]}) pode acelerar joins/filtros.`,
          recommendedAction: 'Índices > criar',
        });
      }
    }

    // 5) Registros órfãos (FKs de coluna única; consulta limitada)
    for (const rel of relationships) {
      if (rel.sourceColumns.length !== 1 || rel.targetColumns.length !== 1) continue;
      if (!allow.has(rel.sourceTable) || !allow.has(rel.targetTable)) continue;
      try {
        const src = quoteIdent(rel.sourceTable, 'tabela');
        const tgt = quoteIdent(rel.targetTable, 'tabela');
        const sc = quoteIdent(rel.sourceColumns[0], 'coluna');
        const tc = quoteIdent(rel.targetColumns[0], 'coluna');
        const r = await this.pg.runReadOnly(
          `SELECT count(*)::int AS n FROM ${src} s
            WHERE s.${sc} IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM ${tgt} t WHERE t.${tc} = s.${sc})`,
        );
        const orphans = Number(r.rows[0]?.n ?? 0);
        if (orphans > 0) {
          findings.push({
            id: `orphan-${rel.name}`,
            level: 'critical',
            category: 'Integridade',
            title: 'Registros órfãos (FK quebrada)',
            table: rel.sourceTable,
            description: `${orphans} registro(s) em ${rel.sourceTable}.${rel.sourceColumns[0]} sem correspondência em ${rel.targetTable}.`,
            suggestion: 'Corrigir/limpar os registros órfãos manualmente após análise.',
            recommendedAction: 'Analisar antes de qualquer correção',
          });
        }
      } catch {
        /* ignora relacionamento não verificável */
      }
    }

    let schemaVersion = { migrations: 0, lastMigration: null as string | null, appliedAt: null as string | null };
    try {
      const r = await this.pg.runReadOnly(
        `SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at DESC NULLS LAST LIMIT 1`,
      );
      const total = await this.pg.runReadOnly(`SELECT count(*)::int AS n FROM "_prisma_migrations"`);
      schemaVersion = {
        migrations: Number(total.rows[0]?.n ?? 0),
        lastMigration: r.rows[0]?.migration_name ? String(r.rows[0].migration_name) : null,
        appliedAt: r.rows[0]?.finished_at ? String(r.rows[0].finished_at) : null,
      };
    } catch {
      /* sem tabela de migrations */
    }

    const summary = {
      critical: findings.filter((f) => f.level === 'critical').length,
      warning: findings.filter((f) => f.level === 'warning').length,
      info: findings.filter((f) => f.level === 'info').length,
    };

    return { generatedAt: new Date().toISOString(), connection, schemaVersion, summary, findings };
  }
}
