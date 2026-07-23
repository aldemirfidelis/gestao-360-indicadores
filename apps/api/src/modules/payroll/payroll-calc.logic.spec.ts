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
  computeVacationWorker,
  computeThirteenthWorker,
  computeTermination,
  countAvos,
  completedYears,
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

  it('desconto de adiantamento salarial deduz do líquido', () => {
    const result = computeMonthlyWorker({
      salaryCents: 300000,
      monthlyHours: 220,
      contractType: 'CLT',
      irDependents: 0,
      timekeeping: { normalMinutes: 11880, he50Minutes: 0, he100Minutes: 0, nightMinutes: 0, absentMinutes: 0, workedDays: 22, absentDays: 0 },
      tables: TABLES,
      advancePaidCents: 120000,
    });
    const advanceDiscount = result.items.find((item) => item.rubricCode === '5020');
    expect(advanceDiscount?.amountCents).toBe(120000);
    expect(advanceDiscount?.nature).toBe('DESCONTO');
    expect(result.totals.inssBaseCents).toBe(300000);
    expect(result.totals.deductionsCents).toBe(25341 + 120000);
    expect(result.totals.netCents).toBe(300000 - 25341 - 120000);
  });
});

describe('payroll-calc.logic — descontos da folha (Benefícios, Consignados e Pensão)', () => {
  it('aplica descontos de VT, VA, Consignado e Pensão Alimentícia (dedutível no IRRF)', () => {
    const result = computeMonthlyWorker({
      salaryCents: 400000, // 4.000,00
      monthlyHours: 220,
      contractType: 'CLT',
      irDependents: 0,
      timekeeping: { normalMinutes: 11880, he50Minutes: 0, he100Minutes: 0, nightMinutes: 0, absentMinutes: 0, workedDays: 22, absentDays: 0 },
      tables: TABLES,
      benefits: [
        { name: 'Vale Transporte', kind: 'VT', valueCents: 24000 },
        { name: 'Vale Alimentação', kind: 'VA', valueCents: 5000 },
      ],
      loans: [
        { bankName: 'Banco Itaú', contractId: 'LOAN-123', amountCents: 30000 },
      ],
      pensions: [
        { dependentId: 'dep-1', percentage: 10, baseType: 'NET' }, // 10% da base líquida (Bruto - INSS)
      ],
    });

    const byCode = new Map(result.items.map((i) => [i.rubricCode, i]));
    expect(byCode.get('5100')?.amountCents).toBe(24000); // VT
    expect(byCode.get('5110')?.amountCents).toBe(5000);  // VA
    expect(byCode.get('5050')?.amountCents).toBe(30000); // Consignado

    // Bruto = 4.000,00. INSS para 4.000,00:
    // Faixa 1: 1518 * 7.5% = 113.85
    // Faixa 2: (2793.88 - 1518) * 9% = 114.8292
    // Faixa 3: (4000 - 2793.88) * 12% = 144.7344
    // Total INSS = 113.85 + 114.8292 + 144.7344 = 373.4136 -> 373.41 (37341)
    expect(byCode.get('5501')?.amountCents).toBe(37341);

    // Pensão = 10% de (Bruto - INSS) = 10% de (400000 - 37341) = 10% de 362659 = 36266 cents
    expect(byCode.get('5060')?.amountCents).toBe(36266);

    // IRRF deve descontar INSS e Pensão!
    // Base tributável: 4000.00 - INSS (373.41) - Pensão (362.66) = 3263.93 (326393 cents)
    // Tabela IRRF 2025: base 3263.93 está na faixa 15% (dedução 394.16)
    // IRRF Bruto: 3263.93 * 15% - 394.16 = 489.5895 - 394.16 = 95.4295 -> 95.43 (9543)
    // Se usasse simplificado: 4000.00 - 607.20 = 3392.80. IRRF: 3392.80 * 15% - 394.16 = 508.92 - 394.16 = 114.76
    // Logo, deduções legais (INSS + Pensão) são melhores. IRRF esperado = 95.43
    expect(byCode.get('5502')?.amountCents).toBe(9543);
  });

  it('VT com teto de coparticipação: desconta o MENOR entre o custo e 6% do salário', () => {
    const result = computeMonthlyWorker({
      salaryCents: 300000, // 3.000,00 → teto 6% = 180,00
      monthlyHours: 220,
      contractType: 'CLT',
      irDependents: 0,
      timekeeping: { normalMinutes: 11880, he50Minutes: 0, he100Minutes: 0, nightMinutes: 0, absentMinutes: 0, workedDays: 22, absentDays: 0 },
      tables: TABLES,
      benefits: [
        // custo do VT 240,00 > teto 180,00 → desconta 180,00
        { name: 'Vale Transporte', kind: 'VT', valueCents: 24000, copayRateBp: 600 },
        // custo da saúde 100,00 < teto 300,00 (10%) → desconta os 100,00 integrais
        { name: 'Plano Saúde', kind: 'SAUDE', valueCents: 10000, copayRateBp: 1000 },
      ],
    });
    const byCode = new Map(result.items.map((i) => [i.rubricCode, i]));
    expect(byCode.get('5100')?.amountCents).toBe(18000); // teto 6% × 3.000
    expect(byCode.get('5100')?.reference).toContain('teto 6%');
    expect(byCode.get('5120')?.amountCents).toBe(10000); // abaixo do teto: valor cheio
  });

  it('benefício PERCENTUAL_SALARIO: cobrança = % do salário (rateBp)', () => {
    const result = computeMonthlyWorker({
      salaryCents: 250000, // 2.500,00
      monthlyHours: 220,
      contractType: 'CLT',
      irDependents: 0,
      timekeeping: { normalMinutes: 11880, he50Minutes: 0, he100Minutes: 0, nightMinutes: 0, absentMinutes: 0, workedDays: 22, absentDays: 0 },
      tables: TABLES,
      benefits: [
        // 4% do salário = 100,00 (rateBp derivado do value "4.00" → 400)
        { name: 'Vale Refeição', kind: 'VR', type: 'PERCENTUAL_SALARIO', valueCents: 400, rateBp: 400 },
      ],
    });
    const byCode = new Map(result.items.map((i) => [i.rubricCode, i]));
    expect(byCode.get('5110')?.amountCents).toBe(10000); // 4% de 2.500,00
  });

  it('sem teto (copay 0) mantém o comportamento antigo: desconta o valor cheio', () => {
    const result = computeMonthlyWorker({
      salaryCents: 300000,
      monthlyHours: 220,
      contractType: 'CLT',
      irDependents: 0,
      timekeeping: { normalMinutes: 11880, he50Minutes: 0, he100Minutes: 0, nightMinutes: 0, absentMinutes: 0, workedDays: 22, absentDays: 0 },
      tables: TABLES,
      benefits: [{ name: 'Plano Saúde', kind: 'SAUDE', valueCents: 10000, copayRateBp: 0 }],
    });
    const byCode = new Map(result.items.map((i) => [i.rubricCode, i]));
    expect(byCode.get('5120')?.amountCents).toBe(10000);
  });
});

