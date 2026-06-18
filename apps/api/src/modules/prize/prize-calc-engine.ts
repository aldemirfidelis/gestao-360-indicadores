import { evaluateActual, EvalDirection } from './prize-evaluation';

/**
 * Motor de calculo do premio (PURO — sem banco, deterministico, testavel).
 * Implementa as etapas do procedimento GOIASA (prompt secao 14.1), CALIBRADO
 * pelas planilhas oficiais de Bases_calculo (VBA CALCULO/FaixaAtingida):
 *  - peso do indicador e PERCENTUAL DO POTENCIAL (ganho = Σ peso×%pago/100,
 *    sem normalizacao — pesos devem somar 100; divergencia gera aviso na
 *    memoria de calculo);
 *  - mes comercial de 30 dias (proporcionalidade = diasDireito/30; admissao no
 *    mes = 30 − dia + 1);
 *  - moderadores multiplicativos por tipo de evento, com criterio
 *    PER_DAY_AFTER_FIRST (1a ocorrencia abonada — regra do atestado).
 * NENHUM percentual de empresa e fixado aqui: todos os valores vem da entrada
 * (anexo, faixas, regras de moderador, excecoes), tornando o motor multiempresa.
 * Produz o valor final + a MEMORIA DE CALCULO (lines) auditavel.
 */

export interface EngineIndicator {
  indicatorId: string;
  code: string;
  name: string;
  kind: 'COLLECTIVE' | 'INDIVIDUAL' | 'BEHAVIORAL_COLLECTIVE' | 'BEHAVIORAL_INDIVIDUAL';
  direction?: EvalDirection;
  weight: number | null;
  realized: number | null;
  target: number | null;
  zero: number | null;
  ranges: Array<{ orderIndex?: number; minLimit?: number | null; maxLimit?: number | null; achievementPercent?: number | null; gainPercent?: number | null }>;
}
export interface EngineEvent { type: string; days?: number | null; date?: string | null }
export interface EngineModeratorRule {
  name: string; eventType: string; criterion?: string | null;
  reductionPercent?: number | null; reductionValue?: number | null; cap?: number | null; cumulative: boolean; priority: number;
}
export interface EngineAdjustment { field: string; amount?: number | null }
export interface EngineException { type: 'IMPOSSIBILITY' | 'TRAINING' | 'TERMINATION' | 'OTHER'; avgMonths?: number | null; gratificationValue?: number | null }
export interface EngineAllocation { destArea?: string | null; destPosition?: string | null; days?: number | null; ruleApplied?: string | null; hasRight: boolean }
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
  allocations?: EngineAllocation[]; // transitoriedade de area (por dias)
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

/**
 * Ganho ponderado no modelo das planilhas: peso = % do potencial; ganho do
 * indicador = peso × %pago(faixa atingida); total = Σ(peso×ganho)/100. Sem
 * normalizacao por Σpesos — se os pesos nao somarem 100, paga-se exatamente a
 * fracao configurada (e o motor sinaliza a divergencia). Pesos todos ausentes
 * -> partes iguais somando 100.
 */
function weightedGainOf(indicators: EngineIndicator[]): {
  gain: number;
  weightSum: number;
  perIndicator: Array<{ code: string; gain: number; weight: number }>;
} {
  if (indicators.length === 0) {
    // Sem indicadores avaliaveis -> 100% (o potencial do anexo e o premio).
    return { gain: 100, weightSum: 100, perIndicator: [] };
  }
  const allNull = indicators.every((i) => i.weight === null || i.weight === undefined);
  const per: Array<{ code: string; gain: number; weight: number }> = [];
  let sumW = 0;
  let sumWG = 0;
  for (const ind of indicators) {
    const ev = evaluateActual(ind.realized, { target: ind.target, zero: ind.zero }, ind.ranges, ind.direction ?? 'HIGHER_BETTER');
    const gain = ev.gainPercent ?? ev.achievementPercent ?? 0;
    const w = allNull ? 100 / indicators.length : ind.weight ?? 0;
    per.push({ code: ind.code, gain, weight: w });
    sumW += w;
    sumWG += w * gain;
  }
  return { gain: sumWG / 100, weightSum: sumW, perIndicator: per };
}

