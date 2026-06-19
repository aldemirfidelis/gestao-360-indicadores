import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MeetingFormat } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { MonthlyResultsService } from './monthly-results.service';

@Controller('monthly-results')
export class MonthlyResultsController {
  constructor(private readonly service: MonthlyResultsService) {}

  @Get('options')
  @RequirePermissions('meetings:view', 'dashboard:view')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me);
  }

  @Get('dashboard')
  @RequirePermissions('meetings:view', 'dashboard:view')
  dashboard(
    @CurrentUser() me: AuthPayload,
    @Query('periodRef') periodRef?: string,
    @Query('areaIds') areaIds?: string,
  ) {
    return this.service.dashboard(me, { periodRef, areaIds });
  }

  @Post('meetings')
  @RequirePermissions('meetings:create')
  createMeeting(
    @CurrentUser() me: AuthPayload,
    @Body()
    body: {
      title: string;
      periodRef: string;
      cropSeason?: string;
      cycleName?: string;
      startsAt: string;
      endsAt?: string;
      location?: string;
      format?: MeetingFormat;
      responsibleUserId?: string;
      secretaryUserId?: string;
      followUpUserId?: string;
      monthlyStatus?: string;
      objective?: string;
      assumptions?: string;
      criticalRisks?: string;
      boardDirections?: string;
      generalNotes?: string;
      nextMonthlyAt?: string;
      nextWeeklyAt?: string;
      areaIds?: string[];
    },
  ) {
    return this.service.createMeeting(me, body);
  }

  @Get('meetings/:id')
  @RequirePermissions('meetings:view')
  meetingDetail(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.meetingDetail(me, id);
  }

  @Post('meetings/:id/decisions')
  @RequirePermissions('meetings:update')
  addDecision(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { decision: string; owner?: string; dueDate?: string; topic?: string },
  ) {
    return this.service.addDecision(me, id, body);
  }

  @Post('meetings/:id/ai/key-message')
  @RequirePermissions('meetings:update')
  generateKeyMessage(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.generateKeyMessage(me, id);
  }
}
