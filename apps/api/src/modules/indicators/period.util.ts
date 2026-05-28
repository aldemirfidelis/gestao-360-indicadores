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
 * Aceita uma periodicidade dica mas sempre da prioridade ao formato real do periodRef,
 * permitindo armazenar resultados em granularidades diferentes da cadastral.
 */
export function periodRefToDate(periodRef: string, periodicity: Periodicity): Date {
  const detected = detectPeriodicityFromRef(periodRef);
  const effective = detected !== periodicity ? detected : periodicity;
  switch (effective) {
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
    case 'WEEKLY': {
      const [yy, ww] = periodRef.split('-W');
      return isoWeekToDate(parseInt(yy, 10), parseInt(ww, 10));
    }
    case 'BIWEEKLY': {
      const [yy, bw] = periodRef.split('-BW');
      const week = (parseInt(bw, 10) - 1) * 2 + 1;
      return isoWeekToDate(parseInt(yy, 10), week);
    }
    case 'DAILY':
    default: {
      const [yy, mm, dd] = periodRef.split('-');
      return new Date(Date.UTC(parseInt(yy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10)));
    }
  }
}

function isoWeekToDate(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1));
  const target = new Date(mondayOfWeek1);
  target.setUTCDate(mondayOfWeek1.getUTCDate() + (week - 1) * 7);
  return target;
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

/**
 * Detecta a periodicidade a partir do formato do periodRef.
 * Permite armazenar resultados em granularidades diferentes da periodicidade
 * cadastral do indicador (ex.: lancar diario num indicador mensal).
 */
export function detectPeriodicityFromRef(periodRef: string): Periodicity {
  if (/^\d{4}-\d{2}-\d{2}$/.test(periodRef)) return 'DAILY';
  if (/^\d{4}-W\d{2}$/.test(periodRef)) return 'WEEKLY';
  if (/^\d{4}-BW\d+$/.test(periodRef)) return 'BIWEEKLY';
  if (/^\d{4}-Q\d$/.test(periodRef)) return 'QUARTERLY';
  if (/^\d{4}-S\d$/.test(periodRef)) return 'SEMIANNUAL';
  if (/^\d{4}-\d{2}$/.test(periodRef)) return 'MONTHLY';
  if (/^\d{4}$/.test(periodRef)) return 'ANNUAL';
  return 'MONTHLY';
}

/**
 * Lista periodRefs de uma granularidade especifica dentro de um mes (YYYY-MM).
 * Util para visualizacao/lancamento diario ou semanal dentro do mes.
 */
export function periodRefsForMonth(granularity: Periodicity, monthRef: string): string[] {
  const [yStr, mStr] = monthRef.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return [];
  const pad = (n: number) => String(n).padStart(2, '0');

  switch (granularity) {
    case 'DAILY': {
      const out: string[] = [];
      const cursor = new Date(Date.UTC(year, month - 1, 1));
      while (cursor.getUTCMonth() === month - 1) {
        out.push(`${year}-${pad(month)}-${pad(cursor.getUTCDate())}`);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return out;
    }
    case 'WEEKLY': {
      const out: string[] = [];
      const seen = new Set<string>();
      const cursor = new Date(Date.UTC(year, month - 1, 1));
      while (cursor.getUTCMonth() === month - 1) {
        const w = isoWeek(cursor);
        const ref = `${w.year}-W${pad(w.week)}`;
        if (!seen.has(ref)) {
          seen.add(ref);
          out.push(ref);
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return out;
    }
    case 'BIWEEKLY': {
      const weeks = periodRefsForMonth('WEEKLY', monthRef);
      const seen = new Set<string>();
      for (const ref of weeks) {
        const [yy, ww] = ref.split('-W');
        seen.add(`${yy}-BW${Math.ceil(parseInt(ww, 10) / 2)}`);
      }
      return Array.from(seen);
    }
    case 'MONTHLY':
    default:
      return [monthRef];
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
