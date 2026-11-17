/**
 * Conteúdo do GED (módulo Documentos) compartilhado entre API e Web.
 *
 * O editor visual grava o documento como JSON no formato do ProseMirror/Tiptap
 * (`DocNode`). A partir dele a API gera o texto de busca, o PDF oficial e o
 * Word; a Web compara revisões e confere as seções obrigatórias. Tudo aqui é
 * puro (sem dependências), para rodar igual nos dois lados.
 */

export interface DocMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface DocNode {
  type: string;
  attrs?: Record<string, any>;
  content?: DocNode[];
  text?: string;
  marks?: DocMark[];
}

export type DocumentConfidentialityCode = 'INTERNAL' | 'RESTRICTED' | 'CONFIDENTIAL';
export type DocumentContentFormatCode = 'TEXT' | 'STRUCTURED' | 'DOCX' | 'FILE';

export const DOCUMENT_CONFIDENTIALITY_LABEL: Record<DocumentConfidentialityCode, string> = {
  INTERNAL: 'Interno',
  RESTRICTED: 'Restrito',
  CONFIDENTIAL: 'Confidencial',
};

export const DOCUMENT_CONTENT_FORMAT_LABEL: Record<DocumentContentFormatCode, string> = {
  TEXT: 'Texto simples',
  STRUCTURED: 'Editor visual',
  DOCX: 'Arquivo Word',
  FILE: 'Arquivo anexado (PDF)',
};

export function emptyDoc(): DocNode {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

export function isDocNode(value: unknown): value is DocNode {
  return Boolean(value) && typeof value === 'object' && (value as { type?: unknown }).type === 'doc';
}

// ----------------------------------------------------------------------------
// Normalização para busca (sem acento, minúsculas)
// ----------------------------------------------------------------------------

const COMBINING_MARKS = /[̀-ͯ]/g;

function foldChar(char: string): string {
  return char.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

/** Texto sem acentos, minúsculo e com espaços simples — usado na coluna de busca. */
export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '').normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Termos de busca normalizados (letras e números, 2+ caracteres, no máximo 8). */
export function searchTokens(term: string | null | undefined): string[] {
  return normalizeSearchText(term)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2)
    .slice(0, 8);
}

/**
 * Consulta de texto completo para o Postgres (`to_tsquery('simple', ...)`)
 * com busca por prefixo em cada termo. Os termos já saem higienizados (só
 * [a-z0-9]), então a string pode ir como parâmetro sem risco de sintaxe.
 */
export function buildPrefixTsQuery(term: string | null | undefined): string | null {
  const tokens = searchTokens(term);
  if (!tokens.length) return null;
  return tokens.map((token) => `${token}:*`).join(' & ');
}

/** Termos normalizados separados por espaço, para `plainto_tsquery('portuguese', ...)`. */
export function buildPlainSearchQuery(term: string | null | undefined): string | null {
  const tokens = searchTokens(term);
  return tokens.length ? tokens.join(' ') : null;
}

/**
 * Trecho do texto original em volta do primeiro termo encontrado, para mostrar
 * no resultado da busca. A comparação ignora acento e caixa, mas o trecho
 * devolvido preserva o texto como foi escrito.
 */
export function extractSnippet(text: string | null | undefined, term: string | null | undefined, radius = 90): string | null {
  const source = text ?? '';
  const tokens = searchTokens(term);
  if (!source || !tokens.length) return null;
  let folded = '';
  const map: number[] = [];
  for (let index = 0; index < source.length; index++) {
    const piece = foldChar(source[index]);
    for (let j = 0; j < piece.length; j++) {
      folded += piece[j];
      map.push(index);
    }
  }
  let hit = -1;
  let hitLength = 0;
  for (const token of tokens) {
    const at = folded.indexOf(token);
    if (at >= 0 && (hit < 0 || at < hit)) {
      hit = at;
      hitLength = token.length;
    }
  }
  if (hit < 0) return null;
  const startOriginal = map[hit] ?? 0;
  const endOriginal = map[Math.min(hit + hitLength, map.length - 1)] ?? source.length;
  const from = Math.max(0, startOriginal - radius);
  const to = Math.min(source.length, endOriginal + radius);
  const snippet = source.slice(from, to).replace(/\s+/g, ' ').trim();
  return `${from > 0 ? '… ' : ''}${snippet}${to < source.length ? ' …' : ''}`;
}

