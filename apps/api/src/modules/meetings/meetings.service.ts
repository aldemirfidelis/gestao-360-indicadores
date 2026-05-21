import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionOrigin, ActionPriority, ActionStatus, MeetingKind } from '@prisma/client';

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string) {
    return this.prisma.meeting.findMany({
      where: { companyId, deletedAt: null },
      include: {
        _count: { select: { participants: true, agendaItems: true, decisions: true } },
      },
      orderBy: { startsAt: 'desc' },
    });
  }

  async getById(id: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, deletedAt: null },
      include: {
        participants: { include: { user: { select: { id: true, name: true, email: true } } } },
        agendaItems: { orderBy: { position: 'asc' } },
        decisions: true,
      },
    });
    if (!meeting) throw new NotFoundException('Reuniao nao encontrada');
    return meeting;
  }

  async create(
    companyId: string,
    body: {
      title: string;
      kind: MeetingKind;
      startsAt: string;
      endsAt?: string;
      location?: string;
      notes?: string;
    },
  ) {
    return this.prisma.meeting.create({
      data: {
        companyId,
        title: body.title,
        kind: body.kind,
        startsAt: new Date(body.startsAt),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        location: body.location ?? null,
        notes: body.notes ?? null,
      },
    });
  }

  async update(id: string, patch: any) {
    return this.prisma.meeting.update({ where: { id }, data: patch });
  }

  async remove(id: string) {
    return this.prisma.meeting.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async addParticipant(meetingId: string, userId: string) {
    return this.prisma.meetingParticipant.upsert({
      where: { meetingId_userId: { meetingId, userId } },
      create: { meetingId, userId },
      update: {},
    });
  }

  async markAttendance(meetingId: string, userId: string, attended: boolean) {
    return this.prisma.meetingParticipant.update({
      where: { meetingId_userId: { meetingId, userId } },
      data: { attended },
    });
  }

  async addAgendaItem(meetingId: string, topic: string, notes?: string) {
    const count = await this.prisma.meetingAgendaItem.count({ where: { meetingId } });
    return this.prisma.meetingAgendaItem.create({
      data: { meetingId, topic, notes: notes ?? null, position: count },
    });
  }

  async addDecision(meetingId: string, decision: string, owner?: string, dueDate?: string) {
    return this.prisma.meetingDecision.create({
      data: { meetingId, decision, owner: owner ?? null, dueDate: dueDate ? new Date(dueDate) : null },
    });
  }

  async generateAction(
    meetingId: string,
    createdById: string,
    body: { title: string; responsibleUserId?: string; dueDate?: string; priority?: ActionPriority },
  ) {
    const meeting = await this.getById(meetingId);
    return this.prisma.actionPlan.create({
      data: {
        companyId: meeting.companyId,
        title: body.title,
        description: `Acao gerada na reuniao "${meeting.title}"`,
        origin: ActionOrigin.MEETING,
        originRefId: meetingId,
        responsibleUserId: body.responsibleUserId ?? null,
        priority: body.priority ?? ActionPriority.MEDIUM,
        status: ActionStatus.NOT_STARTED,
        startDate: new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        createdById,
      },
    });
  }
}
