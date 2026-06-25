import { Logger } from '@nestjs/common';

// Logger dedicado a falhas "engolidas" de propósito (fire-and-forget / fallbacks).
// Roteado pelo pino via app.useLogger → herda o contexto da request (requestId/userId).
const logger = new Logger('Swallowed');

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err === null || err === undefined) return String(err);
  try {
    return typeof err === 'string' ? err : JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Handler para `.catch()` de operações NÃO-críticas: registra o erro de forma
 * estruturada (deixa de ser silencioso) e devolve o fallback, preservando a
 * degradação graciosa. Só loga quando a falha realmente acontece — zero ruído
 * no caminho feliz.
 *
 * Uso: `await algo().catch(swallow(undefined, 'modulo.acao'))`
 */
export function swallow<T>(fallback: T, context: string, level: 'warn' | 'debug' = 'warn') {
  return (err: unknown): T => {
    logger[level](`falha nao-critica em ${context}: ${describe(err)}`);
    return fallback;
  };
}

/**
 * Versão para blocos `try/catch` (em vez de `.catch`): registra e segue.
 * Uso: `catch (err) { logSwallowed('modulo.acao', err); }`
 */
export function logSwallowed(context: string, err: unknown, level: 'warn' | 'debug' = 'warn'): void {
  logger[level](`falha nao-critica em ${context}: ${describe(err)}`);
}
