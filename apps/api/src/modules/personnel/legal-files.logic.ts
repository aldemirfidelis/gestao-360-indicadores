/**
 * Geração pura dos arquivos fiscais do controle de ponto (Portaria 671/2021):
 * AFD (marcações do REP-P, registro tipo 7) e AEJ (arquivo eletrônico de
 * jornada do programa de tratamento, campos separados por "|").
 *
 * ⚠️ Os leiautes seguem a estrutura publicada da Portaria 671, mas DEVEM ser
 * validados contra o validador oficial e revisados juridicamente antes de uso
 * em fiscalização. A assinatura digital (.p7s) exige certificado ICP-Brasil e
 * NÃO é gerada aqui; o registro no INPI e o Atestado Técnico são providências
 * externas da empresa. Nada neste módulo declara conformidade automática.
 */

const COMPANY_TZ_OFFSET = '-0300';

export interface LegalEmployer {
  /** 1 = CNPJ, 2 = CPF. */
  idType: number;
  /** CNPJ/CPF apenas dígitos. */
  idNumber: string;
  /** CEI/CNO/CAEPF apenas dígitos (opcional). */
  cnoCaepf?: string | null;
  companyName: string;
  /** Registro do programa de tratamento no INPI (REP-P). */
  inpiRegistry?: string | null;
}

export interface AfdPunch {
  nsr: number;
  cpf: string | null;
  punchedAt: Date;
  hash: string;
}

export interface AfdResult {
  content: string;
  lines: number;
  warnings: string[];
}

/** CRC-16/ARC (poly 0x8005 refletido, init 0x0000) — 4 hex maiúsculos. */
export function crc16(input: string): string {
  let crc = 0x0000;
  const bytes = Buffer.from(input, 'utf8');
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** AAAA-MM-DDThh:mm:00-0300 (fuso fixo da empresa). */
export function afdDateTime(date: Date): string {
  const local = new Date(date.getTime() - 3 * 60 * 60_000);
  return `${local.toISOString().slice(0, 16)}:00${COMPANY_TZ_OFFSET}`;
}

function digits(value: string | null | undefined, length: number): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, length).padStart(length, '0');
}

function textField(value: string, length: number): string {
  // Remove diacríticos (U+0300..U+036F) após decompor — arquivos fiscais em ASCII.
  let out = '';
  for (const ch of String(value ?? '').normalize('NFD')) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x0300 || cp > 0x036f) out += ch;
  }
  return out.slice(0, length).padEnd(length, ' ');
}

function nsrField(nsr: number): string {
  return String(Math.max(0, Math.round(nsr))).padStart(9, '0').slice(-9);
}

/**
 * AFD do REP-P: cabeçalho (tipo 1), um registro tipo 7 por marcação (NSR,
 * data/hora com fuso, CPF, hash SHA-256 da cadeia) e trailer (tipo 9).
 * Cada linha termina com CRC-16 do próprio conteúdo.
 */
export function generateAfd(input: {
  employer: LegalEmployer;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  punches: AfdPunch[];
  generatedAt: Date;
}): AfdResult {
  const { employer, from, to, punches, generatedAt } = input;
  const warnings: string[] = [];
  if (!employer.inpiRegistry) warnings.push('Registro do INPI não configurado — obrigatório para REP-P em fiscalização.');
  if (!employer.idNumber) warnings.push('CNPJ/CPF do empregador ausente no cadastro da empresa.');

  const lines: string[] = [];
  const header =
    nsrField(0) +
    '1' +
    String(employer.idType === 2 ? 2 : 1) +
    digits(employer.idNumber, 14) +
    digits(employer.cnoCaepf, 14) +
    textField(employer.companyName, 150) +
    textField(employer.inpiRegistry ?? '', 17) +
    from +
    to +
    afdDateTime(generatedAt) +
    '003';
  lines.push(header + crc16(header));

  let missingCpf = 0;
  const sorted = [...punches].sort((a, b) => a.nsr - b.nsr);
  for (const punch of sorted) {
    if (!punch.cpf) missingCpf += 1;
    const line =
      nsrField(punch.nsr) +
      '7' +
      afdDateTime(punch.punchedAt) +
      digits(punch.cpf, 12) +
      punch.hash.slice(0, 64).padEnd(64, '0');
    lines.push(line + crc16(line));
  }
  if (missingCpf > 0) {
    warnings.push(`${missingCpf} marcação(ões) de colaborador sem CPF no prontuário — complete o cadastro para validade fiscal.`);
  }

  const trailer =
    '999999999' +
    nsrField(0) + // tipo 2 (identificação alterada)
    nsrField(0) + // tipo 3 (marcações REP-C)
    nsrField(0) + // tipo 4 (ajustes de relógio)
    nsrField(0) + // tipo 5 (empregados)
    nsrField(0) + // tipo 6 (eventos sensíveis)
    nsrField(sorted.length) + // tipo 7 (marcações REP-P)
    '9';
  lines.push(trailer + crc16(trailer));

  return { content: lines.join('\r\n') + '\r\n', lines: lines.length, warnings };
}

