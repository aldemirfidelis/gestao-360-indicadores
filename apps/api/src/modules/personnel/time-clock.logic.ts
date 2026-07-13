import { createHash } from 'crypto';

/**
 * Lógica pura do controle de ponto (sem banco): cálculo de espelho, jornada
 * planejada, pareamento de batidas e cadeia técnica de integridade. Esta cadeia
 * não substitui a ARP/AFD exigida de uma solução REP-P certificada.
 */

export interface DayRule {
  start: string; // HH:MM
  end: string; // HH:MM (menor que start = vira o dia)
  breakMinutes?: number;
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type WeeklyRules = Partial<Record<Weekday, DayRule | null>>;

/**
 * Regras de escala em snapshot/vigência. Dois formatos:
 * - Semanal: objeto { mon..sun: DayRule|null } (formato original, preservado);
 * - Ciclo:   { kind:'CYCLE', cycle:(DayRule|null)[], worksHolidays? } — sequência
 *   repetitiva (ex.: 12x36 = [dia, null]); a fase é dada pela âncora por colaborador.
 */
export interface CycleRules {
  kind: 'CYCLE';
  cycle: Array<DayRule | null>;
  worksHolidays?: boolean;
}
export type ScheduleRules = WeeklyRules | CycleRules;

export function isCycleRules(rules: ScheduleRules | null | undefined): rules is CycleRules {
  return Boolean(rules) && (rules as CycleRules).kind === 'CYCLE' && Array.isArray((rules as CycleRules).cycle);
}

/** Dias corridos entre dois dayKeys (b - a). */
export function daysBetween(a: string, b: string): number {
  const ms = new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export type DayStatus =
  | 'DAY_OFF' // sem jornada prevista e sem batidas
  | 'IN_PROGRESS' // hoje, jornada em andamento
  | 'OK' // jornada cumprida (com a tolerância por marcação aplicada)
  | 'INCOMPLETE' // número ímpar de batidas (inconsistência)
  | 'ABSENT' // jornada prevista sem nenhuma batida
  | 'OVERTIME' // crédito no dia
  | 'UNDERTIME' // débito no dia
  | 'VACATION' // férias aprovadas cobrindo o dia (abonado)
  | 'LEAVE' // afastamento/atestado cobrindo o dia (abonado)
  | 'HOLIDAY'; // feriado sem trabalho (não é falta)

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
    errors.push(...validateDayRule(rule, day));
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
  /** Crédito (+) ou débito (−) do dia para o banco de horas. */
  balanceMinutes: number;
}

/**
 * Avalia o dia. A tolerância NÃO entra aqui: ela é aplicada por marcação em
 * {@link effectiveWorkedMinutes} (janela ±tolerância na entrada e na saída
 * previstas). Depois disso o saldo do dia é exato.
 */
export function evaluateDay(input: {
  punchCount: number;
  workedMinutes: number;
  plannedMinutes: number;
  isToday: boolean;
  hasOpenPair: boolean;
  /** Férias/afastamento cobrindo o dia: abona a jornada (saldo 0). */
  coverage?: 'VACATION' | 'LEAVE' | null;
  /** Feriado: ausência não é falta; trabalho vira crédito (previsto deve vir 0). */
  isHoliday?: boolean;
}): DayEvaluation {
  const { punchCount, workedMinutes, plannedMinutes, isToday, hasOpenPair, coverage, isHoliday } = input;

  if (coverage) return { status: coverage, balanceMinutes: 0 };
  if (isToday && (punchCount === 0 || hasOpenPair)) return { status: 'IN_PROGRESS', balanceMinutes: 0 };
  if (punchCount === 0) {
    if (isHoliday) return { status: 'HOLIDAY', balanceMinutes: 0 };
    return plannedMinutes > 0 ? { status: 'ABSENT', balanceMinutes: -plannedMinutes } : { status: 'DAY_OFF', balanceMinutes: 0 };
  }
  if (hasOpenPair) return { status: 'INCOMPLETE', balanceMinutes: 0 };

  const diff = workedMinutes - plannedMinutes;
  if (diff === 0) return { status: 'OK', balanceMinutes: 0 };
  return { status: diff > 0 ? 'OVERTIME' : 'UNDERTIME', balanceMinutes: diff };
}

/** Regra do dia (ou null quando folga/sem escala). */
export function dayRuleFor(dayKey: string, rules: WeeklyRules | null | undefined): DayRule | null {
  return rules?.[weekdayOf(dayKey)] ?? null;
}

/**
 * Regra do dia para qualquer formato de escala. Em ciclos, a posição é
 * `daysBetween(anchor, dia) mod tamanho` (âncora = dia 0 do ciclo do colaborador);
 * dias anteriores à âncora seguem o mesmo ciclo projetado para trás.
 */
export function dayRuleFromSchedule(
  dayKey: string,
  rules: ScheduleRules | null | undefined,
  cycleAnchorDay?: string | null,
): DayRule | null {
  if (!rules) return null;
  if (isCycleRules(rules)) {
    if (!rules.cycle.length || !cycleAnchorDay) return null;
    const index = ((daysBetween(cycleAnchorDay, dayKey) % rules.cycle.length) + rules.cycle.length) % rules.cycle.length;
    return rules.cycle[index] ?? null;
  }
  return dayRuleFor(dayKey, rules as WeeklyRules);
}

/** Minutos previstos do dia para qualquer formato de escala. */
export function plannedMinutesFromSchedule(
  dayKey: string,
  rules: ScheduleRules | null | undefined,
  cycleAnchorDay?: string | null,
): number {
  const rule = dayRuleFromSchedule(dayKey, rules, cycleAnchorDay);
  if (!rule) return 0;
  const start = timeToMinutes(rule.start);
  let end = timeToMinutes(rule.end);
  if (end <= start) end += 24 * 60;
  return Math.max(0, end - start - Math.max(0, rule.breakMinutes ?? 0));
}

/** Valida a sequência de um ciclo (mín. 2 posições, pelo menos 1 dia de trabalho). */
export function validateCycleRules(cycle: unknown): string[] {
  const errors: string[] = [];
  if (!Array.isArray(cycle) || cycle.length < 2 || cycle.length > 60) {
    return ['Ciclo deve ser uma lista de 2 a 60 posições (dias de trabalho e folgas).'];
  }
  let workDays = 0;
  cycle.forEach((rule, index) => {
    if (rule === null || rule === undefined) return;
    workDays += 1;
    errors.push(...validateDayRule(rule, `Posição ${index + 1}`));
  });
  if (workDays === 0) errors.push('O ciclo precisa de ao menos um dia de trabalho.');
  return errors;
}

/** Validação estrutural/técnica; regras legais e coletivas são parametrizadas fora daqui. */
function validateDayRule(rule: unknown, label: string): string[] {
  const errors: string[] = [];
  if (rule === null || typeof rule !== 'object' || Array.isArray(rule)) return [`${label}: jornada inválida`];
  const r = rule as Partial<DayRule>;
  const validStart = typeof r.start === 'string' && isValidTime(r.start);
  const validEnd = typeof r.end === 'string' && isValidTime(r.end);
  if (!validStart) errors.push(`${label}: início inválido`);
  if (!validEnd) errors.push(`${label}: fim inválido`);

  let duration: number | null = null;
  if (validStart && validEnd) {
    const start = timeToMinutes(r.start!);
    const rawEnd = timeToMinutes(r.end!);
    if (start === rawEnd) errors.push(`${label}: início e fim não podem ser iguais`);
    else duration = rawEnd > start ? rawEnd - start : rawEnd + 24 * 60 - start;
  }

  if (r.breakMinutes !== undefined) {
    const breakMinutes = Number(r.breakMinutes);
    if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 24 * 60) {
      errors.push(`${label}: intervalo inválido`);
    } else if (duration !== null && breakMinutes >= duration) {
      errors.push(`${label}: intervalo deve ser menor que a duração da jornada`);
    }
  }
  return errors;
}

