import { describe, expect, it } from 'vitest';
import { suggestRanges } from './prize-ranges.util';

describe('suggestRanges — gerador do modelo oficial (planilha de faixas)', () => {
  it('GOLDEN planilha: zero 95, meta 100, 6 faixas (maior melhor) — números exatos do Base_SE', () => {
    const r = suggestRanges({ zero: 95, target: 100, direction: 'HIGHER_BETTER', count: 6, decimals: 2 });
    expect(r).toEqual([
      { orderIndex: 0, minLimit: 0, maxLimit: 95, achievementPercent: 0, gainPercent: 0 },
      { orderIndex: 1, minLimit: 95.01, maxLimit: 96, achievementPercent: 20, gainPercent: 20 },
      { orderIndex: 2, minLimit: 96.01, maxLimit: 97, achievementPercent: 40, gainPercent: 40 },
      { orderIndex: 3, minLimit: 97.01, maxLimit: 98, achievementPercent: 60, gainPercent: 60 },
      { orderIndex: 4, minLimit: 98.01, maxLimit: 99, achievementPercent: 80, gainPercent: 80 },
      { orderIndex: 5, minLimit: 99.01, maxLimit: 100, achievementPercent: 100, gainPercent: 100 },
    ]);
  });

  it('quanto menor melhor: faixa 0 aberta acima do zero; topo cobre a meta', () => {
    const r = suggestRanges({ zero: 20, target: 10, direction: 'LOWER_BETTER', count: 3, decimals: 2 });
    // passo = (20−10)/2 = 5
    expect(r[0]).toEqual({ orderIndex: 0, minLimit: 20, maxLimit: null, achievementPercent: 0, gainPercent: 0 });
    expect(r[2]).toEqual({ orderIndex: 2, minLimit: 10, maxLimit: 14.99, achievementPercent: 100, gainPercent: 100 });
    expect(r[1]).toEqual({ orderIndex: 1, minLimit: 15, maxLimit: 19.99, achievementPercent: 50, gainPercent: 50 });
  });

  it('faixas cobrem o intervalo sem sobreposição (degraus contíguos)', () => {
    const r = suggestRanges({ zero: 80, target: 100, direction: 'HIGHER_BETTER', count: 5, decimals: 2 });
    for (let i = 2; i < r.length; i++) {
      expect((r[i].minLimit as number) > (r[i - 1].maxLimit as number)).toBe(true);
      expect(Math.round(((r[i].minLimit as number) - (r[i - 1].maxLimit as number)) * 100) / 100).toBe(0.01);
    }
    expect(r[r.length - 1].maxLimit).toBe(100);
  });

  it('valida sentido, contagem e diferença insuficiente', () => {
    expect(() => suggestRanges({ zero: 100, target: 95, direction: 'HIGHER_BETTER', count: 4 })).toThrow(/Meta deve ser maior/);
    expect(() => suggestRanges({ zero: 10, target: 20, direction: 'LOWER_BETTER', count: 4 })).toThrow(/Meta deve ser menor/);
    expect(() => suggestRanges({ zero: 95, target: 100, direction: 'HIGHER_BETTER', count: 7 })).toThrow(/entre 2 e 6/);
    expect(() => suggestRanges({ zero: 99.99, target: 100, direction: 'HIGHER_BETTER', count: 6, decimals: 2 })).toThrow(/insuficiente/);
  });
});
