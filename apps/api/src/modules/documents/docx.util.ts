/**
 * Gera e le .docx (OOXML) validos SEM dependencias externas.
 *
 * Um .docx e um arquivo ZIP com algumas partes XML. Aqui montamos o ZIP
 * usando o metodo STORE (sem compressao), com CRC-32 correto por entrada,
 * de forma que o LibreOffice/Collabora e o Microsoft Word consigam abrir.
 * Para leitura, suportamos entradas STORE e DEFLATE (via zlib nativo), o
 * que cobre arquivos gerados pelo Word/LibreOffice.
 *
 * Usos principais:
 *  - "semear" um DOCX binario real a partir do texto/markdown nativo do
 *    documento, para que o editor online (WOPI) tenha um arquivo editavel;
 *  - importar modelos .docx reais enviados pela empresa (validar, extrair
 *    texto para pre-visualizacao e aplicar placeholders {{...}}).
 */

import { inflateRawSync } from 'zlib';

// ----------------------- CRC-32 (tabela precomputada) -----------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ----------------------------- ZIP (metodo STORE) ---------------------------

interface ZipEntry {
  name: string;
  data: Buffer;
}

/** Monta um ZIP (STORE, sem compressao) a partir das entradas dadas. */
function buildZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const data = entry.data;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // assinatura do local file header
    local.writeUInt16LE(20, 4); // versao necessaria
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // metodo: 0 = STORE
    local.writeUInt16LE(0, 10); // hora de modificacao
    local.writeUInt16LE(0x21, 12); // data de modificacao (1980-01-01)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); // tamanho comprimido
    local.writeUInt32LE(data.length, 22); // tamanho original
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra field length
    localParts.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // assinatura do central directory header
    central.writeUInt16LE(20, 4); // versao que criou
    central.writeUInt16LE(20, 6); // versao necessaria
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(0, 10); // metodo: STORE
    central.writeUInt16LE(0, 12); // hora
    central.writeUInt16LE(0x21, 14); // data
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comentario
    central.writeUInt16LE(0, 34); // disco inicial
    central.writeUInt16LE(0, 36); // atributos internos
    central.writeUInt32LE(0, 38); // atributos externos
    central.writeUInt32LE(offset, 42); // offset do local header
    centralParts.push(central, nameBuf);

    offset += local.length + nameBuf.length + data.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const centralOffset = offset;

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // assinatura do end of central directory
  end.writeUInt16LE(0, 4); // numero do disco
  end.writeUInt16LE(0, 6); // disco do central directory
  end.writeUInt16LE(entries.length, 8); // entradas neste disco
  end.writeUInt16LE(entries.length, 10); // total de entradas
  end.writeUInt32LE(centralDir.length, 12); // tamanho do central directory
  end.writeUInt32LE(centralOffset, 16); // offset do central directory
  end.writeUInt16LE(0, 20); // comentario

  return Buffer.concat([...localParts, centralDir, end]);
}

// ----------------------------- ZIP (leitura) --------------------------------

/**
 * Le as entradas de um ZIP (suporta STORE e DEFLATE). Retorna null quando o
 * buffer nao e um ZIP valido. Usa o central directory como fonte da verdade
 * (o local header pode ter tamanhos zerados quando ha data descriptor).
 */
export function readZipEntries(buffer: Buffer): ZipEntry[] | null {
  if (!buffer || buffer.length < 22 || buffer.readUInt16BE(0) !== 0x504b) return null;

  // End of Central Directory: procura a assinatura a partir do fim.
  let eocd = -1;
  const scanStart = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= scanStart; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const count = buffer.readUInt16LE(eocd + 10);
  let pointer = buffer.readUInt32LE(eocd + 16); // offset do central directory
  const entries: ZipEntry[] = [];

  for (let n = 0; n < count; n++) {
    if (pointer + 46 > buffer.length || buffer.readUInt32LE(pointer) !== 0x02014b50) return null;
    const method = buffer.readUInt16LE(pointer + 10);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.subarray(pointer + 46, pointer + 46 + nameLength).toString('utf8');
    pointer += 46 + nameLength + extraLength + commentLength;

    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) return null;
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    if (dataStart + compressedSize > buffer.length) return null;
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);

    let data: Buffer;
    if (method === 0) {
      data = Buffer.from(raw);
    } else if (method === 8) {
      try {
        data = inflateRawSync(raw);
      } catch {
        return null;
      }
    } else {
      // Metodo de compressao nao suportado.
      return null;
    }
    entries.push({ name, data });
  }

  return entries;
}

