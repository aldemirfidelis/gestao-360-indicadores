/**
 * Compartilhamento de vaga em rede social.
 *
 * ⚠️ O LinkedIn NÃO aceita mais texto pré-preenchido: o endpoint de share
 * recebe só a URL, e o card (título, descrição, imagem) é montado por ele lendo
 * as tags Open Graph da página da vaga. Os parâmetros `title`/`summary` antigos
 * são ignorados. Por isso duas coisas andam juntas:
 *
 * 1. `generateMetadata` na página pública da vaga — é o que faz o card sair
 *    bonito em vez de genérico;
 * 2. `vacancyPostText()` — o texto sugerido que copiamos para a área de
 *    transferência, para o recrutador colar como comentário do post.
 */

export interface VacancyShareInput {
  title: string;
  companyName?: string | null;
  city?: string | null;
  workModeLabel?: string | null;
  contractLabel?: string | null;
  url: string;
}

/** URL do compositor do LinkedIn com o link da vaga. */
export function linkedInShareUrl(url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

/**
 * Texto sugerido para o post. O recrutador cola e edita — é ponto de partida,
 * não mensagem automática, porque o tom certo varia por empresa e por vaga.
 */
export function vacancyPostText(input: VacancyShareInput): string {
  const local = [input.city, input.workModeLabel].filter(Boolean).join(' · ');
  const linhas = [
    `📢 Vaga aberta: ${input.title}`,
    input.companyName ? `Empresa: ${input.companyName}` : null,
    local ? `Local: ${local}` : null,
    input.contractLabel ? `Contratação: ${input.contractLabel}` : null,
    '',
    'Candidate-se pelo link e acompanhe seu processo pelo portal:',
    input.url,
    '',
    '#vagas #oportunidade #recrutamento',
  ];
  return linhas.filter((linha) => linha !== null).join('\n');
}

/** Descrição do card do Open Graph: uma linha com os dados que decidem a leitura. */
export function vacancyOgDescription(input: Omit<VacancyShareInput, 'url'> & { description?: string | null }): string {
  const partes = [input.companyName, input.city, input.workModeLabel, input.contractLabel].filter(Boolean);
  const cabecalho = partes.join(' · ');
  const resumo = firstParagraph(input.description);
  if (cabecalho && resumo) return truncate(`${cabecalho} — ${resumo}`, 200);
  return truncate(cabecalho || resumo || 'Confira esta oportunidade e candidate-se.', 200);
}

/** Primeiro parágrafo do texto da vaga, sem marcação de lista/markdown. */
function firstParagraph(value?: string | null): string {
  const texto = String(value ?? '').trim();
  if (!texto) return '';
  const bloco = texto.split(/\n{2,}/)[0] ?? '';
  return bloco
    .replace(/[#*_`>]/g, '')
    .replace(/^\s*[-•]\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Corta no limite sem partir palavra ao meio. */
export function truncate(value: string, max: number): string {
  const texto = value.trim();
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max - 1);
  const espaco = corte.lastIndexOf(' ');
  return `${(espaco > max * 0.6 ? corte.slice(0, espaco) : corte).trimEnd()}…`;
}
