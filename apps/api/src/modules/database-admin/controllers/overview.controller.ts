import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { SuperAdminDbGuard } from '../guards/super-admin-db.guard';
import { DbAdminSubmenuTag } from '../decorators/db-admin-submenu.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { OverviewService } from '../services/overview.service';

@Controller('admin/database')
@Roles(UserRoleEnum.SUPER_ADMIN)
@UseGuards(SuperAdminDbGuard)
@DbAdminSubmenuTag('overview')
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get('overview')
  getOverview() {
    return this.overview.getOverview();
  }
}