// ------------------------------ AEJ ------------------------------

export interface AejEmployee {
  cpf: string | null;
  name: string;
}

export interface AejMarking {
  cpf: string | null;
  punchedAt: Date;
  nsr: number;
  /** E = entrada, S = saída (derivado da apuração). */
  direction: 'E' | 'S';
}

export interface AejAbsence {
  cpf: string | null;
  dayKey: string;
  kind: string; // FERIAS | AFASTAMENTO | ABONO | FALTA
}

/**
 * AEJ (programa de tratamento): campos separados por "|".
 * 01 cabeçalho · 02 vínculos · 04 marcações tratadas · 05 ausências · 99 trailer.
 */
export function generateAej(input: {
  employer: LegalEmployer;
  periodRef: string; // YYYY-MM
  from: string;
  to: string;
  employees: AejEmployee[];
  markings: AejMarking[];
  absences: AejAbsence[];
  generatedAt: Date;
}): AfdResult {
  const { employer, from, to, employees, markings, absences, generatedAt } = input;
  const warnings: string[] = [];
  const lines: string[] = [];

  lines.push(
    ['01', String(employer.idType === 2 ? 2 : 1), digits(employer.idNumber, 14), digits(employer.cnoCaepf, 14),
      employer.companyName.trim(), from, to, afdDateTime(generatedAt), '001'].join('|'),
  );
  let seq = 0;
  for (const employee of employees) {
    seq += 1;
    if (!employee.cpf) warnings.push(`Vínculo sem CPF: ${employee.name}.`);
    lines.push(['02', String(seq), digits(employee.cpf, 11), employee.name.trim()].join('|'));
  }
  for (const marking of [...markings].sort((a, b) => a.punchedAt.getTime() - b.punchedAt.getTime())) {
    lines.push(['04', digits(marking.cpf, 11), afdDateTime(marking.punchedAt), String(marking.nsr), marking.direction].join('|'));
  }
  for (const absence of absences) {
    lines.push(['05', digits(absence.cpf, 11), absence.dayKey, absence.kind].join('|'));
  }
  lines.push(['99', String(employees.length), String(markings.length), String(absences.length)].join('|'));

  return { content: lines.join('\r\n') + '\r\n', lines: lines.length, warnings };
}

// ------------------------ Espelho de Ponto Eletrônico ------------------------

export interface MirrorEmployee {
  name: string;
  cpf: string | null;
  pisPasep?: string | null;
  admissionDate?: string | null; // YYYY-MM-DD
  jobTitle?: string | null;
}

export interface MirrorDay {
  dayKey: string;
  holiday: string | null;
  status: string;
  plannedMinutes: number;
  workedMinutes: number;
  balanceMinutes: number;
  /** Marcações do dia já no fuso da empresa (HH:MM) com origem e NSR. */
  marks: Array<{ time: string; source: string; nsr: string | null }>;
}

const MIRROR_STATUS_LABEL: Record<string, string> = {
  OK: 'Normal',
  OVERTIME: 'Credito',
  UNDERTIME: 'Debito',
  ABSENT: 'Falta',
  DAY_OFF: 'Folga',
  HOLIDAY: 'Feriado',
  VACATION: 'Ferias',
  LEAVE: 'Afastamento',
  JUSTIFIED: 'Abonado',
  INCOMPLETE: 'Inconsistente',
  IN_PROGRESS: 'Em andamento',
};

