import { BadRequestException } from '@nestjs/common';

/// Lógica pura dos relatórios de DP (Fase 5). Sem acesso a banco: recebe dados já
/// carregados e devolve os agregados, para poder ser testada isoladamente.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface EmployeeLifecycleRow {
  employeeId: string;
  orgNodeId: string | null;
  orgNodeName: string;
  admissionDate: Date | null;
  terminationDate: Date | null;
}

export interface TurnoverBucket {
  key: string; // area id ou "YYYY-MM"
  label: string;
  admissions: number;
  terminations: number;
  headcountEnd: number;
}

export interface TurnoverResult {
  from: string;
  to: string;
  headcountStart: number;
  headcountEnd: number;
  admissions: number;
  terminations: number;
  averageHeadcount: number;
  turnoverRate: number; // percentual
  monthly: TurnoverBucket[];
  byArea: TurnoverBucket[];
}

/** Colaborador estava ativo na data? Admitido até a data e não desligado antes dela. */
export function activeAtDate(admissionDate: Date | null, terminationDate: Date | null, at: Date): boolean {
  if (!admissionDate || admissionDate.getTime() > at.getTime()) return false;
  return !terminationDate || terminationDate.getTime() > at.getTime();
}

/** Lista de competências YYYY-MM entre duas datas, inclusive. */
export function monthKeysBetween(from: Date, to: Date): string[] {
  if (from.getTime() > to.getTime()) throw new BadRequestException('Período inicial maior que o final.');
  const keys: string[] = [];
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth();
  const endYear = to.getUTCFullYear();
  const endMonth = to.getUTCMonth();
  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month + 1).padStart(2, '0')}`);
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  return keys;
}

/** Último instante (UTC) da competência YYYY-MM. */
export function monthEnd(ref: string): Date {
  const [year, month] = ref.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

/** Dias úteis (seg–sex) da competência YYYY-MM. */
export function businessDaysInMonth(ref: string): number {
  const [year, month] = ref.split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) throw new BadRequestException('Competência inválida (use YYYY-MM).');
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= days; day++) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday >= 1 && weekday <= 5) count += 1;
  }
  return count;
}

/** Dias corridos de sobreposição entre [start,end] do afastamento e a janela [rangeStart,rangeEnd]. */
export function overlapDays(start: Date, end: Date | null, rangeStart: Date, rangeEnd: Date): number {
  const effectiveEnd = end ?? rangeEnd;
  const overlapStart = Math.max(startOfDay(start), startOfDay(rangeStart));
  const overlapEnd = Math.min(startOfDay(effectiveEnd), startOfDay(rangeEnd));
  if (overlapEnd < overlapStart) return 0;
  return Math.round((overlapEnd - overlapStart) / DAY_MS) + 1;
}

function startOfDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Agrega admissões, desligamentos, headcount e turnover no período, por mês e por área. */
export function computeTurnover(rows: EmployeeLifecycleRow[], from: Date, to: Date): TurnoverResult {
  if (from.getTime() > to.getTime()) throw new BadRequestException('Período inicial maior que o final.');
  const inRange = (date: Date | null) => !!date && date.getTime() >= startOfDay(from) && date.getTime() <= to.getTime();

  const admissions = rows.filter((row) => inRange(row.admissionDate)).length;
  const terminations = rows.filter((row) => inRange(row.terminationDate)).length;
  const headcountStart = rows.filter((row) => activeAtDate(row.admissionDate, row.terminationDate, from)).length;
  const headcountEnd = rows.filter((row) => activeAtDate(row.admissionDate, row.terminationDate, to)).length;
  const averageHeadcount = (headcountStart + headcountEnd) / 2;
  const turnoverRate = averageHeadcount > 0 ? ((admissions + terminations) / 2 / averageHeadcount) * 100 : 0;

  const monthly: TurnoverBucket[] = monthKeysBetween(from, to).map((key) => {
    const end = monthEnd(key);
    const monthAdmissions = rows.filter((row) => row.admissionDate && sameMonth(row.admissionDate, key)).length;
    const monthTerminations = rows.filter((row) => row.terminationDate && sameMonth(row.terminationDate, key)).length;
    const monthHeadcount = rows.filter((row) => activeAtDate(row.admissionDate, row.terminationDate, end)).length;
    return { key, label: key, admissions: monthAdmissions, terminations: monthTerminations, headcountEnd: monthHeadcount };
  });

  const areaMap = new Map<string, TurnoverBucket>();
  for (const row of rows) {
    const key = row.orgNodeId ?? 'sem-area';
    const bucket = areaMap.get(key) ?? { key, label: row.orgNodeName, admissions: 0, terminations: 0, headcountEnd: 0 };
    if (inRange(row.admissionDate)) bucket.admissions += 1;
    if (inRange(row.terminationDate)) bucket.terminations += 1;
    if (activeAtDate(row.admissionDate, row.terminationDate, to)) bucket.headcountEnd += 1;
    areaMap.set(key, bucket);
  }

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    headcountStart,
    headcountEnd,
    admissions,
    terminations,
    averageHeadcount,
    turnoverRate: round2(turnoverRate),
    monthly,
    byArea: [...areaMap.values()].sort((a, b) => b.headcountEnd - a.headcountEnd),
  };
}

function sameMonth(date: Date, ref: string): boolean {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}` === ref;
}

/** Taxa de absenteísmo: dias ausentes / (headcount × dias úteis) em percentual. */
export function absenteeismRate(absentDays: number, headcount: number, businessDays: number): number {
  const capacity = headcount * businessDays;
  return capacity > 0 ? round2((absentDays / capacity) * 100) : 0;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function assertPeriodRef(ref: string): void {
  if (!/^\d{4}-\d{2}$/.test(ref)) throw new BadRequestException('Competência inválida (use YYYY-MM).');
  const month = Number(ref.slice(5));
  if (month < 1 || month > 12) throw new BadRequestException('Mês inválido na competência.');
}
