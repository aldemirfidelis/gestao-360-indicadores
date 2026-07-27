import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(@CurrentUser() me: AuthPayload, @Query('unread') unread?: string) {
    return this.service.list(me.companyId, me.sub, unread === 'true');
  }

  @Get('count')
  count(@CurrentUser() me: AuthPayload) {
    return this.service.unreadCount(me.companyId, me.sub).then((unread) => ({ unread }));
  }

  @Patch(':id/read')
  markRead(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.markRead(me.companyId, me.sub, id);
  }

  @Post('read-all')
  markAll(@CurrentUser() me: AuthPayload) {
    return this.service.markAllRead(me.companyId, me.sub);
  }

  @Post('generate')
  generate(@CurrentUser() me: AuthPayload) {
    return this.service.generateAlerts(me.companyId);
  }
}
