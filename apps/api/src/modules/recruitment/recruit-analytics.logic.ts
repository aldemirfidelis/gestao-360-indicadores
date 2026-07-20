/**
 * Cálculos puros do dashboard de Analytics do funil de recrutamento — separados do
 * service (que só busca dados) para serem testados isoladamente, mesmo padrão dos
 * demais `*.logic.ts` do módulo.
 */

/** Ordem canônica das etapas do pipeline (independe do template de cada vaga). */
export const STAGE_TYPE_ORDER = ['STANDARD', 'ELIMINATORY', 'INTERVIEW', 'ASSESSMENT', 'OFFER', 'PREHIRE', 'FINAL'] as const;
export type StageType = (typeof STAGE_TYPE_ORDER)[number];

export function diffDays(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

export function average(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
}

/** Agrupa candidaturas ativas por tipo de etapa (funil cross-vaga, já que cada vaga pode ter nomes de etapa diferentes). */
export function buildFunnelByStageType(items: Array<{ stageType: string | null }>): Array<{ stageType: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const type = item.stageType && (STAGE_TYPE_ORDER as readonly string[]).includes(item.stageType) ? item.stageType : 'SEM_ETAPA';
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  const ordered = [...STAGE_TYPE_ORDER, 'SEM_ETAPA'].filter((t) => counts.has(t));
  return ordered.map((stageType) => ({ stageType, count: counts.get(stageType) ?? 0 }));
}

/** Agrupa por uma chave string genérica (origem, motivo etc.), ordenado por contagem decrescente. */
export function groupCount<T>(items: T[], keyOf: (item: T) => string): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item) || 'OUTROS';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

/** Requisições/candidaturas "paradas" além do limite (SLA da requisição ou um padrão). */
export function countStale(items: Array<{ referenceDate: Date; limitDays: number | null }>, now: Date, defaultLimitDays: number): number {
  return items.filter((item) => diffDays(now, item.referenceDate) > (item.limitDays ?? defaultLimitDays)).length;
}
