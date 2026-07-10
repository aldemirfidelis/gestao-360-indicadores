import { describe, expect, it } from 'vitest';
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

const RULES: WeeklyRules = {
  mon: { start: '08:00', end: '17:00', breakMinutes: 60 },
  tue: { start: '08:00', end: '17:00', breakMinutes: 60 },
  wed: { start: '08:00', end: '17:00', breakMinutes: 60 },
  thu: { start: '08:00', end: '17:00', breakMinutes: 60 },
  fri: { start: '08:00', end: '16:00', breakMinutes: 60 },
  sat: null,
  sun: null,
};

describe('time-clock.logic', () => {
  it('dayKeyFor: converte UTC para o dia no fuso da empresa (UTC-3)', () => {
    // 2026-07-10 01:30 UTC = 2026-07-09 22:30 em São Paulo
    expect(dayKeyFor(new Date('2026-07-10T01:30:00Z'))).toBe('2026-07-09');
    expect(dayKeyFor(new Date('2026-07-10T12:00:00Z'))).toBe('2026-07-10');
  });

  it('companyTimeToUtc: 08:00 em São Paulo = 11:00 UTC (inverso do dayKey)', () => {
    const utc = companyTimeToUtc('2026-07-10', '08:00');
    expect(utc.toISOString()).toBe('2026-07-10T11:00:00.000Z');
    expect(dayKeyFor(utc)).toBe('2026-07-10');
  });

  it('weekday e periodRef', () => {
    expect(weekdayOf('2026-07-10')).toBe('fri');
    expect(weekdayOf('2026-07-12')).toBe('sun');
    expect(periodRefOf('2026-07-10')).toBe('2026-07');
  });

  it('isValidDayKey rejeita formatos e datas inválidas', () => {
    expect(isValidDayKey('2026-07-10')).toBe(true);
    expect(isValidDayKey('2026-13-01')).toBe(false);
    expect(isValidDayKey('2026-02-30')).toBe(false);
    expect(isValidDayKey('10/07/2026')).toBe(false);
  });

  it('plannedMinutesFor: dia útil, sexta reduzida e folga', () => {
    expect(plannedMinutesFor('2026-07-09', RULES)).toBe(480); // qui 8h
    expect(plannedMinutesFor('2026-07-10', RULES)).toBe(420); // sex 7h
    expect(plannedMinutesFor('2026-07-11', RULES)).toBe(0); // sáb folga
    expect(plannedMinutesFor('2026-07-09', null)).toBe(0); // sem escala
  });

  it('plannedMinutesFor: jornada noturna que vira o dia', () => {
    const night: WeeklyRules = { mon: { start: '22:00', end: '05:00', breakMinutes: 0 } };
    expect(plannedMinutesFor('2026-07-06', night)).toBe(420); // 7h
  });

  it('pairPunches: pares fecham, ímpar fica em aberto', () => {
    const base = (time: string) => companyTimeToUtc('2026-07-09', time);
    const closed = pairPunches([base('08:00'), base('12:00'), base('13:00'), base('17:00')]);
    expect(closed.workedMinutes).toBe(480);
    expect(closed.open).toBe(false);

    const open = pairPunches([base('08:00'), base('12:00'), base('13:00')]);
    expect(open.workedMinutes).toBe(240); // só o par fechado conta
    expect(open.open).toBe(true);

    // fora de ordem: ordena antes de parear
    const unordered = pairPunches([base('13:00'), base('08:00'), base('17:00'), base('12:00')]);
    expect(unordered.workedMinutes).toBe(480);
  });

  it('evaluateDay: OK dentro da tolerância, extra/débito fora dela', () => {
    const base = { plannedMinutes: 480, toleranceMinutes: 10, isToday: false, hasOpenPair: false };
    expect(evaluateDay({ ...base, punchCount: 4, workedMinutes: 485 })).toEqual({ status: 'OK', balanceMinutes: 0 });
    expect(evaluateDay({ ...base, punchCount: 4, workedMinutes: 510 })).toEqual({ status: 'OVERTIME', balanceMinutes: 30 });
    expect(evaluateDay({ ...base, punchCount: 4, workedMinutes: 420 })).toEqual({ status: 'UNDERTIME', balanceMinutes: -60 });
  });

  it('evaluateDay: falta, folga, inconsistência e dia em andamento', () => {
    expect(evaluateDay({ punchCount: 0, workedMinutes: 0, plannedMinutes: 480, toleranceMinutes: 10, isToday: false, hasOpenPair: false }))
      .toEqual({ status: 'ABSENT', balanceMinutes: -480 });
    expect(evaluateDay({ punchCount: 0, workedMinutes: 0, plannedMinutes: 0, toleranceMinutes: 10, isToday: false, hasOpenPair: false }))
      .toEqual({ status: 'DAY_OFF', balanceMinutes: 0 });
    expect(evaluateDay({ punchCount: 3, workedMinutes: 240, plannedMinutes: 480, toleranceMinutes: 10, isToday: false, hasOpenPair: true }).status)
      .toBe('INCOMPLETE');
    expect(evaluateDay({ punchCount: 1, workedMinutes: 0, plannedMinutes: 480, toleranceMinutes: 10, isToday: true, hasOpenPair: true }).status)
      .toBe('IN_PROGRESS');
    expect(evaluateDay({ punchCount: 0, workedMinutes: 0, plannedMinutes: 480, toleranceMinutes: 10, isToday: true, hasOpenPair: false }).status)
      .toBe('IN_PROGRESS');
  });

  it('chainHash: encadeia e muda com qualquer alteração', () => {
    const first = chainHash(null, 'u1|2026-07-09T11:00:00.000Z|IN|WEB');
    const second = chainHash(first, 'u1|2026-07-09T15:00:00.000Z|OUT|WEB');
    expect(first).toHaveLength(64);
    expect(second).not.toBe(first);
    expect(chainHash(first, 'u1|2026-07-09T15:00:00.000Z|OUT|WEB')).toBe(second); // determinístico
    expect(chainHash('outro', 'u1|2026-07-09T15:00:00.000Z|OUT|WEB')).not.toBe(second);
  });

  it('enumerateDays inclui as pontas', () => {
    expect(enumerateDays('2026-06-28', '2026-07-02')).toEqual([
      '2026-06-28', '2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02',
    ]);
  });

  it('validateWeeklyRules: aceita folgas e rejeita horários inválidos', () => {
    expect(validateWeeklyRules(RULES)).toEqual([]);
    expect(validateWeeklyRules({ mon: { start: '25:00', end: '17:00' } })).not.toEqual([]);
    expect(validateWeeklyRules({ xyz: { start: '08:00', end: '17:00' } })).not.toEqual([]);
    expect(validateWeeklyRules('nada')).not.toEqual([]);
  });

  it('validateProposedTimes: exige ordem crescente e HH:MM válidos', () => {
    expect(validateProposedTimes(['08:00', '12:00', '13:00', '17:00'])).toBeNull();
    expect(validateProposedTimes(['08:00', '08:00'])).not.toBeNull();
    expect(validateProposedTimes(['12:00', '08:00'])).not.toBeNull();
    expect(validateProposedTimes(['8h'])).not.toBeNull();
    expect(validateProposedTimes([])).not.toBeNull();
  });
});
