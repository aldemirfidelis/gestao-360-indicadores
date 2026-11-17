import { randomUUID } from 'crypto';
import type { Params } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'http';
import { PINO_REDACT_PATHS } from './redact';

const isProd = process.env.NODE_ENV === 'production';

/**
 * O Word instalado (WebDAV) e o editor online (WOPI) recebem o token de edição
 * na própria URL; ele nunca deve aparecer no log.
 */
export function redactUrlSecrets(url: string | undefined): string | undefined {
  if (!url) return url;
  return url.replace(/([?&](?:access_token|token|signature)=)[^&#]*/gi, '$1[redacted]');
}

/**
 * Configuração do logger estruturado (pino) para toda a API.
 *
 * - JSON em produção; pino-pretty em dev.
 * - Níveis: trace/debug/info/warn/error/fatal (via LOG_LEVEL).
 * - requestId: usa o header `x-request-id` recebido ou gera um UUID, e o devolve
 *   na resposta — correlação ponta a ponta.
 * - customProps: anexa userId/companyId ao log de conclusão da request.
 * - serializers enxutos: NUNCA serializam headers/cookies/body crus.
 * - redact: camada extra de mascaramento de chaves sensíveis.
 */
export const loggerParams: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
    genReqId: (req: IncomingMessage, res: ServerResponse) => {
      const header = req.headers['x-request-id'];
      const id = (Array.isArray(header) ? header[0] : header) || randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    customProps: (req: IncomingMessage) => {
      const user = (req as unknown as { user?: { sub?: string; companyId?: string } }).user;
      return user?.sub ? { userId: user.sub, companyId: user.companyId } : {};
    },
    autoLogging: {
      ignore: (req: IncomingMessage) => {
        const url = req.url ?? '';
        return url.includes('/health') || url.includes('/wopi') || url.includes('/public/site-events') || req.method === 'OPTIONS';
      },
    },
    redact: { paths: PINO_REDACT_PATHS, censor: '[redacted]' },
    serializers: {
      req(req: { id?: unknown; method?: string; url?: string; remoteAddress?: string }) {
        return { id: req.id, method: req.method, url: redactUrlSecrets(req.url), remoteAddress: req.remoteAddress };
      },
      res(res: { statusCode?: number }) {
        return { statusCode: res.statusCode };
      },
    },
    transport: isProd
      ? undefined
      : {
          // require.resolve dá o caminho absoluto — necessário no layout do pnpm,
          // onde o worker do pino não resolve "pino-pretty" pelo nome. Avaliado
          // apenas em dev (em prod o transport é undefined e o devDep não é exigido).
          target: require.resolve('pino-pretty'),
          options: { singleLine: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
  },
};
