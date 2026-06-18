// Tipos compartilhados da seção de Combinações (Anexos e Regras).
// Espelham as respostas de /prize/rules/* (PrizeRuleGroup → RuleIndicator →
// RuleParameter → RuleBand) e o catálogo de indicadores do prêmio.

export interface CatalogIndicator {
  id: string;
  code: string;
  bscNumber: string | null;
  name: string;
  description: string | null;
  unit: string | null;
  direction: string;
  source: string;
  platformIndicatorId: string | null;
  active: boolean;
  _count?: { ruleIndicators: number; actuals: number };
}

export interface RuleBand {
  id: string;
  orderIndex: number;
  minLimit: string | null;
  maxLimit: string | null;
  achievementPercent: string | null;
  gainPercent: string | null;
}

export interface RuleParameter {
  id: string;
  year: number;
  month: number;
  zero: string | null;
  target: string | null;
  bands: RuleBand[];
}

export interface InheritedParam {
  year: number | null;
  month: number | null;
  zero: string | null;
  target: string | null;
}

export interface InheritedDefaults {
  sourceId: string;
  params: InheritedParam[];
  ranges: RuleBand[];
}

export interface RuleIndicator {
  id: string;
  catalogId: string;
  weight: string;
  kind: string;
  type: string;
  validityKind: string;
  startMonth: number;
  monthsCount: number;
  sortOrder: number;
  active: boolean;
  catalog: CatalogIndicator;
  parameters: RuleParameter[];
  inherited?: InheritedDefaults | null;
}

/** Escolhe o parâmetro v1 herdado para um mês (Fixo usa o único; Variável casa o mês). */
export function pickInherited(inherited: InheritedDefaults | null | undefined, year: number, month: number, fixed: boolean): InheritedParam | null {
  if (!inherited) return null;
  const yearParams = inherited.params.filter((p) => p.year === year || p.year == null);
  const exact = yearParams.find((p) => p.month === month);
  if (exact) return exact;
  if (fixed && yearParams.length) return yearParams[0];
  if (yearParams.length === 1) return yearParams[0];
  return null;
}

export interface RuleGroup {
  id: string;
  annexVersionId: string;
  name: string;
  areaRefs: string[];
  positionRefs: string[];
  normalizedAreaKeys: string[];
  normalizedPositionKeys: string[];
  salaryPercent: string;
  notes: string | null;
  active: boolean;
  indicators: RuleIndicator[];
}

export interface PlatformIndicatorRef {
  id: string;
  name: string;
  code: string | null;
  unit: string | null;
  direction: string;
  bscNumber: string | null;
}

export interface OrgNodeRef {
  id: string;
  name: string;
  type: string;
}

export const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const RULE_TYPE: Record<string, string> = { FIXED: 'Fixo', VARIABLE: 'Variável' };
export const VALIDITY_KIND: Record<string, string> = { CALENDAR_YEAR: 'Ano civil', CROP_YEAR: 'Ano-safra' };
export const DIRECTION_PT: Record<string, string> = { HIGHER_BETTER: 'Maior melhor', LOWER_BETTER: 'Menor melhor', TARGET: 'Alvo exato' };
