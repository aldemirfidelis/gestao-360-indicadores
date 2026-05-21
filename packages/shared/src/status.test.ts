import { describe, expect, it } from 'vitest';
import { calcStatus } from './status';
import { Direction, TrafficLight } from './enums';

describe('calcStatus', () => {
  it('retorna GRAY quando faltam dados', () => {
    expect(calcStatus({ value: null, target: 100, direction: Direction.HIGHER_BETTER }).light).toBe(
      TrafficLight.GRAY,
    );
  });

  it('HIGHER_BETTER: verde quando bate ou supera meta', () => {
    const s = calcStatus({ value: 110, target: 100, direction: Direction.HIGHER_BETTER });
    expect(s.light).toBe(TrafficLight.GREEN);
    expect(s.attainment).toBeCloseTo(1.1);
  });

  it('HIGHER_BETTER: amarelo quando ate 10% abaixo', () => {
    const s = calcStatus({ value: 95, target: 100, direction: Direction.HIGHER_BETTER });
    expect(s.light).toBe(TrafficLight.YELLOW);
  });

  it('HIGHER_BETTER: vermelho quando mais de 10% abaixo', () => {
    const s = calcStatus({ value: 80, target: 100, direction: Direction.HIGHER_BETTER });
    expect(s.light).toBe(TrafficLight.RED);
  });

  it('LOWER_BETTER: verde quando abaixo da meta', () => {
    const s = calcStatus({ value: 80, target: 100, direction: Direction.LOWER_BETTER });
    expect(s.light).toBe(TrafficLight.GREEN);
  });

  it('LOWER_BETTER: vermelho quando muito acima', () => {
    const s = calcStatus({ value: 130, target: 100, direction: Direction.LOWER_BETTER });
    expect(s.light).toBe(TrafficLight.RED);
  });

  it('RANGE: verde dentro do intervalo', () => {
    const s = calcStatus({
      value: 50,
      target: 50,
      direction: Direction.RANGE,
      lowerBound: 40,
      upperBound: 60,
    });
    expect(s.light).toBe(TrafficLight.GREEN);
  });
});
