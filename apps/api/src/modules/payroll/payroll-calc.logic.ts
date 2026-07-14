/**
 * Motor puro de cálculo da folha (Fase 1 — mensalista).
 *
 * Regras de dinheiro:
 * - TODA aritmética em CENTAVOS INTEIROS (sem ponto flutuante).
 * - Alíquotas em basis points inteiros (1% = 100 bp).
 * - Arredondamento half-up explícito, aplicado uma única vez por parcela e
 *   registrado na memória de cálculo.
 *
 * Nenhum valor legal vive aqui: as tabelas (INSS/IRRF/FGTS...) chegam como
 * dado versionado (PayrollLegalTableVersion) e a versão usada é registrada.
 * ⚠️ Resultados são para conferência interna até validação da contabilidade.
 */

// ------------------------------ tipos das tabelas legais ------------------------------

export interface InssTableData {
  /** Faixas progressivas em ordem crescente; upToCents da última = teto. */
  brackets: Array<{ upToCents: number; rateBp: number }>;
}

export interface IrrfTableData {
  /** Faixas: upToCents nulo = sem limite. deductionCents = parcela a deduzir. */
  brackets: Array<{ upToCents: number | null; rateBp: number; deductionCents: number }>;
  dependentDeductionCents: number;
  simplifiedDiscountCents: number;
}

export interface FgtsTableData {
  rateBp: number;
  apprenticeRateBp: number;
}

export interface LegalTables {
  inss: { versionId: string; data: InssTableData };
  irrf: { versionId: string; data: IrrfTableData };
  fgts: { versionId: string; data: FgtsTableData };
}

// ------------------------------ aritmética exata ------------------------------

/** Divisão inteira com arredondamento half-up (numerador/denominador >= 0). */
export function roundDiv(numerator: number, denominator: number): number {
  return Math.floor((numerator + denominator / 2) / denominator);
}

/** Aplica basis points a um valor em centavos (half-up). */
export function applyBp(cents: number, bp: number): number {
  return roundDiv(cents * bp, 10_000);
}

/** Valor da hora em centavos: salário mensal / horas contratuais (half-up). */
export function hourlyRateCents(salaryCents: number, monthlyHours: number): number {
  return roundDiv(salaryCents, monthlyHours);
}

/** Centavos → "1.234,56" (exibição em memória de cálculo). */
export function centsLabel(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const int = Math.floor(abs / 100).toLocaleString('pt-BR');
  return `${sign}${int},${String(abs % 100).padStart(2, '0')}`;
}

// ------------------------------ memória de cálculo ------------------------------

export interface MemoryStep {
  step: string;
  formula: string;
  inputs: Record<string, string | number>;
  resultCents: number;
  legalVersionId?: string;
}

// ------------------------------ INSS ------------------------------

/**
 * INSS progressivo por faixas: soma alíquota × fatia, base limitada ao teto
 * (última faixa). Arredonda UMA vez no total (metodologia das tabelas oficiais).
 */
export function computeInss(baseCents: number, table: InssTableData): { valueCents: number; cappedBaseCents: number; slices: Array<{ upToCents: number; rateBp: number; sliceCents: number }> } {
  const ceiling = table.brackets[table.brackets.length - 1]?.upToCents ?? 0;
  const capped = Math.min(baseCents, ceiling);
  let previousCap = 0;
  let numerator = 0;
  const slices: Array<{ upToCents: number; rateBp: number; sliceCents: number }> = [];
  for (const bracket of table.brackets) {
    const slice = Math.max(0, Math.min(capped, bracket.upToCents) - previousCap);
    if (slice > 0) {
      numerator += slice * bracket.rateBp;
      slices.push({ upToCents: bracket.upToCents, rateBp: bracket.rateBp, sliceCents: slice });
    }
    previousCap = bracket.upToCents;
    if (capped <= bracket.upToCents) break;
  }
  return { valueCents: roundDiv(numerator, 10_000), cappedBaseCents: capped, slices };
}

