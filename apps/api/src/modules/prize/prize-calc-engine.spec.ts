import { describe, it, expect } from 'vitest';
import { computePrize, EngineInput } from './prize-calc-engine';

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

  it('atingimento ponderado por faixa define o resultado-base', () => {
    const r = computePrize(input({
      gainPotential: 1000, salaryPercent: null,
      indicators: [
        { indicatorId: 'a', code: 'A', name: 'A', kind: 'COLLECTIVE', weight: 1, realized: 100, target: 100, zero: 80, ranges: fullRange }, // ganho 100
        { indicatorId: 'b', code: 'B', name: 'B', kind: 'COLLECTIVE', weight: 1, realized: 90, target: 100, zero: 80, ranges: fullRange }, // ganho 60
      ],
    }));
    expect(r.weightedGain).toBe(80); // média (100+60)/2
    expect(r.grossValue).toBe(800); // 1000 × 80%
    expect(r.finalValue).toBe(800);
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
});
