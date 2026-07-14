import { describe, expect, it } from 'vitest';
import {
  aggregatePayrollEvents,
  eventsToRubricQuantities,
  minutesToHours,
  nightMinutesForPair,
  pairsFromTimes,
  splitOvertime,
  type PayrollDayInput,
} from './payroll.logic';
import { companyTimeToUtc } from './time-clock.logic';

const t = (day: string, time: string) => companyTimeToUtc(day, time);
const DAY = '2026-07-09';

describe('payroll.logic', () => {
  it('nightMinutesForPair: conta só a janela 22:00–05:00', () => {
    // 18:00–23:00 → 1h noturna (22:00–23:00).
    expect(nightMinutesForPair({ start: t(DAY, '18:00'), end: t(DAY, '23:00') }, DAY)).toBe(60);
    // Jornada noturna 22:00 → 06:00 (vira o dia): 22:00–05:00 = 7h.
    const end = new Date(companyTimeToUtc(DAY, '06:00').getTime() + 86_400_000);
    expect(nightMinutesForPair({ start: t(DAY, '22:00'), end }, DAY)).toBe(7 * 60);
    // Jornada diurna 08:00–17:00 → 0.
    expect(nightMinutesForPair({ start: t(DAY, '08:00'), end: t(DAY, '17:00') }, DAY)).toBe(0);
  });

  it('splitOvertime: faixa 50% até 2h, 100% no excedente', () => {
    expect(splitOvertime(90)).toEqual({ he50: 90, he100: 0 });
    expect(splitOvertime(120)).toEqual({ he50: 120, he100: 0 });
    expect(splitOvertime(180)).toEqual({ he50: 120, he100: 60 });
    expect(splitOvertime(-10)).toEqual({ he50: 0, he100: 0 });
  });

  it('pairsFromTimes: forma pares entrada/saída ordenados', () => {
    const pairs = pairsFromTimes([t(DAY, '13:00'), t(DAY, '08:00'), t(DAY, '17:00'), t(DAY, '12:00')]);
    expect(pairs).toHaveLength(2);
    expect(pairs[0].start.getTime()).toBe(t(DAY, '08:00').getTime());
  });

  it('aggregatePayrollEvents: normais, extras, faltas e saldo', () => {
    const days: PayrollDayInput[] = [
      // Dia cheio 8h previstas, 9h trabalhadas → 1h extra (50%).
      { dayKey: DAY, status: 'OVERTIME', plannedMinutes: 480, workedMinutes: 540, pairs: pairsFromTimes([t(DAY, '08:00'), t(DAY, '17:00')]), isHoliday: false },
      // Falta: 8h previstas, 0 trabalhadas.
      { dayKey: '2026-07-10', status: 'ABSENT', plannedMinutes: 480, workedMinutes: 0, pairs: [], isHoliday: false },
    ];
    const ev = aggregatePayrollEvents(days);
    expect(ev.normalMinutes).toBe(480);
    expect(ev.he50Minutes).toBe(60);
    expect(ev.he100Minutes).toBe(0);
    expect(ev.absentDays).toBe(1);
    expect(ev.absentMinutes).toBe(480);
    expect(ev.balanceMinutes).toBe(60);
  });

  it('aggregatePayrollEvents: feriado trabalhado vira excedente e adicional noturno', () => {
    const days: PayrollDayInput[] = [
      { dayKey: DAY, status: 'OVERTIME', plannedMinutes: 0, workedMinutes: 300, pairs: pairsFromTimes([t(DAY, '22:00'), t(DAY, '23:00'), t(DAY, '23:00'), new Date(companyTimeToUtc(DAY, '03:00').getTime() + 86_400_000)]), isHoliday: true },
    ];
    const ev = aggregatePayrollEvents(days);
    expect(ev.holidayWorkedMinutes).toBe(300);
    expect(ev.he50Minutes + ev.he100Minutes).toBe(300);
    expect(ev.nightMinutes).toBeGreaterThan(0);
  });

  it('eventsToRubricQuantities + minutesToHours: converte para horas decimais', () => {
    expect(minutesToHours(90)).toBe(1.5);
    const q = eventsToRubricQuantities({
      normalMinutes: 480, he50Minutes: 60, he100Minutes: 0, nightMinutes: 0,
      absentMinutes: 0, holidayWorkedMinutes: 0, balanceMinutes: 60, workedDays: 1, absentDays: 0,
    });
    expect(q.HORAS_NORMAIS).toBe(8);
    expect(q.HE_50).toBe(1);
    expect(q.BANCO_CREDITO).toBe(1);
    expect(q.BANCO_DEBITO).toBe(0);
  });
});
