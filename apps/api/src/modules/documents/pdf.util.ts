/**
 * Gera um PDF valido (PDF 1.4) SEM dependencias externas.
 *
 * Antes, o "PDF oficial" publicado era texto plano com extensao .pdf — nao
 * abria em nenhum leitor. Este gerador produz um PDF minimo real (A4, fonte
 * Helvetica com WinAnsiEncoding, multiplas paginas, quebra de linha), o
 * suficiente para o PDF controlado de publicacao e para downloads de
 * arquivos legados que so possuem conteudo textual.
 */

const PAGE_WIDTH = 595.28; // A4 em pontos
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const FONT_SIZE = 10;
const HEADING_SIZE = 14;
const LEADING = 14;
const MAX_CHARS = 100; // limite aproximado de caracteres por linha (Helvetica 10pt)
const LINES_PER_PAGE = Math.floor((PAGE_HEIGHT - 2 * MARGIN) / LEADING);

type PdfLine = { text: string; bold: boolean; size: number };

/** Tipograficos comuns fora do Latin-1 que existem no WinAnsi (CP-1252). */
const WINANSI_MAP: Record<string, number> = {
  '•': 0x95, // •
  '–': 0x96, // –
  '—': 0x97, // —
  '‘': 0x91, // '
  '’': 0x92, // '
  '“': 0x93, // "
  '”': 0x94, // "
  '…': 0x85, // …
  '€': 0x80, // €
};

/** Escapa e converte para WinAnsi (Latin-1); caracteres fora do mapa viram '?'. */
function pdfEscape(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 63;
    if (char === '(' || char === ')' || char === '\\') {
      out += `\\${char}`;
    } else if (code >= 32 && code <= 255) {
      out += char;
    } else if (WINANSI_MAP[char]) {
      out += String.fromCharCode(WINANSI_MAP[char]);
    } else {
      out += '?';
    }
  }
  return out;
}

function wrapLine(raw: string): string[] {
  const line = raw.replace(/\t/g, '  ');
  if (line.length <= MAX_CHARS) return [line];
  const words = line.split(' ');
  const wrapped: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= MAX_CHARS) {
      current += ` ${word}`;
    } else {
      wrapped.push(current);
      current = word;
    }
    while (current.length > MAX_CHARS) {
      wrapped.push(current.slice(0, MAX_CHARS));
      current = current.slice(MAX_CHARS);
    }
  }
  if (current) wrapped.push(current);
  return wrapped.length ? wrapped : [''];
}

/** Converte texto/markdown enxuto nas linhas tipograficas do PDF. */
function toPdfLines(text: string): PdfLine[] {
  const lines: PdfLine[] = [];
  for (const raw of (text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
    const heading = /^(#{1,3})\s+(.*)$/.exec(raw);
    if (heading) {
      const clean = heading[2].replace(/\*\*/g, '');
      for (const piece of wrapLine(clean)) lines.push({ text: piece, bold: true, size: HEADING_SIZE });
      continue;
    }
    if (/^---+$/.test(raw.trim())) {
      lines.push({ text: ''.padEnd(MAX_CHARS, '_'), bold: false, size: FONT_SIZE });
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(raw);
    const content = (bullet ? `  • ${bullet[1]}` : raw).replace(/\*\*/g, '').replace(/^\|(.*)\|$/, (_, cells: string) => cells.split('|').map((cell) => cell.trim()).join('   '));
    if (/^\|?[\s:|-]+\|?$/.test(raw.trim()) && raw.includes('-') && raw.includes('|')) continue; // separador de tabela
    for (const piece of wrapLine(content)) lines.push({ text: piece, bold: false, size: FONT_SIZE });
  }
  return lines;
}

/**
 * Constroi um PDF real a partir de texto/markdown enxuto.
 */
export function buildPdf(text?: string | null): Buffer {
  const lines = toPdfLines(text ?? '');
  if (!lines.length) lines.push({ text: '', bold: false, size: FONT_SIZE });

  const pages: PdfLine[][] = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + LINES_PER_PAGE));
  }

  // Objetos: 1=Catalog, 2=Pages, 3=Font regular, 4=Font bold, depois pares (Page, Contents).
  const objects: string[] = [];
  const pageObjectIds = pages.map((_, index) => 5 + index * 2);

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  for (const pageLines of pages) {
    let stream = 'BT\n';
    let y = PAGE_HEIGHT - MARGIN;
    for (const line of pageLines) {
      const font = line.bold ? '/F2' : '/F1';
      stream += `${font} ${line.size} Tf 1 0 0 1 ${MARGIN} ${y.toFixed(2)} Tm (${pdfEscape(line.text)}) Tj\n`;
      y -= LEADING;
    }
    stream += 'ET';
    const contentId = objects.length + 2; // proximo apos a pagina
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
  }

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(body, 'latin1');
}
