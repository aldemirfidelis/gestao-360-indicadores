/**
 * Contabilização da folha (Fase 6): partidas dobradas (débito = crédito) a
 * partir dos totais do processamento. As contas são configuráveis por empresa
 * (plano de contas); os padrões abaixo são um ponto de partida e devem ser
 * ajustados pela contabilidade.
 */

export type AccountCategory =
  | 'DESPESA_SALARIOS'
  | 'SALARIOS_A_PAGAR'
  | 'INSS_A_RECOLHER'
  | 'IRRF_A_RECOLHER'
  | 'OUTROS_DESCONTOS'
  | 'DESPESA_FGTS'
  | 'FGTS_A_RECOLHER';

export interface AccountRef {
  code: string;
  name: string;
}

export const DEFAULT_ACCOUNTS: Record<AccountCategory, AccountRef> = {
  DESPESA_SALARIOS: { code: '3.1.1.01', name: 'Despesa com Salários' },
  SALARIOS_A_PAGAR: { code: '2.1.1.01', name: 'Salários a Pagar' },
  INSS_A_RECOLHER: { code: '2.1.2.01', name: 'INSS a Recolher' },
  IRRF_A_RECOLHER: { code: '2.1.2.02', name: 'IRRF a Recolher' },
  OUTROS_DESCONTOS: { code: '2.1.2.09', name: 'Outros Descontos a Repassar' },
  DESPESA_FGTS: { code: '3.1.1.02', name: 'Despesa com FGTS' },
  FGTS_A_RECOLHER: { code: '2.1.2.03', name: 'FGTS a Recolher' },
};

export interface AccountingTotals {
  earningsCents: number; // total de proventos
  inssCents: number;
  irrfCents: number;
  otherDeductionsCents: number; // descontos além de INSS/IRRF
  netCents: number; // líquido a pagar
  fgtsCents: number; // encargo FGTS (informativo -> provisão)
}

export interface AccountingEntry {
  account: string;
  accountName: string;
  category: AccountCategory;
  debitCents: number;
  creditCents: number;
  history: string;
}

export interface AccountingResult {
  entries: AccountingEntry[];
  totalDebitCents: number;
  totalCreditCents: number;
  balanced: boolean;
}

/**
 * Gera as partidas do lançamento da folha. Estrutura padrão:
 *  D Despesa com Salários (bruto)
 *   C Salários a Pagar (líquido)
 *   C INSS a Recolher
 *   C IRRF a Recolher
 *   C Outros Descontos
 *  D Despesa com FGTS  /  C FGTS a Recolher (provisão do encargo)
 */
export function computeAccountingEntries(totals: AccountingTotals, accounts: Record<AccountCategory, AccountRef> = DEFAULT_ACCOUNTS): AccountingResult {
  const entries: AccountingEntry[] = [];
  const push = (category: AccountCategory, debitCents: number, creditCents: number, history: string) => {
    if (debitCents === 0 && creditCents === 0) return;
    const ref = accounts[category] ?? DEFAULT_ACCOUNTS[category];
    entries.push({ account: ref.code, accountName: ref.name, category, debitCents, creditCents, history });
  };

  push('DESPESA_SALARIOS', totals.earningsCents, 0, 'Folha do período — proventos');
  push('SALARIOS_A_PAGAR', 0, totals.netCents, 'Líquido a pagar aos colaboradores');
  push('INSS_A_RECOLHER', 0, totals.inssCents, 'INSS retido dos colaboradores');
  push('IRRF_A_RECOLHER', 0, totals.irrfCents, 'IRRF retido dos colaboradores');
  push('OUTROS_DESCONTOS', 0, totals.otherDeductionsCents, 'Outros descontos a repassar');
  // FGTS: encargo do empregador (provisão), lançamento próprio balanceado.
  push('DESPESA_FGTS', totals.fgtsCents, 0, 'FGTS do período (encargo)');
  push('FGTS_A_RECOLHER', 0, totals.fgtsCents, 'FGTS a recolher');

  const totalDebitCents = entries.reduce((s, e) => s + e.debitCents, 0);
  const totalCreditCents = entries.reduce((s, e) => s + e.creditCents, 0);
  return { entries, totalDebitCents, totalCreditCents, balanced: totalDebitCents === totalCreditCents };
}

function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

/** CSV das partidas (conta;nome;debito;credito;historico). */
export function accountingCsv(result: AccountingResult, periodRef: string): string {
  const header = 'conta;nome;debito;credito;historico';
  const lines = result.entries.map((e) => `${e.account};${e.accountName};${centsToDecimal(e.debitCents)};${centsToDecimal(e.creditCents)};${e.history} (${periodRef})`);
  lines.push(`;TOTAIS;${centsToDecimal(result.totalDebitCents)};${centsToDecimal(result.totalCreditCents)};${result.balanced ? 'BALANCEADO' : 'DIVERGENTE'}`);
  return [header, ...lines].join('\r\n') + '\r\n';
}
