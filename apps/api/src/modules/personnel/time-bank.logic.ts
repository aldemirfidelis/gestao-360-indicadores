/**
 * Lógica pura do banco de horas (sem banco de dados): saldo, projeção de
 * vencimento e consumo FIFO de créditos vencidos. Totalmente testável.
 */

export interface BankEntryLike {
  id: string;
  kind: string; // CREDIT | DEBIT | EXPIRE | PAYOUT | ADJUSTMENT
  minutes: number; // com sinal
  expiresAt: Date | null;
  consumed: number; // minutos já consumidos deste crédito
  createdAt: Date;
}

export interface BankPolicyLike {
  enabled: boolean;
  validityMonths: number;
  maxPositiveMinutes: number | null;
  maxNegativeMinutes: number | null;
  expirationAction: string; // EXPIRE | PAYOUT
}

export const DEFAULT_BANK_POLICY: BankPolicyLike = {
  enabled: true,
  validityMonths: 6,
  maxPositiveMinutes: null,
  maxNegativeMinutes: null,
  expirationAction: 'PAYOUT',
};

/** Normaliza uma política recebida (clamps legais: validade 1..12 meses). */
export function normalizePolicy(input: Partial<BankPolicyLike> | null | undefined): BankPolicyLike {
  const base = { ...DEFAULT_BANK_POLICY, ...(input ?? {}) };
  return {
    enabled: Boolean(base.enabled),
    validityMonths: clampInt(base.validityMonths, 1, 12, 6),
    maxPositiveMinutes: nonNegativeOrNull(base.maxPositiveMinutes),
    maxNegativeMinutes: nonNegativeOrNull(base.maxNegativeMinutes),
    expirationAction: base.expirationAction === 'EXPIRE' ? 'EXPIRE' : 'PAYOUT',
  };
}

/** Saldo total do razão (soma dos minutos). */
export function bankBalance(entries: BankEntryLike[]): number {
  return entries.reduce((sum, entry) => sum + entry.minutes, 0);
}

/** Data de vencimento de um crédito fechado em `closedAt` conforme a política. */
export function creditExpiryDate(closedAt: Date, validityMonths: number): Date {
  const d = new Date(closedAt);
  d.setMonth(d.getMonth() + validityMonths);
  return d;
}

export interface ExpirationPlan {
  entryId: string;
  minutes: number; // sempre positivo (quanto expira/paga)
  kind: 'EXPIRE' | 'PAYOUT';
  periodExpiredAt: Date;
}

/**
 * Créditos vencidos (expiresAt <= now) ainda não totalmente consumidos, e que
 * ainda "sobrevivem" no saldo positivo atual — consumo FIFO. Débitos já
 * abatem o saldo, então só expira o excedente positivo mais antigo.
 */
export function planExpirations(entries: BankEntryLike[], now: Date, action: 'EXPIRE' | 'PAYOUT'): ExpirationPlan[] {
  const balance = bankBalance(entries);
  if (balance <= 0) return [];
  // Ordena créditos por vencimento (mais antigo primeiro).
  const expiredCredits = entries
    .filter((e) => e.minutes > 0 && e.expiresAt && e.expiresAt.getTime() <= now.getTime())
    .filter((e) => e.consumed < e.minutes)
    .sort((a, b) => (a.expiresAt!.getTime() - b.expiresAt!.getTime()) || (a.createdAt.getTime() - b.createdAt.getTime()));

  let remainingPositive = balance;
  const plans: ExpirationPlan[] = [];
  for (const credit of expiredCredits) {
    if (remainingPositive <= 0) break;
    const available = credit.minutes - credit.consumed;
    const toExpire = Math.min(available, remainingPositive);
    if (toExpire > 0) {
      plans.push({ entryId: credit.id, minutes: toExpire, kind: action, periodExpiredAt: credit.expiresAt! });
      remainingPositive -= toExpire;
    }
  }
  return plans;
}

/** Alertas de teto de saldo (excedente positivo/negativo além do configurado). */
export function limitAlerts(balance: number, policy: BankPolicyLike): Array<{ type: 'MAX_POSITIVE' | 'MAX_NEGATIVE'; overBy: number }> {
  const alerts: Array<{ type: 'MAX_POSITIVE' | 'MAX_NEGATIVE'; overBy: number }> = [];
  if (policy.maxPositiveMinutes != null && balance > policy.maxPositiveMinutes) {
    alerts.push({ type: 'MAX_POSITIVE', overBy: balance - policy.maxPositiveMinutes });
  }
  if (policy.maxNegativeMinutes != null && balance < -policy.maxNegativeMinutes) {
    alerts.push({ type: 'MAX_NEGATIVE', overBy: -policy.maxNegativeMinutes - balance });
  }
  return alerts;
}

/** Minutos de crédito que vencem até `horizon` (projeção de vencimento). */
export function expiringUntil(entries: BankEntryLike[], from: Date, horizon: Date): number {
  return entries
    .filter((e) => e.minutes > 0 && e.expiresAt && e.expiresAt.getTime() > from.getTime() && e.expiresAt.getTime() <= horizon.getTime())
    .reduce((sum, e) => sum + (e.minutes - e.consumed), 0);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function nonNegativeOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}
