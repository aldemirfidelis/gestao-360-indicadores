/**
 * Camada de adaptação de banco. PostgreSQL é o adapter real (banco atual = Neon).
 * SQLite é um stub documentado para evolução futura. A lógica de negócio dos
 * serviços NUNCA fala com um driver específico diretamente — sempre via esta interface.
 */

export interface RawQueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface WriteResult {
  rowsAffected: number;
  transactionId?: string | null;
}

export type SqlDialect = 'postgresql' | 'sqlite';

export interface RunOptions {
  /** Timeout do statement em ms. */
  timeoutMs?: number;
  /** Parâmetros de bind ($1, $2, ...). */
  params?: unknown[];
}

export interface DatabaseAdapter {
  readonly dialect: SqlDialect;

  /** Executa leitura garantidamente READ ONLY (transação read-only + statement_timeout). */
  runReadOnly(sql: string, options?: RunOptions): Promise<RawQueryResult>;

  /**
   * Executa escrita/DDL dentro de UMA transação. `work` recebe um executor
   * transacional; qualquer exceção causa ROLLBACK automático. Retorna o
   * resultado de `work` mais o id de transação para auditoria.
   */
  runInTransaction<T>(
    work: (tx: TransactionalExecutor) => Promise<T>,
    options?: { timeoutMs?: number },
  ): Promise<{ result: T; transactionId: string | null }>;

  /** Plano de execução (EXPLAIN) — read-only. */
  explain(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;

  /** Healthcheck simples. */
  ping(): Promise<{ ok: boolean; latencyMs: number; version: string }>;
}

/** Executor disponível dentro de uma transação (escrita e leitura). */
export interface TransactionalExecutor {
  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  execute(sql: string, params?: unknown[]): Promise<number>;
}
