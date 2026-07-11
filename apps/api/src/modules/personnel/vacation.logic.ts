/**
 * Lógica pura de férias (CLT, dias corridos): períodos aquisitivos derivados
 * da data de admissão, alocação FIFO do gozo e alerta de dobra (art. 137).
 */

export interface AcquisitivePeriod {
  /** Rótulo do período, ex.: "2025/2026". */
  ref: string;
  start: Date;
  end: Date;
  /** Limite para INICIAR o gozo sem dobra: fim do período concessivo (end + 12 meses). */
  concessiveDeadline: Date;
  entitledDays: number;
}

export interface PeriodBalance extends AcquisitivePeriod {
  usedDays: number;
  balanceDays: number;
  /** true quando há saldo e o concessivo vence em até 90 dias (ou já venceu). */
  expiring: boolean;
  /** true quando há saldo e o concessivo já venceu (risco de dobra). */
  overdue: boolean;
}

export const VACATION_ACTIVE_STATUSES = ['REQUESTED', 'MANAGER_APPROVED', 'APPROVED', 'DONE'] as const;
export const LEAVE_TYPES = [
  'ATESTADO',
  'ACIDENTE_TRABALHO',
  'MATERNIDADE',
  'PATERNIDADE',
  'LICENCA_NAO_REMUNERADA',
  'FALTA_JUSTIFICADA',
  'OUTRO',
] as const;

const DAY_MS = 86_400_000;
const ENTITLED_DAYS = 30;

/** Dias corridos entre duas datas, inclusive as pontas. */
export function calendarDaysInclusive(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.round((endUtc - startUtc) / DAY_MS) + 1;
}

function addMonthsUtc(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/**
 * Períodos aquisitivos COMPLETOS (12 meses trabalhados) desde a admissão.
 * O período em curso não gera direito ainda (CLT art. 130).
 */
export function acquisitivePeriods(admissionDate: Date | null | undefined, today: Date): AcquisitivePeriod[] {
  if (!admissionDate || Number.isNaN(admissionDate.getTime())) return [];
  const periods: AcquisitivePeriod[] = [];
  let start = new Date(admissionDate.getTime());
  for (let i = 0; i < 60; i++) {
    const end = new Date(addMonthsUtc(start, 12).getTime() - DAY_MS);
    if (end.getTime() > today.getTime()) break; // período ainda em curso
    periods.push({
      ref: `${start.getUTCFullYear()}/${end.getUTCFullYear()}`,
      start,
      end,
      concessiveDeadline: addMonthsUtc(end, 12),
      entitledDays: ENTITLED_DAYS,
    });
    start = new Date(end.getTime() + DAY_MS);
  }
  return periods;
}

/**
 * Aloca os dias solicitados/gozados nos períodos mais antigos primeiro (FIFO)
 * e calcula saldo e alertas por período.
 */
export function allocateVacations(
  periods: AcquisitivePeriod[],
  requests: Array<{ days: number }>,
  today: Date,
): { periods: PeriodBalance[]; totalBalance: number; nextDeadline: Date | null; expiring: boolean; overdue: boolean } {
  let remainingUsed = requests.reduce((sum, request) => sum + Math.max(0, request.days), 0);
  const soon = new Date(today.getTime() + 90 * DAY_MS);
  const result: PeriodBalance[] = periods.map((period) => {
    const usedDays = Math.min(period.entitledDays, remainingUsed);
    remainingUsed -= usedDays;
    const balanceDays = period.entitledDays - usedDays;
    const overdue = balanceDays > 0 && period.concessiveDeadline.getTime() < today.getTime();
    const expiring = balanceDays > 0 && !overdue && period.concessiveDeadline.getTime() <= soon.getTime();
    return { ...period, usedDays, balanceDays, expiring, overdue };
  });
  const withBalance = result.filter((period) => period.balanceDays > 0);
  return {
    periods: result,
    totalBalance: withBalance.reduce((sum, period) => sum + period.balanceDays, 0),
    nextDeadline: withBalance.length ? withBalance[0].concessiveDeadline : null,
    expiring: withBalance.some((period) => period.expiring),
    overdue: withBalance.some((period) => period.overdue),
  };
}

/** Valida o intervalo de férias: futuro, 5 a 30 dias corridos (CLT art. 134). */
export function validateVacationRange(start: Date, end: Date, today: Date): string | null {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Datas inválidas.';
  if (end.getTime() < start.getTime()) return 'A data final deve ser após a inicial.';
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const todayDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (startDay <= todayDay) return 'As férias devem começar em uma data futura.';
  const days = calendarDaysInclusive(start, end);
  if (days < 5) return 'Período mínimo de 5 dias corridos.';
  if (days > 30) return 'Período máximo de 30 dias corridos.';
  return null;
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() <= bEnd.getTime() && bStart.getTime() <= aEnd.getTime();
}
