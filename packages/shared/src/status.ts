import { Direction, TrafficLight } from './enums';

export interface StatusInput {
  value: number | null | undefined;
  target: number | null | undefined;
  direction: Direction;
  lowerBound?: number | null;
  upperBound?: number | null;
  /** tolerancia para amarelo, em pontos percentuais (default 10) */
  yellowToleranceP?: number;
}

export interface StatusResult {
  light: TrafficLight;
  attainment: number | null; // 0..1+
  deviationAbs: number | null;
  deviationPct: number | null;
}

/**
 * Calcula farol (verde/amarelo/vermelho/cinza), atingimento e desvios
 * a partir do realizado x meta. Regra estavel para uso no backend e no front.
 */
export function calcStatus(input: StatusInput): StatusResult {
  const { value, target, direction, lowerBound, upperBound } = input;
  const tolP = input.yellowToleranceP ?? 10;

  if (value === null || value === undefined || target === null || target === undefined) {
    return { light: TrafficLight.GRAY, attainment: null, deviationAbs: null, deviationPct: null };
  }

  const deviationAbs = value - target;
  const deviationPct = target !== 0 ? (deviationAbs / Math.abs(target)) * 100 : null;

  let attainment: number | null = null;
  let light: TrafficLight = TrafficLight.GRAY;

  switch (direction) {
    case Direction.HIGHER_BETTER: {
      attainment = target !== 0 ? value / target : value >= 0 ? 1 : 0;
      if (value >= target) light = TrafficLight.GREEN;
      else if (deviationPct !== null && deviationPct >= -tolP) light = TrafficLight.YELLOW;
      else light = TrafficLight.RED;
      break;
    }
    case Direction.LOWER_BETTER: {
      attainment =
        target !== 0
          ? Math.max(0, 2 - value / target) // 1 quando value = target, >1 quando melhor
          : value <= 0
            ? 1
            : 0;
      if (value <= target) light = TrafficLight.GREEN;
      else if (deviationPct !== null && deviationPct <= tolP) light = TrafficLight.YELLOW;
      else light = TrafficLight.RED;
      break;
    }
    case Direction.EQUAL_TARGET: {
      const diffPct =
        target !== 0 ? (Math.abs(value - target) / Math.abs(target)) * 100 : value === 0 ? 0 : 100;
      attainment = 1 - diffPct / 100;
      if (diffPct <= tolP / 2) light = TrafficLight.GREEN;
      else if (diffPct <= tolP) light = TrafficLight.YELLOW;
      else light = TrafficLight.RED;
      break;
    }
    case Direction.RANGE: {
      const lo = lowerBound ?? target;
      const hi = upperBound ?? target;
      if (value >= lo && value <= hi) {
        light = TrafficLight.GREEN;
        attainment = 1;
      } else {
        const dist = value < lo ? lo - value : value - hi;
        const ref = Math.max(Math.abs(lo), Math.abs(hi), 1);
        const distPct = (dist / ref) * 100;
        attainment = Math.max(0, 1 - distPct / 100);
        light = distPct <= tolP ? TrafficLight.YELLOW : TrafficLight.RED;
      }
      break;
    }
  }

  return { light, attainment, deviationAbs, deviationPct };
}

export function trafficLightToCssVar(light: TrafficLight): string {
  switch (light) {
    case TrafficLight.GREEN:
      return 'var(--status-green)';
    case TrafficLight.YELLOW:
      return 'var(--status-yellow)';
    case TrafficLight.RED:
      return 'var(--status-red)';
    default:
      return 'var(--status-gray)';
  }
}
