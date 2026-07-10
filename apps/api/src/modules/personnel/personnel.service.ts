import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { WorkItemEventBus } from '../my-day/work-item-event-bus';
import { AuthPayload } from '../auth/auth.types';
import {
  chainHash,
  companyTimeToUtc,
  dayKeyFor,
  enumerateDays,
  evaluateDay,
  isValidDayKey,
  pairPunches,
  periodRefOf,
  plannedMinutesFor,
  validateProposedTimes,
  validateWeeklyRules,
  weekdayOf,
  type WeeklyRules,
} from './time-clock.logic';

const MODULE = 'personnel';
/** Intervalo mínimo entre batidas do mesmo usuário (anti clique duplo). */
const MIN_PUNCH_INTERVAL_MS = 60_000;
const DEFAULT_TOLERANCE_MINUTES = 10;

type Tx = Prisma.TransactionClient;

@Injectable()
export class PersonnelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
    private readonly workItems: WorkItemEventBus,
  ) {}

  // ------------------------------ Batida ------------------------------

  async punch(me: AuthPayload, body: any = {}, ctx?: { ip?: string; userAgent?: string }) {
    const now = new Date();
    const dayKey = dayKeyFor(now);
    await this.assertPeriodOpen(me.companyId, periodRefOf(dayKey));

    const lastEntry = await this.prisma.timeClockEntry.findFirst({
      where: { companyId: me.companyId, userId: me.sub },
      orderBy: { createdAt: 'desc' },
      select: { hash: true, punchedAt: true, status: true },
    });
    if (lastEntry?.status === 'VALID' && now.getTime() - lastEntry.punchedAt.getTime() < MIN_PUNCH_INTERVAL_MS) {
      throw new ConflictException('Batida registrada há menos de 1 minuto. Aguarde para registrar novamente.');
    }

    const todayCount = await this.prisma.timeClockEntry.count({
      where: { companyId: me.companyId, userId: me.sub, dayKey, status: 'VALID' },
    });
    const kind = todayCount % 2 === 0 ? 'IN' : 'OUT';
    const source = body?.source === 'MOBILE' ? 'MOBILE' : 'WEB';

    const entry = await this.prisma.timeClockEntry.create({
      data: {
        companyId: me.companyId,
        userId: me.sub,
        punchedAt: now,
        dayKey,
        kind,
        source,
        latitude: finiteOrNull(body?.latitude),
        longitude: finiteOrNull(body?.longitude),
        accuracy: finiteOrNull(body?.accuracy),
        ip: ctx?.ip ?? null,
        userAgent: ctx?.userAgent?.slice(0, 500) ?? null,
        note: text(body?.note),
        prevHash: lastEntry?.hash ?? null,
        hash: chainHash(lastEntry?.hash ?? null, `${me.sub}|${now.toISOString()}|${kind}|${source}`),
        createdById: me.sub,
      },
    });

    await this.audit.record(me, {
      module: MODULE,
      entity: 'TimeClockEntry',
      entityId: entry.id,
      action: 'PUNCH',
      message: `Batida ${kind} em ${dayKey}`,
      after: { dayKey, kind, source },
    });
    this.workItems.markDirty(me.companyId, [me.sub], 'time-clock-punch');

    return { entry, day: await this.buildMyDay(me, dayKey) };
  }

  // ------------------------------ Espelho ------------------------------

  async myMirror(me: AuthPayload, from?: string, to?: string) {
    const today = dayKeyFor(new Date());
    const toKey = from && to && isValidDayKey(to) ? to : today;
    const fromKey = from && isValidDayKey(from) ? from : `${today.slice(0, 7)}-01`;
    if (fromKey > toKey) throw new BadRequestException('Período inválido.');

    const days = await this.buildMirrorDays(me.companyId, me.sub, fromKey, toKey);
    const totals = sumTotals(days);
    return { from: fromKey, to: toKey, today, days: [...days].reverse(), totals };
  }

  async teamMirror(me: AuthPayload, day?: string) {
    const dayKey = day && isValidDayKey(day) ? day : dayKeyFor(new Date());
    const [users, entries, assignments] = await Promise.all([
      this.prisma.user.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true },
        select: { id: true, name: true, email: true, jobTitle: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.timeClockEntry.findMany({
        where: { companyId: me.companyId, dayKey, status: 'VALID' },
        orderBy: { punchedAt: 'asc' },
      }),
      this.assignmentsForRange(me.companyId, null, dayKey, dayKey),
    ]);

    const entriesByUser = groupBy(entries, (e) => e.userId);
    const isToday = dayKey === dayKeyFor(new Date());
    const rows = users.map((user) => {
      const userEntries = entriesByUser.get(user.id) ?? [];
      const resolved = this.resolveRule(assignments, user.id, dayKey);
      const { workedMinutes, open } = pairPunches(userEntries.map((e) => e.punchedAt));
      const plannedMinutes = plannedMinutesFor(dayKey, resolved.rules);
      const { status, balanceMinutes } = evaluateDay({
        punchCount: userEntries.length,
        workedMinutes,
        plannedMinutes,
        toleranceMinutes: resolved.toleranceMinutes,
        isToday,
        hasOpenPair: open,
      });
      return {
        user,
        hasSchedule: resolved.hasSchedule,
        plannedMinutes,
        workedMinutes,
        status,
        balanceMinutes,
        entries: userEntries.map(publicEntry),
      };
    });

    return { dayKey, weekday: weekdayOf(dayKey), rows };
  }

  async summary(me: AuthPayload) {
    const today = dayKeyFor(new Date());
    const monthStart = `${today.slice(0, 7)}-01`;
    const [day, monthDays, pendingAdjustments, myPending] = await Promise.all([
      this.buildMyDay(me, today),
      this.buildMirrorDays(me.companyId, me.sub, monthStart, today),
      this.prisma.timeAdjustmentRequest.count({ where: { companyId: me.companyId, status: 'REQUESTED' } }),
      this.prisma.timeAdjustmentRequest.count({ where: { companyId: me.companyId, userId: me.sub, status: 'REQUESTED' } }),
    ]);
    return {
      today: day,
      month: sumTotals(monthDays),
      pendingAdjustments,
      myPendingAdjustments: myPending,
      period: { ref: periodRefOf(today), status: await this.periodStatus(me.companyId, periodRefOf(today)) },
    };
  }

  // ------------------------------ Ajustes ------------------------------

  async requestAdjustment(me: AuthPayload, body: any = {}) {
    const dayKey = String(body?.dayKey ?? '');
    if (!isValidDayKey(dayKey)) throw new BadRequestException('Dia inválido (use YYYY-MM-DD).');
    if (dayKey > dayKeyFor(new Date())) throw new BadRequestException('Não é possível ajustar um dia futuro.');
    await this.assertPeriodOpen(me.companyId, periodRefOf(dayKey));

    const timesError = validateProposedTimes(body?.proposedTimes);
    if (timesError) throw new BadRequestException(timesError);
    const reason = text(body?.reason);
    if (!reason) throw new BadRequestException('Motivo do ajuste é obrigatório.');

    const existing = await this.prisma.timeAdjustmentRequest.findFirst({
      where: { companyId: me.companyId, userId: me.sub, dayKey, status: 'REQUESTED' },
    });
    if (existing) throw new ConflictException('Já existe uma solicitação pendente para este dia.');

    const request = await this.prisma.timeAdjustmentRequest.create({
      data: {
        companyId: me.companyId,
        userId: me.sub,
        dayKey,
        proposedTimes: body.proposedTimes,
        reason,
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'TimeAdjustmentRequest',
      entityId: request.id,
      action: 'ADJUSTMENT_REQUESTED',
      message: `Ajuste de ponto solicitado para ${dayKey}`,
      after: { dayKey, proposedTimes: body.proposedTimes, reason },
    });
    this.workItems.markDirty(me.companyId, [me.sub], 'time-adjustment-requested');
    return request;
  }

  async myAdjustments(me: AuthPayload) {
    return this.prisma.timeAdjustmentRequest.findMany({
      where: { companyId: me.companyId, userId: me.sub },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async pendingAdjustments(me: AuthPayload) {
    const requests = await this.prisma.timeAdjustmentRequest.findMany({
      where: { companyId: me.companyId, status: 'REQUESTED' },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return this.withUserNames(me.companyId, requests);
  }

  async decideAdjustment(me: AuthPayload, id: string, action: 'approve' | 'reject', body: any = {}) {
    const request = await this.prisma.timeAdjustmentRequest.findFirst({ where: { id, companyId: me.companyId } });
    if (!request) throw new NotFoundException('Solicitação de ajuste não encontrada.');
    if (request.status !== 'REQUESTED') throw new ConflictException('Esta solicitação já foi decidida.');
    await this.assertPeriodOpen(me.companyId, periodRefOf(request.dayKey));

    const note = text(body?.note ?? body?.justification);
    if (action === 'reject' && !note) throw new BadRequestException('Justificativa é obrigatória para rejeitar.');

    const decided = await this.prisma.$transaction(async (tx) => {
      if (action === 'approve') {
        await this.applyAdjustmentTx(tx, me, request);
      }
      return tx.timeAdjustmentRequest.update({
        where: { id: request.id },
        data: {
          status: action === 'approve' ? 'APPROVED' : 'REJECTED',
          decidedById: me.sub,
          decisionNote: note,
          decidedAt: new Date(),
        },
      });
    });

    await this.audit.record(me, {
      module: MODULE,
      entity: 'TimeAdjustmentRequest',
      entityId: request.id,
      action: action === 'approve' ? 'ADJUSTMENT_APPROVED' : 'ADJUSTMENT_REJECTED',
      message: `Ajuste de ${request.dayKey} ${action === 'approve' ? 'aprovado' : 'rejeitado'}`,
      before: { status: 'REQUESTED' },
      after: { status: decided.status, note },
    });
    this.workItems.markDirty(me.companyId, [request.userId, me.sub], 'time-adjustment-decided');
    return decided;
  }

  /** Aprovação: cancela as batidas VÁLIDAS do dia e recria como MANUAL, mantendo a cadeia de hash. */
  private async applyAdjustmentTx(tx: Tx, me: AuthPayload, request: { id: string; userId: string; dayKey: string; proposedTimes: unknown }) {
    await tx.timeClockEntry.updateMany({
      where: { companyId: me.companyId, userId: request.userId, dayKey: request.dayKey, status: 'VALID' },
      data: { status: 'CANCELLED' },
    });
    const last = await tx.timeClockEntry.findFirst({
      where: { companyId: me.companyId, userId: request.userId },
      orderBy: { createdAt: 'desc' },
      select: { hash: true },
    });
    let prevHash = last?.hash ?? null;
    const times = (request.proposedTimes as string[]) ?? [];
    for (let i = 0; i < times.length; i++) {
      const punchedAt = companyTimeToUtc(request.dayKey, times[i]);
      const kind = i % 2 === 0 ? 'IN' : 'OUT';
      const hash = chainHash(prevHash, `${request.userId}|${punchedAt.toISOString()}|${kind}|MANUAL`);
      await tx.timeClockEntry.create({
        data: {
          companyId: me.companyId,
          userId: request.userId,
          punchedAt,
          dayKey: request.dayKey,
          kind,
          source: 'MANUAL',
          note: `Ajuste aprovado (solicitação ${request.id.slice(0, 8)})`,
          prevHash,
          hash,
          adjustmentRequestId: request.id,
          createdById: me.sub,
        },
      });
      prevHash = hash;
    }
  }

  // ------------------------------ Escalas ------------------------------

  async listTemplates(me: AuthPayload) {
    const [templates, activeAssignments] = await Promise.all([
      this.prisma.workShiftTemplate.findMany({
        where: { companyId: me.companyId, deletedAt: null },
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.workScheduleAssignment.groupBy({
        by: ['templateId'],
        where: { companyId: me.companyId, endsAt: null },
        _count: { _all: true },
      }),
    ]);
    const counts = new Map(activeAssignments.map((item) => [item.templateId, item._count._all]));
    return templates.map((template) => ({ ...template, activeAssignments: counts.get(template.id) ?? 0 }));
  }

  async createTemplate(me: AuthPayload, body: any = {}) {
    const name = text(body?.name);
    if (!name) throw new BadRequestException('Nome da escala é obrigatório.');
    const errors = validateWeeklyRules(body?.weeklyRules);
    if (errors.length) throw new BadRequestException(`Regras inválidas: ${errors.join('; ')}`);
    const toleranceMinutes = clampInt(body?.toleranceMinutes, 0, 120, DEFAULT_TOLERANCE_MINUTES);

    try {
      const template = await this.prisma.workShiftTemplate.create({
        data: {
          companyId: me.companyId,
          name,
          description: text(body?.description),
          toleranceMinutes,
          weeklyRules: body.weeklyRules,
          createdById: me.sub,
        },
      });
      await this.audit.record(me, {
        module: MODULE,
        entity: 'WorkShiftTemplate',
        entityId: template.id,
        action: 'CREATE',
        message: `Escala "${name}" criada`,
        after: { name, toleranceMinutes },
      });
      return template;
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Já existe uma escala com este nome.');
      throw error;
    }
  }

  async updateTemplate(me: AuthPayload, id: string, patch: any = {}) {
    const before = await this.prisma.workShiftTemplate.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!before) throw new NotFoundException('Escala não encontrada.');
    const data: Prisma.WorkShiftTemplateUpdateInput = {};
    if ('name' in patch) {
      const name = text(patch.name);
      if (!name) throw new BadRequestException('Nome da escala é obrigatório.');
      data.name = name;
    }
    if ('description' in patch) data.description = text(patch.description);
    if ('toleranceMinutes' in patch) data.toleranceMinutes = clampInt(patch.toleranceMinutes, 0, 120, before.toleranceMinutes);
    if ('weeklyRules' in patch) {
      const errors = validateWeeklyRules(patch.weeklyRules);
      if (errors.length) throw new BadRequestException(`Regras inválidas: ${errors.join('; ')}`);
      data.weeklyRules = patch.weeklyRules;
    }
    if ('active' in patch) data.active = Boolean(patch.active);
    const updated = await this.prisma.workShiftTemplate.update({ where: { id }, data });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'WorkShiftTemplate',
      entityId: id,
      action: 'UPDATE',
      before: { name: before.name, active: before.active },
      after: data as Record<string, unknown>,
    });
    return updated;
  }

  async assignSchedule(me: AuthPayload, body: any = {}) {
    const templateId = text(body?.templateId);
    const userIds: string[] = Array.isArray(body?.userIds) ? body.userIds.filter((v: unknown) => typeof v === 'string') : [];
    if (!templateId) throw new BadRequestException('Escala é obrigatória.');
    if (!userIds.length) throw new BadRequestException('Selecione ao menos um colaborador.');

    const template = await this.prisma.workShiftTemplate.findFirst({
      where: { id: templateId, companyId: me.companyId, deletedAt: null, active: true },
    });
    if (!template) throw new NotFoundException('Escala não encontrada ou inativa.');
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, companyId: me.companyId, deletedAt: null, active: true },
      select: { id: true },
    });
    if (users.length !== userIds.length) throw new NotFoundException('Um ou mais colaboradores não foram encontrados.');

    const startsAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.workScheduleAssignment.updateMany({
        where: { companyId: me.companyId, userId: { in: userIds }, endsAt: null },
        data: { endsAt: startsAt },
      });
      await tx.workScheduleAssignment.createMany({
        data: userIds.map((userId) => ({
          companyId: me.companyId,
          userId,
          templateId,
          startsAt,
          createdById: me.sub,
        })),
      });
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'WorkScheduleAssignment',
      entityId: templateId,
      action: 'ASSIGN',
      message: `Escala "${template.name}" atribuída a ${userIds.length} colaborador(es)`,
      after: { templateId, userIds },
    });
    return { assigned: userIds.length };
  }

  async listAssignments(me: AuthPayload) {
    const assignments = await this.prisma.workScheduleAssignment.findMany({
      where: { companyId: me.companyId, endsAt: null },
      include: { template: { select: { id: true, name: true, toleranceMinutes: true } } },
      orderBy: { startsAt: 'desc' },
      take: 500,
    });
    return this.withUserNames(me.companyId, assignments);
  }

  async options(me: AuthPayload) {
    const users = await this.prisma.user.findMany({
      where: { companyId: me.companyId, deletedAt: null, active: true },
      select: { id: true, name: true, email: true, jobTitle: true },
      orderBy: { name: 'asc' },
    });
    return { users };
  }

  // ------------------------------ Fechamento ------------------------------

  async listPeriods(me: AuthPayload) {
    const stored = await this.prisma.timesheetPeriod.findMany({
      where: { companyId: me.companyId },
      orderBy: { periodRef: 'desc' },
      take: 24,
    });
    const currentRef = periodRefOf(dayKeyFor(new Date()));
    const hasCurrent = stored.some((p) => p.periodRef === currentRef);
    const periods = hasCurrent
      ? stored
      : [{ id: null, companyId: me.companyId, periodRef: currentRef, status: 'OPEN', closedById: null, closedAt: null, totals: null }, ...stored];
    return this.withUserNames(me.companyId, periods, 'closedById');
  }

  async closePeriod(me: AuthPayload, ref: string) {
    this.assertPeriodRef(ref);
    const currentRef = periodRefOf(dayKeyFor(new Date()));
    if (ref > currentRef) throw new BadRequestException('Não é possível fechar uma competência futura.');
    const entries = await this.prisma.timeClockEntry.count({
      where: { companyId: me.companyId, dayKey: { startsWith: ref }, status: 'VALID' },
    });
    const period = await this.prisma.timesheetPeriod.upsert({
      where: { companyId_periodRef: { companyId: me.companyId, periodRef: ref } },
      create: {
        companyId: me.companyId,
        periodRef: ref,
        status: 'CLOSED',
        closedById: me.sub,
        closedAt: new Date(),
        totals: { entries },
      },
      update: { status: 'CLOSED', closedById: me.sub, closedAt: new Date(), totals: { entries } },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'TimesheetPeriod',
      entityId: period.id,
      action: 'PERIOD_CLOSED',
      message: `Competência ${ref} fechada (${entries} batidas)`,
    });
    return period;
  }

  async reopenPeriod(me: AuthPayload, ref: string) {
    this.assertPeriodRef(ref);
    const period = await this.prisma.timesheetPeriod.findUnique({
      where: { companyId_periodRef: { companyId: me.companyId, periodRef: ref } },
    });
    if (!period || period.status !== 'CLOSED') throw new ConflictException('Competência não está fechada.');
    const reopened = await this.prisma.timesheetPeriod.update({
      where: { id: period.id },
      data: { status: 'OPEN' },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'TimesheetPeriod',
      entityId: period.id,
      action: 'PERIOD_REOPENED',
      message: `Competência ${ref} reaberta`,
    });
    return reopened;
  }

  // ------------------------------ Internos ------------------------------

  private async buildMyDay(me: AuthPayload, dayKey: string) {
    const [entries, assignments] = await Promise.all([
      this.prisma.timeClockEntry.findMany({
        where: { companyId: me.companyId, userId: me.sub, dayKey, status: 'VALID' },
        orderBy: { punchedAt: 'asc' },
      }),
      this.assignmentsForRange(me.companyId, me.sub, dayKey, dayKey),
    ]);
    const resolved = this.resolveRule(assignments, me.sub, dayKey);
    const { workedMinutes, open } = pairPunches(entries.map((e) => e.punchedAt));
    const plannedMinutes = plannedMinutesFor(dayKey, resolved.rules);
    const evaluation = evaluateDay({
      punchCount: entries.length,
      workedMinutes,
      plannedMinutes,
      toleranceMinutes: resolved.toleranceMinutes,
      isToday: dayKey === dayKeyFor(new Date()),
      hasOpenPair: open,
    });
    return {
      dayKey,
      weekday: weekdayOf(dayKey),
      hasSchedule: resolved.hasSchedule,
      plannedMinutes,
      workedMinutes,
      nextKind: entries.length % 2 === 0 ? 'IN' : 'OUT',
      ...evaluation,
      entries: entries.map(publicEntry),
    };
  }

  private async buildMirrorDays(companyId: string, userId: string, fromKey: string, toKey: string) {
    const [entries, assignments, adjustments] = await Promise.all([
      this.prisma.timeClockEntry.findMany({
        where: { companyId, userId, dayKey: { gte: fromKey, lte: toKey }, status: 'VALID' },
        orderBy: { punchedAt: 'asc' },
      }),
      this.assignmentsForRange(companyId, userId, fromKey, toKey),
      this.prisma.timeAdjustmentRequest.findMany({
        where: { companyId, userId, dayKey: { gte: fromKey, lte: toKey } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const entriesByDay = groupBy(entries, (e) => e.dayKey);
    const adjustmentByDay = new Map<string, (typeof adjustments)[number]>();
    for (const adjustment of adjustments) {
      if (!adjustmentByDay.has(adjustment.dayKey)) adjustmentByDay.set(adjustment.dayKey, adjustment);
    }
    const today = dayKeyFor(new Date());

    return enumerateDays(fromKey, toKey).map((dayKey) => {
      const dayEntries = entriesByDay.get(dayKey) ?? [];
      const resolved = this.resolveRule(assignments, userId, dayKey);
      const { workedMinutes, open } = pairPunches(dayEntries.map((e) => e.punchedAt));
      const plannedMinutes = plannedMinutesFor(dayKey, resolved.rules);
      const evaluation = evaluateDay({
        punchCount: dayEntries.length,
        workedMinutes,
        plannedMinutes,
        toleranceMinutes: resolved.toleranceMinutes,
        isToday: dayKey === today,
        hasOpenPair: open,
      });
      const adjustment = adjustmentByDay.get(dayKey);
      return {
        dayKey,
        weekday: weekdayOf(dayKey),
        hasSchedule: resolved.hasSchedule,
        plannedMinutes,
        workedMinutes,
        ...evaluation,
        adjustment: adjustment ? { id: adjustment.id, status: adjustment.status, reason: adjustment.reason } : null,
        entries: dayEntries.map(publicEntry),
      };
    });
  }

  /** Vigências que tocam o intervalo; userId null = empresa inteira (visão de equipe). */
  private async assignmentsForRange(companyId: string, userId: string | null, fromKey: string, toKey: string) {
    const from = companyTimeToUtc(fromKey, '00:00');
    const to = companyTimeToUtc(toKey, '23:59');
    return this.prisma.workScheduleAssignment.findMany({
      where: {
        companyId,
        ...(userId ? { userId } : {}),
        startsAt: { lte: to },
        OR: [{ endsAt: null }, { endsAt: { gte: from } }],
      },
      include: { template: { select: { weeklyRules: true, toleranceMinutes: true, active: true } } },
      orderBy: { startsAt: 'desc' },
    });
  }

  private resolveRule(
    assignments: Array<{ userId: string; startsAt: Date; endsAt: Date | null; template: { weeklyRules: unknown; toleranceMinutes: number } }>,
    userId: string,
    dayKey: string,
  ): { rules: WeeklyRules | null; toleranceMinutes: number; hasSchedule: boolean } {
    const dayStart = companyTimeToUtc(dayKey, '00:00');
    const match = assignments.find(
      (a) => a.userId === userId && a.startsAt.getTime() <= dayStart.getTime() + 86_399_000 && (!a.endsAt || a.endsAt.getTime() >= dayStart.getTime()),
    );
    if (!match) return { rules: null, toleranceMinutes: DEFAULT_TOLERANCE_MINUTES, hasSchedule: false };
    return {
      rules: match.template.weeklyRules as WeeklyRules,
      toleranceMinutes: match.template.toleranceMinutes,
      hasSchedule: true,
    };
  }

  private async periodStatus(companyId: string, ref: string): Promise<string> {
    const period = await this.prisma.timesheetPeriod.findUnique({
      where: { companyId_periodRef: { companyId, periodRef: ref } },
      select: { status: true },
    });
    return period?.status ?? 'OPEN';
  }

  private async assertPeriodOpen(companyId: string, ref: string) {
    if ((await this.periodStatus(companyId, ref)) === 'CLOSED') {
      throw new ConflictException(`Competência ${ref} está fechada para batidas e ajustes.`);
    }
  }

  private assertPeriodRef(ref: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ref)) throw new BadRequestException('Competência inválida (use YYYY-MM).');
  }

  /** Resolve nomes de usuários referenciados por id (modelos sem @relation). */
  private async withUserNames<T extends Record<string, any>>(companyId: string, rows: T[], extraField?: string) {
    const ids = new Set<string>();
    for (const row of rows) {
      if (typeof row.userId === 'string') ids.add(row.userId);
      if (extraField && typeof row[extraField] === 'string') ids.add(row[extraField]);
      if (typeof row.decidedById === 'string') ids.add(row.decidedById);
    }
    if (!ids.size) return rows.map((row) => ({ ...row, user: null }));
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...ids] }, companyId },
      select: { id: true, name: true, email: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((row) => ({
      ...row,
      user: typeof row.userId === 'string' ? (byId.get(row.userId) ?? null) : null,
      decidedBy: typeof row.decidedById === 'string' ? (byId.get(row.decidedById) ?? null) : null,
      ...(extraField ? { [`${extraField.replace(/Id$/, '')}User`]: byId.get(row[extraField]) ?? null } : {}),
    }));
  }
}