describe('payroll-calc.logic — Férias e 13º Salário (Fase 3)', () => {
  it('calcula férias com 30 dias gozados e 10 dias vendidos (abono pecuniário)', () => {
    const result = computeVacationWorker({
      salaryCents: 300000,
      takenDays: 30,
      sellDays: 10,
      contractType: 'CLT',
      tables: TABLES,
    });

    const byCode = new Map(result.items.map((i) => [i.rubricCode, i]));
    expect(byCode.get('1020')?.amountCents).toBe(300000); // 30 dias férias
    expect(byCode.get('1021')?.amountCents).toBe(100000); // 1/3 férias
    expect(byCode.get('1022')?.amountCents).toBe(100000); // abono 10 dias
    expect(byCode.get('1023')?.amountCents).toBe(33333);  // 1/3 s/ abono

    // INSS sobre férias gozadas + 1/3 (3.000 + 1.000 = 4.000,00)
    // INSS para 4.000,00 é 373,41 (37341)
    expect(byCode.get('5501')?.amountCents).toBe(37341);

    // IRRF sobre base férias (4.000,00 - INSS 373,41 = 3.626,59)
    // Faixa 15% com dedução de 394,16 -> 3626.59 * 15% - 394.16 = 543.9885 - 394.16 = 149.8285 -> 149.83 (14983)
    // Desconto simplificado seria: 4000.00 - 607.20 = 3392.80. IRRF: 3392.80 * 15% - 394.16 = 114.76
    // Como simplificado é melhor do que deduzir apenas INSS (4000 - 607.20 = 3392.80 vs 4000 - 373.41 = 3626.59),
    // o IRRF simplificado é aplicado: 114.76 (11476)
    expect(byCode.get('5502')?.amountCents).toBe(11476);
  });

  it('calcula 13º Salário — 1ª parcela', () => {
    const result = computeThirteenthWorker({
      salaryCents: 300000,
      avos: 12,
      parcela: 1,
      contractType: 'CLT',
      tables: TABLES,
    });

    const byCode = new Map(result.items.map((i) => [i.rubricCode, i]));
    expect(byCode.get('1030')?.amountCents).toBe(150000); // 50% de 3.000
    expect(result.totals.inssCents).toBe(0);
    expect(result.totals.irrfCents).toBe(0);
    expect(result.totals.fgtsCents).toBe(12000); // 8% sobre 1.500
  });

  it('calcula 13º Salário — 2ª parcela deduzindo adiantamento da 1ª', () => {
    const result = computeThirteenthWorker({
      salaryCents: 300000,
      avos: 12,
      parcela: 2,
      advancePaidCents: 150000,
      contractType: 'CLT',
      tables: TABLES,
    });

    const byCode = new Map(result.items.map((i) => [i.rubricCode, i]));
    expect(byCode.get('1031')?.amountCents).toBe(300000); // valor integral
    expect(byCode.get('5030')?.amountCents).toBe(150000); // desconto 1ª parcela

    // INSS sobre 3.000,00 é 253,41 (25341)
    expect(byCode.get('5501')?.amountCents).toBe(25341);

    // IRRF sobre base 13º (3000.00 - INSS 253.41 = 2746.59)
    // Tabela anual: faixa 7.5% (dedução 182.16) -> 2746.59 * 7.5% - 182.16 = 205.99425 - 182.16 = 23.83425 -> 23.83 (2383)
    expect(byCode.get('5502')?.amountCents).toBe(2383);
  });
});

