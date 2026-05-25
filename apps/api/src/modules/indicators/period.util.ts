import { Periodicity } from '@prisma/client';

/**
 * Resolve uma data para o "periodRef" canonico conforme periodicidade.
 *   MONTHLY -> YYYY-MM
 *   ANNUAL  -> YYYY
 *   QUARTERLY -> YYYY-Qn
 *   SEMIANNUAL -> YYYY-Sn
 *   WEEKLY -> YYYY-Www (ISO)
 *   BIWEEKLY -> YYYY-BWn
 *   DAILY -> YYYY-MM-DD
 */
export function dateToPeriodRef(date: Date, periodicity: Periodicity): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');

  switch (periodicity) {
    case 'ANNUAL':
      return String(y);
    case 'SEMIANNUAL':
      return `${y}-S${m <= 6 ? 1 : 2}`;
    case 'QUARTERLY':
      return `${y}-Q${Math.ceil(m / 3)}`;
    case 'MONTHLY':
      return `${y}-${pad(m)}`;
    case 'WEEKLY': {
      const week = isoWeek(date);
      return `${week.year}-W${pad(week.week)}`;
    }
    case 'BIWEEKLY': {
      const w = isoWeek(date);
      return `${w.year}-BW${Math.ceil(w.week / 2)}`;
    }
    case 'DAILY':
    default:
      return `${y}-${pad(m)}-${pad(d)}`;
  }
}

/**
 * Primeira data UTC de um periodRef (para ordenacao/grafico).
 */
export function periodRefToDate(periodRef: string, periodicity: Periodicity): Date {
  switch (periodicity) {
    case 'ANNUAL':
      return new Date(Date.UTC(parseInt(periodRef, 10), 0, 1));
    case 'SEMIANNUAL': {
      const [yy, ss] = periodRef.split('-S');
      const month = ss === '1' ? 0 : 6;
      return new Date(Date.UTC(parseInt(yy, 10), month, 1));
    }
    case 'QUARTERLY': {
      const [yy, qq] = periodRef.split('-Q');
      const month = (parseInt(qq, 10) - 1) * 3;
      return new Date(Date.UTC(parseInt(yy, 10), month, 1));
    }
    case 'MONTHLY': {
      const [yy, mm] = periodRef.split('-');
      return new Date(Date.UTC(parseInt(yy, 10), parseInt(mm, 10) - 1, 1));
    }
    case 'DAILY':
    default: {
      const [yy, mm, dd] = periodRef.split('-');
      return new Date(Date.UTC(parseInt(yy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10)));
    }
  }
}

/**
 * Gera lista de N periodRef mais recentes (do mais antigo para o mais novo)
 * a partir de hoje.
 */
export function lastNPeriodRefs(periodicity: Periodicity, n: number, ref = new Date()): string[] {
  const out: string[] = [];
  const cursor = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  for (let i = 0; i < n; i++) {
    out.unshift(dateToPeriodRef(cursor, periodicity));
    stepBack(cursor, periodicity);
  }
  return out;
}

/**
 * Lista todos os periodRef pertencentes a um ano civil para a periodicidade
 * informada (do mais antigo para o mais novo).
 */
export function periodRefsForYear(periodicity: Periodicity, year: number): string[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  switch (periodicity) {
    case 'ANNUAL':
      return [String(year)];
    case 'SEMIANNUAL':
      return [`${year}-S1`, `${year}-S2`];
    case 'QUARTERLY':
      return [`${year}-Q1`, `${year}-Q2`, `${year}-Q3`, `${year}-Q4`];
    case 'MONTHLY':
      return Array.from({ length: 12 }, (_, i) => `${year}-${pad(i + 1)}`);
    case 'WEEKLY': {
      const out: string[] = [];
      const cursor = new Date(Date.UTC(year, 0, 4));
      while (cursor.getUTCFullYear() <= year) {
        const w = isoWeek(cursor);
        if (w.year > year) break;
        if (w.year === year) out.push(`${w.year}-W${pad(w.week)}`);
        cursor.setUTCDate(cursor.getUTCDate() + 7);
      }
      return out;
    }
    case 'BIWEEKLY': {
      const weeks = periodRefsForYear('WEEKLY', year);
      const seen = new Set<string>();
      for (const ref of weeks) {
        const [yy, ww] = ref.split('-W');
        seen.add(`${yy}-BW${Math.ceil(parseInt(ww, 10) / 2)}`);
      }
      return Array.from(seen);
    }
    case 'DAILY':
    default: {
      const out: string[] = [];
      const cursor = new Date(Date.UTC(year, 0, 1));
      while (cursor.getUTCFullYear() === year) {
        out.push(`${year}-${pad(cursor.getUTCMonth() + 1)}-${pad(cursor.getUTCDate())}`);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return out;
    }
  }
}

function stepBack(d: Date, p: Periodicity): void {
  switch (p) {
    case 'ANNUAL':
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      return;
    case 'SEMIANNUAL':
      d.setUTCMonth(d.getUTCMonth() - 6);
      return;
    case 'QUARTERLY':
      d.setUTCMonth(d.getUTCMonth() - 3);
      return;
    case 'MONTHLY':
      d.setUTCMonth(d.getUTCMonth() - 1);
      return;
    case 'WEEKLY':
      d.setUTCDate(d.getUTCDate() - 7);
      return;
    case 'BIWEEKLY':
      d.setUTCDate(d.getUTCDate() - 14);
      return;
    case 'DAILY':
    default:
      d.setUTCDate(d.getUTCDate() - 1);
      return;
  }
}

function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}
