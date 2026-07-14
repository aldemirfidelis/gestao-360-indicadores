import { describe, expect, it } from 'vitest';
import {
  bankBalance,
  creditExpiryDate,
  expiringUntil,
  limitAlerts,
  normalizePolicy,
  planExpirations,
  type BankEntryLike,
} from './time-bank.logic';

const entry = (over: Partial<BankEntryLike> & { id: string; minutes: number }): BankEntryLike => ({
  kind: over.minutes >= 0 ? 'CREDIT' : 'DEBIT',
  expiresAt: null,
  consumed: 0,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
});

describe('time-bank.logic', () => {
  it('normalizePolicy: aplica clamps legais (validade 1..12)', () => {
    expect(normalizePolicy({ validityMonths: 6 }).validityMonths).toBe(6);
    expect(normalizePolicy({ validityMonths: 24 }).validityMonths).toBe(12);
    expect(normalizePolicy({ validityMonths: 0 }).validityMonths).toBe(1);
    expect(normalizePolicy({ maxPositiveMinutes: -5 }).maxPositiveMinutes).toBeNull();
    expect(normalizePolicy({ expirationAction: 'EXPIRE' }).expirationAction).toBe('EXPIRE');
    expect(normalizePolicy(null).validityMonths).toBe(6);
  });

  it('bankBalance: soma com sinal', () => {
    expect(bankBalance([entry({ id: 'a', minutes: 600 }), entry({ id: 'b', minutes: -150 })])).toBe(450);
    expect(bankBalance([])).toBe(0);
  });

  it('creditExpiryDate: soma meses de validade', () => {
    expect(creditExpiryDate(new Date('2026-01-31T00:00:00Z'), 6).toISOString().slice(0, 7)).toBe('2026-07');
  });

  it('planExpirations: consome FIFO só o excedente positivo, respeitando débitos', () => {
    const now = new Date('2026-08-01T00:00:00Z');
    const entries = [
      entry({ id: 'jan', minutes: 300, expiresAt: new Date('2026-07-01T00:00:00Z'), createdAt: new Date('2026-01-31') }),
      entry({ id: 'feb', minutes: 200, expiresAt: new Date('2026-08-15T00:00:00Z'), createdAt: new Date('2026-02-28') }),
      entry({ id: 'debito', minutes: -100 }),
    ];
    // Saldo = 400. Só 'jan' está vencido (300), mas expira no máx. o saldo positivo.
    const plans = planExpirations(entries, now, 'PAYOUT');
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ entryId: 'jan', minutes: 300, kind: 'PAYOUT' });
  });

  it('planExpirations: saldo positivo menor que o crédito vencido limita a expiração', () => {
    const now = new Date('2026-08-01T00:00:00Z');
    const entries = [
      entry({ id: 'jan', minutes: 300, expiresAt: new Date('2026-07-01T00:00:00Z') }),
      entry({ id: 'debito', minutes: -250 }),
    ];
    // Saldo = 50: só 50 minutos do crédito vencido ainda "existem".
    const plans = planExpirations(entries, now, 'EXPIRE');
    expect(plans).toEqual([{ entryId: 'jan', minutes: 50, kind: 'EXPIRE', periodExpiredAt: entries[0].expiresAt }]);
  });

  it('planExpirations: nada a expirar quando saldo <= 0 ou nada vencido', () => {
    const now = new Date('2026-08-01T00:00:00Z');
    expect(planExpirations([entry({ id: 'x', minutes: -100 })], now, 'EXPIRE')).toEqual([]);
    expect(planExpirations([entry({ id: 'y', minutes: 200, expiresAt: new Date('2027-01-01') })], now, 'EXPIRE')).toEqual([]);
  });

  it('limitAlerts: acusa excedente de teto positivo e negativo', () => {
    const policy = normalizePolicy({ maxPositiveMinutes: 1200, maxNegativeMinutes: 600 });
    expect(limitAlerts(1500, policy)).toEqual([{ type: 'MAX_POSITIVE', overBy: 300 }]);
    expect(limitAlerts(-800, policy)).toEqual([{ type: 'MAX_NEGATIVE', overBy: 200 }]);
    expect(limitAlerts(500, policy)).toEqual([]);
  });

  it('expiringUntil: soma créditos que vencem na janela', () => {
    const from = new Date('2026-08-01T00:00:00Z');
    const horizon = new Date('2026-09-01T00:00:00Z');
    const entries = [
      entry({ id: 'a', minutes: 120, expiresAt: new Date('2026-08-20') }),
      entry({ id: 'b', minutes: 90, expiresAt: new Date('2026-10-01') }),
      entry({ id: 'c', minutes: 60, expiresAt: new Date('2026-08-10'), consumed: 20 }),
    ];
    expect(expiringUntil(entries, from, horizon)).toBe(160); // 120 + (60-20)
  });
});
