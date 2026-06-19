export function normalizeRuleKey(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function uniqueNormalized(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map(normalizeRuleKey).filter(Boolean)));
}

export function decimalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundPercent(value: number): number {
  return Math.round(value * 10000) / 10000;
}

// ===== Herança de parâmetros do indicador v1 (PrizeIndicator) para a regra v2 =====
// O usuario lanca metas/zeros/faixas em "Indicadores e faixas" (PrizeIndicator).
// A combinacao (RuleGroup) referencia o catalogo v2. Para o modelo hibrido
// (default no indicador, override na combinacao), casamos catalogo -> indicador
// v1 por platformIndicatorId, depois nome normalizado.

export interface InheritSourceLite {
  name: string;
  platformIndicatorId: string | null;
}

export function matchInherited<T extends InheritSourceLite>(catalog: InheritSourceLite, sources: T[]): T | null {
  if (catalog.platformIndicatorId) {
    const m = sources.find((s) => s.platformIndicatorId && s.platformIndicatorId === catalog.platformIndicatorId);
    if (m) return m;
  }
  const key = normalizeRuleKey(catalog.name);
  return key ? sources.find((s) => normalizeRuleKey(s.name) === key) ?? null : null;
}

/**
 * Escolhe o parametro do indicador v1 aplicavel a um (ano, mes). Para indicador
 * FIXO (ou quando ha apenas um parametro no ano), o mesmo zero/meta vale para
 * todos os meses; para VARIAVEL, casa o mes exato.
 */
export function pickInheritedParam<P extends { year: number | null; month: number | null }>(
  params: P[],
  year: number,
  month: number,
  fixed: boolean,
): P | null {
  const yearParams = params.filter((p) => p.year === year || p.year == null);
  const exact = yearParams.find((p) => p.month === month);
  if (exact) return exact;
  if (fixed && yearParams.length) return yearParams[0];
  if (yearParams.length === 1) return yearParams[0];
  return null;
}
