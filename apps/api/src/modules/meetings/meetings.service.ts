import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
import { AccessService } from '../access/access.service';
import type { AreaAction } from '../access/access.logic';
import { AuthPayload } from '../auth/auth.types';

/** Chave de módulo usada nas regras de visibilidade por área (AccessService). */
const MODULE = 'meetings';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
    private readonly access: AccessService,
  ) {}

  /**
   * A reunião não tem área própria: ela é derivada do indicador associado
   * (diretamente ou via desvio). Reuniões "gerais" (sem vínculo) não têm área e,
   * portanto, não são restringidas por área — apenas pela permissão e pela empresa.
   */
  private areaOf(m: {
    indicator?: { ownerNodeId: string | null } | null;
    deviation?: { indicator?: { ownerNodeId: string | null } | null } | null;
  }): string | null {
    return m.indicator?.ownerNodeId ?? m.deviation?.indicator?.ownerNodeId ?? null;
  }

  /** Carrega a reunião isolada por EMPRESA (defesa contra id de outra empresa) + área. */
  private async loadScoped(id: string, companyId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        indicator: { select: { ownerNodeId: true } },
        deviation: { select: { indicator: { select: { ownerNodeId: true } } } },
      },
    });
    if (!meeting) throw new NotFoundException('Reunião nao encontrada');
    return meeting;
  }

  /** Enforce de escrita por área (no-op para reuniões gerais sem área). */
  private async assertWriteArea(me: AuthPayload, area: string | null, action: AreaAction) {
    if (area) await this.access.assertCanWrite(me.sub, area, MODULE, action);
  }

  async list(me: AuthPayload) {
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    return this.prisma.meeting.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        // Restrição por área: reuniões gerais (sem indicador/desvio) sempre visíveis;
        // reuniões vinculadas só se a área do indicador estiver entre as permitidas.
        ...(permitted
          ? {
              OR: [
                { indicatorId: null, deviationId: null },
                { indicator: { ownerNodeId: { in: permitted } } },
                { deviation: { indicator: { ownerNodeId: { in: permitted } } } },
              ],
            }
          : {}),
      },
      include: {
        _count: { select: { participants: true, agendaItems: true, decisions: true } },
      },
      orderBy: { startsAt: 'desc' },
    });
  }

  async getById(me: AuthPayload, id: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: {
        indicator: { include: { ownerNode: true, responsibleUser: { select: { id: true, name: true, email: true, jobTitle: true } }, targets: true } },
        deviation: { include: { indicator: { select: { ownerNodeId: true } } } },
        analysis: true,
        treatment: { include: { result: true } },
        responsibleUser: { select: { id: true, name: true, email: true } },
        participants: { include: { user: { select: { id: true, name: true, email: true } } } },
        guests: true,
        agendaItems: { orderBy: { position: 'asc' } },
        decisions: true,
        actions: {
          include: {
            responsibleUser: { select: { id: true, name: true, email: true } },
            tasks: {
              orderBy: { position: 'asc' },
              include: { assignedTo: { select: { id: true, name: true, email: true } } },
            },
            analysisSessions: { orderBy: { updatedAt: 'desc' }, take: 5 },
          },
        },
        emailLogs: { orderBy: { createdAt: 'desc' } },
        calendarInvites: true,
      },
    });
    if (!meeting) throw new NotFoundException('Reunião nao encontrada');
    // Restrição por área (leitura): bloqueia acesso direto a reunião de área não permitida.
    const area = this.areaOf(meeting);
    if (area) {
      const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
      if (permitted && !permitted.includes(area)) {
        throw new ForbiddenException('Você não tem acesso às reuniões desta área.');
      }
    }
    return meeting;
  }

  async create(
    me: AuthPayload,
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
  ) {
    const companyId = me.companyId;
    const createdById = me.sub;
    // Vínculos precisam pertencer à MESMA empresa (nunca confiar em ids do frontend).
    let area: string | null = null;
    if (body.indicatorId) {
      const ind = await this.prisma.indicator.findFirst({
        where: { id: body.indicatorId, companyId, deletedAt: null },
        select: { ownerNodeId: true },
      });
      if (!ind) throw new NotFoundException('Indicador nao encontrado');
      area = ind.ownerNodeId;
    }
    if (body.deviationId) {
      const dev = await this.prisma.deviation.findFirst({
        where: { id: body.deviationId, companyId, deletedAt: null },
        include: { indicator: { select: { ownerNodeId: true } } },
      });
      if (!dev) throw new NotFoundException('Desvio nao encontrado');
      area = area ?? dev.indicator?.ownerNodeId ?? null;
    }
    // Só pode agendar reunião vinculada a uma área que o usuário possa atuar.
    await this.assertWriteArea(me, area, 'create');

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

  async update(me: AuthPayload, id: string, patch: any) {
    const meeting = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(meeting), 'edit');
    // Campos que mudam o vínculo/área não são reatribuídos aqui (segurança):
    // remoção via blocklist evita escalonamento de área por PATCH.
    const { companyId: _c, id: _i, indicatorId: _ind, deviationId: _d, ...safe } = patch ?? {};
    return this.prisma.meeting.update({ where: { id }, data: safe });
  }

  async remove(me: AuthPayload, id: string) {
    const meeting = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(meeting), 'delete');
    return this.prisma.meeting.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async addParticipant(
    me: AuthPayload,
    meetingId: string,
    userId: string,
    role: MeetingParticipantRole = MeetingParticipantRole.PARTICIPANT,
    notes?: string,
  ) {
    const meeting = await this.loadScoped(meetingId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(meeting), 'edit');
    const participant = await this.prisma.meetingParticipant.upsert({
      where: { meetingId_userId: { meetingId, userId } },
      create: { meetingId, userId, role, notes: notes ?? null },
      update: { role, notes: notes ?? null },
    });
    await this.traceability.record({
      companyId: me.companyId,
      userId: me.sub,
      eventType: TraceEventType.PARTICIPANT_ADDED,
      entityType: TraceEntityType.MEETING,
      entityId: meetingId,
      title: 'Participante adicionado a reunião',
      description: userId,
      metadata: { role },
    });
    return participant;
  }

  async markAttendance(me: AuthPayload, meetingId: string, userId: string, attended: boolean) {
    const meeting = await this.loadScoped(meetingId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(meeting), 'edit');
    return this.prisma.meetingParticipant.update({
      where: { meetingId_userId: { meetingId, userId } },
      data: { attended },
    });
  }

  async addAgendaItem(me: AuthPayload, meetingId: string, topic: string, notes?: string) {
    const meeting = await this.loadScoped(meetingId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(meeting), 'edit');
    const count = await this.prisma.meetingAgendaItem.count({ where: { meetingId } });
    return this.prisma.meetingAgendaItem.create({
      data: { meetingId, topic, notes: notes ?? null, position: count },
    });
  }

  async addGuest(
    me: AuthPayload,
    meetingId: string,
    body: { name: string; email: string; jobTitle?: string; area?: string; role?: MeetingParticipantRole; notes?: string },
  ) {
    if (!this.isEmail(body.email)) throw new NotFoundException('E-mail inválido');
    const meeting = await this.loadScoped(meetingId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(meeting), 'edit');
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
      userId: me.sub,
      eventType: TraceEventType.PARTICIPANT_ADDED,
      entityType: TraceEntityType.MEETING,
      entityId: meetingId,
      title: 'Convidado externo adicionado',
      description: `${guest.name} <${guest.email}>`,
      metadata: { role: guest.role, area: guest.area },
    });
    return guest;
  }

  async addDecision(me: AuthPayload, meetingId: string, decision: string, owner?: string, dueDate?: string) {
    const meeting = await this.loadScoped(meetingId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(meeting), 'edit');
    const item = await this.prisma.meetingDecision.create({
      data: { meetingId, decision, owner: owner ?? null, dueDate: dueDate ? new Date(dueDate) : null },
    });
    await this.traceability.record({
      companyId: me.companyId,
      userId: me.sub,
      eventType: TraceEventType.MEETING_DECISION,
      entityType: TraceEntityType.MEETING_DECISION,
      entityId: item.id,
      relatedType: TraceEntityType.MEETING,
      relatedId: meetingId,
      title: 'Decisão registrada em reunião',
      description: decision,
      metadata: { owner, dueDate },
    });
    return item;
  }

  async generateAction(
    me: AuthPayload,
    meetingId: string,
    body: {
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
    const meeting = await this.getById(me, meetingId);
    await this.assertWriteArea(me, this.areaOf(meeting), 'edit');
    const linkedAction =
      meeting.actions.find((action) => action.id === body.actionPlanId) ??
      (body.actionPlanId ? null : meeting.actions[0]);

    if (linkedAction) {
      const count = await this.prisma.actionTask.count({ where: { actionId: linkedAction.id } });
      const title = (body.description ?? body.title ?? '').trim();
      if (!title) throw new NotFoundException('DescriÃ§Ã£o da tarefa obrigatoria');
      const task = await this.prisma.actionTask.create({
        data: {
          actionId: linkedAction.id,
          title,
          startDate: body.startDate ? new Date(body.startDate) : null,
          endDate: body.endDate ? new Date(body.endDate) : body.dueDate ? new Date(body.dueDate) : null,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          assignedToId: body.responsibleUserId ?? null,
          position: count,
        },
        include: { assignedTo: { select: { id: true, name: true, email: true } } },
      });
      await this.traceability.record({
        companyId: meeting.companyId,
        indicatorId: meeting.indicatorId,
        userId: me.sub,
        eventType: TraceEventType.TASK_UPDATED,
        entityType: TraceEntityType.ACTION_TASK,
        entityId: task.id,
        relatedType: TraceEntityType.MEETING,
        relatedId: meetingId,
        title: 'Tarefa criada pela reuniÃ£o',
        description: task.title,
        metadata: { actionPlanId: linkedAction.id, startDate: task.startDate, endDate: task.endDate },
      });
      return { ...task, actionPlanId: linkedAction.id };
    }

    const action = await this.prisma.actionPlan.create({
      data: {
        companyId: meeting.companyId,
        indicatorId: meeting.indicatorId ?? null,
        deviationId: meeting.deviationId ?? null,
        analysisId: meeting.analysisId ?? null,
        meetingId,
        treatmentId: meeting.treatmentId ?? null,
        title: body.title || body.description || `AÃ§Ã£o da reuniÃ£o ${meeting.title}`,
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
        createdById: me.sub,
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
      userId: me.sub,
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

  async complete(me: AuthPayload, meetingId: string) {
    const meeting = await this.getById(me, meetingId);
    await this.assertWriteArea(me, this.areaOf(meeting), 'edit');
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
      userId: me.sub,
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

  async sendInvites(me: AuthPayload, meetingId: string) {
    const meeting = await this.getById(me, meetingId);
    await this.assertWriteArea(me, this.areaOf(meeting), 'edit');
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
      userId: me.sub,
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
        userId: me.sub,
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
