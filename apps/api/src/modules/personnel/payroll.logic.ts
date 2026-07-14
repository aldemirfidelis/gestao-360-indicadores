import { companyTimeToUtc, dayKeyFor } from './time-clock.logic';

/**
 * Lógica pura de eventos para a folha (sem banco). Deriva rubricas a partir do
 * espelho já apurado: horas normais, horas extras por faixa, adicional noturno,
 * faltas e saldo de banco.
 *
 * ⚠️ Estes cálculos seguem parâmetros usuais (CLT + CCT comuns), mas dependem de
 * validação jurídica por empresa/convenção — em especial DSR, faixas de HE e
 * regras de adicional noturno. Nada aqui declara conformidade automática.
 */

/** Janela do adicional noturno urbano (CLT art. 73): 22:00 às 05:00. */
export const NIGHT_START_MIN = 22 * 60;
export const NIGHT_END_MIN = 5 * 60;
/** 1ª faixa de hora extra (min/dia) tratada como 50%; excedente como 100%. */
export const OVERTIME_TIER1_CAP_MIN = 120;

export interface WorkedPair {
  start: Date;
  end: Date;
}

/**
 * Minutos trabalhados dentro da janela noturna (22:00–05:00) para um par
 * entrada/saída, considerando a virada de dia. Trabalha em minutos absolutos
 * desde a meia-noite do dia da empresa.
 */
export function nightMinutesForPair(pair: WorkedPair, dayKey: string): number {
  const dayStart = companyTimeToUtc(dayKey, '00:00').getTime();
  const startMin = Math.round((pair.start.getTime() - dayStart) / 60_000);
  const endMin = Math.round((pair.end.getTime() - dayStart) / 60_000);
  if (endMin <= startMin) return 0;

  // Janelas noturnas relevantes: [−∞..05:00] (madrugada do dia), [22:00..29:00]
  // (noite que entra na madrugada seguinte) — cobre jornadas que viram o dia.
  const windows: Array<[number, number]> = [
    [-24 * 60 + NIGHT_START_MIN, NIGHT_END_MIN], // noite anterior entrando na madrugada
    [NIGHT_START_MIN, 24 * 60 + NIGHT_END_MIN], // noite do dia entrando na madrugada seguinte
  ];
  let total = 0;
  for (const [ws, we] of windows) {
    total += Math.max(0, Math.min(endMin, we) - Math.max(startMin, ws));
  }
  return total;
}

export function nightMinutesForPairs(pairs: WorkedPair[], dayKey: string): number {
  return pairs.reduce((sum, pair) => sum + nightMinutesForPair(pair, dayKey), 0);
}

/** Divide os minutos extras do dia em faixa 50% (até o teto) e 100% (excedente). */
export function splitOvertime(extraMinutes: number, tier1Cap = OVERTIME_TIER1_CAP_MIN): { he50: number; he100: number } {
  const extra = Math.max(0, Math.round(extraMinutes));
  const he50 = Math.min(extra, tier1Cap);
  return { he50, he100: extra - he50 };
}

export interface PayrollDayInput {
  dayKey: string;
  status: string;
  plannedMinutes: number;
  workedMinutes: number;
  /** Pares entrada/saída EFETIVOS (pós-tolerância) para o cálculo noturno. */
  pairs: WorkedPair[];
  isHoliday: boolean;
}

export interface PayrollEvents {
  normalMinutes: number; // horas normais
  he50Minutes: number; // extra 50%
  he100Minutes: number; // extra 100%
  nightMinutes: number; // adicional noturno
  absentMinutes: number; // faltas (jornada não cumprida)
  holidayWorkedMinutes: number; // trabalho em feriado
  balanceMinutes: number; // saldo líquido do período (banco)
  workedDays: number;
  absentDays: number;
}

