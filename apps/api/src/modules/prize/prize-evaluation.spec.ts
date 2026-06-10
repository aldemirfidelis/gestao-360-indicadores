import { describe, it, expect } from 'vitest';
import { evaluateActual, selectRangesForParameter } from './prize-evaluation';

describe('selectRangesForParameter — faixas por competência (indicador mensal)', () => {
  const ranges = [
    { parameterId: 'jan', orderIndex: 0, gainPercent: 0 },
    { parameterId: 'jan', orderIndex: 1, gainPercent: 100 },
    { parameterId: 'fev', orderIndex: 0, gainPercent: 0 },
    { parameterId: 'fev', orderIndex: 1, gainPercent: 100 },
  ];
  it('usa só as faixas do parâmetro ativo', () => {
    expect(selectRangesForParameter(ranges, 'jan').every((r) => r.parameterId === 'jan')).toBe(true);
    expect(selectRangesForParameter(ranges, 'fev')).toHaveLength(2);
  });
  it('indicador fixo (faixas globais sem parameterId) ignora o parâmetro', () => {
    const globals = [{ parameterId: null, orderIndex: 0 }, { orderIndex: 1 }];
    expect(selectRangesForParameter(globals, 'jan')).toHaveLength(2);
  });
  it('sem faixas do parâmetro ativo cai nas globais', () => {
    const mixed = [{ parameterId: null, orderIndex: 0 }, { parameterId: 'jan', orderIndex: 1 }];
    expect(selectRangesForParameter(mixed, 'mar')).toEqual([{ parameterId: null, orderIndex: 0 }]);
  });
});

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

  // ---- Extrapolação (regra das planilhas FaixaAtingida/modRealizadosFaixas) ----
  const faixasPlanilha = [
    { orderIndex: 0, minLimit: 0, maxLimit: 95, achievementPercent: 0, gainPercent: 0 },
    { orderIndex: 1, minLimit: 95.01, maxLimit: 96, achievementPercent: 20, gainPercent: 20 },
    { orderIndex: 5, minLimit: 99.01, maxLimit: 100, achievementPercent: 100, gainPercent: 100 },
  ];

  it('extrapolação acima de todas as faixas atinge o TOPO (maior melhor)', () => {
    const r = evaluateActual(103.5, { target: 100, zero: 95 }, faixasPlanilha, 'HIGHER_BETTER');
    expect(r.gainPercent).toBe(100);
  });

  it('extrapolação abaixo de todas as faixas cai na faixa ZERO (maior melhor)', () => {
    const r = evaluateActual(-2, { target: 100, zero: 95 }, faixasPlanilha, 'HIGHER_BETTER');
    expect(r.gainPercent).toBe(0);
  });

  it('quanto menor melhor: extrapolar para baixo atinge o TOPO; para cima, a ZERO', () => {
    const faixasMenor = [
      { orderIndex: 0, minLimit: 20, maxLimit: null, achievementPercent: 0, gainPercent: 0 }, // pior: acima do zero
      { orderIndex: 1, minLimit: 15.01, maxLimit: 19.99, achievementPercent: 50, gainPercent: 50 },
      { orderIndex: 2, minLimit: 10, maxLimit: 15, achievementPercent: 100, gainPercent: 100 }, // melhor: na meta
    ];
    const melhor = evaluateActual(5, { target: 10, zero: 20 }, faixasMenor, 'LOWER_BETTER');
    expect(melhor.gainPercent).toBe(100);
    // valor entre faixas (gap) acima do máximo pagante e abaixo do min da faixa 0 -> pior faixa
    const pior = evaluateActual(19.995, { target: 10, zero: 20 }, faixasMenor, 'LOWER_BETTER');
    expect(pior.gainPercent).toBe(0);
  });

  it('com faixas cadastradas NÃO interpola: valor dentro da faixa paga o % da faixa', () => {
    const r = evaluateActual(95.5, { target: 100, zero: 95 }, faixasPlanilha, 'HIGHER_BETTER');
    expect(r.gainPercent).toBe(20); // degrau da faixa 1, não interpolação
  });
});
