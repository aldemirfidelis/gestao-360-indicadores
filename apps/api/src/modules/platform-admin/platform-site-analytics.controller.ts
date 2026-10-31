import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { SitePeriodQuery, SiteVisitsQuery } from '../site-analytics/site-analytics.dto';
import { SiteAnalyticsService } from '../site-analytics/site-analytics.service';
import { PlatformAdminRequired } from './decorators/platform-permissions.decorator';

/** Visitantes do site e da demonstração. Tem IP e localização: só Platform Owner e Super Admin veem. */
@Public()
@Controller('platform-admin/site-analytics')
export class PlatformSiteAnalyticsController {
  constructor(private readonly analytics: SiteAnalyticsService) {}

  @Get('overview')
  @PlatformAdminRequired('platform.site_analytics.view')
  overview(@Query() q: SitePeriodQuery) {
    return this.analytics.overview(q);
  }

  @Get('visits')
  @PlatformAdminRequired('platform.site_analytics.view')
  visits(@Query() q: SiteVisitsQuery) {
    return this.analytics.visits(q);
  }

  @Get('visits/:id')
  @PlatformAdminRequired('platform.site_analytics.view')
  visit(@Param('id', ParseUUIDPipe) id: string) {
    return this.analytics.visit(id);
  }
}
