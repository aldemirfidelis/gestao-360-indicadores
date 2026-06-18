import { describe, it, expect } from 'vitest';
import { commercialDaysFromAdmission, computePrize, deriveEntitledDays, EngineInput } from './prize-calc-engine';

const baseConfig = { periodDays: 30, roundingRule: 'HALF_UP_2' as const, cap: null, floor: null };

function input(over: Partial<EngineInput> = {}): EngineInput {
  return {
    registration: '1', name: 'Teste', baseSalary: 3000, salaryPercent: 100, gainPotential: null,
    workedDays: 30, indicators: [], events: [], moderatorRules: [], adjustments: [], exception: null,
    historicalAverage: null, config: baseConfig, ...over,
  };
}

const fullRange = [
  { orderIndex: 0, minLimit: 0, maxLimit: 79.99, achievementPercent: 0, gainPercent: 0 },
  { orderIndex: 1, minLimit: 80, maxLimit: 99.99, achievementPercent: 80, gainPercent: 60 },
  { orderIndex: 2, minLimit: 100, maxLimit: null, achievementPercent: 100, gainPercent: 100 },
];

describe('computePrize — motor de cálculo', () => {
  it('potencial = salário × % quando não há potencial fixo', () => {
    const r = computePrize(input({ baseSalary: 3000, salaryPercent: 50, indicators: [] }));
    // sem indicadores coletivos -> ganho 100% -> base = 1500
    expect(r.potential).toBe(1500);
    expect(r.finalValue).toBe(1500);
  });

  it('atingimento ponderado: peso é % do potencial (Σ peso×%pago/100, modelo planilha)', () => {
    const r = computePrize(input({
      gainPotential: 1000, salaryPercent: null,
      indicators: [
        { indicatorId: 'a', code: 'A', name: 'A', kind: 'COLLECTIVE', weight: 50, realized: 100, target: 100, zero: 80, ranges: fullRange }, // ganho 100
        { indicatorId: 'b', code: 'B', name: 'B', kind: 'COLLECTIVE', weight: 50, realized: 90, target: 100, zero: 80, ranges: fullRange }, // ganho 60
      ],
    }));
    expect(r.weightedGain).toBe(80); // 50×100/100 + 50×60/100
    expect(r.grossValue).toBe(800); // 1000 × 80%
    expect(r.finalValue).toBe(800);
  });

  it('pesos que não somam 100% pagam exatamente a fração configurada (com aviso na memória)', () => {
    const r = computePrize(input({
      gainPotential: 1000, salaryPercent: null,
      indicators: [
        { indicatorId: 'a', code: 'A', name: 'A', kind: 'COLLECTIVE', weight: 60, realized: 100, target: 100, zero: 80, ranges: fullRange }, // só 60% do potencial
      ],
    }));
    expect(r.weightedGain).toBe(60);
    expect(r.finalValue).toBe(600);
    expect(r.lines.find((l) => l.code === 'WEIGHT_WARN')).toBeTruthy();
  });

  it('pesos ausentes = partes iguais somando 100', () => {
    const r = computePrize(input({
      gainPotential: 1000, salaryPercent: null,
      indicators: [
        { indicatorId: 'a', code: 'A', name: 'A', kind: 'COLLECTIVE', weight: null, realized: 100, target: 100, zero: 80, ranges: fullRange },
        { indicatorId: 'b', code: 'B', name: 'B', kind: 'COLLECTIVE', weight: null, realized: 90, target: 100, zero: 80, ranges: fullRange },
      ],
    }));
    expect(r.weightedGain).toBe(80); // (100+60)/2
    expect(r.lines.find((l) => l.code === 'WEIGHT_WARN')).toBeFalsy();
  });

  // GOLDEN TEST — réplica da planilha oficial (Base_SE/GANHO_ATINGIDO):
  // indicador 22782, zero 95, meta 100, peso 60, potencial 8,33% do salário,
  // 6 faixas lineares, realizado 100 → faixa topo (100%) → atingido = 60% do
  // potencial = 4,998% do salário (planilha: GANHO_ATINGIDO 4,998%).
  it('GOLDEN planilha: peso 60 × faixa topo = 4,998% do salário', () => {
    const faixas = [
      { orderIndex: 0, minLimit: 0, maxLimit: 95, achievementPercent: 0, gainPercent: 0 },
      { orderIndex: 1, minLimit: 95.01, maxLimit: 96, achievementPercent: 20, gainPercent: 20 },
      { orderIndex: 2, minLimit: 96.01, maxLimit: 97, achievementPercent: 40, gainPercent: 40 },
      { orderIndex: 3, minLimit: 97.01, maxLimit: 98, achievementPercent: 60, gainPercent: 60 },
      { orderIndex: 4, minLimit: 98.01, maxLimit: 99, achievementPercent: 80, gainPercent: 80 },
      { orderIndex: 5, minLimit: 99.01, maxLimit: 100, achievementPercent: 100, gainPercent: 100 },
    ];
    const r = computePrize(input({
      baseSalary: 3000, salaryPercent: 8.33, gainPotential: null,
      indicators: [
        { indicatorId: 'a', code: '22782', name: '% CONF ISSMA', kind: 'COLLECTIVE', direction: 'HIGHER_BETTER', weight: 60, realized: 100, target: 100, zero: 95, ranges: faixas },
      ],
    }));
    // potencial = 3000 × 8,33% = 249,90; atingido = 60% → 149,94 = 4,998% de 3000
    expect(r.potential).toBe(249.9);
    expect(r.weightedGain).toBe(60);
    expect(r.finalValue).toBe(149.94);
  });

  it('GOLDEN planilha: extrapolação acima da última faixa paga o topo', () => {
    const faixas = [
      { orderIndex: 0, minLimit: 0, maxLimit: 95, gainPercent: 0 },
      { orderIndex: 5, minLimit: 99.01, maxLimit: 100, gainPercent: 100 },
    ];
    const r = computePrize(input({
      gainPotential: 1000, salaryPercent: null,
      indicators: [
        { indicatorId: 'a', code: 'A', name: 'A', kind: 'COLLECTIVE', direction: 'HIGHER_BETTER', weight: 100, realized: 104.2, target: 100, zero: 95, ranges: faixas },
      ],
    }));
    expect(r.weightedGain).toBe(100);
    expect(r.finalValue).toBe(1000);
  });

  it('proporcionalidade reduz pelo período trabalhado', () => {
    const r = computePrize(input({ gainPotential: 1000, salaryPercent: null, workedDays: 15 }));
    expect(r.proportionality).toBe(0.5);
    expect(r.finalValue).toBe(500); // 1000 × 100% × 0.5
  });

  it('moderador percentual reduz o prêmio (parametrizável)', () => {
    const r = computePrize(input({
      gainPotential: 1000, salaryPercent: null,
      events: [{ type: 'FALTA', days: 2 }],
      moderatorRules: [{ name: 'Falta', eventType: 'FALTA', criterion: 'PER_DAY', reductionPercent: 10, reductionValue: null, cap: null, cumulative: true, priority: 0 }],
    }));
    // 1000 bruto, falta 2 dias × 10% = 200 reducao
    expect(r.grossValue).toBe(1000);
    expect(r.totalReductions).toBe(200);
    expect(r.finalValue).toBe(800);
  });

  it('moderador com cap limita a redução acumulada', () => {
    const r = computePrize(input({
      gainPotential: 1000, salaryPercent: null,
      events: [{ type: 'ATESTADO', days: 20 }],
      moderatorRules: [{ name: 'Atestado', eventType: 'ATESTADO', criterion: 'PER_DAY', reductionPercent: 10, reductionValue: null, cap: 50, cumulative: true, priority: 0 }],
    }));
    // 20×10% = 200% mas cap 50% -> reducao 500
    expect(r.totalReductions).toBe(500);
    expect(r.finalValue).toBe(500);
  });

  it('treinamento bloqueia prêmio e paga gratificação proporcional', () => {
    const r = computePrize(input({
      gainPotential: 1000, salaryPercent: null, workedDays: 15,
      exception: { type: 'TRAINING', gratificationValue: 600 },
    }));
    expect(r.blocked).toBe(true);
    expect(r.finalValue).toBe(0);
    expect(r.gratification).toBe(300); // 600 × 0.5
    expect(r.exceptionType).toBe('TRAINING');
  });

  it('impossibilidade usa a média histórica no lugar do coletivo', () => {
    const r = computePrize(input({
      gainPotential: 1000, salaryPercent: null,
      indicators: [{ indicatorId: 'a', code: 'A', name: 'A', kind: 'COLLECTIVE', weight: 1, realized: null, target: 100, zero: 80, ranges: fullRange }],
      exception: { type: 'IMPOSSIBILITY', avgMonths: 6 },
      historicalAverage: 750,
    }));
    expect(r.exceptionType).toBe('IMPOSSIBILITY');
    expect(r.finalValue).toBe(750);
  });

  it('teto e piso fazem o clamp do valor final', () => {
    const capped = computePrize(input({ gainPotential: 5000, salaryPercent: null, config: { ...baseConfig, cap: 2000 } }));
    expect(capped.finalValue).toBe(2000);
    const floored = computePrize(input({
      gainPotential: 1000, salaryPercent: null, config: { ...baseConfig, floor: 1500 },
    }));
    expect(floored.finalValue).toBe(1500);
  });

  it('ajustes aprovados somam ao final e bloqueio externo zera', () => {
    const adj = computePrize(input({ gainPotential: 1000, salaryPercent: null, adjustments: [{ field: 'FINAL_VALUE', amount: 250 }] }));
    expect(adj.finalValue).toBe(1250);
    const blocked = computePrize(input({ blockedByService: { reason: 'Não elegível' } }));
    expect(blocked.blocked).toBe(true);
    expect(blocked.finalValue).toBe(0);
  });

  it('transitoriedade sem direito ao prêmio bloqueia o pagamento', () => {
    const r = computePrize(input({
      gainPotential: 1000, salaryPercent: null,
      allocations: [{ destArea: 'Logistica', days: 30, ruleApplied: 'APPLY_DEST', hasRight: false }],
    }));
    expect(r.blocked).toBe(true);
    expect(r.finalValue).toBe(0);
    expect(r.lines.find((l) => l.code === 'TRANSIT')).toBeTruthy();
  });

  it('transitoriedade com direito registra trilha e mantém o prêmio', () => {
    const r = computePrize(input({
      gainPotential: 1000, salaryPercent: null,
      allocations: [{ destArea: 'Qualidade', days: 10, ruleApplied: 'APPLY_DEST', hasRight: true }],
    }));
    expect(r.blocked).toBe(false);
    expect(r.finalValue).toBe(1000);
    expect(r.lines.find((l) => l.code === 'TRANSIT')?.detail).toContain('direito: sim');
  });

  it('desligamento registra exceção e mantém proporcionalidade pelos dias', () => {
    const r = computePrize(input({
      gainPotential: 1000, salaryPercent: null, workedDays: 15,
      exception: { type: 'TERMINATION' },
    }));
    expect(r.exceptionType).toBe('TERMINATION');
    expect(r.finalValue).toBe(500); // 1000 × 0.5
    expect(r.lines.find((l) => l.code === 'EXC_TERM')).toBeTruthy();
  });

  it('gera memória de cálculo com etapas', () => {
    const r = computePrize(input({ gainPotential: 1000, salaryPercent: null }));
    expect(r.lines.length).toBeGreaterThan(3);
    expect(r.lines.find((l) => l.code === 'POTENTIAL')).toBeTruthy();
    expect(r.lines.find((l) => l.code === 'FINAL')).toBeTruthy();
  });

  // ---- Regra do atestado (planilha DatasAtestados): 1ª ocorrência abonada ----
  it('PER_DAY_AFTER_FIRST: atestado único não desconta', () => {
    const r = computePrize(input({
      gainPotential: 1000, salaryPercent: null,
      events: [{ type: 'ATESTADO', days: 3, date: '2026-03-05' }],
      moderatorRules: [{ name: 'Atestado', eventType: 'ATESTADO', criterion: 'PER_DAY_AFTER_FIRST', reductionPercent: 20, reductionValue: null, cap: null, cumulative: true, priority: 0 }],
    }));
    expect(r.totalReductions).toBe(0);
    expect(r.finalValue).toBe(1000);
  });

  it('PER_DAY_AFTER_FIRST: múltiplos atestados descontam total menos o mais antigo', () => {
    const r = computePrize(input({
      gainPotential: 1000, salaryPercent: null,
      events: [
        { type: 'ATESTADO', days: 2, date: '2026-03-20' },
        { type: 'ATESTADO', days: 3, date: '2026-03-02' }, // mais antigo: abonado
      ],
      moderatorRules: [{ name: 'Atestado', eventType: 'ATESTADO', criterion: 'PER_DAY_AFTER_FIRST', reductionPercent: 20, reductionValue: null, cap: null, cumulative: true, priority: 0 }],
    }));
    // total 5 dias − 3 (mais antigo) = 2 dias × 20% = 40% de 1000
    expect(r.totalReductions).toBe(400);
    expect(r.finalValue).toBe(600);
  });

  it('moderadores do modelo oficial compõem como na fórmula da planilha (AE)', () => {
    // 1 falta (1d) + 1 medida: fator = 1 − 0,34 − 0,5 = 0,16 → final = bruto × 0,16
    const r = computePrize(input({
      gainPotential: 1000, salaryPercent: null,
      events: [
        { type: 'FALTA', days: 1 },
        { type: 'MEDIDA_DISCIPLINAR' },
      ],
      moderatorRules: [
        { name: 'Falta', eventType: 'FALTA', criterion: 'PER_DAY', reductionPercent: 34, reductionValue: null, cap: null, cumulative: true, priority: 0 },
        { name: 'Medida', eventType: 'MEDIDA_DISCIPLINAR', criterion: 'PER_OCCURRENCE', reductionPercent: 50, reductionValue: null, cap: null, cumulative: true, priority: 0 },
      ],
    }));
    expect(r.totalReductions).toBe(840); // 340 + 500
    expect(r.finalValue).toBe(160);
  });
});

