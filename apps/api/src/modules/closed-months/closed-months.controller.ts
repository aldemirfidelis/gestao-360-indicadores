import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { ClosedMonthsService } from './closed-months.service';

@Controller('closed-months')
export class ClosedMonthsController {
  constructor(private readonly service: ClosedMonthsService) {}

  @Get()
  @RequirePermissions('settings:view')
  list(@CurrentUser() me: AuthPayload) {
    return this.service.list(me.companyId);
  }

  @Post()
  @RequirePermissions('settings:manage')
  close(@CurrentUser() me: AuthPayload, @Body() body: { periodRef: string; reason?: string | null }) {
    return this.service.close(me, body?.periodRef, body?.reason ?? null);
  }

  @Delete(':id')
  @RequirePermissions('settings:manage')
  reopen(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.reopen(me, id);
  }
}
