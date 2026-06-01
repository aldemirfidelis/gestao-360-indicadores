/**
 * Configuracao do ETL do app legado "Balanced Scorecard" (SQL Server).
 *
 * Todas as credenciais vem de variaveis de ambiente — NUNCA commitar segredos.
 * Conectar sempre a uma copia/backup restaurada em instancia isolada, com
 * usuario SOMENTE LEITURA (db_datareader). O ETL e unidirecional:
 * SQL Server (leitura) -> transformacao -> Postgres (gestao-360).
 */

import type { config as MssqlConfig } from 'mssql';

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  return v;
}

function bool(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return def;
  return v === '1' || v.toLowerCase() === 'true';
}

/** Conexao com o SQL Server do BSC legado (backup restaurado, read-only). */
export function sqlServerConfig(): MssqlConfig {
  return {
    server: req('BSC_SQL_SERVER'),
    port: Number(process.env.BSC_SQL_PORT ?? 1433),
    database: req('BSC_SQL_DATABASE'),
    user: req('BSC_SQL_USER'),
    password: req('BSC_SQL_PASSWORD'),
    options: {
      // Para instancia local de backup geralmente nao ha TLS configurado.
      encrypt: bool('BSC_SQL_ENCRYPT', false),
      trustServerCertificate: bool('BSC_SQL_TRUST_CERT', true),
      enableArithAbort: true,
    },
    requestTimeout: 120_000,
    pool: { max: 4, min: 0, idleTimeoutMillis: 30_000 },
  };
}

export interface EtlConfig {
  /** Company.id (Postgres) que recebera os dados migrados. */
  targetCompanyId: string;
  /** Rotulo da origem, gravado em externalSource / Indicator.source. */
  sourceLabel: string;
  /**
   * Se true (padrao), nada e gravado no Postgres — apenas valida e conta.
   * Defina BSC_DRY_RUN=false explicitamente para efetivar a carga.
   */
  dryRun: boolean;
  /**
   * Override do destino. Se definido, o PrismaClient da carga usa esta URL em
   * vez do DATABASE_URL da aplicacao. Permite mirar local -> Neon atual ->
   * branch/Neon novo trocando apenas uma variavel.
   * IMPORTANTE: no Neon, usar a conexao DIRETA (sem -pooler) para o ETL.
   */
  targetDatabaseUrl?: string;
}

export function etlConfig(): EtlConfig {
  return {
    targetCompanyId: req('BSC_TARGET_COMPANY_ID'),
    sourceLabel: process.env.BSC_SOURCE_LABEL ?? 'BSC 1.43',
    dryRun: bool('BSC_DRY_RUN', true),
    targetDatabaseUrl: process.env.BSC_TARGET_DATABASE_URL || undefined,
  };
}
