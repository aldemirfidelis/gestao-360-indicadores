import { describe, expect, it } from 'vitest';
import { normalizeRuleKey } from './prize-rule-matrix.util';
import { computeV2Individual, evaluateV2Cell } from './prize-v2-engine';

describe('prize v2 matrix engine', () => {
  it('normaliza nomes de area/cargo para match deterministico', () => {
    expect(normalizeRuleKey('Adubacao Convencional')).toBe('ADUBACAO CONVENCIONAL');
    expect(normalizeRuleKey('  Operador--Maquina II  ')).toBe('OPERADOR MAQUINA II');
    expect(normalizeRuleKey('ÁREA Agrícola')).toBe('AREA AGRICOLA');
  });

  it('calcula a regua coletiva area-cargo somando salario% x peso x faixa', () => {
    const cell = evaluateV2Cell({
      possibleSalaryPercent: 8.33,
      indicators: [
        {
          code: '22782',
          name: 'ISSMA',
          direction: 'HIGHER_BETTER',
          weight: 60,
          realized: 100,
          zero: 95,
          target: 100,
          bands: [
            { orderIndex: 0, minLimit: 0, maxLimit: 95, gainPercent: 0 },
            { orderIndex: 5, minLimit: 99.01, maxLimit: 100, gainPercent: 100 },
          ],
        },
        {
          code: '22783',
          name: 'Custo',
          direction: 'HIGHER_BETTER',
          weight: 40,
          realized: 96,
          zero: 95,
          target: 100,
          bands: [
            { orderIndex: 0, minLimit: 0, maxLimit: 95, gainPercent: 0 },
            { orderIndex: 1, minLimit: 95.01, maxLimit: 96, gainPercent: 20 },
          ],
        },
      ],
    });

    expect(cell.pending).toBe(false);
    expect(cell.weightedGainPercent).toBe(68);
    expect(cell.achievedSalaryPercent).toBe(5.6644);
  });

  it('marca celula pendente quando realizado ou parametro mensal esta ausente', () => {
    const cell = evaluateV2Cell({
      possibleSalaryPercent: 15,
      indicators: [{ code: '1', name: 'Produtividade', direction: 'HIGHER_BETTER', weight: 100, realized: null, zero: 80, target: 100, bands: [] }],
    });
    expect(cell.pending).toBe(true);
    expect(cell.achievedSalaryPercent).toBe(0);
  });

  it('aplica premio individual a partir do percentual atingido da celula', () => {
    const out = computeV2Individual({
      registration: '10',
      name: 'Teste',
      baseSalary: 3000,
      possibleSalaryPercent: 8.33,
      achievedSalaryPercent: 4.998,
      entitledDays: 30,
      events: [{ type: 'FALTA', days: 1 }],
      moderatorRules: [{ name: 'Falta', eventType: 'FALTA', criterion: 'PER_DAY', reductionPercent: 34, reductionValue: null, cap: null, cumulative: true, priority: 0 }],
      adjustments: [],
      roundingRule: 'HALF_UP_2',
    });

    expect(out.possible).toBe(249.9);
    expect(out.weightedGain).toBe(60);
    expect(out.grossValue).toBe(149.94);
    expect(out.totalReductions).toBe(50.98);
    expect(out.finalValue).toBe(98.96);
  });
});
