import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { PeriodsService } from './periods.service';

@Controller('periods')
@RequirePermissions('settings:manage')
export class PeriodsController {
  constructor(private readonly service: PeriodsService) {}

  @Get()
  list(@CurrentUser() me: AuthPayload) {
    return this.service.list(me);
  }

  @Post()
  create(@CurrentUser() me: AuthPayload, @Body() body: { year?: number }) {
    return this.service.create(me, Number(body.year));
  }

  @Patch(':id/current')
  setCurrent(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.setCurrent(me, id);
  }

  @Post(':id/close')
  close(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.close(me, id);
  }
}
