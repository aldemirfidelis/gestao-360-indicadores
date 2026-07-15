import { describe, expect, it } from 'vitest';
import { accountingCsv, computeAccountingEntries } from './payroll-accounting.logic';

describe('payroll-accounting.logic', () => {
  it('gera partidas balanceadas (débito = crédito)', () => {
    const result = computeAccountingEntries({
      earningsCents: 320460, // bruto
      inssCents: 27797,
      irrfCents: 1265,
      otherDeductionsCents: 0,
      netCents: 291398, // 320460 - 27797 - 1265
      fgtsCents: 25637,
    });
    expect(result.balanced).toBe(true);
    // débito = despesa salários (bruto) + despesa FGTS
    expect(result.totalDebitCents).toBe(320460 + 25637);
    expect(result.totalCreditCents).toBe(320460 + 25637);
    // crédito de salários a pagar = líquido
    expect(result.entries.find((e) => e.category === 'SALARIOS_A_PAGAR')?.creditCents).toBe(291398);
    expect(result.entries.find((e) => e.category === 'INSS_A_RECOLHER')?.creditCents).toBe(27797);
  });

  it('exporta CSV com totais e marca BALANCEADO', () => {
    const result = computeAccountingEntries({ earningsCents: 100000, inssCents: 9000, irrfCents: 0, otherDeductionsCents: 0, netCents: 91000, fgtsCents: 8000 });
    const csv = accountingCsv(result, '2026-07');
    expect(csv).toContain('conta;nome;debito;credito;historico');
    expect(csv).toContain('Despesa com Salários;1000,00;0,00');
    expect(csv).toContain('BALANCEADO');
  });

  it('omite categorias zeradas', () => {
    const result = computeAccountingEntries({ earningsCents: 100000, inssCents: 9000, irrfCents: 0, otherDeductionsCents: 0, netCents: 91000, fgtsCents: 0 });
    expect(result.entries.find((e) => e.category === 'IRRF_A_RECOLHER')).toBeUndefined();
    expect(result.entries.find((e) => e.category === 'DESPESA_FGTS')).toBeUndefined();
  });
});
