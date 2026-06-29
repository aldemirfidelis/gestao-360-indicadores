import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveSmtpConfig, buildTransport, smtpFrom } from '../../common/smtp';
import { swallow } from '../../common/logging/swallow';
import {
  ActionAnalysisTool,
  ActionOrigin,
  ActionPriority,
  ActionStatus,
  DeviationStatus,
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
import { GeminiService } from '../ai/gemini.service';

/** Chave de módulo usada nas regras de visibilidade por área (AccessService). */
const MODULE = 'meetings';

type MeetingMinutesActionItem = {
  description: string;
  owner: string | null;
  dueDate: string | null;
  priority: string | null;
  source: string;
};

export type MeetingMinutesDraft = {
  provider: 'gemini' | 'deterministic';
  generatedAt: string;
  summary: string;
  minutes: string;
  decisions: string[];
  actionItems: MeetingMinutesActionItem[];
  risks: string[];
  nextSteps: string[];
  markdown: string;
};

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
    private readonly access: AccessService,
    private readonly gemini: GeminiService,
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

  /**
   * Garante um Plano de Ação para a reunião (idempotente). Se a reunião já tem um plano vinculado,
   * retorna-o; senão cria um novo a partir do contexto (desvio/indicador) — é o "plano do zero" que
   * nasce da análise feita na reunião (ex.: 1ª tarefa do 5W2H).
   */
  async ensureActionPlan(me: AuthPayload, meetingId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, companyId: me.companyId, deletedAt: null },
      include: {
        indicator: { select: { id: true, name: true, ownerNodeId: true, responsibleUserId: true } },
        deviation: { select: { id: true, number: true, title: true, fact: true, rootCause: true, impact: true, responsibleUserId: true, dueDate: true } },
        actions: { select: { id: true }, take: 1, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!meeting) throw new NotFoundException('Reunião nao encontrada');
    const area = meeting.indicator?.ownerNodeId ?? null;
    await this.assertWriteArea(me, area, 'edit');

    if (meeting.actions.length > 0) {
      return { id: meeting.actions[0].id, created: false };
    }

    const dev = meeting.deviation;
    const ind = meeting.indicator;
    const title = dev ? `Plano do desvio #${dev.number} — ${ind?.name ?? dev.title}` : `Plano de ação — ${ind?.name ?? meeting.title}`;
    const action = await this.prisma.actionPlan.create({
      data: {
        companyId: meeting.companyId,
        meetingId: meeting.id,
        deviationId: dev?.id ?? null,
        indicatorId: ind?.id ?? null,
        origin: dev ? ActionOrigin.DEVIATION : ActionOrigin.MEETING,
        originRefId: dev?.id ?? meeting.id,
        title,
        problemDescription: dev?.fact ?? dev?.title ?? meeting.objective ?? null,
        rootCause: dev?.rootCause ?? null,
        analysisTool: ActionAnalysisTool.ISHIKAWA,
        responsibleUserId: meeting.responsibleUserId ?? ind?.responsibleUserId ?? null,
        ownerNodeId: area,
        priority: ActionPriority.HIGH,
        criticality: ActionPriority.HIGH,
        status: ActionStatus.NOT_STARTED,
        dueDate: dev?.dueDate ?? null,
        expectedResult: dev?.impact ?? null,
        evidenceRequired: true,
        createdById: me.sub,
      },
    });
    if (dev) {
      await this.prisma.deviation
        .update({ where: { id: dev.id }, data: { status: DeviationStatus.WAITING_ACTION } })
        .catch(swallow(undefined, `meetings.setDeviationWaitingAction(deviationId=${dev.id})`));
    }
    await this.traceability.record({
      companyId: meeting.companyId,
      indicatorId: ind?.id ?? null,
      userId: me.sub,
      eventType: TraceEventType.ACTION_CREATED,
      entityType: TraceEntityType.ACTION_PLAN,
      entityId: action.id,
      relatedType: TraceEntityType.MEETING,
      relatedId: meeting.id,
      title: 'Plano de ação criado a partir da reunião',
      description: action.title,
    });
    return { id: action.id, created: true };
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

  async generateMinutes(me: AuthPayload, meetingId: string): Promise<MeetingMinutesDraft> {
    const meeting = await this.getById(me, meetingId);
    await this.assertWriteArea(me, this.areaOf(meeting), 'edit');

    const fallback = this.buildDeterministicMinutes(meeting);
    if (!this.gemini.isEnabled) return fallback;

    const aiDraft = await this.gemini.generateJson<Partial<MeetingMinutesDraft>>(
      this.buildMinutesPrompt(meeting),
      { temperature: 0.2, maxOutputTokens: 1800 },
    );
    const normalized = this.normalizeMinutesDraft(aiDraft, fallback);
    if (!normalized) return fallback;
    return {
      ...normalized,
      markdown: this.renderMinutesMarkdown(meeting, normalized),
    };
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
      if (!title) throw new NotFoundException('Descrição da tarefa obrigatoria');
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
        title: 'Tarefa criada pela reunião',
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
        title: body.title || body.description || `Ação da reunião ${meeting.title}`,
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
    // Ao concluir a reuniao, as analises (5 Porques/Ishikawa/PDCA) ja foram sincronizadas
    // ao plano via /actions/:id/analysis. Aqui iniciamos a execucao dos planos vinculados
    // que ainda nao sairam das fases de definicao/analise.
    await this.prisma.actionPlan.updateMany({
      where: {
        meetingId,
        deletedAt: null,
        status: { in: [ActionStatus.DRAFT, ActionStatus.NOT_STARTED, ActionStatus.UNDER_ANALYSIS] },
      },
      data: { status: ActionStatus.IN_PROGRESS },
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
    // Configuração resolvida do Portal Global (banco) com fallback para SMTP_* do ambiente.
    const cfg = await resolveSmtpConfig(this.prisma);
    const from = cfg ? smtpFrom(cfg) : undefined;
    if (!cfg?.host || !from) {
      return { status: EmailDeliveryStatus.PENDING, error: 'SMTP_NOT_CONFIGURED' };
    }
    try {
      const transporter = buildTransport(cfg);
      await transporter.sendMail({
        from,
        to,
        replyTo: cfg.replyTo,
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

  private buildMinutesPrompt(meeting: any) {
    const context = this.minutesContext(meeting);
    return `Voce e um secretario executivo especializado em reunioes de gestao, indicadores e planos de acao.
Gere uma minuta de ata profissional, objetiva e revisavel em portugues do Brasil.
Nao invente fatos. Quando uma informacao nao existir no contexto, marque como "Pendente".
Priorize decisoes, responsaveis, prazos, riscos e proximos passos.

Responda no schema JSON:
{
  "summary": "Resumo executivo em ate 4 linhas",
  "minutes": "Minuta textual da ata em Markdown curto",
  "decisions": ["decisao 1"],
  "actionItems": [
    { "description": "acao", "owner": "responsavel ou null", "dueDate": "YYYY-MM-DD ou null", "priority": "LOW|MEDIUM|HIGH|CRITICAL ou null", "source": "agenda|decisao|plano|ia" }
  ],
  "risks": ["risco ou pendencia"],
  "nextSteps": ["proximo passo"]
}

CONTEXTO:
${JSON.stringify(context, null, 2)}`;
  }

  private minutesContext(meeting: any) {
    return {
      meeting: {
        title: meeting.title,
        kind: meeting.kind,
        status: meeting.status,
        objective: meeting.objective,
        notes: meeting.notes,
        startsAt: meeting.startsAt,
        endsAt: meeting.endsAt,
        location: meeting.location,
      },
      indicator: meeting.indicator
        ? {
            code: meeting.indicator.code,
            name: meeting.indicator.name,
            area: meeting.indicator.ownerNode?.name,
            responsible: meeting.indicator.responsibleUser?.name,
          }
        : null,
      deviation: meeting.deviation
        ? {
            number: meeting.deviation.number,
            title: meeting.deviation.title,
            status: meeting.deviation.status,
            severity: meeting.deviation.severity,
          }
        : null,
      treatment: meeting.treatment
        ? {
            periodRef: meeting.treatment.periodRef,
            status: meeting.treatment.status,
            result: meeting.treatment.result
              ? {
                  value: meeting.treatment.result.value,
                  deviationPct: meeting.treatment.result.deviationPct,
                  light: meeting.treatment.result.light,
                }
              : null,
          }
        : null,
      analysis: meeting.analysis
        ? {
            method: meeting.analysis.method,
            content: meeting.analysis.content,
          }
        : null,
      agenda: (meeting.agendaItems ?? []).map((item: any) => ({ topic: item.topic, notes: item.notes })),
      decisions: (meeting.decisions ?? []).map((item: any) => ({
        decision: item.decision,
        owner: item.owner,
        dueDate: item.dueDate,
      })),
      participants: (meeting.participants ?? []).map((item: any) => ({
        name: item.user?.name,
        role: item.role,
        attended: item.attended,
      })),
      guests: (meeting.guests ?? []).map((item: any) => ({
        name: item.name,
        role: item.role,
        confirmed: item.confirmed,
      })),
      actions: (meeting.actions ?? []).map((action: any) => ({
        title: action.title,
        status: action.status,
        priority: action.priority,
        progress: action.progress,
        rootCause: action.rootCause ?? action.analysisSessions?.[0]?.rootCause ?? null,
        tasks: (action.tasks ?? []).map((task: any) => ({
          title: task.title,
          done: task.done,
          owner: task.assignedTo?.name,
          dueDate: task.dueDate ?? task.endDate,
        })),
      })),
    };
  }

  private buildDeterministicMinutes(meeting: any): MeetingMinutesDraft {
    const decisions = (meeting.decisions ?? []).map((item: any) => this.asText(item.decision)).filter(Boolean);
    const decisionActions = (meeting.decisions ?? []).map((item: any) => ({
      description: this.asText(item.decision) || 'Decisao a detalhar',
      owner: this.nullableText(item.owner),
      dueDate: item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : null,
      priority: null,
      source: 'decisao',
    }));
    const taskActions = (meeting.actions ?? []).flatMap((action: any) =>
      (action.tasks ?? []).map((task: any) => ({
        description: this.asText(task.title) || action.title || 'Tarefa a detalhar',
        owner: this.nullableText(task.assignedTo?.name),
        dueDate: task.dueDate || task.endDate ? new Date(task.dueDate ?? task.endDate).toISOString().slice(0, 10) : null,
        priority: this.nullableText(action.priority),
        source: 'plano',
      })),
    );
    const actionItems = [...decisionActions, ...taskActions].slice(0, 12);
    const agenda = (meeting.agendaItems ?? []).map((item: any) => this.asText(item.topic)).filter(Boolean);
    const participants = [
      ...(meeting.participants ?? []).map((item: any) => item.user?.name),
      ...(meeting.guests ?? []).map((item: any) => item.name),
    ].filter(Boolean);
    const risks = [
      ...(meeting.actions?.length ? [] : ['Nenhum plano de acao vinculado a reuniao.']),
      ...(meeting.analysis?.content || meeting.actions?.some((action: any) => action.rootCause || action.analysisSessions?.[0]?.rootCause)
        ? []
        : ['Causa raiz ainda nao consolidada.']),
    ];
    const nextSteps = actionItems.length
      ? actionItems.slice(0, 5).map((item) => item.description)
      : ['Registrar decisoes, responsaveis e prazos antes de concluir a reuniao.'];

    const draft: MeetingMinutesDraft = {
      provider: 'deterministic',
      generatedAt: new Date().toISOString(),
      summary: `Reuniao "${meeting.title}" com ${participants.length} participante(s), ${agenda.length} item(ns) de pauta, ${decisions.length} decisao(oes) e ${actionItems.length} acao(oes) mapeada(s).`,
      minutes: [
        `A reuniao tratou ${meeting.objective || meeting.indicator?.name || meeting.deviation?.title || 'os temas previstos em pauta'}.`,
        agenda.length ? `Pauta abordada: ${agenda.join('; ')}.` : 'Pauta formal nao registrada.',
        decisions.length ? `Decisoes registradas: ${decisions.join('; ')}.` : 'Nenhuma decisao formal registrada ate o momento.',
      ].join('\n'),
      decisions: decisions.length ? decisions : ['Nenhuma decisao formal registrada.'],
      actionItems,
      risks: risks.length ? risks : ['Sem riscos adicionais identificados no registro atual.'],
      nextSteps,
      markdown: '',
    };
    return { ...draft, markdown: this.renderMinutesMarkdown(meeting, draft) };
  }

  private normalizeMinutesDraft(aiDraft: Partial<MeetingMinutesDraft> | null, fallback: MeetingMinutesDraft): MeetingMinutesDraft | null {
    if (!aiDraft || typeof aiDraft !== 'object') return null;
    const draft: MeetingMinutesDraft = {
      provider: 'gemini',
      generatedAt: new Date().toISOString(),
      summary: this.asText(aiDraft.summary) || fallback.summary,
      minutes: this.asText(aiDraft.minutes) || fallback.minutes,
      decisions: this.stringList(aiDraft.decisions, fallback.decisions),
      actionItems: this.actionItemList(aiDraft.actionItems, fallback.actionItems),
      risks: this.stringList(aiDraft.risks, fallback.risks),
      nextSteps: this.stringList(aiDraft.nextSteps, fallback.nextSteps),
      markdown: '',
    };
    return draft;
  }

  private actionItemList(value: unknown, fallback: MeetingMinutesActionItem[]) {
    if (!Array.isArray(value)) return fallback;
    const items = value
      .map((item: any) => ({
        description: this.asText(item?.description ?? item?.title) || '',
        owner: this.nullableText(item?.owner),
        dueDate: this.nullableText(item?.dueDate),
        priority: this.nullableText(item?.priority),
        source: this.asText(item?.source) || 'ia',
      }))
      .filter((item) => item.description)
      .slice(0, 12);
    return items.length ? items : fallback;
  }

  private stringList(value: unknown, fallback: string[]) {
    if (!Array.isArray(value)) return fallback;
    const items = value.map((item) => this.asText(item)).filter(Boolean).slice(0, 12);
    return items.length ? items : fallback;
  }

  private renderMinutesMarkdown(meeting: any, draft: MeetingMinutesDraft) {
    const actionLines = draft.actionItems.length
      ? draft.actionItems.map((item) => `- ${item.description}${item.owner ? ` | Resp.: ${item.owner}` : ''}${item.dueDate ? ` | Prazo: ${item.dueDate}` : ''}`)
      : ['- Nenhuma acao mapeada.'];
    return [
      `# Minuta de ata - ${meeting.title}`,
      '',
      `Gerada em: ${new Date(draft.generatedAt).toLocaleString('pt-BR')}`,
      `Fonte: ${draft.provider === 'gemini' ? 'Gemini' : 'regras locais'}`,
      '',
      '## Resumo executivo',
      draft.summary,
      '',
      '## Ata',
      draft.minutes,
      '',
      '## Decisoes',
      ...draft.decisions.map((item) => `- ${item}`),
      '',
      '## Acoes e responsaveis',
      ...actionLines,
      '',
      '## Riscos e pendencias',
      ...draft.risks.map((item) => `- ${item}`),
      '',
      '## Proximos passos',
      ...draft.nextSteps.map((item) => `- ${item}`),
    ].join('\n');
  }

  private asText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private nullableText(value: unknown) {
    const text = this.asText(value);
    return text && text !== '-' ? text : null;
  }
}
