import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AccessService } from '../access/access.service';
import { AuthPayload } from '../auth/auth.types';
import {
  bankBalance,
  creditExpiryDate,
  expiringUntil,
  limitAlerts,
  normalizePolicy,
  planExpirations,
  type BankEntryLike,
  type BankPolicyLike,
} from './time-bank.logic';

const MODULE = 'personnel';
type Tx = Prisma.TransactionClient;

/**
 * Banco de horas como livro-razão (TimeBankEntry). O fechamento posta o saldo
 * consolidado da competência como CREDIT/DEBIT com vencimento pela política da
 * empresa; a varredura de vencimento consome créditos FIFO (EXPIRE/PAYOUT).
 */
@Injectable()
export class TimeBankService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
    private readonly access: AccessService,
  ) {}

  // ------------------------------ Política ------------------------------

  async getPolicy(companyId: string): Promise<BankPolicyLike> {
    const row = await this.prisma.timeBankPolicy.findUnique({ where: { companyId } });
    return normalizePolicy(row ?? undefined);
  }

  async setPolicy(me: AuthPayload, body: any = {}) {
    const policy = normalizePolicy({
      enabled: body?.enabled,
      validityMonths: body?.validityMonths,
      maxPositiveMinutes: body?.maxPositiveMinutes,
      maxNegativeMinutes: body?.maxNegativeMinutes,
      expirationAction: body?.expirationAction,
    });
    const saved = await this.prisma.timeBankPolicy.upsert({
      where: { companyId: me.companyId },
      create: { companyId: me.companyId, ...policy, updatedById: me.sub },
      update: { ...policy, updatedById: me.sub },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'TimeBankPolicy',
      entityId: saved.id,
      action: 'UPDATE',
      message: `Política de banco de horas atualizada (validade ${policy.validityMonths} meses)`,
      after: policy,
    });
    return saved;
  }

  // ------------------------------ Lançamentos do fechamento ------------------------------

  /**
   * Posta o saldo consolidado da competência no razão (dentro da transação do
   * fechamento). Idempotente: repõe o lançamento CLOSING da competência.
   */
  async postClosingEntries(
    tx: Tx,
    companyId: string,
    ref: string,
    users: Record<string, { balanceMinutes: number }>,
    closedAt: Date,
    closedById: string,
    policy: BankPolicyLike,
  ) {
    await tx.timeBankEntry.deleteMany({ where: { companyId, periodRef: ref, source: 'CLOSING' } });
    const rows: Prisma.TimeBankEntryCreateManyInput[] = [];
    for (const [userId, totals] of Object.entries(users)) {
      const minutes = Math.round(totals.balanceMinutes ?? 0);
      if (minutes === 0) continue;
      rows.push({
        companyId,
        userId,
        kind: minutes >= 0 ? 'CREDIT' : 'DEBIT',
        source: 'CLOSING',
        minutes,
        periodRef: ref,
        // Débitos não vencem; créditos vencem pela validade da política.
        expiresAt: minutes > 0 && policy.enabled ? creditExpiryDate(closedAt, policy.validityMonths) : null,
        createdById: closedById,
      });
    }
    if (rows.length) await tx.timeBankEntry.createMany({ data: rows });
    return rows.length;
  }

  /** Remove os lançamentos de fechamento de uma competência (reabertura). */
  async removeClosingEntries(tx: Tx, companyId: string, ref: string) {
    await tx.timeBankEntry.deleteMany({ where: { companyId, periodRef: ref, source: 'CLOSING' } });
  }

  // ------------------------------ Extrato / saldo ------------------------------

  private async entriesFor(companyId: string, userId: string): Promise<BankEntryLike[]> {
    const rows = await this.prisma.timeBankEntry.findMany({
      where: { companyId, userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      minutes: row.minutes,
      expiresAt: row.expiresAt,
      consumed: row.consumed,
      createdAt: row.createdAt,
    }));
  }

  /** Saldo do razão do colaborador (não inclui a competência aberta ao vivo). */
  async ledgerBalance(companyId: string, userId: string): Promise<number> {
    return bankBalance(await this.entriesFor(companyId, userId));
  }

  /** Extrato completo: saldo, lançamentos, projeção de vencimento e alertas. */
  async statement(me: AuthPayload, targetUserId?: string) {
    const userId = targetUserId ?? me.sub;
    if (targetUserId && targetUserId !== me.sub) {
      const visible = await this.visibleUserIds(me);
      if (visible && !visible.has(targetUserId)) throw new NotFoundException('Colaborador não encontrado na sua abrangência.');
    }
    const [rows, policy] = await Promise.all([
      this.prisma.timeBankEntry.findMany({ where: { companyId: me.companyId, userId }, orderBy: { createdAt: 'desc' }, take: 200 }),
      this.getPolicy(me.companyId),
    ]);
    const entries: BankEntryLike[] = rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      minutes: row.minutes,
      expiresAt: row.expiresAt,
      consumed: row.consumed,
      createdAt: row.createdAt,
    }));
    const balance = bankBalance(entries);
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86_400_000);
    return {
      balanceMinutes: balance,
      policy,
      expiringSoonMinutes: expiringUntil(entries, now, in30),
      alerts: limitAlerts(balance, policy),
      entries: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        source: row.source,
        minutes: row.minutes,
        periodRef: row.periodRef,
        expiresAt: row.expiresAt,
        note: row.note,
        createdAt: row.createdAt,
      })),
    };
  }

  // ------------------------------ Ajuste manual ------------------------------

  async manualEntry(me: AuthPayload, body: any = {}) {
    const userId = String(body?.userId ?? '');
    if (!userId) throw new BadRequestException('Colaborador é obrigatório.');
    const visible = await this.visibleUserIds(me);
    if (visible && !visible.has(userId)) throw new NotFoundException('Colaborador não encontrado na sua abrangência.');
    const minutes = Math.round(Number(body?.minutes));
    if (!Number.isFinite(minutes) || minutes === 0) throw new BadRequestException('Informe uma quantidade de minutos diferente de zero.');
    const note = String(body?.note ?? '').trim();
    if (!note) throw new BadRequestException('Justificativa do lançamento é obrigatória.');
    const kind = body?.kind === 'PAYOUT' ? 'PAYOUT' : 'ADJUSTMENT';

    const entry = await this.prisma.timeBankEntry.create({
      data: {
        companyId: me.companyId,
        userId,
        kind,
        source: 'MANUAL',
        minutes,
        note,
        createdById: me.sub,
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'TimeBankEntry',
      entityId: entry.id,
      action: 'BANK_MANUAL_ENTRY',
      message: `Lançamento manual de banco (${minutes > 0 ? '+' : ''}${minutes} min) para colaborador`,
      after: { userId, minutes, kind, note },
    });
    return entry;
  }

  // ------------------------------ Vencimento ------------------------------

  /**
   * Varre créditos vencidos e consome FIFO (EXPIRE perde / PAYOUT marca p/ folha),
   * idempotente pelo consumo acumulado em cada crédito. Retorna o total processado.
   */
  async runExpiration(companyId: string): Promise<{ users: number; expiredMinutes: number; payoutMinutes: number }> {
    const policy = await this.getPolicy(companyId);
    if (!policy.enabled) return { users: 0, expiredMinutes: 0, payoutMinutes: 0 };
    const now = new Date();
    const dueCredits = await this.prisma.timeBankEntry.findMany({
      where: { companyId, minutes: { gt: 0 }, expiresAt: { lte: now } },
      select: { userId: true },
      distinct: ['userId'],
    });

    let expiredMinutes = 0;
    let payoutMinutes = 0;
    let usersAffected = 0;
    for (const { userId } of dueCredits) {
      const processed = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${companyId}:${userId}:time-bank`}))`;
        const rows = await tx.timeBankEntry.findMany({ where: { companyId, userId }, orderBy: { createdAt: 'asc' } });
        const entries: BankEntryLike[] = rows.map((row) => ({
          id: row.id,
          kind: row.kind,
          minutes: row.minutes,
          expiresAt: row.expiresAt,
          consumed: row.consumed,
          createdAt: row.createdAt,
        }));
        const plans = planExpirations(entries, now, policy.expirationAction === 'EXPIRE' ? 'EXPIRE' : 'PAYOUT');
        let localExpired = 0;
        let localPayout = 0;
        for (const plan of plans) {
          await tx.timeBankEntry.update({
            where: { id: plan.entryId },
            data: { consumed: { increment: plan.minutes } },
          });
          await tx.timeBankEntry.create({
            data: {
              companyId,
              userId,
              kind: plan.kind,
              source: 'EXPIRATION',
              minutes: -plan.minutes,
              periodRef: `exp:${plan.entryId.slice(0, 8)}:${now.toISOString().slice(0, 10)}`,
              note:
                plan.kind === 'PAYOUT'
                  ? 'Crédito vencido — marcado para pagamento na folha.'
                  : 'Crédito vencido — expirado conforme a política.',
              createdById: null,
            },
          });
          if (plan.kind === 'PAYOUT') localPayout += plan.minutes;
          else localExpired += plan.minutes;
        }
        return { localExpired, localPayout, any: plans.length > 0 };
      });
      if (processed.any) usersAffected += 1;
      expiredMinutes += processed.localExpired;
      payoutMinutes += processed.localPayout;
    }
    return { users: usersAffected, expiredMinutes, payoutMinutes };
  }

  private async visibleUserIds(me: AuthPayload): Promise<Set<string> | null> {
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
}
