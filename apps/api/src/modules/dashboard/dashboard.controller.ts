import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('dashboard')
@RequirePermissions('dashboard:view')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('overview')
  overview(@CurrentUser() me: AuthPayload) {
    return this.service.overview(me);
  }

  @Get('ranking')
  ranking(@CurrentUser() me: AuthPayload, @Query('limit') limit?: string) {
    return this.service.ranking(me, limit ? parseInt(limit, 10) : 10);
  }

  @Get('evolution')
  evolution(@CurrentUser() me: AuthPayload, @Query('months') months?: string) {
    return this.service.evolution(me, months ? parseInt(months, 10) : 12);
  }

  @Get('worst')
  worst(@CurrentUser() me: AuthPayload, @Query('limit') limit?: string) {
    return this.service.worst(me, limit ? parseInt(limit, 10) : 8);
  }

  @Get('pending')
  pending(@CurrentUser() me: AuthPayload) {
    return this.service.pendingFillCount(me);
  }
}
