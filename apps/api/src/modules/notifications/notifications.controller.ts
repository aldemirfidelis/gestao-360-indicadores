import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(@CurrentUser() me: AuthPayload, @Query('unread') unread?: string) {
    return this.service.list(me.sub, unread === 'true');
  }

  @Get('count')
  count(@CurrentUser() me: AuthPayload) {
    return this.service.unreadCount(me.sub).then((unread) => ({ unread }));
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.service.markRead(id);
  }

  @Post('read-all')
  markAll(@CurrentUser() me: AuthPayload) {
    return this.service.markAllRead(me.sub);
  }

  @Post('generate')
  generate(@CurrentUser() me: AuthPayload) {
    return this.service.generateAlerts(me.companyId);
  }
}