// ----------------------------------------------------------------------------
// Texto plano a partir do documento estruturado
// ----------------------------------------------------------------------------

export function inlineText(node: DocNode | null | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'image') return '';
  return (node.content ?? []).map(inlineText).join('');
}

function blockLines(nodes: DocNode[] | undefined, depth: number): string[] {
  const lines: string[] = [];
  const indent = '  '.repeat(depth);
  for (const node of nodes ?? []) {
    switch (node.type) {
      case 'heading':
        lines.push('', inlineText(node).trim(), '');
        break;
      case 'paragraph':
        lines.push(`${indent}${inlineText(node)}`);
        break;
      case 'bulletList':
      case 'orderedList': {
        const start = Number(node.attrs?.start ?? 1) || 1;
        (node.content ?? []).forEach((item, index) => {
          const prefix = node.type === 'orderedList' ? `${start + index}.` : '-';
          const inner = blockLines(item.content, depth + 1);
          const first = inner.findIndex((line) => line.trim().length > 0);
          if (first < 0) {
            lines.push(`${indent}${prefix}`);
            return;
          }
          inner.forEach((line, lineIndex) => {
            if (lineIndex === first) lines.push(`${indent}${prefix} ${line.trim()}`);
            else if (line.trim()) lines.push(line);
          });
        });
        break;
      }
      case 'blockquote':
        blockLines(node.content, depth).forEach((line) => lines.push(`${indent}> ${line.trim()}`));
        break;
      case 'codeBlock':
        lines.push(inlineText(node));
        break;
      case 'horizontalRule':
        lines.push('---');
        break;
      case 'table':
        for (const row of node.content ?? []) {
          const cells = (row.content ?? []).map((cell) => blockLines(cell.content, 0).map((line) => line.trim()).filter(Boolean).join(' '));
          lines.push(`| ${cells.join(' | ')} |`);
        }
        lines.push('');
        break;
      case 'image': {
        const alt = String(node.attrs?.alt ?? node.attrs?.title ?? '').trim();
        if (alt) lines.push(`[Imagem: ${alt}]`);
        break;
      }
      default:
        if (node.content) lines.push(...blockLines(node.content, depth));
        else if (node.text) lines.push(node.text);
    }
  }
  return lines;
}

/** Texto plano legível do documento (busca, IA, comparação e PDF de contingência). */
export function docToPlainText(doc: DocNode | null | undefined): string {
  if (!doc) return '';
  return blockLines(doc.content, 0)
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ----------------------------------------------------------------------------
// Markdown enxuto (modelos da biblioteca e documentos legados) -> documento
// ----------------------------------------------------------------------------

function inlineMarkdown(text: string): DocNode[] {
  const nodes: DocNode[] = [];
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  parts.forEach((part, index) => {
    if (!part) return;
    const node: DocNode = { type: 'text', text: part };
    if (index % 2 === 1) node.marks = [{ type: 'bold' }];
    nodes.push(node);
  });
  return nodes;
}

function paragraph(text: string): DocNode {
  const content = inlineMarkdown(text);
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s:|-]+\|?$/.test(line.trim()) && line.includes('-');
}

