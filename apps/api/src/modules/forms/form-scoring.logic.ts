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
 *
 * ## Lista de opções também é avaliação
 *
 * Muito checklist real (ISSMA, por exemplo) é montado com campo de SELEÇÃO cujas
 * opções são "Conforme / Não Conforme / Não se Aplica" — o autor não usou o tipo
 * "Conformidade", mas a pergunta é de conformidade do mesmo jeito. Exigir o tipo
 * certo faria a inspeção inteira sair como "sem itens avaliáveis" e o indicador
 * nunca receber a média.
 *
 * Então SELECT/RADIO/STATUS também contam, porém só com o vocabulário ESTRITO de
 * conformidade (conforme / não conforme / não aplicável e abreviações). Uma lista
 * de "IG, ST, GE, RE" ou de "Sim, Não" continua fora: sem a palavra explícita, não
 * dá para afirmar que aquilo é um julgamento de conformidade.
 *
 * ## Nota por pergunta
 *
 * O autor pode dar uma nota a cada pergunta ("esta vale 30"). Nem toda pergunta
 * precisa de nota — há itens que se verifica mas não se pontua. Daí a regra ser
 * do MODELO, e não da pergunta isolada:
 *
 * - **Nenhuma pergunta tem nota** → todas valem igual, e o resultado é o
 *   percentual de itens conformes. É o checklist comum, e o comportamento de
 *   sempre.
 * - **Alguma pergunta tem nota** → o checklist é pontuado, e só as perguntas
 *   COM nota entram no resultado. As sem nota continuam sendo respondidas e
 *   registradas; apenas não somam nem subtraem pontos.
 *
 * Sem essa regra, uma pergunta deixada em branco num checklist pontuado valeria
 * 1 ponto escondido — diluindo as notas que o autor escreveu.
 */

/** Palavras que são conformidade em qualquer contexto. */
const CONFORME_ESTRITO = ['conforme', 'c', 'aprovado'];

/** Palavras que são desvio em qualquer contexto. */
const NAO_CONFORME_ESTRITO = [
  'nao conforme', 'não conforme', 'nao_conforme', 'não_conforme', 'nc', 'nok', 'reprovado',
];

/** Respostas que valem como conformidade. */
const CONFORME = new Set([...CONFORME_ESTRITO, 'sim', 'ok', 'true', 'yes', '1']);

/** Respostas que valem como desvio. */
const NAO_CONFORME = new Set([...NAO_CONFORME_ESTRITO, 'nao', 'não', 'no', 'false', '0']);

/** Respostas que tiram o item da conta. */
const NAO_APLICAVEL = new Set([
  'nao aplicavel', 'não aplicável', 'nao_aplicavel', 'não_aplicável',
  'n/a', 'na', 'nao se aplica', 'não se aplica',
]);

/** Tipos de campo que representam avaliação (o resto é registro). */
const TIPOS_AVALIAVEIS = new Set(['CONFORMITY', 'YES_NO', 'BOOLEAN']);

/**
 * Listas de opção: entram na conta só quando a resposta é uma palavra de
 * conformidade. "Sim"/"Não" numa lista genérica fica de fora de propósito — em
 * campo CONFORMITY/YES_NO o autor declarou que é avaliação; numa lista qualquer,
 * não.
 */
const TIPOS_LISTA = new Set(['SELECT', 'RADIO', 'STATUS']);
const CONFORME_LISTA = new Set(CONFORME_ESTRITO);
const NAO_CONFORME_LISTA = new Set(NAO_CONFORME_ESTRITO);

export type ConformityVerdict = 'CONFORME' | 'NAO_CONFORME' | 'NAO_APLICAVEL' | 'IGNORADO';

export interface ScorableAnswer {
  fieldType?: string | null;
  value?: string | null;
  /** Nota da pergunta. `null`/ausente = pergunta sem nota. */
  weight?: number | null;
  /** Item marcado como crítico no modelo. */
  critical?: boolean | null;
}

/** A pergunta tem nota? (número positivo; em branco ou zero é "sem nota") */
export function hasNote(weight?: number | null): boolean {
  const parsed = Number(weight);
  return Number.isFinite(parsed) && parsed > 0;
}

/** Nota da pergunta, ou `null` quando ela não tem nota. */
export function noteOf(weight?: number | null): number | null {
  return hasNote(weight) ? Number(weight) : null;
}

/**
 * Quanto o item pesa na conta.
 *
 * Com nota, vale a nota. Sem nota (checklist não pontuado, em que todos valem
 * igual), o item crítico pesa 3 — comportamento antigo, quando "crítico" era a
 * única forma de um item pesar mais. Os dois juntos fariam um crítico de nota
 * 30 valer 90 sem ninguém ter pedido.
 */
export function effectiveWeight(weight?: number | null, critical?: boolean | null): number {
  const nota = noteOf(weight);
  if (nota !== null) return nota;
  return critical ? 3 : 1;
}

/** O checklist é pontuado? (alguma pergunta recebeu nota) */
export function isScoredSheet(answers: ScorableAnswer[]): boolean {
  return answers.some((answer) => hasNote(answer.weight));
}

/** Resultado de um item, na ordem em que ele foi respondido. */
export interface ScoredItem {
  /** Pontos obtidos, ou `null` quando o item não disputa pontos. */
  points: number | null;
  /** Nota congelada do item, ou `null` quando a pergunta não tem nota. */
  note: number | null;
  verdict: ConformityVerdict;
  /** Ficou de fora por não ter nota num checklist pontuado. */
  outOfScore: boolean;
}

