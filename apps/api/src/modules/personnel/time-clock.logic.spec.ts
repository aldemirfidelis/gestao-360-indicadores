import { describe, expect, it } from 'vitest';
import {
  addDays,
  attributePunches,
  chainHash,
  companyTimeToUtc,
  dayKeyFor,
  dayRuleFor,
  easterSunday,
  effectiveWorkedMinutes,
  enumerateDays,
  evaluateDay,
  isValidDayKey,
  monthBounds,
  nationalHolidaysFor,
  pairPunches,
  parsePunchCsv,
  periodRefOf,
  plannedMinutesFor,
  previousMonthRef,
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

  it('evaluateDay: saldo exato após a tolerância por marcação', () => {
    const base = { plannedMinutes: 480, isToday: false, hasOpenPair: false };
    expect(evaluateDay({ ...base, punchCount: 4, workedMinutes: 480 })).toEqual({ status: 'OK', balanceMinutes: 0 });
    expect(evaluateDay({ ...base, punchCount: 4, workedMinutes: 510 })).toEqual({ status: 'OVERTIME', balanceMinutes: 30 });
    expect(evaluateDay({ ...base, punchCount: 4, workedMinutes: 420 })).toEqual({ status: 'UNDERTIME', balanceMinutes: -60 });
  });

  it('evaluateDay: falta, folga, feriado, inconsistência e dia em andamento', () => {
    expect(evaluateDay({ punchCount: 0, workedMinutes: 0, plannedMinutes: 480, isToday: false, hasOpenPair: false }))
      .toEqual({ status: 'ABSENT', balanceMinutes: -480 });
    expect(evaluateDay({ punchCount: 0, workedMinutes: 0, plannedMinutes: 0, isToday: false, hasOpenPair: false }))
      .toEqual({ status: 'DAY_OFF', balanceMinutes: 0 });
    // Feriado sem batidas: não é falta (mesmo com escala no dia da semana).
    expect(evaluateDay({ punchCount: 0, workedMinutes: 0, plannedMinutes: 0, isToday: false, hasOpenPair: false, isHoliday: true }))
      .toEqual({ status: 'HOLIDAY', balanceMinutes: 0 });
    // Feriado trabalhado: todo o trabalho vira crédito (previsto 0).
    expect(evaluateDay({ punchCount: 2, workedMinutes: 300, plannedMinutes: 0, isToday: false, hasOpenPair: false, isHoliday: true }))
      .toEqual({ status: 'OVERTIME', balanceMinutes: 300 });
    expect(evaluateDay({ punchCount: 3, workedMinutes: 240, plannedMinutes: 480, isToday: false, hasOpenPair: true }).status)
      .toBe('INCOMPLETE');
    expect(evaluateDay({ punchCount: 1, workedMinutes: 0, plannedMinutes: 480, isToday: true, hasOpenPair: true }).status)
      .toBe('IN_PROGRESS');
    expect(evaluateDay({ punchCount: 0, workedMinutes: 0, plannedMinutes: 480, isToday: true, hasOpenPair: false }).status)
      .toBe('IN_PROGRESS');
  });

  it('effectiveWorkedMinutes: janela de ±tolerância na entrada e na saída previstas', () => {
    // Regra do dia 2026-07-09 (qui): 07:00-17:00 com 60 de intervalo = 540 previstos.
    const rule = { start: '07:00', end: '17:00', breakMinutes: 60 };
    const t = (time: string, day = '2026-07-09') => companyTimeToUtc(day, time);
    const run = (times: string[]) =>
      effectiveWorkedMinutes({ punches: times.map((x) => t(x)), dayKey: '2026-07-09', rule, toleranceMinutes: 10 });

    // 06:52 e 17:08 (dentro da janela) contam como 07:00 e 17:00 → jornada exata.
    expect(run(['06:52', '12:00', '13:00', '17:08']).workedMinutes).toBe(540);
    // 06:50 e 17:10 (limite da janela) idem.
    expect(run(['06:50', '12:00', '13:00', '17:10']).workedMinutes).toBe(540);
    // 06:45 (fora da janela): vale o horário real → 15 minutos de crédito.
    expect(run(['06:45', '12:00', '13:00', '17:00']).workedMinutes).toBe(555);
    // 07:15 (fora da janela): atraso real → 15 minutos de débito.
    expect(run(['07:15', '12:00', '13:00', '17:00']).workedMinutes).toBe(525);
    // Intervalo maior conta pelo horário real (sem tolerância nas marcações intermediárias).
    expect(run(['07:00', '12:00', '13:20', '17:00']).workedMinutes).toBe(520);
    // Sem regra: pareamento puro.
    expect(effectiveWorkedMinutes({ punches: ['08:00', '12:00'].map((x) => t(x)), dayKey: '2026-07-09', rule: null, toleranceMinutes: 10 }).workedMinutes).toBe(240);
  });

  it('attributePunches: saída após a meia-noite pertence à jornada noturna do dia anterior', () => {
    // Segunda 22:00-05:00 (vira o dia); terça sem regra.
    const rules: WeeklyRules = { mon: { start: '22:00', end: '05:00', breakMinutes: 0 } };
    const punches = [
      companyTimeToUtc('2026-07-06', '22:02'), // entrada segunda 22:02
      companyTimeToUtc('2026-07-07', '05:01'), // saída terça 05:01 → jornada de segunda
    ];
    const byCivilDay = new Map<string, Date[]>();
    for (const punch of punches) {
      const key = dayKeyFor(punch);
      byCivilDay.set(key, [...(byCivilDay.get(key) ?? []), punch]);
    }
    const attributed = attributePunches({
      days: ['2026-07-05', '2026-07-06', '2026-07-07'],
      byCivilDay,
      timeOf: (d: Date) => d,
      ruleFor: (dayKey) => dayRuleFor(dayKey, rules),
    });
    expect(attributed.get('2026-07-06')).toHaveLength(2);
    expect(attributed.get('2026-07-07')).toHaveLength(0);
    // Com a tolerância por marcação a jornada fecha exata (22:02→22:00, 05:01→05:00).
    const { workedMinutes, open } = effectiveWorkedMinutes({
      punches: attributed.get('2026-07-06')!,
      dayKey: '2026-07-06',
      rule: rules.mon!,
      toleranceMinutes: 10,
    });
    expect(open).toBe(false);
    expect(workedMinutes).toBe(420);
  });

  it('attributePunches: não invade o início da jornada do dia seguinte', () => {
    const rules: WeeklyRules = {
      mon: { start: '22:00', end: '05:00', breakMinutes: 0 },
      tue: { start: '06:00', end: '14:00', breakMinutes: 60 },
    };
    const early = companyTimeToUtc('2026-07-07', '06:02'); // entrada da jornada de terça
    const byCivilDay = new Map<string, Date[]>([['2026-07-07', [early]]]);
    const attributed = attributePunches({
      days: ['2026-07-06', '2026-07-07'],
      byCivilDay,
      timeOf: (d: Date) => d,
      ruleFor: (dayKey) => dayRuleFor(dayKey, rules),
    });
    expect(attributed.get('2026-07-06')).toHaveLength(0);
    expect(attributed.get('2026-07-07')).toHaveLength(1);
  });

  it('feriados nacionais: fixos + Sexta-feira Santa (Páscoa correta)', () => {
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
    const holidays = nationalHolidaysFor(2026);
    const days = holidays.map((h) => h.dayKey);
    expect(days).toContain('2026-01-01');
    expect(days).toContain('2026-04-03'); // Sexta-feira Santa
    expect(days).toContain('2026-11-20'); // Consciência Negra
    expect(days).toContain('2026-12-25');
    expect(holidays).toHaveLength(10);
  });

  it('addDays: desloca dayKeys inclusive em viradas de mês/ano', () => {
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
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

  it('previousMonthRef e monthBounds: viradas de ano e fevereiro', () => {
    expect(previousMonthRef('2026-01')).toBe('2025-12');
    expect(previousMonthRef('2026-07')).toBe('2026-06');
    expect(monthBounds('2026-02')).toEqual({ first: '2026-02-01', last: '2026-02-28' });
    expect(monthBounds('2028-02')).toEqual({ first: '2028-02-01', last: '2028-02-29' }); // bissexto
    expect(monthBounds('2026-07')).toEqual({ first: '2026-07-01', last: '2026-07-31' });
  });

  it('parsePunchCsv: aceita data BR/ISO, ignora cabeçalho e acumula erros', () => {
    const csv = [
      'email;data;hora',
      'ana@empresa.com;2026-07-08;08:01',
      'ana@empresa.com;08/07/2026;12:00',
      'bruno@empresa.com;2026-07-08T14:30:00.000Z',
      'sem-email;2026-07-08;08:00',
      'carla@empresa.com;2026-07-99;08:00',
    ].join('\n');
    const { rows, errors } = parsePunchCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0].email).toBe('ana@empresa.com');
    expect(dayKeyFor(rows[0].punchedAt)).toBe('2026-07-08');
    expect(rows[0].punchedAt.toISOString()).toBe('2026-07-08T11:01:00.000Z'); // 08:01 SP = 11:01 UTC
    expect(rows[1].punchedAt.toISOString()).toBe('2026-07-08T15:00:00.000Z'); // formato BR
    expect(rows[2].punchedAt.toISOString()).toBe('2026-07-08T14:30:00.000Z'); // ISO direto
    expect(errors).toHaveLength(2);
  });

  it('parsePunchCsv: detecta separador vírgula', () => {
    const { rows, errors } = parsePunchCsv('ana@empresa.com,2026-07-08,08:00\nana@empresa.com,2026-07-08,17:00\n');
    expect(rows).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });

  it('validateProposedTimes: exige ordem crescente e HH:MM válidos', () => {
    expect(validateProposedTimes(['08:00', '12:00', '13:00', '17:00'])).toBeNull();
    expect(validateProposedTimes(['08:00', '08:00'])).not.toBeNull();
    expect(validateProposedTimes(['12:00', '08:00'])).not.toBeNull();
    expect(validateProposedTimes(['8h'])).not.toBeNull();
    expect(validateProposedTimes([])).not.toBeNull();
  });
});