// ------------------------------ IRRF ------------------------------

export interface IrrfResult {
  valueCents: number;
  taxableBaseCents: number;
  usedSimplified: boolean;
  deductionsCents: number;
  bracket: { rateBp: number; deductionCents: number };
}

/**
 * IRRF mensal: compara as deduções legais (INSS + dependentes) com o desconto
 * simplificado e usa a MAIOR dedução (mais favorável ao colaborador),
 * registrando a escolha. Pensão judicial entra nas deduções legais (F3).
 */
export function computeIrrf(input: {
  grossTaxableCents: number;
  inssCents: number;
  irDependents: number;
  table: IrrfTableData;
}): IrrfResult {
  const { grossTaxableCents, inssCents, irDependents, table } = input;
  const legalDeductions = inssCents + irDependents * table.dependentDeductionCents;
  const usedSimplified = table.simplifiedDiscountCents > legalDeductions;
  const deductionsCents = usedSimplified ? table.simplifiedDiscountCents : legalDeductions;
  const taxableBase = Math.max(0, grossTaxableCents - deductionsCents);
  let bracket = table.brackets[0] ?? { upToCents: null, rateBp: 0, deductionCents: 0 };
  for (const candidate of table.brackets) {
    bracket = candidate;
    if (candidate.upToCents === null || taxableBase <= candidate.upToCents) break;
  }
  const value = Math.max(0, applyBp(taxableBase, bracket.rateBp) - bracket.deductionCents);
  return {
    valueCents: value,
    taxableBaseCents: taxableBase,
    usedSimplified,
    deductionsCents,
    bracket: { rateBp: bracket.rateBp, deductionCents: bracket.deductionCents },
  };
}

// ------------------------------ folha do mensalista ------------------------------

/** Resumo do ponto congelado no snapshot (minutos). */
export interface TimekeepingSummary {
  normalMinutes: number;
  he50Minutes: number;
  he100Minutes: number;
  nightMinutes: number;
  absentMinutes: number;
  workedDays: number;
  absentDays: number;
}

export interface WorkerCalcInput {
  salaryCents: number;
  monthlyHours: number;
  contractType: string | null; // APRENDIZ usa alíquota própria de FGTS
  irDependents: number;
  timekeeping: TimekeepingSummary;
  tables: LegalTables;
}

export interface WorkerCalcItem {
  rubricCode: string;
  rubricName: string;
  nature: 'PROVENTO' | 'DESCONTO' | 'BASE' | 'INFORMATIVA';
  reference: string;
  amountCents: number;
  origin: 'MOTOR' | 'PONTO' | 'CONTRATO';
}

export interface WorkerCalcResult {
  items: WorkerCalcItem[];
  totals: {
    earningsCents: number;
    deductionsCents: number;
    netCents: number;
    inssBaseCents: number;
    inssCents: number;
    irrfBaseCents: number;
    irrfCents: number;
    fgtsBaseCents: number;
    fgtsCents: number;
  };
  memory: MemoryStep[];
}

