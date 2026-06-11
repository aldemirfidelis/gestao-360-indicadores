import { evaluateActual, EvalDirection, EvalRange } from './prize-evaluation';
import { computePrize, EngineEvent, EngineModeratorRule } from './prize-calc-engine';
import { roundMoney, roundPercent } from './prize-rule-matrix.util';

export interface V2CellIndicatorInput {
  code: string;
  name: string;
  direction: EvalDirection;
  weight: number;
  realized: number | null;
  zero: number | null;
  target: number | null;
  bands: EvalRange[];
}

export interface V2CellInput {
  possibleSalaryPercent: number;
  indicators: V2CellIndicatorInput[];
}

export interface V2CellIndicatorResult {
  code: string;
  name: string;
  weight: number;
  realized: number | null;
  zero: number | null;
  target: number | null;
  gainPercent: number;
  salaryPercentContribution: number;
  rangeLabel: string | null;
  pending: boolean;
}

export interface V2CellOutput {
  possibleSalaryPercent: number;
  achievedSalaryPercent: number;
  weightedGainPercent: number;
  pending: boolean;
  indicators: V2CellIndicatorResult[];
}

export interface V2IndividualInput {
  registration: string;
  name: string;
  baseSalary: number | null;
  possibleSalaryPercent: number;
  achievedSalaryPercent: number;
  entitledDays: number;
  events: EngineEvent[];
  moderatorRules: EngineModeratorRule[];
  adjustments: Array<{ field: string; amount?: number | null }>;
  roundingRule: string;
  blockedReason?: string | null;
}

export function evaluateV2Cell(input: V2CellInput): V2CellOutput {
  let achievedSalaryPercent = 0;
  let weightedGainPercent = 0;
  let pending = false;

  const indicators = input.indicators.map((indicator) => {
    const hasRequiredInput = indicator.realized !== null && indicator.zero !== null && indicator.target !== null;
    const evalResult = evaluateActual(
      indicator.realized,
      { zero: indicator.zero, target: indicator.target },
      indicator.bands,
      indicator.direction,
    );
    const gainPercent = hasRequiredInput ? evalResult.gainPercent ?? evalResult.achievementPercent ?? 0 : 0;
    const salaryPercentContribution = input.possibleSalaryPercent * (indicator.weight / 100) * (gainPercent / 100);
    if (!hasRequiredInput) pending = true;
    achievedSalaryPercent += salaryPercentContribution;
    weightedGainPercent += indicator.weight * (gainPercent / 100);
    return {
      code: indicator.code,
      name: indicator.name,
      weight: indicator.weight,
      realized: indicator.realized,
      zero: indicator.zero,
      target: indicator.target,
      gainPercent: roundPercent(gainPercent),
      salaryPercentContribution: roundPercent(salaryPercentContribution),
      rangeLabel: evalResult.rangeLabel,
      pending: !hasRequiredInput,
    };
  });

  return {
    possibleSalaryPercent: roundPercent(input.possibleSalaryPercent),
    achievedSalaryPercent: roundPercent(achievedSalaryPercent),
    weightedGainPercent: roundPercent(weightedGainPercent),
    pending,
    indicators,
  };
}

export function computeV2Individual(input: V2IndividualInput) {
  const baseSalary = input.baseSalary ?? 0;
  const possible = roundMoney(baseSalary * (input.possibleSalaryPercent / 100) * (input.entitledDays / 30));

  if (input.blockedReason) {
    return {
      possible,
      weightedGain: 0,
      grossValue: 0,
      totalReductions: 0,
      adjustments: 0,
      gratification: 0,
      finalValue: 0,
      blocked: true,
      blockReason: input.blockedReason,
      lines: [
        { step: 1, code: 'EMPLOYEE', label: 'Colaborador', detail: `${input.registration} - ${input.name}`, value: null },
        { step: 2, code: 'BLOCKED', label: 'Pagamento bloqueado', detail: input.blockedReason, value: 0 },
      ],
    };
  }

  const out = computePrize({
    registration: input.registration,
    name: input.name,
    baseSalary,
    salaryPercent: input.achievedSalaryPercent,
    gainPotential: null,
    workedDays: input.entitledDays,
    indicators: [],
    events: input.events,
    moderatorRules: input.moderatorRules,
    adjustments: input.adjustments,
    exception: null,
    historicalAverage: null,
    config: { periodDays: 30, roundingRule: input.roundingRule, cap: null, floor: null },
  });

  const weightedGain = input.possibleSalaryPercent > 0
    ? roundPercent((input.achievedSalaryPercent / input.possibleSalaryPercent) * 100)
    : 0;

  const lines = [
    { step: 1, code: 'EMPLOYEE', label: 'Colaborador', detail: `${input.registration} - ${input.name}`, value: null },
    {
      step: 3,
      code: 'POSSIBLE',
      label: 'Premio possivel',
      detail: `Salario ${baseSalary} x ${input.possibleSalaryPercent}% / 30 x ${input.entitledDays} dias`,
      value: possible,
    },
    {
      step: 4,
      code: 'CELL_ACHIEVED',
      label: 'Regua coletiva aplicada',
      detail: `Salario atingido ${input.achievedSalaryPercent}% (${weightedGain}% do possivel)`,
      value: out.grossValue,
    },
    ...out.lines.filter((line) => ['MODERATOR', 'REDUCTIONS', 'ADJUST', 'CAP', 'FLOOR', 'FINAL'].includes(line.code)),
  ];

  return {
    possible,
    weightedGain,
    grossValue: out.grossValue,
    totalReductions: out.totalReductions,
    adjustments: out.adjustments,
    gratification: out.gratification,
    finalValue: out.finalValue,
    blocked: out.blocked,
    blockReason: out.blockReason ?? null,
    exceptionType: out.exceptionType ?? null,
    lines,
  };
}
