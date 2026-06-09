import { evaluateActual } from './prize-evaluation';

/**
 * Motor de calculo do premio (PURO — sem banco, deterministico, testavel).
 * Implementa as etapas do procedimento GOIASA (prompt secao 14.1). NENHUM
 * percentual de empresa e fixado aqui: todos os valores vem da entrada (anexo,
 * faixas, regras de moderador, excecoes), tornando o motor multiempresa.
 * Produz o valor final + a MEMORIA DE CALCULO (lines) auditavel.
 */

export interface EngineIndicator {
  indicatorId: string;
  code: string;
  name: string;
  kind: 'COLLECTIVE' | 'INDIVIDUAL' | 'BEHAVIORAL_COLLECTIVE' | 'BEHAVIORAL_INDIVIDUAL';
  weight: number | null;
  realized: number | null;
  target: number | null;
  zero: number | null;
  ranges: Array<{ orderIndex?: number; minLimit?: number | null; maxLimit?: number | null; achievementPercent?: number | null; gainPercent?: number | null }>;
}
export interface EngineEvent { type: string; days?: number | null }
export interface EngineModeratorRule {
  name: string; eventType: string; criterion?: string | null;
  reductionPercent?: number | null; reductionValue?: number | null; cap?: number | null; cumulative: boolean; priority: number;
}
export interface EngineAdjustment { field: string; amount?: number | null }
export interface EngineException { type: 'IMPOSSIBILITY' | 'TRAINING' | 'TERMINATION' | 'OTHER'; avgMonths?: number | null; gratificationValue?: number | null }
export interface EngineConfig {
  periodDays: number; // dias do periodo (default 30)
  roundingRule: string; // HALF_UP_2 | FLOOR_2 | HALF_UP_0
  cap?: number | null; // teto em R$
  floor?: number | null; // piso em R$
}
export interface EngineInput {
  registration: string;
  name: string;
  baseSalary: number | null;
  salaryPercent: number | null; // % possivel sobre o salario (anexo)
  gainPotential: number | null; // potencial em R$ (anexo) — sobrepoe salario%
  workedDays: number | null;
  indicators: EngineIndicator[];
  events: EngineEvent[];
  moderatorRules: EngineModeratorRule[];
  adjustments: EngineAdjustment[];
  exception?: EngineException | null;
  historicalAverage?: number | null; // media dos ultimos N meses (para IMPOSSIBILITY)
  blockedByService?: { reason: string } | null; // bloqueio externo (ex.: nao elegivel)
  config: EngineConfig;
}
export interface CalcLine { step: number; code: string; label: string; detail?: string; value?: number | null; data?: any }
export interface EngineOutput {
  potential: number;
  weightedGain: number;
  proportionality: number;
  grossValue: number;
  totalReductions: number;
  adjustments: number;
  gratification: number;
  finalValue: number;
  blocked: boolean;
  blockReason?: string;
  exceptionType?: string | null;
  lines: CalcLine[];
}

function round(v: number, rule: string): number {
  if (!Number.isFinite(v)) return 0;
  switch (rule) {
    case 'FLOOR_2': return Math.floor(v * 100) / 100;
    case 'HALF_UP_0': return Math.round(v);
    case 'HALF_UP_2':
    default: return Math.round(v * 100) / 100;
  }
}

function weightedGainOf(indicators: EngineIndicator[]): { gain: number; perIndicator: Array<{ code: string; gain: number; weight: number }> } {
  const per: Array<{ code: string; gain: number; weight: number }> = [];
  let sumW = 0;
  let sumWG = 0;
  for (const ind of indicators) {
    const ev = evaluateActual(ind.realized, { target: ind.target, zero: ind.zero }, ind.ranges);
    const gain = ev.gainPercent ?? ev.achievementPercent ?? 0;
    const w = ind.weight ?? 1;
    per.push({ code: ind.code, gain, weight: w });
    sumW += w;
    sumWG += w * gain;
  }
  // Sem indicadores avaliaveis -> 100% (o potencial do anexo e o premio).
  const gain = indicators.length === 0 ? 100 : sumW > 0 ? sumWG / sumW : 0;
  return { gain, perIndicator: per };
}

