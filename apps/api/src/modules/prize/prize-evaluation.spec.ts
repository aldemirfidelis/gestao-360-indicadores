import { describe, it, expect } from 'vitest';
import { evaluateActual } from './prize-evaluation';

describe('evaluateActual — Previsto x Realizado', () => {
  it('sem realizado retorna hasActual=false', () => {
    const r = evaluateActual(null, { target: 100, zero: 50 }, []);
    expect(r.hasActual).toBe(false);
    expect(r.achievementPercent).toBeNull();
    expect(r.onTarget).toBeNull();
  });

  it('interpola linearmente entre zero (0%) e meta (100%)', () => {
    // zero=50, meta=100, realizado=75 => 50% do caminho
    const r = evaluateActual(75, { target: 100, zero: 50 }, []);
    expect(r.achievementPercent).toBe(50);
    expect(r.onTarget).toBe(false);
    expect(r.deviation).toBe(-25);
  });

  it('atinge a meta => 100% e onTarget=true', () => {
    const r = evaluateActual(100, { target: 100, zero: 50 }, []);
    expect(r.achievementPercent).toBe(100);
    expect(r.onTarget).toBe(true);
    expect(r.deviation).toBe(0);
  });

  it('usa a faixa que contém o realizado (achievement e gain da faixa)', () => {
    const ranges = [
      { orderIndex: 0, minLimit: 0, maxLimit: 79.99, achievementPercent: 0, gainPercent: 0 },
      { orderIndex: 1, minLimit: 80, maxLimit: 99.99, achievementPercent: 80, gainPercent: 50 },
      { orderIndex: 2, minLimit: 100, maxLimit: null, achievementPercent: 100, gainPercent: 100 },
    ];
    const r = evaluateActual(95, { target: 100, zero: 80 }, ranges);
    expect(r.achievementPercent).toBe(80);
    expect(r.gainPercent).toBe(50);
    expect(r.rangeLabel).toBe('[80 a 99.99]');
    expect(r.onTarget).toBe(false);
  });

  it('faixa aberta superior (sem maxLimit) cobre valores altos', () => {
    const ranges = [{ orderIndex: 2, minLimit: 100, maxLimit: null, achievementPercent: 120, gainPercent: 110 }];
    const r = evaluateActual(150, { target: 100, zero: 0 }, ranges);
    expect(r.achievementPercent).toBe(120);
    expect(r.onTarget).toBe(true);
  });

  it('calcula desvio percentual relativo à meta', () => {
    const r = evaluateActual(90, { target: 100, zero: 0 }, []);
    expect(r.deviationPercent).toBe(-10);
  });
});