/**
 * Tipos de evento que reduzem os DIAS DE DIREITO (proporcionalidade — planilha
 * coluna AD). Regra oficial GOIASA: os dias de ATESTADO reduzem proporcionalmente
 * os dias de direito ("os dias do primeiro atestado — ou fora da competencia —
 * serao descontados proporcionalmente") E, a partir do 2o atestado, ainda
 * moderam o premio (20%/dia via criterio PER_DAY_AFTER_FIRST na regra de
 * moderador). Ou seja: atestado tem duplo efeito (dias + moderador 2o+).
 */
export const ABSENCE_EVENT_TYPES = ['FALTA', 'ATESTADO', 'SUSPENSAO', 'FERIAS', 'LICENCA', 'AFASTAMENTO', 'AUXILIO_DOENCA'];

/**
 * Dias-base do mes comercial (30) conforme a data de admissao — regra
 * DiasNoMesRegraApuracao da planilha: admitido depois do mes = 0; antes = 30;
 * dentro do mes = 30 − dia + 1.
 */
export function commercialDaysFromAdmission(admissionDate: Date | string | null | undefined, year: number, month: number): number {
  if (!admissionDate) return 30;
  const adm = admissionDate instanceof Date ? admissionDate : new Date(admissionDate);
  if (Number.isNaN(adm.getTime())) return 30;
  const ay = adm.getUTCFullYear();
  const am = adm.getUTCMonth() + 1;
  if (ay > year || (ay === year && am > month)) return 0;
  if (ay < year || (ay === year && am < month)) return 30;
  return Math.max(0, 30 - adm.getUTCDate() + 1);
}

