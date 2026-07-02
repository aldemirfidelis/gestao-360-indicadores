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