/** Verifica se o buffer e um DOCX (ZIP com word/document.xml). */
export function isDocxBuffer(buffer: Buffer): boolean {
  const entries = readZipEntries(buffer);
  if (!entries) return false;
  return entries.some((entry) => entry.name === 'word/document.xml');
}

// ------------------------------- OOXML parts --------------------------------

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&');
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

/** Quebra um texto/markdown simples em paragrafos para o corpo do documento. */
export function textToParagraphs(text: string | null | undefined): string[] {
  const clean = (text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.split('\n');
  // Preserva linhas em branco como paragrafos vazios para manter o espacamento.
  return lines.length ? lines : [''];
}

// --------------------- Geracao rica (markdown enxuto) -----------------------
// Suporta: # / ## / ### (titulos), - ou * (marcadores), **negrito** inline,
// tabelas com | celula | celula | e linha separadora |---|---|, e --- (divisor).

/** Runs de um paragrafo com suporte a **negrito** inline. */
function runsXml(text: string, forceBold = false, sizeHalfPoints?: number): string {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  let xml = '';
  for (let i = 0; i < parts.length; i++) {
    const chunk = parts[i];
    if (!chunk) continue;
    const bold = forceBold || i % 2 === 1;
    const props: string[] = [];
    if (bold) props.push('<w:b/>');
    if (sizeHalfPoints) props.push(`<w:sz w:val="${sizeHalfPoints}"/><w:szCs w:val="${sizeHalfPoints}"/>`);
    const rPr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : '';
    xml += `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(chunk)}</w:t></w:r>`;
  }
  return xml || '<w:r><w:t xml:space="preserve"></w:t></w:r>';
}

function paragraphXml(line: string): string {
  if (!line.trim()) return '<w:p/>';

  const heading = /^(#{1,3})\s+(.*)$/.exec(line);
  if (heading) {
    const level = heading[1].length;
    const size = level === 1 ? 32 : level === 2 ? 28 : 24; // half-points: 16/14/12pt
    return `<w:p><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>${runsXml(heading[2], true, size)}</w:p>`;
  }

  if (/^---+$/.test(line.trim())) {
    return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr></w:pPr></w:p>';
  }

  const bullet = /^[-*]\s+(.*)$/.exec(line);
  if (bullet) {
    return `<w:p><w:pPr><w:ind w:left="360"/></w:pPr><w:r><w:t xml:space="preserve">• </w:t></w:r>${runsXml(bullet[1])}</w:p>`;
  }

  return `<w:p>${runsXml(line)}</w:p>`;
}

const TABLE_BORDERS =
  '<w:tblBorders>' +
  '<w:top w:val="single" w:sz="4" w:space="0" w:color="666666"/>' +
  '<w:left w:val="single" w:sz="4" w:space="0" w:color="666666"/>' +
  '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="666666"/>' +
  '<w:right w:val="single" w:sz="4" w:space="0" w:color="666666"/>' +
  '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="666666"/>' +
  '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="666666"/>' +
  '</w:tblBorders>';

function tableXml(rows: string[][], headerRow: boolean): string {
  const body = rows
    .map((cells, rowIndex) => {
      const isHeader = headerRow && rowIndex === 0;
      const cellsXml = cells
        .map((cell) => {
          const shading = isHeader ? '<w:shd w:val="clear" w:color="auto" w:fill="EDF2F7"/>' : '';
          return `<w:tc><w:tcPr>${shading}</w:tcPr><w:p>${runsXml(cell.trim(), isHeader)}</w:p></w:tc>`;
        })
        .join('');
      return `<w:tr>${cellsXml}</w:tr>`;
    })
    .join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${TABLE_BORDERS}</w:tblPr>${body}</w:tbl><w:p/>`;
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|');
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s:|-]+\|?$/.test(line.trim()) && line.includes('-');
}

function documentBodyXml(lines: string[]): string {
  let xml = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('|') && line.trim().length > 1 && line.includes('|', line.indexOf('|') + 1)) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const headerRow = tableLines.length > 1 && isTableSeparator(tableLines[1]);
      const rows = tableLines.filter((row, index) => !(index === 1 && headerRow)).map(splitTableRow);
      xml += tableXml(rows, headerRow);
      continue;
    }
    xml += paragraphXml(line);
    i++;
  }
  return xml;
}

function documentXml(lines: string[]): string {
  const body = documentBodyXml(lines);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body>
</w:document>`;
}

/**
 * Constroi um buffer .docx valido a partir de texto/markdown enxuto.
 * Se nao houver conteudo, gera um documento em branco editavel.
 */
export function buildDocx(text?: string | null): Buffer {
  const paragraphs = textToParagraphs(text);
  return buildZip([
    { name: '[Content_Types].xml', data: Buffer.from(CONTENT_TYPES, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(ROOT_RELS, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(documentXml(paragraphs), 'utf8') },
  ]);
}

// -------------------- Extracao de texto de DOCX reais -----------------------

/**
 * Extrai o texto de um DOCX real (um paragrafo por linha). Retorna null se o
 * buffer nao for um DOCX legivel. Usado para pre-visualizar modelos
 * importados e detectar placeholders {{...}}.
 */
export function extractDocxText(buffer: Buffer): string | null {
  const entries = readZipEntries(buffer);
  const main = entries?.find((entry) => entry.name === 'word/document.xml');
  if (!main) return null;
  const xml = main.data.toString('utf8');
  const lines: string[] = [];
  const paragraphs = xml.split(/<\/w:p>/);
  for (const paragraph of paragraphs) {
    if (!paragraph.includes('<w:p')) continue;
    const withBreaks = paragraph.replace(/<w:br[^>]*\/>/g, '\n');
    let text = '';
    // (?:\s[^>]*)? garante fronteira do nome da tag (nao casa <w:tbl...>).
    const matches = withBreaks.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g);
    for (const match of matches) text += unescapeXml(match[1]);
    lines.push(text);
  }
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.join('\n');
}

/** Lista os placeholders {{...}} presentes em um texto. */
export function detectPlaceholders(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const match of text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
    found.add(`{{${match[1]}}}`);
  }
  return [...found];
}

// -------------------- Placeholders em DOCX reais ----------------------------

/**
 * Substitui placeholders {{chave}} em um paragrafo OOXML. O Word costuma
 * fragmentar o texto em varios runs (rsid/spellcheck), entao quando o texto
 * plano do paragrafo contem um placeholder conhecido, o paragrafo e
 * reconstruido com um unico run (herdando o formato do primeiro run).
 */
function replaceParagraphPlaceholders(paragraph: string, values: Record<string, string>): string {
  const textMatches = [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)];
  if (!textMatches.length) return paragraph;
  const plain = textMatches.map((match) => unescapeXml(match[1])).join('');
  if (!plain.includes('{{')) return paragraph;

  let replaced = plain;
  for (const [key, value] of Object.entries(values)) {
    // Funcao de substituicao para nao interpretar $ no valor como padrao.
    replaced = replaced.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), () => value ?? '');
  }
  if (replaced === plain) return paragraph;

  const pPr = /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(paragraph)?.[0] ?? '';
  const rPr = /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(paragraph)?.[0] ?? '';
  const runLines = replaced.split('\n');
  const runs = runLines
    .map((line, index) => {
      const brk = index < runLines.length - 1 ? '<w:br/>' : '';
      return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(line)}</w:t>${brk}</w:r>`;
    })
    .join('');

  const openTag = /^<w:p[^>]*>/.exec(paragraph)?.[0] ?? '<w:p>';
  return `${openTag}${pPr}${runs}</w:p>`;
}

/**
 * Aplica placeholders {{chave}} sobre um DOCX real (documento, cabecalhos e
 * rodapes), retornando um novo buffer valido. Se o buffer nao for um DOCX
 * legivel, retorna null (o chamador decide o fallback).
 */
export function applyDocxPlaceholders(buffer: Buffer, values: Record<string, string>): Buffer | null {
  const entries = readZipEntries(buffer);
  if (!entries || !entries.some((entry) => entry.name === 'word/document.xml')) return null;

  const updated = entries.map((entry) => {
    if (!/^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(entry.name)) return entry;
    const xml = entry.data.toString('utf8');
    if (!xml.includes('{{')) return entry;
    const next = xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraph) => replaceParagraphPlaceholders(paragraph, values));
    return { name: entry.name, data: Buffer.from(next, 'utf8') };
  });

  return buildZip(updated);
}

/** Substitui placeholders {{chave}} em texto plano/markdown. */
export function applyTextPlaceholders(text: string, values: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), () => value ?? '');
  }
  return result;
}

// ------------------ DOCX a partir do editor visual (Tiptap) -----------------

interface DocxNode {
  type: string;
  attrs?: Record<string, any>;
  content?: DocxNode[];
  text?: string;
  marks?: Array<{ type: string }>;
}

export interface DocxHeaderMeta {
  companyName?: string | null;
  code?: string | null;
  title?: string | null;
  revision?: string | null;
  status?: string | null;
}

interface DocxMedia {
  rid: string;
  name: string;
  data: Buffer;
  ext: 'png' | 'jpeg';
}

const MAX_IMAGE_EMU = 5_486_400; // 6 polegadas
const EMU_PER_PX = 9525;

function imagePixelSize(buffer: Buffer, ext: 'png' | 'jpeg'): { width: number; height: number } | null {
  if (ext === 'png') {
    if (buffer.length > 24 && buffer.readUInt32BE(12) === 0x49484452) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    return null;
  }
  let index = 2;
  while (index + 9 < buffer.length) {
    if (buffer[index] !== 0xff) {
      index++;
      continue;
    }
    const marker = buffer[index + 1];
    const length = buffer.readUInt16BE(index + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(index + 5), width: buffer.readUInt16BE(index + 7) };
    }
    index += 2 + length;
  }
  return null;
}

function markedRunXml(text: string, marks: Set<string>, extra: { bold?: boolean; sizeHalfPoints?: number } = {}): string {
  if (!text) return '';
  const props: string[] = [];
  if (marks.has('code')) props.push('<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>');
  if (extra.bold || marks.has('bold')) props.push('<w:b/>');
  if (marks.has('italic')) props.push('<w:i/>');
  if (marks.has('strike')) props.push('<w:strike/>');
  if (marks.has('underline') || marks.has('link')) props.push('<w:u w:val="single"/>');
  if (marks.has('link')) props.push('<w:color w:val="1D4ED8"/>');
  if (extra.sizeHalfPoints) props.push(`<w:sz w:val="${extra.sizeHalfPoints}"/><w:szCs w:val="${extra.sizeHalfPoints}"/>`);
  const rPr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : '';
  return text
    .split('\n')
    .map((piece, index) => `${index > 0 ? '<w:r><w:br/></w:r>' : ''}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(piece)}</w:t></w:r>`)
    .join('');
}

class DocxBuilder {
  readonly media: DocxMedia[] = [];
  private drawingId = 1;

  inline(node: DocxNode | undefined, extra: { bold?: boolean; sizeHalfPoints?: number } = {}): string {
    let xml = '';
    for (const child of node?.content ?? []) {
      if (child.type === 'text') xml += markedRunXml(child.text ?? '', new Set((child.marks ?? []).map((mark) => mark.type)), extra);
      else if (child.type === 'hardBreak') xml += '<w:r><w:br/></w:r>';
      else if (child.type === 'image') xml += this.imageRun(child);
      else if (child.content) xml += this.inline(child, extra);
    }
    return xml;
  }

  imageRun(node: DocxNode): string {
    const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(String(node.attrs?.src ?? ''));
    if (!match) return '';
    const ext: 'png' | 'jpeg' = match[1].toLowerCase() === 'png' ? 'png' : 'jpeg';
    const data = Buffer.from(match[2], 'base64');
    const size = imagePixelSize(data, ext);
    if (!size || !size.width || !size.height) return '';
    let cx = size.width * EMU_PER_PX;
    let cy = size.height * EMU_PER_PX;
    if (cx > MAX_IMAGE_EMU) {
      cy = Math.round((cy * MAX_IMAGE_EMU) / cx);
      cx = MAX_IMAGE_EMU;
    }
    const id = this.drawingId++;
    const name = `image${id}.${ext}`;
    const rid = `rIdImg${id}`;
    this.media.push({ rid, name, data, ext });
    const alt = escapeXml(String(node.attrs?.alt ?? `Imagem ${id}`));
    return (
      `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
      `<wp:docPr id="${id}" name="Imagem ${id}" descr="${alt}"/>` +
      '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
      '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
    );
  }

  paragraph(node: DocxNode, options: { indentTwips?: number; prefix?: string; bold?: boolean } = {}): string {
    const pPr = options.indentTwips ? `<w:pPr><w:ind w:left="${options.indentTwips}" w:hanging="280"/></w:pPr>` : '';
    const prefix = options.prefix ? markedRunXml(`${options.prefix}\u00a0`, new Set()) : '';
    const body = this.inline(node, { bold: options.bold });
    return `<w:p>${pPr}${prefix}${body || '<w:r><w:t xml:space="preserve"></w:t></w:r>'}</w:p>`;
  }

  list(node: DocxNode, depth: number): string {
    const ordered = node.type === 'orderedList';
    let number = Number(node.attrs?.start ?? 1) || 1;
    let xml = '';
    for (const item of node.content ?? []) {
      const prefix = ordered ? `${number++}.` : depth % 2 === 0 ? '•' : '–';
      let first = true;
      for (const child of item.content ?? []) {
        if (child.type === 'paragraph') {
          xml += this.paragraph(child, { indentTwips: 360 + depth * 360, prefix: first ? prefix : undefined });
          first = false;
        } else if (child.type === 'bulletList' || child.type === 'orderedList') {
          xml += this.list(child, depth + 1);
        } else {
          xml += this.block(child, depth + 1);
        }
      }
    }
    return xml;
  }

  table(node: DocxNode): string {
    const rows = (node.content ?? [])
      .map((row) => {
        const cells = (row.content ?? [])
          .map((cell) => {
            const header = cell.type === 'tableHeader';
            const span = Math.max(1, Number(cell.attrs?.colspan ?? 1) || 1);
            const tcPr = `<w:tcPr>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}${header ? '<w:shd w:val="clear" w:color="auto" w:fill="EDF2F7"/>' : ''}</w:tcPr>`;
            const paragraphs = (cell.content ?? []).map((child) => (child.type === 'paragraph' ? this.paragraph(child, { bold: header }) : this.block(child, 0))).join('');
            return `<w:tc>${tcPr}${paragraphs || '<w:p/>'}</w:tc>`;
          })
          .join('');
        return `<w:tr>${cells}</w:tr>`;
      })
      .join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${TABLE_BORDERS}</w:tblPr>${rows}</w:tbl><w:p/>`;
  }

  block(node: DocxNode, depth = 0): string {
    switch (node.type) {
      case 'heading': {
        const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 1)));
        const size = level === 1 ? 30 : level === 2 ? 26 : 23;
        return `<w:p><w:pPr><w:keepNext/><w:spacing w:before="${level === 1 ? 280 : 200}" w:after="100"/></w:pPr>${this.inline(node, { bold: true, sizeHalfPoints: size })}</w:p>`;
      }
      case 'paragraph':
        return this.paragraph(node, depth ? { indentTwips: 360 + (depth - 1) * 360 } : {});
      case 'bulletList':
      case 'orderedList':
        return this.list(node, depth);
      case 'table':
        return this.table(node);
      case 'image':
        return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${this.imageRun(node)}</w:p>`;
      case 'horizontalRule':
        return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr></w:pPr></w:p>';
      case 'blockquote':
        return (node.content ?? []).map((child) => `<w:p><w:pPr><w:ind w:left="567"/></w:pPr>${this.inline(child)}</w:p>`).join('');
      case 'codeBlock':
        return `<w:p>${markedRunXml((node.content ?? []).map((child) => child.text ?? '').join(''), new Set(['code']))}</w:p>`;
      default:
        return (node.content ?? []).map((child) => this.block(child, depth)).join('');
    }
  }

  header(meta: DocxHeaderMeta): string {
    const row = (left: string, right: string, bold = false) =>
      `<w:tr><w:tc><w:p>${markedRunXml(left, new Set(), { bold })}</w:p></w:tc><w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr>${markedRunXml(right, new Set(), { bold })}</w:p></w:tc></w:tr>`;
    return (
      `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${TABLE_BORDERS}</w:tblPr>` +
      row(meta.companyName ?? '', meta.code ?? '', true) +
      row(meta.title ?? '', [meta.revision, meta.status].filter(Boolean).join(' · ')) +
      '</w:tbl><w:p/>'
    );
  }
}

/** Gera um .docx real a partir do documento do editor visual (com fotos). */
export function buildDocxFromDoc(doc: DocxNode, meta?: DocxHeaderMeta): Buffer {
  const builder = new DocxBuilder();
  const body = (meta ? builder.header(meta) : '') + (doc.content ?? []).map((node) => builder.block(node)).join('');
  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
    `<w:body>${body || '<w:p/>'}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const documentRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    builder.media.map((item) => `<Relationship Id="${item.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${item.name}"/>`).join('') +
    '</Relationships>';
  return buildZip([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(ROOT_RELS, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(documentXml, 'utf8') },
    { name: 'word/_rels/document.xml.rels', data: Buffer.from(documentRels, 'utf8') },
    ...builder.media.map((item) => ({ name: `word/media/${item.name}`, data: item.data })),
  ]);
}

/** true quando o DOCX traz macros (VBA) — recusado no upload por segurança. */
export function docxHasMacros(buffer: Buffer): boolean {
  const entries = readZipEntries(buffer);
  return Boolean(entries?.some((entry) => /vbaProject\.bin$/i.test(entry.name) || (/\.bin$/i.test(entry.name) && entry.name.includes('activeX'))));
}
