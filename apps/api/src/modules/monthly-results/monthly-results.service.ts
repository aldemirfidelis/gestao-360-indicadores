import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActionOrigin,
  ActionPriority,
  ActionStatus,
  DeviationStatus,
  MeetingFormat,
  MeetingParticipantRole,
  MonthlyAreaReadiness,
  MonthlyEntryKind,
  MonthlyFollowUpLevel,
  MonthlyItemStatus,
  MonthlyMeetingStatus,
  MonthlyPresentationStatus,
  MonthlyStandardizationType,
  NotificationKind,
  TrafficLight,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { ActionsService } from '../actions/actions.service';
import { GeminiService } from '../ai/gemini.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthPayload } from '../auth/auth.types';

const MODULE = 'monthly-results';

const CLOSED_ACTION_STATUSES: ActionStatus[] = [
  ActionStatus.DONE,
  ActionStatus.DONE_LATE,
  ActionStatus.CANCELLED,
  ActionStatus.EFFECTIVE,
];

const DONE_ACTION_STATUSES: ActionStatus[] = [ActionStatus.DONE, ActionStatus.DONE_LATE, ActionStatus.EFFECTIVE];

const OPENABLE_ACTION_STATUSES: ActionStatus[] = [
  ActionStatus.DRAFT,
  ActionStatus.NOT_STARTED,
  ActionStatus.UNDER_ANALYSIS,
];

const CLOSED_DEVIATION_STATUSES: DeviationStatus[] = [
  DeviationStatus.CLOSED,
  DeviationStatus.CLOSED_LATE,
  DeviationStatus.CANCELLED,
];

const VALIDATED_READINESS: MonthlyAreaReadiness[] = [MonthlyAreaReadiness.VALIDATED, MonthlyAreaReadiness.RELEASED];
// Planos ainda NÃO em execução (não satisfazem a prontidão da área).
const ACTION_NOT_EXECUTING = new Set(['DRAFT', 'NOT_STARTED', 'UNDER_ANALYSIS', 'CANCELLED']);
const OPEN_ITEM_STATUSES: MonthlyItemStatus[] = [MonthlyItemStatus.OPEN, MonthlyItemStatus.IN_PROGRESS];

const DEFAULT_AGENDA = [
  { topic: 'Abertura', plannedMinutes: 10 },
  { topic: 'SSMA', areaName: 'SSMA', plannedMinutes: 45 },
  { topic: 'Agrícola', areaName: 'Agrícola', plannedMinutes: 45 },
  { topic: 'Terras', areaName: 'Terras', plannedMinutes: 45 },
  { topic: 'Pausa para café', plannedMinutes: 15 },
  { topic: 'Manutenção Automotiva', areaName: 'Manutenção Automotiva', plannedMinutes: 45 },
  { topic: 'Indústria', areaName: 'Indústria', plannedMinutes: 45 },
  { topic: 'Almoço', plannedMinutes: 60 },
  { topic: 'ComLog', areaName: 'ComLog', plannedMinutes: 45 },
  { topic: 'Suprimentos', areaName: 'Suprimentos', plannedMinutes: 45 },
  { topic: 'Gestão de Pessoas', areaName: 'Gestão de Pessoas', plannedMinutes: 45 },
  { topic: 'Considerações finais', plannedMinutes: 15 },
  { topic: 'Encerramento', plannedMinutes: 10 },
];

const INTERNAL_AREA_SCRIPT = [
  { block: 'Abertura e direcionadores', plannedMinutes: 5 },
  { block: 'Resultado global', plannedMinutes: 5 },
  { block: 'Análise dos desvios', plannedMinutes: 15 },
  { block: 'Planos de ação', plannedMinutes: 15 },
  { block: 'Decisões e escalonamentos', plannedMinutes: 5 },
];

const WEEKLY_ROUTINE_LEVELS = [
  { level: 'Diário / turno', focus: ['Anomalias críticas', 'Segurança', 'Disponibilidade', 'Correção imediata'] },
  {
    level: 'Semanal',
    focus: ['Planos de ação', 'Indicadores de tendência', 'Bloqueios', 'Recursos necessários', 'Ações atrasadas'],
  },
  { level: 'Mensal', focus: ['Resultado oficial', 'Causa raiz', 'Plano de ação', 'Decisão', 'Padronização'] },
  { level: 'Trimestral', focus: ['Revisão de metas', 'Aprendizados', 'Projetos estruturantes', 'Revisão de indicadores'] },
];

const GOVERNANCE = [
  'Responsável do indicador atualiza os dados antes da reunião.',
  'Gestor valida a análise e remove barreiras locais.',
  'Diretoria decide recursos, prioridades e conflitos entre áreas.',
  'PMO acompanha prazos e registra lições aprendidas.',
];

const CHECKLIST_RULES = [
  { autoRule: 'no_update', label: 'Indicadores sem atualização no mês', severity: 'high' },
  { autoRule: 'red_no_cause', label: 'Indicadores fora da meta sem causa raiz', severity: 'high' },
  { autoRule: 'red_no_action', label: 'Indicadores fora da meta sem plano de ação', severity: 'high' },
  { autoRule: 'overdue_actions', label: 'Ações em atraso', severity: 'medium' },
  { autoRule: 'critical_no_owner', label: 'Indicadores críticos sem responsável', severity: 'high' },
  { autoRule: 'yellow_no_comment', label: 'Indicadores em atenção sem comentário de tendência', severity: 'medium' },
];

