import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { DatabaseAdapter, RawQueryResult, RunOptions, SqlDialect, TransactionalExecutor } from './database-adapter';
import { rowsToJsonSafe } from '../util/serialize';
import { DB_ADMIN_LIMITS } from '../database-admin.constants';

/**
 * Adapter PostgreSQL. Usa um PrismaClient DEDICADO apontando para DIRECT_URL
 * (conexão NÃO-pooled). Isso é essencial porque o pooler (pgBouncer da Neon)
 * em modo transaction não suporta de forma confiável DDL, SET de sessão e
 * transações interativas usadas aqui. Mantê-lo separado do PrismaService
 * principal também isola o blast radius do SQL administrativo.
 *
 * Resiliência: se o DIRECT_URL estiver desatualizado (ex.: após migrar o banco
 * para o Postgres gerenciado, com o DIRECT_URL ainda apontando para um host que
 * não existe mais), a conexão falha e a tela "Banco de Dados" fica vazia. Por
 * isso, se o $connect via DIRECT_URL falhar, reconectamos via DATABASE_URL.
 */
@Injectable()
export class PostgreSQLAdapter implements DatabaseAdapter, OnModuleInit, OnModuleDestroy {
  readonly dialect: SqlDialect = 'postgresql';
  private readonly logger = new Logger(PostgreSQLAdapter.name);
  private client: PrismaClient;

  constructor() {
    // DIRECT_URL (sem -pooler) > DATABASE_URL como fallback.
    const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
    this.client = new PrismaClient({
      log: ['error'],
      datasources: url ? { db: { url } } : undefined,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.$connect();
    } catch (err) {
      this.logger.error(`Falha ao conectar adapter administrativo via DIRECT_URL: ${(err as Error).message}`);
      // Fallback: DIRECT_URL pode apontar para um banco que não existe mais.
      // Reconecta via DATABASE_URL (usado pela aplicação principal), assim a tela
      // administrativa volta a funcionar sem depender do ajuste do DIRECT_URL.
      const fallbackUrl = process.env.DATABASE_URL;
      const directUrl = process.env.DIRECT_URL;
      if (fallbackUrl && fallbackUrl !== directUrl) {
        try {
          await this.client.$disconnect().catch(() => undefined);
          this.client = new PrismaClient({ log: ['error'], datasources: { db: { url: fallbackUrl } } });
          await this.client.$connect();
          this.logger.warn('Adapter administrativo reconectado via DATABASE_URL (fallback do DIRECT_URL).');
        } catch (fallbackErr) {
          this.logger.error(`Fallback via DATABASE_URL também falhou: ${(fallbackErr as Error).message}`);
        }
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }

  async runReadOnly(sql: string, options: RunOptions = {}): Promise<RawQueryResult> {
    const timeout = options.timeoutMs ?? DB_ADMIN_LIMITS.safeStatementTimeoutMs;
    const params = options.params ?? [];
    // Transação READ ONLY: mesmo que a classificação fosse burlada, o Postgres
    // recusa qualquer escrita. statement_timeout protege contra queries longas.
    const rows = await this.client.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${Math.max(1000, timeout)}`);
        return tx.$queryRawUnsafe<Record<string, unknown>[]>(sql, ...params);
      },
      { timeout: timeout + 5000, maxWait: 5000 },
    );
    const safe = rowsToJsonSafe(rows);
    return { rows: safe, rowCount: safe.length };
  }

  async runInTransaction<T>(
    work: (tx: TransactionalExecutor) => Promise<T>,
    options: { timeoutMs?: number } = {},
  ): Promise<{ result: T; transactionId: string | null }> {
    const timeout = options.timeoutMs ?? DB_ADMIN_LIMITS.advancedStatementTimeoutMs;
    let transactionId: string | null = null;
    const result = await this.client.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${Math.max(1000, timeout)}`);
        try {
          const txidRows = await tx.$queryRawUnsafe<{ txid: bigint }[]>('SELECT txid_current() AS txid');
          transactionId = txidRows?.[0]?.txid != null ? String(txidRows[0].txid) : null;
        } catch {
          /* txid é melhor-esforço */
        }
        const executor: TransactionalExecutor = {
          query: async (q, p = []) => rowsToJsonSafe(await tx.$queryRawUnsafe<Record<string, unknown>[]>(q, ...p)),
          execute: async (q, p = []) => tx.$executeRawUnsafe(q, ...p),
        };
        return work(executor);
      },
      { timeout: timeout + 10_000, maxWait: 8000 },
    );
    return { result, transactionId };
  }

  async explain(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
    const res = await this.runReadOnly(`EXPLAIN (FORMAT JSON) ${sql}`, { params });
    return res.rows;
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number; version: string }> {
    const started = Date.now();
    try {
      const rows = await this.client.$queryRawUnsafe<{ version: string }[]>('SELECT version() AS version');
      return { ok: true, latencyMs: Date.now() - started, version: rows?.[0]?.version ?? 'desconhecida' };
    } catch (err) {
      throw new ServiceUnavailableException(`Banco indisponível: ${(err as Error).message}`);
    }
  }

  /** Acesso de baixo nível para introspecção read-only (usa a conexão dedicada). */
  rawReadOnly(sql: string, params: unknown[] = []): Promise<RawQueryResult> {
    return this.runReadOnly(sql, { params });
  }
}
