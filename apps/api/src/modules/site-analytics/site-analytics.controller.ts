import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '../auth/public.decorator';
import { SiteEventsDto } from './site-analytics.dto';
import { SiteAnalyticsService } from './site-analytics.service';

/**
 * Coleta das visitas: as páginas públicas e a demonstração enviam os eventos em lote
 * (fetch keepalive / sendBeacon), sem token. Fica fora da auditoria e do log de requisições.
 */
@Controller('public/site-events')
export class SiteEventsController {
  constructor(private readonly analytics: SiteAnalyticsService) {}

  @Public()
  @Post()
  @HttpCode(204)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async collect(@Body() dto: SiteEventsDto, @Req() req: Request) {
    await this.analytics.ingest(dto, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }
}
