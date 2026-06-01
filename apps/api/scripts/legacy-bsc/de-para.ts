/**
 * Tabelas De-Para: traduzem os valores do BSC legado para os enums do gestao-360.
 *
 * Os valores "brutos" abaixo sao HIPOTESES baseadas na tela do app. Apos rodar a
 * introspeccao (introspect.ts) e ver os valores reais nas colunas do SQL Server,
 * ajuste os mapas. O objetivo e que NENHUM valor caia silenciosamente no default:
 * cada funcao registra o que nao reconheceu, para revisarmos no preview.
 */

import { Direction, IndicatorUnit, Periodicity } from '@prisma/client';

/** Coleta valores brutos nao mapeados, para relatorio no preview. */
export const unmapped = {
  unit: new Set<string>(),
  direction: new Set<string>(),
  periodicity: new Set<string>(),
};

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Unidade. O BSC usa rotulos livres (r$/t, r$/ha, l/h, %, ...). Preservamos o
 * rotulo original em `unitLabel` e classificamos no enum quando possivel.
 */
export function mapUnit(raw: string | null | undefined): {
  unit: IndicatorUnit;
  unitLabel: string | null;
} {
  const label = raw?.trim() || null;
  if (!label) return { unit: IndicatorUnit.CUSTOM, unitLabel: null };
  const n = norm(label);

  if (n === '%' || n.includes('percent')) return { unit: IndicatorUnit.PERCENT, unitLabel: label };
  if (n.startsWith('r$') || n.includes('reais') || n.includes('custo'))
    return { unit: IndicatorUnit.CURRENCY, unitLabel: label };
  if (n === 'h' || n.includes('hora')) return { unit: IndicatorUnit.HOURS, unitLabel: label };
  if (n.includes('dia')) return { unit: IndicatorUnit.DAYS, unitLabel: label };
  if (n === 't' || n.includes('tonel')) return { unit: IndicatorUnit.TONS, unitLabel: label };
  if (n === 'l' || n.startsWith('l/') || n.includes('litro'))
    return { unit: IndicatorUnit.LITERS, unitLabel: label };
  if (n.includes('indice') || n.includes('index'))
    return { unit: IndicatorUnit.INDEX, unitLabel: label };

  // Qualquer outra coisa (l/h, r$/ha ja caem em CURRENCY/LITERS acima): preserva rotulo.
  return { unit: IndicatorUnit.CUSTOM, unitLabel: label };
}

/**
 * Cardinalidade -> Direction. Na tela: "Maior Melhor", "Menor Melhor",
 * "Proximo Melhor". No banco provavelmente e um codigo (1/2/3) ou texto.
 * TODO(introspeccao): confirmar os valores reais da coluna de cardinalidade.
 */
const DIRECTION_MAP: Record<string, Direction> = {
  // texto
  'maior melhor': Direction.HIGHER_BETTER,
  'menor melhor': Direction.LOWER_BETTER,
  'proximo melhor': Direction.EQUAL_TARGET,
  // codigos numericos provaveis (AJUSTAR apos introspeccao)
  '1': Direction.HIGHER_BETTER,
  '2': Direction.LOWER_BETTER,
  '3': Direction.EQUAL_TARGET,
};

export function mapDirection(raw: string | number | null | undefined): Direction {
  if (raw === null || raw === undefined) return Direction.HIGHER_BETTER;
  const key = norm(String(raw));
  const hit = DIRECTION_MAP[key];
  if (!hit) {
    unmapped.direction.add(String(raw));
    return Direction.HIGHER_BETTER; // default seguro; sera sinalizado no preview
  }
  return hit;
}

/**
 * Periodicidade. As abas do BSC sao Mensal / Semanal / Diario.
 * TODO(introspeccao): confirmar como a periodicidade e representada (coluna,
 * tabela separada por granularidade, ou flag).
 */
const PERIODICITY_MAP: Record<string, Periodicity> = {
  mensal: Periodicity.MONTHLY,
  m: Periodicity.MONTHLY,
  semanal: Periodicity.WEEKLY,
  s: Periodicity.WEEKLY,
  diario: Periodicity.DAILY,
  d: Periodicity.DAILY,
  anual: Periodicity.ANNUAL,
  a: Periodicity.ANNUAL,
};

export function mapPeriodicity(raw: string | null | undefined): Periodicity {
  if (!raw) return Periodicity.MONTHLY;
  const hit = PERIODICITY_MAP[norm(raw)];
  if (!hit) {
    unmapped.periodicity.add(raw);
    return Periodicity.MONTHLY;
  }
  return hit;
}

/** Numero "pt-BR" (1.234,56) ou ja numerico -> number | null. */
export function parseDecimal(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