describe('dias de direito (mês comercial de 30 dias — regra da planilha)', () => {
  it('admissão antes do mês = 30; depois do mês = 0; no mês = 30 − dia + 1', () => {
    expect(commercialDaysFromAdmission('2025-01-10', 2026, 3)).toBe(30);
    expect(commercialDaysFromAdmission('2026-04-01', 2026, 3)).toBe(0);
    expect(commercialDaysFromAdmission('2026-03-11', 2026, 3)).toBe(20); // 30−11+1
    expect(commercialDaysFromAdmission('2026-03-31', 2026, 3)).toBe(0); // 30−31+1 → 0
    expect(commercialDaysFromAdmission(null, 2026, 3)).toBe(30);
  });

  it('ausências reduzem os dias; atestado também reduz (regra oficial Goiasa)', () => {
    const events = [
      { type: 'FERIAS', days: 10 },
      { type: 'FALTA', days: 2 },
      { type: 'ATESTADO', days: 5 }, // entra: atestado reduz dias de direito E modera o 2o+
    ];
    expect(deriveEntitledDays(30, events)).toBe(13); // 30 − 10 − 2 − 5
    expect(deriveEntitledDays(5, [{ type: 'AFASTAMENTO', days: 12 }])).toBe(0); // clamp
  });

  it('atestado tem duplo efeito (dias de direito + moderador 2o+) — caso Goiasa/Armando', () => {
    // 4 dias de atestado em 2 ocorrencias (1a com 2 dias = abonada do moderador).
    const events = [
      { type: 'ATESTADO', days: 2, date: '2026-04-02' }, // 1a ocorrencia (mais antiga): abonada
      { type: 'ATESTADO', days: 2, date: '2026-04-15' }, // 2a: 2 dias × 20%
    ];
    const entitled = deriveEntitledDays(30, events);
    expect(entitled).toBe(26); // 30 − 4 (todos os dias de atestado reduzem proporcionalidade)
    const r = computePrize(input({
      baseSalary: 7732.27, salaryPercent: 4.165, gainPotential: null,
      workedDays: entitled, events,
      moderatorRules: [{ name: 'Atestado', eventType: 'ATESTADO', criterion: 'PER_DAY_AFTER_FIRST', reductionPercent: 20, reductionValue: null, cap: null, cumulative: true, priority: 0 }],
    }));
    expect(r.grossValue).toBe(279.11); // 7732,27 × 4,165% × 26/30
    expect(r.totalReductions).toBe(111.64); // 2 dias × 20% = 40% de 279,11
    expect(r.finalValue).toBe(167.47); // moderador deixa 60%
  });
});
