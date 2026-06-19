import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActionStatus,
  DeviationStatus,
  MeetingFormat,
  MeetingKind,
  MeetingParticipantRole,
  MeetingStatus,
  TrafficLight,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { GeminiService } from '../ai/gemini.service';
import { AuthPayload } from '../auth/auth.types';

const MODULE = 'monthly-results';
const MONTHLY_NOTE_MARKER = '__monthlyResults';
const AGENDA_NOTE_MARKER = '__monthlyResultsAgenda';

const CLOSED_ACTION_STATUSES: ActionStatus[] = [
  ActionStatus.DONE,
  ActionStatus.DONE_LATE,
  ActionStatus.CANCELLED,
  ActionStatus.EFFECTIVE,
];

const DONE_ACTION_STATUSES: ActionStatus[] = [ActionStatus.DONE, ActionStatus.DONE_LATE, ActionStatus.EFFECTIVE];

const CLOSED_DEVIATION_STATUSES: DeviationStatus[] = [
  DeviationStatus.CLOSED,
  DeviationStatus.CLOSED_LATE,
  DeviationStatus.CANCELLED,
];

const DEFAULT_AREAS = [
  'SSMA',
  'Agrícola',
  'Terras',
  'Indústria',
  'Manutenção Automotiva',
  'ComLog',
  'Suprimentos',
  'Gestão de Pessoas',
  'TI',
  'Financeiro',
  'Fiscal',
  'Serviços Pessoais',
  'Laboratório Industrial e PCTS',
  'Projetos',
  'Projetos Corporativos de Tecnologia',
  'Planejamento, Orçamento e Custo',
  'Qualidade do Produto',
  'Conformidade',
  'Jurídico',
  'Prefeitura',
  'Segurança Corporativa',
  'Segurança do Alimento',
];

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
  {
    level: 'Diário / turno',
    focus: ['Anomalias críticas', 'Segurança', 'Disponibilidade', 'Correção imediata'],
  },
  {
    level: 'Semanal',
    focus: ['Planos de ação', 'Indicadores de tendência', 'Bloqueios', 'Recursos necessários', 'Ações atrasadas'],
  },
  {
    level: 'Mensal',
    focus: ['Resultado oficial', 'Causa raiz', 'Plano de ação', 'Decisão', 'Padronização'],
  },
  {
    level: 'Trimestral',
    focus: ['Revisão de metas', 'Aprendizados', 'Projetos estruturantes', 'Revisão de indicadores'],
  },
];

const GOVERNANCE = [
  'Responsável do indicador atualiza os dados antes da reunião.',
  'Gestor valida a análise e remove barreiras locais.',
  'Diretoria decide recursos, prioridades e conflitos entre áreas.',
  'PMO acompanha prazos e registra lições aprendidas.',
];

const STANDARDIZATION_OPTIONS = [
  'Atualizar POP',
  'Atualizar instrução de trabalho',
  'Atualizar matriz de risco',
  'Atualizar checklist',
  'Criar treinamento',
  'Atualizar gestão à vista',
  'Criar auditoria de verificação',
  'Replicar boa prática para outras áreas',
  'Registrar aprendizado no banco de aprendizados',
];

type MonthlyMeta = {
  periodRef: string;
  cropSeason?: string | null;
  cycleName?: string | null;
  areaIds: string[];
  secretaryUserId?: string | null;
  followUpUserId?: string | null;
  monthlyStatus?: string | null;
  assumptions?: string | null;
  criticalRisks?: string | null;
  boardDirections?: string | null;
  generalNotes?: string | null;
  nextMonthlyAt?: string | null;
  nextWeeklyAt?: string | null;
};

type IndicatorCard = {
  id: string;
  name: string;
  code: string | null;
  unit: string;
  unitLabel: string;
  area: { id: string; name: string };
  responsible: { id: string; name: string } | null;
  target: number | null;
  lowerBound: number | null;
  upperBound: number | null;
  current: number | null;
  accumulated: number | null;
  attainment: number | null;
  deviationPct: number | null;
  light: TrafficLight | 'BLUE';
  trend: 'Alta' | 'Baixa' | 'Estável' | 'Sem histórico';
  executiveStatus: string;
  comment: string | null;
  source: string | null;
  lastUpdate: Date | null;
  hasCause: boolean;
  hasActionPlan: boolean;
  hasImmediateAction: boolean;
  hasPendingDecision: boolean;
  hasOverdueAction: boolean;
  validationIssues: string[];
  primaryDeviation: any | null;
  rootCause: string | null;
  immediateAction: string | null;
  actionSummary: string | null;
  links: {
    indicator: string;
    deviation: string | null;
    action: string | null;
  };
};

