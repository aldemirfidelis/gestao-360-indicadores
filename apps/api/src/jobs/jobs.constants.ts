export const NOTIFICATIONS_QUEUE = 'notifications';
export const PRIZE_QUEUE = 'prize';
export const AUTOMATIONS_QUEUE = 'automations';

/**
 * Workers BullMQ ficam DESLIGADOS por padrão: o JobsModule só é importado pelo
 * AppModule quando WORKERS_ENABLED=true. Assim o boot não abre conexão Redis nem
 * muda o comportamento atual (geração de alertas continua sob demanda via
 * POST /notifications/generate até habilitar os workers em produção).
 */
export function workersEnabled(): boolean {
  return process.env.WORKERS_ENABLED === 'true';
}

export const redisConnection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
};

/** Retry exponencial + retenção de falhas (a "fila de falhas" do BullMQ é o dead-letter). */
export const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: 100,
  removeOnFail: 1_000,
};
