/**
 * Parser/validador PURO da importacao manual (planilha CSV/XLSX) da base
 * elegivel e de eventos — contingencia oficial enquanto o conector Apdata
 * nao esta ligado. Modulo de PAGAMENTO: toda linha invalida e REJEITADA com
 * mensagem por linha/coluna; o commit so acontece com zero erros.
 *
 * Campos conforme requisitos (matriz POC itens "Integracao com Apdata"):
 * base elegivel = cadastro, cargo, area/lotacao, centro de custo, salario,
 * datas, situacao, dias trabalhados; eventos = faltas, atestados, medidas
 * disciplinares, suspensoes, acidentes, treinamento.
 */
import { EligibleRow } from './prize-eligible.util';

export interface RowIssue {
  row: number; // numero da linha na planilha (1 = cabecalho, dados a partir de 2)
  column?: string;
  message: string;
}

export interface ParsedEligible {
  rows: EligibleRow[];
  errors: RowIssue[];
  warnings: RowIssue[];
  unknownColumns: string[];
}

export interface ImportEventRow {
  registration: string;
  type: string;
  date?: string | null;
  days?: number | null;
  value?: number | null;
  description?: string | null;
}

export interface ParsedEvents {
  events: ImportEventRow[];
  errors: RowIssue[];
  warnings: RowIssue[];
  unknownColumns: string[];
}

// ---- normalizacao de cabecalhos (tolerante a acento/caixa/espaco) ----

export function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s.\-/]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// canonico -> cabecalhos aceitos (ja normalizados)
const ELIGIBLE_HEADER_MAP: Record<string, string[]> = {
  registration: ['matricula', 'cadastro', 'registro'],
  name: ['nome', 'nome_completo', 'colaborador'],
  cpf: ['cpf'],
  bond: ['vinculo', 'tipo_vinculo'],
  branchRef: ['filial', 'empresa_filial'],
  unitRef: ['unidade'],
  positionRef: ['cargo'],
  functionRef: ['funcao'],
  areaRef: ['area', 'lotacao', 'area_lotacao'],
  sectorRef: ['setor'],
  costCenterRef: ['centro_de_custo', 'centro_custo', 'cc'],
  baseSalary: ['salario_base', 'salario'],
  admissionDate: ['data_admissao', 'admissao', 'data_de_admissao'],
  terminationDate: ['data_desligamento', 'desligamento', 'data_de_desligamento'],
  situation: ['situacao', 'status'],
  workedDays: ['dias_trabalhados', 'dias'],
};

const EVENT_HEADER_MAP: Record<string, string[]> = {
  registration: ['matricula', 'cadastro', 'registro'],
  type: ['tipo', 'tipo_evento', 'evento'],
  date: ['data', 'data_evento'],
  days: ['dias', 'qtde_dias', 'quantidade_dias'],
  value: ['valor'],
  description: ['descricao', 'observacao', 'obs'],
};

// Colunas oficiais do modelo (ordem do template)
export const ELIGIBLE_TEMPLATE_HEADERS = [
  'matricula', 'nome', 'cpf', 'vinculo', 'filial', 'unidade', 'cargo', 'funcao',
  'area', 'setor', 'centro_de_custo', 'salario_base', 'data_admissao',
  'data_desligamento', 'situacao', 'dias_trabalhados',
] as const;

export const EVENT_TEMPLATE_HEADERS = ['matricula', 'tipo', 'data', 'dias', 'valor', 'descricao'] as const;

// Tipos de evento que o motor/moderadores reconhecem. Tipo desconhecido e ERRO:
// um evento com tipo errado nao casaria com nenhuma regra e silenciosamente
// deixaria de reduzir o premio (pagamento indevido).
// FALTA..TREINAMENTO alimentam moderadores; FERIAS/LICENCA/AFASTAMENTO/
// AUXILIO_DOENCA reduzem os DIAS DE DIREITO (planilha CALCULO, coluna AD —
// categorias do Apdata "FALTAS E ATESTADOS").
export const KNOWN_EVENT_TYPES = [
  'FALTA', 'ATESTADO', 'MEDIDA_DISCIPLINAR', 'SUSPENSAO', 'ACIDENTE', 'TREINAMENTO',
  'FERIAS', 'LICENCA', 'AFASTAMENTO', 'AUXILIO_DOENCA',
] as const;

