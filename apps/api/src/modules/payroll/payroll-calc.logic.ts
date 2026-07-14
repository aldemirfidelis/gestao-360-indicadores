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
  pensionCents?: number;
}): IrrfResult {
  const { grossTaxableCents, inssCents, irDependents, table, pensionCents } = input;
  const legalDeductions = inssCents + irDependents * table.dependentDeductionCents + (pensionCents ?? 0);
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
  advancePaidCents?: number;
  benefits?: Array<{ name: string; kind: string; valueCents: number }>;
  loans?: Array<{ bankName: string; contractId: string; amountCents: number }>;
  pensions?: Array<{ dependentId: string; percentage: number; baseType: string }>;
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
  const { salaryCents, monthlyHours, contractType, irDependents, timekeeping, tables, advancePaidCents, benefits, loans, pensions } = input;
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
  // 5020 — Desconto de adiantamento salarial
  if (advancePaidCents && advancePaidCents > 0) {
    items.push({ rubricCode: '5020', rubricName: 'Desconto de adiantamento', nature: 'DESCONTO', reference: 'Adiantamento', amountCents: advancePaidCents, origin: 'MOTOR' });
    memory.push({
      step: 'Desconto de adiantamento',
      formula: 'Dedução do adiantamento pago na competência',
      inputs: { adiantamentoPago: centsLabel(advancePaidCents) },
      resultCents: advancePaidCents,
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

  // PENSÃO ALIMENTÍCIA (desconto e dedutível do IRRF)
  let totalPensionCents = 0;
  if (pensions && pensions.length > 0) {
    for (const p of pensions) {
      const isNet = p.baseType === 'NET';
      const baseValue = isNet ? (grossTaxable - inss.valueCents) : grossTaxable;
      const pensionCents = roundDiv(baseValue * Math.round(p.percentage * 100), 10_000);
      totalPensionCents += pensionCents;

      items.push({
        rubricCode: '5060',
        rubricName: 'Pensão alimentícia',
        nature: 'DESCONTO',
        reference: `${p.percentage}% da base ${isNet ? 'Líquida (Bruto - INSS)' : 'Bruta'}`,
        amountCents: pensionCents,
        origin: 'MOTOR',
      });
      memory.push({
        step: `Pensão alimentícia (${p.dependentId.slice(0, 5)})`,
        formula: 'base × percentual judicial (half-up)',
        inputs: { base: centsLabel(baseValue), percentual: `${p.percentage}%` },
        resultCents: pensionCents,
      });
    }
  }

  // IRRF (deduções legais vs desconto simplificado — usa o mais favorável)
  const irrf = computeIrrf({
    grossTaxableCents: grossTaxable,
    inssCents: inss.valueCents,
    irDependents,
    table: tables.irrf.data,
    pensionCents: totalPensionCents,
  });
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

  // Benefícios (VT / VA / VR / Saúde)
  if (benefits && benefits.length > 0) {
    for (const b of benefits) {
      let rubricCode = '5120'; // default SAUDE/ODONTO
      if (b.kind === 'VT') rubricCode = '5100';
      if (b.kind === 'VA' || b.kind === 'VR') rubricCode = '5110';

      items.push({
        rubricCode,
        rubricName: `Desconto ${b.name}`,
        nature: 'DESCONTO',
        reference: b.kind,
        amountCents: b.valueCents,
        origin: 'MOTOR',
      });
      memory.push({
        step: `Benefício ${b.name}`,
        formula: 'desconto de benefício contratual / coparticipação',
        inputs: { tipo: b.kind },
        resultCents: b.valueCents,
      });
    }
  }

  // Empréstimos Consignados
  if (loans && loans.length > 0) {
    for (const l of loans) {
      items.push({
        rubricCode: '5050',
        rubricName: `Consignado ${l.bankName}`,
        nature: 'DESCONTO',
        reference: `Contrato ${l.contractId}`,
        amountCents: l.amountCents,
        origin: 'MOTOR',
      });
      memory.push({
        step: `Consignado ${l.bankName}`,
        formula: 'desconto de empréstimo consignado em folha',
        inputs: { contrato: l.contractId },
        resultCents: l.amountCents,
      });
    }
  }

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

// ------------------------------ RESCISÃO (Fase 3) ------------------------------

/**
 * Conta "avos" (meses com ao menos 15 dias trabalhados) no intervalo [start,end]
 * inclusivo, teto 12 — regra da CLT para 13º e férias proporcionais.
 */
export function countAvos(start: Date, end: Date): number {
  if (end < start) return 0;
  let avos = 0;
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  const endYear = end.getUTCFullYear();
  const endMonth = end.getUTCMonth();
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = new Date(Date.UTC(year, month + 1, 0));
    const from = start > monthStart ? start : monthStart;
    const to = end < monthEnd ? end : monthEnd;
    const daysWorked = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
    if (daysWorked >= 15) avos += 1;
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  return Math.min(12, avos);
}

/** Anos completos entre duas datas (para o aviso-prévio da Lei 12.506). */
export function completedYears(start: Date, end: Date): number {
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  const beforeAnniversary =
    end.getUTCMonth() < start.getUTCMonth() ||
    (end.getUTCMonth() === start.getUTCMonth() && end.getUTCDate() < start.getUTCDate());
  if (beforeAnniversary) years -= 1;
  return Math.max(0, years);
}

export interface TerminationCalcInput {
  salaryCents: number;
  admissionDate: Date;
  terminationDate: Date;
  /** DISPENSA_SEM_JUSTA_CAUSA | PEDIDO | ACORDO */
  kind: string;
  /** TRABALHADO | INDENIZADO */
  noticeType: string;
  contractType: string | null;
  irDependents: number;
  tables: LegalTables;
  /** Saldo do FGTS na conta vinculada (centavos), p/ multa rescisória. Opcional. */
  fgtsBalanceCents?: number;
  /** Avos de férias vencidas não gozadas de período anterior (0..12). Opcional. */
  expiredVacationAvos?: number;
}

/** Percentual (basis points) da multa rescisória do FGTS por tipo de desligamento. */
function fgtsFineBp(kind: string): number {
  if (kind === 'DISPENSA_SEM_JUSTA_CAUSA') return 4000; // 40%
  if (kind === 'ACORDO') return 2000; // 20%
  return 0; // pedido de demissão / justa causa: sem multa
}

/**
 * Rescisão (Fase 3) para o caso mais comum (dispensa sem justa causa / acordo /
 * pedido): saldo de salário, aviso-prévio (30 + 3/ano, teto 90; indenizado paga
 * e projeta os avos), 13º proporcional, férias proporcionais + vencidas + 1/3,
 * com incidências corretas (férias/aviso indenizados NÃO têm INSS/IRRF) e multa
 * do FGTS quando o saldo é informado.
 *
 * ⚠️ Simplificações desta fase (sinalizadas em `issues`): períodos de férias
 * vencidas dependem de informe manual (não há histórico de gozo confiável);
 * a multa exige o saldo do FGTS (não rastreado internamente). Resultado é para
 * conferência interna e validação jurídica antes do TRCT.
 */
export function computeTermination(input: TerminationCalcInput): WorkerCalcResult & { informative: { fgtsFineCents: number }; issues: string[] } {
  const { salaryCents, admissionDate, terminationDate, kind, noticeType, contractType, irDependents, tables, fgtsBalanceCents, expiredVacationAvos = 0 } = input;
  const memory: MemoryStep[] = [];
  const items: WorkerCalcItem[] = [];
  const issues: string[] = [];

  // Aviso-prévio: 30 dias + 3 por ano completo, teto 90 (Lei 12.506/2011).
  const years = completedYears(admissionDate, terminationDate);
  const noticeDays = Math.min(90, 30 + 3 * years);
  const indemnifiedNotice = noticeType === 'INDENIZADO' && kind !== 'PEDIDO';
  // Data projetada: o aviso indenizado projeta o contrato para os avos.
  const projectedEnd = indemnifiedNotice
    ? new Date(terminationDate.getTime() + noticeDays * 86_400_000)
    : terminationDate;

  // 1) Saldo de salário: dias do mês até o desligamento ÷ 30.
  const dayOfMonth = terminationDate.getUTCDate();
  const saldoCents = roundDiv(salaryCents * dayOfMonth, 30);
  items.push({ rubricCode: '1000', rubricName: 'Saldo de salário', nature: 'PROVENTO', reference: `${dayOfMonth}/30 dias`, amountCents: saldoCents, origin: 'MOTOR' });
  memory.push({ step: 'Saldo de salário', formula: 'salário × dias trabalhados no mês ÷ 30', inputs: { salario: centsLabel(salaryCents), dias: dayOfMonth }, resultCents: saldoCents });

  // 2) Aviso-prévio indenizado.
  let noticeCents = 0;
  if (indemnifiedNotice) {
    noticeCents = roundDiv(salaryCents * noticeDays, 30);
    items.push({ rubricCode: '1040', rubricName: 'Aviso-prévio indenizado', nature: 'PROVENTO', reference: `${noticeDays} dias`, amountCents: noticeCents, origin: 'MOTOR' });
    memory.push({ step: 'Aviso-prévio indenizado', formula: '(30 + 3×anos, teto 90) ÷ 30 × salário', inputs: { anosCompletos: years, dias: noticeDays }, resultCents: noticeCents });
  }

  // 3) 13º proporcional (avos do ano até a data projetada).
  const yearStart = new Date(Date.UTC(projectedEnd.getUTCFullYear(), 0, 1));
  const thirteenthStart = admissionDate > yearStart ? admissionDate : yearStart;
  const avos13 = countAvos(thirteenthStart, projectedEnd);
  const thirteenthCents = roundDiv(salaryCents * avos13, 12);
  if (avos13 > 0) {
    items.push({ rubricCode: '1031', rubricName: '13º proporcional', nature: 'PROVENTO', reference: `${avos13}/12 avos`, amountCents: thirteenthCents, origin: 'MOTOR' });
    memory.push({ step: '13º proporcional', formula: 'salário × avos (meses ≥15 dias) ÷ 12', inputs: { avos: avos13 }, resultCents: thirteenthCents });
  }

  // 4) Férias proporcionais + 1/3 (avos do período aquisitivo corrente).
  const anniversaryYear = (projectedEnd.getUTCMonth() > admissionDate.getUTCMonth() ||
    (projectedEnd.getUTCMonth() === admissionDate.getUTCMonth() && projectedEnd.getUTCDate() >= admissionDate.getUTCDate()))
    ? projectedEnd.getUTCFullYear()
    : projectedEnd.getUTCFullYear() - 1;
  const lastAnniversary = new Date(Date.UTC(anniversaryYear, admissionDate.getUTCMonth(), admissionDate.getUTCDate()));
  const periodStart = admissionDate > lastAnniversary ? admissionDate : lastAnniversary;
  const avosFerias = countAvos(periodStart, projectedEnd);
  const vacationPropCents = roundDiv(salaryCents * avosFerias, 12);
  const vacationPropThird = roundDiv(vacationPropCents, 3);
  if (avosFerias > 0) {
    items.push({ rubricCode: '1020', rubricName: 'Férias proporcionais', nature: 'PROVENTO', reference: `${avosFerias}/12 avos`, amountCents: vacationPropCents, origin: 'MOTOR' });
    items.push({ rubricCode: '1021', rubricName: '1/3 s/ férias proporcionais', nature: 'PROVENTO', reference: '1/3', amountCents: vacationPropThird, origin: 'MOTOR' });
    memory.push({ step: 'Férias proporcionais + 1/3', formula: 'salário × avos ÷ 12, acrescido de 1/3', inputs: { avos: avosFerias }, resultCents: vacationPropCents + vacationPropThird });
  }

  // 5) Férias vencidas + 1/3 (informadas manualmente).
  let expiredVacationCents = 0;
  let expiredVacationThird = 0;
  if (expiredVacationAvos > 0) {
    expiredVacationCents = roundDiv(salaryCents * Math.min(12, expiredVacationAvos), 12);
    expiredVacationThird = roundDiv(expiredVacationCents, 3);
    items.push({ rubricCode: '1024', rubricName: 'Férias vencidas', nature: 'PROVENTO', reference: `${expiredVacationAvos}/12 avos`, amountCents: expiredVacationCents, origin: 'MOTOR' });
    items.push({ rubricCode: '1025', rubricName: '1/3 s/ férias vencidas', nature: 'PROVENTO', reference: '1/3', amountCents: expiredVacationThird, origin: 'MOTOR' });
  } else {
    issues.push('Férias vencidas não informadas — confirme se há período aquisitivo completo não gozado.');
  }

  // ---- Incidências ----
  // Saldo de salário: INSS + IRRF + FGTS. Aviso indenizado: só FGTS.
  const inssSaldo = computeInss(saldoCents, tables.inss.data);
  if (saldoCents > 0) {
    items.push({ rubricCode: '5501', rubricName: 'INSS s/ saldo', nature: 'DESCONTO', reference: `base ${centsLabel(inssSaldo.cappedBaseCents)}`, amountCents: inssSaldo.valueCents, origin: 'MOTOR' });
    memory.push({ step: 'INSS s/ saldo de salário', formula: 'progressivo sobre o saldo de salário', inputs: { base: centsLabel(saldoCents) }, resultCents: inssSaldo.valueCents, legalVersionId: tables.inss.versionId });
  }
  const irrfSaldo = computeIrrf({ grossTaxableCents: saldoCents, inssCents: inssSaldo.valueCents, irDependents, table: tables.irrf.data });
  if (irrfSaldo.valueCents > 0) {
    items.push({ rubricCode: '5502', rubricName: 'IRRF s/ saldo', nature: 'DESCONTO', reference: `base ${centsLabel(irrfSaldo.taxableBaseCents)}`, amountCents: irrfSaldo.valueCents, origin: 'MOTOR' });
    memory.push({ step: 'IRRF s/ saldo de salário', formula: 'tabela mensal sobre o saldo após INSS', inputs: { base: centsLabel(irrfSaldo.taxableBaseCents) }, resultCents: irrfSaldo.valueCents, legalVersionId: tables.irrf.versionId });
  }

  // 13º proporcional: INSS + IRRF exclusivos.
  const inss13 = computeInss(thirteenthCents, tables.inss.data);
  let irrf13Value = 0;
  if (thirteenthCents > 0) {
    items.push({ rubricCode: '5503', rubricName: 'INSS s/ 13º', nature: 'DESCONTO', reference: `base ${centsLabel(inss13.cappedBaseCents)}`, amountCents: inss13.valueCents, origin: 'MOTOR' });
    const irrf13Base = Math.max(0, thirteenthCents - inss13.valueCents);
    let bracket = tables.irrf.data.brackets[0] ?? { upToCents: null, rateBp: 0, deductionCents: 0 };
    for (const candidate of tables.irrf.data.brackets) {
      bracket = candidate;
      if (candidate.upToCents === null || irrf13Base <= candidate.upToCents) break;
    }
    irrf13Value = Math.max(0, applyBp(irrf13Base, bracket.rateBp) - bracket.deductionCents);
    if (irrf13Value > 0) items.push({ rubricCode: '5504', rubricName: 'IRRF s/ 13º', nature: 'DESCONTO', reference: `base ${centsLabel(irrf13Base)}`, amountCents: irrf13Value, origin: 'MOTOR' });
    memory.push({ step: 'INSS/IRRF s/ 13º', formula: 'tributação exclusiva do 13º proporcional', inputs: { base13: centsLabel(thirteenthCents) }, resultCents: inss13.valueCents + irrf13Value, legalVersionId: tables.inss.versionId });
  }

  // FGTS do mês (informativo): saldo + 13º + aviso indenizado.
  const fgtsRate = contractType === 'APRENDIZ' ? tables.fgts.data.apprenticeRateBp : tables.fgts.data.rateBp;
  const fgtsBaseCents = saldoCents + thirteenthCents + noticeCents;
  const fgtsMonthCents = applyBp(fgtsBaseCents, fgtsRate);
  items.push({ rubricCode: '9003', rubricName: `FGTS rescisório ${fgtsRate / 100}%`, nature: 'INFORMATIVA', reference: `base ${centsLabel(fgtsBaseCents)}`, amountCents: fgtsMonthCents, origin: 'MOTOR' });

  // Multa rescisória do FGTS (informativa; depende do saldo da conta vinculada).
  const fineBp = fgtsFineBp(kind);
  let fgtsFineCents = 0;
  if (fineBp > 0) {
    if (fgtsBalanceCents && fgtsBalanceCents > 0) {
      fgtsFineCents = applyBp(fgtsBalanceCents, fineBp);
      items.push({ rubricCode: '9010', rubricName: `Multa FGTS ${fineBp / 100}%`, nature: 'INFORMATIVA', reference: `s/ saldo ${centsLabel(fgtsBalanceCents)}`, amountCents: fgtsFineCents, origin: 'MOTOR' });
      memory.push({ step: 'Multa rescisória FGTS', formula: 'saldo do FGTS × percentual da multa', inputs: { saldoFgts: centsLabel(fgtsBalanceCents), percentual: `${fineBp / 100}%` }, resultCents: fgtsFineCents, legalVersionId: tables.fgts.versionId });
    } else {
      issues.push(`Multa de ${fineBp / 100}% do FGTS não calculada — informe o saldo da conta vinculada do FGTS.`);
    }
  }

  const earnings = items.filter((i) => i.nature === 'PROVENTO').reduce((sum, i) => sum + i.amountCents, 0);
  const deductions = items.filter((i) => i.nature === 'DESCONTO').reduce((sum, i) => sum + i.amountCents, 0);
  const net = earnings - deductions;
  memory.push({ step: 'Líquido da rescisão', formula: 'proventos − descontos (verbas indenizatórias sem INSS/IRRF)', inputs: { proventos: centsLabel(earnings), descontos: centsLabel(deductions) }, resultCents: net });

  return {
    items,
    totals: {
      earningsCents: earnings,
      deductionsCents: deductions,
      netCents: net,
      inssBaseCents: inssSaldo.cappedBaseCents + inss13.cappedBaseCents,
      inssCents: inssSaldo.valueCents + inss13.valueCents,
      irrfBaseCents: irrfSaldo.taxableBaseCents,
      irrfCents: irrfSaldo.valueCents + irrf13Value,
      fgtsBaseCents,
      fgtsCents: fgtsMonthCents,
    },
    memory,
    informative: { fgtsFineCents },
    issues,
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

// ------------------------------ FÉRIAS E 13º (Fase 3) ------------------------------

export interface VacationCalcInput {
  salaryCents: number;
  takenDays: number;
  sellDays: number;
  contractType: string | null;
  tables: LegalTables;
}

export interface ThirteenthCalcInput {
  salaryCents: number;
  avos: number;
  parcela: 1 | 2;
  advancePaidCents?: number;
  contractType: string | null;
  tables: LegalTables;
}

export function computeVacationWorker(input: VacationCalcInput): WorkerCalcResult {
  const { salaryCents, takenDays, sellDays, contractType, tables } = input;
  const memory: MemoryStep[] = [];
  const items: WorkerCalcItem[] = [];

  const vacationCents = roundDiv(salaryCents * takenDays, 30);
  if (takenDays > 0) {
    items.push({ rubricCode: '1020', rubricName: 'Férias gozadas', nature: 'PROVENTO', reference: `${takenDays} dia(s)`, amountCents: vacationCents, origin: 'MOTOR' });
    memory.push({
      step: 'Férias gozadas',
      formula: 'salário × dias gozados ÷ 30 (half-up)',
      inputs: { salario: centsLabel(salaryCents), dias: takenDays },
      resultCents: vacationCents,
    });
  }

  const constitutionalThirdCents = roundDiv(vacationCents, 3);
  if (takenDays > 0) {
    items.push({ rubricCode: '1021', rubricName: '1/3 constitucional de férias', nature: 'PROVENTO', reference: '1/3', amountCents: constitutionalThirdCents, origin: 'MOTOR' });
    memory.push({
      step: '1/3 constitucional',
      formula: 'férias gozadas ÷ 3 (half-up)',
      inputs: { feriasGozadas: centsLabel(vacationCents) },
      resultCents: constitutionalThirdCents,
    });
  }

  const abonoCents = roundDiv(salaryCents * sellDays, 30);
  if (sellDays > 0) {
    items.push({ rubricCode: '1022', rubricName: 'Abono pecuniário', nature: 'PROVENTO', reference: `${sellDays} dia(s) vendidos`, amountCents: abonoCents, origin: 'MOTOR' });
    memory.push({
      step: 'Abono pecuniário',
      formula: 'salário × dias vendidos ÷ 30 (half-up)',
      inputs: { salario: centsLabel(salaryCents), dias: sellDays },
      resultCents: abonoCents,
    });
  }

  const thirdAbonoCents = roundDiv(abonoCents, 3);
  if (sellDays > 0) {
    items.push({ rubricCode: '1023', rubricName: '1/3 constitucional sobre abono', nature: 'PROVENTO', reference: '1/3', amountCents: thirdAbonoCents, origin: 'MOTOR' });
    memory.push({
      step: '1/3 sobre abono',
      formula: 'abono pecuniário ÷ 3 (half-up)',
      inputs: { abono: centsLabel(abonoCents) },
      resultCents: thirdAbonoCents,
    });
  }

  const taxableBaseCents = vacationCents + constitutionalThirdCents;
  const inss = computeInss(taxableBaseCents, tables.inss.data);
  if (taxableBaseCents > 0) {
    items.push({ rubricCode: '5501', rubricName: 'INSS s/ Férias', nature: 'DESCONTO', reference: `base ${centsLabel(inss.cappedBaseCents)}`, amountCents: inss.valueCents, origin: 'MOTOR' });
    memory.push({
      step: 'INSS s/ Férias',
      formula: 'progressivo por faixas sobre férias gozadas + 1/3 (base limitada ao teto)',
      inputs: { base: centsLabel(taxableBaseCents) },
      resultCents: inss.valueCents,
      legalVersionId: tables.inss.versionId,
    });
  }

  const irrf = computeIrrf({
    grossTaxableCents: taxableBaseCents,
    inssCents: inss.valueCents,
    irDependents: 0,
    table: tables.irrf.data,
  });
  if (irrf.valueCents > 0) {
    items.push({ rubricCode: '5502', rubricName: 'IRRF s/ Férias', nature: 'DESCONTO', reference: `base ${centsLabel(irrf.taxableBaseCents)}`, amountCents: irrf.valueCents, origin: 'MOTOR' });
    memory.push({
      step: 'IRRF s/ Férias',
      formula: 'tabela mensal sobre base de férias após desconto do INSS',
      inputs: { base: centsLabel(irrf.taxableBaseCents) },
      resultCents: irrf.valueCents,
      legalVersionId: tables.irrf.versionId,
    });
  }

  const fgtsRate = contractType === 'APRENDIZ' ? tables.fgts.data.apprenticeRateBp : tables.fgts.data.rateBp;
  const fgts = applyBp(taxableBaseCents, fgtsRate);
  if (taxableBaseCents > 0) {
    items.push({ rubricCode: '9003', rubricName: `FGTS s/ Férias ${fgtsRate / 100}%`, nature: 'INFORMATIVA', reference: `base ${centsLabel(taxableBaseCents)}`, amountCents: fgts, origin: 'MOTOR' });
  }

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
      fgtsBaseCents: taxableBaseCents,
      fgtsCents: fgts,
    },
    memory,
  };
}

export function computeThirteenthWorker(input: ThirteenthCalcInput): WorkerCalcResult {
  const { salaryCents, avos, parcela, advancePaidCents = 0, contractType, tables } = input;
  const memory: MemoryStep[] = [];
  const items: WorkerCalcItem[] = [];

  const fullAmountCents = roundDiv(salaryCents * avos, 12);

  if (parcela === 1) {
    const amountCents = roundDiv(fullAmountCents, 2);
    items.push({ rubricCode: '1030', rubricName: '13º salário 1ª parcela', nature: 'PROVENTO', reference: `${avos}/12 avos (50%)`, amountCents, origin: 'MOTOR' });
    
    const fgtsRate = contractType === 'APRENDIZ' ? tables.fgts.data.apprenticeRateBp : tables.fgts.data.rateBp;
    const fgts = applyBp(amountCents, fgtsRate);
    items.push({ rubricCode: '9003', rubricName: `FGTS s/ 13º 1ª Parc. ${fgtsRate / 100}%`, nature: 'INFORMATIVA', reference: `base ${centsLabel(amountCents)}`, amountCents: fgts, origin: 'MOTOR' });

    memory.push({
      step: '13º 1ª parcela',
      formula: '(salário base × avos ÷ 12) × 50% (half-up)',
      inputs: { salario: centsLabel(salaryCents), avos, percentual: '50%' },
      resultCents: amountCents,
    });
    
    const earnings = amountCents;
    const deductions = 0;
    const net = amountCents;

    memory.push({
      step: 'Líquido',
      formula: 'total de proventos',
      inputs: { proventos: centsLabel(earnings) },
      resultCents: net,
    });

    return {
      items,
      totals: {
        earningsCents: earnings,
        deductionsCents: deductions,
        netCents: net,
        inssBaseCents: 0,
        inssCents: 0,
        irrfBaseCents: 0,
        irrfCents: 0,
        fgtsBaseCents: amountCents,
        fgtsCents: fgts,
      },
      memory,
    };
  } else {
    items.push({ rubricCode: '1031', rubricName: '13º salário integral', nature: 'PROVENTO', reference: `${avos}/12 avos`, amountCents: fullAmountCents, origin: 'MOTOR' });
    memory.push({
      step: '13º integral',
      formula: 'salário base × avos de direito ÷ 12 (half-up)',
      inputs: { salario: centsLabel(salaryCents), avos },
      resultCents: fullAmountCents,
    });

    if (advancePaidCents > 0) {
      items.push({ rubricCode: '5030', rubricName: 'Desconto 1ª parcela de 13º', nature: 'DESCONTO', reference: 'Adiantamento', amountCents: advancePaidCents, origin: 'MOTOR' });
      memory.push({
        step: 'Desconto 1ª parcela',
        formula: 'Dedução do valor antecipado de 13º salário',
        inputs: { adiantamentoPago: centsLabel(advancePaidCents) },
        resultCents: advancePaidCents,
      });
    }

    const inss = computeInss(fullAmountCents, tables.inss.data);
    items.push({ rubricCode: '5501', rubricName: 'INSS s/ 13º', nature: 'DESCONTO', reference: `base ${centsLabel(inss.cappedBaseCents)}`, amountCents: inss.valueCents, origin: 'MOTOR' });
    memory.push({
      step: 'INSS s/ 13º',
      formula: 'tabela anual progressiva sobre 13º integral (teto independente)',
      inputs: { base: centsLabel(fullAmountCents) },
      resultCents: inss.valueCents,
      legalVersionId: tables.inss.versionId,
    });

    const irrfBase = Math.max(0, fullAmountCents - inss.valueCents);
    let bracket = tables.irrf.data.brackets[0] ?? { upToCents: null, rateBp: 0, deductionCents: 0 };
    for (const candidate of tables.irrf.data.brackets) {
      bracket = candidate;
      if (candidate.upToCents === null || irrfBase <= candidate.upToCents) break;
    }
    const irrfValue = Math.max(0, applyBp(irrfBase, bracket.rateBp) - bracket.deductionCents);
    if (irrfValue > 0) {
      items.push({ rubricCode: '5502', rubricName: 'IRRF s/ 13º', nature: 'DESCONTO', reference: `base ${centsLabel(irrfBase)}`, amountCents: irrfValue, origin: 'MOTOR' });
      memory.push({
        step: 'IRRF s/ 13º',
        formula: 'tabela anual de IRRF sobre base deduzida de INSS',
        inputs: { base: centsLabel(irrfBase), aliquota: `${bracket.rateBp / 100}%` },
        resultCents: irrfValue,
        legalVersionId: tables.irrf.versionId,
      });
    }

    const taxableFgtsBase = Math.max(0, fullAmountCents - advancePaidCents);
    const fgtsRate = contractType === 'APRENDIZ' ? tables.fgts.data.apprenticeRateBp : tables.fgts.data.rateBp;
    const fgts = applyBp(taxableFgtsBase, fgtsRate);
    items.push({ rubricCode: '9003', rubricName: `FGTS s/ 13º 2ª Parc. ${fgtsRate / 100}%`, nature: 'INFORMATIVA', reference: `base ${centsLabel(taxableFgtsBase)}`, amountCents: fgts, origin: 'MOTOR' });

    const earnings = fullAmountCents;
    const deductions = advancePaidCents + inss.valueCents + irrfValue;
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
        irrfBaseCents: irrfBase,
        irrfCents: irrfValue,
        fgtsBaseCents: taxableFgtsBase,
        fgtsCents: fgts,
      },
      memory,
    };
  }
}
