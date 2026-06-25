import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AuthPayload } from '../../modules/auth/auth.types';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(@InjectPinoLogger(HttpExceptionFilter.name) private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { user?: AuthPayload; id?: string }>();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as object);
    }

    // Contexto estruturado — correlaciona o erro a quem/onde aconteceu.
    const logContext = {
      requestId: req?.id,
      userId: req?.user?.sub,
      companyId: req?.user?.companyId,
      method: req?.method,
      path: req?.path,
      statusCode: status,
    };

    if (status >= 500) {
      // 5xx: erro real — loga detalhe + stack internamente; NUNCA expõe ao cliente
      // (pode vazar SQL, caminhos, segredos). Resposta genérica em produção.
      this.logger.error({ ...logContext, err: exception }, 'request failed');
      message =
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : exception instanceof Error
            ? exception.message
            : 'Internal server error';
    } else {
      // 4xx: rejeição esperada (validação/autz) — warn, sem stack.
      this.logger.warn(logContext, typeof message === 'string' ? message : 'request rejected');
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      ...(typeof message === 'string' ? { message } : message),
    });
  }
}