describe('payroll-calc.logic — Rescisão (Fase 3)', () => {
  it('countAvos: regra dos 15 dias no intervalo', () => {
    expect(countAvos(new Date('2025-01-01'), new Date('2025-07-26'))).toBe(7);
    expect(countAvos(new Date('2025-01-20'), new Date('2025-03-10'))).toBe(1); // jan 12d (<15), fev 1, mar 10d (<15) -> só fev
    expect(countAvos(new Date('2025-01-01'), new Date('2026-12-31'))).toBe(12); // teto
  });

  it('completedYears: anos completos considerando aniversário', () => {
    expect(completedYears(new Date('2023-01-10'), new Date('2025-06-20'))).toBe(2);
    expect(completedYears(new Date('2023-07-10'), new Date('2025-06-20'))).toBe(1); // ainda não fez aniversário em 2025
  });

  it('dispensa sem justa causa com aviso indenizado: verbas, avos e incidências', () => {
    const result = computeTermination({
      salaryCents: 300000,
      admissionDate: new Date('2023-01-10'),
      terminationDate: new Date('2025-06-20'),
      kind: 'DISPENSA_SEM_JUSTA_CAUSA',
      noticeType: 'INDENIZADO',
      contractType: 'CLT',
      irDependents: 0,
      tables: TABLES,
    });
    const byCode = new Map(result.items.map((item) => [item.rubricCode, item]));
    expect(byCode.get('1000')?.amountCents).toBe(200000); // saldo 20/30 dias
    expect(byCode.get('1040')?.amountCents).toBe(360000); // aviso 36 dias (30 + 3×2 anos)
    expect(byCode.get('1031')?.amountCents).toBe(175000); // 13º 7/12 (projetado)
    expect(byCode.get('1020')?.amountCents).toBe(175000); // férias prop 7/12
    expect(byCode.get('1021')?.amountCents).toBe(58333); // 1/3
    expect(byCode.get('5501')?.amountCents).toBe(15723); // INSS s/ saldo
    expect(byCode.get('5503')?.amountCents).toBe(13473); // INSS s/ 13º
    expect(byCode.get('5502')).toBeUndefined(); // IRRF s/ saldo isento nessa faixa
    expect(byCode.get('9003')?.amountCents).toBe(58800); // FGTS 8% s/ (saldo+13+aviso)
    expect(result.totals.earningsCents).toBe(968333);
    expect(result.totals.deductionsCents).toBe(29196);
    expect(result.totals.netCents).toBe(939137);
    // sem saldo de FGTS informado → multa não calculada, vira pendência
    expect(result.informative.fgtsFineCents).toBe(0);
    expect(result.issues.some((i) => i.includes('Multa'))).toBe(true);
  });

  it('pedido de demissão: sem aviso indenizado e sem multa de FGTS', () => {
    const result = computeTermination({
      salaryCents: 300000,
      admissionDate: new Date('2023-01-10'),
      terminationDate: new Date('2025-06-20'),
      kind: 'PEDIDO',
      noticeType: 'TRABALHADO',
      contractType: 'CLT',
      irDependents: 0,
      tables: TABLES,
    });
    const byCode = new Map(result.items.map((item) => [item.rubricCode, item]));
    expect(byCode.get('1040')).toBeUndefined(); // sem aviso indenizado
    expect(byCode.get('9010')).toBeUndefined(); // sem multa
    expect(result.informative.fgtsFineCents).toBe(0);
    expect(result.issues.some((i) => i.includes('Multa'))).toBe(false); // pedido não gera multa
  });

  it('acordo com saldo de FGTS informado: multa de 20%', () => {
    const result = computeTermination({
      salaryCents: 300000,
      admissionDate: new Date('2023-01-10'),
      terminationDate: new Date('2025-06-20'),
      kind: 'ACORDO',
      noticeType: 'INDENIZADO',
      contractType: 'CLT',
      irDependents: 0,
      tables: TABLES,
      fgtsBalanceCents: 1000000, // R$ 10.000 de saldo
    });
    const byCode = new Map(result.items.map((item) => [item.rubricCode, item]));
    expect(byCode.get('9010')?.amountCents).toBe(200000); // 20% de 10.000
    expect(result.informative.fgtsFineCents).toBe(200000);
  });
});