/** Converte o markdown enxuto dos modelos (#, -, 1., |tabela|, **negrito**, ---) em documento. */
export function markdownToDoc(markdown: string | null | undefined): DocNode {
  const lines = (markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
  const content: DocNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      index++;
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const text = heading[2].replace(/\*\*/g, '').trim();
      content.push({ type: 'heading', attrs: { level: heading[1].length }, content: text ? [{ type: 'text', text }] : undefined });
      index++;
      continue;
    }
    if (/^---+$/.test(trimmed)) {
      content.push({ type: 'horizontalRule' });
      index++;
      continue;
    }
    if (trimmed.startsWith('|') && trimmed.indexOf('|', 1) > 0) {
      const tableLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        tableLines.push(lines[index]);
        index++;
      }
      const hasHeader = tableLines.length > 1 && isTableSeparator(tableLines[1]);
      const rows = tableLines.filter((_, rowIndex) => !(hasHeader && rowIndex === 1)).map(splitTableRow);
      const width = Math.max(1, ...rows.map((row) => row.length));
      content.push({
        type: 'table',
        content: rows.map((cells, rowIndex) => ({
          type: 'tableRow',
          content: Array.from({ length: width }, (_, cellIndex) => ({
            type: hasHeader && rowIndex === 0 ? 'tableHeader' : 'tableCell',
            attrs: { colspan: 1, rowspan: 1, colwidth: null },
            content: [paragraph(cells[cellIndex] ?? '')],
          })),
        })),
      });
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    const ordered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);
    if (bullet || ordered) {
      const listType = bullet ? 'bulletList' : 'orderedList';
      const items: DocNode[] = [];
      const start = ordered ? Number(ordered[1]) || 1 : 1;
      while (index < lines.length) {
        const current = lines[index].trim();
        const match = bullet ? /^[-*]\s+(.*)$/.exec(current) : /^(\d+)[.)]\s+(.*)$/.exec(current);
        if (!match) break;
        items.push({ type: 'listItem', content: [paragraph(bullet ? match[1] : match[2])] });
        index++;
      }
      content.push(listType === 'orderedList' ? { type: listType, attrs: { start }, content: items } : { type: listType, content: items });
      continue;
    }
    content.push(paragraph(trimmed));
    index++;
  }
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

/** Substitui {{campo}} nos textos do documento estruturado. */
export function applyDocPlaceholders(doc: DocNode, values: Record<string, string>): DocNode {
  const replace = (text: string) => text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => (key in values ? values[key] ?? '' : match));
  const visit = (node: DocNode): DocNode => {
    const next: DocNode = { ...node };
    if (typeof next.text === 'string') next.text = replace(next.text);
    if (next.content) next.content = next.content.map(visit).filter((child) => child.type !== 'text' || (child.text ?? '').length > 0);
    return next;
  };
  return visit(doc);
}

// ----------------------------------------------------------------------------
// Seções obrigatórias por tipo documental
// ----------------------------------------------------------------------------

export const DOCUMENT_REQUIRED_SECTIONS: Record<string, string[]> = {
  POP: ['Objetivo', 'Aplicação', 'Responsabilidades', 'Descrição das atividades', 'Registros'],
  PRO: ['Objetivo', 'Aplicação', 'Responsabilidades', 'Descrição das atividades'],
  IT: ['Objetivo', 'Segurança', 'Passo a passo'],
  NOR: ['Objetivo', 'Abrangência', 'Requisitos', 'Responsabilidades'],
  POL: ['Propósito', 'Abrangência', 'Diretrizes'],
};

export interface DocSection {
  title: string;
  level: number;
  hasContent: boolean;
}

function headingKey(title: string): string {
  return normalizeSearchText(title).replace(/^[\d.\s)-]+/, '').trim();
}

/** Títulos (níveis 1 e 2) e se há conteúdo até o próximo título. */
export function listDocSections(doc: DocNode | null | undefined): DocSection[] {
  const sections: DocSection[] = [];
  for (const node of doc?.content ?? []) {
    if (node.type === 'heading' && Number(node.attrs?.level ?? 1) <= 2) {
      sections.push({ title: inlineText(node).trim(), level: Number(node.attrs?.level ?? 1), hasContent: false });
      continue;
    }
    const current = sections[sections.length - 1];
    if (!current || current.hasContent) continue;
    const text = docToPlainText({ type: 'doc', content: [node] }).replace(/\[[^\]]*\]/g, '').trim();
    if (text || node.type === 'image' || node.type === 'table') current.hasContent = true;
  }
  return sections;
}

/** Seções obrigatórias ausentes ou vazias para a sigla do tipo (POP, PRO, IT, NOR, POL). */
export function checkRequiredSections(doc: DocNode | null | undefined, sigla: string | null | undefined) {
  const required = DOCUMENT_REQUIRED_SECTIONS[(sigla ?? '').toUpperCase()] ?? [];
  const sections = listDocSections(doc);
  const missing: string[] = [];
  const empty: string[] = [];
  for (const title of required) {
    const key = headingKey(title);
    const found = sections.find((section) => headingKey(section.title).startsWith(key) || headingKey(section.title).includes(key));
    if (!found) missing.push(title);
    else if (!found.hasContent) empty.push(title);
  }
  return { required, missing, empty, ok: missing.length === 0 && empty.length === 0 };
}

