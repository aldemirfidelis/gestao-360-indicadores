import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
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

  @Get('areas')
  areas(@CurrentUser() me: AuthPayload) {
    return this.service.areas(me);
  }

  @Get('area-indicators')
  areaIndicators(
    @CurrentUser() me: AuthPayload,
    @Query('ownerNodeId') ownerNodeId?: string,
    @Query('types') types?: string,
  ) {
    // types: lista separada por vírgula (ex.: "STRATEGIC,OPERATIONAL"). Vazio = todos.
    const parsed = types ? types.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
    return this.service.areaIndicators(me, ownerNodeId, parsed);
  }

  @Get('area-conclusion')
  areaConclusion(@CurrentUser() me: AuthPayload, @Query('ownerNodeId') ownerNodeId?: string) {
    return this.service.areaConclusion(me, ownerNodeId);
  }

  @Patch('area-conclusion')
  saveAreaConclusion(
    @CurrentUser() me: AuthPayload,
    @Query('ownerNodeId') ownerNodeId: string | undefined,
    @Body() body: { conclusion?: string },
  ) {
    return this.service.saveAreaConclusion(me, ownerNodeId, body);
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
