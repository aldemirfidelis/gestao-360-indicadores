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
    return this.service.list(me.companyId);
  }

  @Get(':id')
  @RequirePermissions('meetings:view')
  byId(@Param('id') id: string) {
    return this.service.getById(id);
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
    return this.service.create(me.companyId, body, me.sub);
  }

  @Patch(':id')
  @RequirePermissions('meetings:update')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @RequirePermissions('meetings:delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/participants')
  @RequirePermissions('meetings:update')
  addParticipant(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { userId: string; role?: MeetingParticipantRole; notes?: string },
  ) {
    return this.service.addParticipant(id, body.userId, body.role, body.notes, me.sub);
  }

  @Post(':id/guests')
  @RequirePermissions('meetings:update')
  addGuest(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { name: string; email: string; jobTitle?: string; area?: string; role?: MeetingParticipantRole; notes?: string },
  ) {
    return this.service.addGuest(id, body, me.sub);
  }

  @Patch(':id/participants/:userId')
  @RequirePermissions('meetings:update')
  attendance(@Param('id') id: string, @Param('userId') userId: string, @Body() body: { attended: boolean }) {
    return this.service.markAttendance(id, userId, body.attended);
  }

  @Post(':id/agenda')
  @RequirePermissions('meetings:update')
  addAgenda(@Param('id') id: string, @Body() body: { topic: string; notes?: string }) {
    return this.service.addAgendaItem(id, body.topic, body.notes);
  }

  @Post(':id/decisions')
  @RequirePermissions('meetings:update')
  addDecision(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { decision: string; owner?: string; dueDate?: string },
  ) {
    return this.service.addDecision(id, body.decision, body.owner, body.dueDate, me.sub);
  }

  @Post(':id/actions')
  @RequirePermissions('actions:create')
  generateAction(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: {
      title: string;
      responsibleUserId?: string;
      responsibleEmail?: string;
      dueDate?: string;
      startDate?: string;
      priority?: ActionPriority;
      description?: string;
      expectedResult?: string;
      evidenceRequired?: boolean;
    },
  ) {
    return this.service.generateAction(id, me.sub, body);
  }

  @Post(':id/invitations/send')
  @RequirePermissions('meetings:complete')
  sendInvites(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.sendInvites(id, me.sub);
  }

  @Post(':id/complete')
  @RequirePermissions('meetings:complete')
  complete(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.complete(id, me.sub);
  }
}
