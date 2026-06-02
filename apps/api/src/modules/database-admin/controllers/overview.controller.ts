import { Controller, Get, UseGuards } from '@nestjs/common';
import { SuperAdminDbGuard } from '../guards/super-admin-db.guard';
import { DbAdminSubmenuTag } from '../decorators/db-admin-submenu.decorator';
import { OverviewService } from '../services/overview.service';

@Controller('admin/database')
@UseGuards(SuperAdminDbGuard)
@DbAdminSubmenuTag('overview')
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get('overview')
  getOverview() {
    return this.overview.getOverview();
  }
}