const SITUATION_MAP: Record<string, string> = {
  ATIVO: 'ACTIVE', ACTIVE: 'ACTIVE',
  DESLIGADO: 'TERMINATED', DEMITIDO: 'TERMINATED', TERMINATED: 'TERMINATED',
  AFASTADO: 'AWAY', LICENCA: 'AWAY', AWAY: 'AWAY',
  FERIAS: 'VACATION', VACATION: 'VACATION',
  TREINAMENTO: 'TRAINING', TRAINING: 'TRAINING',
};

// ---- parsers de valor ----

/** Numero em formato pt-BR ("3.500,75"), en ("3500.75") ou numerico. NaN = invalido. */
export function parsePtNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  let s = String(v).trim().replace(/^R\$\s*/i, '');
  if (!s) return null;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // o ultimo separador e o decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  } else if (hasDot) {
    // "3.500" (milhar pt-BR) vs "3500.75" (decimal): trata como milhar apenas
    // se houver exatamente 3 digitos apos o ponto e mais de um grupo
    const m = s.match(/^\d{1,3}(\.\d{3})+$/);
    if (m) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Data em dd/mm/aaaa, aaaa-mm-dd, Date ou serial Excel. Retorna ISO (yyyy-mm-dd) ou 'INVALID'. */
export function parseFlexDate(v: unknown): string | null | 'INVALID' {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return 'INVALID';
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'number') {
    // serial Excel (dias desde 1899-12-30); faixa plausivel ~1968..2068
    if (v < 25000 || v > 61500) return 'INVALID';
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let y: number, mo: number, d: number;
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    d = Number(m[1]); mo = Number(m[2]); y = Number(m[3]);
  } else {
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
    if (!m) return 'INVALID';
    y = Number(m[1]); mo = Number(m[2]); d = Number(m[3]);
  }
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return 'INVALID';
  return date.toISOString().slice(0, 10);
}

/** Validacao completa de CPF (digitos verificadores). */
export function isValidCpf(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false; // todos iguais
  for (const pos of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < pos; i++) sum += Number(d[i]) * (pos + 1 - i);
    const dv = ((sum * 10) % 11) % 10;
    if (dv !== Number(d[pos])) return false;
  }
  return true;
}

// ---- mapeamento de linha crua -> campos canonicos ----