/** Minutos → HH:MM (com sinal quando `signed`). */
export function minutesLabel(minutes: number, signed = false): string {
  const abs = Math.abs(Math.round(minutes));
  const body = `${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  if (!signed) return body;
  return `${minutes < 0 ? '-' : '+'}${body}`;
}

/** HH:MM no fuso fixo da empresa (UTC-3). */
export function companyTimeHHMM(date: Date): string {
  return new Date(date.getTime() - 3 * 60 * 60_000).toISOString().slice(11, 16);
}

const MIRROR_WIDTH = 120;

/**
 * Espelho de Ponto Eletrônico (Portaria 671): documento texto de largura fixa
 * por colaborador/competência — identificação do empregador e do empregado,
 * marcações diárias com NSR/origem, jornada prevista × realizada e totais.
 */
export function generateMirror(input: {
  employer: LegalEmployer;
  employee: MirrorEmployee;
  periodRef: string; // YYYY-MM
  days: MirrorDay[];
  generatedAt: Date;
  softwareVersion: string;
}): AfdResult {
  const { employer, employee, periodRef, days, generatedAt, softwareVersion } = input;
  const warnings: string[] = [];
  if (!employee.cpf) warnings.push('Colaborador sem CPF no prontuário — complete o cadastro para validade fiscal.');
  if (!employer.inpiRegistry) warnings.push('Registro do INPI não configurado — obrigatório para REP-P em fiscalização.');
  const inconsistent = days.filter((day) => day.status === 'INCOMPLETE').length;
  if (inconsistent > 0) warnings.push(`${inconsistent} dia(s) inconsistente(s) na competência — trate os ajustes antes de arquivar.`);

  const bar = '='.repeat(MIRROR_WIDTH);
  const rule = '-'.repeat(MIRROR_WIDTH);
  const ascii = (value: string) => textField(value, MIRROR_WIDTH).trimEnd();
  const lines: string[] = [];
  lines.push(bar);
  lines.push(ascii(`ESPELHO DE PONTO ELETRONICO`.padEnd(MIRROR_WIDTH - 20) + `Competencia ${periodRef}`));
  lines.push(bar);
  lines.push(ascii(`Empregador: ${employer.companyName}`));
  lines.push(ascii(`${employer.idType === 2 ? 'CPF' : 'CNPJ'}: ${employer.idNumber || '- nao cadastrado -'}   CNO/CAEPF: ${employer.cnoCaepf ?? '-'}   INPI (REP-P): ${employer.inpiRegistry ?? '- pendente -'}`));
  lines.push(rule);
  lines.push(ascii(`Colaborador: ${employee.name}`));
  lines.push(ascii(`CPF: ${employee.cpf ?? '- pendente -'}   PIS: ${employee.pisPasep ?? '-'}   Admissao: ${employee.admissionDate ?? '-'}   Funcao: ${employee.jobTitle ?? '-'}`));
  lines.push(rule);
  lines.push(ascii('Dia'.padEnd(12) + 'Marcacoes (horario/NSR)'.padEnd(56) + 'Prev.'.padEnd(7) + 'Trab.'.padEnd(7) + 'Saldo'.padEnd(8) + 'Situacao'));

  const totals = { planned: 0, worked: 0, balance: 0, absences: 0 };
  for (const day of days) {
    totals.planned += day.plannedMinutes;
    totals.worked += day.workedMinutes;
    totals.balance += day.balanceMinutes;
    if (day.status === 'ABSENT') totals.absences += 1;
    const marks = day.marks.map((mark) => (mark.nsr ? `${mark.time}(${mark.nsr})` : mark.time)).join(' ');
    const situation = day.holiday ? `Feriado: ${day.holiday}` : (MIRROR_STATUS_LABEL[day.status] ?? day.status);
    lines.push(ascii(
      day.dayKey.padEnd(12) +
      (marks || '-').padEnd(56).slice(0, 56) +
      minutesLabel(day.plannedMinutes).padEnd(7) +
      minutesLabel(day.workedMinutes).padEnd(7) +
      minutesLabel(day.balanceMinutes, true).padEnd(8) +
      situation,
    ));
  }

  lines.push(rule);
  lines.push(ascii(
    `Totais: Prevista ${minutesLabel(totals.planned)}  Trabalhada ${minutesLabel(totals.worked)}  ` +
    `Saldo ${minutesLabel(totals.balance, true)}  Faltas ${totals.absences}  Inconsistencias ${inconsistent}`,
  ));
  lines.push(ascii(`Gerado em ${afdDateTime(generatedAt)} por ${softwareVersion} - conferencia interna (Portaria 671).`));
  lines.push(ascii('Assinatura do colaborador: ____________________________  Data: ____/____/________'));
  lines.push(bar);

  return { content: lines.join('\r\n') + '\r\n', lines: lines.length, warnings };
}
