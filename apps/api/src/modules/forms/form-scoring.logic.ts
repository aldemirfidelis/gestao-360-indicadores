/**
 * Conformidade de um preenchimento.
 *
 * O objetivo da inspeção é 100% de conformidade: se as 34 questões forem
 * "Conforme", o resultado é 100%. O número precisa ser comparável entre
 * inspeções do mesmo modelo, então:
 *
 * - "Não aplicável" NÃO entra na conta (nem no numerador nem no denominador).
 *   Uma inspeção com 30 conformes e 4 não aplicáveis é 100%, não 88%. Contar
 *   N/A como falha puniria a inspeção por um item que não existia no local.
 * - Questão não respondida também não entra: o percentual reflete o que foi
 *   avaliado, e o preenchimento incompleto é tratado pela obrigatoriedade.
 * - Só campos de avaliação contam. Texto, foto e data são registro, não nota.
 */

/** Respostas que valem como conformidade. */
const CONFORME = new Set(['conforme', 'sim', 'ok', 'c', 'aprovado', 'true', 'yes', '1']);

/** Respostas que valem como desvio. */
const NAO_CONFORME = new Set([
  'nao conforme', 'não conforme', 'nao_conforme', 'não_conforme', 'nc', 'nok',
  'nao', 'não', 'no', 'reprovado', 'false', '0',
]);

/** Respostas que tiram o item da conta. */
const NAO_APLICAVEL = new Set([
  'nao aplicavel', 'não aplicável', 'nao_aplicavel', 'não_aplicável',
  'n/a', 'na', 'nao se aplica', 'não se aplica',
]);

/** Tipos de campo que representam avaliação (o resto é registro). */
const TIPOS_AVALIAVEIS = new Set(['CONFORMITY', 'YES_NO', 'BOOLEAN']);

export type ConformityVerdict = 'CONFORME' | 'NAO_CONFORME' | 'NAO_APLICAVEL' | 'IGNORADO';

export interface ScorableAnswer {
  fieldType?: string | null;
  value?: string | null;
  /** Peso do item; itens críticos costumam pesar mais. Padrão 1. */
  weight?: number | null;
}

export interface ConformityResult {
  /** 0 a 100, com uma casa decimal. `null` quando não houve item avaliável. */
  percent: number | null;
  conformes: number;
  naoConformes: number;
  naoAplicaveis: number;
  /** Itens que entraram na conta (conformes + não conformes). */
  avaliados: number;
  /** Soma dos pesos dos conformes / soma dos pesos avaliados. */
  pesoConforme: number;
  pesoAvaliado: number;
}

function normalize(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Classifica uma resposta. Campo que não é de avaliação é sempre IGNORADO. */
export function classifyAnswer(answer: ScorableAnswer): ConformityVerdict {
  const type = String(answer.fieldType ?? '').toUpperCase();
  if (!TIPOS_AVALIAVEIS.has(type)) return 'IGNORADO';

  const value = normalize(answer.value);
  if (!value) return 'IGNORADO';
  if (NAO_APLICAVEL.has(value)) return 'NAO_APLICAVEL';
  if (NAO_CONFORME.has(value)) return 'NAO_CONFORME';
  if (CONFORME.has(value)) return 'CONFORME';
  // Valor fora do vocabulário: não inventa veredito.
  return 'IGNORADO';
}

/** Percentual de conformidade do preenchimento. */
export function conformityScore(answers: ScorableAnswer[]): ConformityResult {
  let conformes = 0;
  let naoConformes = 0;
  let naoAplicaveis = 0;
  let pesoConforme = 0;
  let pesoAvaliado = 0;

  for (const answer of answers) {
    const peso = Number.isFinite(Number(answer.weight)) && Number(answer.weight) > 0 ? Number(answer.weight) : 1;
    switch (classifyAnswer(answer)) {
      case 'CONFORME':
        conformes += 1;
        pesoConforme += peso;
        pesoAvaliado += peso;
        break;
      case 'NAO_CONFORME':
        naoConformes += 1;
        pesoAvaliado += peso;
        break;
      case 'NAO_APLICAVEL':
        naoAplicaveis += 1;
        break;
      default:
        break;
    }
  }

  const avaliados = conformes + naoConformes;
  const percent = pesoAvaliado > 0 ? Math.round((pesoConforme / pesoAvaliado) * 1000) / 10 : null;
  return { percent, conformes, naoConformes, naoAplicaveis, avaliados, pesoConforme, pesoAvaliado };
}

/** Resumo curto para cabeçalho de relatório: "97,1% — 33 de 34 conformes". */
export function conformitySummary(result: ConformityResult): string {
  if (result.percent === null) return 'Sem itens avaliáveis';
  const percent = result.percent.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  const naoAplicavel = result.naoAplicaveis > 0 ? ` · ${result.naoAplicaveis} não aplicável${result.naoAplicaveis > 1 ? 'is' : ''}` : '';
  return `${percent}% — ${result.conformes} de ${result.avaliados} conformes${naoAplicavel}`;
}
