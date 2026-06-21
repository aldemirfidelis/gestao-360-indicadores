import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { SuperAdminDbGuard } from '../guards/super-admin-db.guard';
import { DbAdminSubmenuTag } from '../decorators/db-admin-submenu.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { DiagnosticsService } from '../services/diagnostics.service';

@Controller('admin/database/diagnostics')
@Roles(UserRoleEnum.SUPER_ADMIN)
@UseGuards(SuperAdminDbGuard)
@DbAdminSubmenuTag('diagnostics')
export class DiagnosticsController {
  constructor(private readonly diagnostics: DiagnosticsService) {}

  @Get()
  get() {
    return this.diagnostics.run();
  }

  @Post('run')
  run() {
    return this.diagnostics.run();
  }
}