export interface ConformityResult {
  /** 0 a 100, com uma casa decimal. `null` quando não houve item avaliável. */
  percent: number | null;
  conformes: number;
  naoConformes: number;
  naoAplicaveis: number;
  /** Itens que entraram na conta (conformes + não conformes). */
  avaliados: number;
  /** Pontos obtidos (soma das notas dos conformes). */
  pesoConforme: number;
  /** Pontos em disputa (soma das notas dos itens avaliados). */
  pesoAvaliado: number;
  /** O autor pontuou este checklist? (define se a tela fala de pontos) */
  usaNotas: boolean;
  /** Perguntas respondidas que ficaram fora do resultado por não ter nota. */
  semNota: number;
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
  const avaliavel = TIPOS_AVALIAVEIS.has(type);
  const lista = TIPOS_LISTA.has(type);
  if (!avaliavel && !lista) return 'IGNORADO';

  const value = normalize(answer.value);
  if (!value) return 'IGNORADO';
  if (NAO_APLICAVEL.has(value)) return 'NAO_APLICAVEL';
  if ((avaliavel ? NAO_CONFORME : NAO_CONFORME_LISTA).has(value)) return 'NAO_CONFORME';
  if ((avaliavel ? CONFORME : CONFORME_LISTA).has(value)) return 'CONFORME';
  // Valor fora do vocabulário: não inventa veredito.
  return 'IGNORADO';
}

/** O tipo do campo pode receber nota? (espelhado no construtor de formulários) */
export function isScorableFieldType(type?: string | null): boolean {
  const upper = String(type ?? '').toUpperCase();
  return TIPOS_AVALIAVEIS.has(upper) || TIPOS_LISTA.has(upper);
}

/**
 * Apuração completa: o resultado do preenchimento e o de cada item, na mesma
 * passada. Uma função só para que a ficha, o PDF e o percentual gravado nunca
 * discordem entre si.
 */
export function scoreSheet(answers: ScorableAnswer[]): { result: ConformityResult; items: ScoredItem[] } {
  // Checklist pontuado = alguém escreveu nota em alguma pergunta. A partir daí,
  // pergunta sem nota é registro: responde, mas não soma nem subtrai ponto.
  const pontuado = isScoredSheet(answers);

  const items: ScoredItem[] = [];
  let conformes = 0;
  let naoConformes = 0;
  let naoAplicaveis = 0;
  let semNota = 0;
  let pesoConforme = 0;
  let pesoAvaliado = 0;
  let notaDiferenteDeUm = false;

  for (const answer of answers) {
    const verdict = classifyAnswer(answer);
    const note = noteOf(answer.weight);
    if (note !== null && note !== 1) notaDiferenteDeUm = true;

    if (pontuado && note === null) {
      // Respondida, mas fora da pontuação — só conta como "sem nota" se era um
      // item de avaliação (texto e foto nunca foram candidatos a ponto).
      if (verdict !== 'IGNORADO') semNota += 1;
      items.push({ points: null, note: null, verdict, outOfScore: true });
      continue;
    }

    const peso = effectiveWeight(answer.weight, answer.critical);
    switch (verdict) {
      case 'CONFORME':
        conformes += 1;
        pesoConforme += peso;
        pesoAvaliado += peso;
        items.push({ points: peso, note, verdict, outOfScore: false });
        break;
      case 'NAO_CONFORME':
        naoConformes += 1;
        pesoAvaliado += peso;
        items.push({ points: 0, note, verdict, outOfScore: false });
        break;
      case 'NAO_APLICAVEL':
        naoAplicaveis += 1;
        items.push({ points: null, note, verdict, outOfScore: false });
        break;
      default:
        items.push({ points: null, note, verdict, outOfScore: false });
        break;
    }
  }

  const avaliados = conformes + naoConformes;
  const percent = pesoAvaliado > 0 ? Math.round((pesoConforme / pesoAvaliado) * 1000) / 10 : null;
  // "Pontuado" para a tela é quando o autor de fato configurou algo: notas
  // diferentes de 1, ou perguntas deliberadamente fora do resultado. Modelo
  // antigo (tudo com nota 1, nada de fora) segue sendo checklist comum.
  const usaNotas = pontuado && (notaDiferenteDeUm || semNota > 0);
  return {
    result: { percent, conformes, naoConformes, naoAplicaveis, avaliados, pesoConforme, pesoAvaliado, usaNotas, semNota },
    items,
  };
}

/** Percentual de conformidade do preenchimento. */
export function conformityScore(answers: ScorableAnswer[]): ConformityResult {
  return scoreSheet(answers).result;
}

/**
 * Resumo curto para cabeçalho de relatório.
 *
 * Sem notas: "97,1% — 33 de 34 conformes" (contagem de itens é o que importa).
 * Com notas: "70% — 70 de 100 pontos", porque aí o que o usuário conferiu foi a
 * pontuação, e "3 de 4 conformes" não explicaria o 70%.
 */
export function conformitySummary(result: ConformityResult): string {
  if (result.percent === null) return 'Sem itens avaliáveis';
  const percent = result.percent.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  const naoAplicavel = result.naoAplicaveis > 0 ? ` · ${result.naoAplicaveis} não aplicável${result.naoAplicaveis > 1 ? 'is' : ''}` : '';
  if (result.usaNotas) {
    // Cita as perguntas fora da nota: sem isso, "3 de 4 pontos" num checklist
    // de 10 perguntas parece conta errada.
    const fora = result.semNota > 0 ? ` · ${result.semNota} sem nota` : '';
    return `${percent}% — ${formatPontos(result.pesoConforme)} de ${formatPontos(result.pesoAvaliado)} pontos${naoAplicavel}${fora}`;
  }
  return `${percent}% — ${result.conformes} de ${result.avaliados} conformes${naoAplicavel}`;
}

/** Pontos em pt-BR, sem casa decimal inútil ("30" e não "30,0"). */
export function formatPontos(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