/** Dias de direito = dias-base − Σ dias dos eventos de ausencia (clamp ≥ 0). */
export function deriveEntitledDays(baseDays: number, events: EngineEvent[], absenceTypes: string[] = ABSENCE_EVENT_TYPES): number {
  const absent = events
    .filter((e) => absenceTypes.includes(e.type))
    .reduce((s, e) => s + (e.days ?? 0), 0);
  return Math.max(0, Math.round((baseDays - absent) * 100) / 100);
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
  // (modelo planilha: peso e % do potencial; ganho total = Σ peso×%pago / 100)
  const collectives = input.indicators.filter((i) => i.kind === 'COLLECTIVE');
  const { gain: weightedGain, weightSum, perIndicator } = weightedGainOf(collectives);
  perIndicator.forEach((p) => add(5, 'IND_COLL', `Indicador coletivo ${p.code}`, p.gain, `peso ${p.weight}% · %pago ${p.gain}% · parcela ${round((p.weight * p.gain) / 100, 'HALF_UP_2')}%`));
  if (collectives.length > 0 && Math.abs(weightSum - 100) > 0.01) {
    add(6, 'WEIGHT_WARN', 'Atenção: pesos dos indicadores coletivos não somam 100%', round(weightSum, 'HALF_UP_2'), `Soma dos pesos = ${weightSum}% — o prêmio pagará no máximo essa fração do potencial`);
  }
  add(7, 'WEIGHTED_GAIN', 'Atingimento ponderado (coletivo)', round(weightedGain, 'HALF_UP_2'), `${collectives.length} indicador(es) · Σ peso×%pago/100`);

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

  // 9. Transitoriedade de area (segmenta por dias; registra trilha; direito sim/nao)
  if (input.allocations?.length) {
    for (const a of input.allocations) {
      add(9, 'TRANSIT', `Transitoriedade: ${a.destArea ?? a.destPosition ?? 'área destino'}`, a.days ?? null, `${a.ruleApplied ?? 'APPLY_DEST'} · ${a.days ?? 0} dia(s) · direito: ${a.hasRight ? 'sim' : 'não'}`);
    }
    // Sem direito ao premio em todos os periodos de alocacao -> bloqueia.
    if (input.allocations.every((a) => !a.hasRight)) {
      add(19, 'FINAL', 'Prêmio final', 0, 'Bloqueado por transitoriedade sem direito ao prêmio');
      return { potential: round(potential, cfg.roundingRule), weightedGain: round(weightedGain, 'HALF_UP_2'), proportionality: round(proportionality, 'HALF_UP_2'), grossValue: 0, totalReductions: 0, adjustments: 0, gratification: 0, finalValue: 0, blocked: true, blockReason: 'Transitoriedade sem direito ao prêmio', exceptionType, lines };
    }
  }

  // Desligamento no periodo: premio proporcional aos dias trabalhados (ja aplicado).
  if (input.exception?.type === 'TERMINATION') {
    exceptionType = 'TERMINATION';
    add(9, 'EXC_TERM', 'Desligamento no período', round(base, cfg.roundingRule), 'Prêmio proporcional aos dias efetivamente trabalhados');
  }

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

  // 12. Moderadores (reducoes individuais) — agregados por TIPO de evento,
  // como na planilha (fator = 1 − Σ reducoes, clamp em 0 via min(Σ, bruto)).
  // Criterios: PER_DAY (por dia), PER_OCCURRENCE/ANY (por ocorrencia) e
  // PER_DAY_AFTER_FIRST (por dia, com a 1a ocorrencia — a mais antiga —
  // abonada: regra do atestado na planilha CALCULO/DatasAtestados).
  let totalReductions = 0;
  const eventsByType = new Map<string, EngineEvent[]>();
  for (const ev of input.events) {
    const arr = eventsByType.get(ev.type) ?? [];
    arr.push(ev);
    eventsByType.set(ev.type, arr);
  }
  for (const [type, occurrences] of eventsByType) {
    const rules = input.moderatorRules.filter((r) => r.eventType === type).sort((a, b) => a.priority - b.priority);
    for (const rule of rules) {
      let factor: number;
      let detail: string;
      if (rule.criterion === 'PER_DAY') {
        factor = occurrences.reduce((s, e) => s + (e.days ?? 1), 0);
        detail = `${occurrences.length} evento(s) · ${factor} dia(s)`;
      } else if (rule.criterion === 'PER_DAY_AFTER_FIRST') {
        if (occurrences.length <= 1) {
          factor = 0;
          detail = `${occurrences.length} evento(s) · 1ª ocorrência abonada`;
        } else {
          const sorted = [...occurrences].sort((a, b) => {
            const da = a.date ? Date.parse(a.date) : Number.POSITIVE_INFINITY;
            const db = b.date ? Date.parse(b.date) : Number.POSITIVE_INFINITY;
            return da - db;
          });
          const totalDays = sorted.reduce((s, e) => s + (e.days ?? 1), 0);
          factor = Math.max(0, totalDays - (sorted[0].days ?? 1));
          detail = `${occurrences.length} evento(s) · ${totalDays} dia(s) − ${sorted[0].days ?? 1} (1ª ocorrência abonada) = ${factor}`;
        }
      } else {
        factor = occurrences.length;
        detail = `${occurrences.length} ocorrência(s)`;
      }
      let reduction = 0;
      if (rule.reductionValue != null) reduction = rule.reductionValue * factor;
      else if (rule.reductionPercent != null) reduction = grossValue * (rule.reductionPercent / 100) * factor;
      if (rule.cap != null) reduction = Math.min(reduction, grossValue * (rule.cap / 100));
      reduction = round(reduction, cfg.roundingRule);
      if (reduction !== 0 || factor > 0) {
        totalReductions += reduction;
        add(12, 'MODERATOR', `Moderador: ${rule.name}`, -reduction, `Evento ${type} · ${detail}`);
      }
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

// 1.1.0: calibracao pelas planilhas oficiais (Bases_calculo): pesos como % do
// potencial (sem normalizacao), extrapolacao de faixa por sentido, moderadores
// agregados por tipo + criterio PER_DAY_AFTER_FIRST, dias de direito base 30.
// 1.2.0: regra oficial de atestado — dias de atestado reduzem os dias de direito
// (proporcionalidade) e ainda moderam 20%/dia a partir do 2o atestado.
export const PRIZE_ENGINE_VERSION = '1.2.0';
