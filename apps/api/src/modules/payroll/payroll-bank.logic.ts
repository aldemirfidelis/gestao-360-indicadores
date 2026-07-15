/**
 * Pagamento bancário da folha (Fase 6): geração de remessa CNAB 240 (padrão
 * FEBRABAN, crédito em conta — segmento A), verificações antifraude e leitura
 * de retorno.
 *
 * ⚠️ O CNAB 240 tem particularidades POR BANCO. Este gerador segue a estrutura
 * FEBRABAN com os campos essenciais posicionados; campos específicos do banco
 * (códigos de convênio, complementos) DEVEM ser ajustados conforme o manual do
 * banco antes de transmitir. Nada é enviado automaticamente.
 */

function digits(value: string | null | undefined, len: number): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, len).padStart(len, '0');
}

function alpha(value: string | null | undefined, len: number): string {
  const clean = String(value ?? '')
    .normalize('NFD')
    .split('')
    .filter((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return cp < 0x0300 || cp > 0x036f;
    })
    .join('')
    .toUpperCase();
  return clean.slice(0, len).padEnd(len, ' ');
}

function num(value: number, len: number): string {
  return String(Math.max(0, Math.round(value))).slice(0, len).padStart(len, '0');
}

export interface CnabCompany {
  bankCode: string; // 3 dígitos (ex.: 341 Itaú, 001 BB, 237 Bradesco)
  cnpj: string;
  name: string;
  agency: string;
  account: string;
  accountDigit: string;
}

export interface CnabPaymentItem {
  favoredBankCode: string;
  favoredAgency: string;
  favoredAccount: string;
  favoredAccountDigit: string;
  favoredName: string;
  favoredCpf: string;
  amountCents: number;
  /** Data do pagamento YYYY-MM-DD. */
  paymentDate: string;
}

