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
 *
 * O farol e sempre derivado do ATINGIMENTO (normalizado em torno de 1 = meta
 * cumprida, na direcao correta), nunca do desvio bruto em relacao a meta —
 * ja que o desvio bruto usa a magnitude da meta como referencia e nao e
 * comparavel entre indicadores maior-melhor e menor-melhor.
 *
 * yellowToleranceP = % MINIMO de atingimento para o farol ficar amarelo (ex.:
 * 90 = precisa de pelo menos 90% de atingimento para nao ficar vermelho).
 * Atingimento >= 100% = verde.
 */
export function calcStatus(input: StatusInput): StatusResult {
  const { value, target, direction, lowerBound, upperBound } = input;
  const tolP = input.yellowToleranceP ?? 90;

  if (value === null || value === undefined || target === null || target === undefined) {
    return { light: TrafficLight.GRAY, attainment: null, deviationAbs: null, deviationPct: null };
  }

  const deviationAbs = value - target;
  const deviationPct = target !== 0 ? (deviationAbs / Math.abs(target)) * 100 : null;

  let attainment: number | null = null;

  switch (direction) {
    case Direction.HIGHER_BETTER: {
      attainment = target !== 0 ? value / target : value >= 0 ? 1 : 0;
      break;
    }
    case Direction.LOWER_BETTER: {
      attainment =
        target !== 0
          ? Math.max(0, 2 - value / target) // 1 quando value = target, >1 quando melhor
          : value <= 0
            ? 1
            : 0;
      break;
    }
    case Direction.EQUAL_TARGET: {
      const diffPct =
        target !== 0 ? (Math.abs(value - target) / Math.abs(target)) * 100 : value === 0 ? 0 : 100;
      attainment = 1 - diffPct / 100;
      break;
    }
    case Direction.RANGE: {
      const lo = lowerBound ?? target;
      const hi = upperBound ?? target;
      if (value >= lo && value <= hi) {
        attainment = 1;
      } else {
        const dist = value < lo ? lo - value : value - hi;
        const ref = Math.max(Math.abs(lo), Math.abs(hi), 1);
        const distPct = (dist / ref) * 100;
        attainment = Math.max(0, 1 - distPct / 100);
      }
      break;
    }
  }

  const light =
    attainment === null
      ? TrafficLight.GRAY
      : attainment >= 1
        ? TrafficLight.GREEN
        : attainment >= tolP / 100
          ? TrafficLight.YELLOW
          : TrafficLight.RED;

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