function mapRow(raw: Record<string, unknown>, headerMap: Record<string, string[]>): { mapped: Record<string, unknown>; unknown: string[] } {
  const reverse = new Map<string, string>();
  for (const [canon, aliases] of Object.entries(headerMap)) {
    for (const a of aliases) reverse.set(a, canon);
  }
  const mapped: Record<string, unknown> = {};
  const unknown: string[] = [];
  for (const [key, value] of Object.entries(raw)) {
    const canon = reverse.get(normalizeHeader(key));
    if (canon) {
      // primeiro alias encontrado vence; nao sobrescreve com vazio
      if (mapped[canon] === undefined || mapped[canon] === '' || mapped[canon] === null) mapped[canon] = value;
    } else if (String(key).trim()) {
      unknown.push(String(key).trim());
    }
  }
  return { mapped, unknown };
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function meaningfulStr(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const norm = normalizeHeader(s);
  if (!norm || ['nenhuma', 'nenhum', 'nao_informado', 'sem_cid'].includes(norm)) return null;
  return s;
}

// ---- parse da base elegivel ----

export function parseEligibleRows(rawRows: Array<Record<string, unknown>>): ParsedEligible {
  const rows: EligibleRow[] = [];
  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const unknownColumns = new Set<string>();
  const seenRegistrations = new Map<string, number>();

  rawRows.forEach((raw, i) => {
    const rowNum = i + 2; // 1 = cabecalho
    const { mapped, unknown } = mapRow(raw, ELIGIBLE_HEADER_MAP);
    unknown.forEach((u) => unknownColumns.add(u));

    const registration = str(mapped.registration);
    const name = str(mapped.name);
    if (!registration) {
      errors.push({ row: rowNum, column: 'matricula', message: 'Matrícula é obrigatória' });
      return;
    }
    if (!name) {
      errors.push({ row: rowNum, column: 'nome', message: 'Nome é obrigatório' });
      return;
    }
    const firstSeen = seenRegistrations.get(registration);
    if (firstSeen) {
      errors.push({ row: rowNum, column: 'matricula', message: `Matrícula ${registration} duplicada no arquivo (já usada na linha ${firstSeen})` });
      return;
    }
    seenRegistrations.set(registration, rowNum);

    const out: EligibleRow = { registration, name };

    const cpfRaw = str(mapped.cpf);
    if (cpfRaw) {
      if (!isValidCpf(cpfRaw)) {
        errors.push({ row: rowNum, column: 'cpf', message: `CPF inválido (dígito verificador não confere): ${cpfRaw.replace(/\d(?=\d{4})/g, '*')}` });
        return;
      }
      out.cpf = cpfRaw.replace(/\D/g, '');
    } else {
      warnings.push({ row: rowNum, column: 'cpf', message: 'CPF ausente (espelho/folha podem exigir)' });
    }

    const salary = parsePtNumber(mapped.baseSalary);
    if (Number.isNaN(salary)) {
      errors.push({ row: rowNum, column: 'salario_base', message: `Salário inválido: "${mapped.baseSalary}"` });
      return;
    }
    if (salary !== null) {
      if (salary < 0) {
        errors.push({ row: rowNum, column: 'salario_base', message: 'Salário não pode ser negativo' });
        return;
      }
      if (salary === 0) warnings.push({ row: rowNum, column: 'salario_base', message: 'Salário zerado — prêmio será 0' });
      out.baseSalary = salary;
    } else {
      warnings.push({ row: rowNum, column: 'salario_base', message: 'Salário ausente — colaborador não poderá ser apurado' });
    }

    const admission = parseFlexDate(mapped.admissionDate);
    if (admission === 'INVALID') {
      errors.push({ row: rowNum, column: 'data_admissao', message: `Data de admissão inválida: "${mapped.admissionDate}" (use dd/mm/aaaa)` });
      return;
    }
    out.admissionDate = admission;

    const termination = parseFlexDate(mapped.terminationDate);
    if (termination === 'INVALID') {
      errors.push({ row: rowNum, column: 'data_desligamento', message: `Data de desligamento inválida: "${mapped.terminationDate}" (use dd/mm/aaaa)` });
      return;
    }
    out.terminationDate = termination;
    if (admission && termination && termination < admission) {
      errors.push({ row: rowNum, column: 'data_desligamento', message: 'Desligamento anterior à admissão' });
      return;
    }

    const situationRaw = str(mapped.situation);
    if (situationRaw) {
      const norm = SITUATION_MAP[normalizeHeader(situationRaw).toUpperCase()];
      if (norm) {
        out.situation = norm;
      } else {
        warnings.push({ row: rowNum, column: 'situacao', message: `Situação "${situationRaw}" não reconhecida (esperado: ATIVO, DESLIGADO, AFASTADO, FÉRIAS, TREINAMENTO) — mantida como informada` });
        out.situation = situationRaw.toUpperCase();
      }
    }
    if (out.situation === 'TERMINATED' && !termination) {
      warnings.push({ row: rowNum, column: 'data_desligamento', message: 'Situação DESLIGADO sem data de desligamento — proporcionalidade usará o mês inteiro' });
    }
    if (termination && out.situation && out.situation !== 'TERMINATED') {
      warnings.push({ row: rowNum, column: 'situacao', message: 'Há data de desligamento mas a situação não é DESLIGADO' });
    }

    const workedDays = parsePtNumber(mapped.workedDays);
    if (Number.isNaN(workedDays)) {
      errors.push({ row: rowNum, column: 'dias_trabalhados', message: `Dias trabalhados inválido: "${mapped.workedDays}"` });
      return;
    }
    if (workedDays !== null) {
      if (!Number.isInteger(workedDays) || workedDays < 0 || workedDays > 31) {
        errors.push({ row: rowNum, column: 'dias_trabalhados', message: 'Dias trabalhados deve ser inteiro entre 0 e 31' });
        return;
      }
      out.workedDays = workedDays;
    }

    out.bond = str(mapped.bond);
    out.branchRef = str(mapped.branchRef);
    out.unitRef = str(mapped.unitRef);
    out.positionRef = str(mapped.positionRef);
    out.functionRef = str(mapped.functionRef);
    out.areaRef = str(mapped.areaRef);
    out.sectorRef = str(mapped.sectorRef);
    out.costCenterRef = str(mapped.costCenterRef);
    if (!out.positionRef) warnings.push({ row: rowNum, column: 'cargo', message: 'Cargo ausente — sem cargo não há match de anexo vigente' });
    if (!out.areaRef) warnings.push({ row: rowNum, column: 'area', message: 'Área ausente' });

    rows.push(out);
  });

  return { rows, errors, warnings, unknownColumns: [...unknownColumns] };
}

// ---- parse de eventos ----

const EVENT_TYPE_ALIASES: Record<string, string> = {
  FALTA: 'FALTA', FALTAS: 'FALTA', FALTA_INJUSTIFICADA: 'FALTA', FALTA_JUSTIFICADA: 'FALTA',
  ATESTADO: 'ATESTADO', ATESTADOS: 'ATESTADO', ATESTADO_MEDICO: 'ATESTADO',
  MEDIDA_DISCIPLINAR: 'MEDIDA_DISCIPLINAR', MEDIDA: 'MEDIDA_DISCIPLINAR', ADVERTENCIA: 'MEDIDA_DISCIPLINAR',
  SUSPENSAO: 'SUSPENSAO', SUSPENSOES: 'SUSPENSAO',
  ACIDENTE: 'ACIDENTE', ACIDENTE_DE_TRABALHO: 'ACIDENTE', ACIDENTE_ATO_INSEGURO: 'ACIDENTE',
  TREINAMENTO: 'TREINAMENTO',
  FERIAS: 'FERIAS',
  LICENCA: 'LICENCA', LICENCA_MATERNIDADE: 'LICENCA', LICENCA_PATERNIDADE: 'LICENCA', LICENCA_NAO_REMUNERADA: 'LICENCA',
  AFASTAMENTO: 'AFASTAMENTO', AFASTADO: 'AFASTAMENTO', APOSENTADORIA_INVALIDEZ: 'AFASTAMENTO', RECLUSAO: 'AFASTAMENTO',
  AUXILIO_DOENCA: 'AUXILIO_DOENCA', AUX_DOENCA: 'AUXILIO_DOENCA', DIAS_EM_AUX_DOENCA: 'AUXILIO_DOENCA',
};

// ---- parse da planilha DatasAtestados (Espelho de Ponto) ----
// Cada linha = UMA ocorrencia de atestado (Data Inicio/Fim + Quantidade de
// dias). O motor usa as ocorrencias para o criterio PER_DAY_AFTER_FIRST
// (1o atestado abonado; do 2o em diante reduz 20%/dia) e a soma dos dias
// reduz os Dias de Direito (proporcionalidade).
const ATESTADO_HEADER_MAP: Record<string, string[]> = {
  registration: ['id_contratado', 'id_contrato', 'contratado', 'matricula', 'cadastro', 'registro'],
  name: ['nome', 'colaborador'],
  date: ['data_inicio', 'data_de_inicio', 'inicio', 'data_inicio_afastamento', 'data_inicio_na_situacao', 'data_inicio_da_situacao', 'data'],
  endDate: ['data_fim', 'data_de_fim', 'fim', 'termino', 'data_termino', 'data_fim_da_situacao', 'data_fim_na_situacao'],
  days: ['quantidade', 'qtde', 'qtd', 'dias', 'quantidade_dias', 'quantidade_de_dias', 'qtde_dias'],
  cid: ['codigo_oficial_cid', 'cid', 'codigo_oficial', 'codigo', 'cid_doenca'],
  diagnosis: ['doenca_cid', 'doenca'],
  kind: ['tipo_de_atestado', 'tipo_atestado', 'tipo'],
  ignored: [
    'situacao',
    'cid_cosdoencacidoficial_1',
    'cid_d1sdoencacid_1',
    'cid_cosdoencacidoficial_2',
    'cid_d1sdoencacid_2',
    'log_transacao',
    'data_hora_inicio_da_transacao',
    'id_usuario',
    'login_usuario',
    'id_contratado_usuario',
    'nome_do_usuario',
  ],
};

export const ATESTADO_TEMPLATE_HEADERS = ['id_contratado', 'nome', 'data_inicio', 'data_fim', 'quantidade', 'doenca_cid'] as const;

/** Dias entre duas datas ISO (inclusive). null se invalido. */
function daysInclusive(startIso: string, endIso: string): number | null {
  const a = Date.parse(startIso);
  const b = Date.parse(endIso);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / 86400000) + 1;
}

