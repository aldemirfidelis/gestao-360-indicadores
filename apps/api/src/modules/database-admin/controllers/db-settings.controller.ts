import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { SuperAdminDbGuard } from '../guards/super-admin-db.guard';
import { DbAdminSubmenuTag } from '../decorators/db-admin-submenu.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuthPayload } from '../../auth/auth.types';
import { DbAdminSettingsService } from '../services/db-admin-settings.service';

@Controller('admin/database/settings')
@Roles(UserRoleEnum.SUPER_ADMIN)
@UseGuards(SuperAdminDbGuard)
@DbAdminSubmenuTag('settings')
export class DbSettingsController {
  constructor(private readonly settings: DbAdminSettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Put()
  set(@Body() body: { key: string; value: string }, @CurrentUser() user: AuthPayload) {
    return this.settings.set(body?.key, body?.value ?? '', user);
  }
}
