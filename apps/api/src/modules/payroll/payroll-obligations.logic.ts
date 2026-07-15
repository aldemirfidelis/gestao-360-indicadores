/**
 * Obrigações trabalhistas assistidas (Fase 5): calendário legal + Qualificação
 * Cadastral. Tudo em modo ASSISTIDO — sem transmissão automática; o sistema
 * organiza prazos, checklists e arquivos, e a empresa executa no portal oficial.
 */

export type ObligationKind = 'FGTS_DIGITAL' | 'DCTFWEB' | 'EFD_REINF' | 'QUALIF_CADASTRAL' | 'DET' | 'ESOCIAL_FECHAMENTO';

export interface ObligationTemplate {
  kind: ObligationKind;
  title: string;
  /** Dia de vencimento no mês SEGUINTE à competência (0 = sem vencimento fixo). */
  dueDay: number;
  checklist: string[];
  officialUrl: string;
}

/**
 * Modelos das obrigações mensais usuais. Os dias de vencimento seguem a prática
 * corrente e DEVEM ser conferidos com a contabilidade/calendário oficial.
 */
export const OBLIGATION_TEMPLATES: ObligationTemplate[] = [
  {
    kind: 'ESOCIAL_FECHAMENTO',
    title: 'eSocial — Fechamento dos eventos periódicos (S-1299)',
    dueDay: 15,
    checklist: ['Todos os S-1200/S-1210 enviados e aceitos', 'Sem eventos rejeitados', 'Enviar S-1299'],
    officialUrl: 'https://www.gov.br/esocial/pt-br',
  },
  {
    kind: 'EFD_REINF',
    title: 'EFD-Reinf — Fechamento (R-2099)',
    dueDay: 15,
    checklist: ['Retenções e serviços tomados/prestados conferidos', 'Enviar fechamento R-2099'],
    officialUrl: 'https://www.gov.br/receitafederal/pt-br',
  },
  {
    kind: 'DCTFWEB',
    title: 'DCTFWeb — Transmissão e DARF',
    dueDay: 15,
    checklist: ['eSocial e EFD-Reinf fechados', 'Conferir totalizadores (S-5011/5012)', 'Transmitir DCTFWeb', 'Emitir e pagar o DARF'],
    officialUrl: 'https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/declaracoes-e-demonstrativos/dctfweb',
  },
  {
    kind: 'FGTS_DIGITAL',
    title: 'FGTS Digital — Guia e pagamento',
    dueDay: 20,
    checklist: ['Bases de FGTS conferidas (S-5003)', 'Emitir guia no FGTS Digital', 'Pagar a guia', 'Anexar o comprovante'],
    officialUrl: 'https://www.gov.br/trabalho-e-emprego/pt-br/servicos/empregador/fgts-digital',
  },
  {
    kind: 'DET',
    title: 'DET — Domicílio Eletrônico Trabalhista (monitorar)',
    dueDay: 0,
    checklist: ['Verificar caixa do DET', 'Registrar ciência de notificações', 'Anexar comprovantes'],
    officialUrl: 'https://www.gov.br/trabalho-e-emprego/pt-br/servicos/empregador/det',
  },
];

/** Último dia do mês (para vencimentos que caem no fim do mês seguinte). */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Data de vencimento de uma obrigação (dia no mês SEGUINTE à competência).
 * Se cair em fim de semana, NÃO antecipa/prorroga aqui (regra bancária varia por
 * obrigação) — apenas usa o dia informado, limitado ao último dia do mês.
 */
export function dueDateFor(periodRef: string, dueDay: number): string | null {
  if (dueDay <= 0) return null;
  const [y, m] = periodRef.split('-').map(Number);
  const nextYear = m === 12 ? y + 1 : y;
  const nextMonth = m === 12 ? 1 : m + 1;
  const day = Math.min(dueDay, lastDayOfMonth(nextYear, nextMonth));
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ------------------------------ Qualificação Cadastral ------------------------------

export interface QualifCadWorker {
  cpf: string | null;
  nis: string | null;
  name: string;
  birthDate: string | null; // YYYY-MM-DD
}

export interface QualifCadRow {
  cpf: string;
  nis: string;
  name: string;
  birthDate: string; // DDMMAAAA
}

function onlyDigits(v: string | null | undefined): string {
  return String(v ?? '').replace(/\D/g, '');
}

function toBrDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}${m}${y}`;
}

/** Normaliza os trabalhadores para o leiaute da Consulta Qualificação Cadastral em lote. */
export function buildQualifCadRows(workers: QualifCadWorker[]): { rows: QualifCadRow[]; issues: string[] } {
  const rows: QualifCadRow[] = [];
  const issues: string[] = [];
  for (const worker of workers) {
    const cpf = onlyDigits(worker.cpf);
    const nis = onlyDigits(worker.nis);
    if (cpf.length !== 11) { issues.push(`CPF inválido para ${worker.name}.`); continue; }
    rows.push({ cpf, nis, name: worker.name.trim().toUpperCase().slice(0, 70), birthDate: toBrDate(worker.birthDate) });
  }
  return { rows, issues };
}

/** Arquivo CSV do lote de Qualificação Cadastral (CPF;NIS;Nome;DataNasc). */
export function qualifCadCsv(rows: QualifCadRow[]): string {
  const header = 'CPF;NIS;NOME;DATA_NASCIMENTO';
  const lines = rows.map((r) => `${r.cpf};${r.nis};${r.name};${r.birthDate}`);
  return [header, ...lines].join('\r\n') + '\r\n';
}

export interface QualifCadReturnRow {
  cpf: string;
  status: string; // OK | DIVERGENTE
  divergences: string[];
}

/**
 * Interpreta um retorno da Qualificação Cadastral (CSV tolerante): identifica
 * divergências por CPF. Espera colunas CPF e um campo de situação/divergências.
 */
export function parseQualifCadReturn(csv: string): QualifCadReturnRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const out: QualifCadReturnRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[;,]/).map((c) => c.trim());
    const cpf = onlyDigits(cols[0]);
    if (cpf.length !== 11) continue;
    const rest = cols.slice(1).join(' ').toUpperCase();
    const divergences: string[] = [];
    for (const [needle, label] of [['NOME', 'Nome divergente'], ['NASC', 'Data de nascimento divergente'], ['NIS', 'NIS divergente'], ['CPF', 'CPF divergente']] as const) {
      if (rest.includes(`${needle} DIVERG`) || rest.includes(`${needle}_DIVERG`)) divergences.push(label);
    }
    const status = divergences.length || rest.includes('DIVERG') ? 'DIVERGENTE' : 'OK';
    out.push({ cpf, status, divergences });
  }
  return out;
}
