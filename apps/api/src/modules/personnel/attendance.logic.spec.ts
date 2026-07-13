import { describe, expect, it } from 'vitest';
import { detectDayOccurrences, type DetectDayInput } from './attendance.logic';
import { companyTimeToUtc } from './time-clock.logic';

const t = (day: string, time: string) => companyTimeToUtc(day, time);
const DAY = '2026-07-09'; // quinta

const base: DetectDayInput = {
  dayKey: DAY,
  status: 'OK',
  plannedMinutes: 540,
  workedMinutes: 540,
  punchTimes: [t(DAY, '07:00'), t(DAY, '12:00'), t(DAY, '13:00'), t(DAY, '17:00')],
  rule: { start: '07:00', end: '17:00', breakMinutes: 60 },
  toleranceMinutes: 10,
  hasSchedule: true,
  isHoliday: false,
  worksHolidays: false,
  coverage: null,
  previousDayLastOut: null,
  isToday: false,
};

const types = (input: Partial<DetectDayInput>) => detectDayOccurrences({ ...base, ...input }).map((o) => o.type);

describe('detectDayOccurrences', () => {
  it('dia normal não gera ocorrência; dia em andamento nunca gera', () => {
    expect(types({})).toEqual([]);
    expect(types({ isToday: true, status: 'IN_PROGRESS', punchTimes: [t(DAY, '07:00')] })).toEqual([]);
  });

  it('falta e batida ímpar', () => {
    expect(types({ status: 'ABSENT', punchTimes: [], workedMinutes: 0 })).toContain('ABSENT');
    const missing = detectDayOccurrences({ ...base, status: 'INCOMPLETE', punchTimes: base.punchTimes.slice(0, 3) });
    expect(missing.map((o) => o.type)).toContain('MISSING_PUNCH');
  });

  it('atraso e saída antecipada fora da janela; dentro da janela não aponta', () => {
    expect(types({ punchTimes: [t(DAY, '07:15'), t(DAY, '12:00'), t(DAY, '13:00'), t(DAY, '17:00')] })).toContain('LATE');
    expect(types({ punchTimes: [t(DAY, '07:00'), t(DAY, '12:00'), t(DAY, '13:00'), t(DAY, '16:40')] })).toContain('EARLY_LEAVE');
    expect(types({ punchTimes: [t(DAY, '07:08'), t(DAY, '12:00'), t(DAY, '13:00'), t(DAY, '17:05')] })).toEqual([]);
  });

  it('intervalo não registrado e intervalo curto', () => {
    expect(types({ punchTimes: [t(DAY, '07:00'), t(DAY, '17:00')], workedMinutes: 600 })).toContain('MISSING_BREAK');
    const short = detectDayOccurrences({
      ...base,
      punchTimes: [t(DAY, '07:00'), t(DAY, '12:00'), t(DAY, '12:20'), t(DAY, '17:00')],
    });
    const shortBreak = short.find((o) => o.type === 'SHORT_BREAK');
    expect(shortBreak?.minutes).toBe(40); // 60 previstos − 20 medidos
  });

  it('interjornada menor que 11h e excesso de jornada', () => {
    const rest = detectDayOccurrences({
      ...base,
      previousDayLastOut: t(DAY, '01:00'), // saiu 01:00, entrou 07:00 = 6h de descanso
    });
    const shortRest = rest.find((o) => o.type === 'SHORT_REST');
    expect(shortRest?.minutes).toBe(5 * 60); // faltaram 5h para 11h
    expect(types({ workedMinutes: 660, punchTimes: [t(DAY, '06:00'), t(DAY, '17:00')] })).toContain('OVERLONG_DAY');
  });

  it('trabalho em férias/afastamento/feriado/sem escala', () => {
    expect(types({ coverage: 'VACATION', status: 'VACATION' })).toContain('WORK_ON_VACATION');
    expect(types({ coverage: 'LEAVE', status: 'LEAVE' })).toContain('WORK_ON_LEAVE');
    expect(types({ isHoliday: true, status: 'OVERTIME' })).toContain('WORK_ON_HOLIDAY');
    // 12x36 (worksHolidays): feriado trabalhado é normal.
    expect(types({ isHoliday: true, worksHolidays: true })).toEqual([]);
    expect(types({ hasSchedule: false, rule: null, plannedMinutes: 0, status: 'OVERTIME' })).toContain('NO_SCHEDULE');
  });
});
