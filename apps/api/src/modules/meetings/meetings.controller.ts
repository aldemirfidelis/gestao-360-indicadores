import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { ActionPriority, MeetingKind } from '@prisma/client';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly service: MeetingsService) {}

  @Get()
  list(@CurrentUser() me: AuthPayload) {
    return this.service.list(me.companyId);
  }

  @Get(':id')
  byId(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  create(
    @CurrentUser() me: AuthPayload,
    @Body() body: { title: string; kind: MeetingKind; startsAt: string; endsAt?: string; location?: string; notes?: string },
  ) {
    return this.service.create(me.companyId, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/participants')
  addParticipant(@Param('id') id: string, @Body() body: { userId: string }) {
    return this.service.addParticipant(id, body.userId);
  }

  @Patch(':id/participants/:userId')
  attendance(@Param('id') id: string, @Param('userId') userId: string, @Body() body: { attended: boolean }) {
    return this.service.markAttendance(id, userId, body.attended);
  }

  @Post(':id/agenda')
  addAgenda(@Param('id') id: string, @Body() body: { topic: string; notes?: string }) {
    return this.service.addAgendaItem(id, body.topic, body.notes);
  }

  @Post(':id/decisions')
  addDecision(
    @Param('id') id: string,
    @Body() body: { decision: string; owner?: string; dueDate?: string },
  ) {
    return this.service.addDecision(id, body.decision, body.owner, body.dueDate);
  }

  @Post(':id/actions')
  generateAction(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { title: string; responsibleUserId?: string; dueDate?: string; priority?: ActionPriority },
  ) {
    return this.service.generateAction(id, me.sub, body);
  }
}
