import { Module } from '@nestjs/common';
import { GeoIpService } from './geoip.service';
import { SiteEventsController } from './site-analytics.controller';
import { SiteAnalyticsScheduler } from './site-analytics.scheduler';
import { SiteAnalyticsService } from './site-analytics.service';

/**
 * Visitantes do site e da demonstração: coleta pública e rotinas. O painel fica no
 * Portal Admin Global (PlatformSiteAnalyticsController, no módulo do portal).
 */
@Module({
  controllers: [SiteEventsController],
  providers: [SiteAnalyticsService, GeoIpService, SiteAnalyticsScheduler],
  exports: [SiteAnalyticsService],
})
export class SiteAnalyticsModule {}
