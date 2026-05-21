import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });

  // PORT (padrao DigitalOcean/Heroku/Render) > API_PORT > 3333
  const port = parseInt(process.env.PORT ?? process.env.API_PORT ?? '3333', 10);
  const prefix = process.env.API_PREFIX ?? 'api';
  const corsOrigin = process.env.API_CORS_ORIGIN ?? 'http://localhost:3000';

  app.setGlobalPrefix(prefix);
  // Atras de proxy (DO App Platform / Render / Vercel)
  // permite req.ip resolver corretamente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app.getHttpAdapter().getInstance() as any).set?.('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((s) => s.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`[g360-api] listening on http://0.0.0.0:${port}/${prefix}`);
}

bootstrap();
