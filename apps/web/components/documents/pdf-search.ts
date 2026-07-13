/**
 * Helpers puros de busca textual do visualizador de PDF.
 *
 * A normalização precisa preservar o comprimento da string (1 unidade UTF-16
 * de entrada -> 1 unidade de saída) para que os índices encontrados no texto
 * normalizado possam ser aplicados diretamente sobre os nós de texto do DOM.
 */

const COMBINING_MARK_START = 0x0300;
const COMBINING_MARK_END = 0x036f;

/** Remove marcas diacríticas (U+0300..U+036F) de uma string já decomposta via NFD. */
function stripCombiningMarks(decomposed: string): string {
  let out = '';
  for (const c of decomposed) {
    const cp = c.codePointAt(0) ?? 0;
    if (cp < COMBINING_MARK_START || cp > COMBINING_MARK_END) out += c;
  }
  return out;
}

/** Remove acentos e caixa de um único "caractere" (code point) sem alterar o comprimento. */
function foldChar(ch: string): string {
  let base = stripCombiningMarks(ch.normalize('NFD'));
  if (base.length !== ch.length) base = ch;
  const lower = base.toLowerCase();
  return lower.length === base.length ? lower : base;
}

/** Normaliza texto para comparação (minúsculas, sem acentos), preservando o comprimento. */
export function normalizeSearchable(text: string): string {
  let out = '';
  for (const ch of text) out += foldChar(ch);
  return out;
}

/**
 * Retorna os índices iniciais (não sobrepostos) de `needle` dentro de `haystack`.
 * Ambos devem já estar normalizados com {@link normalizeSearchable}.
 */
export function findMatchStarts(haystack: string, needle: string): number[] {
  if (!needle) return [];
  const starts: number[] = [];
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    starts.push(idx);
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return starts;
}

/**
 * Dado o total de ocorrências por página e um índice global (0-based),
 * resolve em qual página e em qual ocorrência local o índice cai.
 */
export function resolveMatchPosition(
  countsPerPage: number[],
  globalIndex: number,
): { page: number; localIndex: number } | null {
  let remaining = globalIndex;
  for (let i = 0; i < countsPerPage.length; i++) {
    const count = countsPerPage[i];
    if (remaining < count) return { page: i + 1, localIndex: remaining };
    remaining -= count;
  }
  return null;
}
