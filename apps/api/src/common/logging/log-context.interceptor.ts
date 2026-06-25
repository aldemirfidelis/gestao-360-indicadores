import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Observable } from 'rxjs';
import { AuthPayload } from '../../modules/auth/auth.types';

/**
 * Após os guards resolverem `req.user`, anexa userId/companyId ao contexto do logger
 * (AsyncLocalStorage do nestjs-pino), de modo que TODA linha de log emitida durante a
 * request carregue esse contexto — atende ao requisito de "contexto nos logs".
 */
@Injectable()
export class LogContextInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<{ user?: AuthPayload }>();
      const user = req?.user;
      if (user?.sub) {
        this.logger.assign({ userId: user.sub, companyId: user.companyId });
      }
    }
    return next.handle();
  }
}