export function computePrize(input: EngineInput): EngineOutput {
  const lines: CalcLine[] = [];
  const cfg = input.config;
  const add = (step: number, code: string, label: string, value?: number | null, detail?: string, data?: any) =>
    lines.push({ step, code, label, value: value ?? null, detail, data });

  add(1, 'EMPLOYEE', 'Colaborador elegível', null, `${input.registration} — ${input.name}`);

  // Bloqueio externo (ex.: marcado nao elegivel na conciliacao)
  if (input.blockedByService) {
    add(20, 'BLOCKED', 'Pagamento bloqueado', 0, input.blockedByService.reason);
    return { potential: 0, weightedGain: 0, proportionality: 0, grossValue: 0, totalReductions: 0, adjustments: 0, gratification: 0, finalValue: 0, blocked: true, blockReason: input.blockedByService.reason, exceptionType: null, lines };
  }

  // 3. Potencial (anexo)
  const potential = input.gainPotential != null
    ? input.gainPotential
    : (input.baseSalary ?? 0) * ((input.salaryPercent ?? 0) / 100);
  add(3, 'POTENTIAL', 'Potencial de prêmio', round(potential, cfg.roundingRule),
    input.gainPotential != null ? 'Potencial fixo do anexo' : `Salário ${input.baseSalary ?? 0} × ${input.salaryPercent ?? 0}%`);

  // 4-7. Indicadores coletivos -> atingimento ponderado -> resultado-base
  const collectives = input.indicators.filter((i) => i.kind === 'COLLECTIVE');
  const { gain: weightedGain, perIndicator } = weightedGainOf(collectives);
  perIndicator.forEach((p) => add(5, 'IND_COLL', `Indicador coletivo ${p.code}`, p.gain, `peso ${p.weight} · ganho ${p.gain}%`));
  add(7, 'WEIGHTED_GAIN', 'Atingimento ponderado (coletivo)', round(weightedGain, 'HALF_UP_2'), `${collectives.length} indicador(es)`);

  let base = potential * (weightedGain / 100);

  // Excecao: impossibilidade de apuracao -> media dos ultimos N meses
  let exceptionType: string | null = null;
  if (input.exception?.type === 'IMPOSSIBILITY') {
    exceptionType = 'IMPOSSIBILITY';
    const months = input.exception.avgMonths ?? 6;
    if (input.historicalAverage != null) {
      base = input.historicalAverage;
      add(6, 'EXC_IMPOSS', 'Impossibilidade de apuração', round(base, cfg.roundingRule), `Média dos últimos ${months} meses recebidos`);
    } else {
      add(6, 'EXC_IMPOSS', 'Impossibilidade de apuração', null, `Sem histórico para média de ${months} meses`);
    }
  }
  add(7, 'BASE', 'Resultado-base', round(base, cfg.roundingRule), `Potencial × atingimento`);

  // 8. Proporcionalidade (dias trabalhados / dias do periodo)
  const periodDays = cfg.periodDays > 0 ? cfg.periodDays : 30;
  const proportionality = input.workedDays != null ? Math.max(0, Math.min(1, input.workedDays / periodDays)) : 1;
  base = base * proportionality;
  add(8, 'PROPORTION', 'Proporcionalidade', round(proportionality, 'HALF_UP_2'), `${input.workedDays ?? periodDays}/${periodDays} dias`);

  // 10-11. Indicadores individuais e comportamentais (fatores multiplicativos)
  const individuals = input.indicators.filter((i) => i.kind === 'INDIVIDUAL');
  const behaviorals = input.indicators.filter((i) => i.kind === 'BEHAVIORAL_COLLECTIVE' || i.kind === 'BEHAVIORAL_INDIVIDUAL');
  if (individuals.length) {
    const f = weightedGainOf(individuals).gain;
    base = base * (f / 100);
    add(10, 'IND_INDIV', 'Fator indicadores individuais', round(f, 'HALF_UP_2'), `${f}%`);
  }
  if (behaviorals.length) {
    const f = weightedGainOf(behaviorals).gain;
    base = base * (f / 100);
    add(11, 'IND_BEHAV', 'Fator indicadores comportamentais', round(f, 'HALF_UP_2'), `${f}%`);
  }

  // 17. Valor bruto (antes das reducoes individuais)
  const grossValue = round(base, cfg.roundingRule);
  add(17, 'GROSS', 'Prêmio bruto', grossValue);

  // Excecao: treinamento -> nao paga premio; paga gratificacao
  let gratification = 0;
  if (input.exception?.type === 'TRAINING') {
    exceptionType = 'TRAINING';
    gratification = round((input.exception.gratificationValue ?? 0) * proportionality, cfg.roundingRule);
    add(14, 'EXC_TRAINING', 'Colaborador em treinamento', gratification, 'Sem prêmio; gratificação de treinamento (proporcional)');
    add(19, 'FINAL', 'Prêmio final', 0, 'Bloqueado por treinamento');
    return { potential: round(potential, cfg.roundingRule), weightedGain: round(weightedGain, 'HALF_UP_2'), proportionality: round(proportionality, 'HALF_UP_2'), grossValue: 0, totalReductions: 0, adjustments: 0, gratification, finalValue: 0, blocked: true, blockReason: 'Treinamento', exceptionType, lines };
  }

  // 12. Moderadores (reducoes individuais)
  let totalReductions = 0;
  const rulesByType = new Map<string, EngineModeratorRule[]>();
  for (const r of input.moderatorRules) {
    const arr = rulesByType.get(r.eventType) ?? [];
    arr.push(r);
    rulesByType.set(r.eventType, arr);
  }
  for (const ev of input.events) {
    const rules = (rulesByType.get(ev.type) ?? []).sort((a, b) => a.priority - b.priority);
    for (const rule of rules) {
      const factor = rule.criterion === 'PER_DAY' ? (ev.days ?? 1) : 1;
      let reduction = 0;
      if (rule.reductionValue != null) reduction = rule.reductionValue * factor;
      else if (rule.reductionPercent != null) reduction = grossValue * (rule.reductionPercent / 100) * factor;
      if (rule.cap != null) reduction = Math.min(reduction, grossValue * (rule.cap / 100));
      reduction = round(reduction, cfg.roundingRule);
      totalReductions += reduction;
      add(12, 'MODERATOR', `Moderador: ${rule.name}`, -reduction, `Evento ${ev.type}${ev.days ? ` (${ev.days}d)` : ''}`);
      if (!rule.cumulative) break;
    }
  }
  totalReductions = round(Math.min(totalReductions, grossValue), cfg.roundingRule);
  add(18, 'REDUCTIONS', 'Total de reduções (moderadores)', -totalReductions);

  // 13. Ajustes aprovados
  const adjustments = round(input.adjustments.reduce((s, a) => s + (a.amount ?? 0), 0), cfg.roundingRule);
  if (adjustments) add(13, 'ADJUST', 'Ajustes manuais aprovados', adjustments);

  // 15-16-19. Teto/piso, arredondamento, valor final
  let finalValue = grossValue - totalReductions + adjustments;
  if (cfg.cap != null && finalValue > cfg.cap) { finalValue = cfg.cap; add(15, 'CAP', 'Teto aplicado', cfg.cap); }
  if (cfg.floor != null && finalValue < cfg.floor) { finalValue = cfg.floor; add(15, 'FLOOR', 'Piso aplicado', cfg.floor); }
  finalValue = round(Math.max(0, finalValue), cfg.roundingRule);
  add(19, 'FINAL', 'Prêmio final', finalValue, 'Bruto − reduções + ajustes');

  return {
    potential: round(potential, cfg.roundingRule),
    weightedGain: round(weightedGain, 'HALF_UP_2'),
    proportionality: round(proportionality, 'HALF_UP_2'),
    grossValue,
    totalReductions,
    adjustments,
    gratification,
    finalValue,
    blocked: false,
    exceptionType,
    lines,
  };
}

export const PRIZE_ENGINE_VERSION = '1.0.0';
