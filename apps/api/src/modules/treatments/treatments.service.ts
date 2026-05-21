import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ActionOrigin,
  ActionPriority,
  ActionStatus,
  AnalysisMethod,
  DeviationSeverity,
  DeviationStatus,
  MeetingFormat,
  MeetingKind,
  MeetingParticipantRole,
  MeetingStatus,
  TraceEntityType,
  TraceEventType,
  TreatmentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TraceabilityService } from '../traceability/traceability.service';

@Injectable()
export class TreatmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
  ) {}

  async getById(companyId: string, id: string) {
    const treatment = await this.prisma.treatmentCase.findFirst({
      where: { id, companyId },
      include: {
        indicator: {
          include: {
            ownerNode: true,
            responsibleUser: { select: { id: true, name: true, email: true, jobTitle: true } },
            targets: true,
          },
        },
        result: true,
        deviation: { include: { causes: true, analyses: true, actions: true } },
        analysis: true,
        meeting: {
          include: {
            participants: { include: { user: { select: { id: true, name: true, email: true, jobTitle: true } } } },
            guests: true,
            agendaItems: { orderBy: { position: 'asc' } },
            decisions: true,
            actions: { include: { responsibleUser: { select: { id: true, name: true, email: true } } } },
            emailLogs: { orderBy: { createdAt: 'desc' } },
            calendarInvites: true,
          },
        },
        actions: { include: { responsibleUser: { select: { id: true, name: true, email: true } } } },
      },
    });
    if (!treatment) throw new NotFoundException('Tratativa nao encontrada');
    return {
      ...treatment,
      alerts: this.alertsFor(treatment as any),
    };
  }

  async currentForIndicator(companyId: string, indicatorId: string, periodRef?: string) {
    const treatment = await this.prisma.treatmentCase.findFirst({
      where: {
        companyId,
        indicatorId,
        ...(periodRef ? { periodRef } : {}),
        status: { notIn: [TreatmentStatus.CONCLUDED] },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, periodRef: true, title: true },
    });
    return treatment;
  }

  async startFromResult(companyId: string, resultId: string, userId: string) {
    const result = await this.prisma.indicatorResult.findFirst({
      where: { id: resultId, indicator: { companyId } },
      include: { indicator: true },
    });
    if (!result) throw new NotFoundException('Resultado nao encontrado');
    const treatment = await this.prisma.treatmentCase.upsert({
      where: { indicatorId_periodRef: { indicatorId: result.indicatorId, periodRef: result.periodRef } },
      create: {
        companyId,
        indicatorId: result.indicatorId,
        resultId: result.id,
        periodRef: result.periodRef,
        title: `Tratativa - ${result.indicator.name} (${result.periodRef})`,
        problem: `Resultado ${result.value} fora da meta.`,
        status: TreatmentStatus.AWAITING_CAUSE_ANALYSIS,
        createdById: userId,
      },
      update: { resultId: result.id, status: TreatmentStatus.AWAITING_CAUSE_ANALYSIS, ignoredAt: null, ignoreReason: null },
    });
    await this.traceability.record({
      companyId,
      indicatorId: result.indicatorId,
      userId,
      eventType: TraceEventType.TREATMENT_STARTED,
      entityType: TraceEntityType.INDICATOR_RESULT,
      entityId: result.id,
      title: 'Tratativa iniciada pelo usuario',
      description: treatment.title,
      statusTo: treatment.status,
      metadata: { treatmentId: treatment.id },
    });
    return treatment;
  }

  async ignore(companyId: string, id: string, userId: string, reason: string) {
    const treatment = await this.getTreatment(companyId, id);
    const updated = await this.prisma.treatmentCase.update({
      where: { id },
      data: { status: TreatmentStatus.IGNORED_TEMPORARILY, ignoredAt: new Date(), ignoreReason: reason },
    });
    await this.traceability.record({
      companyId,
      indicatorId: treatment.indicatorId,
      userId,
      eventType: TraceEventType.TREATMENT_IGNORED,
      entityType: TraceEntityType.INDICATOR,
      entityId: treatment.indicatorId,
      title: 'Tratativa ignorada temporariamente',
      description: reason,
      statusFrom: treatment.status,
      statusTo: updated.status,
      metadata: { treatmentId: id },
    });
    return updated;
  }

  async createAnalysis(companyId: string, id: string, userId: string, body: {
    problem: string;
    probableCause?: string;
    rootCause: string;
    method: AnalysisMethod;
    evidence?: string;
    observations?: string;
    dueDate?: string;
  }) {
    const treatment = await this.getTreatmentWithContext(companyId, id);
    const deviation = treatment.deviationId
      ? await this.prisma.deviation.update({
          where: { id: treatment.deviationId },
          data: {
            status: DeviationStatus.IN_ANALYSIS,
            fact: body.problem,
            rootCause: body.rootCause,
            impact: body.observations ?? undefined,
          },
        })
      : await this.createDeviationForTreatment(companyId, treatment, body, userId);

    const cause = await this.prisma.deviationCause.create({
      data: {
        deviationId: deviation.id,
        category: 'Causa provavel',
        description: body.probableCause || body.rootCause,
        weight: 1,
      },
    });

    const analysis = await this.prisma.deviationAnalysis.create({
      data: {
        deviationId: deviation.id,
        method: body.method,
        content: [
          `Problema identificado: ${body.problem}`,
          body.probableCause ? `Causa provavel: ${body.probableCause}` : null,
          `Causa raiz: ${body.rootCause}`,
          body.evidence ? `Evidencias: ${body.evidence}` : null,
          body.observations ? `Observacoes: ${body.observations}` : null,
        ].filter(Boolean).join('\n\n'),
      },
    });

    const updated = await this.prisma.treatmentCase.update({
      where: { id },
      data: {
        deviationId: deviation.id,
        analysisId: analysis.id,
        problem: body.problem,
        status: TreatmentStatus.CAUSE_ANALYSIS_CREATED,
      },
    });

    await this.traceability.record({
      companyId,
      indicatorId: treatment.indicatorId,
      userId,
      eventType: TraceEventType.ANALYSIS_CREATED,
      entityType: TraceEntityType.DEVIATION_ANALYSIS,
      entityId: analysis.id,
      relatedType: TraceEntityType.DEVIATION,
      relatedId: deviation.id,
      title: 'Analise de causa criada para indicador fora da meta',
      description: body.rootCause,
      statusFrom: treatment.status,
      statusTo: updated.status,
      metadata: { treatmentId: id, causeId: cause.id, method: body.method },
    });

    return { treatment: updated, deviation, analysis, cause };
  }

  async scheduleMeeting(companyId: string, id: string, userId: string, body: {
    title?: string;
    startsAt: string;
    endsAt?: string;
    location?: string;
    format?: MeetingFormat;
    objective?: string;
    notes?: string;
    participants?: Array<{ userId?: string; name?: string; email?: string; jobTitle?: string; area?: string; role?: MeetingParticipantRole; notes?: string }>;
  }) {
    const treatment = await this.getTreatmentWithContext(companyId, id);
    const indicator = treatment.indicator;
    const title = body.title || `Reuniao de Tratativa - Indicador ${indicator.name}`;
    const agenda = this.defaultAgenda(treatment);
    const meeting = await this.prisma.meeting.create({
      data: {
        companyId,
        indicatorId: indicator.id,
        deviationId: treatment.deviationId,
        analysisId: treatment.analysisId,
        treatmentId: treatment.id,
        responsibleUserId: indicator.responsibleUserId ?? userId,
        title,
        kind: MeetingKind.DEVIATION,
        format: body.format ?? MeetingFormat.ONLINE,
        status: MeetingStatus.SCHEDULED,
        startsAt: new Date(body.startsAt),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        location: body.location ?? null,
        objective: body.objective ?? 'Analisar o desvio do indicador, decidir tratativas e definir plano de acao.',
        notes: body.notes ?? agenda.join('\n'),
        agendaItems: {
          create: agenda.map((topic, position) => ({ topic, position })),
        },
      },
    });

    if (indicator.responsibleUserId) {
      await this.prisma.meetingParticipant.upsert({
        where: { meetingId_userId: { meetingId: meeting.id, userId: indicator.responsibleUserId } },
        create: { meetingId: meeting.id, userId: indicator.responsibleUserId, role: MeetingParticipantRole.RESPONSIBLE },
        update: { role: MeetingParticipantRole.RESPONSIBLE },
      });
    }

    for (const participant of body.participants ?? []) {
      if (participant.userId) {
        await this.prisma.meetingParticipant.upsert({
          where: { meetingId_userId: { meetingId: meeting.id, userId: participant.userId } },
          create: {
            meetingId: meeting.id,
            userId: participant.userId,
            role: participant.role ?? MeetingParticipantRole.PARTICIPANT,
            notes: participant.notes ?? null,
          },
          update: { role: participant.role ?? MeetingParticipantRole.PARTICIPANT, notes: participant.notes ?? null },
        });
      } else if (participant.name && participant.email && this.isEmail(participant.email)) {
        await this.prisma.meetingGuest.upsert({
          where: { meetingId_email: { meetingId: meeting.id, email: participant.email.toLowerCase() } },
          create: {
            meetingId: meeting.id,
            name: participant.name,
            email: participant.email.toLowerCase(),
            jobTitle: participant.jobTitle ?? null,
            area: participant.area ?? null,
            role: participant.role ?? MeetingParticipantRole.GUEST,
            notes: participant.notes ?? null,
          },
          update: {
            name: participant.name,
            jobTitle: participant.jobTitle ?? null,
            area: participant.area ?? null,
            role: participant.role ?? MeetingParticipantRole.GUEST,
            notes: participant.notes ?? null,
          },
        });
      }
    }

    const updated = await this.prisma.treatmentCase.update({
      where: { id },
      data: { meetingId: meeting.id, status: TreatmentStatus.MEETING_SCHEDULED },
    });

    await this.traceability.record({
      companyId,
      indicatorId: indicator.id,
      userId,
      eventType: TraceEventType.MEETING_CREATED,
      entityType: TraceEntityType.MEETING,
      entityId: meeting.id,
      relatedType: TraceEntityType.INDICATOR,
      relatedId: indicator.id,
      title: 'Reuniao de tratativa agendada',
      description: meeting.title,
      statusFrom: treatment.status,
      statusTo: updated.status,
      metadata: { treatmentId: id, startsAt: meeting.startsAt, format: meeting.format },
    });

    return meeting;
  }

  async createAction(companyId: string, id: string, userId: string, body: {
    title: string;
    description?: string;
    responsibleUserId?: string;
    responsibleEmail?: string;
    ownerNodeId?: string;
    startDate?: string;
    dueDate?: string;
    priority?: ActionPriority;
    evidenceRequired?: boolean;
    expectedResult?: string;
    observations?: string;
  }) {
    const treatment = await this.getTreatmentWithContext(companyId, id);
    const action = await this.prisma.actionPlan.create({
      data: {
        companyId,
        indicatorId: treatment.indicatorId,
        deviationId: treatment.deviationId,
        analysisId: treatment.analysisId,
        meetingId: treatment.meetingId,
        treatmentId: treatment.id,
        ownerNodeId: body.ownerNodeId ?? treatment.indicator.ownerNodeId,
        title: body.title,
        description: body.description ?? body.observations ?? null,
        origin: treatment.meetingId ? ActionOrigin.MEETING : ActionOrigin.DEVIATION,
        originRefId: treatment.meetingId ?? treatment.deviationId ?? treatment.indicatorId,
        responsibleUserId: body.responsibleUserId ?? null,
        responsibleEmail: body.responsibleEmail ?? null,
        priority: body.priority ?? ActionPriority.HIGH,
        status: ActionStatus.NOT_STARTED,
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        evidenceRequired: body.evidenceRequired ?? true,
        expectedResult: body.expectedResult ?? null,
        createdById: userId,
      },
    });

    const updated = await this.prisma.treatmentCase.update({
      where: { id },
      data: { status: TreatmentStatus.ACTION_PLAN_CREATED },
    });

    await this.traceability.record({
      companyId,
      indicatorId: treatment.indicatorId,
      userId,
      eventType: TraceEventType.ACTION_CREATED,
      entityType: TraceEntityType.ACTION_PLAN,
      entityId: action.id,
      relatedType: treatment.meetingId ? TraceEntityType.MEETING : TraceEntityType.DEVIATION,
      relatedId: treatment.meetingId ?? treatment.deviationId ?? undefined,
      title: 'Plano de acao criado na tratativa',
      description: action.title,
      statusFrom: treatment.status,
      statusTo: updated.status,
      metadata: { treatmentId: id, dueDate: action.dueDate, priority: action.priority, evidenceRequired: action.evidenceRequired },
    });

    return action;
  }

  async reevaluate(companyId: string, id: string, userId: string) {
    const treatment = await this.getTreatmentWithContext(companyId, id);
    const lastResult = await this.prisma.indicatorResult.findFirst({
      where: { indicatorId: treatment.indicatorId },
      orderBy: { periodDate: 'desc' },
    });
    const resolved = lastResult?.light === 'GREEN';
    const updated = await this.prisma.treatmentCase.update({
      where: { id },
      data: {
        status: resolved ? TreatmentStatus.RESOLVED : TreatmentStatus.UNRESOLVED,
        resolvedAt: resolved ? new Date() : null,
      },
    });
    await this.traceability.record({
      companyId,
      indicatorId: treatment.indicatorId,
      userId,
      eventType: resolved ? TraceEventType.INDICATOR_RESOLVED : TraceEventType.INDICATOR_REEVALUATED,
      entityType: TraceEntityType.INDICATOR,
      entityId: treatment.indicatorId,
      title: resolved ? 'Indicador resolvido apos reavaliacao' : 'Indicador reavaliado e ainda fora da meta',
      description: lastResult ? `${lastResult.periodRef}: farol ${lastResult.light}` : 'Sem novo resultado lancado',
      statusFrom: treatment.status,
      statusTo: updated.status,
      metadata: { treatmentId: id, lastResultId: lastResult?.id, light: lastResult?.light },
    });
    return updated;
  }

  private async getTreatment(companyId: string, id: string) {
    const treatment = await this.prisma.treatmentCase.findFirst({ where: { id, companyId } });
    if (!treatment) throw new NotFoundException('Tratativa nao encontrada');
    return treatment;
  }

  private async getTreatmentWithContext(companyId: string, id: string) {
    const treatment = await this.prisma.treatmentCase.findFirst({
      where: { id, companyId },
      include: {
        indicator: { include: { ownerNode: true, responsibleUser: true, targets: true } },
        result: true,
        deviation: true,
        analysis: true,
      },
    });
    if (!treatment) throw new NotFoundException('Tratativa nao encontrada');
    return treatment;
  }

  private async createDeviationForTreatment(companyId: string, treatment: any, body: any, userId: string) {
    const last = await this.prisma.deviation.findFirst({
      where: { companyId },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    return this.prisma.deviation.create({
      data: {
        companyId,
        indicatorId: treatment.indicatorId,
        periodRef: treatment.periodRef,
        number: (last?.number ?? 0) + 1,
        title: `Desvio - ${treatment.indicator.name} (${treatment.periodRef})`,
        severity: DeviationSeverity.CRITICAL,
        status: DeviationStatus.IN_ANALYSIS,
        method: body.method ?? AnalysisMethod.SIMPLE,
        fact: body.problem,
        rootCause: body.rootCause,
        impact: body.observations ?? null,
        responsibleUserId: treatment.indicator.responsibleUserId ?? userId,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
    });
  }

  private defaultAgenda(treatment: any) {
    const target = treatment.indicator.targets.find((item: any) => item.periodRef === treatment.periodRef)?.target;
    return [
      `Indicador fora da meta: ${treatment.indicator.name}`,
      `Resultado atual: ${treatment.result?.value ?? '-'} | Meta esperada: ${target ?? '-'}`,
      'Desvio identificado e impacto no processo',
      treatment.analysis ? 'Analise de causa e causa raiz' : 'Definicao da analise de causa',
      'Discussao das acoes necessarias',
      'Definicao de responsaveis e prazos',
      'Criacao do plano de acao',
      'Proximos passos e forma de acompanhamento',
    ];
  }

  private alertsFor(treatment: any) {
    const alerts: string[] = [];
    if (!treatment.analysisId) alerts.push('Indicador fora da meta sem analise de causa concluida.');
    if (treatment.analysisId && !treatment.meetingId) alerts.push('Analise criada sem reuniao de tratativa.');
    if (treatment.meetingId && treatment.actions.length === 0 && (treatment.meeting?.actions?.length ?? 0) === 0) {
      alerts.push('Reuniao agendada sem plano de acao.');
    }
    for (const action of [...treatment.actions, ...(treatment.meeting?.actions ?? [])]) {
      if (!action.responsibleUserId && !action.responsibleEmail) alerts.push(`Acao sem responsavel: ${action.title}`);
      if (!action.dueDate) alerts.push(`Acao sem prazo: ${action.title}`);
      if (action.dueDate && new Date(action.dueDate) < new Date() && !['DONE', 'DONE_LATE', 'CANCELLED'].includes(action.status)) {
        alerts.push(`Acao atrasada: ${action.title}`);
      }
    }
    if (treatment.meeting?.guests?.some((guest: any) => !this.isEmail(guest.email))) {
      alerts.push('Existe participante com e-mail invalido.');
    }
    return alerts;
  }

  private isEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}
