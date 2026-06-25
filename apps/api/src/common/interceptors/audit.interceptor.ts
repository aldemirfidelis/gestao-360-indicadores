import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../../modules/auth/auth.types';
import { redactDeep } from '../logging/redact';
import { routeModule, routeEntity } from '../http/request-route';

const METHOD_ACTION: Record<string, string> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthPayload }>();
    const action = METHOD_ACTION[req.method];
    const startedAt = Date.now();
    // /api/wopi: chamadas do servidor Collabora (lock/save). Tem auditoria
    // propria (EDITOR_SAVE) e corpo binario que nao deve ser serializado aqui.
    if (
      !action ||
      req.path?.includes('/api/health') ||
      req.path?.includes('/api/auth/refresh') ||
      req.path?.includes('/api/wopi')
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((result) => {
        void this.write(req, action, 'SUCCESS', result, startedAt);
      }),
      catchError((error) => {
        void this.write(req, action, 'ERROR', { message: error?.message, status: error?.status }, startedAt);
        return throwError(() => error);
      }),
    );
  }

  private async write(
    req: Request & { user?: AuthPayload },
    action: string,
    result: 'SUCCESS' | 'ERROR',
    response: unknown,
    startedAt: number,
  ) {
    try {
      const path = req.path ?? req.originalUrl ?? '';
      const module = routeModule(path, 'system');
      const entity = routeEntity(path);
      const entityId = req.params?.id ?? req.params?.indicatorId ?? req.params?.resultId ?? null;
      const payload = {
        path,
        method: req.method,
        params: req.params,
        query: req.query,
        durationMs: Date.now() - startedAt,
      };
      await this.prisma.auditLog.create({
        data: {
          companyId: req.user?.companyId ?? null,
          userId: req.user?.sub ?? null,
          action,
          module,
          entity,
          entityId,
          payload: safeStringify(redactDeep(payload)),
          afterValue: result === 'ERROR' ? safeStringify(redactDeep(response)) : safeStringify(redactDeep(req.body)),
          result,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
    } catch {
      // Auditoria nunca deve quebrar a operação principal.
    }
  }
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}