function hoursRef(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/**
 * Folha mensal do MENSALISTA (Fase 1): salário cheio + HE 50/100 + adicional
 * noturno 20% − faltas em horas − INSS − IRRF; FGTS informativo. DSR sobre
 * variáveis e médias ficam para F2/F3 (exigem validação jurídica por CCT).
 */
export function computeMonthlyWorker(input: WorkerCalcInput): WorkerCalcResult {
  const { salaryCents, monthlyHours, contractType, irDependents, timekeeping, tables } = input;
  const memory: MemoryStep[] = [];
  const items: WorkerCalcItem[] = [];

  const hourly = hourlyRateCents(salaryCents, monthlyHours);
  memory.push({
    step: 'Valor da hora',
    formula: 'salário ÷ horas contratuais (half-up)',
    inputs: { salario: centsLabel(salaryCents), horasMensais: monthlyHours },
    resultCents: hourly,
  });

  // 1000 — Salário base (mensalista recebe o mês cheio; faltas descontam em rubrica própria)
  items.push({ rubricCode: '1000', rubricName: 'Salário base', nature: 'PROVENTO', reference: `${monthlyHours}h`, amountCents: salaryCents, origin: 'CONTRATO' });

  // Horas extras (fatores 1,5 e 2,0 sobre a hora normal)
  // fator 1,5 = ×15/10; ÷60 p/ minutos → denominador 600
  const he50 = roundDiv(timekeeping.he50Minutes * hourly * 15, 600);
  if (timekeeping.he50Minutes > 0) {
    items.push({ rubricCode: '1101', rubricName: 'Horas extras 50%', nature: 'PROVENTO', reference: hoursRef(timekeeping.he50Minutes), amountCents: he50, origin: 'PONTO' });
    memory.push({
      step: 'Horas extras 50%',
      formula: 'minutos ÷ 60 × hora × 1,5 (half-up)',
      inputs: { minutos: timekeeping.he50Minutes, hora: centsLabel(hourly) },
      resultCents: he50,
    });
  }
  const he100 = roundDiv(timekeeping.he100Minutes * hourly * 2, 60);
  if (timekeeping.he100Minutes > 0) {
    items.push({ rubricCode: '1102', rubricName: 'Horas extras 100%', nature: 'PROVENTO', reference: hoursRef(timekeeping.he100Minutes), amountCents: he100, origin: 'PONTO' });
    memory.push({
      step: 'Horas extras 100%',
      formula: 'minutos ÷ 60 × hora × 2 (half-up)',
      inputs: { minutos: timekeeping.he100Minutes, hora: centsLabel(hourly) },
      resultCents: he100,
    });
  }

  // Adicional noturno 20% sobre a hora normal (hora reduzida 52m30s fica p/ F2 c/ validação)
  const night = roundDiv(timekeeping.nightMinutes * hourly * 20, 60 * 100);
  if (timekeeping.nightMinutes > 0) {
    items.push({ rubricCode: '1103', rubricName: 'Adicional noturno 20%', nature: 'PROVENTO', reference: hoursRef(timekeeping.nightMinutes), amountCents: night, origin: 'PONTO' });
    memory.push({
      step: 'Adicional noturno',
      formula: 'minutos ÷ 60 × hora × 20% (half-up)',
      inputs: { minutos: timekeeping.nightMinutes, hora: centsLabel(hourly) },
      resultCents: night,
    });
  }

  // 5010 — Faltas/ausências não justificadas (em horas; DSR perdido fica p/ F2)
  const absences = roundDiv(timekeeping.absentMinutes * hourly, 60);
  if (timekeeping.absentMinutes > 0) {
    items.push({ rubricCode: '5010', rubricName: 'Faltas e ausências', nature: 'DESCONTO', reference: `${timekeeping.absentDays} dia(s) · ${hoursRef(timekeeping.absentMinutes)}`, amountCents: absences, origin: 'PONTO' });
    memory.push({
      step: 'Faltas',
      formula: 'minutos ausentes ÷ 60 × hora (half-up)',
      inputs: { minutos: timekeeping.absentMinutes, hora: centsLabel(hourly) },
      resultCents: absences,
    });
  }

  const earningsBeforeTaxes = items.filter((i) => i.nature === 'PROVENTO').reduce((sum, i) => sum + i.amountCents, 0);
  const grossTaxable = earningsBeforeTaxes - absences; // base de INSS/IRRF/FGTS (remuneração do mês)

  // INSS progressivo
  const inss = computeInss(grossTaxable, tables.inss.data);
  items.push({ rubricCode: '5501', rubricName: 'INSS', nature: 'DESCONTO', reference: `base ${centsLabel(inss.cappedBaseCents)}`, amountCents: inss.valueCents, origin: 'MOTOR' });
  memory.push({
    step: 'INSS',
    formula: 'progressivo por faixas, base limitada ao teto, arredondado 1× no total',
    inputs: {
      base: centsLabel(grossTaxable),
      baseLimitada: centsLabel(inss.cappedBaseCents),
      faixas: inss.slices.map((s) => `${centsLabel(s.sliceCents)}×${s.rateBp / 100}%`).join(' + '),
    },
    resultCents: inss.valueCents,
    legalVersionId: tables.inss.versionId,
  });

  // IRRF (deduções legais vs desconto simplificado — usa o mais favorável)
  const irrf = computeIrrf({ grossTaxableCents: grossTaxable, inssCents: inss.valueCents, irDependents, table: tables.irrf.data });
  if (irrf.valueCents > 0) {
    items.push({ rubricCode: '5502', rubricName: 'IRRF', nature: 'DESCONTO', reference: `base ${centsLabel(irrf.taxableBaseCents)}`, amountCents: irrf.valueCents, origin: 'MOTOR' });
  }
  memory.push({
    step: 'IRRF',
    formula: irrf.usedSimplified
      ? 'desconto simplificado (mais favorável) → faixa × alíquota − parcela a deduzir'
      : 'deduções legais (INSS + dependentes) → faixa × alíquota − parcela a deduzir',
    inputs: {
      bruto: centsLabel(grossTaxable),
      deducoes: centsLabel(irrf.deductionsCents),
      dependentesIR: irDependents,
      baseTributavel: centsLabel(irrf.taxableBaseCents),
      aliquota: `${irrf.bracket.rateBp / 100}%`,
      parcelaADeduzir: centsLabel(irrf.bracket.deductionCents),
    },
    resultCents: irrf.valueCents,
    legalVersionId: tables.irrf.versionId,
  });

  // FGTS (encargo do empregador — informativo no holerite)
  const fgtsRate = contractType === 'APRENDIZ' ? tables.fgts.data.apprenticeRateBp : tables.fgts.data.rateBp;
  const fgts = applyBp(grossTaxable, fgtsRate);
  items.push({ rubricCode: '9003', rubricName: `FGTS ${fgtsRate / 100}%`, nature: 'INFORMATIVA', reference: `base ${centsLabel(grossTaxable)}`, amountCents: fgts, origin: 'MOTOR' });
  memory.push({
    step: 'FGTS',
    formula: 'base × alíquota (half-up) — encargo do empregador, não desconta do colaborador',
    inputs: { base: centsLabel(grossTaxable), aliquota: `${fgtsRate / 100}%` },
    resultCents: fgts,
    legalVersionId: tables.fgts.versionId,
  });

  const earnings = items.filter((i) => i.nature === 'PROVENTO').reduce((sum, i) => sum + i.amountCents, 0);
  const deductions = items.filter((i) => i.nature === 'DESCONTO').reduce((sum, i) => sum + i.amountCents, 0);
  const net = earnings - deductions;
  memory.push({
    step: 'Líquido',
    formula: 'total de proventos − total de descontos',
    inputs: { proventos: centsLabel(earnings), descontos: centsLabel(deductions) },
    resultCents: net,
  });

  return {
    items,
    totals: {
      earningsCents: earnings,
      deductionsCents: deductions,
      netCents: net,
      inssBaseCents: inss.cappedBaseCents,
      inssCents: inss.valueCents,
      irrfBaseCents: irrf.taxableBaseCents,
      irrfCents: irrf.valueCents,
      fgtsBaseCents: grossTaxable,
      fgtsCents: fgts,
    },
    memory,
  };
}

// ------------------------------ centavos ↔ Decimal(14,2) ------------------------------

/** Centavos inteiros → string decimal "1234.56" para persistir em Decimal(14,2). */
export function centsToDecimalString(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** "3000.55" (Decimal do Prisma em string) → 300055 centavos, sem passar por float. */
export function decimalToCents(value: string): number {
  const negative = value.startsWith('-');
  const [integer, fraction = ''] = value.replace('-', '').split('.');
  const cents = parseInt(integer || '0', 10) * 100 + parseInt(fraction.padEnd(2, '0').slice(0, 2) || '0', 10);
  return negative ? -cents : cents;
}
