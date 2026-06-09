import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { PrizeOverviewService } from './prize-overview.service';
import { PrizeAuditService } from './prize-audit.service';

@Controller('prize')
export class PrizeController {
  constructor(
    private readonly overview: PrizeOverviewService,
    private readonly audit: PrizeAuditService,
  ) {}

  @Get('overview')
  @RequirePermissions('prize:view')
  getOverview(@CurrentUser() me: AuthPayload, @Query('programId') programId?: string) {
    return this.overview.overview(me.companyId, { programId });
  }

  @Get('audit')
  @RequirePermissions('prize:reports:view')
  getAudit(
    @CurrentUser() me: AuthPayload,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('competenceId') competenceId?: string,
  ) {
    return this.audit.list(me.companyId, { entityType, entityId, competenceId });
  }
}