// ------------------------------ Helpers ------------------------------

function publicEntry(entry: {
  id: string;
  punchedAt: Date;
  kind: string;
  source: string;
  note: string | null;
  latitude: number | null;
  longitude: number | null;
}) {
  return {
    id: entry.id,
    punchedAt: entry.punchedAt,
    kind: entry.kind,
    source: entry.source,
    note: entry.note,
    hasLocation: entry.latitude != null && entry.longitude != null,
  };
}

function sumTotals(days: Array<{ plannedMinutes: number; workedMinutes: number; balanceMinutes: number; status: string }>) {
  const totals = {
    plannedMinutes: 0,
    workedMinutes: 0,
    balanceMinutes: 0,
    okDays: 0,
    inconsistentDays: 0,
    absentDays: 0,
  };
  for (const day of days) {
    totals.plannedMinutes += day.plannedMinutes;
    totals.workedMinutes += day.workedMinutes;
    totals.balanceMinutes += day.balanceMinutes;
    if (day.status === 'OK' || day.status === 'OVERTIME' || day.status === 'UNDERTIME') totals.okDays += 1;
    if (day.status === 'INCOMPLETE') totals.inconsistentDays += 1;
    if (day.status === 'ABSENT') totals.absentDays += 1;
  }
  return totals;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function text(value: unknown): string | null {
  const t = String(value ?? '').trim();
  return t || null;
}

function finiteOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new BadRequestException('Valor numérico inválido.');
  return Math.min(max, Math.max(min, Math.round(n)));
}
