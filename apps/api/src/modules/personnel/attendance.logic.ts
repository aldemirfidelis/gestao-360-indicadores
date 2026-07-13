import {
  companyTimeToUtc,
  ruleCrossesMidnight,
  timeToMinutes,
  type DayRule,
  type DayStatus,
} from './time-clock.logic';

/**
 * Detecção pura de ocorrências de jornada (Central de Ocorrências).
 * Recebe o dia já apurado (mesmos dados do espelho) e devolve as ocorrências
 * do dia — nenhum acesso a banco, totalmente testável e reproduzível.
 */

export type OccurrenceType =
  | 'ABSENT' // falta (jornada prevista sem batidas)
  | 'MISSING_PUNCH' // número ímpar de batidas
  | 'LATE' // entrada além da janela de tolerância
  | 'EARLY_LEAVE' // saída antes da janela de tolerância
  | 'MISSING_BREAK' // intervalo previsto e não registrado (jornada corrida)
  | 'SHORT_BREAK' // intervalo registrado menor que o previsto
  | 'SHORT_REST' // interjornada menor que 11h
  | 'OVERLONG_DAY' // jornada acima de 10h
  | 'WORK_ON_VACATION' // batidas em dia de férias
  | 'WORK_ON_LEAVE' // batidas em dia de afastamento
  | 'WORK_ON_HOLIDAY' // batidas em feriado (escala que não trabalha feriado)
  | 'NO_SCHEDULE'; // batidas sem escala vigente

export type OccurrenceSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface OccurrenceDetection {
  type: OccurrenceType;
  severity: OccurrenceSeverity;
  minutes?: number;
  detail?: Record<string, unknown>;
}

/** Interjornada mínima (CLT art. 66): 11 horas entre jornadas. */
export const MIN_REST_MINUTES = 11 * 60;
/** Teto de jornada diária (8h + 2h extras). */
export const MAX_DAY_MINUTES = 10 * 60;
/** Jornada acima disso sem intervalo registrado gera ocorrência (CLT art. 71). */
export const BREAK_REQUIRED_AFTER_MINUTES = 6 * 60;

export interface DetectDayInput {
  dayKey: string;
  status: DayStatus;
  plannedMinutes: number;
  workedMinutes: number;
  /** Batidas do dia de jornada, em ordem, nos horários ORIGINAIS. */
  punchTimes: Date[];
  rule: DayRule | null;
  toleranceMinutes: number;
  hasSchedule: boolean;
  isHoliday: boolean;
  worksHolidays: boolean;
  coverage: 'VACATION' | 'LEAVE' | 'JUSTIFIED' | null;
  /** Última saída do dia de jornada anterior (para interjornada). */
  previousDayLastOut?: Date | null;
  isToday: boolean;
}

export function detectDayOccurrences(input: DetectDayInput): OccurrenceDetection[] {
  const {
    dayKey, status, plannedMinutes, workedMinutes, punchTimes, rule,
    toleranceMinutes, hasSchedule, isHoliday, worksHolidays, coverage,
    previousDayLastOut, isToday,
  } = input;

  // Dia em andamento: nada é apontado (evita falso positivo de jornada aberta).
  if (isToday) return [];

  const found: OccurrenceDetection[] = [];
  const punches = [...punchTimes].sort((a, b) => a.getTime() - b.getTime());
  const tolMs = Math.max(0, toleranceMinutes) * 60_000;

  // Trabalho em dia abonado/feriado/folga.
  if (punches.length > 0) {
    if (coverage === 'VACATION') found.push({ type: 'WORK_ON_VACATION', severity: 'CRITICAL', minutes: workedMinutes });
    if (coverage === 'LEAVE') found.push({ type: 'WORK_ON_LEAVE', severity: 'CRITICAL', minutes: workedMinutes });
    if (isHoliday && !worksHolidays && !coverage) {
      found.push({ type: 'WORK_ON_HOLIDAY', severity: 'MEDIUM', minutes: workedMinutes });
    }
    if (!hasSchedule) found.push({ type: 'NO_SCHEDULE', severity: 'MEDIUM', minutes: workedMinutes });
  }

  if (status === 'ABSENT') {
    found.push({ type: 'ABSENT', severity: 'HIGH', minutes: plannedMinutes });
  }
  if (status === 'INCOMPLETE') {
    found.push({ type: 'MISSING_PUNCH', severity: 'HIGH', detail: { punchCount: punches.length } });
  }

  // Interjornada (independe de escala; precisa de entrada no dia e saída anterior).
  if (punches.length > 0 && previousDayLastOut) {
    const restMinutes = Math.round((punches[0].getTime() - previousDayLastOut.getTime()) / 60_000);
    if (restMinutes >= 0 && restMinutes < MIN_REST_MINUTES) {
      found.push({ type: 'SHORT_REST', severity: 'HIGH', minutes: MIN_REST_MINUTES - restMinutes, detail: { restMinutes } });
    }
  }

  // Excesso de jornada (dias completos).
  if (punches.length >= 2 && punches.length % 2 === 0 && workedMinutes > MAX_DAY_MINUTES) {
    found.push({ type: 'OVERLONG_DAY', severity: 'HIGH', minutes: workedMinutes - MAX_DAY_MINUTES });
  }

  // Ocorrências dependentes da regra do dia (apenas dias completos e não abonados).
  if (rule && !coverage && !(isHoliday && !worksHolidays) && punches.length >= 2 && punches.length % 2 === 0) {
    const startUtc = companyTimeToUtc(dayKey, rule.start);
    const endUtc = new Date(companyTimeToUtc(dayKey, rule.end).getTime() + (ruleCrossesMidnight(rule) ? 86_400_000 : 0));

    const lateMs = punches[0].getTime() - (startUtc.getTime() + tolMs);
    if (lateMs > 0) {
      found.push({ type: 'LATE', severity: 'MEDIUM', minutes: Math.round((punches[0].getTime() - startUtc.getTime()) / 60_000) });
    }
    const earlyMs = endUtc.getTime() - tolMs - punches[punches.length - 1].getTime();
    if (earlyMs > 0) {
      found.push({ type: 'EARLY_LEAVE', severity: 'MEDIUM', minutes: Math.round((endUtc.getTime() - punches[punches.length - 1].getTime()) / 60_000) });
    }

    const expectedBreak = Math.max(0, rule.breakMinutes ?? 0);
    if (expectedBreak > 0) {
      if (punches.length === 2 && workedMinutes > BREAK_REQUIRED_AFTER_MINUTES) {
        found.push({ type: 'MISSING_BREAK', severity: 'MEDIUM', minutes: expectedBreak });
      } else if (punches.length >= 4) {
        let measuredBreak = 0;
        for (let i = 1; i + 1 < punches.length; i += 2) {
          measuredBreak += (punches[i + 1].getTime() - punches[i].getTime()) / 60_000;
        }
        measuredBreak = Math.round(measuredBreak);
        if (measuredBreak < expectedBreak - toleranceMinutes) {
          found.push({ type: 'SHORT_BREAK', severity: 'HIGH', minutes: expectedBreak - measuredBreak, detail: { measuredBreak, expectedBreak } });
        }
      }
    }
  }

  return found;
}

export const OCCURRENCE_SEVERITY_ORDER: Record<OccurrenceSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
