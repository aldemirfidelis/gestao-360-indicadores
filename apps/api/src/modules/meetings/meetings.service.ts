import { Injectable, NotFoundException } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ActionOrigin,
  ActionPriority,
  ActionStatus,
  EmailDeliveryStatus,
  MeetingFormat,
  MeetingKind,
  MeetingParticipantRole,
  MeetingStatus,
  TraceEntityType,
  TraceEventType,
  TreatmentStatus,
} from '@prisma/client';
import { TraceabilityService } from '../traceability/traceability.service';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
  ) {}

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
        indicator: { include: { ownerNode: true, responsibleUser: { select: { id: true, name: true, email: true, jobTitle: true } }, targets: true } },
        deviation: true,
        analysis: true,
        treatment: { include: { result: true } },
        responsibleUser: { select: { id: true, name: true, email: true } },
        participants: { include: { user: { select: { id: true, name: true, email: true } } } },
        guests: true,
        agendaItems: { orderBy: { position: 'asc' } },
        decisions: true,
        actions: { include: { responsibleUser: { select: { id: true, name: true, email: true } }, tasks: true } },
        emailLogs: { orderBy: { createdAt: 'desc' } },
        calendarInvites: true,
      },
    });
    if (!meeting) throw new NotFoundException('Reunião nao encontrada');
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
      indicatorId?: string;
      deviationId?: string;
      analysisId?: string;
      treatmentId?: string;
      responsibleUserId?: string;
      format?: MeetingFormat;
      status?: MeetingStatus;
      objective?: string;
    },
    createdById?: string,
  ) {
    const meeting = await this.prisma.meeting.create({
      data: {
        companyId,
        indicatorId: body.indicatorId ?? null,
        deviationId: body.deviationId ?? null,
        analysisId: body.analysisId ?? null,
        treatmentId: body.treatmentId ?? null,
        responsibleUserId: body.responsibleUserId ?? createdById ?? null,
        title: body.title,
        kind: body.kind,
        format: body.format ?? MeetingFormat.ONLINE,
        status: body.status ?? MeetingStatus.SCHEDULED,
        startsAt: new Date(body.startsAt),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        location: body.location ?? null,
        objective: body.objective ?? null,
        notes: body.notes ?? null,
      },
    });
    await this.traceability.record({
      companyId,
      userId: createdById,
      eventType: TraceEventType.MEETING_CREATED,
      entityType: TraceEntityType.MEETING,
      entityId: meeting.id,
      title: 'Reunião criada',
      description: meeting.title,
      statusTo: meeting.startsAt > new Date() ? 'SCHEDULED' : 'DONE',
      metadata: { kind: meeting.kind, startsAt: meeting.startsAt, location: meeting.location },
    });
    return meeting;
  }

  async update(id: string, patch: any) {
    return this.prisma.meeting.update({ where: { id }, data: patch });
  }

  async remove(id: string) {
    return this.prisma.meeting.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async addParticipant(
    meetingId: string,
    userId: string,
    role: MeetingParticipantRole = MeetingParticipantRole.PARTICIPANT,
    notes?: string,
    actorId?: string,
  ) {
    const participant = await this.prisma.meetingParticipant.upsert({
      where: { meetingId_userId: { meetingId, userId } },
      create: { meetingId, userId, role, notes: notes ?? null },
      update: { role, notes: notes ?? null },
    });
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (meeting) {
      await this.traceability.record({
        companyId: meeting.companyId,
        indicatorId: meeting.indicatorId,
        userId: actorId,
        eventType: TraceEventType.PARTICIPANT_ADDED,
        entityType: TraceEntityType.MEETING,
        entityId: meetingId,
        title: 'Participante adicionado a reunião',
        description: userId,
        metadata: { role },
      });
    }
    return participant;
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

  async addGuest(
    meetingId: string,
    body: { name: string; email: string; jobTitle?: string; area?: string; role?: MeetingParticipantRole; notes?: string },
    actorId?: string,
  ) {
    if (!this.isEmail(body.email)) throw new NotFoundException('E-mail inválido');
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('Reunião nao encontrada');
    const guest = await this.prisma.meetingGuest.upsert({
      where: { meetingId_email: { meetingId, email: body.email.toLowerCase() } },
      create: {
        meetingId,
        name: body.name,
        email: body.email.toLowerCase(),
        jobTitle: body.jobTitle ?? null,
        area: body.area ?? null,
        role: body.role ?? MeetingParticipantRole.GUEST,
        notes: body.notes ?? null,
      },
      update: {
        name: body.name,
        jobTitle: body.jobTitle ?? null,
        area: body.area ?? null,
        role: body.role ?? MeetingParticipantRole.GUEST,
        notes: body.notes ?? null,
      },
    });
    await this.traceability.record({
      companyId: meeting.companyId,
      indicatorId: meeting.indicatorId,
      userId: actorId,
      eventType: TraceEventType.PARTICIPANT_ADDED,
      entityType: TraceEntityType.MEETING,
      entityId: meetingId,
      title: 'Convidado externo adicionado',
      description: `${guest.name} <${guest.email}>`,
      metadata: { role: guest.role, area: guest.area },
    });
    return guest;
  }

  async addDecision(meetingId: string, decision: string, owner?: string, dueDate?: string, userId?: string) {
    const item = await this.prisma.meetingDecision.create({
      data: { meetingId, decision, owner: owner ?? null, dueDate: dueDate ? new Date(dueDate) : null },
    });
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (meeting) {
      await this.traceability.record({
        companyId: meeting.companyId,
        userId,
        eventType: TraceEventType.MEETING_DECISION,
        entityType: TraceEntityType.MEETING_DECISION,
        entityId: item.id,
        relatedType: TraceEntityType.MEETING,
        relatedId: meetingId,
        title: 'Decisão registrada em reunião',
        description: decision,
        metadata: { owner, dueDate },
      });
    }
    return item;
  }

  async generateAction(
    meetingId: string,
    createdById: string,
    body: {
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
    const meeting = await this.getById(meetingId);
    const action = await this.prisma.actionPlan.create({
      data: {
        companyId: meeting.companyId,
        indicatorId: meeting.indicatorId ?? null,
        deviationId: meeting.deviationId ?? null,
        analysisId: meeting.analysisId ?? null,
        meetingId,
        treatmentId: meeting.treatmentId ?? null,
        title: body.title,
        description: body.description ?? `Ação gerada na reunião "${meeting.title}"`,
        origin: ActionOrigin.MEETING,
        originRefId: meetingId,
        responsibleUserId: body.responsibleUserId ?? null,
        responsibleEmail: body.responsibleEmail ?? null,
        priority: body.priority ?? ActionPriority.MEDIUM,
        status: ActionStatus.NOT_STARTED,
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        evidenceRequired: body.evidenceRequired ?? true,
        expectedResult: body.expectedResult ?? null,
        createdById,
      },
    });
    if (meeting.treatmentId) {
      await this.prisma.treatmentCase.update({
        where: { id: meeting.treatmentId },
        data: { status: TreatmentStatus.ACTION_PLAN_CREATED },
      });
    }
    await this.traceability.record({
      companyId: meeting.companyId,
      indicatorId: meeting.indicatorId,
      userId: createdById,
      eventType: TraceEventType.ACTION_CREATED,
      entityType: TraceEntityType.ACTION_PLAN,
      entityId: action.id,
      relatedType: TraceEntityType.MEETING,
      relatedId: meetingId,
      title: 'Plano de ação criado pela reunião',
      description: action.title,
      statusTo: action.status,
      metadata: { meetingTitle: meeting.title, dueDate: action.dueDate, priority: action.priority },
    });
    return action;
  }

  async complete(meetingId: string, actorId?: string) {
    const meeting = await this.getById(meetingId);
    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.COMPLETED },
    });
    if (meeting.treatmentId) {
      await this.prisma.treatmentCase.update({
        where: { id: meeting.treatmentId },
        data: { status: meeting.actions.length > 0 ? TreatmentStatus.ACTION_PLAN_CREATED : TreatmentStatus.MEETING_COMPLETED },
      });
    }
    await this.traceability.record({
      companyId: meeting.companyId,
      indicatorId: meeting.indicatorId,
      userId: actorId,
      eventType: TraceEventType.MEETING_COMPLETED,
      entityType: TraceEntityType.MEETING,
      entityId: meetingId,
      title: 'Reunião concluida',
      description: meeting.title,
      statusFrom: meeting.status,
      statusTo: updated.status,
      metadata: { treatmentId: meeting.treatmentId, actions: meeting.actions.length },
    });
    return updated;
  }

  async sendInvites(meetingId: string, actorId?: string) {
    const meeting = await this.getById(meetingId);
    const recipients = [
      ...meeting.participants.map((p) => ({ name: p.user.name, email: p.user.email })),
      ...meeting.guests.map((g) => ({ name: g.name, email: g.email })),
    ].filter((r) => this.isEmail(r.email));

    if (recipients.length === 0) {
      throw new NotFoundException('Nenhum participante com e-mail válido');
    }

    const ics = this.buildIcs(meeting, recipients);
    const uid = `${meeting.id}@gestao360`;
    await this.prisma.calendarInvite.upsert({
      where: { uid },
      create: { companyId: meeting.companyId, meetingId, uid, icsContent: ics },
      update: { icsContent: ics },
    });

    await this.traceability.record({
      companyId: meeting.companyId,
      indicatorId: meeting.indicatorId,
      userId: actorId,
      eventType: TraceEventType.CALENDAR_INVITE_CREATED,
      entityType: TraceEntityType.MEETING,
      entityId: meetingId,
      title: 'Convite de calendario gerado',
      description: meeting.title,
      metadata: { recipients: recipients.length },
    });

    const subject = `Convite de Reunião - Tratativa do Indicador ${meeting.indicator?.name ?? meeting.title}`;
    const body = this.buildEmailBody(meeting);
    const logs = [];
    for (const recipient of recipients) {
      const delivery = await this.deliverEmail(recipient.email, subject, body, ics);
      const log = await this.prisma.emailLog.create({
        data: {
          companyId: meeting.companyId,
          meetingId,
          recipientName: recipient.name,
          recipientEmail: recipient.email,
          subject,
          body,
          status: delivery.status,
          errorMessage: delivery.error ?? null,
          attempts: delivery.status === EmailDeliveryStatus.PENDING ? 0 : 1,
          sentAt: delivery.status === EmailDeliveryStatus.SENT ? new Date() : null,
        },
      });
      logs.push(log);
      await this.traceability.record({
        companyId: meeting.companyId,
        indicatorId: meeting.indicatorId,
        userId: actorId,
        eventType: delivery.status === EmailDeliveryStatus.SENT ? TraceEventType.EMAIL_INVITE_SENT : TraceEventType.EMAIL_INVITE_FAILED,
        entityType: TraceEntityType.MEETING,
        entityId: meetingId,
        title: delivery.status === EmailDeliveryStatus.SENT ? 'Convite enviado por e-mail' : 'Convite pendente/erro de envio',
        description: `${recipient.name} <${recipient.email}>`,
        metadata: { emailLogId: log.id, status: delivery.status, error: delivery.error },
      });
    }
    return { count: logs.length, logs };
  }

  private async deliverEmail(to: string, subject: string, body: string, ics: string) {
    const host = process.env.SMTP_HOST;
    const from = process.env.SMTP_FROM;
    if (!host || !from) {
      return { status: EmailDeliveryStatus.PENDING, error: 'SMTP_NOT_CONFIGURED' };
    }
    try {
      const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === 'true',
        auth: user && pass ? { user, pass } : undefined,
      });
      await transporter.sendMail({
        from,
        to,
        subject,
        text: body,
        html: body.replace(/\n/g, '<br />'),
        icalEvent: {
          method: 'REQUEST',
          filename: 'convite.ics',
          content: ics,
        },
      });
      return { status: EmailDeliveryStatus.SENT };
    } catch (error: any) {
      return { status: EmailDeliveryStatus.ERROR, error: error?.message ?? 'EMAIL_ERROR' };
    }
  }

  private buildEmailBody(meeting: any) {
    const indicator = meeting.indicator;
    const result = meeting.treatment?.result;
    const target = indicator?.targets?.find((item: any) => item.periodRef === meeting.treatment?.periodRef)?.target;
    const agenda = meeting.agendaItems.map((item: any) => `- ${item.topic}`).join('\n');
    return [
      `Olá.`,
      ``,
      `Você foi convidado para participar da reunião de tratativa do indicador ${indicator?.name ?? meeting.title}.`,
      ``,
      `Este indicador encontra-se fora da meta e será necessário analisar a causa, discutir os impactos e definir um plano de ação.`,
      ``,
      `Dados da reunião:`,
      `- Data: ${meeting.startsAt.toLocaleString('pt-BR')}`,
      `- Horario: ${meeting.endsAt ? `${meeting.startsAt.toLocaleTimeString('pt-BR')} ate ${meeting.endsAt.toLocaleTimeString('pt-BR')}` : meeting.startsAt.toLocaleTimeString('pt-BR')}`,
      `- Local/Link: ${meeting.location ?? '-'}`,
      `- Responsável: ${meeting.responsibleUser?.name ?? indicator?.responsibleUser?.name ?? '-'}`,
      ``,
      `Dados do indicador:`,
      `- Indicador: ${indicator?.name ?? '-'}`,
      `- Meta: ${target ?? '-'}`,
      `- Resultado atual: ${result?.value ?? '-'}`,
      `- Desvio: ${result?.deviationPct ?? '-'}`,
      `- Area responsável: ${indicator?.ownerNode?.name ?? '-'}`,
      ``,
      `Pauta:`,
      agenda || '- Discussão das ações necessarias',
      ``,
      `Acesse o sistema para acompanhar os detalhes e registrar as decisões.`,
    ].join('\n');
  }

  private buildIcs(meeting: any, recipients: Array<{ name: string; email: string }>) {
    const dtStart = this.icsDate(meeting.startsAt);
    const dtEnd = this.icsDate(meeting.endsAt ?? new Date(new Date(meeting.startsAt).getTime() + 60 * 60 * 1000));
    const description = this.escapeIcs(this.buildEmailBody(meeting));
    const attendees = recipients.map((r) => `ATTENDEE;CN=${this.escapeIcs(r.name)};ROLE=REQ-PARTICIPANT:mailto:${r.email}`).join('\r\n');
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Gestão 360//Indicadores//PT-BR',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${meeting.id}@gestao360`,
      `DTSTAMP:${this.icsDate(new Date())}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${this.escapeIcs(meeting.title)}`,
      `LOCATION:${this.escapeIcs(meeting.location ?? '')}`,
      `DESCRIPTION:${description}`,
      attendees,
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');
  }

  private icsDate(date: Date) {
    return new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  private escapeIcs(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  }

  private isEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}
