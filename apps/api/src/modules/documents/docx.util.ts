/**
 * Gera um .docx (OOXML) valido SEM dependencias externas.
 *
 * Um .docx e um arquivo ZIP com algumas partes XML. Aqui montamos o ZIP
 * usando o metodo STORE (sem compressao), com CRC-32 correto por entrada,
 * de forma que o LibreOffice/Collabora e o Microsoft Word consigam abrir.
 *
 * Uso principal: "semear" um DOCX binario real a partir do texto/markdown
 * nativo do documento, para que o editor online (WOPI) tenha um arquivo
 * editavel mesmo quando o GED so guardava conteudo textual.
 */

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

// ------------------------------- OOXML parts --------------------------------

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

function paragraphXml(line: string): string {
  const safe = escapeXml(line);
  if (!safe) return '<w:p/>';
  return `<w:p><w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
}

function documentXml(paragraphs: string[]): string {
  const body = paragraphs.map(paragraphXml).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body>
</w:document>`;
}

/**
 * Constroi um buffer .docx valido a partir de paragrafos de texto.
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