@Injectable()
export class MonthlyResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly actions: ActionsService,
    private readonly notifications: NotificationsService,
    private readonly ai: GeminiService,
  ) {}

  // =========================================================================
  // Options + Dashboard do período (home)
  // =========================================================================

  async options(me: AuthPayload) {
    const areaFilter = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const [areas, users, indicators] = await Promise.all([
      this.prisma.orgNode.findMany({
        where: {
          companyId: me.companyId,
          deletedAt: null,
          active: true,
          ...(areaFilter ? { id: { in: areaFilter } } : {}),
        },
        select: { id: true, parentId: true, name: true, code: true, type: true, responsibleUserId: true },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.user.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true },
        select: { id: true, name: true, email: true, jobTitle: true, defaultNodeId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.indicator.findMany({
        where: {
          companyId: me.companyId,
          deletedAt: null,
          status: 'ACTIVE',
          // Reunião Mensal trata apenas indicadores estratégicos (operacionais ficam só em Indicadores/prêmio).
          type: 'STRATEGIC',
          ...(areaFilter ? { ownerNodeId: { in: areaFilter } } : {}),
        },
        select: { id: true, name: true, code: true, ownerNodeId: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      currentPeriodRef: this.currentPeriodRef(),
      areaOptions: areas,
      users,
      indicators,
      internalAreaScript: INTERNAL_AREA_SCRIPT,
      weeklyRoutine: WEEKLY_ROUTINE_LEVELS,
      governance: GOVERNANCE,
      ai: { enabled: this.ai.isEnabled, provider: this.ai.provider, model: this.ai.modelName },
    };
  }

  async dashboard(me: AuthPayload, query: { periodRef?: string; areaIds?: string | string[] }) {
    const periodRef = this.parsePeriodRef(query.periodRef);
    const selectedAreaIds = this.parseAreaIds(query.areaIds);
    const scope = await this.resolveAreaScope(me, selectedAreaIds);
    const { start, end } = this.monthWindow(periodRef);

    const [areas, meetings] = await Promise.all([
      this.prisma.orgNode.findMany({
        where: {
          companyId: me.companyId,
          deletedAt: null,
          active: true,
          ...(scope.areaFilter ? { id: { in: scope.areaFilter } } : {}),
        },
        select: {
          id: true,
          parentId: true,
          name: true,
          code: true,
          type: true,
          responsibleUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.monthlyMeeting.findMany({
        where: {
          companyId: me.companyId,
          deletedAt: null,
          OR: [{ periodRef }, { startsAt: { gte: start, lt: end } }, { status: { in: [MonthlyMeetingStatus.PREPARING, MonthlyMeetingStatus.READY, MonthlyMeetingStatus.IN_PROGRESS] } }],
        },
        select: {
          id: true,
          title: true,
          periodRef: true,
          status: true,
          startsAt: true,
          endsAt: true,
          location: true,
          keyMessage: true,
          _count: { select: { areas: true, decisions: true, participants: true, indicators: true } },
          areas: { select: { readiness: true } },
        },
        orderBy: { startsAt: 'desc' },
      }),
    ]);

    const { cards, actions } = await this.deriveCards(me, periodRef, scope.areaFilter);
    const areaSummaries = this.buildAreaSummaries(areas, cards);
    const lightCounts = this.countLights(cards);
    const now = new Date();
    const openActions = actions.filter((a) => !CLOSED_ACTION_STATUSES.includes(a.status)).length;
    const overdueActions = actions.filter((a) => a.dueDate && a.dueDate < now && !CLOSED_ACTION_STATUSES.includes(a.status)).length;
    const doneActions = actions.filter((a) => DONE_ACTION_STATUSES.includes(a.status)).length;
    const openEscalations = cards.filter((c) => c.light === 'RED' && (c.hasOverdueAction || !c.hasActionPlan)).length;
    const pendingDecisions = await this.prisma.monthlyMeetingDecision.count({
      where: { meeting: { companyId: me.companyId, deletedAt: null }, status: { in: [MonthlyItemStatus.OPEN, MonthlyItemStatus.IN_PROGRESS] } },
    });

    const currentMeeting = meetings.find((m) => m.periodRef === periodRef) ?? meetings[0] ?? null;
    const nextMeeting = meetings.filter((m) => m.startsAt >= now).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0] ?? null;

    const criticalIndicators = cards
      .filter((c) => c.light === 'RED' || c.light === 'YELLOW' || c.validationIssues.length > 0)
      .sort((a, b) => this.lightWeight(b.light) - this.lightWeight(a.light) || b.validationIssues.length - a.validationIssues.length)
      .slice(0, 24);

    return {
      periodRef,
      generatedAt: now,
      selectedAreaIds: scope.selectedAreaIds,
      meetings: meetings.map((m) => ({
        id: m.id,
        title: m.title,
        periodRef: m.periodRef,
        status: m.status,
        startsAt: m.startsAt,
        endsAt: m.endsAt,
        location: m.location,
        keyMessage: m.keyMessage,
        counts: m._count,
        readiness: this.summarizeReadiness(m.areas),
      })),
      currentMeeting: currentMeeting
        ? { id: currentMeeting.id, title: currentMeeting.title, startsAt: currentMeeting.startsAt, status: currentMeeting.status }
        : null,
      nextMeeting: nextMeeting ? { id: nextMeeting.id, title: nextMeeting.title, startsAt: nextMeeting.startsAt } : null,
      metrics: {
        meetingsInPeriod: meetings.length,
        participantAreas: areaSummaries.length,
        indicatorsGreen: lightCounts.GREEN + lightCounts.BLUE,
        indicatorsYellow: lightCounts.YELLOW,
        indicatorsRed: lightCounts.RED,
        indicatorsGray: lightCounts.GRAY,
        indicatorsAtRisk: lightCounts.YELLOW + lightCounts.RED,
        overdueActions,
        doneActions,
        openActions,
        pendingDecisions,
        openEscalations,
        areasWithoutUpdate: areaSummaries.filter((a) => a.gray > 0).length,
        areasReady: areaSummaries.filter((a) => ['Pronta para validação', 'Liberada para reunião'].includes(a.readiness)).length,
        nextMonthlyMeeting: nextMeeting?.startsAt ?? null,
      },
      executivePanel: {
        lights: lightCounts,
        keyMessageDraft: this.buildFallbackKeyMessage(cards, actions),
        macroIndicators: cards
          .slice()
          .sort((a, b) => this.lightWeight(b.light) - this.lightWeight(a.light) || (a.attainment ?? 1) - (b.attainment ?? 1))
          .slice(0, 12),
      },
      areas: areaSummaries,
      indicators: cards,
      criticalIndicators,
      weeklyRoutine: WEEKLY_ROUTINE_LEVELS,
      governance: GOVERNANCE,
    };
  }

  // =========================================================================
  // Reunião — CRUD
  // =========================================================================

  async createMeeting(
    me: AuthPayload,
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
    const title = String(body.title ?? '').trim();
    if (!title) throw new BadRequestException('Informe o título da reunião mensal.');
    const periodRef = this.parsePeriodRef(body.periodRef);
    const startsAt = this.parseRequiredDate(body.startsAt, 'Informe a data e hora da reunião.');
    const selectedAreaIds = this.parseAreaIds(body.areaIds);
    const scope = await this.resolveAreaScope(me, selectedAreaIds);
    const areaIds = (scope.areaFilter ?? []).length ? selectedAreaIds.filter((id) => scope.areaFilter!.includes(id)) : selectedAreaIds;
    if (!areaIds.length) throw new BadRequestException('Selecione pelo menos uma área participante.');

    const areas = await this.prisma.orgNode.findMany({
      where: { companyId: me.companyId, deletedAt: null, id: { in: areaIds } },
      select: { id: true, name: true, responsibleUserId: true },
    });
    if (!areas.length) throw new BadRequestException('Áreas inválidas.');

    const meeting = await this.prisma.monthlyMeeting.create({
      data: {
        companyId: me.companyId,
        title,
        periodRef,
        cropSeason: this.clean(body.cropSeason),
        cycleName: this.clean(body.cycleName) ?? 'Fechamento mensal',
        status: MonthlyMeetingStatus.PREPARING,
        format: body.format ?? MeetingFormat.HYBRID,
        startsAt,
        endsAt: this.parseOptionalDate(body.endsAt),
        location: this.clean(body.location),
        responsibleUserId: this.clean(body.responsibleUserId),
        secretaryUserId: this.clean(body.secretaryUserId),
        followUpUserId: this.clean(body.followUpUserId),
        objective: this.clean(body.objective),
        assumptions: this.clean(body.assumptions),
        criticalRisks: this.clean(body.criticalRisks),
        boardDirections: this.clean(body.boardDirections),
        generalNotes: this.clean(body.generalNotes),
        nextMonthlyAt: this.parseOptionalDate(body.nextMonthlyAt),
        nextWeeklyAt: this.parseOptionalDate(body.nextWeeklyAt),
        createdById: me.sub,
      },
      select: { id: true },
    });

    // Áreas participantes
    const orderedAreas = areaIds.map((id) => areas.find((a) => a.id === id)).filter(Boolean) as typeof areas;
    await this.prisma.monthlyMeetingArea.createMany({
      data: orderedAreas.map((area, index) => ({
        meetingId: meeting.id,
        orgNodeId: area.id,
        position: index + 1,
        presenterUserId: area.responsibleUserId ?? null,
        readiness: MonthlyAreaReadiness.NOT_STARTED,
      })),
      skipDuplicates: true,
    });

    // Agenda padrão (somente blocos genéricos + áreas selecionadas)
    const agendaData = this.buildAgendaForAreas(orderedAreas);
    await this.prisma.monthlyMeetingAgendaItem.createMany({
      data: agendaData.map((item, index) => ({
        meetingId: meeting.id,
        orgNodeId: item.orgNodeId ?? null,
        topic: item.topic,
        position: index + 1,
        plannedMinutes: item.plannedMinutes,
        presenterUserId: item.presenterUserId ?? null,
        presentationStatus: MonthlyPresentationStatus.PENDING,
      })),
    });

    // Participantes
    const participantIds = Array.from(
      new Set([body.responsibleUserId, body.secretaryUserId, body.followUpUserId].filter((id): id is string => Boolean(id))),
    );
    if (participantIds.length) {
      await this.prisma.monthlyMeetingParticipant.createMany({
        data: participantIds.map((userId) => ({
          meetingId: meeting.id,
          userId,
          role: userId === body.responsibleUserId ? MeetingParticipantRole.RESPONSIBLE : MeetingParticipantRole.PARTICIPANT,
        })),
        skipDuplicates: true,
      });
    }

    // Checklist automático
    await this.prisma.monthlyMeetingChecklistItem.createMany({
      data: CHECKLIST_RULES.map((rule) => ({ meetingId: meeting.id, label: rule.label, autoRule: rule.autoRule, severity: rule.severity })),
    });

    // Snapshots de indicadores por área
    await this.seedSnapshots(me, meeting.id, areaIds, periodRef);

    return this.meetingDetail(me, meeting.id);
  }

  async meetingDetail(me: AuthPayload, id: string) {
    const meeting = await this.prisma.monthlyMeeting.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: {
        areas: {
          orderBy: { position: 'asc' },
          include: {
            orgNode: { select: { id: true, name: true, code: true, type: true, responsibleUserId: true } },
            indicators: {
              // Reunião Mensal é estratégica: exibe apenas indicadores STRATEGIC (igual ao Painel Executivo).
              where: { indicator: { type: 'STRATEGIC' } },
              orderBy: [{ isCritical: 'desc' }, { position: 'asc' }],
              include: { indicator: { select: { id: true, name: true, code: true, unit: true, unitLabel: true, source: true, responsibleUserId: true, type: true } } },
            },
          },
        },
        agendaItems: { orderBy: { position: 'asc' } },
        decisions: { orderBy: [{ status: 'asc' }, { dueDate: 'asc' }] },
        followUps: { orderBy: [{ level: 'asc' }, { dueDate: 'asc' }] },
        learnings: { orderBy: { createdAt: 'desc' } },
        standardizations: { orderBy: { createdAt: 'desc' } },
        participants: true,
        checklist: { orderBy: { severity: 'asc' } },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!meeting) throw new NotFoundException('Reunião mensal não encontrada.');

    // Resolver nomes de usuários referenciados
    const userIds = new Set<string>();
    for (const u of [meeting.responsibleUserId, meeting.secretaryUserId, meeting.followUpUserId, meeting.createdById]) if (u) userIds.add(u);
    for (const a of meeting.areas) if (a.presenterUserId) userIds.add(a.presenterUserId);
    for (const p of meeting.participants) userIds.add(p.userId);
    for (const d of meeting.decisions) if (d.ownerUserId) userIds.add(d.ownerUserId);
    for (const f of meeting.followUps) if (f.ownerUserId) userIds.add(f.ownerUserId);
    const users = userIds.size
      ? await this.prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, name: true, email: true, jobTitle: true } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Resolver ações e desvios linkados nos snapshots/decisões
    const actionIds = new Set<string>();
    const deviationIds = new Set<string>();
    for (const a of meeting.areas)
      for (const ind of a.indicators) {
        if (ind.actionPlanId) actionIds.add(ind.actionPlanId);
        if (ind.deviationId) deviationIds.add(ind.deviationId);
      }
    for (const d of meeting.decisions) if (d.actionPlanId) actionIds.add(d.actionPlanId);
    for (const f of meeting.followUps) if (f.actionPlanId) actionIds.add(f.actionPlanId);
    const [linkedActions, linkedDeviations] = await Promise.all([
      actionIds.size
        ? this.prisma.actionPlan.findMany({
            where: { id: { in: [...actionIds] }, companyId: me.companyId },
            select: { id: true, title: true, status: true, progress: true, dueDate: true, responsibleUser: { select: { id: true, name: true } } },
          })
        : [],
      deviationIds.size
        ? this.prisma.deviation.findMany({
            where: { id: { in: [...deviationIds] }, companyId: me.companyId },
            select: { id: true, number: true, title: true, status: true, severity: true, rootCause: true },
          })
        : [],
    ]);
    const actionMap = new Map(linkedActions.map((a) => [a.id, a]));
    const deviationMap = new Map(linkedDeviations.map((d) => [d.id, d]));

    const areas = meeting.areas.map((area) => {
      const indicators = area.indicators.map((ind) => ({ ...this.shapeSnapshot(ind, actionMap, deviationMap), area: area.orgNode.name }));
      const counts = this.countLights(indicators.map((i) => ({ light: i.light })) as any);
      const validationIssues = indicators.flatMap((i) => i.validationIssues.map((issue) => ({ indicatorId: i.indicatorId, indicator: i.name, issue })));
      const blocking = indicators.flatMap((i) => i.blockingIssues.map((issue) => ({ indicatorId: i.indicatorId, indicator: i.name, issue })));
      return {
        id: area.id,
        orgNodeId: area.orgNodeId,
        name: area.orgNode.name,
        type: area.orgNode.type,
        position: area.position,
        readiness: area.readiness,
        readinessLabel: this.readinessLabel(area.readiness),
        presenter: area.presenterUserId ? userMap.get(area.presenterUserId) ?? null : null,
        areaKeyMessage: area.areaKeyMessage,
        validatedAt: area.validatedAt,
        totalIndicators: indicators.length,
        green: counts.GREEN + counts.BLUE,
        yellow: counts.YELLOW,
        red: counts.RED,
        gray: counts.GRAY,
        validationIssues,
        blockingIssues: blocking,
        canValidate: blocking.length === 0,
        indicators,
      };
    });

    const allIndicators = areas.flatMap((a) => a.indicators);
    const lights = this.countLights(allIndicators.map((i) => ({ light: i.light })) as any);

    return {
      id: meeting.id,
      title: meeting.title,
      periodRef: meeting.periodRef,
      cropSeason: meeting.cropSeason,
      cycleName: meeting.cycleName,
      status: meeting.status,
      statusLabel: this.statusLabel(meeting.status),
      format: meeting.format,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      location: meeting.location,
      objective: meeting.objective,
      assumptions: meeting.assumptions,
      criticalRisks: meeting.criticalRisks,
      boardDirections: meeting.boardDirections,
      generalNotes: meeting.generalNotes,
      keyMessage: meeting.keyMessage,
      nextMonthlyAt: meeting.nextMonthlyAt,
      nextWeeklyAt: meeting.nextWeeklyAt,
      closedAt: meeting.closedAt,
      responsible: meeting.responsibleUserId ? userMap.get(meeting.responsibleUserId) ?? null : null,
      secretary: meeting.secretaryUserId ? userMap.get(meeting.secretaryUserId) ?? null : null,
      followUp: meeting.followUpUserId ? userMap.get(meeting.followUpUserId) ?? null : null,
      participants: meeting.participants.map((p) => ({ id: p.id, userId: p.userId, role: p.role, attended: p.attended, user: userMap.get(p.userId) ?? null })),
      areas,
      agendaItems: meeting.agendaItems.map((item) => ({
        id: item.id,
        orgNodeId: item.orgNodeId,
        topic: item.topic,
        position: item.position,
        plannedMinutes: item.plannedMinutes,
        actualMinutes: item.actualMinutes,
        presentationStatus: item.presentationStatus,
        startedAt: item.startedAt,
        endedAt: item.endedAt,
        presenter: item.presenterUserId ? userMap.get(item.presenterUserId) ?? null : null,
        notes: item.notes,
      })),
      decisions: meeting.decisions.map((d) => ({
        ...d,
        owner: d.ownerUserId ? userMap.get(d.ownerUserId)?.name ?? d.ownerName : d.ownerName,
        action: d.actionPlanId ? actionMap.get(d.actionPlanId) ?? null : null,
      })),
      followUps: meeting.followUps.map((f) => ({
        ...f,
        owner: f.ownerUserId ? userMap.get(f.ownerUserId) ?? null : null,
        action: f.actionPlanId ? actionMap.get(f.actionPlanId) ?? null : null,
      })),
      learnings: meeting.learnings,
      standardizations: meeting.standardizations,
      checklist: meeting.checklist,
      attachments: meeting.attachments,
      summary: {
        lights,
        totalIndicators: allIndicators.length,
        critical: allIndicators.filter((i) => i.light === 'RED' || i.light === 'YELLOW' || i.isCritical).length,
        areasReady: areas.filter((a) => VALIDATED_READINESS.includes(a.readiness)).length,
        openDecisions: meeting.decisions.filter((d) => OPEN_ITEM_STATUSES.includes(d.status)).length,
      },
      internalAreaScript: INTERNAL_AREA_SCRIPT,
      weeklyRoutine: WEEKLY_ROUTINE_LEVELS,
      governance: GOVERNANCE,
      ai: { enabled: this.ai.isEnabled, provider: this.ai.provider, model: this.ai.modelName },
    };
  }

  async updateMeeting(me: AuthPayload, id: string, body: any) {
    await this.assertMeeting(me, id);
    const data: any = {};
    for (const key of ['title', 'location', 'objective', 'assumptions', 'criticalRisks', 'boardDirections', 'generalNotes', 'keyMessage', 'cropSeason', 'cycleName'] as const) {
      if (body[key] !== undefined) data[key] = this.clean(body[key]);
    }
    for (const key of ['responsibleUserId', 'secretaryUserId', 'followUpUserId'] as const) {
      if (body[key] !== undefined) data[key] = this.clean(body[key]);
    }
    if (body.format !== undefined) data.format = body.format;
    if (body.startsAt !== undefined) data.startsAt = this.parseRequiredDate(body.startsAt, 'Data inválida.');
    if (body.endsAt !== undefined) data.endsAt = this.parseOptionalDate(body.endsAt);
    if (body.nextMonthlyAt !== undefined) data.nextMonthlyAt = this.parseOptionalDate(body.nextMonthlyAt);
    if (body.nextWeeklyAt !== undefined) data.nextWeeklyAt = this.parseOptionalDate(body.nextWeeklyAt);
    if (body.periodRef !== undefined) data.periodRef = this.parsePeriodRef(body.periodRef);
    data.updatedById = me.sub;
    await this.prisma.monthlyMeeting.update({ where: { id }, data });
    return this.meetingDetail(me, id);
  }

  async deleteMeeting(me: AuthPayload, id: string) {
    await this.assertMeeting(me, id);
    await this.prisma.monthlyMeeting.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  async changeStatus(me: AuthPayload, id: string, body: { status: MonthlyMeetingStatus }) {
    const meeting = await this.assertMeeting(me, id);
    const target = body.status;
    if (!Object.values(MonthlyMeetingStatus).includes(target)) throw new BadRequestException('Status inválido.');

    if (target === MonthlyMeetingStatus.READY) {
      const areas = await this.prisma.monthlyMeetingArea.findMany({ where: { meetingId: id }, select: { readiness: true } });
      const notReady = areas.filter((a) => !VALIDATED_READINESS.includes(a.readiness));
      if (notReady.length) throw new BadRequestException(`${notReady.length} área(s) ainda não validada(s) para liberar a reunião.`);
    }

    const data: any = { status: target, updatedById: me.sub };
    if (target === MonthlyMeetingStatus.CLOSED) data.closedAt = new Date();
    await this.prisma.monthlyMeeting.update({ where: { id }, data });

    if (target === MonthlyMeetingStatus.CLOSED) await this.onClose(me, id);
    return this.meetingDetail(me, id);
  }

  private async onClose(me: AuthPayload, id: string) {
    // Inicia execução das ações vinculadas à reunião
    const meeting = await this.prisma.monthlyMeeting.findFirst({
      where: { id, companyId: me.companyId },
      include: { indicators: { select: { actionPlanId: true } }, decisions: { select: { actionPlanId: true, ownerUserId: true } }, participants: { select: { userId: true } } },
    });
    if (!meeting) return;
    const linkedActionIds = [
      ...meeting.indicators.map((i) => i.actionPlanId),
      ...meeting.decisions.map((d) => d.actionPlanId),
    ].filter((x): x is string => Boolean(x));
    if (linkedActionIds.length) {
      await this.prisma.actionPlan.updateMany({
        where: { id: { in: linkedActionIds }, companyId: me.companyId, deletedAt: null, status: { in: OPENABLE_ACTION_STATUSES } },
        data: { status: ActionStatus.IN_PROGRESS },
      });
    }
    // Notifica participantes
    const link = `/monthly-results/${id}`;
    const recipients = new Set<string>(meeting.participants.map((p) => p.userId));
    if (meeting.responsibleUserId) recipients.add(meeting.responsibleUserId);
    if (meeting.followUpUserId) recipients.add(meeting.followUpUserId);
    for (const userId of recipients) {
      await this.notifications
        .create(me.companyId, userId, NotificationKind.MEETING_UPCOMING, `Reunião mensal encerrada: ${meeting.title}`, 'A ata foi gerada e as ações entraram em execução.', link)
        .catch(() => null);
    }
  }

  // =========================================================================
  // Preparação por área + snapshots
  // =========================================================================

  private async seedSnapshots(me: AuthPayload, meetingId: string, areaIds: string[], periodRef: string) {
    const nodeToArea = await this.mapNodesToAreas(me.companyId, areaIds);
    const indicators = await this.loadIndicatorsForAreas(me.companyId, [...nodeToArea.keys()], periodRef);
    if (!indicators.length) return;

    const areaRecords = await this.prisma.monthlyMeetingArea.findMany({ where: { meetingId, orgNodeId: { in: areaIds } }, select: { id: true, orgNodeId: true } });
    const areaIdByNode = new Map(areaRecords.map((a) => [a.orgNodeId, a.id]));

    const existing = await this.prisma.monthlyMeetingIndicator.findMany({ where: { meetingId }, select: { id: true, meetingAreaId: true, indicatorId: true, deviationId: true, actionPlanId: true } });
    const existingByKey = new Map(existing.map((e) => [`${e.meetingAreaId}:${e.indicatorId}`, e]));

    // Auto-vincula causa raiz (desvio aberto) e plano de ação aberto já existentes.
    const indicatorIds = indicators.map((i) => i.id);
    const [deviations, actions] = await Promise.all([
      this.prisma.deviation.findMany({
        where: { companyId: me.companyId, deletedAt: null, indicatorId: { in: indicatorIds }, OR: [{ periodRef }, { status: { notIn: CLOSED_DEVIATION_STATUSES } }] },
        select: { id: true, indicatorId: true, openedAt: true },
        orderBy: [{ severity: 'desc' }, { openedAt: 'desc' }],
      }),
      this.prisma.actionPlan.findMany({
        where: { companyId: me.companyId, deletedAt: null, indicatorId: { in: indicatorIds }, status: { notIn: CLOSED_ACTION_STATUSES } },
        select: { id: true, indicatorId: true, dueDate: true },
        orderBy: [{ createdAt: 'desc' }],
      }),
    ]);
    const primaryDeviation = new Map<string, string>();
    for (const d of deviations) if (d.indicatorId && !primaryDeviation.has(d.indicatorId)) primaryDeviation.set(d.indicatorId, d.id);
    const primaryAction = new Map<string, string>();
    for (const a of actions) if (a.indicatorId && !primaryAction.has(a.indicatorId)) primaryAction.set(a.indicatorId, a.id);

    let position = 0;
    for (const indicator of indicators) {
      const selectedAreaNode = nodeToArea.get(indicator.ownerNodeId);
      if (!selectedAreaNode) continue;
      const meetingAreaId = areaIdByNode.get(selectedAreaNode);
      if (!meetingAreaId) continue;
      const snap = this.computeSnapshot(indicator, periodRef);
      const isCritical = snap.light === TrafficLight.RED || snap.light === TrafficLight.YELLOW;
      const key = `${meetingAreaId}:${indicator.id}`;
      const prev = existingByKey.get(key);
      if (prev) {
        await this.prisma.monthlyMeetingIndicator.update({
          where: { id: prev.id },
          data: {
            ...snap,
            isCritical,
            // não sobrescreve vínculos manuais; preenche se ainda vazio
            deviationId: prev.deviationId ?? primaryDeviation.get(indicator.id) ?? null,
            actionPlanId: prev.actionPlanId ?? primaryAction.get(indicator.id) ?? null,
          },
        });
      } else {
        await this.prisma.monthlyMeetingIndicator.create({
          data: {
            meetingId,
            meetingAreaId,
            indicatorId: indicator.id,
            ...snap,
            isCritical,
            deviationId: primaryDeviation.get(indicator.id) ?? null,
            actionPlanId: primaryAction.get(indicator.id) ?? null,
            position: position++,
          },
        });
      }
    }
  }

  async seedArea(me: AuthPayload, areaId: string) {
    const area = await this.prisma.monthlyMeetingArea.findFirst({
      where: { id: areaId, meeting: { companyId: me.companyId, deletedAt: null } },
      include: { meeting: { select: { id: true, periodRef: true } } },
    });
    if (!area) throw new NotFoundException('Área da reunião não encontrada.');
    await this.seedSnapshots(me, area.meeting.id, [area.orgNodeId], area.meeting.periodRef);
    await this.prisma.monthlyMeetingArea.update({ where: { id: areaId }, data: { readiness: MonthlyAreaReadiness.IN_PROGRESS } });
    return this.meetingDetail(me, area.meeting.id);
  }

  async updateArea(me: AuthPayload, areaId: string, body: { readiness?: MonthlyAreaReadiness; areaKeyMessage?: string; presenterUserId?: string }) {
    const area = await this.prisma.monthlyMeetingArea.findFirst({
      where: { id: areaId, meeting: { companyId: me.companyId, deletedAt: null } },
      include: { meeting: { select: { id: true } }, indicators: { include: { indicator: { select: { responsibleUserId: true, name: true } } } } },
    });
    if (!area) throw new NotFoundException('Área da reunião não encontrada.');

    const data: any = {};
    if (body.areaKeyMessage !== undefined) data.areaKeyMessage = this.clean(body.areaKeyMessage);
    if (body.presenterUserId !== undefined) data.presenterUserId = this.clean(body.presenterUserId);

    if (body.readiness !== undefined) {
      const target = body.readiness;
      if (VALIDATED_READINESS.includes(target)) {
        const blocking = this.collectBlockingIssues(area.indicators);
        if (blocking.length) throw new BadRequestException(`Não é possível validar: ${blocking[0]} (e mais ${blocking.length - 1}).`.replace(' (e mais -1).', '.'));
        data.validatedById = me.sub;
        data.validatedAt = new Date();
      }
      data.readiness = target;
    }
    await this.prisma.monthlyMeetingArea.update({ where: { id: areaId }, data });
    return this.meetingDetail(me, area.meeting.id);
  }

  async updateMeetingIndicator(me: AuthPayload, snapshotId: string, body: any) {
    const snap = await this.prisma.monthlyMeetingIndicator.findFirst({
      where: { id: snapshotId, meeting: { companyId: me.companyId, deletedAt: null } },
      include: { meeting: { select: { id: true } } },
    });
    if (!snap) throw new NotFoundException('Indicador da reunião não encontrado.');
    const data: any = {};
    for (const key of ['managerComment', 'trendNote', 'executiveStatus'] as const) if (body[key] !== undefined) data[key] = this.clean(body[key]);
    for (const key of ['deviationId', 'actionPlanId'] as const) if (body[key] !== undefined) data[key] = this.clean(body[key]);
    if (body.showInPresentation !== undefined) data.showInPresentation = Boolean(body.showInPresentation);
    if (body.isCritical !== undefined) data.isCritical = Boolean(body.isCritical);
    if (body.financialImpact !== undefined) data.financialImpact = body.financialImpact === null || body.financialImpact === '' ? null : Number(body.financialImpact);
    await this.prisma.monthlyMeetingIndicator.update({ where: { id: snapshotId }, data });
    return this.meetingDetail(me, snap.meeting.id);
  }

  // =========================================================================
  // Agenda + condução
  // =========================================================================

  async updateAgendaItem(me: AuthPayload, itemId: string, body: any) {
    const item = await this.prisma.monthlyMeetingAgendaItem.findFirst({
      where: { id: itemId, meeting: { companyId: me.companyId, deletedAt: null } },
      include: { meeting: { select: { id: true } } },
    });
    if (!item) throw new NotFoundException('Item de agenda não encontrado.');
    const data: any = {};
    if (body.topic !== undefined) data.topic = String(body.topic).trim() || item.topic;
    if (body.plannedMinutes !== undefined) data.plannedMinutes = Math.max(0, Number(body.plannedMinutes) || 0);
    if (body.position !== undefined) data.position = Number(body.position) || item.position;
    if (body.presenterUserId !== undefined) data.presenterUserId = this.clean(body.presenterUserId);
    if (body.notes !== undefined) data.notes = this.clean(body.notes);
    await this.prisma.monthlyMeetingAgendaItem.update({ where: { id: itemId }, data });
    return this.meetingDetail(me, item.meeting.id);
  }

  // Reordena o roteiro (drag-and-drop): posição = índice na lista enviada.
  async reorderAgenda(me: AuthPayload, meetingId: string, orderedIds: string[]) {
    const meeting = await this.prisma.monthlyMeeting.findFirst({
      where: { id: meetingId, companyId: me.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!meeting) throw new NotFoundException('Reunião não encontrada.');
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.monthlyMeetingAgendaItem.updateMany({ where: { id, meetingId }, data: { position: index + 1 } }),
      ),
    );
    return this.meetingDetail(me, meetingId);
  }

  async agendaTimer(me: AuthPayload, itemId: string, body: { action: 'start' | 'stop' | 'discussed' | 'skip' }) {
    const item = await this.prisma.monthlyMeetingAgendaItem.findFirst({
      where: { id: itemId, meeting: { companyId: me.companyId, deletedAt: null } },
      include: { meeting: { select: { id: true } } },
    });
    if (!item) throw new NotFoundException('Item de agenda não encontrado.');
    const now = new Date();
    const data: any = {};
    if (body.action === 'start') {
      data.startedAt = now;
      data.endedAt = null;
      data.presentationStatus = MonthlyPresentationStatus.PRESENTING;
    } else if (body.action === 'stop' || body.action === 'discussed') {
      data.endedAt = now;
      data.presentationStatus = MonthlyPresentationStatus.DISCUSSED;
      if (item.startedAt) data.actualMinutes = Math.max(1, Math.round((now.getTime() - item.startedAt.getTime()) / 60000));
    } else if (body.action === 'skip') {
      data.presentationStatus = MonthlyPresentationStatus.SKIPPED;
    }
    await this.prisma.monthlyMeetingAgendaItem.update({ where: { id: itemId }, data });
    return this.meetingDetail(me, item.meeting.id);
  }

  // =========================================================================
  // Decisões / Riscos / Escalonamentos
  // =========================================================================

  async addDecision(
    me: AuthPayload,
    id: string,
    body: {
      kind?: MonthlyEntryKind;
      topic?: string;
      description: string;
      orgNodeId?: string;
      ownerUserId?: string;
      ownerName?: string;
      dueDate?: string;
      impactIfNotDecided?: string;
      boardInvolved?: string;
      createAction?: boolean;
    },
  ) {
    await this.assertMeeting(me, id);
    const description = String(body.description ?? '').trim();
    if (!description) throw new BadRequestException('Informe a decisão, risco ou escalonamento.');

    let actionPlanId: string | null = null;
    if (body.createAction) {
      const action = await this.actions.create(
        {
          companyId: me.companyId,
          ownerNodeId: this.clean(body.orgNodeId),
          title: this.truncate(description, 120),
          description,
          origin: ActionOrigin.MEETING,
          priority: ActionPriority.HIGH,
          status: ActionStatus.NOT_STARTED,
          responsibleUserId: this.clean(body.ownerUserId),
          dueDate: this.parseOptionalDate(body.dueDate),
        },
        me.sub,
      );
      actionPlanId = action.id;
    }

    await this.prisma.monthlyMeetingDecision.create({
      data: {
        meetingId: id,
        kind: body.kind ?? MonthlyEntryKind.DECISION,
        topic: this.clean(body.topic),
        description,
        orgNodeId: this.clean(body.orgNodeId),
        ownerUserId: this.clean(body.ownerUserId),
        ownerName: this.clean(body.ownerName),
        dueDate: this.parseOptionalDate(body.dueDate),
        impactIfNotDecided: this.clean(body.impactIfNotDecided),
        boardInvolved: this.clean(body.boardInvolved),
        actionPlanId,
        createdById: me.sub,
      },
    });
    return this.meetingDetail(me, id);
  }

  async updateDecision(me: AuthPayload, decisionId: string, body: any) {
    const decision = await this.prisma.monthlyMeetingDecision.findFirst({
      where: { id: decisionId, meeting: { companyId: me.companyId, deletedAt: null } },
      include: { meeting: { select: { id: true } } },
    });
    if (!decision) throw new NotFoundException('Registro não encontrado.');
    const data: any = {};
    for (const key of ['topic', 'description', 'ownerName', 'impactIfNotDecided', 'boardInvolved'] as const) if (body[key] !== undefined) data[key] = this.clean(body[key]);
    if (body.ownerUserId !== undefined) data.ownerUserId = this.clean(body.ownerUserId);
    if (body.orgNodeId !== undefined) data.orgNodeId = this.clean(body.orgNodeId);
    if (body.kind !== undefined) data.kind = body.kind;
    if (body.status !== undefined) data.status = body.status;
    if (body.dueDate !== undefined) data.dueDate = this.parseOptionalDate(body.dueDate);
    await this.prisma.monthlyMeetingDecision.update({ where: { id: decisionId }, data });
    return this.meetingDetail(me, decision.meeting.id);
  }

  async deleteDecision(me: AuthPayload, decisionId: string) {
    const decision = await this.prisma.monthlyMeetingDecision.findFirst({
      where: { id: decisionId, meeting: { companyId: me.companyId, deletedAt: null } },
      include: { meeting: { select: { id: true } } },
    });
    if (!decision) throw new NotFoundException('Registro não encontrado.');
    await this.prisma.monthlyMeetingDecision.delete({ where: { id: decisionId } });
    return this.meetingDetail(me, decision.meeting.id);
  }

  // =========================================================================
  // Ações vinculadas (reuso do módulo Planos de Ação)
  // =========================================================================

  async createAction(
    me: AuthPayload,
    id: string,
    body: { title: string; description?: string; orgNodeId?: string; indicatorId?: string; deviationId?: string; snapshotId?: string; responsibleUserId?: string; dueDate?: string; priority?: ActionPriority; expectedResult?: string },
  ) {
    await this.assertMeeting(me, id);
    const title = String(body.title ?? '').trim();
    if (!title) throw new BadRequestException('Informe o título da ação.');
    const action = await this.actions.create(
      {
        companyId: me.companyId,
        ownerNodeId: this.clean(body.orgNodeId),
        indicatorId: this.clean(body.indicatorId),
        deviationId: this.clean(body.deviationId),
        title,
        description: this.clean(body.description),
        origin: ActionOrigin.MEETING,
        priority: body.priority ?? ActionPriority.HIGH,
        status: ActionStatus.NOT_STARTED,
        responsibleUserId: this.clean(body.responsibleUserId),
        dueDate: this.parseOptionalDate(body.dueDate),
        expectedResult: this.clean(body.expectedResult),
      },
      me.sub,
    );
    if (body.snapshotId) {
      await this.prisma.monthlyMeetingIndicator.updateMany({
        where: { id: body.snapshotId, meetingId: id },
        data: { actionPlanId: action.id, ...(body.deviationId ? { deviationId: this.clean(body.deviationId) } : {}) },
      });
    }
    return this.meetingDetail(me, id);
  }

  // =========================================================================
  // Follow-up / Aprendizado / Padronização / Checklist (CRUD simples)
  // =========================================================================

  async addFollowUp(me: AuthPayload, id: string, body: any) {
    await this.assertMeeting(me, id);
    const title = String(body.title ?? '').trim();
    if (!title) throw new BadRequestException('Informe o item de acompanhamento.');
    await this.prisma.monthlyMeetingFollowUp.create({
      data: {
        meetingId: id,
        level: body.level ?? MonthlyFollowUpLevel.WEEKLY,
        title,
        dueDate: this.parseOptionalDate(body.dueDate),
        ownerUserId: this.clean(body.ownerUserId),
        indicatorId: this.clean(body.indicatorId),
        actionPlanId: this.clean(body.actionPlanId),
        notes: this.clean(body.notes),
      },
    });
    return this.meetingDetail(me, id);
  }

  async updateFollowUp(me: AuthPayload, itemId: string, body: any) {
    const item = await this.prisma.monthlyMeetingFollowUp.findFirst({ where: { id: itemId, meeting: { companyId: me.companyId, deletedAt: null } }, include: { meeting: { select: { id: true } } } });
    if (!item) throw new NotFoundException('Item não encontrado.');
    const data: any = {};
    if (body.title !== undefined) data.title = String(body.title).trim() || item.title;
    if (body.level !== undefined) data.level = body.level;
    if (body.status !== undefined) data.status = body.status;
    if (body.dueDate !== undefined) data.dueDate = this.parseOptionalDate(body.dueDate);
    if (body.ownerUserId !== undefined) data.ownerUserId = this.clean(body.ownerUserId);
    if (body.notes !== undefined) data.notes = this.clean(body.notes);
    await this.prisma.monthlyMeetingFollowUp.update({ where: { id: itemId }, data });
    return this.meetingDetail(me, item.meeting.id);
  }

  async deleteFollowUp(me: AuthPayload, itemId: string) {
    const item = await this.prisma.monthlyMeetingFollowUp.findFirst({ where: { id: itemId, meeting: { companyId: me.companyId, deletedAt: null } }, include: { meeting: { select: { id: true } } } });
    if (!item) throw new NotFoundException('Item não encontrado.');
    await this.prisma.monthlyMeetingFollowUp.delete({ where: { id: itemId } });
    return this.meetingDetail(me, item.meeting.id);
  }

  async addLearning(me: AuthPayload, id: string, body: any) {
    await this.assertMeeting(me, id);
    const learning = String(body.learning ?? '').trim();
    if (!learning) throw new BadRequestException('Descreva o aprendizado.');
    await this.prisma.monthlyMeetingLearning.create({
      data: {
        meetingId: id,
        orgNodeId: this.clean(body.orgNodeId),
        indicatorId: this.clean(body.indicatorId),
        learning,
        treatedCause: this.clean(body.treatedCause),
        effectiveAction: this.clean(body.effectiveAction),
        replicateToNodeId: this.clean(body.replicateToNodeId),
        ownerUserId: this.clean(body.ownerUserId),
        dueDate: this.parseOptionalDate(body.dueDate),
      },
    });
    return this.meetingDetail(me, id);
  }

  async updateLearning(me: AuthPayload, itemId: string, body: any) {
    const item = await this.prisma.monthlyMeetingLearning.findFirst({ where: { id: itemId, meeting: { companyId: me.companyId, deletedAt: null } }, include: { meeting: { select: { id: true } } } });
    if (!item) throw new NotFoundException('Item não encontrado.');
    const data: any = {};
    for (const key of ['learning', 'treatedCause', 'effectiveAction'] as const) if (body[key] !== undefined) data[key] = this.clean(body[key]);
    if (body.status !== undefined) data.status = body.status;
    if (body.replicateToNodeId !== undefined) data.replicateToNodeId = this.clean(body.replicateToNodeId);
    if (body.ownerUserId !== undefined) data.ownerUserId = this.clean(body.ownerUserId);
    if (body.dueDate !== undefined) data.dueDate = this.parseOptionalDate(body.dueDate);
    await this.prisma.monthlyMeetingLearning.update({ where: { id: itemId }, data });
    return this.meetingDetail(me, item.meeting.id);
  }

  async deleteLearning(me: AuthPayload, itemId: string) {
    const item = await this.prisma.monthlyMeetingLearning.findFirst({ where: { id: itemId, meeting: { companyId: me.companyId, deletedAt: null } }, include: { meeting: { select: { id: true } } } });
    if (!item) throw new NotFoundException('Item não encontrado.');
    await this.prisma.monthlyMeetingLearning.delete({ where: { id: itemId } });
    return this.meetingDetail(me, item.meeting.id);
  }

  async addStandardization(me: AuthPayload, id: string, body: any) {
    await this.assertMeeting(me, id);
    const description = String(body.description ?? '').trim();
    if (!description) throw new BadRequestException('Descreva a padronização.');
    await this.prisma.monthlyMeetingStandardization.create({
      data: {
        meetingId: id,
        type: body.type ?? MonthlyStandardizationType.POP,
        description,
        sourceNodeId: this.clean(body.sourceNodeId),
        indicatorId: this.clean(body.indicatorId),
        documentId: this.clean(body.documentId),
        ownerUserId: this.clean(body.ownerUserId),
        dueDate: this.parseOptionalDate(body.dueDate),
      },
    });
    return this.meetingDetail(me, id);
  }

  async updateStandardization(me: AuthPayload, itemId: string, body: any) {
    const item = await this.prisma.monthlyMeetingStandardization.findFirst({ where: { id: itemId, meeting: { companyId: me.companyId, deletedAt: null } }, include: { meeting: { select: { id: true } } } });
    if (!item) throw new NotFoundException('Item não encontrado.');
    const data: any = {};
    if (body.description !== undefined) data.description = this.clean(body.description);
    if (body.type !== undefined) data.type = body.type;
    if (body.status !== undefined) data.status = body.status;
    if (body.ownerUserId !== undefined) data.ownerUserId = this.clean(body.ownerUserId);
    if (body.dueDate !== undefined) data.dueDate = this.parseOptionalDate(body.dueDate);
    await this.prisma.monthlyMeetingStandardization.update({ where: { id: itemId }, data });
    return this.meetingDetail(me, item.meeting.id);
  }

  async deleteStandardization(me: AuthPayload, itemId: string) {
    const item = await this.prisma.monthlyMeetingStandardization.findFirst({ where: { id: itemId, meeting: { companyId: me.companyId, deletedAt: null } }, include: { meeting: { select: { id: true } } } });
    if (!item) throw new NotFoundException('Item não encontrado.');
    await this.prisma.monthlyMeetingStandardization.delete({ where: { id: itemId } });
    return this.meetingDetail(me, item.meeting.id);
  }

  async toggleChecklist(me: AuthPayload, itemId: string, body: { done?: boolean }) {
    const item = await this.prisma.monthlyMeetingChecklistItem.findFirst({ where: { id: itemId, meeting: { companyId: me.companyId, deletedAt: null } }, include: { meeting: { select: { id: true } } } });
    if (!item) throw new NotFoundException('Item não encontrado.');
    await this.prisma.monthlyMeetingChecklistItem.update({ where: { id: itemId }, data: { done: body.done ?? !item.done } });
    return this.meetingDetail(me, item.meeting.id);
  }

  // =========================================================================
  // IA (reuso GeminiService) — sempre como sugestão
  // =========================================================================

  async generateKeyMessage(me: AuthPayload, id: string) {
    const detail = await this.meetingDetail(me, id);
    const critical = detail.areas
      .flatMap((a: any) => a.indicators)
      .filter((i: any) => i.light === 'RED' || i.light === 'YELLOW')
      .slice(0, 10)
      .map((i: any) => ({ indicador: i.name, area: i.area, farol: i.light, resultado: i.current, meta: i.target, causa: i.rootCause, acao: i.actionTitle }));
    const prompt = [
      'Você apoia uma reunião mensal de resultados no Gestão 360.',
      'Gere uma mensagem-chave em português, objetiva, com 2 ou 3 linhas (resultado geral, maior risco e principal decisão).',
      'Escreva como sugestão executiva; não substitua a validação do gestor.',
      `Período: ${detail.periodRef}`,
      `Farol: verde=${detail.summary.lights.GREEN + detail.summary.lights.BLUE}, amarelo=${detail.summary.lights.YELLOW}, vermelho=${detail.summary.lights.RED}, cinza=${detail.summary.lights.GRAY}`,
      `Indicadores críticos: ${JSON.stringify(critical)}`,
    ].join('\n');
    const text = await this.ai.generateText(prompt, { temperature: 0.25, maxOutputTokens: 320 });
    const message = text?.trim() || detail.keyMessage || 'Sem dados suficientes para sugerir a mensagem-chave.';
    await this.prisma.monthlyMeeting.update({ where: { id }, data: { keyMessage: message } });
    return { provider: this.ai.provider, model: this.ai.modelName, message };
  }

  async generateMinutes(me: AuthPayload, id: string) {
    const detail = await this.meetingDetail(me, id);
    const payload = {
      titulo: detail.title,
      periodo: detail.periodRef,
      areas: detail.areas.map((a: any) => ({ area: a.name, prontidao: a.readinessLabel, vermelho: a.red, amarelo: a.yellow })),
      decisoes: detail.decisions.map((d: any) => ({ tipo: d.kind, tema: d.topic, registro: d.description, responsavel: d.owner, prazo: d.dueDate })),
      criticos: detail.areas.flatMap((a: any) => a.indicators).filter((i: any) => i.light === 'RED' || i.light === 'YELLOW').slice(0, 12).map((i: any) => ({ indicador: i.name, area: i.area, farol: i.light, causa: i.rootCause, acao: i.actionTitle })),
    };
    const prompt = [
      'Gere a ata da reunião mensal de resultados em português, em tópicos claros e objetivos.',
      'Inclua: indicadores críticos discutidos, causas, decisões/riscos/escalonamentos, responsáveis, prazos e pendências para a próxima reunião.',
      'Não invente dados além dos fornecidos.',
      JSON.stringify(payload),
    ].join('\n');
    const text = await this.ai.generateText(prompt, { temperature: 0.2, maxOutputTokens: 900 });
    return { provider: this.ai.provider, model: this.ai.modelName, minutes: text?.trim() || 'IA indisponível — gere a ata a partir dos registros da reunião.' };
  }

  async generateExecutiveSummary(me: AuthPayload, id: string) {
    const detail = await this.meetingDetail(me, id);
    const prompt = [
      'Gere um resumo executivo (até 6 linhas) da reunião mensal para a diretoria, em português.',
      'Destaque resultado consolidado, principais riscos, decisões necessárias e ações prioritárias.',
      `Período ${detail.periodRef}. Farol: ${JSON.stringify(detail.summary.lights)}. Decisões abertas: ${detail.summary.openDecisions}.`,
    ].join('\n');
    const text = await this.ai.generateText(prompt, { temperature: 0.25, maxOutputTokens: 420 });
    return { provider: this.ai.provider, model: this.ai.modelName, summary: text?.trim() || 'IA indisponível.' };
  }

  // =========================================================================
  // Helpers de derivação (engine reaproveitada)
  // =========================================================================

  private async deriveCards(me: AuthPayload, periodRef: string, areaFilter: string[] | null) {
    const indicators = await this.loadIndicatorsForAreas(me.companyId, areaFilter ? areaFilter : null, periodRef);
    const indicatorIds = indicators.map((i) => i.id);
    const deviations = indicatorIds.length
      ? await this.prisma.deviation.findMany({
          where: { companyId: me.companyId, deletedAt: null, indicatorId: { in: indicatorIds }, OR: [{ periodRef }, { status: { notIn: CLOSED_DEVIATION_STATUSES } }] },
          select: {
            id: true,
            number: true,
            indicatorId: true,
            periodRef: true,
            title: true,
            severity: true,
            status: true,
            fact: true,
            rootCause: true,
            impact: true,
            responsibleUser: { select: { id: true, name: true } },
            causes: { select: { id: true, category: true, description: true, weight: true } },
            analyses: { select: { id: true, method: true, content: true } },
          },
          orderBy: [{ severity: 'desc' }, { openedAt: 'desc' }],
        })
      : [];
    const deviationIds = deviations.map((d) => d.id);
    const actions =
      indicatorIds.length || deviationIds.length
        ? await this.prisma.actionPlan.findMany({
            where: {
              companyId: me.companyId,
              deletedAt: null,
              OR: [...(indicatorIds.length ? [{ indicatorId: { in: indicatorIds } }] : []), ...(deviationIds.length ? [{ deviationId: { in: deviationIds } }] : [])],
            },
            select: { id: true, title: true, description: true, indicatorId: true, deviationId: true, priority: true, status: true, dueDate: true, responsibleUser: { select: { id: true, name: true } } },
            orderBy: [{ dueDate: 'asc' }],
            take: 800,
          })
        : [];
    const cards = this.buildIndicatorCards(periodRef, indicators, deviations, actions);
    return { cards, actions };
  }

  private buildIndicatorCards(periodRef: string, indicators: any[], deviations: any[], actions: any[]) {
    const devByIndicator = this.groupBy(deviations, (d) => d.indicatorId);
    const actByIndicator = this.groupBy(actions.filter((a) => a.indicatorId), (a) => a.indicatorId);
    const actByDeviation = this.groupBy(actions.filter((a) => a.deviationId), (a) => a.deviationId);
    const now = new Date();

    return indicators.map((indicator) => {
      const snap = this.computeSnapshot(indicator, periodRef);
      const indicatorDeviations = devByIndicator.get(indicator.id) ?? [];
      const deviationActions = indicatorDeviations.flatMap((d: any) => actByDeviation.get(d.id) ?? []);
      const indicatorActions = [...(actByIndicator.get(indicator.id) ?? []), ...deviationActions];
      const primaryDeviation = indicatorDeviations[0] ?? null;
      const hasCause = indicatorDeviations.some((d: any) => d.rootCause || d.causes?.length || d.analyses?.length);
      const hasActionPlan = indicatorActions.length > 0;
      const hasOverdueAction = indicatorActions.some((a: any) => a.dueDate && a.dueDate < now && !CLOSED_ACTION_STATUSES.includes(a.status));
      const rootCause = primaryDeviation?.rootCause ?? primaryDeviation?.causes?.[0]?.description ?? null;
      const firstAction = indicatorActions.find((a: any) => !CLOSED_ACTION_STATUSES.includes(a.status)) ?? indicatorActions[0] ?? null;
      const validationIssues: string[] = [];
      if (snap.current === null) validationIssues.push('Sem resultado oficial no mês de referência.');
      if (snap.light === TrafficLight.RED) {
        if (!hasCause) validationIssues.push('Indicador vermelho sem causa raiz.');
        if (!hasActionPlan) validationIssues.push('Indicador vermelho sem plano de ação.');
        if (!indicator.responsibleUserId) validationIssues.push('Indicador crítico sem responsável.');
      }
      if (snap.light === TrafficLight.YELLOW && !snap.trend) validationIssues.push('Indicador em atenção sem comentário de tendência.');
      if (hasOverdueAction) validationIssues.push('Possui ação em atraso.');

      return {
        id: indicator.id,
        indicatorId: indicator.id,
        name: indicator.name,
        code: indicator.code,
        unit: indicator.unit,
        unitLabel: this.unitLabel(indicator.unit, indicator.unitLabel),
        area: indicator.ownerNode?.name ?? '-',
        areaId: indicator.ownerNode?.id ?? indicator.ownerNodeId,
        responsible: indicator.responsibleUser ? { id: indicator.responsibleUser.id, name: indicator.responsibleUser.name } : null,
        target: snap.target,
        current: snap.current,
        accumulated: snap.accumulated,
        attainment: snap.attainment,
        deviationPct: snap.deviationPct,
        light: snap.light as TrafficLight | 'BLUE',
        trend: snap.trend ?? 'Sem histórico',
        hasCause,
        hasActionPlan,
        hasOverdueAction,
        rootCause,
        actionTitle: firstAction ? firstAction.title : null,
        validationIssues,
        primaryDeviation,
        links: {
          indicator: `/indicators/${indicator.id}`,
          deviation: primaryDeviation ? `/deviations/${primaryDeviation.id}` : null,
          action: firstAction ? `/actions/${firstAction.id}` : null,
        },
      };
    });
  }

  private buildAreaSummaries(areas: any[], cards: any[]) {
    const byArea = this.groupBy(cards, (c) => c.areaId);
    // Também agrupa por ancestral: associa cada card à área raiz selecionada via ownerNode tree não disponível aqui,
    // então soma por areaId direto; áreas-pai sem indicadores diretos aparecem com zero.
    return areas.map((area) => {
      const areaCards = byArea.get(area.id) ?? [];
      const counts = this.countLights(areaCards);
      const validationIssues = areaCards.flatMap((c: any) => c.validationIssues.map((issue: string) => ({ indicatorId: c.id, indicator: c.name, issue })));
      return {
        id: area.id,
        name: area.name,
        type: area.type,
        responsible: area.responsibleUser ?? null,
        totalIndicators: areaCards.length,
        green: counts.GREEN + counts.BLUE,
        yellow: counts.YELLOW,
        red: counts.RED,
        gray: counts.GRAY,
        overdueActions: areaCards.filter((c: any) => c.hasOverdueAction).length,
        readiness: this.deriveReadinessLabel(areaCards, validationIssues.length),
        validationIssues,
      };
    });
  }

  private shapeSnapshot(ind: any, actionMap: Map<string, any>, deviationMap: Map<string, any>) {
    const light = ind.light as TrafficLight;
    const blockingIssues: string[] = [];
    const validationIssues: string[] = [];
    const hasCause = Boolean(ind.deviationId);
    const hasResponsible = Boolean(ind.indicator?.responsibleUserId);
    const linkedAction = ind.actionPlanId ? actionMap.get(ind.actionPlanId) ?? null : null;
    const linkedDeviation = ind.deviationId ? deviationMap.get(ind.deviationId) ?? null : null;
    // Prontidão: o gestor pode validar quando há um plano de ação EM EXECUÇÃO (análise concluída e
    // ações em andamento) — não é necessário que as ações estejam concluídas. Causa raiz/responsável
    // ausentes viram apenas avisos (não bloqueiam a validação).
    const actionInExecution = Boolean(linkedAction) && !ACTION_NOT_EXECUTING.has(String(linkedAction.status ?? ''));
    if (ind.current === null) validationIssues.push('Sem resultado oficial no mês.');
    if (light === TrafficLight.RED) {
      if (!actionInExecution) blockingIssues.push('Vermelho sem plano de ação em execução.');
      if (!hasCause) validationIssues.push('Vermelho sem causa raiz vinculada.');
      if (!hasResponsible) validationIssues.push('Crítico sem responsável.');
    }
    if (light === TrafficLight.YELLOW && !ind.managerComment && !ind.trendNote) validationIssues.push('Atenção sem comentário de tendência.');
    validationIssues.push(...blockingIssues);
    return {
      id: ind.id,
      indicatorId: ind.indicatorId,
      name: ind.indicator?.name ?? '-',
      code: ind.indicator?.code ?? null,
      unit: ind.indicator?.unit ?? null,
      unitLabel: this.unitLabel(ind.indicator?.unit ?? 'CUSTOM', ind.indicator?.unitLabel),
      source: ind.indicator?.source ?? null,
      area: undefined as string | undefined,
      target: ind.target,
      lowerBound: ind.lowerBound,
      upperBound: ind.upperBound,
      current: ind.current,
      accumulated: ind.accumulated,
      attainment: ind.attainment,
      deviationPct: ind.deviationPct,
      light: this.displayLight(light, ind.attainment),
      trend: ind.trend,
      managerComment: ind.managerComment,
      trendNote: ind.trendNote,
      executiveStatus: ind.executiveStatus ?? this.executiveStatus(this.displayLight(light, ind.attainment), validationIssues),
      showInPresentation: ind.showInPresentation,
      isCritical: ind.isCritical,
      financialImpact: ind.financialImpact,
      responsibleUserId: ind.indicator?.responsibleUserId ?? null,
      deviationId: ind.deviationId,
      actionPlanId: ind.actionPlanId,
      rootCause: linkedDeviation?.rootCause ?? null,
      actionTitle: linkedAction?.title ?? null,
      linkedAction,
      linkedDeviation,
      validationIssues,
      blockingIssues,
      links: {
        indicator: `/indicators/${ind.indicatorId}`,
        deviation: ind.deviationId ? `/deviations/${ind.deviationId}` : null,
        action: ind.actionPlanId ? `/actions/${ind.actionPlanId}` : null,
      },
    };
  }

  private collectBlockingIssues(indicators: any[]): string[] {
    const issues: string[] = [];
    for (const ind of indicators) {
      const light = ind.light as TrafficLight;
      const name = ind.indicator?.name ?? 'Indicador';
      if (light === TrafficLight.RED) {
        if (!ind.deviationId) issues.push(`${name}: vermelho sem causa raiz`);
        if (!ind.actionPlanId) issues.push(`${name}: vermelho sem plano de ação`);
        if (!ind.indicator?.responsibleUserId) issues.push(`${name}: crítico sem responsável`);
      }
    }
    return issues;
  }

  private computeSnapshot(indicator: any, periodRef: string) {
    const target = indicator.targets?.[0] ?? null;
    const results = [...(indicator.results ?? [])].sort((a: any, b: any) => new Date(b.periodDate).getTime() - new Date(a.periodDate).getTime());
    const currentResult = results.find((r: any) => r.periodRef === periodRef) ?? null;
    const current = currentResult ?? results[0] ?? null;
    const previous = results.find((r: any) => r.periodRef !== current?.periodRef) ?? null;
    const light = this.displayLight((current?.light as TrafficLight) ?? TrafficLight.GRAY, current?.attainment);
    return {
      target: target?.target ?? null,
      lowerBound: target?.lowerBound ?? null,
      upperBound: target?.upperBound ?? null,
      current: currentResult?.value ?? null,
      accumulated: current?.value ?? null,
      attainment: current?.attainment ?? null,
      deviationPct: current?.deviationPct ?? null,
      light: (light === 'BLUE' ? TrafficLight.GREEN : light) as TrafficLight,
      trend: this.trendLabel(current, previous),
    };
  }

  private async loadIndicatorsForAreas(companyId: string, areaIds: string[] | null, periodRef: string) {
    return this.prisma.indicator.findMany({
      where: { companyId, deletedAt: null, status: 'ACTIVE', type: 'STRATEGIC', ...(areaIds ? { ownerNodeId: { in: areaIds } } : {}) },
      select: {
        id: true,
        name: true,
        code: true,
        unit: true,
        unitLabel: true,
        source: true,
        ownerNodeId: true,
        ownerNode: { select: { id: true, name: true, type: true, parentId: true } },
        responsibleUserId: true,
        responsibleUser: { select: { id: true, name: true } },
        targets: { where: { periodRef }, select: { target: true, lowerBound: true, upperBound: true }, take: 1 },
        results: { orderBy: { periodDate: 'desc' }, take: 6, select: { periodRef: true, periodDate: true, value: true, light: true, attainment: true, deviationPct: true, note: true, updatedAt: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  // Mapeia cada nodeId (área + descendentes) para a área SELECIONADA mais profunda que o contém.
  private async mapNodesToAreas(companyId: string, selectedAreaIds: string[]) {
    const map = new Map<string, string>();
    for (const areaId of selectedAreaIds) {
      const nodes = await this.access.expandWithDescendants(companyId, [areaId]);
      for (const nodeId of nodes) {
        // áreas mais profundas (que vêm depois) sobrescrevem as rasas em caso de aninhamento
        map.set(nodeId, areaId);
      }
    }
    return map;
  }

  // =========================================================================
  // Utilitários
  // =========================================================================

  private async assertMeeting(me: AuthPayload, id: string) {
    const meeting = await this.prisma.monthlyMeeting.findFirst({ where: { id, companyId: me.companyId, deletedAt: null }, select: { id: true, title: true, responsibleUserId: true, followUpUserId: true } });
    if (!meeting) throw new NotFoundException('Reunião mensal não encontrada.');
    return meeting;
  }

  private buildAgendaForAreas(areas: Array<{ id: string; name: string; responsibleUserId?: string | null }>) {
    const result: Array<{ topic: string; orgNodeId: string | null; plannedMinutes: number; presenterUserId: string | null }> = [];
    result.push({ topic: 'Abertura e direcionadores', orgNodeId: null, plannedMinutes: 10, presenterUserId: null });
    for (const area of areas) {
      result.push({ topic: area.name, orgNodeId: area.id, plannedMinutes: 45, presenterUserId: area.responsibleUserId ?? null });
    }
    result.push({ topic: 'Decisões e escalonamentos', orgNodeId: null, plannedMinutes: 15, presenterUserId: null });
    result.push({ topic: 'Encerramento', orgNodeId: null, plannedMinutes: 10, presenterUserId: null });
    return result;
  }

  private summarizeReadiness(areas: Array<{ readiness: MonthlyAreaReadiness }>) {
    const total = areas.length;
    const ready = areas.filter((a) => VALIDATED_READINESS.includes(a.readiness)).length;
    const issues = areas.filter((a) => a.readiness === MonthlyAreaReadiness.WITH_ISSUES).length;
    return { total, ready, issues };
  }

  private countLights(cards: Array<{ light: TrafficLight | 'BLUE' }>) {
    return cards.reduce(
      (acc, card) => {
        acc[card.light] = (acc[card.light] ?? 0) + 1;
        return acc;
      },
      { GREEN: 0, YELLOW: 0, RED: 0, GRAY: 0, BLUE: 0 } as Record<TrafficLight | 'BLUE', number>,
    );
  }

  private buildFallbackKeyMessage(cards: any[], actions: any[]) {
    const counts = this.countLights(cards);
    const overdue = actions.filter((a) => a.dueDate && a.dueDate < new Date() && !CLOSED_ACTION_STATUSES.includes(a.status)).length;
    const worst = cards.find((c) => c.light === 'RED') ?? cards.find((c) => c.light === 'YELLOW');
    if (!cards.length) return 'Sem indicadores para consolidar a mensagem-chave deste mês.';
    return [
      `O mês fecha com ${counts.GREEN + counts.BLUE} indicadores dentro da meta, ${counts.YELLOW} em atenção e ${counts.RED} fora da meta.`,
      worst ? `Maior risco: ${worst.name} (${worst.area})${worst.rootCause ? `, causa: ${worst.rootCause}` : ', causa raiz a validar'}.` : 'Sem indicador crítico no recorte atual.',
      overdue > 0 ? `Decisão: destravar ${overdue} ação(ões) em atraso e confirmar responsáveis.` : 'Decisão: validar prioridades e manter o acompanhamento semanal.',
    ].join('\n');
  }

  private async resolveAreaScope(me: AuthPayload, selectedAreaIds: string[]) {
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const expandedSelected = selectedAreaIds.length ? await this.access.expandWithDescendants(me.companyId, selectedAreaIds) : null;
    let areaFilter = expandedSelected ?? permitted;
    if (expandedSelected && permitted) {
      const allowed = new Set(permitted);
      areaFilter = expandedSelected.filter((id) => allowed.has(id));
    }
    return { selectedAreaIds, areaFilter };
  }

  private parsePeriodRef(value?: string | null) {
    const fallback = this.currentPeriodRef();
    if (!value) return fallback;
    const clean = String(value).trim();
    if (!/^\d{4}-\d{2}$/.test(clean)) throw new BadRequestException('Mês de referência inválido. Use AAAA-MM.');
    const month = Number(clean.slice(5, 7));
    if (month < 1 || month > 12) throw new BadRequestException('Mês de referência inválido.');
    return clean;
  }

  private parseAreaIds(value?: string | string[] | null) {
    if (!value) return [];
    const raw = Array.isArray(value) ? value : String(value).split(',');
    return Array.from(new Set(raw.map((id) => String(id).trim()).filter(Boolean)));
  }

  private currentPeriodRef() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private monthWindow(periodRef: string) {
    const [year, month] = periodRef.split('-').map(Number);
    return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
  }

  private parseRequiredDate(value: string | undefined, message: string) {
    const date = this.parseOptionalDate(value);
    if (!date) throw new BadRequestException(message);
    return date;
  }

  private parseOptionalDate(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Data inválida.');
    return date;
  }

  private clean(value?: string | null) {
    const clean = String(value ?? '').trim();
    return clean || null;
  }

  private truncate(value: string, max: number) {
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }

  private unitLabel(unit: string, custom?: string | null) {
    if (custom?.trim()) return custom.trim();
    const labels: Record<string, string> = {
      PERCENT: '%',
      CURRENCY: 'R$',
      QUANTITY: 'quantidade',
      HOURS: 'horas',
      DAYS: 'dias',
      TONS: 'toneladas',
      LITERS: 'litros',
      INDEX: 'índice',
      TEXT: 'texto',
      CUSTOM: 'personalizado',
    };
    return labels[unit] ?? unit.toLowerCase();
  }

  private displayLight(light: TrafficLight, attainment?: number | null): TrafficLight | 'BLUE' {
    if (light === TrafficLight.GREEN && attainment !== null && attainment !== undefined && attainment >= 1.1) return 'BLUE';
    return light;
  }

  private executiveStatus(light: TrafficLight | 'BLUE', issues: string[]) {
    if (issues.length) return 'Exige providência';
    switch (light) {
      case 'BLUE':
        return 'Superou a meta';
      case TrafficLight.GREEN:
        return 'Dentro da meta';
      case TrafficLight.YELLOW:
        return 'Risco mensal';
      case TrafficLight.RED:
        return 'Fora da rota';
      default:
        return 'Sem atualização';
    }
  }

  private trendLabel(current: any | null, previous: any | null): string | null {
    if (!current || !previous) return null;
    const delta = Number(current.value) - Number(previous.value);
    if (Math.abs(delta) < 0.0001) return 'Estável';
    return delta > 0 ? 'Alta' : 'Baixa';
  }

  private lightWeight(light: TrafficLight | 'BLUE') {
    const weights: Record<TrafficLight | 'BLUE', number> = { RED: 5, YELLOW: 4, GRAY: 3, GREEN: 2, BLUE: 1 };
    return weights[light] ?? 0;
  }

  private deriveReadinessLabel(cards: any[], issueCount: number) {
    if (!cards.length) return 'Não iniciada';
    if (issueCount > 0) return 'Com pendências';
    if (cards.some((c) => c.light === 'GRAY')) return 'Em preenchimento';
    if (cards.some((c) => c.light === 'RED' || c.light === 'YELLOW')) return 'Pronta para validação';
    return 'Liberada para reunião';
  }

  private readinessLabel(readiness: MonthlyAreaReadiness) {
    const labels: Record<MonthlyAreaReadiness, string> = {
      NOT_STARTED: 'Não iniciada',
      IN_PROGRESS: 'Em preenchimento',
      WITH_ISSUES: 'Com pendências',
      READY_FOR_VALIDATION: 'Pronta para validação',
      VALIDATED: 'Validada pelo gestor',
      RELEASED: 'Liberada para reunião',
    };
    return labels[readiness];
  }

  private statusLabel(status: MonthlyMeetingStatus) {
    const labels: Record<MonthlyMeetingStatus, string> = {
      PREPARING: 'Em preparação',
      READY: 'Pronta para apresentação',
      IN_PROGRESS: 'Em andamento',
      CLOSED: 'Encerrada',
      REOPENED: 'Reaberta',
      CANCELLED: 'Cancelada',
    };
    return labels[status];
  }

  private groupBy<T>(items: T[], keyFn: (item: T) => string | null | undefined) {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const key = keyFn(item);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }
}