/** DDMMAAAA a partir de YYYY-MM-DD. */
function cnabDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}${m}${y}`;
}

/**
 * Gera a remessa CNAB 240 (crédito em conta, pagamento de salários). Retorna o
 * conteúdo (linhas de 240 chars) e os totais. Padrão FEBRABAN — ajustar por banco.
 */
export function buildCnab240(input: {
  company: CnabCompany;
  items: CnabPaymentItem[];
  fileSequence: number;
  generatedAt: Date;
}): { content: string; lines: number; totalCents: number } {
  const { company, items, fileSequence, generatedAt } = input;
  const bank = digits(company.bankCode, 3);
  const dtGer = cnabDate(generatedAt.toISOString().slice(0, 10));
  const hhmmss = generatedAt.toISOString().slice(11, 19).replace(/:/g, '');
  const lines: string[] = [];

  // Registro 0 — Header de Arquivo (240).
  lines.push(
    (bank + '0000' + '0' + ' '.repeat(9) +
      '2' + digits(company.cnpj, 14) + ' '.repeat(20) +
      digits(company.agency, 5) + ' ' + digits(company.account, 12) + ' ' + alpha(company.accountDigit, 1) + ' ' +
      alpha(company.name, 30) + alpha('BANCO', 30) + ' '.repeat(10) +
      '1' + dtGer + hhmmss + num(fileSequence, 6) + '103' + '00000' + ' '.repeat(20) + ' '.repeat(20) + ' '.repeat(29)
    ).slice(0, 240).padEnd(240, ' '),
  );

  // Registro 1 — Header de Lote (pagamento de salários: serviço 30, forma 01).
  lines.push(
    (bank + '0001' + '1' + 'C' + '30' + '01' + '046' + ' ' +
      '2' + digits(company.cnpj, 14) + ' '.repeat(20) +
      digits(company.agency, 5) + ' ' + digits(company.account, 12) + ' ' + alpha(company.accountDigit, 1) + ' ' +
      alpha(company.name, 30) + ' '.repeat(40) + ' '.repeat(30) +
      alpha('', 5) + alpha('', 15) + ' '.repeat(8) + dtGer + '00000000' + ' '.repeat(33)
    ).slice(0, 240).padEnd(240, ' '),
  );

  let total = 0;
  items.forEach((item, index) => {
    total += item.amountCents;
    // Registro 3 — Detalhe, Segmento A (crédito em conta do favorecido).
    lines.push(
      (bank + '0001' + '3' + num(index + 1, 5) + 'A' + '000' + '000' +
        digits(item.favoredBankCode, 3) +
        digits(item.favoredAgency, 5) + ' ' + digits(item.favoredAccount, 12) + ' ' + alpha(item.favoredAccountDigit, 1) + ' ' +
        alpha(item.favoredName, 30) +
        alpha('', 20) + // seu número
        cnabDate(item.paymentDate) + 'BRL' + num(0, 15) + num(item.amountCents, 15) +
        alpha('', 20) + '00000000' + num(item.amountCents, 15) +
        ' '.repeat(18) + '0' + digits(item.favoredCpf, 14) + ' '.repeat(19)
      ).slice(0, 240).padEnd(240, ' '),
    );
  });

  // Registro 5 — Trailer de Lote (qtd registros do lote = detalhes + 2).
  lines.push(
    (bank + '0001' + '5' + ' '.repeat(9) + num(items.length + 2, 6) + num(total, 18) + num(0, 18) + ' '.repeat(171) + ' '.repeat(10)
    ).slice(0, 240).padEnd(240, ' '),
  );

  // Registro 9 — Trailer de Arquivo (1 lote; total de linhas).
  lines.push(
    (bank + '9999' + '9' + ' '.repeat(9) + num(1, 6) + num(lines.length + 1, 6) + num(0, 6) + ' '.repeat(205)
    ).slice(0, 240).padEnd(240, ' '),
  );

  return { content: lines.join('\r\n') + '\r\n', lines: lines.length, totalCents: total };
}

// ------------------------------ antifraude ------------------------------

export interface AntifraudInput {
  items: Array<{ employeeId: string; name: string; account: string | null; pixKey: string | null; netCents: number; active: boolean; accountChangedRecently: boolean }>;
}

export interface AntifraudAlert {
  severity: 'HIGH' | 'MEDIUM';
  code: string;
  message: string;
  employeeId?: string;
}

/** Verificações antifraude sobre os itens de um lote bancário. */
export function antifraudChecks(input: AntifraudInput): AntifraudAlert[] {
  const alerts: AntifraudAlert[] = [];
  const accountMap = new Map<string, string[]>();
  const pixMap = new Map<string, string[]>();
  const positiveTotal = input.items.reduce((sum, i) => sum + Math.max(0, i.netCents), 0);
  const positiveCount = input.items.filter((i) => i.netCents > 0).length;

  for (const item of input.items) {
    // Média dos DEMAIS itens (o próprio outlier não infla a referência).
    const othersCount = positiveCount - (item.netCents > 0 ? 1 : 0);
    const avgOthers = othersCount > 0 ? (positiveTotal - Math.max(0, item.netCents)) / othersCount : 0;
    if (item.account) accountMap.set(item.account, [...(accountMap.get(item.account) ?? []), item.employeeId]);
    if (item.pixKey) pixMap.set(item.pixKey, [...(pixMap.get(item.pixKey) ?? []), item.employeeId]);
    if (!item.active) alerts.push({ severity: 'HIGH', code: 'INACTIVE', message: `${item.name}: colaborador desligado com pagamento.`, employeeId: item.employeeId });
    if (item.netCents <= 0) alerts.push({ severity: 'HIGH', code: 'NONPOSITIVE', message: `${item.name}: líquido zero/negativo.`, employeeId: item.employeeId });
    if (!item.account && !item.pixKey) alerts.push({ severity: 'HIGH', code: 'NO_ACCOUNT', message: `${item.name}: sem conta bancária nem PIX.`, employeeId: item.employeeId });
    if (item.accountChangedRecently) alerts.push({ severity: 'MEDIUM', code: 'ACCOUNT_CHANGED', message: `${item.name}: conta bancária alterada recentemente.`, employeeId: item.employeeId });
    if (avgOthers > 0 && item.netCents > avgOthers * 3) alerts.push({ severity: 'MEDIUM', code: 'OUTLIER', message: `${item.name}: líquido muito acima da média do lote.`, employeeId: item.employeeId });
  }
  for (const [account, ids] of accountMap) if (ids.length > 1) alerts.push({ severity: 'HIGH', code: 'DUP_ACCOUNT', message: `Conta ${account} repetida em ${ids.length} colaboradores.` });
  for (const [pix, ids] of pixMap) if (ids.length > 1) alerts.push({ severity: 'HIGH', code: 'DUP_PIX', message: `PIX ${pix} repetido em ${ids.length} colaboradores.` });
  return alerts;
}

// ------------------------------ retorno ------------------------------

export interface CnabReturnItem {
  favoredName: string;
  amountCents: number;
  /** Código de ocorrência do banco (00/BD = pago; demais = rejeição). */
  occurrenceCode: string;
  paid: boolean;
}

/** Lê um retorno CNAB 240: extrai por segmento A o status de cada pagamento. */
export function parseCnab240Return(content: string): CnabReturnItem[] {
  const lines = content.split(/\r?\n/).filter((l) => l.length >= 230);
  const out: CnabReturnItem[] = [];
  for (const line of lines) {
    const registro = line[7];
    const segmento = line[13];
    if (registro !== '3' || segmento !== 'A') continue;
    const favoredName = line.slice(44, 74).trim();
    const amountCents = Number(line.slice(120, 135)) || 0;
    const occurrenceCode = line.slice(230, 240).trim().slice(0, 2) || line.slice(-10).trim().slice(0, 2);
    const paid = occurrenceCode === '' || occurrenceCode === '00' || occurrenceCode === 'BD';
    out.push({ favoredName, amountCents, occurrenceCode, paid });
  }
  return out;
}
