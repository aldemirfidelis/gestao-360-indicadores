import { createHash } from 'crypto';

/**
 * Lógica pura do controle de ponto (sem banco): cálculo de espelho, jornada
 * planejada, pareamento de batidas e cadeia de integridade (Portaria 671).
 */

export interface DayRule {
  start: string; // HH:MM
  end: string; // HH:MM (menor que start = vira o dia)
  breakMinutes?: number;
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type WeeklyRules = Partial<Record<Weekday, DayRule | null>>;

export type DayStatus =
  | 'DAY_OFF' // sem jornada prevista e sem batidas
  | 'IN_PROGRESS' // hoje, jornada em andamento
  | 'OK' // dentro da tolerância
  | 'INCOMPLETE' // número ímpar de batidas (inconsistência)
  | 'ABSENT' // jornada prevista sem nenhuma batida
  | 'OVERTIME' // acima da tolerância (crédito)
  | 'UNDERTIME'; // abaixo da tolerância (débito)

/** Brasil não tem horário de verão desde 2019: America/Sao_Paulo = UTC-3 fixo. */
export const COMPANY_UTC_OFFSET_MINUTES = -180;

const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Chave YYYY-MM-DD de um instante no fuso da empresa. */
export function dayKeyFor(date: Date, offsetMinutes = COMPANY_UTC_OFFSET_MINUTES): string {
  return new Date(date.getTime() + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** Competência YYYY-MM de um dayKey. */
export function periodRefOf(dayKey: string): string {
  return dayKey.slice(0, 7);
}

export function isValidDayKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function timeToMinutes(value: string): number {
  const match = TIME_RE.exec(value);
  if (!match) throw new Error(`Horário inválido: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function weekdayOf(dayKey: string): Weekday {
  return WEEKDAYS[new Date(`${dayKey}T12:00:00Z`).getUTCDay()];
}

/** Converte um dayKey + HH:MM (fuso da empresa) para o instante UTC. */
export function companyTimeToUtc(dayKey: string, time: string, offsetMinutes = COMPANY_UTC_OFFSET_MINUTES): Date {
  const base = new Date(`${dayKey}T${time}:00.000Z`);
  return new Date(base.getTime() - offsetMinutes * 60_000);
}

/** Minutos de jornada prevista para o dia (0 = folga/sem escala). */
export function plannedMinutesFor(dayKey: string, rules: WeeklyRules | null | undefined): number {
  const rule = rules?.[weekdayOf(dayKey)];
  if (!rule) return 0;
  const start = timeToMinutes(rule.start);
  let end = timeToMinutes(rule.end);
  if (end <= start) end += 24 * 60; // jornada que vira o dia
  return Math.max(0, end - start - Math.max(0, rule.breakMinutes ?? 0));
}

/** Valida a estrutura de weeklyRules; retorna a lista de erros (vazia = ok). */
export function validateWeeklyRules(rules: unknown): string[] {
  const errors: string[] = [];
  if (rules === null || typeof rules !== 'object' || Array.isArray(rules)) {
    return ['Regras semanais devem ser um objeto { mon..sun }.'];
  }
  for (const [day, rule] of Object.entries(rules as Record<string, unknown>)) {
    if (!WEEKDAYS.includes(day as Weekday)) {
      errors.push(`Dia inválido: ${day}`);
      continue;
    }
    if (rule === null || rule === undefined) continue; // folga
    const r = rule as Partial<DayRule>;
    if (!r.start || !isValidTime(r.start)) errors.push(`${day}: início inválido`);
    if (!r.end || !isValidTime(r.end)) errors.push(`${day}: fim inválido`);
    if (r.breakMinutes !== undefined && (!Number.isFinite(Number(r.breakMinutes)) || Number(r.breakMinutes) < 0)) {
      errors.push(`${day}: intervalo inválido`);
    }
  }
  return errors;
}

/** Pareia batidas em ordem cronológica (1ª=entrada, 2ª=saída...). */
export function pairPunches(times: Date[]): { workedMinutes: number; open: boolean } {
  const sorted = [...times].sort((a, b) => a.getTime() - b.getTime());
  let worked = 0;
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    worked += (sorted[i + 1].getTime() - sorted[i].getTime()) / 60_000;
  }
  return { workedMinutes: Math.round(worked), open: sorted.length % 2 === 1 };
}

export interface DayEvaluation {
  status: DayStatus;
  /** Crédito (+) ou débito (−) do dia para o banco de horas; 0 dentro da tolerância. */
  balanceMinutes: number;
}

export function evaluateDay(input: {
  punchCount: number;
  workedMinutes: number;
  plannedMinutes: number;
  toleranceMinutes: number;
  isToday: boolean;
  hasOpenPair: boolean;
}): DayEvaluation {
  const { punchCount, workedMinutes, plannedMinutes, toleranceMinutes, isToday, hasOpenPair } = input;

  if (isToday && (punchCount === 0 || hasOpenPair)) return { status: 'IN_PROGRESS', balanceMinutes: 0 };
  if (punchCount === 0) {
    return plannedMinutes > 0 ? { status: 'ABSENT', balanceMinutes: -plannedMinutes } : { status: 'DAY_OFF', balanceMinutes: 0 };
  }
  if (hasOpenPair) return { status: 'INCOMPLETE', balanceMinutes: 0 };

  const diff = workedMinutes - plannedMinutes;
  if (Math.abs(diff) <= toleranceMinutes) return { status: 'OK', balanceMinutes: 0 };
  return { status: diff > 0 ? 'OVERTIME' : 'UNDERTIME', balanceMinutes: diff };
}

/** Cadeia de integridade das batidas (hash encadeado por usuário). */
export function chainHash(prevHash: string | null | undefined, payload: string): string {
  return createHash('sha256').update(`${prevHash ?? 'GENESIS'}|${payload}`).digest('hex');
}

/** Lista de dayKeys entre from e to (inclusive), em ordem crescente. */
export function enumerateDays(fromKey: string, toKey: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${fromKey}T12:00:00Z`);
  const end = new Date(`${toKey}T12:00:00Z`);
  while (cursor.getTime() <= end.getTime() && days.length < 400) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/** Competência anterior a uma referência YYYY-MM. */
export function previousMonthRef(ref: string): string {
  const [year, month] = ref.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Primeiro e último dayKey de uma competência YYYY-MM. */
export function monthBounds(ref: string): { first: string; last: string } {
  const [year, month] = ref.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { first: `${ref}-01`, last: `${ref}-${String(lastDay).padStart(2, '0')}` };
}

export interface ParsedPunchRow {
  line: number;
  email: string;
  punchedAt: Date;
}

/**
 * Importação de batidas (relógio/REP exportado em CSV). Formatos aceitos por linha:
 *   email;AAAA-MM-DD;HH:MM   |   email;DD/MM/AAAA;HH:MM   |   email;ISO-datetime
 * Separador ; ou , (detectado). Cabeçalho é ignorado se a 1ª linha não tiver e-mail válido.
 */
export function parsePunchCsv(content: string): { rows: ParsedPunchRow[]; errors: string[] } {
  const rows: ParsedPunchRow[] = [];
  const errors: string[] = [];
  const lines = content.split(/\r?\n/);
  const separator = (content.match(/;/g)?.length ?? 0) >= (content.match(/,/g)?.length ?? 0) ? ';' : ',';

  lines.forEach((raw, index) => {
    const line = index + 1;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const cols = trimmed.split(separator).map((col) => col.trim().replace(/^"|"$/g, ''));
    const email = cols[0]?.toLowerCase() ?? '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (index === 0) return; // cabeçalho
      errors.push(`Linha ${line}: e-mail inválido (${cols[0] ?? 'vazio'}).`);
      return;
    }

    let punchedAt: Date | null = null;
    if (cols.length >= 3 && cols[1] && cols[2]) {
      const rawDate = cols[1];
      const time = cols[2].slice(0, 5);
      const dayKey = /^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)
        ? `${rawDate.slice(6, 10)}-${rawDate.slice(3, 5)}-${rawDate.slice(0, 2)}`
        : rawDate;
      if (isValidDayKey(dayKey) && isValidTime(time)) punchedAt = companyTimeToUtc(dayKey, time);
    } else if (cols.length >= 2 && cols[1]) {
      const parsed = new Date(cols[1]);
      if (!Number.isNaN(parsed.getTime())) punchedAt = parsed;
    }

    if (!punchedAt) {
      errors.push(`Linha ${line}: data/hora inválida.`);
      return;
    }
    rows.push({ line, email, punchedAt });
  });

  return { rows, errors };
}

/** Horários propostos de um ajuste: HH:MM válidos e estritamente crescentes. */
export function validateProposedTimes(times: unknown): string | null {
  if (!Array.isArray(times) || times.length === 0) return 'Informe ao menos um horário.';
  if (times.length > 12) return 'Máximo de 12 horários por dia.';
  let previous = -1;
  for (const time of times) {
    if (typeof time !== 'string' || !isValidTime(time)) return `Horário inválido: ${String(time)}`;
    const minutes = timeToMinutes(time);
    if (minutes <= previous) return 'Horários devem estar em ordem crescente, sem repetição.';
    previous = minutes;
  }
  return null;
}
