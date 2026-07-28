/**
 * Da inspeção para o indicador.
 *
 * Regra do usuário: na área Agrícola, setor Colheita Mecanizada, existem 10
 * frentes de serviço e são feitas 10 inspeções ISSMA. O valor do indicador
 * "CONF. ISSMA Colheita Mecanizada" no mês é a MÉDIA ARITMÉTICA simples:
 *
 *     soma dos percentuais de conformidade / quantidade de inspeções
 *
 * Cada inspeção pesa igual, independente de quantas questões teve — 10 frentes
 * inspecionadas são 10 medições do mesmo processo. Ponderar por número de
 * questões faria uma frente com checklist maior valer mais que outra, o que não
 * é o que a área mede.
 */

export interface SubmissionForIndicator {
  id: string;
  /** Setor (nó mais específico da árvore) onde a inspeção foi feita. */
  orgNodeId: string | null;
  templateId: string;
  /** Percentual de conformidade do preenchimento (0-100). */
  score: number | null;
  /** Data que define a competência (mês) da medição. */
  completedAt: Date | string | null;
}

export interface IndicatorGroupKey {
  orgNodeId: string;
  templateId: string;
  /** Competência no formato AAAA-MM. */
  competence: string;
}

export interface IndicatorGroup extends IndicatorGroupKey {
  /** Média dos percentuais, com uma casa decimal. */
  value: number;
  /** Quantas inspeções entraram na média (o "dividido por 10"). */
  count: number;
  submissionIds: string[];
}

/** Competência AAAA-MM de uma data, em UTC. */
export function competenceOf(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const value = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(value.getTime())) return null;
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Agrupa preenchimentos por (setor, formulário, mês) e calcula a média.
 *
 * Fica de fora o que não é medição: inspeção sem percentual (nenhum item
 * avaliável), sem setor (não há a qual indicador de área somar) ou sem data de
 * conclusão (não há competência).
 */
export function groupForIndicator(submissions: SubmissionForIndicator[]): IndicatorGroup[] {
  const buckets = new Map<string, { key: IndicatorGroupKey; scores: number[]; ids: string[] }>();

  for (const submission of submissions) {
    if (submission.score === null || submission.score === undefined) continue;
    if (!submission.orgNodeId) continue;
    const competence = competenceOf(submission.completedAt);
    if (!competence) continue;

    const mapKey = `${submission.orgNodeId}|${submission.templateId}|${competence}`;
    const bucket = buckets.get(mapKey) ?? {
      key: { orgNodeId: submission.orgNodeId, templateId: submission.templateId, competence },
      scores: [],
      ids: [],
    };
    bucket.scores.push(submission.score);
    bucket.ids.push(submission.id);
    buckets.set(mapKey, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      ...bucket.key,
      value: round1(bucket.scores.reduce((total, score) => total + score, 0) / bucket.scores.length),
      count: bucket.scores.length,
      submissionIds: bucket.ids,
    }))
    .sort((a, b) => a.competence.localeCompare(b.competence) || a.orgNodeId.localeCompare(b.orgNodeId));
}

/** Média de um conjunto de inspeções já filtrado. */
export function averageConformity(scores: Array<number | null | undefined>): number | null {
  const valid = scores.filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
  if (valid.length === 0) return null;
  return round1(valid.reduce((total, score) => total + score, 0) / valid.length);
}

/** Primeiro e último instante da competência, para gravar a medição no mês. */
export function competenceRange(competence: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(competence);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return {
    start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
