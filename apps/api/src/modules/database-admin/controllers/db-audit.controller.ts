import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { SuperAdminDbGuard } from '../guards/super-admin-db.guard';
import { DbAdminSubmenuTag } from '../decorators/db-admin-submenu.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { DbAdminAuditService } from '../services/db-admin-audit.service';

@Controller('admin/database/audit')
@Roles(UserRoleEnum.SUPER_ADMIN)
@UseGuards(SuperAdminDbGuard)
@DbAdminSubmenuTag('audit')
export class DbAuditController {
  constructor(private readonly audit: DbAdminAuditService) {}

  @Get()
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
    @Query('submenu') submenu?: string,
    @Query('action') action?: string,
    @Query('result') result?: string,
    @Query('targetTable') targetTable?: string,
    @Query('q') q?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.audit.list({
      from, to, userId, submenu, action, result, targetTable, q,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }
}
