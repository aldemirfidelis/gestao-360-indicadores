import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { Request, Response } from 'express';
import { routeModule } from '../http/request-route';

const SLOW_MS = Number(process.env.METRICS_SLOW_MS ?? 1000);
const VERBOSE = process.env.METRICS_VERBOSE === 'true';

/**
 * Métricas de produto via logs estruturados (item 20): tempo de resposta, rotas
 * lentas e 5xx por módulo. Sem I/O no banco (zero overhead por request) — agrega-se
 * depois pelos logs JSON (campos: method, path, statusCode, durationMs, module) + o
 * requestId/userId herdados do contexto do pino.
 *
 * - 5xx: sempre logado como erro (erros por módulo).
 * - lento (>= METRICS_SLOW_MS, default 1000ms): logado como warn (rotas lentas).
 * - demais: só com METRICS_VERBOSE=true (uso por rota), para não poluir o log.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(@InjectPinoLogger('HttpMetrics') private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();
    const path = req.path ?? req.originalUrl ?? '';
    const module = routeModule(path);

    const record = (status: number) => {
      const durationMs = Date.now() - startedAt;
      const fields = { method: req.method, path, statusCode: status, durationMs, module };
      if (status >= 500) this.logger.error(fields, 'request 5xx');
      else if (durationMs >= SLOW_MS) this.logger.warn(fields, 'slow request');
      else if (VERBOSE) this.logger.info(fields, 'request');
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
