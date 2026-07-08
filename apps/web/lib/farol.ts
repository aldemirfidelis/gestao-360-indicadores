/**
 * Farol unificado (Épico 2 da auditoria DRY).
 *
 * A REGRA de cálculo (atingimento → verde/amarelo/vermelho) vive em
 * @g360/shared (calcStatus) e é a mesma usada pelo backend. Este módulo é o
 * único ponto do frontend com os tokens de APRESENTAÇÃO do farol (labels,
 * cores, classes). Não recalcular farol manualmente nos módulos: usar
 * calcStatus/attainmentFor daqui.
 */
import { calcStatus, Direction, TrafficLight, type StatusInput, type StatusResult } from '@g360/shared';

export { calcStatus, Direction, TrafficLight };
export type { StatusInput, StatusResult };

/** TrafficLight + BLUE (usado por telas como Reunião Mensal para "informativo"). */
export type UiLight = TrafficLight | 'BLUE';

export const LIGHT_LABEL: Record<UiLight, string> = {
  GREEN: 'Verde',
  YELLOW: 'Amarelo',
  RED: 'Vermelho',
  GRAY: 'Cinza',
  BLUE: 'Azul',
};

/** Cor sólida (hex) para gráficos/exports que não usam CSS vars. */
export const LIGHT_COLORS: Record<UiLight, string> = {
  GREEN: '#16a34a',
  YELLOW: '#d97706',
  RED: '#dc2626',
  GRAY: '#94a3b8',
  BLUE: '#2563eb',
};

/** Classes de pill/badge (borda+fundo+texto) por farol. */
export const LIGHT_STYLES: Record<UiLight, string> = {
  GREEN: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  YELLOW: 'border-amber-200 bg-amber-50 text-amber-700',
  RED: 'border-red-200 bg-red-50 text-red-700',
  GRAY: 'border-slate-200 bg-slate-50 text-slate-600',
  BLUE: 'border-blue-200 bg-blue-50 text-blue-700',
};

/**
 * Atingimento (0..1+) respeitando a DIREÇÃO do indicador — nunca usar
 * value/target direto: para "menor melhor" isso inverte o resultado
 * (ex.: meta 2 acidentes, realizado 4 → 200% em vez de 0%).
 */
export function attainmentFor(
  value: number | null | undefined,
  target: number | null | undefined,
  direction: string | null | undefined,
  opts?: { lowerBound?: number | null; upperBound?: number | null },
): number | null {
  return calcStatus({
    value,
    target,
    direction: (direction as Direction) ?? Direction.HIGHER_BETTER,
    lowerBound: opts?.lowerBound,
    upperBound: opts?.upperBound,
  }).attainment;
}

/** Farol (GREEN/YELLOW/RED/GRAY) para um realizado × meta, com a regra oficial. */
export function lightFor(
  value: number | null | undefined,
  target: number | null | undefined,
  direction: string | null | undefined,
  opts?: { lowerBound?: number | null; upperBound?: number | null; yellowToleranceP?: number },
): TrafficLight {
  return calcStatus({
    value,
    target,
    direction: (direction as Direction) ?? Direction.HIGHER_BETTER,
    lowerBound: opts?.lowerBound,
    upperBound: opts?.upperBound,
    yellowToleranceP: opts?.yellowToleranceP,
  }).light;
}
