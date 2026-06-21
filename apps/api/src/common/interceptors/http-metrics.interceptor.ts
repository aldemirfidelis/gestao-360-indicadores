import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { Request, Response } from 'express';

const SLOW_MS = Number(process.env.METRICS_SLOW_MS ?? 1000);
const VERBOSE = process.env.METRICS_VERBOSE === 'true';

/**
 * Métricas de produto via logs (item 20): tempo de resposta, rotas lentas e 5xx
 * por módulo. Sem I/O no banco (zero overhead por request) — agrega-se depois por
 * logs (journald/Caddy) ou um coletor simples.
 *
 * - 5xx: sempre logado como erro (erros por módulo).
 * - lento (>= METRICS_SLOW_MS, default 1000ms): logado como warn (rotas lentas).
 * - demais: só com METRICS_VERBOSE=true (uso por rota), para não poluir o log.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HttpMetrics');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();
    const path = req.path ?? req.originalUrl ?? '';
    const module = moduleOf(path);

    const record = (status: number) => {
      const ms = Date.now() - startedAt;
      const line = `${req.method} ${path} ${status} ${ms}ms [${module}]`;
      if (status >= 500) this.logger.error(line);
      else if (ms >= SLOW_MS) this.logger.warn(`SLOW ${line}`);
      else if (VERBOSE) this.logger.log(line);
    };

    return next.handle().pipe(
      tap(() => record(res.statusCode ?? 200)),
      catchError((error) => {
        record(Number(error?.status) || 500);
        return throwError(() => error);
      }),
    );
  }
}

function moduleOf(path: string): string {
  const parts = path.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  return parts[0] ?? 'root';
}
