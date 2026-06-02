import { NotImplementedException } from '@nestjs/common';
import { DatabaseAdapter, RawQueryResult, RunOptions, SqlDialect, TransactionalExecutor } from './database-adapter';

/**
 * Stub de adapter SQLite — preparação para evolução futura.
 *
 * O sistema atual roda em PostgreSQL (Neon). Este stub existe para documentar a
 * camada de adaptação e o ponto de extensão. Quando/se um deploy SQLite existir,
 * implementar introspecção via `sqlite_master`/`PRAGMA`, transações e a
 * reconstrução de tabela (create temp → copy → swap) descrita no plano.
 */
export class SqliteAdapter implements DatabaseAdapter {
  readonly dialect: SqlDialect = 'sqlite';

  private fail(): never {
    throw new NotImplementedException(
      'Adapter SQLite ainda não implementado. O banco atual é PostgreSQL.',
    );
  }

  runReadOnly(_sql: string, _options?: RunOptions): Promise<RawQueryResult> {
    return this.fail();
  }

  runInTransaction<T>(
    _work: (tx: TransactionalExecutor) => Promise<T>,
  ): Promise<{ result: T; transactionId: string | null }> {
    return this.fail();
  }

  explain(): Promise<Record<string, unknown>[]> {
    return this.fail();
  }

  ping(): Promise<{ ok: boolean; latencyMs: number; version: string }> {
    return this.fail();
  }
}
