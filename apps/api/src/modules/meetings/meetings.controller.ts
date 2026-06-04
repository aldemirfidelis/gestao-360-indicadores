import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { ActionPriority, MeetingFormat, MeetingKind, MeetingParticipantRole, MeetingStatus } from '@prisma/client';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly service: MeetingsService) {}

  @Get()
  @RequirePermissions('meetings:view')
  list(@CurrentUser() me: AuthPayload) {
    return this.service.list(me);
  }

  @Get(':id')
  @RequirePermissions('meetings:view')
  byId(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getById(me, id);
  }

  @Post()
  @RequirePermissions('meetings:create')
  create(
    @CurrentUser() me: AuthPayload,
    @Body() body: {
      title: string;
      kind: MeetingKind;
      startsAt: string;
      endsAt?: string;
      location?: string;
      notes?: string;
      indicatorId?: string;
      deviationId?: string;
      analysisId?: string;
      treatmentId?: string;
      responsibleUserId?: string;
      format?: MeetingFormat;
      status?: MeetingStatus;
      objective?: string;
    },
  ) {
    return this.service.create(me, body);
  }

  @Patch(':id')
  @RequirePermissions('meetings:update')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.update(me, id, body);
  }

  @Delete(':id')
  @RequirePermissions('meetings:delete')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.remove(me, id);
  }

  @Post(':id/participants')
  @RequirePermissions('meetings:update')
  addParticipant(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { userId: string; role?: MeetingParticipantRole; notes?: string },
  ) {
    return this.service.addParticipant(me, id, body.userId, body.role, body.notes);
  }

  @Post(':id/guests')
  @RequirePermissions('meetings:update')
  addGuest(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { name: string; email: string; jobTitle?: string; area?: string; role?: MeetingParticipantRole; notes?: string },
  ) {
    return this.service.addGuest(me, id, body);
  }

  @Patch(':id/participants/:userId')
  @RequirePermissions('meetings:update')
  attendance(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: { attended: boolean },
  ) {
    return this.service.markAttendance(me, id, userId, body.attended);
  }

  @Post(':id/agenda')
  @RequirePermissions('meetings:update')
  addAgenda(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { topic: string; notes?: string }) {
    return this.service.addAgendaItem(me, id, body.topic, body.notes);
  }

  @Post(':id/decisions')
  @RequirePermissions('meetings:update')
  addDecision(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { decision: string; owner?: string; dueDate?: string },
  ) {
    return this.service.addDecision(me, id, body.decision, body.owner, body.dueDate);
  }

  @Post(':id/ai/minutes')
  @RequirePermissions('meetings:update')
  generateMinutes(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.generateMinutes(me, id);
  }

  @Post(':id/actions')
  @RequirePermissions('actions:create')
  generateAction(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: {
      title: string;
      actionPlanId?: string;
      responsibleUserId?: string;
      responsibleEmail?: string;
      dueDate?: string;
      startDate?: string;
      endDate?: string;
      priority?: ActionPriority;
      description?: string;
      expectedResult?: string;
      evidenceRequired?: boolean;
    },
  ) {
    return this.service.generateAction(me, id, body);
  }

  @Post(':id/invitations/send')
  @RequirePermissions('meetings:complete')
  sendInvites(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.sendInvites(me, id);
  }

  @Post(':id/complete')
  @RequirePermissions('meetings:complete')
  complete(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.complete(me, id);
  }
}
