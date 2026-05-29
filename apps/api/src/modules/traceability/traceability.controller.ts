import { Controller, Get, Param, Query } from '@nestjs/common';
import { TraceEntityType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { TraceabilityService } from './traceability.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('traceability')
@RequirePermissions('indicators:history')
export class TraceabilityController {
  constructor(private readonly service: TraceabilityService) {}

  @Get()
  list(
    @CurrentUser() me: AuthPayload,
    @Query('indicatorId') indicatorId?: string,
    @Query('entityType') entityType?: TraceEntityType,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(me.companyId, {
      indicatorId,
      entityType,
      entityId,
      limit: limit ? parseInt(limit, 10) : 200,
    });
  }

  @Get('indicators/:id')
  indicatorTimeline(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.indicatorTimeline(me.companyId, id);
  }
}