export function parseAtestadoRows(
  rawRows: Array<Record<string, unknown>>,
  knownRegistrations?: Set<string>,
): ParsedEvents {
  const events: ImportEventRow[] = [];
  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const unknownColumns = new Set<string>();

  rawRows.forEach((raw, i) => {
    const rowNum = i + 2;
    const { mapped, unknown } = mapRow(raw, ATESTADO_HEADER_MAP);
    unknown.forEach((u) => unknownColumns.add(u));

    const registration = str(mapped.registration);
    if (!registration) {
      errors.push({ row: rowNum, column: 'id_contratado', message: 'Id Contratado (matrícula) é obrigatório' });
      return;
    }
    if (knownRegistrations && !knownRegistrations.has(registration)) {
      errors.push({ row: rowNum, column: 'id_contratado', message: `Id Contratado ${registration} não existe na base elegível desta competência` });
      return;
    }

    const date = parseFlexDate(mapped.date);
    if (date === 'INVALID') {
      errors.push({ row: rowNum, column: 'data_inicio', message: `Data de início inválida: "${mapped.date}" (use dd/mm/aaaa)` });
      return;
    }
    if (!date) {
      warnings.push({ row: rowNum, column: 'data_inicio', message: 'Data de início ausente — a regra "1º atestado abonado" ordena por data; sem ela a ordem pode ficar incorreta' });
    }
    const endDate = parseFlexDate(mapped.endDate);
    if (endDate === 'INVALID') {
      errors.push({ row: rowNum, column: 'data_fim', message: `Data fim inválida: "${mapped.endDate}" (use dd/mm/aaaa)` });
      return;
    }

    // Dias: usa a Quantidade; se ausente, deriva do intervalo Inicio..Fim.
    let days = parsePtNumber(mapped.days);
    if (Number.isNaN(days)) {
      errors.push({ row: rowNum, column: 'quantidade', message: `Quantidade inválida: "${mapped.days}"` });
      return;
    }
    if ((days === null || days === 0) && date && endDate) {
      const derived = daysInclusive(date, endDate);
      if (derived) days = derived;
    }
    if (days === null) {
      errors.push({ row: rowNum, column: 'quantidade', message: 'Quantidade de dias ausente (e sem Data Início/Fim para derivar)' });
      return;
    }
    if (!Number.isInteger(days) || days < 1 || days > 31) {
      errors.push({ row: rowNum, column: 'quantidade', message: 'Quantidade deve ser inteiro entre 1 e 31' });
      return;
    }

    const cid = meaningfulStr(mapped.cid);
    const diagnosis = meaningfulStr(mapped.diagnosis);
    const descParts = [endDate ? `até ${endDate}` : null, cid ? `CID ${cid}` : null, diagnosis].filter(Boolean);
    events.push({
      registration,
      type: 'ATESTADO',
      date: date ?? null,
      days,
      value: null,
      description: descParts.length ? descParts.join(' · ') : null,
    });
  });

  return { events, errors, warnings, unknownColumns: [...unknownColumns] };
}

