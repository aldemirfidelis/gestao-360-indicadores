import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { Logger } from 'nestjs-pino';
import pino from 'pino';
import { AppModule } from './app.module';

// Logger "raiz" (independente do Nest) para eventos de processo e falha de boot,
// quando o container de DI ainda não existe ou já caiu.
const rootLogger = pino({ level: process.env.LOG_LEVEL ?? 'info', name: 'g360-api' });

process.on('uncaughtException', (err) => {
  rootLogger.fatal({ err }, 'uncaughtException — encerrando processo');
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  rootLogger.error({ err: reason }, 'unhandledRejection');
});

async function bootstrap() {
  // bufferLogs: segura os logs iniciais do Nest até o logger pino assumir.
  const app = await NestFactory.create(AppModule, { cors: false, bodyParser: false, bufferLogs: true });
  app.useLogger(app.get(Logger));
  const logger = app.get(Logger);

  // PORT (padrão DigitalOcean/Heroku/Render) > API_PORT > 3333
  const port = parseInt(process.env.PORT ?? process.env.API_PORT ?? '3333', 10);
  const prefix = process.env.API_PREFIX ?? 'api';
  const corsOrigin = process.env.API_CORS_ORIGIN ?? 'http://localhost:3000';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expressApp = app.getHttpAdapter().getInstance() as any;

  app.setGlobalPrefix(prefix);
  // Atras de proxy (DO App Platform / Render / Vercel)
  // permite req.ip resolver corretamente
  expressApp.set?.('trust proxy', 1);

  const bodyLimit = process.env.API_BODY_LIMIT ?? '10mb';
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ limit: bodyLimit, extended: true }));

  app.use(helmet({ crossOriginResourcePolicy: false }));
  // O middleware global de CORS responde OPTIONS com 204 antes dos controllers.
  // Para o Word local via WebDAV, OPTIONS precisa anunciar DAV/MS-Author-Via.
  expressApp.use?.(`/${prefix}/dav`, (req: any, res: any, next: any) => {
    if (String(req.method).toUpperCase() !== 'OPTIONS') {
      next();
      return;
    }
    res.setHeader('dav', '1,2');
    res.setHeader('ms-author-via', 'DAV');
    res.setHeader('allow', 'OPTIONS, GET, HEAD, PUT, PROPFIND, LOCK, UNLOCK');
    res.setHeader('accept-ranges', 'bytes');
    res.status(200).end();
  });
  // Seguranca CORS: nunca combinar origem coringa com credentials=true
  // (qualquer site poderia fazer requisicoes credenciadas). Quando a origem
  // for '*', refletimos qualquer origem porem SEM credenciais. Para origens
  // explicitas (recomendado em prod, ex.: https://gestao360.org), mantemos
  // credentials habilitado.
  const isWildcard = corsOrigin === '*';
  if (isWildcard && process.env.NODE_ENV === 'production') {
    logger.warn(
      'AVISO DE SEGURANCA: API_CORS_ORIGIN="*" em producao. Defina o dominio explicito (ex.: https://gestao360.org).',
    );
  }
  app.enableCors({
    origin: isWildcard ? true : corsOrigin.split(',').map((s) => s.trim()),
    credentials: !isWildcard,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  await app.listen(port, '0.0.0.0');
  logger.log(`g360-api listening on http://0.0.0.0:${port}/${prefix}`);
}

bootstrap().catch((err) => {
  rootLogger.fatal({ err }, 'bootstrap falhou — processo nao iniciou');
  process.exit(1);
});
