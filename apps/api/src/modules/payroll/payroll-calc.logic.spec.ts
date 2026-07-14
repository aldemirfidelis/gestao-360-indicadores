import { describe, expect, it } from 'vitest';
import {
  applyBp,
  centsToDecimalString,
  computeInss,
  computeIrrf,
  computeMonthlyWorker,
  decimalToCents,
  hourlyRateCents,
  roundDiv,
  type InssTableData,
  type IrrfTableData,
  type LegalTables,
} from './payroll-calc.logic';

/**
 * TESTES-OURO: valores validados manualmente contra as tabelas oficiais
 * vigentes de 2025 (INSS Portaria Interministerial MPS/MF; IRRF tabela mensal
 * vigente desde 05/2025). Não alterar os valores esperados sem revisão de
 * especialista de folha — eles congelam a metodologia de arredondamento.
 */

const INSS_2025: InssTableData = {
  brackets: [
    { upToCents: 151800, rateBp: 750 },
    { upToCents: 279388, rateBp: 900 },
    { upToCents: 419083, rateBp: 1200 },
    { upToCents: 815741, rateBp: 1400 },
  ],
};

const IRRF_2025: IrrfTableData = {
  brackets: [
    { upToCents: 242880, rateBp: 0, deductionCents: 0 },
    { upToCents: 282665, rateBp: 750, deductionCents: 18216 },
    { upToCents: 375105, rateBp: 1500, deductionCents: 39416 },
    { upToCents: 466468, rateBp: 2250, deductionCents: 67549 },
    { upToCents: null, rateBp: 2750, deductionCents: 90873 },
  ],
  dependentDeductionCents: 18959,
  simplifiedDiscountCents: 60720,
};

const TABLES: LegalTables = {
  inss: { versionId: 'v-inss', data: INSS_2025 },
  irrf: { versionId: 'v-irrf', data: IRRF_2025 },
  fgts: { versionId: 'v-fgts', data: { rateBp: 800, apprenticeRateBp: 200 } },
};

describe('payroll-calc.logic — aritmética exata', () => {
  it('roundDiv/applyBp: half-up determinístico em centavos', () => {
    expect(roundDiv(5, 2)).toBe(3); // 2,5 → 3
    expect(roundDiv(4, 2)).toBe(2);
    expect(applyBp(320460, 800)).toBe(25637); // 2.563,68 → 2.563,7? não: 25.636,8 → 25.637
    expect(hourlyRateCents(220000, 220)).toBe(1000);
    expect(hourlyRateCents(300000, 220)).toBe(1364); // 1.363,63... → 13,64
    expect(centsToDecimalString(291398)).toBe('2913.98');
    expect(centsToDecimalString(-50)).toBe('-0.50');
    expect(decimalToCents('3000.55')).toBe(300055);
    expect(decimalToCents('3000.5')).toBe(300050);
    expect(decimalToCents('3000')).toBe(300000);
    expect(decimalToCents('-12.34')).toBe(-1234);
  });
});

describe('payroll-calc.logic — INSS progressivo (ouro 2025)', () => {
  it('salário no fim da 1ª faixa: 1.518,00 → 113,85', () => {
    expect(computeInss(151800, INSS_2025).valueCents).toBe(11385);
  });
  it('salário 3.000,00 → 253,41 (arredondamento único no total)', () => {
    expect(computeInss(300000, INSS_2025).valueCents).toBe(25341);
  });
  it('acima do teto: base limitada e contribuição máxima 951,63', () => {
    const result = computeInss(1000000, INSS_2025);
    expect(result.cappedBaseCents).toBe(815741);
    expect(result.valueCents).toBe(95163);
  });
});

describe('payroll-calc.logic — IRRF (ouro 2025)', () => {
  it('3.000,00 sem dependentes: simplificado é melhor → isento', () => {
    const result = computeIrrf({ grossTaxableCents: 300000, inssCents: 25341, irDependents: 0, table: IRRF_2025 });
    expect(result.usedSimplified).toBe(true);
    expect(result.valueCents).toBe(0);
  });
  it('10.000,00 com 2 dependentes: deduções legais melhores → 1.475,30', () => {
    const result = computeIrrf({ grossTaxableCents: 1000000, inssCents: 95163, irDependents: 2, table: IRRF_2025 });
    expect(result.usedSimplified).toBe(false);
    expect(result.deductionsCents).toBe(95163 + 2 * 18959);
    expect(result.taxableBaseCents).toBe(866919);
    expect(result.valueCents).toBe(147530);
  });
});

describe('payroll-calc.logic — folha do mensalista (ouro composto)', () => {
  it('salário 3.000 + 10h HE50: itens, impostos e líquido exatos', () => {
    const result = computeMonthlyWorker({
      salaryCents: 300000,
      monthlyHours: 220,
      contractType: 'CLT',
      irDependents: 0,
      timekeeping: { normalMinutes: 11880, he50Minutes: 600, he100Minutes: 0, nightMinutes: 0, absentMinutes: 0, workedDays: 22, absentDays: 0 },
      tables: TABLES,
    });
    const byCode = new Map(result.items.map((item) => [item.rubricCode, item]));
    expect(byCode.get('1000')?.amountCents).toBe(300000);
    expect(byCode.get('1101')?.amountCents).toBe(20460); // 10h × 13,64 × 1,5
    expect(byCode.get('5501')?.amountCents).toBe(27797); // INSS de 3.204,60
    expect(byCode.get('5502')?.amountCents).toBe(1265); // IRRF: simplificado, faixa 7,5% → 12,65
    expect(byCode.get('9003')?.amountCents).toBe(25637); // FGTS 8% informativo
    expect(result.totals.earningsCents).toBe(320460);
    expect(result.totals.deductionsCents).toBe(29062);
    expect(result.totals.netCents).toBe(291398);
    // memória registra a versão legal usada em cada tributo
    expect(result.memory.find((m) => m.step === 'INSS')?.legalVersionId).toBe('v-inss');
    expect(result.memory.find((m) => m.step === 'IRRF')?.legalVersionId).toBe('v-irrf');
  });

  it('faltas descontam em horas e reduzem as bases', () => {
    const result = computeMonthlyWorker({
      salaryCents: 220000,
      monthlyHours: 220,
      contractType: 'CLT',
      irDependents: 0,
      timekeeping: { normalMinutes: 0, he50Minutes: 0, he100Minutes: 0, nightMinutes: 0, absentMinutes: 480, workedDays: 20, absentDays: 1 },
      tables: TABLES,
    });
    const absences = result.items.find((item) => item.rubricCode === '5010');
    expect(absences?.amountCents).toBe(8000); // 8h × 10,00
    expect(result.totals.fgtsBaseCents).toBe(212000); // base líquida das faltas
  });

  it('aprendiz usa FGTS 2%', () => {
    const result = computeMonthlyWorker({
      salaryCents: 151800,
      monthlyHours: 220,
      contractType: 'APRENDIZ',
      irDependents: 0,
      timekeeping: { normalMinutes: 0, he50Minutes: 0, he100Minutes: 0, nightMinutes: 0, absentMinutes: 0, workedDays: 22, absentDays: 0 },
      tables: TABLES,
    });
    expect(result.items.find((item) => item.rubricCode === '9003')?.amountCents).toBe(3036); // 2%
  });
});
