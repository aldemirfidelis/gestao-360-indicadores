import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { SuperAdminDbGuard } from '../guards/super-admin-db.guard';
import { DbAdminSubmenuTag } from '../decorators/db-admin-submenu.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthPayload } from '../../auth/auth.types';
import { DbAdminSettingsService } from '../services/db-admin-settings.service';

@Controller('admin/database/settings')
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