export function parseEventRows(
  rawRows: Array<Record<string, unknown>>,
  knownRegistrations?: Set<string>,
): ParsedEvents {
  const events: ImportEventRow[] = [];
  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const unknownColumns = new Set<string>();

  rawRows.forEach((raw, i) => {
    const rowNum = i + 2;
    const { mapped, unknown } = mapRow(raw, EVENT_HEADER_MAP);
    unknown.forEach((u) => unknownColumns.add(u));

    const registration = str(mapped.registration);
    if (!registration) {
      errors.push({ row: rowNum, column: 'matricula', message: 'Matrícula é obrigatória' });
      return;
    }
    if (knownRegistrations && !knownRegistrations.has(registration)) {
      errors.push({ row: rowNum, column: 'matricula', message: `Matrícula ${registration} não existe na base elegível desta importação` });
      return;
    }

    const typeRaw = str(mapped.type);
    if (!typeRaw) {
      errors.push({ row: rowNum, column: 'tipo', message: 'Tipo do evento é obrigatório' });
      return;
    }
    const type = EVENT_TYPE_ALIASES[normalizeHeader(typeRaw).toUpperCase()];
    if (!type) {
      errors.push({ row: rowNum, column: 'tipo', message: `Tipo "${typeRaw}" não reconhecido. Aceitos: ${KNOWN_EVENT_TYPES.join(', ')}. Tipo errado NÃO entraria no cálculo.` });
      return;
    }

    const date = parseFlexDate(mapped.date);
    if (date === 'INVALID') {
      errors.push({ row: rowNum, column: 'data', message: `Data inválida: "${mapped.date}" (use dd/mm/aaaa)` });
      return;
    }

    const days = parsePtNumber(mapped.days);
    if (Number.isNaN(days)) {
      errors.push({ row: rowNum, column: 'dias', message: `Dias inválido: "${mapped.days}"` });
      return;
    }
    if (days !== null && (!Number.isInteger(days) || days < 0 || days > 31)) {
      errors.push({ row: rowNum, column: 'dias', message: 'Dias deve ser inteiro entre 0 e 31' });
      return;
    }
    if (days === null && ['FALTA', 'ATESTADO', 'SUSPENSAO', 'TREINAMENTO', 'FERIAS', 'LICENCA', 'AFASTAMENTO', 'AUXILIO_DOENCA'].includes(type)) {
      warnings.push({ row: rowNum, column: 'dias', message: `Evento ${type} sem quantidade de dias — moderador/proporcionalidade por dia não será aplicado` });
    }

    const value = parsePtNumber(mapped.value);
    if (Number.isNaN(value)) {
      errors.push({ row: rowNum, column: 'valor', message: `Valor inválido: "${mapped.value}"` });
      return;
    }

    events.push({
      registration,
      type,
      date: date ?? null,
      days: days ?? null,
      value: value ?? null,
      description: str(mapped.description),
    });
  });

  return { events, errors, warnings, unknownColumns: [...unknownColumns] };
}