@Injectable()
export class MonthlyResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly ai: GeminiService,
  ) {}

  async options(me: AuthPayload) {
    const areaFilter = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const [areas, users] = await Promise.all([
      this.prisma.orgNode.findMany({
        where: {
          companyId: me.companyId,
          deletedAt: null,
          active: true,
          ...(areaFilter ? { id: { in: areaFilter } } : {}),
        },
        select: {
          id: true,
          parentId: true,
          name: true,
          code: true,
          type: true,
          responsibleUserId: true,
        },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.user.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true },
        select: { id: true, name: true, email: true, jobTitle: true, defaultNodeId: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      currentPeriodRef: this.currentPeriodRef(),
      defaultAreas: DEFAULT_AREAS,
      agendaTemplate: this.buildAgendaTemplate(areas),
      internalAreaScript: INTERNAL_AREA_SCRIPT,
      meetingStatuses: [
        'Em preparação',
        'Pronta para apresentação',
        'Em andamento',
        'Encerrada',
        'Reaberta',
        'Cancelada',
      ],
      areaOptions: areas,
      users,
      ai: {
        enabled: this.ai.isEnabled,
        provider: this.ai.provider,
        model: this.ai.modelName,
      },
    };
  }

  async dashboard(me: AuthPayload, query: { periodRef?: string; areaIds?: string | string[] }) {
    const periodRef = this.parsePeriodRef(query.periodRef);
    const selectedAreaIds = this.parseAreaIds(query.areaIds);
    const scope = await this.resolveAreaScope(me, selectedAreaIds);
    const { start, end } = this.monthWindow(periodRef);

    const [areas, meetings, decisionCount, pendingDecisions] = await Promise.all([
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
      this.prisma.meeting.findMany({
        where: {
          companyId: me.companyId,
          deletedAt: null,
          kind: MeetingKind.INDICATORS,
          OR: [
            { startsAt: { gte: start, lt: end } },
            { notes: { contains: `"periodRef":"${periodRef}"` } },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          startsAt: true,
          endsAt: true,
          location: true,
          notes: true,
          _count: { select: { agendaItems: true, decisions: true, participants: true, actions: true } },
        },
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.meetingDecision.count({
        where: {
          meeting: { companyId: me.companyId, deletedAt: null, kind: MeetingKind.INDICATORS },
          OR: [{ dueDate: null }, { dueDate: { gte: new Date() } }],
        },
      }),
      this.prisma.meetingDecision.findMany({
        where: {
          meeting: { companyId: me.companyId, deletedAt: null, kind: MeetingKind.INDICATORS },
          OR: [{ dueDate: null }, { dueDate: { gte: new Date() } }],
        },
        select: {
          id: true,
          decision: true,
          owner: true,
          dueDate: true,
          meeting: { select: { id: true, title: true, startsAt: true } },
        },
        orderBy: [{ dueDate: 'asc' }],
        take: 8,
      }),
    ]);

    const indicators = await this.prisma.indicator.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        status: 'ACTIVE',
        ...(scope.areaFilter ? { ownerNodeId: { in: scope.areaFilter } } : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        formula: true,
        source: true,
        unit: true,
        unitLabel: true,
        direction: true,
        periodicity: true,
        ownerNode: { select: { id: true, name: true, type: true, parentId: true } },
        responsibleUser: { select: { id: true, name: true, email: true } },
        targets: {
          where: { periodRef },
          select: { target: true, lowerBound: true, upperBound: true },
          take: 1,
        },
        results: {
          orderBy: { periodDate: 'desc' },
          take: 6,
          select: {
            periodRef: true,
            periodDate: true,
            value: true,
            light: true,
            attainment: true,
            deviationPct: true,
            note: true,
            updatedAt: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    const indicatorIds = indicators.map((indicator) => indicator.id);
    const deviations = indicatorIds.length
      ? await this.prisma.deviation.findMany({
          where: {
            companyId: me.companyId,
            deletedAt: null,
            indicatorId: { in: indicatorIds },
            OR: [
              { periodRef },
              { status: { notIn: CLOSED_DEVIATION_STATUSES } },
            ],
          },
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
            dueDate: true,
            openedAt: true,
            responsibleUser: { select: { id: true, name: true } },
            causes: { select: { id: true, category: true, description: true, weight: true } },
            analyses: { select: { id: true, method: true, content: true, createdAt: true } },
          },
          orderBy: [{ severity: 'desc' }, { openedAt: 'desc' }],
        })
      : [];

    const deviationIds = deviations.map((deviation) => deviation.id);
    const actionWhere =
      indicatorIds.length || deviationIds.length
        ? {
            companyId: me.companyId,
            deletedAt: null,
            OR: [
              ...(indicatorIds.length ? [{ indicatorId: { in: indicatorIds } }] : []),
              ...(deviationIds.length ? [{ deviationId: { in: deviationIds } }] : []),
            ],
          }
        : null;

    const actions = actionWhere
      ? await this.prisma.actionPlan.findMany({
          where: actionWhere,
          select: {
            id: true,
            title: true,
            description: true,
            indicatorId: true,
            deviationId: true,
            meetingId: true,
            rootCause: true,
            priority: true,
            status: true,
            progress: true,
            dueDate: true,
            completedAt: true,
            expectedResult: true,
            achievedResult: true,
            evidenceRequired: true,
            effectivenessStatus: true,
            responsibleUser: { select: { id: true, name: true } },
            ownerNode: { select: { id: true, name: true } },
          },
          orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
          take: 500,
        })
      : [];

    const cards = this.buildIndicatorCards(periodRef, indicators, deviations, actions);
    const areaSummaries = this.buildAreaSummaries(areas, cards);
    const lightCounts = this.countLights(cards);
    const now = new Date();
    const openActions = actions.filter((action) => !CLOSED_ACTION_STATUSES.includes(action.status)).length;
    const overdueActions = actions.filter(
      (action) => action.dueDate && action.dueDate < now && !CLOSED_ACTION_STATUSES.includes(action.status),
    ).length;
    const doneActions = actions.filter((action) => DONE_ACTION_STATUSES.includes(action.status)).length;
    const openEscalations = cards.filter((card) => card.light === 'RED' && (card.hasOverdueAction || !card.hasActionPlan)).length;
    const areasWithoutUpdate = areaSummaries.filter((area) => area.gray > 0 || area.noData > 0).length;
    const areasReady = areaSummaries.filter((area) =>
      ['Pronta para validação', 'Validada pelo gestor', 'Liberada para reunião'].includes(area.readiness),
    ).length;
    const currentMeeting = meetings[0] ?? null;
    const nextMeeting = meetings.find((meeting) => meeting.startsAt >= now) ?? null;

    const criticalIndicators = cards
      .filter((card) => card.light === 'RED' || card.light === 'YELLOW' || card.validationIssues.length > 0)
      .sort((a, b) => this.lightWeight(b.light) - this.lightWeight(a.light) || b.validationIssues.length - a.validationIssues.length)
      .slice(0, 24);

    return {
      periodRef,
      generatedAt: new Date(),
      selectedAreaIds: scope.selectedAreaIds,
      meetings: meetings.map((meeting) => {
        const parsed = this.parseMeetingNotes(meeting.notes);
        return {
          ...meeting,
          monthlyMeta: parsed.meta,
          plainNotes: parsed.plainNotes,
        };
      }),
      currentMeeting,
      nextMeeting,
      metrics: {
        currentMeetingStatus: currentMeeting ? this.parseMeetingNotes(currentMeeting.notes).meta?.monthlyStatus ?? currentMeeting.status : 'Não criada',
        participantAreas: areaSummaries.length,
        indicatorsGreen: lightCounts.GREEN + lightCounts.BLUE,
        indicatorsYellow: lightCounts.YELLOW,
        indicatorsRed: lightCounts.RED,
        indicatorsGray: lightCounts.GRAY,
        indicatorsAtRisk: lightCounts.YELLOW + lightCounts.RED,
        overdueActions,
        doneActions,
        openActions,
        pendingDecisions: decisionCount,
        openEscalations,
        areasWithoutUpdate,
        areasReady,
        nextMonthlyMeeting: nextMeeting?.startsAt ?? null,
        nextWeeklyCheck: this.parseMeetingNotes(currentMeeting?.notes ?? null).meta?.nextWeeklyAt ?? null,
      },
      executivePanel: {
        lights: lightCounts,
        keyMessageDraft: this.buildFallbackKeyMessage(cards, actions),
        macroIndicators: cards
          .sort((a, b) => this.lightWeight(b.light) - this.lightWeight(a.light) || (a.attainment ?? 1) - (b.attainment ?? 1))
          .slice(0, 12),
      },
      areas: areaSummaries,
      indicators: cards,
      criticalIndicators,
      pendingDecisions,
      agendaTemplate: this.buildAgendaTemplate(areas),
      internalAreaScript: INTERNAL_AREA_SCRIPT,
      weeklyRoutine: WEEKLY_ROUTINE_LEVELS,
      governance: GOVERNANCE,
      indicatorSheetFields: [
        'Nome do indicador',
        'Fórmula',
        'Numerador',
        'Denominador',
        'Unidade',
        'Meta',
        'Range amarelo',
        'Gatilho vermelho',
        'Fonte do dado',
        'Periodicidade',
        'Dono do indicador',
        'Área responsável',
        'Sistema de origem',
        'Responsável pela atualização',
        'Riscos de manipulação',
        'Riscos de falha de apontamento',
        'Ações padrão quando fora da meta',
        'Critério de farol',
        'Histórico de alterações',
        'Indicadores relacionados',
        'Processos impactados',
      ],
      standardizationOptions: STANDARDIZATION_OPTIONS,
      exportsAvailable: [
        'Apresentação em PDF',
        'Ata em PDF',
        'Plano de ação em Excel',
        'Farol por área em Excel',
        'Resumo executivo em PDF',
      ],
    };
  }

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
    const title = String(body.title ?? '').trim();
    if (!title) throw new BadRequestException('Informe o título da reunião mensal.');
    const periodRef = this.parsePeriodRef(body.periodRef);
    const startsAt = this.parseRequiredDate(body.startsAt, 'Informe a data e hora da reunião.');
    const endsAt = this.parseOptionalDate(body.endsAt);
    const selectedAreaIds = this.parseAreaIds(body.areaIds);
    const scope = await this.resolveAreaScope(me, selectedAreaIds);
    const areaIds = scope.areaFilter ?? [];
    const meta: MonthlyMeta = {
      periodRef,
      cropSeason: this.clean(body.cropSeason),
      cycleName: this.clean(body.cycleName),
      areaIds,
      secretaryUserId: this.clean(body.secretaryUserId),
      followUpUserId: this.clean(body.followUpUserId),
      monthlyStatus: this.clean(body.monthlyStatus) ?? 'Em preparação',
      assumptions: this.clean(body.assumptions),
      criticalRisks: this.clean(body.criticalRisks),
      boardDirections: this.clean(body.boardDirections),
      generalNotes: this.clean(body.generalNotes),
      nextMonthlyAt: this.parseOptionalDate(body.nextMonthlyAt)?.toISOString() ?? null,
      nextWeeklyAt: this.parseOptionalDate(body.nextWeeklyAt)?.toISOString() ?? null,
    };

    const meeting = await this.prisma.meeting.create({
      data: {
        companyId: me.companyId,
        title,
        kind: MeetingKind.INDICATORS,
        format: body.format ?? MeetingFormat.HYBRID,
        status: this.toMeetingStatus(meta.monthlyStatus),
        startsAt,
        endsAt,
        location: this.clean(body.location),
        responsibleUserId: this.clean(body.responsibleUserId),
        objective: this.clean(body.objective),
        notes: this.stringifyMeetingNotes(meta),
      },
      select: { id: true },
    });

    const areas = await this.prisma.orgNode.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        active: true,
        ...(areaIds.length ? { id: { in: areaIds } } : {}),
      },
      select: { id: true, name: true, responsibleUserId: true },
    });
    const agenda = this.buildAgendaTemplate(areas);
    await this.prisma.meetingAgendaItem.createMany({
      data: agenda.map((item, index) => ({
        meetingId: meeting.id,
        topic: item.topic,
        position: index + 1,
        notes: JSON.stringify({
          [AGENDA_NOTE_MARKER]: true,
          areaId: item.areaId ?? null,
          areaName: item.areaName ?? null,
          plannedMinutes: item.plannedMinutes,
          actualMinutes: null,
          presentationStatus: 'Pendente',
          internalScript: item.areaId ? INTERNAL_AREA_SCRIPT : [],
        }),
      })),
    });

    const participantIds = Array.from(
      new Set([body.responsibleUserId, body.secretaryUserId, body.followUpUserId].filter((id): id is string => Boolean(id))),
    );
    if (participantIds.length) {
      await this.prisma.meetingParticipant.createMany({
        data: participantIds.map((userId) => ({
          meetingId: meeting.id,
          userId,
          role: userId === body.responsibleUserId ? MeetingParticipantRole.RESPONSIBLE : MeetingParticipantRole.PARTICIPANT,
        })),
        skipDuplicates: true,
      });
    }

    return this.meetingDetail(me, meeting.id);
  }

  async meetingDetail(me: AuthPayload, id: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: {
        responsibleUser: { select: { id: true, name: true, email: true } },
        participants: {
          include: { user: { select: { id: true, name: true, email: true, jobTitle: true } } },
          orderBy: { user: { name: 'asc' } },
        },
        agendaItems: { orderBy: { position: 'asc' } },
        decisions: { orderBy: [{ dueDate: 'asc' }] },
        actions: {
          select: {
            id: true,
            title: true,
            status: true,
            progress: true,
            dueDate: true,
            responsibleUser: { select: { id: true, name: true } },
          },
          orderBy: [{ dueDate: 'asc' }],
        },
      },
    });
    if (!meeting) throw new NotFoundException('Reunião mensal não encontrada.');
    const parsed = this.parseMeetingNotes(meeting.notes);
    const module = await this.dashboard(me, {
      periodRef: parsed.meta?.periodRef ?? this.currentPeriodRef(),
      areaIds: parsed.meta?.areaIds ?? [],
    });
    return {
      ...meeting,
      monthlyMeta: parsed.meta,
      plainNotes: parsed.plainNotes,
      agendaItems: meeting.agendaItems.map((item) => ({
        ...item,
        monthlyMeta: this.parseAgendaNotes(item.notes),
      })),
      module,
    };
  }

  async addDecision(
    me: AuthPayload,
    id: string,
    body: { decision: string; owner?: string; dueDate?: string; topic?: string },
  ) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!meeting) throw new NotFoundException('Reunião mensal não encontrada.');
    const decision = String(body.decision ?? '').trim();
    if (!decision) throw new BadRequestException('Informe a decisão, risco ou escalonamento.');
    await this.prisma.meetingDecision.create({
      data: {
        meetingId: id,
        decision: body.topic ? `${body.topic}: ${decision}` : decision,
        owner: this.clean(body.owner),
        dueDate: this.parseOptionalDate(body.dueDate),
      },
    });
    return this.meetingDetail(me, id);
  }

  async generateKeyMessage(me: AuthPayload, id: string) {
    const detail = await this.meetingDetail(me, id);
    const dashboard = detail.module;
    const critical = dashboard.criticalIndicators.slice(0, 8).map((indicator: IndicatorCard) => ({
      indicador: indicator.name,
      area: indicator.area.name,
      farol: indicator.light,
      resultado: indicator.current,
      meta: indicator.target,
      causa: indicator.rootCause,
      acao: indicator.actionSummary,
      pendencias: indicator.validationIssues,
    }));
    const prompt = [
      'Você apoia uma reunião mensal de resultados no Gestão 360.',
      'Gere uma mensagem-chave em português, objetiva, com 2 ou 3 linhas.',
      'A mensagem deve conter resultado geral, maior risco e principal decisão necessária.',
      'Não substitua a validação do gestor; escreva como sugestão executiva.',
      '',
      `Período: ${dashboard.periodRef}`,
      `Farol geral: verde=${dashboard.metrics.indicatorsGreen}, amarelo=${dashboard.metrics.indicatorsYellow}, vermelho=${dashboard.metrics.indicatorsRed}, cinza=${dashboard.metrics.indicatorsGray}`,
      `Ações atrasadas: ${dashboard.metrics.overdueActions}`,
      `Decisões pendentes: ${dashboard.metrics.pendingDecisions}`,
      `Indicadores críticos: ${JSON.stringify(critical)}`,
    ].join('\n');

    const text = await this.ai.generateText(prompt, { temperature: 0.25, maxOutputTokens: 320 });
    return {
      provider: this.ai.provider,
      model: this.ai.modelName,
      message: text?.trim() || this.buildFallbackKeyMessage(dashboard.indicators, []),
    };
  }

  private buildIndicatorCards(
    periodRef: string,
    indicators: any[],
    deviations: any[],
    actions: any[],
  ): IndicatorCard[] {
    const deviationsByIndicator = this.groupBy(deviations, (deviation) => deviation.indicatorId);
    const actionsByIndicator = this.groupBy(actions.filter((action) => action.indicatorId), (action) => action.indicatorId);
    const actionsByDeviation = this.groupBy(actions.filter((action) => action.deviationId), (action) => action.deviationId);
    const now = new Date();

    return indicators.map((indicator) => {
      const target = indicator.targets?.[0] ?? null;
      const currentResult = indicator.results?.find((result: any) => result.periodRef === periodRef) ?? null;
      const sortedResults = [...(indicator.results ?? [])].sort(
        (a: any, b: any) => new Date(b.periodDate).getTime() - new Date(a.periodDate).getTime(),
      );
      const current = currentResult ?? sortedResults[0] ?? null;
      const previous = sortedResults.find((result: any) => result.periodRef !== current?.periodRef) ?? null;
      const indicatorDeviations = deviationsByIndicator.get(indicator.id) ?? [];
      const deviationActions = indicatorDeviations.flatMap((deviation: any) => actionsByDeviation.get(deviation.id) ?? []);
      const indicatorActions = [...(actionsByIndicator.get(indicator.id) ?? []), ...deviationActions];
      const primaryDeviation = indicatorDeviations[0] ?? null;
      const hasCause = indicatorDeviations.some(
        (deviation: any) => deviation.rootCause || deviation.causes?.length || deviation.analyses?.length,
      );
      const hasActionPlan = indicatorActions.length > 0;
      const hasOverdueAction = indicatorActions.some(
        (action: any) => action.dueDate && action.dueDate < now && !CLOSED_ACTION_STATUSES.includes(action.status),
      );
      const hasImmediateAction = indicatorActions.some((action: any) => {
        const dueDate = action.dueDate ? new Date(action.dueDate) : null;
        const dueSoon = dueDate ? dueDate.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000 : false;
        return action.priority === 'CRITICAL' || dueSoon || /provid|imediat|bloque/i.test(`${action.title} ${action.description ?? ''}`);
      });
      const rootCause =
        primaryDeviation?.rootCause ??
        primaryDeviation?.causes?.[0]?.description ??
        this.firstAnalysisSummary(primaryDeviation?.analyses?.[0]?.content) ??
        null;
      const firstAction = indicatorActions.find((action: any) => !CLOSED_ACTION_STATUSES.includes(action.status)) ?? indicatorActions[0] ?? null;
      const light = this.displayLight(current?.light ?? TrafficLight.GRAY, current?.attainment);
      const validationIssues: string[] = [];
      if (!currentResult) validationIssues.push('Sem resultado oficial no mês de referência.');
      if (light === 'RED') {
        if (!hasCause) validationIssues.push('Indicador vermelho sem causa raiz ou justificativa formal.');
        if (!hasActionPlan) validationIssues.push('Indicador vermelho sem plano de ação vinculado.');
        if (!indicator.responsibleUser) validationIssues.push('Indicador crítico sem responsável definido.');
      }
      if (light === 'YELLOW' && !current?.note) validationIssues.push('Indicador amarelo sem comentário de tendência.');
      if (hasOverdueAction) validationIssues.push('Possui ação em atraso.');

      return {
        id: indicator.id,
        name: indicator.name,
        code: indicator.code,
        unit: indicator.unit,
        unitLabel: this.unitLabel(indicator.unit, indicator.unitLabel),
        area: { id: indicator.ownerNode.id, name: indicator.ownerNode.name },
        responsible: indicator.responsibleUser
          ? { id: indicator.responsibleUser.id, name: indicator.responsibleUser.name }
          : null,
        target: target?.target ?? null,
        lowerBound: target?.lowerBound ?? null,
        upperBound: target?.upperBound ?? null,
        current: currentResult?.value ?? null,
        accumulated: current?.value ?? null,
        attainment: current?.attainment ?? null,
        deviationPct: current?.deviationPct ?? null,
        light,
        trend: this.trend(current, previous),
        executiveStatus: this.executiveStatus(light, validationIssues),
        comment: current?.note ?? null,
        source: indicator.source ?? null,
        lastUpdate: current?.updatedAt ?? null,
        hasCause,
        hasActionPlan,
        hasImmediateAction,
        hasPendingDecision: false,
        hasOverdueAction,
        validationIssues,
        primaryDeviation,
        rootCause,
        immediateAction: primaryDeviation?.fact ?? primaryDeviation?.impact ?? firstAction?.description ?? null,
        actionSummary: firstAction
          ? `${firstAction.title}${firstAction.responsibleUser?.name ? ` - ${firstAction.responsibleUser.name}` : ''}`
          : null,
        links: {
          indicator: `/indicators/${indicator.id}`,
          deviation: primaryDeviation ? `/deviations/${primaryDeviation.id}` : null,
          action: firstAction ? `/actions/${firstAction.id}` : null,
        },
      };
    });
  }

  private buildAreaSummaries(areas: any[], cards: IndicatorCard[]) {
    const cardsByArea = this.groupBy(cards, (card) => card.area.id);
    return areas.map((area) => {
      const areaCards = cardsByArea.get(area.id) ?? [];
      const counts = this.countLights(areaCards);
      const validationIssues = areaCards.flatMap((card) =>
        card.validationIssues.map((issue) => ({ indicatorId: card.id, indicator: card.name, issue })),
      );
      const noData = areaCards.filter((card) => card.light === 'GRAY').length;
      const overdueActions = areaCards.filter((card) => card.hasOverdueAction).length;
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
        noData,
        overdueActions,
        readiness: this.areaReadiness(areaCards, validationIssues.length),
        keyIndicators: areaCards
          .sort((a, b) => this.lightWeight(b.light) - this.lightWeight(a.light))
          .slice(0, 5),
        validationIssues,
      };
    });
  }

  private areaReadiness(cards: IndicatorCard[], issueCount: number) {
    if (!cards.length) return 'Não iniciada';
    if (issueCount > 0) return 'Com pendências';
    if (cards.some((card) => card.light === 'GRAY')) return 'Em preenchimento';
    if (cards.some((card) => card.light === 'RED' || card.light === 'YELLOW')) return 'Pronta para validação';
    return 'Liberada para reunião';
  }

  private buildAgendaTemplate(areas: Array<{ id: string; name: string; responsibleUserId?: string | null }>) {
    return DEFAULT_AGENDA.map((item) => {
      const area = item.areaName ? this.findAreaByName(areas, item.areaName) : null;
      return {
        ...item,
        areaId: area?.id ?? null,
        areaName: item.areaName ?? null,
        responsibleUserId: area?.responsibleUserId ?? null,
        presentationStatus: 'Pendente',
        internalScript: area ? INTERNAL_AREA_SCRIPT : [],
      };
    });
  }

  private buildFallbackKeyMessage(cards: IndicatorCard[], actions: any[]) {
    const counts = this.countLights(cards);
    const overdue = actions.filter(
      (action) => action.dueDate && action.dueDate < new Date() && !CLOSED_ACTION_STATUSES.includes(action.status),
    ).length;
    const worst = cards.find((card) => card.light === 'RED') ?? cards.find((card) => card.light === 'YELLOW');
    if (!cards.length) return 'Sem indicadores disponíveis para consolidar a mensagem-chave deste mês.';
    return [
      `O mês fecha com ${counts.GREEN + counts.BLUE} indicadores dentro da meta, ${counts.YELLOW} em atenção e ${counts.RED} fora da meta.`,
      worst
        ? `Maior risco: ${worst.name} (${worst.area.name}), ${worst.rootCause ? `causa indicada: ${worst.rootCause}` : 'ainda exige validação de causa raiz'}.`
        : 'Não há indicador crítico destacado no recorte atual.',
      overdue > 0
        ? `Decisão necessária: remover bloqueios das ${overdue} ações em atraso e confirmar responsáveis.`
        : 'Decisão necessária: validar prioridades e manter o acompanhamento semanal das ações críticas.',
    ].join('\n');
  }

  private countLights(cards: Array<{ light: TrafficLight | 'BLUE' }>) {
    return cards.reduce(
      (acc, card) => {
        acc[card.light] += 1;
        return acc;
      },
      { GREEN: 0, YELLOW: 0, RED: 0, GRAY: 0, BLUE: 0 } as Record<TrafficLight | 'BLUE', number>,
    );
  }

  private async resolveAreaScope(me: AuthPayload, selectedAreaIds: string[]) {
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const expandedSelected = selectedAreaIds.length
      ? await this.access.expandWithDescendants(me.companyId, selectedAreaIds)
      : null;
    let areaFilter = expandedSelected ?? permitted;
    if (expandedSelected && permitted) {
      const allowed = new Set(permitted);
      areaFilter = expandedSelected.filter((id) => allowed.has(id));
    }
    return {
      selectedAreaIds,
      areaFilter,
    };
  }

  private parseMeetingNotes(notes: string | null | undefined): { meta: MonthlyMeta | null; plainNotes: string | null } {
    if (!notes) return { meta: null, plainNotes: null };
    try {
      const parsed = JSON.parse(notes);
      if (parsed && parsed[MONTHLY_NOTE_MARKER]) {
        return {
          meta: {
            periodRef: this.parsePeriodRef(parsed.periodRef),
            cropSeason: parsed.cropSeason ?? null,
            cycleName: parsed.cycleName ?? null,
            areaIds: Array.isArray(parsed.areaIds) ? parsed.areaIds : [],
            secretaryUserId: parsed.secretaryUserId ?? null,
            followUpUserId: parsed.followUpUserId ?? null,
            monthlyStatus: parsed.monthlyStatus ?? null,
            assumptions: parsed.assumptions ?? null,
            criticalRisks: parsed.criticalRisks ?? null,
            boardDirections: parsed.boardDirections ?? null,
            generalNotes: parsed.generalNotes ?? null,
            nextMonthlyAt: parsed.nextMonthlyAt ?? null,
            nextWeeklyAt: parsed.nextWeeklyAt ?? null,
          },
          plainNotes: parsed.generalNotes ?? null,
        };
      }
    } catch {
      return { meta: null, plainNotes: notes };
    }
    return { meta: null, plainNotes: notes };
  }

  private stringifyMeetingNotes(meta: MonthlyMeta) {
    return JSON.stringify({
      [MONTHLY_NOTE_MARKER]: true,
      ...meta,
    });
  }

  private parseAgendaNotes(notes: string | null | undefined) {
    if (!notes) return null;
    try {
      const parsed = JSON.parse(notes);
      return parsed?.[AGENDA_NOTE_MARKER] ? parsed : null;
    } catch {
      return null;
    }
  }

  private parsePeriodRef(value?: string | null) {
    const fallback = this.currentPeriodRef();
    if (!value) return fallback;
    const clean = String(value).trim();
    if (!/^\d{4}-\d{2}$/.test(clean)) throw new BadRequestException('Mês de referência inválido. Use o formato AAAA-MM.');
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
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
    return { start, end };
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

  private toMeetingStatus(monthlyStatus?: string | null) {
    const normalized = this.normalize(monthlyStatus ?? '');
    if (normalized.includes('CANCEL')) return MeetingStatus.CANCELLED;
    if (normalized.includes('ENCERR')) return MeetingStatus.COMPLETED;
    return MeetingStatus.SCHEDULED;
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

  private trend(current: any | null, previous: any | null): 'Alta' | 'Baixa' | 'Estável' | 'Sem histórico' {
    if (!current || !previous) return 'Sem histórico';
    const delta = Number(current.value) - Number(previous.value);
    if (Math.abs(delta) < 0.0001) return 'Estável';
    return delta > 0 ? 'Alta' : 'Baixa';
  }

  private lightWeight(light: TrafficLight | 'BLUE') {
    const weights: Record<TrafficLight | 'BLUE', number> = {
      RED: 5,
      YELLOW: 4,
      GRAY: 3,
      GREEN: 2,
      BLUE: 1,
    };
    return weights[light] ?? 0;
  }

  private findAreaByName(areas: Array<{ id: string; name: string; responsibleUserId?: string | null }>, name: string) {
    const normalized = this.normalize(name);
    return (
      areas.find((area) => this.normalize(area.name) === normalized) ??
      areas.find((area) => this.normalize(area.name).includes(normalized) || normalized.includes(this.normalize(area.name))) ??
      null
    );
  }

  private normalize(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
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

  private firstAnalysisSummary(content?: string | null) {
    if (!content) return null;
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed?.rootCause === 'string') return parsed.rootCause;
      if (Array.isArray(parsed?.whys)) return parsed.whys.at(-1)?.answer ?? null;
    } catch {
      return content.slice(0, 180);
    }
    return null;
  }
}
