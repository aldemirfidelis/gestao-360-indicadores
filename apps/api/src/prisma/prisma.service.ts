import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'error' | 'warn' | 'query'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger('Prisma');

  constructor() {
    const isDev = process.env.NODE_ENV === 'development';
    super({
      // Eventos (em vez de stdout) → roteados pelo logger estruturado (pino) abaixo.
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
        ...(isDev ? [{ emit: 'event', level: 'query' } as const] : []),
      ],
    });

    this.$on('error', (e) => this.logger.error(`query error: ${e.message}`, e.target));
    this.$on('warn', (e) => this.logger.warn(`${e.message} (${e.target})`));
    // Em dev, registra a query (sem params, para não vazar dados) e a duração.
    if (isDev) {
      this.$on('query', (e) => this.logger.debug(`${e.query} — ${e.duration}ms`));
    }
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