/** dayKey deslocado em `delta` dias. */
export function addDays(dayKey: string, delta: number): string {
  const d = new Date(`${dayKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** true quando a jornada prevista atravessa a meia-noite (fim <= início). */
export function ruleCrossesMidnight(rule: DayRule): boolean {
  return timeToMinutes(rule.end) <= timeToMinutes(rule.start);
}

/** Margem após o fim previsto da jornada noturna para ainda aceitar a saída. */
const NIGHT_GRACE_MS = 4 * 60 * 60_000;

/**
 * Atribui itens (batidas) ao **dia de jornada**. Quando a escala de um dia
 * atravessa a meia-noite, as batidas das primeiras horas do dia civil seguinte
 * pertencem à jornada do dia anterior — até o fim previsto + 4h de margem,
 * nunca invadindo o início da jornada do próprio dia seguinte.
 *
 * `days` deve estar em ordem crescente e conter todos os dias a emitir;
 * `byCivilDay` agrupa os itens pelo dia civil do instante (dayKeyFor).
 */
export function attributePunches<T>(options: {
  days: string[];
  byCivilDay: Map<string, T[]>;
  timeOf: (item: T) => Date;
  ruleFor: (dayKey: string) => DayRule | null;
}): Map<string, T[]> {
  const { days, byCivilDay, timeOf, ruleFor } = options;
  const result = new Map<string, T[]>();
  const claimed = new Set<T>();

  for (const dayKey of days) {
    const own = (byCivilDay.get(dayKey) ?? []).filter((item) => !claimed.has(item));
    const mine = [...own];
    const rule = ruleFor(dayKey);

    if (rule && ruleCrossesMidnight(rule)) {
      const nextKey = addDays(dayKey, 1);
      const nextRule = ruleFor(nextKey);
      const shiftEndUtc = companyTimeToUtc(dayKey, rule.end).getTime() + 86_400_000;
      let cutoff = shiftEndUtc + NIGHT_GRACE_MS;
      if (nextRule) {
        cutoff = Math.min(cutoff, companyTimeToUtc(nextKey, nextRule.start).getTime() - 60_000);
      }
      for (const item of byCivilDay.get(nextKey) ?? []) {
        if (!claimed.has(item) && timeOf(item).getTime() <= cutoff) {
          claimed.add(item);
          mine.push(item);
        }
      }
    }

    mine.sort((a, b) => timeOf(a).getTime() - timeOf(b).getTime());
    result.set(dayKey, mine);
  }
  return result;
}

/**
 * Minutos trabalhados com a **tolerância por marcação** (decisão de negócio):
 * bater até `toleranceMinutes` antes/depois do horário previsto de entrada
 * conta como o horário previsto (não gera extra nem atraso); o mesmo vale para
 * a saída prevista. Fora da janela, vale o horário real integralmente.
 * Marcações intermediárias (intervalo) contam pelo horário real.
 */
export interface ToleranceMark {
  /** Horário real da batida. */
  original: Date;
  /** Horário considerado no cálculo (previsto, quando dentro da janela). */
  effective: Date;
  /** true quando a tolerância "encaixou" a batida no horário previsto. */
  clamped: boolean;
  role: 'ENTRADA' | 'SAIDA' | 'INTERMEDIARIA';
}

export function effectiveWorkedMinutes(input: {
  punches: Date[];
  dayKey: string;
  rule: DayRule | null;
  toleranceMinutes: number;
}): { workedMinutes: number; open: boolean; marks: ToleranceMark[] } {
  const sorted = [...input.punches].sort((a, b) => a.getTime() - b.getTime());
  const baseMarks = (list: Date[]): ToleranceMark[] =>
    list.map((original, index) => ({
      original,
      effective: original,
      clamped: false,
      role: index === 0 ? 'ENTRADA' : index === list.length - 1 && list.length % 2 === 0 ? 'SAIDA' : 'INTERMEDIARIA',
    }));

  if (!input.rule || sorted.length === 0) {
    return { ...pairPunches(sorted), marks: baseMarks(sorted) };
  }

  const tolMs = Math.max(0, input.toleranceMinutes) * 60_000;
  const startUtc = companyTimeToUtc(input.dayKey, input.rule.start);
  const endUtc = new Date(
    companyTimeToUtc(input.dayKey, input.rule.end).getTime() + (ruleCrossesMidnight(input.rule) ? 86_400_000 : 0),
  );

  const marks = baseMarks(sorted);
  // Primeira batida = entrada prevista, se dentro da janela e sem inverter a ordem.
  if (Math.abs(sorted[0].getTime() - startUtc.getTime()) <= tolMs) {
    if (sorted.length === 1 || startUtc.getTime() <= sorted[1].getTime()) {
      marks[0] = { ...marks[0], effective: startUtc, clamped: sorted[0].getTime() !== startUtc.getTime() };
    }
  }
  // Última batida = saída prevista (apenas com pares fechados), mesma proteção.
  const lastIdx = sorted.length - 1;
  if (sorted.length % 2 === 0 && Math.abs(sorted[lastIdx].getTime() - endUtc.getTime()) <= tolMs) {
    if (endUtc.getTime() >= sorted[lastIdx - 1].getTime()) {
      marks[lastIdx] = { ...marks[lastIdx], effective: endUtc, clamped: sorted[lastIdx].getTime() !== endUtc.getTime() };
    }
  }
  return { ...pairPunches(marks.map((mark) => mark.effective)), marks };
}

// ------------------------------ Feriados ------------------------------

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const NATIONAL_FIXED: Array<{ md: string; name: string }> = [
  { md: '01-01', name: 'Confraternização Universal' },
  { md: '04-21', name: 'Tiradentes' },
  { md: '05-01', name: 'Dia do Trabalho' },
  { md: '09-07', name: 'Independência do Brasil' },
  { md: '10-12', name: 'Nossa Senhora Aparecida' },
  { md: '11-02', name: 'Finados' },
  { md: '11-15', name: 'Proclamação da República' },
  { md: '11-20', name: 'Dia Nacional de Zumbi e da Consciência Negra' },
  { md: '12-25', name: 'Natal' },
];

/** Feriados nacionais do ano (fixos + Sexta-feira Santa). */
export function nationalHolidaysFor(year: number): Array<{ dayKey: string; name: string }> {
  const list = NATIONAL_FIXED.map(({ md, name }) => ({ dayKey: `${year}-${md}`, name }));
  list.push({ dayKey: addDays(easterSunday(year), -2), name: 'Sexta-feira Santa' });
  return list.sort((a, b) => a.dayKey.localeCompare(b.dayKey));
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