// ----------------------------------------------------------------------------
// Comparação entre revisões (Myers por linha, refinada por palavra)
// ----------------------------------------------------------------------------

export type DiffOp = { type: 'equal' | 'insert' | 'delete'; text: string };

type RawOp<T> = { type: DiffOp['type']; item: T };

function myers<T>(a: T[], b: T[], maxD: number): RawOp<T>[] | null {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  if (max === 0) return [];
  const offset = max + 1;
  const size = 2 * max + 3;
  const v = new Int32Array(size);
  const trace: Int32Array[] = [];
  for (let d = 0; d <= max; d++) {
    if (d > maxD) return null;
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) x = v[offset + k + 1];
      else x = v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        const ops: RawOp<T>[] = [];
        let cx = n;
        let cy = m;
        for (let step = trace.length - 1; step >= 0; step--) {
          const state = trace[step];
          const ck = cx - cy;
          const prevK = ck === -step || (ck !== step && state[offset + ck - 1] < state[offset + ck + 1]) ? ck + 1 : ck - 1;
          const prevX = state[offset + prevK];
          const prevY = prevX - prevK;
          while (cx > prevX && cy > prevY) {
            ops.push({ type: 'equal', item: a[cx - 1] });
            cx--;
            cy--;
          }
          if (step > 0) {
            if (cx === prevX) ops.push({ type: 'insert', item: b[cy - 1] });
            else ops.push({ type: 'delete', item: a[cx - 1] });
          }
          cx = prevX;
          cy = prevY;
        }
        return ops.reverse();
      }
    }
  }
  return null;
}

function tokenizeWords(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

function pushOp(out: DiffOp[], type: DiffOp['type'], text: string) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.type === type) last.text += text;
  else out.push({ type, text });
}

/** Diferenças entre dois textos: linhas iguais preservadas, trechos alterados comparados por palavra. */
export function diffText(before: string | null | undefined, after: string | null | undefined): DiffOp[] {
  const a = (before ?? '').replace(/\r\n?/g, '\n').split('\n');
  const b = (after ?? '').replace(/\r\n?/g, '\n').split('\n');
  const lineOps = myers(a, b, 2500);
  const out: DiffOp[] = [];
  if (!lineOps) {
    pushOp(out, 'delete', a.join('\n'));
    pushOp(out, 'insert', b.join('\n'));
    return out;
  }
  let pendingDelete: string[] = [];
  let pendingInsert: string[] = [];
  const flush = () => {
    if (!pendingDelete.length && !pendingInsert.length) return;
    if (pendingDelete.length && pendingInsert.length) {
      const wordOps = myers(tokenizeWords(pendingDelete.join('\n')), tokenizeWords(pendingInsert.join('\n')), 1500);
      if (wordOps) {
        for (const op of wordOps) pushOp(out, op.type, op.item);
        pushOp(out, 'equal', '\n');
      } else {
        pushOp(out, 'delete', `${pendingDelete.join('\n')}\n`);
        pushOp(out, 'insert', `${pendingInsert.join('\n')}\n`);
      }
    } else if (pendingDelete.length) {
      pushOp(out, 'delete', `${pendingDelete.join('\n')}\n`);
    } else {
      pushOp(out, 'insert', `${pendingInsert.join('\n')}\n`);
    }
    pendingDelete = [];
    pendingInsert = [];
  };
  for (const op of lineOps) {
    if (op.type === 'delete') pendingDelete.push(op.item);
    else if (op.type === 'insert') pendingInsert.push(op.item);
    else {
      flush();
      pushOp(out, 'equal', `${op.item}\n`);
    }
  }
  flush();
  return out;
}

/** Quantidade de palavras inseridas e removidas numa comparação. */
export function diffStats(ops: DiffOp[]) {
  const words = (text: string) => (text.match(/[^\s]+/g) ?? []).length;
  return ops.reduce(
    (acc, op) => {
      if (op.type === 'insert') acc.inserted += words(op.text);
      if (op.type === 'delete') acc.deleted += words(op.text);
      if (op.type === 'equal') acc.unchanged += words(op.text);
      return acc;
    },
    { inserted: 0, deleted: 0, unchanged: 0 },
  );
}
