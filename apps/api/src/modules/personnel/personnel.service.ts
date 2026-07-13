import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma, type TimeClockEntry } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService, type AuditActor } from '../../common/audit/audit-writer.service';
import { WorkItemEventBus } from '../my-day/work-item-event-bus';
import { AccessService } from '../access/access.service';
import { AuthPayload } from '../auth/auth.types';
import { VacationService, type DayCoverage } from './vacation.service';
import {
  addDays,
  attributePunches,
  chainHash,
  companyTimeToUtc,
  dayKeyFor,
  dayRuleFromSchedule,
  effectiveWorkedMinutes,
  enumerateDays,
  evaluateDay,
  isValidDayKey,
  monthBounds,
  nationalHolidaysFor,
  parsePunchCsv,
  periodRefOf,
  plannedMinutesFromSchedule,
  previousMonthRef,
  ruleCrossesMidnight,
  validateCycleRules,
  validateProposedTimes,
  validateWeeklyRules,
  weekdayOf,
  type ScheduleRules,
  type ToleranceMark,
} from './time-clock.logic';

const MODULE = 'personnel';
/** Intervalo mínimo entre batidas do mesmo usuário (anti clique duplo). */
const MIN_PUNCH_INTERVAL_MS = 60_000;
const DEFAULT_TOLERANCE_MINUTES = 10;
const CALCULATION_ALGORITHM_VERSION = 'journey-v2.1';
const COMPANY_TIMEZONE = 'America/Sao_Paulo';

type Tx = Prisma.TransactionClient;
type PunchContext = {
  ip?: string;
  userAgent?: string;
  verifiedBiometricAttemptId?: string;
  sourceOverride?: 'FACIAL_KIOSK';
  auditActor?: AuditActor;
  createdById?: string | null;
};