/** Agrega os eventos de folha de um conjunto de dias já apurados. */
export function aggregatePayrollEvents(days: PayrollDayInput[]): PayrollEvents {
  const events: PayrollEvents = {
    normalMinutes: 0,
    he50Minutes: 0,
    he100Minutes: 0,
    nightMinutes: 0,
    absentMinutes: 0,
    holidayWorkedMinutes: 0,
    balanceMinutes: 0,
    workedDays: 0,
    absentDays: 0,
  };

  for (const day of days) {
    if (day.status === 'ABSENT') {
      events.absentMinutes += day.plannedMinutes;
      events.absentDays += 1;
      continue;
    }
    if (day.workedMinutes > 0) events.workedDays += 1;

    const night = nightMinutesForPairs(day.pairs, day.dayKey);
    events.nightMinutes += night;

    if (day.isHoliday) {
      // Feriado trabalhado: previsto 0, tudo é excedente.
      events.holidayWorkedMinutes += day.workedMinutes;
      const { he50, he100 } = splitOvertime(day.workedMinutes);
      events.he50Minutes += he50;
      events.he100Minutes += he100;
      events.balanceMinutes += day.workedMinutes;
      continue;
    }

    const normal = Math.min(day.workedMinutes, day.plannedMinutes);
    const extra = Math.max(0, day.workedMinutes - day.plannedMinutes);
    const deficit = Math.max(0, day.plannedMinutes - day.workedMinutes);
    events.normalMinutes += normal;
    const { he50, he100 } = splitOvertime(extra);
    events.he50Minutes += he50;
    events.he100Minutes += he100;
    events.balanceMinutes += extra - deficit;
  }

  return events;
}

/** Pares entrada/saída a partir de uma lista de horários efetivos ordenados. */
export function pairsFromTimes(times: Date[]): WorkedPair[] {
  const sorted = [...times].sort((a, b) => a.getTime() - b.getTime());
  const pairs: WorkedPair[] = [];
  for (let i = 0; i + 1 < sorted.length; i += 2) pairs.push({ start: sorted[i], end: sorted[i + 1] });
  return pairs;
}

/** dayKey de um par (usa o horário de entrada no fuso da empresa). */
export function dayKeyOfPair(pair: WorkedPair): string {
  return dayKeyFor(pair.start);
}

/** Catálogo padrão de rubricas internas (chave -> descrição/unidade). */
export const DEFAULT_RUBRICS: Array<{ eventKey: string; description: string; unit: 'HORAS' | 'DIAS'; defaultCode: string }> = [
  { eventKey: 'HORAS_NORMAIS', description: 'Horas normais', unit: 'HORAS', defaultCode: '001' },
  { eventKey: 'HE_50', description: 'Horas extras 50%', unit: 'HORAS', defaultCode: '050' },
  { eventKey: 'HE_100', description: 'Horas extras 100%', unit: 'HORAS', defaultCode: '100' },
  { eventKey: 'ADICIONAL_NOTURNO', description: 'Adicional noturno', unit: 'HORAS', defaultCode: '020' },
  { eventKey: 'FALTAS', description: 'Faltas', unit: 'DIAS', defaultCode: '200' },
  { eventKey: 'BANCO_CREDITO', description: 'Banco de horas — crédito', unit: 'HORAS', defaultCode: '900' },
  { eventKey: 'BANCO_DEBITO', description: 'Banco de horas — débito', unit: 'HORAS', defaultCode: '901' },
];

/** Converte os eventos agregados em pares (eventKey, quantidade) para exportação. */
export function eventsToRubricQuantities(events: PayrollEvents): Record<string, number> {
  return {
    HORAS_NORMAIS: minutesToHours(events.normalMinutes),
    HE_50: minutesToHours(events.he50Minutes),
    HE_100: minutesToHours(events.he100Minutes),
    ADICIONAL_NOTURNO: minutesToHours(events.nightMinutes),
    FALTAS: events.absentDays,
    BANCO_CREDITO: minutesToHours(Math.max(0, events.balanceMinutes)),
    BANCO_DEBITO: minutesToHours(Math.max(0, -events.balanceMinutes)),
  };
}

/** Minutos -> horas decimais com 2 casas. */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}