@Injectable()
export class PersonnelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
    private readonly workItems: WorkItemEventBus,
    private readonly vacations: VacationService,
    private readonly access: AccessService,
  ) {}

  // ------------------------------ Batida ------------------------------

  async punch(me: AuthPayload, body: any = {}, ctx?: PunchContext) {
    const syncId = normalizeSyncId(body?.syncId);

    // Retry após resposta perdida: devolve a mesma marcação antes de verificar
    // fechamento da competência ou a janela anti-duplo-clique.
    if (syncId) {
      const existing = await this.prisma.timeClockEntry.findFirst({ where: { companyId: me.companyId, syncId } });
      if (existing) return this.idempotentPunchResult(me, existing);
    }

    const now = new Date();
    const dayKey = await this.attributedDayKeyFor(me.companyId, me.sub, now);
    await this.assertPeriodOpen(me.companyId, periodRefOf(dayKey));

    const [company, user, profile] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: me.companyId }, select: { name: true, cnpj: true } }),
      this.prisma.user.findFirst({
        where: { id: me.sub, companyId: me.companyId, active: true, deletedAt: null },
        select: { id: true, name: true, branchId: true },
      }),
      this.prisma.personnelEmployeeProfile.findFirst({
        where: { companyId: me.companyId, userId: me.sub },
        select: { cpf: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    if (!user) throw new ForbiddenException('Colaborador inativo ou não encontrado.');
    if (!company) throw new NotFoundException('Empresa não encontrada.');

    const sequenceScope = user.branchId ?? `company:${me.companyId}`;
    const source = ctx?.sourceOverride ?? (ctx?.verifiedBiometricAttemptId ? 'FACIAL' : body?.source === 'MOBILE' ? 'MOBILE' : 'WEB');
    const deviceTime = body?.deviceTime ? new Date(body.deviceTime) : null;
    const deviceId = text(body?.deviceId)?.slice(0, 120) ?? null;

    // Serializa batidas simultâneas do mesmo colaborador no PostgreSQL para
    // preservar alternância, idempotência e cadeia técnica de integridade.
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${me.companyId}:period:${periodRefOf(dayKey)}`}))`;
      const lockedPeriod = await tx.timesheetPeriod.findUnique({
        where: { companyId_periodRef: { companyId: me.companyId, periodRef: periodRefOf(dayKey) } },
        select: { status: true },
      });
      if (lockedPeriod?.status === 'CLOSED') throw new ConflictException(`Competência ${periodRefOf(dayKey)} está fechada para batidas e ajustes.`);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${me.companyId}:${me.sub}:time-clock`}))`;
      if (syncId) {
        const existing = await tx.timeClockEntry.findFirst({ where: { companyId: me.companyId, syncId } });
        if (existing) return { entry: existing, created: false };
      }

      const lastEntry = await tx.timeClockEntry.findFirst({
        where: { companyId: me.companyId, userId: me.sub },
        orderBy: { createdAt: 'desc' },
        select: { hash: true, punchedAt: true, status: true },
      });
      if (lastEntry?.status === 'VALID' && now.getTime() - lastEntry.punchedAt.getTime() < MIN_PUNCH_INTERVAL_MS) {
        throw new ConflictException('Batida registrada há menos de 1 minuto. Aguarde para registrar novamente.');
      }
      const dayCount = await tx.timeClockEntry.count({
        where: { companyId: me.companyId, userId: me.sub, dayKey, status: 'VALID', treatments: { none: { action: 'EXCLUDE' } } },
      });
      const kind = dayCount % 2 === 0 ? 'IN' : 'OUT';
      const nsr = await this.nextNsr(tx, me.companyId, sequenceScope);
      const hash = chainHash(lastEntry?.hash ?? null, `${me.sub}|${now.toISOString()}|${kind}|${source}|${sequenceScope}|${nsr}`);
      const entry = await tx.timeClockEntry.create({
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
          biometricAttemptId: ctx?.verifiedBiometricAttemptId ?? null,
          deviceTime: deviceTime && !Number.isNaN(deviceTime.getTime()) ? deviceTime : null,
          deviceId,
          syncId,
          sequenceScope,
          nsr,
          prevHash: lastEntry?.hash ?? null,
          hash,
          createdById: ctx?.createdById === undefined ? me.sub : ctx.createdById,
          receiptSnapshot: {
            create: {
              companyId: me.companyId,
              companyName: company.name,
              companyRegistrationMasked: maskRegistration(company.cnpj),
              employeeName: user.name,
              employeeRegistrationMasked: maskRegistration(profile?.cpf),
              timezone: COMPANY_TIMEZONE,
              snapshotOrigin: 'PUNCH',
              checksum: sha256(`${me.companyId}|${me.sub}|${now.toISOString()}|${sequenceScope}|${nsr}|${hash}`),
            },
          },
        },
      });
      return { entry, created: true };
    });

    if (!result.created) return this.idempotentPunchResult(me, result.entry);

    await this.audit.record(ctx?.auditActor ?? me, {
      module: MODULE,
      entity: 'TimeClockEntry',
      entityId: result.entry.id,
      action: 'PUNCH',
      message: `Batida ${result.entry.kind} em ${dayKey} (registro interno ${result.entry.nsr})`,
      after: { subjectUserId: me.sub, dayKey, kind: result.entry.kind, source, recordSequence: result.entry.nsr.toString(), deviceId },
    });
    this.workItems.markDirty(me.companyId, [me.sub], 'time-clock-punch');

    return { entry: serializeEntry(result.entry), day: await this.buildMyDay(me, dayKey), idempotent: false };
  }

  private async idempotentPunchResult(me: AuthPayload, entry: TimeClockEntry) {
    if (entry.companyId !== me.companyId || entry.userId !== me.sub) {
      throw new ConflictException('Identificador de sincronização já utilizado.');
    }
    return { entry: serializeEntry(entry), day: await this.buildMyDay(me, entry.dayKey), idempotent: true };
  }

  /** Próxima sequência interna do escopo, alocada atomicamente na transação. */
  private async nextNsr(tx: Tx, companyId: string, sequenceScope: string): Promise<bigint> {
    const key = `time-clock-sequence:${sequenceScope}`;
    const rows = await tx.$queryRaw<Array<{ value: bigint }>>`
      INSERT INTO "personnel_counters" ("companyId", "key", "value")
      VALUES (${companyId}, ${key}, 1)
      ON CONFLICT ("companyId", "key") DO UPDATE SET "value" = "personnel_counters"."value" + 1
      RETURNING "value"`;
    if (!rows[0]) throw new Error('Falha ao alocar sequência interna da marcação.');
    return rows[0].value;
  }

  /**
   * Dia de jornada da batida: se a escala de ONTEM atravessa a meia-noite,
   * a jornada de ontem está com par aberto e ainda estamos dentro da janela
   * (fim previsto + 4h, sem invadir a jornada de hoje), a batida pertence a ontem.
   */
  private async attributedDayKeyFor(companyId: string, userId: string, now: Date): Promise<string> {
    const civilKey = dayKeyFor(now);
    const prevKey = addDays(civilKey, -1);
    const assignments = await this.assignmentsForRange(companyId, userId, prevKey, civilKey);
    const prevResolved = this.resolveRule(assignments, userId, prevKey);
    const prevRule = dayRuleFromSchedule(prevKey, prevResolved.rules, prevResolved.cycleAnchorDay);
    if (!prevRule || !ruleCrossesMidnight(prevRule)) return civilKey;

    const shiftEnd = companyTimeToUtc(prevKey, prevRule.end).getTime() + 86_400_000;
    let cutoff = shiftEnd + 4 * 60 * 60_000;
    const todayResolved = this.resolveRule(assignments, userId, civilKey);
    const todayRule = dayRuleFromSchedule(civilKey, todayResolved.rules, todayResolved.cycleAnchorDay);
    if (todayRule) cutoff = Math.min(cutoff, companyTimeToUtc(civilKey, todayRule.start).getTime() - 60_000);
    if (now.getTime() > cutoff) return civilKey;

    const prevCount = await this.prisma.timeClockEntry.count({
      where: { companyId, userId, dayKey: prevKey, status: 'VALID', treatments: { none: { action: 'EXCLUDE' } } },
    });
    return prevCount % 2 === 1 ? prevKey : civilKey;
  }

  // ------------------------------ Espelho ------------------------------

  async myMirror(me: AuthPayload, from?: string, to?: string) {
    const today = dayKeyFor(new Date());
    // Dias futuros não entram no espelho (seriam avaliados como falta).
    const requestedTo = from && to && isValidDayKey(to) ? to : today;
    const toKey = requestedTo > today ? today : requestedTo;
    const fromKey = from && isValidDayKey(from) ? from : `${today.slice(0, 7)}-01`;
    if (fromKey > toKey) throw new BadRequestException('Período inválido.');

    const days = await this.buildMirrorDays(me.companyId, me.sub, fromKey, toKey);
    const totals = sumTotals(days);
    return { from: fromKey, to: toKey, today, days: [...days].reverse(), totals };
  }

  async teamMirror(me: AuthPayload, day?: string) {
    const dayKey = day && isValidDayKey(day) ? day : dayKeyFor(new Date());
    const extendedFrom = addDays(dayKey, -1);
    const extendedTo = addDays(dayKey, 1);
    const visible = await this.visibleUserIdsFor(me);
    const [users, entries, assignments, coverageMap, holidays] = await Promise.all([
      this.prisma.user.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true, ...(visible ? { id: { in: [...visible] } } : {}) },
        select: { id: true, name: true, email: true, jobTitle: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.timeClockEntry.findMany({
        where: {
          companyId: me.companyId,
          dayKey: { gte: extendedFrom, lte: extendedTo },
          status: 'VALID',
          treatments: { none: { action: 'EXCLUDE' } },
          ...(visible ? { userId: { in: [...visible] } } : {}),
        },
        orderBy: { punchedAt: 'asc' },
      }),
      this.assignmentsForRange(me.companyId, null, extendedFrom, extendedTo),
      this.vacations.coverageForUsers(me.companyId, visible ? [...visible] : null, dayKey, dayKey),
      this.holidayMap(me.companyId, extendedFrom, dayKey),
    ]);

    const entriesByUser = groupBy(entries, (e) => e.userId);
    const rows = users.map((user) => {
      const dayRow = this.composeUserDays({
        userId: user.id,
        fromKey: dayKey,
        toKey: dayKey,
        entries: entriesByUser.get(user.id) ?? [],
        assignments,
        holidays,
        coverageDays: coverageMap.get(user.id) ?? new Map<string, DayCoverage>(),
      })[0];
      return {
        user,
        hasSchedule: dayRow.hasSchedule,
        plannedMinutes: dayRow.plannedMinutes,
        workedMinutes: dayRow.workedMinutes,
        status: dayRow.status,
        balanceMinutes: dayRow.balanceMinutes,
        holiday: dayRow.holiday,
        entries: dayRow.entries,
      };
    });

    return { dayKey, weekday: weekdayOf(dayKey), rows };
  }

  async summary(me: AuthPayload) {
    const today = dayKeyFor(new Date());
    const monthStart = `${today.slice(0, 7)}-01`;
    const visible = await this.visibleUserIdsFor(me);
    const [day, monthDays, pendingAdjustments, myPending, bank] = await Promise.all([
      this.buildMyDay(me, today),
      this.buildMirrorDays(me.companyId, me.sub, monthStart, today),
      this.prisma.timeAdjustmentRequest.count({
        where: { companyId: me.companyId, status: 'REQUESTED', ...(visible ? { userId: { in: [...visible] } } : {}) },
      }),
      this.prisma.timeAdjustmentRequest.count({ where: { companyId: me.companyId, userId: me.sub, status: 'REQUESTED' } }),
      this.bankBalance(me.companyId, me.sub),
    ]);
    return {
      today: day,
      month: sumTotals(monthDays),
      bank,
      pendingAdjustments,
      myPendingAdjustments: myPending,
      period: { ref: periodRefOf(today), status: await this.periodStatus(me.companyId, periodRefOf(today)) },
    };
  }

  /**
   * Banco de horas acumulado: competências FECHADAS usam o consolidado gravado
   * no fechamento; meses em aberto (atual + 2 anteriores) são calculados ao vivo.
   */
  private async bankBalance(companyId: string, userId: string) {
    const today = dayKeyFor(new Date());
    const closed = await this.prisma.timesheetPeriod.findMany({
      where: { companyId, status: 'CLOSED' },
      select: { periodRef: true, totals: true },
    });
    let closedMinutes = 0;
    const closedRefs = new Set<string>();
    for (const period of closed) {
      closedRefs.add(period.periodRef);
      const users = (period.totals as any)?.users;
      closedMinutes += Number(users?.[userId]?.balanceMinutes ?? 0);
    }
    let liveMinutes = 0;
    let ref = periodRefOf(today);
    for (let i = 0; i < 3; i++) {
      if (!closedRefs.has(ref)) {
        const { first, last } = monthBounds(ref);
        const to = last > today ? today : last;
        if (first <= to) {
          const days = await this.buildMirrorDays(companyId, userId, first, to);
          liveMinutes += days.reduce((sum, d) => sum + d.balanceMinutes, 0);
        }
      }
      ref = previousMonthRef(ref);
    }
    return { totalMinutes: closedMinutes + liveMinutes, closedMinutes, liveMinutes };
  }

  // ------------------------------ Importação ------------------------------

  /** Importa batidas de relógio/REP em CSV (email;data;hora ou email;ISO). */
  async importPunches(me: AuthPayload, body: any = {}) {
    const base64 = text(body?.contentBase64);
    const content = base64 ? Buffer.from(base64, 'base64').toString('utf8') : (text(body?.content) ?? '');
    if (!content.trim()) throw new BadRequestException('Envie o conteúdo CSV das batidas.');

    const parsed = parsePunchCsv(content);
    const errors = [...parsed.errors];
    if (!parsed.rows.length) {
      throw new BadRequestException(errors[0] ?? 'Nenhuma linha válida encontrada no arquivo.');
    }
    if (parsed.rows.length > 2000) throw new BadRequestException('Máximo de 2.000 batidas por importação.');

    const emails = [...new Set(parsed.rows.map((row) => row.email))];
    const users = await this.prisma.user.findMany({
      where: { companyId: me.companyId, deletedAt: null, active: true },
      select: { id: true, email: true, branchId: true },
    });
    const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
    const branchByUser = new Map(users.map((u) => [u.id, u.branchId]));
    const unknownEmails = emails.filter((email) => !userByEmail.has(email));
    for (const email of unknownEmails) errors.push(`Colaborador não encontrado: ${email}`);

    const closedRefs = new Set(
      (
        await this.prisma.timesheetPeriod.findMany({
          where: { companyId: me.companyId, status: 'CLOSED' },
          select: { periodRef: true },
        })
      ).map((p) => p.periodRef),
    );

    // Agrupa por usuário, filtra competência fechada e ordena cronologicamente.
    const byUser = new Map<string, Date[]>();
    for (const row of parsed.rows) {
      const userId = userByEmail.get(row.email);
      if (!userId) continue;
      const dayKey = dayKeyFor(row.punchedAt);
      if (closedRefs.has(periodRefOf(dayKey))) {
        errors.push(`Linha ${row.line}: competência ${periodRefOf(dayKey)} fechada.`);
        continue;
      }
      const list = byUser.get(userId) ?? [];
      list.push(row.punchedAt);
      byUser.set(userId, list);
    }

    let imported = 0;
    let duplicates = 0;
    const affectedUsers: string[] = [];

    for (const [userId, times] of byUser) {
      const sorted = [...new Set(times.map((t) => t.getTime()))].sort((a, b) => a - b).map((t) => new Date(t));
      duplicates += times.length - sorted.length;
      const existing = await this.prisma.timeClockEntry.findMany({
        where: { companyId: me.companyId, userId, punchedAt: { in: sorted } },
        select: { punchedAt: true },
      });
      const existingSet = new Set(existing.map((e) => e.punchedAt.getTime()));
      const fresh = sorted.filter((t) => !existingSet.has(t.getTime()));
      duplicates += sorted.length - fresh.length;
      if (!fresh.length) continue;

      await this.prisma.$transaction(
        async (tx) => {
          const periodRefs = [...new Set(fresh.map((item) => periodRefOf(dayKeyFor(item))))].sort();
          for (const ref of periodRefs) {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${me.companyId}:period:${ref}`}))`;
          }
          const closedDuringImport = await tx.timesheetPeriod.findFirst({
            where: { companyId: me.companyId, periodRef: { in: periodRefs }, status: 'CLOSED' },
            select: { periodRef: true },
          });
          if (closedDuringImport) throw new ConflictException(`Competência ${closedDuringImport.periodRef} foi fechada durante a importação.`);
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${me.companyId}:${userId}:time-clock`}))`;
          const last = await tx.timeClockEntry.findFirst({
            where: { companyId: me.companyId, userId },
            orderBy: { createdAt: 'desc' },
            select: { hash: true },
          });
          let prevHash = last?.hash ?? null;
          // A batida é imutável: o kind gravado é apenas informativo (a apuração
          // deriva a alternância pela posição na jornada). Nada é atualizado depois.
          const freshDays = [...new Set(fresh.map((t) => dayKeyFor(t)))];
          const existingCounts = await tx.timeClockEntry.groupBy({
            by: ['dayKey'],
            where: {
              companyId: me.companyId,
              userId,
              dayKey: { in: freshDays },
              status: 'VALID',
              treatments: { none: { action: 'EXCLUDE' } },
            },
            _count: { _all: true },
          });
          const dayCounts = new Map(existingCounts.map((row) => [row.dayKey, row._count._all]));
          const sequenceScope = branchByUser.get(userId) ?? `company:${me.companyId}`;
          for (const punchedAt of fresh) {
            const duplicate = await tx.timeClockEntry.findFirst({
              where: { companyId: me.companyId, userId, punchedAt },
              select: { id: true },
            });
            if (duplicate) {
              duplicates += 1;
              continue;
            }
            const dayKey = dayKeyFor(punchedAt);
            const seq = dayCounts.get(dayKey) ?? 0;
            dayCounts.set(dayKey, seq + 1);
            const kind = seq % 2 === 0 ? 'IN' : 'OUT';
            const nsr = await this.nextNsr(tx, me.companyId, sequenceScope);
            const hash = chainHash(prevHash, `${userId}|${punchedAt.toISOString()}|${kind}|IMPORT|${sequenceScope}|${nsr}`);
            await tx.timeClockEntry.create({
              data: {
                companyId: me.companyId,
                userId,
                punchedAt,
                dayKey,
                kind,
                source: 'IMPORT',
                syncId: `import:${sha256(`${me.companyId}|${userId}|${punchedAt.toISOString()}`)}`,
                sequenceScope,
                nsr,
                prevHash,
                hash,
                createdById: me.sub,
              },
            });
            prevHash = hash;
            imported += 1;
          }
        },
        { timeout: 120_000, maxWait: 15_000 },
      );
      affectedUsers.push(userId);
    }

    await this.audit.record(me, {
      module: MODULE,
      entity: 'TimeClockEntry',
      action: 'IMPORT_PUNCHES',
      message: `Importação de batidas: ${imported} inseridas, ${duplicates} duplicadas, ${errors.length} erros`,
      after: { imported, duplicates, errorList: errors.slice(0, 20) },
    });
    if (affectedUsers.length) this.workItems.markDirty(me.companyId, affectedUsers, 'time-clock-import');

    return { imported, duplicates, errors };
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

    const request = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${me.companyId}:period:${periodRefOf(dayKey)}`}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${me.companyId}:${me.sub}:adjustment:${dayKey}`}))`;
      const period = await tx.timesheetPeriod.findUnique({
        where: { companyId_periodRef: { companyId: me.companyId, periodRef: periodRefOf(dayKey) } },
        select: { status: true },
      });
      if (period?.status === 'CLOSED') throw new ConflictException(`Competência ${periodRefOf(dayKey)} está fechada para ajustes.`);
      const existing = await tx.timeAdjustmentRequest.findFirst({
        where: { companyId: me.companyId, userId: me.sub, dayKey, status: 'REQUESTED' },
      });
      if (existing) throw new ConflictException('Já existe uma solicitação pendente para este dia.');
      return tx.timeAdjustmentRequest.create({
        data: {
          companyId: me.companyId,
          userId: me.sub,
          dayKey,
          proposedTimes: body.proposedTimes,
          reason,
        },
      });
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
    const visible = await this.visibleUserIdsFor(me);
    const requests = await this.prisma.timeAdjustmentRequest.findMany({
      where: { companyId: me.companyId, status: 'REQUESTED', ...(visible ? { userId: { in: [...visible] } } : {}) },
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
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${me.companyId}:period:${periodRefOf(request.dayKey)}`}))`;
      const lockedPeriod = await tx.timesheetPeriod.findUnique({
        where: { companyId_periodRef: { companyId: me.companyId, periodRef: periodRefOf(request.dayKey) } },
        select: { status: true },
      });
      if (lockedPeriod?.status === 'CLOSED') throw new ConflictException(`Competência ${periodRefOf(request.dayKey)} está fechada para ajustes.`);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${me.companyId}:adjustment:${request.id}`}))`;
      const current = await tx.timeAdjustmentRequest.findUnique({ where: { id: request.id } });
      if (!current || current.companyId !== me.companyId) throw new NotFoundException('Solicitação de ajuste não encontrada.');
      if (current.status !== 'REQUESTED') throw new ConflictException('Esta solicitação já foi decidida.');
      if (action === 'approve') {
        await this.applyAdjustmentTx(tx, me, current);
      }
      return tx.timeAdjustmentRequest.update({
        where: { id: current.id },
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

  /** Aprovação: preserva as batidas brutas, cria tratamentos EXCLUDE e novas entradas MANUAL. */
  private async applyAdjustmentTx(tx: Tx, me: AuthPayload, request: { id: string; userId: string; dayKey: string; proposedTimes: unknown }) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${me.companyId}:${request.userId}:time-clock`}))`;
    const originals = await tx.timeClockEntry.findMany({
      where: {
        companyId: me.companyId,
        userId: request.userId,
        dayKey: request.dayKey,
        status: 'VALID',
        treatments: { none: { action: 'EXCLUDE' } },
      },
      select: { id: true },
    });
    if (originals.length) {
      await tx.timeClockEntryTreatment.createMany({
        data: originals.map((entry) => ({
          companyId: me.companyId,
          entryId: entry.id,
          adjustmentRequestId: request.id,
          action: 'EXCLUDE',
          reason: `Substituída na apuração pelo ajuste ${request.id.slice(0, 8)}`,
          createdById: me.sub,
        })),
        skipDuplicates: true,
      });
    }
    const last = await tx.timeClockEntry.findFirst({
      where: { companyId: me.companyId, userId: request.userId },
      orderBy: { createdAt: 'desc' },
      select: { hash: true },
    });
    const user = await tx.user.findFirst({
      where: { id: request.userId, companyId: me.companyId },
      select: { branchId: true },
    });
    if (!user) throw new NotFoundException('Colaborador não encontrado.');
    const sequenceScope = user.branchId ?? `company:${me.companyId}`;
    let prevHash = last?.hash ?? null;
    const times = (request.proposedTimes as string[]) ?? [];
    for (let i = 0; i < times.length; i++) {
      const punchedAt = companyTimeToUtc(request.dayKey, times[i]);
      const kind = i % 2 === 0 ? 'IN' : 'OUT';
      const nsr = await this.nextNsr(tx, me.companyId, sequenceScope);
      const hash = chainHash(prevHash, `${request.userId}|${punchedAt.toISOString()}|${kind}|MANUAL|${sequenceScope}|${nsr}`);
      await tx.timeClockEntry.create({
        data: {
          companyId: me.companyId,
          userId: request.userId,
          punchedAt,
          dayKey: request.dayKey,
          kind,
          source: 'MANUAL',
          note: `Ajuste aprovado (solicitação ${request.id.slice(0, 8)})`,
          sequenceScope,
          nsr,
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
    const kind = body?.kind === 'CYCLE' ? 'CYCLE' : 'WEEKLY';
    if (kind === 'CYCLE') {
      const errors = validateCycleRules(body?.cycleRules);
      if (errors.length) throw new BadRequestException(`Ciclo inválido: ${errors.join('; ')}`);
    } else {
      const errors = validateWeeklyRules(body?.weeklyRules);
      if (errors.length) throw new BadRequestException(`Regras inválidas: ${errors.join('; ')}`);
    }
    const toleranceMinutes = clampInt(body?.toleranceMinutes, 0, 120, DEFAULT_TOLERANCE_MINUTES);

    try {
      const template = await this.prisma.workShiftTemplate.create({
        data: {
          companyId: me.companyId,
          name,
          description: text(body?.description),
          toleranceMinutes,
          kind,
          weeklyRules: kind === 'WEEKLY' ? body.weeklyRules : {},
          cycleRules: kind === 'CYCLE' ? body.cycleRules : Prisma.DbNull,
          worksHolidays: booleanValue(body?.worksHolidays, false),
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
    if ('cycleRules' in patch && before.kind === 'CYCLE') {
      const errors = validateCycleRules(patch.cycleRules);
      if (errors.length) throw new BadRequestException(`Ciclo inválido: ${errors.join('; ')}`);
      data.cycleRules = patch.cycleRules;
    }
    if ('worksHolidays' in patch) data.worksHolidays = booleanValue(patch.worksHolidays, before.worksHolidays);
    if ('active' in patch) data.active = booleanValue(patch.active, before.active);
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
    const cycleAnchorDay = text(body?.cycleAnchorDay);
    if (template.kind === 'CYCLE') {
      if (!cycleAnchorDay || !isValidDayKey(cycleAnchorDay)) {
        throw new BadRequestException('Informe o primeiro dia de trabalho do ciclo (data âncora) para escalas cíclicas.');
      }
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, companyId: me.companyId, deletedAt: null, active: true },
      select: { id: true },
    });
    if (users.length !== userIds.length) throw new NotFoundException('Um ou mais colaboradores não foram encontrados.');

    // Congela a vigência: o cálculo usa este snapshot, não o template vivo.
    const rulesSnapshot = (
      template.kind === 'CYCLE'
        ? { kind: 'CYCLE', cycle: template.cycleRules, worksHolidays: template.worksHolidays }
        : template.worksHolidays
          ? { ...(template.weeklyRules as Record<string, unknown>), worksHolidays: true }
          : template.weeklyRules
    ) as Prisma.InputJsonValue;

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
          rulesSnapshot,
          toleranceSnapshot: template.toleranceMinutes,
          cycleAnchorDay: template.kind === 'CYCLE' ? cycleAnchorDay : null,
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
      after: {
        templateId,
        templateKind: template.kind,
        userIds,
        cycleAnchorDay: template.kind === 'CYCLE' ? cycleAnchorDay : null,
        toleranceSnapshot: template.toleranceMinutes,
        rulesSnapshot,
      },
    });
    return { assigned: userIds.length };
  }

  async listAssignments(me: AuthPayload) {
    const visible = await this.visibleUserIdsFor(me);
    const assignments = await this.prisma.workScheduleAssignment.findMany({
      where: { companyId: me.companyId, endsAt: null, ...(visible ? { userId: { in: [...visible] } } : {}) },
      include: {
        template: {
          select: { id: true, name: true, kind: true, toleranceMinutes: true, cycleRules: true, worksHolidays: true },
        },
      },
      orderBy: { startsAt: 'desc' },
      take: 500,
    });
    return this.withUserNames(me.companyId, assignments);
  }

  async options(me: AuthPayload) {
    const visible = await this.visibleUserIdsFor(me);
    const users = await this.prisma.user.findMany({
      where: { companyId: me.companyId, deletedAt: null, active: true, ...(visible ? { id: { in: [...visible] } } : {}) },
      select: { id: true, name: true, email: true, jobTitle: true },
      orderBy: { name: 'asc' },
    });
    return { users };
  }

  // ------------------------------ Feriados ------------------------------

  async listHolidays(me: AuthPayload, year?: string) {
    const y = /^\d{4}$/.test(String(year ?? '')) ? String(year) : String(new Date().getUTCFullYear());
    return this.prisma.companyHoliday.findMany({
      where: { companyId: me.companyId, dayKey: { gte: `${y}-01-01`, lte: `${y}-12-31` } },
      orderBy: { dayKey: 'asc' },
    });
  }

  async createHoliday(me: AuthPayload, body: any = {}) {
    const dayKey = String(body?.dayKey ?? '');
    if (!isValidDayKey(dayKey)) throw new BadRequestException('Data inválida (use YYYY-MM-DD).');
    const name = text(body?.name);
    if (!name) throw new BadRequestException('Nome do feriado é obrigatório.');
    const kind = ['NATIONAL', 'STATE', 'MUNICIPAL', 'COMPANY'].includes(body?.kind) ? body.kind : 'COMPANY';
    try {
      const holiday = await this.prisma.companyHoliday.create({
        data: { companyId: me.companyId, dayKey, name, kind, createdById: me.sub },
      });
      await this.audit.record(me, {
        module: MODULE,
        entity: 'CompanyHoliday',
        entityId: holiday.id,
        action: 'CREATE',
        message: `Feriado "${name}" em ${dayKey}`,
        after: { dayKey, name, kind },
      });
      return holiday;
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Já existe um feriado cadastrado nesta data.');
      throw error;
    }
  }

  async deleteHoliday(me: AuthPayload, id: string) {
    const holiday = await this.prisma.companyHoliday.findFirst({ where: { id, companyId: me.companyId } });
    if (!holiday) throw new NotFoundException('Feriado não encontrado.');
    await this.prisma.companyHoliday.delete({ where: { id } });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'CompanyHoliday',
      entityId: id,
      action: 'DELETE',
      message: `Feriado "${holiday.name}" (${holiday.dayKey}) removido`,
      before: { dayKey: holiday.dayKey, name: holiday.name },
    });
    return { deleted: true };
  }

  /** Carrega os feriados nacionais do ano (fixos + Sexta-feira Santa), sem duplicar. */
  async generateHolidays(me: AuthPayload, body: any = {}) {
    const year = Number(body?.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new BadRequestException('Ano inválido.');
    const list = nationalHolidaysFor(year);
    const result = await this.prisma.companyHoliday.createMany({
      data: list.map((holiday) => ({
        companyId: me.companyId,
        dayKey: holiday.dayKey,
        name: holiday.name,
        kind: 'NATIONAL',
        createdById: me.sub,
      })),
      skipDuplicates: true,
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'CompanyHoliday',
      action: 'GENERATE',
      message: `Feriados nacionais de ${year} carregados (${result.count} novos)`,
      after: { year, created: result.count },
    });
    return { created: result.count, total: list.length };
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
    // Fechamento transacional e versionado: cada fechamento gera uma versão
    // imutável do consolidado (reabrir + fechar de novo não apaga o anterior).
    const { period, totals } = await this.prisma.$transaction(async (tx) => {
      // O mesmo lock é adquirido por batidas/importações/ajustes. Enquanto o
      // snapshot é calculado, nenhum writer do módulo entra na competência.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${me.companyId}:period:${ref}`}))`;
      const existing = await tx.timesheetPeriod.findUnique({
        where: { companyId_periodRef: { companyId: me.companyId, periodRef: ref } },
      });
      if (existing?.status === 'CLOSED') throw new ConflictException('Competência já está fechada.');
      // Consolida o mês por colaborador: alimenta banco de horas e folha sem
      // recalcular versões fechadas.
      const totals = await this.computeMonthTotals(me.companyId, ref);
      const version = (existing?.version ?? 0) + 1;
      const saved = await tx.timesheetPeriod.upsert({
        where: { companyId_periodRef: { companyId: me.companyId, periodRef: ref } },
        create: {
          companyId: me.companyId,
          periodRef: ref,
          status: 'CLOSED',
          closedById: me.sub,
          closedAt: new Date(),
          totals,
          version,
        },
        update: { status: 'CLOSED', closedById: me.sub, closedAt: new Date(), totals, version },
      });
      await tx.timesheetPeriodVersion.create({
        data: { companyId: me.companyId, periodRef: ref, version, totals, closedById: me.sub },
      });
      return { period: saved, totals };
    }, { timeout: 120_000, maxWait: 15_000 });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'TimesheetPeriod',
      entityId: period.id,
      action: 'PERIOD_CLOSED',
      message: `Competência ${ref} fechada (versão ${period.version}; ${totals.entries} batidas, ${Object.keys(totals.users).length} colaboradores)`,
      after: { version: period.version },
    });
    return period;
  }

  /** Consolidado do mês por colaborador (usado no fechamento e no relatório). */
  private async computeMonthTotals(companyId: string, ref: string) {
    const { first, last } = monthBounds(ref);
    const today = dayKeyFor(new Date());
    const to = last > today ? today : last;
    const [entryUsers, assignmentUsers] = await Promise.all([
      this.prisma.timeClockEntry.findMany({
        where: { companyId, dayKey: { gte: first, lte: to }, status: 'VALID', treatments: { none: { action: 'EXCLUDE' } } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.workScheduleAssignment.findMany({
        where: {
          companyId,
          startsAt: { lte: companyTimeToUtc(to, '23:59') },
          OR: [{ endsAt: null }, { endsAt: { gte: companyTimeToUtc(first, '00:00') } }],
        },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);
    const userIds = [...new Set([...entryUsers.map((u) => u.userId), ...assignmentUsers.map((u) => u.userId)])];
    const users: Record<string, { plannedMinutes: number; workedMinutes: number; balanceMinutes: number; absentDays: number; inconsistentDays: number; punches: number }> = {};
    let entries = 0;
    for (const userId of userIds) {
      const days = await this.buildMirrorDays(companyId, userId, first, to);
      const totals = sumTotals(days);
      const punches = days.reduce((sum, d) => sum + d.entries.length, 0);
      entries += punches;
      users[userId] = {
        plannedMinutes: totals.plannedMinutes,
        workedMinutes: totals.workedMinutes,
        balanceMinutes: totals.balanceMinutes,
        absentDays: totals.absentDays,
        inconsistentDays: totals.inconsistentDays,
        punches,
      };
    }
    return { entries, users };
  }

  /** Relatório da competência p/ folha: consolidado do fechamento ou cálculo ao vivo. */
  async periodReport(me: AuthPayload, ref: string) {
    this.assertPeriodRef(ref);
    const period = await this.prisma.timesheetPeriod.findUnique({
      where: { companyId_periodRef: { companyId: me.companyId, periodRef: ref } },
    });
    const stored = period?.status === 'CLOSED' ? ((period.totals as any)?.users as Record<string, any> | undefined) : undefined;
    const usersTotals = stored ?? (await this.computeMonthTotals(me.companyId, ref)).users;

    const visible = await this.visibleUserIdsFor(me);
    const ids = Object.keys(usersTotals).filter((id) => !visible || visible.has(id));
    const people = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids }, companyId: me.companyId },
          select: { id: true, name: true, email: true },
        })
      : [];
    const byId = new Map(people.map((p) => [p.id, p]));
    const rows = ids
      .map((userId) => ({
        user: byId.get(userId) ?? { id: userId, name: 'Colaborador removido', email: '' },
        ...usersTotals[userId],
      }))
      .sort((a, b) => a.user.name.localeCompare(b.user.name, 'pt-BR'));

    return { periodRef: ref, status: period?.status ?? 'OPEN', closedAt: period?.closedAt ?? null, rows };
  }

  /** CSV do relatório da competência (download para conferência/folha). */
  async periodReportCsv(me: AuthPayload, ref: string) {
    const report = await this.periodReport(me, ref);
    const header = 'colaborador;email;horas_previstas;horas_trabalhadas;saldo_minutos;faltas;dias_inconsistentes;batidas';
    const lines = report.rows.map((row: any) =>
      [
        csvSafe(row.user.name),
        csvSafe(row.user.email),
        (row.plannedMinutes / 60).toFixed(2).replace('.', ','),
        (row.workedMinutes / 60).toFixed(2).replace('.', ','),
        String(row.balanceMinutes),
        String(row.absentDays),
        String(row.inconsistentDays),
        String(row.punches ?? ''),
      ].join(';'),
    );
    // BOM para o Excel abrir com acentuação correta.
    const content = Buffer.from(`﻿${[header, ...lines].join('\r\n')}\r\n`, 'utf8');
    return { fileName: `ponto-${ref}.csv`, content, mimeType: 'text/csv; charset=utf-8' };
  }

  async reopenPeriod(me: AuthPayload, ref: string, body: any = {}) {
    this.assertPeriodRef(ref);
    const note = text(body?.note ?? body?.justification);
    if (!note) throw new BadRequestException('Justificativa é obrigatória para reabrir a competência.');
    const period = await this.prisma.timesheetPeriod.findUnique({
      where: { companyId_periodRef: { companyId: me.companyId, periodRef: ref } },
    });
    if (!period || period.status !== 'CLOSED') throw new ConflictException('Competência não está fechada.');
    const reopened = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${me.companyId}:period:${ref}`}))`;
      const current = await tx.timesheetPeriod.findUnique({
        where: { companyId_periodRef: { companyId: me.companyId, periodRef: ref } },
      });
      if (!current || current.status !== 'CLOSED') throw new ConflictException('Competência não está fechada.');
      const updated = await tx.timesheetPeriod.update({
        where: { id: current.id },
        data: { status: 'OPEN' },
      });
      // Registra quem/quando/por quê na versão que estava vigente.
      await tx.timesheetPeriodVersion.updateMany({
        where: { companyId: me.companyId, periodRef: ref, version: current.version },
        data: { reopenedById: me.sub, reopenedAt: new Date(), reopenNote: note },
      });
      return updated;
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'TimesheetPeriod',
      entityId: period.id,
      action: 'PERIOD_REOPENED',
      message: `Competência ${ref} reaberta (versão ${period.version}): ${note}`,
      after: { note, version: period.version },
    });
    return reopened;
  }

  /** Histórico de fechamentos da competência (versões imutáveis). */
  async periodVersions(me: AuthPayload, ref: string) {
    this.assertPeriodRef(ref);
    const versions = await this.prisma.timesheetPeriodVersion.findMany({
      where: { companyId: me.companyId, periodRef: ref },
      orderBy: { version: 'desc' },
    });
    return this.withUserNames(me.companyId, versions, 'closedById');
  }

  // ------------------------------ Internos ------------------------------

  private async buildMyDay(me: AuthPayload, dayKey: string) {
    const days = await this.buildMirrorDays(me.companyId, me.sub, dayKey, dayKey);
    const day = days[0];
    return { ...day, nextKind: day.entries.length % 2 === 0 ? 'IN' : 'OUT' };
  }

  private async buildMirrorDays(companyId: string, userId: string, fromKey: string, toKey: string) {
    // Janela estendida em ±1 dia: jornadas noturnas têm a saída no dia civil
    // seguinte, e o primeiro dia do intervalo pode "doar" batidas para o anterior.
    const extendedFrom = addDays(fromKey, -1);
    const extendedTo = addDays(toKey, 1);
    const [entries, assignments, adjustments, coverageMap, holidays] = await Promise.all([
      this.prisma.timeClockEntry.findMany({
        where: {
          companyId,
          userId,
          dayKey: { gte: extendedFrom, lte: extendedTo },
          status: 'VALID',
          treatments: { none: { action: 'EXCLUDE' } },
        },
        orderBy: { punchedAt: 'asc' },
      }),
      this.assignmentsForRange(companyId, userId, extendedFrom, extendedTo),
      this.prisma.timeAdjustmentRequest.findMany({
        where: { companyId, userId, dayKey: { gte: fromKey, lte: toKey } },
        orderBy: { createdAt: 'desc' },
      }),
      this.vacations.coverageForUsers(companyId, [userId], fromKey, toKey),
      this.holidayMap(companyId, extendedFrom, toKey),
    ]);
    const adjustmentByDay = new Map<string, (typeof adjustments)[number]>();
    for (const adjustment of adjustments) {
      if (!adjustmentByDay.has(adjustment.dayKey)) adjustmentByDay.set(adjustment.dayKey, adjustment);
    }
    return this.composeUserDays({
      userId,
      fromKey,
      toKey,
      entries,
      assignments,
      holidays,
      coverageDays: coverageMap.get(userId) ?? new Map<string, DayCoverage>(),
      adjustmentByDay,
    });
  }

  /**
   * Composição do espelho de um colaborador: atribui batidas ao dia de jornada
   * (jornadas noturnas puxam a saída do dia civil seguinte), aplica feriados,
   * cobertura de férias/afastamento e a tolerância por marcação, e avalia o dia.
   */
  private composeUserDays(input: {
    userId: string;
    fromKey: string;
    toKey: string;
    entries: Array<{
      id: string;
      punchedAt: Date;
      source: string;
      note: string | null;
      latitude: number | null;
      longitude: number | null;
    }>;
    assignments: Array<{ userId: string; startsAt: Date; endsAt: Date | null; rulesSnapshot?: unknown; toleranceSnapshot?: number | null; template: { weeklyRules: unknown; toleranceMinutes: number } }>;
    holidays: Map<string, string>;
    coverageDays: Map<string, DayCoverage>;
    adjustmentByDay?: Map<string, { id: string; status: string; reason: string }>;
  }) {
    const { userId, fromKey, toKey, entries, assignments, holidays, coverageDays, adjustmentByDay } = input;
    const today = dayKeyFor(new Date());
    const byCivilDay = groupBy(entries, (e) => dayKeyFor(e.punchedAt));
    const ruleCache = new Map<string, ReturnType<PersonnelService['resolveRule']>>();
    const resolvedFor = (dayKey: string) => {
      let resolved = ruleCache.get(dayKey);
      if (!resolved) {
        resolved = this.resolveRule(assignments, userId, dayKey);
        ruleCache.set(dayKey, resolved);
      }
      return resolved;
    };
    const dayRuleAt = (dayKey: string) => {
      const resolved = resolvedFor(dayKey);
      return dayRuleFromSchedule(dayKey, resolved.rules, resolved.cycleAnchorDay);
    };

    const attributed = attributePunches({
      days: enumerateDays(addDays(fromKey, -1), toKey),
      byCivilDay,
      timeOf: (entry) => entry.punchedAt,
      ruleFor: dayRuleAt,
    });

    return enumerateDays(fromKey, toKey).map((dayKey) => {
      const dayEntries = attributed.get(dayKey) ?? [];
      const coverage = coverageDays.get(dayKey) ?? null;
      const holidayName = holidays.get(dayKey) ?? null;
      const resolved = resolvedFor(dayKey);
      // Algumas escalas autorizadas mantêm a jornada prevista em feriados.
      const holidayCounts = Boolean(holidayName) && !resolved.worksHolidays;
      const abonado = Boolean(coverage) || holidayCounts;
      const plannedMinutes = abonado ? 0 : plannedMinutesFromSchedule(dayKey, resolved.rules, resolved.cycleAnchorDay);
      const { workedMinutes, open, marks } = effectiveWorkedMinutes({
        punches: dayEntries.map((entry) => entry.punchedAt),
        dayKey,
        rule: abonado ? null : dayRuleAt(dayKey),
        toleranceMinutes: resolved.toleranceMinutes,
      });
      const evaluation = evaluateDay({
        punchCount: dayEntries.length,
        workedMinutes,
        plannedMinutes,
        isToday: dayKey === today,
        hasOpenPair: open,
        coverage,
        isHoliday: holidayCounts,
      });
      const adjustment = adjustmentByDay?.get(dayKey);
      return {
        dayKey,
        weekday: weekdayOf(dayKey),
        hasSchedule: resolved.hasSchedule,
        holiday: holidayName,
        plannedMinutes,
        workedMinutes,
        ...evaluation,
        adjustment: adjustment ? { id: adjustment.id, status: adjustment.status, reason: adjustment.reason } : null,
        entries: dayEntries.map((entry, index) => publicEntry(entry, index)),
        toleranceMarks: marks,
      };
    });
  }

  /** Feriados da empresa no intervalo, indexados por dayKey. */
  private async holidayMap(companyId: string, fromKey: string, toKey: string): Promise<Map<string, string>> {
    const rows = await this.prisma.companyHoliday.findMany({
      where: { companyId, dayKey: { gte: fromKey, lte: toKey } },
      select: { dayKey: true, name: true },
    });
    return new Map(rows.map((row) => [row.dayKey, row.name]));
  }

  /**
   * Abrangência do gestor: conjunto de userIds visíveis pela visibilidade por
   * área da plataforma (módulo access; null = sem restrição configurada).
   * O vínculo usuário→área vem do prontuário (PersonnelEmployeeProfile →
   * OrgEmployee.orgNode). O próprio usuário sempre se enxerga.
   */
  private async visibleUserIdsFor(me: AuthPayload): Promise<Set<string> | null> {
    let filter: string[] | null = null;
    try {
      filter = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    } catch {
      filter = null;
    }
    if (!filter) return null;
    const profiles = await this.prisma.personnelEmployeeProfile.findMany({
      where: { companyId: me.companyId, userId: { not: null }, employee: { orgNodeId: { in: filter } } },
      select: { userId: true },
    });
    const ids = new Set<string>();
    for (const profile of profiles) if (profile.userId) ids.add(profile.userId);
    ids.add(me.sub);
    return ids;
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
      include: { template: { select: { name: true, kind: true, weeklyRules: true, toleranceMinutes: true, active: true } } },
      orderBy: { startsAt: 'desc' },
    });
  }

  // ------------------------------ Comprovante e memória de cálculo ------------------------------

  /** Dados imutáveis do extrato interno. Não é comprovante REP-P assinado/certificado. */
  async punchReceipt(me: AuthPayload, entryId: string) {
    const entry = await this.prisma.timeClockEntry.findFirst({
      where: { id: entryId, companyId: me.companyId, userId: me.sub },
      include: { receiptSnapshot: true },
    });
    if (!entry) throw new NotFoundException('Batida não encontrada.');
    let snapshot = entry.receiptSnapshot;
    if (!snapshot) {
      const [company, user, profile] = await Promise.all([
        this.prisma.company.findUnique({ where: { id: me.companyId }, select: { name: true, cnpj: true } }),
        this.prisma.user.findUnique({ where: { id: me.sub }, select: { name: true } }),
        this.prisma.personnelEmployeeProfile.findFirst({
          where: { companyId: me.companyId, userId: me.sub },
          select: { cpf: true },
          orderBy: { updatedAt: 'desc' },
        }),
      ]);
      if (!company || !user) throw new NotFoundException('Dados cadastrais da marcação não encontrados.');
      snapshot = await this.prisma.timeClockReceiptSnapshot.upsert({
        where: { entryId: entry.id },
        create: {
          companyId: me.companyId,
          entryId: entry.id,
          companyName: company.name,
          companyRegistrationMasked: maskRegistration(company.cnpj),
          employeeName: user.name,
          employeeRegistrationMasked: maskRegistration(profile?.cpf),
          timezone: COMPANY_TIMEZONE,
          snapshotOrigin: 'ON_DEMAND_LEGACY',
          checksum: sha256(`${entry.id}|${entry.hash}|${entry.punchedAt.toISOString()}|${entry.sequenceScope}|${entry.nsr}`),
        },
        update: {},
      });
    }
    await this.audit.record(me, {
      module: MODULE,
      entity: 'TimeClockEntry',
      entityId: entry.id,
      action: 'INTERNAL_RECORD_EXTRACT',
      message: `Extrato interno da marcação ${entry.nsr} emitido`,
    });
    return {
      documentType: 'INTERNAL_TIME_RECORD_EXTRACT',
      legalNotice: 'Extrato interno de marcação. Não substitui comprovante REP-P assinado nem comprova certificação legal do sistema.',
      company: { name: snapshot.companyName, registrationMasked: snapshot.companyRegistrationMasked },
      employee: { name: snapshot.employeeName, registrationMasked: snapshot.employeeRegistrationMasked },
      entry: {
        id: entry.id,
        dayKey: entry.dayKey,
        punchedAt: entry.punchedAt,
        recordedAt: entry.createdAt,
        kind: entry.kind,
        source: entry.source,
        nsr: entry.nsr.toString(),
        recordSequence: entry.nsr.toString(),
      },
      snapshot: {
        capturedAt: snapshot.capturedAt,
        origin: snapshot.snapshotOrigin,
        timezone: snapshot.timezone,
        checksum: snapshot.checksum,
      },
      generatedAt: new Date(),
    };
  }

  /**
   * "Entenda este cálculo": memória de cálculo do dia, reproduzível a partir
   * das mesmas funções puras usadas no espelho (batidas consideradas e
   * desconsideradas, regra/vigência aplicada, tolerâncias, pares e saldo).
   */
  async explainDay(me: AuthPayload, targetUserId: string, dayKey: string) {
    if (!isValidDayKey(dayKey)) throw new BadRequestException('Dia inválido (use YYYY-MM-DD).');
    await this.assertCanViewTimesheetUser(me, targetUserId);
    const extendedFrom = addDays(dayKey, -1);
    const extendedTo = addDays(dayKey, 1);
    const [entries, cancelled, assignments, coverageMap, holidays, user] = await Promise.all([
      this.prisma.timeClockEntry.findMany({
        where: {
          companyId: me.companyId,
          userId: targetUserId,
          dayKey: { gte: extendedFrom, lte: extendedTo },
          status: 'VALID',
          treatments: { none: { action: 'EXCLUDE' } },
        },
        orderBy: { punchedAt: 'asc' },
      }),
      this.prisma.timeClockEntry.findMany({
        where: {
          companyId: me.companyId,
          userId: targetUserId,
          dayKey,
          OR: [{ status: 'CANCELLED' }, { treatments: { some: { action: 'EXCLUDE' } } }],
        },
        include: { treatments: { where: { action: 'EXCLUDE' }, orderBy: { createdAt: 'desc' }, take: 1 } },
        orderBy: { punchedAt: 'asc' },
      }),
      this.assignmentsForRange(me.companyId, targetUserId, extendedFrom, extendedTo),
      this.vacations.coverageForUsers(me.companyId, [targetUserId], dayKey, dayKey),
      this.holidayMap(me.companyId, extendedFrom, dayKey),
      this.prisma.user.findFirst({ where: { id: targetUserId, companyId: me.companyId }, select: { id: true, name: true } }),
    ]);
    if (!user) throw new NotFoundException('Colaborador não encontrado.');

    const day = this.composeUserDays({
      userId: targetUserId,
      fromKey: dayKey,
      toKey: dayKey,
      entries,
      assignments,
      holidays,
      coverageDays: coverageMap.get(targetUserId) ?? new Map<string, DayCoverage>(),
    })[0];

    const resolved = this.resolveRule(assignments, targetUserId, dayKey);
    const rule = dayRuleFromSchedule(dayKey, resolved.rules, resolved.cycleAnchorDay);
    const dayStart = companyTimeToUtc(dayKey, '00:00');
    const assignment = assignments.find(
      (a) => a.userId === targetUserId && a.startsAt.getTime() <= dayStart.getTime() + 86_399_000 && (!a.endsAt || a.endsAt.getTime() >= dayStart.getTime()),
    );

    const marks = (day as { toleranceMarks?: ToleranceMark[] }).toleranceMarks ?? [];
    const fmt = (date: Date) => formatCompanyTime(date);
    const pairs: string[] = [];
    const effective = marks.map((mark) => mark.effective);
    for (let i = 0; i + 1 < effective.length; i += 2) {
      const minutes = Math.round((effective[i + 1].getTime() - effective[i].getTime()) / 60_000);
      pairs.push(`${fmt(effective[i])} → ${fmt(effective[i + 1])} = ${minutes} min`);
    }

    const steps: string[] = [];
    if (assignment) {
      const kindLabel = assignment.template.kind === 'CYCLE' ? 'ciclo' : 'semanal';
      steps.push(
        `Escala vigente: "${assignment.template.name}" (${kindLabel}, vigência desde ${fmt(assignment.startsAt)}` +
          `${resolved.cycleAnchorDay ? `, âncora do ciclo em ${resolved.cycleAnchorDay}` : ''}). ` +
          (rule ? `Regra do dia: ${rule.start}–${rule.end}${rule.breakMinutes ? ` com ${rule.breakMinutes} min de intervalo` : ''}, tolerância de ±${resolved.toleranceMinutes} min por marcação.` : 'Dia de folga na escala.'),
      );
    } else {
      steps.push('Sem escala vigente para este dia: não há jornada prevista.');
    }
    if (day.holiday) {
      steps.push(
        resolved.worksHolidays
          ? `Feriado "${day.holiday}", mas esta escala trabalha normalmente em feriados (ex.: 12x36) — jornada prevista mantida.`
          : `Feriado "${day.holiday}": jornada prevista zerada (ausência não é falta; trabalho vira crédito).`,
      );
    }
    if (day.status === 'VACATION') steps.push('Dia coberto por férias aprovadas: jornada abonada (saldo 0).');
    if (day.status === 'LEAVE') steps.push('Dia coberto por afastamento/atestado: jornada abonada (saldo 0).');
    if (marks.length) {
      const described = marks.map((mark, index) => {
        const base = `${index + 1}ª ${mark.role === 'ENTRADA' ? 'entrada' : mark.role === 'SAIDA' ? 'saída' : 'marcação'}: ${fmt(mark.original)}`;
        return mark.clamped ? `${base} → considerada ${fmt(mark.effective)} (dentro da janela de tolerância)` : base;
      });
      steps.push(`Batidas consideradas (${marks.length}): ${described.join('; ')}.`);
    } else {
      steps.push('Nenhuma batida válida no dia.');
    }
    if (cancelled.length) {
      steps.push(
        `Batidas desconsideradas na apuração (${cancelled.length}, por tratamento de ajuste aprovado): ${cancelled.map((c) => fmt(c.punchedAt)).join(', ')}. O registro bruto original permanece imutável.`,
      );
    }
    if (pairs.length) steps.push(`Pareamento entrada/saída: ${pairs.join(' + ')} ⇒ ${day.workedMinutes} min trabalhados.`);
    steps.push(
      `Previsto ${day.plannedMinutes} min · trabalhado ${day.workedMinutes} min ⇒ saldo ${day.balanceMinutes >= 0 ? '+' : ''}${day.balanceMinutes} min (situação: ${day.status}).`,
    );

    const response = {
      dayKey,
      user,
      schedule: assignment
        ? { name: assignment.template.name, kind: assignment.template.kind, toleranceMinutes: resolved.toleranceMinutes, cycleAnchorDay: resolved.cycleAnchorDay, rule }
        : null,
      holiday: day.holiday,
      status: day.status,
      plannedMinutes: day.plannedMinutes,
      workedMinutes: day.workedMinutes,
      balanceMinutes: day.balanceMinutes,
      consideredEntries: (day.entries as Array<Record<string, unknown>>).map((entry, index) => ({
        ...entry,
        original: marks[index]?.original ?? null,
        effective: marks[index]?.effective ?? null,
        clamped: marks[index]?.clamped ?? false,
      })),
      cancelledEntries: cancelled.map((entry, index) => ({
        ...publicEntry(entry, index),
        treatmentReason: entry.treatments[0]?.reason ?? (entry.status === 'CANCELLED' ? 'Tratamento legado' : null),
      })),
      pairs,
      steps,
    };

    const inputHash = sha256(
      stableJson({
        algorithmVersion: CALCULATION_ALGORITHM_VERSION,
        dayKey,
        entries: entries.map((entry) => ({
          id: entry.id,
          punchedAt: entry.punchedAt,
          hash: entry.hash,
          status: entry.status,
          nsr: entry.nsr,
        })),
        excluded: cancelled.map((entry) => ({
          id: entry.id,
          status: entry.status,
          treatments: entry.treatments.map((item) => ({ id: item.id, requestId: item.adjustmentRequestId, createdAt: item.createdAt })),
        })),
        assignments: assignments.map((item) => ({
          id: item.id,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          rulesSnapshot: item.rulesSnapshot,
          toleranceSnapshot: item.toleranceSnapshot,
          cycleAnchorDay: item.cycleAnchorDay,
        })),
        holiday: day.holiday,
        status: day.status,
        plannedMinutes: day.plannedMinutes,
        workedMinutes: day.workedMinutes,
        balanceMinutes: day.balanceMinutes,
      }),
    );
    const snapshot = jsonValue(response);
    const memory = await this.prisma.timesheetCalculationMemory.upsert({
      where: {
        companyId_userId_dayKey_algorithmVersion_inputHash: {
          companyId: me.companyId,
          userId: targetUserId,
          dayKey,
          algorithmVersion: CALCULATION_ALGORITHM_VERSION,
          inputHash,
        },
      },
      create: {
        companyId: me.companyId,
        userId: targetUserId,
        dayKey,
        algorithmVersion: CALCULATION_ALGORITHM_VERSION,
        inputHash,
        snapshot,
        calculatedById: me.sub,
      },
      update: {},
      select: { id: true, algorithmVersion: true, inputHash: true, calculatedAt: true },
    });

    return { ...response, memory };
  }

  private resolveRule(
    assignments: Array<{
      userId: string;
      startsAt: Date;
      endsAt: Date | null;
      rulesSnapshot?: unknown;
      toleranceSnapshot?: number | null;
      cycleAnchorDay?: string | null;
      template: { weeklyRules: unknown; toleranceMinutes: number };
    }>,
    userId: string,
    dayKey: string,
  ): { rules: ScheduleRules | null; toleranceMinutes: number; hasSchedule: boolean; cycleAnchorDay: string | null; worksHolidays: boolean } {
    const dayStart = companyTimeToUtc(dayKey, '00:00');
    const match = assignments.find(
      (a) => a.userId === userId && a.startsAt.getTime() <= dayStart.getTime() + 86_399_000 && (!a.endsAt || a.endsAt.getTime() >= dayStart.getTime()),
    );
    if (!match) {
      return { rules: null, toleranceMinutes: DEFAULT_TOLERANCE_MINUTES, hasSchedule: false, cycleAnchorDay: null, worksHolidays: false };
    }
    // O snapshot congela a vigência: editar o template não reescreve o passado.
    const rules = (match.rulesSnapshot ?? match.template.weeklyRules) as ScheduleRules;
    return {
      rules,
      toleranceMinutes: match.toleranceSnapshot ?? match.template.toleranceMinutes,
      hasSchedule: true,
      cycleAnchorDay: match.cycleAnchorDay ?? null,
      worksHolidays: Boolean((rules as { worksHolidays?: boolean })?.worksHolidays),
    };
  }

  private async assertCanViewTimesheetUser(me: AuthPayload, targetUserId: string) {
    if (targetUserId === me.sub) return;
    const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(String(me.role));
    if (!isAdmin) {
      const actor = await this.prisma.user.findFirst({
        where: { id: me.sub, companyId: me.companyId, active: true, deletedAt: null },
        select: {
          permissions: { select: { permission: { select: { key: true } } } },
          accessProfile: { select: { permissions: { select: { permission: { select: { key: true } } } } } },
        },
      });
      const keys = new Set<string>();
      actor?.permissions.forEach((item) => keys.add(item.permission.key));
      actor?.accessProfile?.permissions.forEach((item) => keys.add(item.permission.key));
      if (!keys.has('ponto:team') && !keys.has('ponto:manage')) {
        throw new ForbiddenException('Você não tem permissão para consultar a memória de cálculo de outro colaborador.');
      }
    }
    const visible = await this.visibleUserIdsFor(me);
    if (visible && !visible.has(targetUserId)) throw new ForbiddenException('Colaborador fora da sua abrangência de acesso.');
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

function publicEntry(
  entry: {
    id: string;
    punchedAt: Date;
    source: string;
    note: string | null;
    latitude: number | null;
    longitude: number | null;
    nsr?: bigint | null;
  },
  index: number,
) {
  return {
    id: entry.id,
    punchedAt: entry.punchedAt,
    // Alternância derivada da posição na jornada atribuída (a batida em si é
    // imutável; o rótulo IN/OUT é interpretação da apuração).
    kind: index % 2 === 0 ? 'IN' : 'OUT',
    source: entry.source,
    note: entry.note,
    hasLocation: entry.latitude != null && entry.longitude != null,
    nsr: entry.nsr == null ? null : entry.nsr.toString(),
  };
}

/** Serializa uma batida para resposta HTTP (BigInt → number). */
function serializeEntry<T extends { nsr?: bigint | null }>(entry: T) {
  return { ...entry, nsr: entry.nsr == null ? null : entry.nsr.toString() };
}

/** HH:MM no fuso da empresa (UTC-3). */
function formatCompanyTime(date: Date): string {
  return new Date(date.getTime() - 3 * 60 * 60_000).toISOString().slice(11, 16);
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

function normalizeSyncId(value: unknown): string | null {
  const syncId = text(value);
  if (!syncId) return null;
  if (syncId.length < 8 || syncId.length > 120 || !/^[A-Za-z0-9._:-]+$/.test(syncId)) {
    throw new BadRequestException('Identificador de sincronização inválido.');
  }
  return syncId;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  throw new BadRequestException('Valor booleano inválido.');
}

function maskRegistration(value: string | null | undefined): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? `***${digits.slice(-4)}` : null;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner) => {
    if (typeof inner === 'bigint') return inner.toString();
    if (inner instanceof Date) return inner.toISOString();
    return inner;
  });
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(stableJson(value)) as Prisma.InputJsonValue;
}

function finiteOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function csvSafe(value: string): string {
  return String(value ?? '').replaceAll(';', ',').replaceAll(/\r?\n/g, ' ');
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new BadRequestException('Valor numérico inválido.');
  return Math.min(max, Math.max(min, Math.round(n)));
}
