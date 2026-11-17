/**
 * PDF oficial do GED (pdf-lib, MIT).
 *
 * - `renderStructuredPdf`: documento do editor visual (JSON Tiptap) com
 *   cabeçalho controlado, numeração "Página X de Y", QR Code da revisão vigente
 *   e página final com o registro das assinaturas eletrônicas.
 * - `renderTextPdf`: mesmo layout a partir de texto/markdown (legado ou texto
 *   extraído do Word quando a conversão fiel não está disponível).
 * - `stampPdf`: carimba um PDF pronto (convertido do Word ou anexado) com a
 *   linha de controle em cada página e anexa o registro de assinaturas.
 * - `watermarkPdf`: marca d'água das cópias baixadas.
 */
import { PDFDocument, PDFFont, PDFImage, PDFPage, RGB, StandardFonts, degrees, rgb } from 'pdf-lib';
import * as QRCode from 'qrcode';
import { markdownToDoc, type DocNode } from '@g360/shared';

const A4: [number, number] = [595.28, 841.89];
const MARGIN_X = 56;
const CONTENT_TOP = 112;
const CONTENT_BOTTOM = 70;
const TEXT_COLOR = rgb(0.13, 0.15, 0.19);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.8, 0.82, 0.86);
const BRAND = rgb(0.11, 0.33, 0.72);
const HEADER_FILL = rgb(0.93, 0.95, 0.98);
const ALERT = rgb(0.7, 0.12, 0.12);

export interface PdfDocumentMeta {
  companyName: string;
  code: string;
  title: string;
  revision: string;
  typeName: string;
  statusLabel: string;
  publishedAt?: string | null;
  validUntil?: string | null;
  areaName?: string | null;
  ownerName?: string | null;
  confidentialityLabel?: string | null;
  readerUrl?: string | null;
  contentHash?: string | null;
  /** Observação exibida no topo do conteúdo (ex.: PDF gerado a partir do texto). */
  notice?: string | null;
}

export interface PdfSignatureRow {
  stage: string;
  name: string;
  decision: string;
  at: string;
  verification: string;
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
  mono: PDFFont;
}

interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: boolean;
}

type LaidPiece = { text: string; run: Run; width: number };

async function loadFonts(pdf: PDFDocument): Promise<Fonts> {
  const [regular, bold, italic, boldItalic, mono] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
    pdf.embedFont(StandardFonts.HelveticaOblique),
    pdf.embedFont(StandardFonts.HelveticaBoldOblique),
    pdf.embedFont(StandardFonts.Courier),
  ]);
  return { regular, bold, italic, boldItalic, mono };
}

const REPLACEMENTS: Record<string, string> = {
  '≥': '>=',
  '≤': '<=',
  '→': '->',
  '←': '<-',
  '✓': 'v',
  '✔': 'v',
  '✗': 'x',
  ' ': ' ',
  '\t': '    ',
  '​': '',
  '﻿': '',
};

/** As fontes padrão do PDF usam WinAnsi: troca o que não existe nesse conjunto. */
function makeSanitizer(font: PDFFont) {
  const allowed = new Set(font.getCharacterSet());
  return (value: string | null | undefined): string => {
    let out = '';
    for (const char of value ?? '') {
      if (char === '\n') {
        out += char;
        continue;
      }
      const code = char.codePointAt(0) ?? 63;
      if (allowed.has(code)) {
        out += char;
      } else if (char in REPLACEMENTS) {
        out += REPLACEMENTS[char];
      } else {
        const folded = char.normalize('NFD').replace(/[̀-ͯ]/g, '');
        out += folded && [...folded].every((piece) => allowed.has(piece.codePointAt(0) ?? -1)) ? folded : '?';
      }
    }
    return out;
  };
}

function runsOf(node: DocNode | undefined, inherited: Partial<Run> = {}): Run[] {
  const runs: Run[] = [];
  for (const child of node?.content ?? []) {
    if (child.type === 'text') {
      const marks = new Set((child.marks ?? []).map((mark) => mark.type));
      runs.push({
        text: child.text ?? '',
        bold: inherited.bold || marks.has('bold'),
        italic: inherited.italic || marks.has('italic'),
        underline: marks.has('underline'),
        strike: marks.has('strike'),
        code: marks.has('code'),
        link: marks.has('link'),
      });
    } else if (child.type === 'hardBreak') {
      runs.push({ text: '\n' });
    } else if (child.content) {
      runs.push(...runsOf(child, inherited));
    }
  }
  return runs;
}

class PdfWriter {
  page!: PDFPage;
  y = 0;
  readonly pages: PDFPage[] = [];
  readonly width = A4[0] - MARGIN_X * 2;

  constructor(
    private readonly pdf: PDFDocument,
    readonly fonts: Fonts,
    readonly clean: (value: string | null | undefined) => string,
  ) {
    this.addPage();
  }

  addPage() {
    this.page = this.pdf.addPage(A4);
    this.pages.push(this.page);
    this.y = A4[1] - CONTENT_TOP;
  }

  ensure(height: number) {
    if (this.y - height < CONTENT_BOTTOM) this.addPage();
  }

  fontFor(run: Run): PDFFont {
    if (run.code) return this.fonts.mono;
    if (run.bold && run.italic) return this.fonts.boldItalic;
    if (run.bold) return this.fonts.bold;
    if (run.italic) return this.fonts.italic;
    return this.fonts.regular;
  }

  layout(runs: Run[], size: number, maxWidth: number): LaidPiece[][] {
    const lines: LaidPiece[][] = [];
    let line: LaidPiece[] = [];
    let lineWidth = 0;
    const push = () => {
      while (line.length && /^\s+$/.test(line[line.length - 1].text)) line.pop();
      lines.push(line);
      line = [];
      lineWidth = 0;
    };
    for (const run of runs) {
      const font = this.fontFor(run);
      for (const part of this.clean(run.text).split(/(\n)/)) {
        if (part === '\n') {
          push();
          continue;
        }
        for (let token of part.match(/\s+|[^\s]+/g) ?? []) {
          const isSpace = /^\s+$/.test(token);
          if (isSpace) {
            if (!line.length) continue;
            token = ' ';
          }
          let width = font.widthOfTextAtSize(token, size);
          if (lineWidth + width > maxWidth && line.length) {
            push();
            if (isSpace) continue;
          }
          while (!isSpace && width > maxWidth && token.length > 1) {
            let cut = token.length - 1;
            while (cut > 1 && font.widthOfTextAtSize(token.slice(0, cut), size) > maxWidth) cut--;
            const head = token.slice(0, cut);
            line.push({ text: head, run, width: font.widthOfTextAtSize(head, size) });
            push();
            token = token.slice(cut);
            width = font.widthOfTextAtSize(token, size);
          }
          if (token) {
            line.push({ text: token, run, width });
            lineWidth += width;
          }
        }
      }
    }
    if (line.length) push();
    return lines.length ? lines : [[]];
  }

  paragraph(runs: Run[], opts: { size?: number; indent?: number; bullet?: string; spacingAfter?: number; color?: RGB; lineHeight?: number; keepWithNext?: number } = {}) {
    const size = opts.size ?? 10;
    const lineHeight = opts.lineHeight ?? size * 1.42;
    const indent = opts.indent ?? 0;
    const lines = this.layout(runs, size, this.width - indent);
    if (opts.keepWithNext) this.ensure(lineHeight * Math.min(lines.length, 2) + opts.keepWithNext);
    lines.forEach((line, index) => {
      this.ensure(lineHeight);
      const baseline = this.y - size;
      if (index === 0 && opts.bullet) {
        const bullet = this.clean(opts.bullet);
        const bulletWidth = this.fonts.regular.widthOfTextAtSize(bullet, size);
        this.page.drawText(bullet, { x: MARGIN_X + indent - bulletWidth - 5, y: baseline, size, font: this.fonts.regular, color: TEXT_COLOR });
      }
      let x = MARGIN_X + indent;
      for (const piece of line) {
        const font = this.fontFor(piece.run);
        const color = piece.run.link ? BRAND : opts.color ?? TEXT_COLOR;
        this.page.drawText(piece.text, { x, y: baseline, size, font, color });
        if (piece.run.underline || piece.run.link) {
          this.page.drawLine({ start: { x, y: baseline - 1.4 }, end: { x: x + piece.width, y: baseline - 1.4 }, thickness: 0.5, color });
        }
        if (piece.run.strike) {
          this.page.drawLine({ start: { x, y: baseline + size * 0.3 }, end: { x: x + piece.width, y: baseline + size * 0.3 }, thickness: 0.5, color });
        }
        x += piece.width;
      }
      this.y -= lineHeight;
    });
    this.y -= opts.spacingAfter ?? 4;
  }

  heading(node: DocNode) {
    const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 1)));
    const size = level === 1 ? 14 : level === 2 ? 12 : 10.5;
    this.y -= level === 1 ? 8 : 5;
    this.paragraph(runsOf(node, { bold: true }), { size, color: level === 1 ? BRAND : TEXT_COLOR, spacingAfter: level === 1 ? 6 : 4, keepWithNext: 28 });
  }

  rule() {
    this.ensure(12);
    this.page.drawLine({ start: { x: MARGIN_X, y: this.y - 5 }, end: { x: MARGIN_X + this.width, y: this.y - 5 }, thickness: 0.6, color: LINE });
    this.y -= 12;
  }

  table(node: DocNode) {
    const rows = (node.content ?? []).filter((row) => row.type === 'tableRow');
    if (!rows.length) return;
    const span = (cell: DocNode) => Math.max(1, Number(cell.attrs?.colspan ?? 1) || 1);
    const columns = Math.max(1, ...rows.map((row) => (row.content ?? []).reduce((total, cell) => total + span(cell), 0)));
    const weights = new Array<number>(columns).fill(1);
    for (const row of rows) {
      let column = 0;
      for (const cell of row.content ?? []) {
        const length = Math.min(80, runsOf({ type: 'cell', content: cell.content }).map((run) => run.text).join('').length);
        if (span(cell) === 1) weights[column] = Math.max(weights[column], Math.sqrt(length + 6));
        column += span(cell);
      }
    }
    const total = weights.reduce((sum, value) => sum + value, 0);
    const widths = weights.map((weight) => (weight / total) * this.width);
    const size = 9;
    const pad = 4;
    const lineHeight = size * 1.35;
    const headerRow = (rows[0].content ?? []).every((cell) => cell.type === 'tableHeader') ? rows[0] : null;

    const drawRow = (row: DocNode, isHeader: boolean) => {
      let column = 0;
      const cells = (row.content ?? []).map((cell) => {
        const start = column;
        const width = widths.slice(start, start + span(cell)).reduce((sum, value) => sum + value, 0);
        column += span(cell);
        const runs = (cell.content ?? []).flatMap((child, index) => [
          ...(index > 0 ? [{ text: '\n' }] : []),
          ...runsOf(child, { bold: isHeader || cell.type === 'tableHeader' }),
        ]);
        return { x: MARGIN_X + widths.slice(0, start).reduce((sum, value) => sum + value, 0), width, lines: this.layout(runs, size, width - pad * 2) };
      });
      const height = Math.max(1, ...cells.map((cell) => cell.lines.length)) * lineHeight + pad * 2;
      if (this.y - height < CONTENT_BOTTOM) {
        this.addPage();
        if (headerRow && !isHeader) drawRow(headerRow, true);
      }
      for (const cell of cells) {
        if (isHeader) this.page.drawRectangle({ x: cell.x, y: this.y - height, width: cell.width, height, color: HEADER_FILL });
        this.page.drawRectangle({ x: cell.x, y: this.y - height, width: cell.width, height, borderColor: LINE, borderWidth: 0.6 });
        cell.lines.forEach((line, index) => {
          let x = cell.x + pad;
          const baseline = this.y - pad - size - index * lineHeight + 1.5;
          for (const piece of line) {
            this.page.drawText(piece.text, { x, y: baseline, size, font: this.fontFor(piece.run), color: TEXT_COLOR });
            x += piece.width;
          }
        });
      }
      this.y -= height;
    };

    this.ensure(lineHeight * 2 + pad * 4);
    rows.forEach((row, index) => drawRow(row, Boolean(headerRow) && index === 0));
    this.y -= 8;
  }

  async image(node: DocNode) {
    const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(String(node.attrs?.src ?? ''));
    if (!match) return;
    let embedded: PDFImage;
    try {
      const bytes = Buffer.from(match[2], 'base64');
      embedded = match[1].toLowerCase() === 'png' ? await this.pdf.embedPng(bytes) : await this.pdf.embedJpg(bytes);
    } catch {
      return; // imagem corrompida não derruba o PDF
    }
    const naturalWidth = embedded.width * 0.75;
    const naturalHeight = embedded.height * 0.75;
    const scale = Math.min(1, this.width / naturalWidth, 340 / naturalHeight);
    const width = naturalWidth * scale;
    const height = naturalHeight * scale;
    this.ensure(height + 8);
    this.page.drawImage(embedded, { x: MARGIN_X + (this.width - width) / 2, y: this.y - height, width, height });
    this.y -= height + 6;
    const caption = String(node.attrs?.alt ?? node.attrs?.title ?? '').trim();
    if (caption) this.paragraph([{ text: caption, italic: true }], { size: 8, color: MUTED });
    this.y -= 4;
  }

  async list(node: DocNode, depth: number) {
    const ordered = node.type === 'orderedList';
    let number = Number(node.attrs?.start ?? 1) || 1;
    for (const item of node.content ?? []) {
      const bullet = ordered ? `${number++}.` : depth % 2 === 0 ? '•' : '–';
      let first = true;
      for (const child of item.content ?? []) {
        if (child.type === 'paragraph') {
          this.paragraph(runsOf(child), { indent: 18 + depth * 16, bullet: first ? bullet : undefined, spacingAfter: 1.5 });
          first = false;
        } else if (child.type === 'bulletList' || child.type === 'orderedList') {
          await this.list(child, depth + 1);
        } else {
          await this.block(child, depth + 1);
        }
      }
      if (first) this.paragraph([{ text: '' }], { indent: 18 + depth * 16, bullet, spacingAfter: 1.5 });
    }
    this.y -= 3;
  }

  async block(node: DocNode, depth = 0): Promise<void> {
    switch (node.type) {
      case 'heading':
        this.heading(node);
        break;
      case 'paragraph':
        this.paragraph(runsOf(node), { indent: depth ? 18 + (depth - 1) * 16 : 0 });
        break;
      case 'bulletList':
      case 'orderedList':
        await this.list(node, depth);
        break;
      case 'table':
        this.table(node);
        break;
      case 'image':
        await this.image(node);
        break;
      case 'horizontalRule':
        this.rule();
        break;
      case 'blockquote':
        for (const child of node.content ?? []) this.paragraph(runsOf(child, { italic: true }), { indent: 14, color: MUTED });
        break;
      case 'codeBlock':
        this.paragraph([{ text: (node.content ?? []).map((child) => child.text ?? '').join(''), code: true }], { size: 8.5, indent: 8 });
        break;
      default:
        for (const child of node.content ?? []) await this.block(child, depth);
    }
  }

  async render(doc: DocNode) {
    for (const node of doc.content ?? []) await this.block(node);
  }

  signatures(meta: PdfDocumentMeta, rows: PdfSignatureRow[]) {
    this.addPage();
    this.heading({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Registro de aprovação' }] });
    this.paragraph(
      [{ text: 'Este documento foi analisado e aprovado eletronicamente no Gestão 360. Cada decisão abaixo foi confirmada com a senha do responsável e registrada com data, hora e código de verificação.' }],
      { size: 9.5, color: MUTED, spacingAfter: 10 },
    );
    const header = ['Etapa', 'Responsável', 'Decisão', 'Data e hora', 'Verificação'];
    const cell = (text: string, head = false): DocNode => ({ type: head ? 'tableHeader' : 'tableCell', content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : undefined }] });
    const table: DocNode = {
      type: 'table',
      content: [
        { type: 'tableRow', content: header.map((text) => cell(text, true)) },
        ...(rows.length
          ? rows.map((row) => ({ type: 'tableRow', content: [cell(row.stage), cell(row.name), cell(row.decision), cell(row.at), cell(row.verification)] }))
          : [{ type: 'tableRow', content: [cell('Sem decisões registradas'), cell(''), cell(''), cell(''), cell('')] }]),
      ],
    };
    this.table(table);
    if (meta.contentHash) {
      this.paragraph([{ text: 'Código de integridade do conteúdo aprovado (SHA-256):', bold: true }], { size: 8.5, spacingAfter: 1 });
      this.paragraph([{ text: meta.contentHash, code: true }], { size: 7.5, spacingAfter: 8 });
    }
    if (meta.readerUrl) {
      this.paragraph([{ text: 'Consulte sempre a revisão vigente pelo QR Code ou pelo endereço:', bold: true }], { size: 8.5, spacingAfter: 1 });
      this.paragraph([{ text: meta.readerUrl, link: true }], { size: 8, spacingAfter: 8 });
    }
  }
}

async function qrImage(pdf: PDFDocument, url: string | null | undefined): Promise<PDFImage | null> {
  if (!url) return null;
  try {
    const png = await QRCode.toBuffer(url, { type: 'png', margin: 1, width: 220, errorCorrectionLevel: 'M' });
    return await pdf.embedPng(png);
  } catch {
    return null;
  }
}

function fitText(font: PDFFont, text: string, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let cut = text.length;
  while (cut > 1 && font.widthOfTextAtSize(`${text.slice(0, cut)}…`, size) > maxWidth) cut--;
  return `${text.slice(0, cut)}…`;
}

/** Cabeçalho e rodapé controlados em todas as páginas geradas pelo GED. */
function decorate(pages: PDFPage[], fonts: Fonts, clean: (value: string | null | undefined) => string, meta: PdfDocumentMeta, qr: PDFImage | null, offset = 0, totalOverride?: number) {
  const total = totalOverride ?? pages.length;
  pages.forEach((page, index) => {
    const { width, height } = page.getSize();
    const right = width - MARGIN_X;
    const showQr = Boolean(qr) && index === 0;
    const qrSize = 46;
    const reserved = showQr ? qrSize + 10 : 0;
    const code = clean(`${meta.code} · ${meta.revision}`);
    const codeWidth = fonts.bold.widthOfTextAtSize(code, 10);
    page.drawText(fitText(fonts.bold, clean(meta.companyName), 8.5, width - MARGIN_X * 2 - codeWidth - reserved - 16), { x: MARGIN_X, y: height - 40, size: 8.5, font: fonts.bold, color: MUTED });
    page.drawText(code, { x: right - reserved - codeWidth, y: height - 40, size: 10, font: fonts.bold, color: TEXT_COLOR });
    page.drawText(fitText(fonts.bold, clean(meta.title), 11.5, width - MARGIN_X * 2 - reserved), { x: MARGIN_X, y: height - 58, size: 11.5, font: fonts.bold, color: TEXT_COLOR });
    const details = [
      meta.typeName,
      meta.statusLabel,
      meta.publishedAt ? `Publicado em ${meta.publishedAt}` : null,
      meta.validUntil ? `Válido até ${meta.validUntil}` : null,
      meta.areaName ? `Área: ${meta.areaName}` : null,
    ].filter(Boolean).join(' · ');
    page.drawText(fitText(fonts.regular, clean(details), 7.5, width - MARGIN_X * 2 - reserved), { x: MARGIN_X, y: height - 72, size: 7.5, font: fonts.regular, color: MUTED });
    page.drawLine({ start: { x: MARGIN_X, y: height - 82 }, end: { x: right, y: height - 82 }, thickness: 0.8, color: LINE });
    if (showQr && qr) page.drawImage(qr, { x: right - qrSize, y: height - 80, width: qrSize, height: qrSize });

    page.drawLine({ start: { x: MARGIN_X, y: 52 }, end: { x: right, y: 52 }, thickness: 0.5, color: LINE });
    const pageText = clean(`Página ${index + 1 + offset} de ${total}`);
    page.drawText(pageText, { x: right - fonts.regular.widthOfTextAtSize(pageText, 8), y: 38, size: 8, font: fonts.regular, color: MUTED });
    const note = clean('Documento controlado eletronicamente no Gestão 360. A cópia impressa ou baixada não é controlada.');
    page.drawText(fitText(fonts.regular, note, 7, width - MARGIN_X * 2 - 80), { x: MARGIN_X, y: 38, size: 7, font: fonts.regular, color: MUTED });
    if (meta.confidentialityLabel) {
      page.drawText(clean(meta.confidentialityLabel.toUpperCase()), { x: MARGIN_X, y: 26, size: 7.5, font: fonts.bold, color: ALERT });
    }
  });
}

function setInfo(pdf: PDFDocument, meta: PdfDocumentMeta) {
  pdf.setTitle(`${meta.code} - ${meta.title}`);
  pdf.setSubject(`${meta.typeName} · ${meta.revision}`);
  pdf.setAuthor(meta.companyName);
  pdf.setCreator('Gestão 360 - Documentos');
  pdf.setProducer('Gestão 360');
  pdf.setCreationDate(new Date());
}

/** PDF oficial a partir do documento do editor visual. */
export async function renderStructuredPdf(input: { meta: PdfDocumentMeta; doc: DocNode; signatures?: PdfSignatureRow[] }): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  setInfo(pdf, input.meta);
  const fonts = await loadFonts(pdf);
  const clean = makeSanitizer(fonts.regular);
  const writer = new PdfWriter(pdf, fonts, clean);
  if (input.meta.notice) writer.paragraph([{ text: input.meta.notice, italic: true }], { size: 8.5, color: MUTED, spacingAfter: 8 });
  await writer.render(input.doc);
  if (input.signatures) writer.signatures(input.meta, input.signatures);
  decorate(writer.pages, fonts, clean, input.meta, await qrImage(pdf, input.meta.readerUrl));
  return Buffer.from(await pdf.save());
}

/** PDF oficial a partir de texto/markdown simples. */
export async function renderTextPdf(input: { meta: PdfDocumentMeta; text: string; signatures?: PdfSignatureRow[] }): Promise<Buffer> {
  return renderStructuredPdf({ meta: input.meta, doc: markdownToDoc(input.text), signatures: input.signatures });
}

/** Carimba um PDF pronto (Word convertido ou PDF anexado) e anexa o registro de assinaturas. */
export async function stampPdf(input: { meta: PdfDocumentMeta; pdf: Buffer; signatures?: PdfSignatureRow[] }): Promise<Buffer> {
  const pdf = await PDFDocument.load(input.pdf, { ignoreEncryption: true });
  setInfo(pdf, input.meta);
  const fonts = await loadFonts(pdf);
  const clean = makeSanitizer(fonts.regular);
  const original = pdf.getPages();
  let manifestPages: PDFPage[] = [];
  if (input.signatures) {
    const writer = new PdfWriter(pdf, fonts, clean);
    // O construtor abriu uma página em branco; a primeira página do registro é ela.
    writer.signatures(input.meta, input.signatures);
    pdf.removePage(pdf.getPageCount() - writer.pages.length);
    manifestPages = writer.pages.slice(1);
  }
  const total = original.length + manifestPages.length;
  original.forEach((page, index) => {
    const { width } = page.getSize();
    const line = clean(`${input.meta.code} · ${input.meta.revision} · ${input.meta.statusLabel} · Página ${index + 1} de ${total} · Documento controlado eletronicamente no Gestão 360`);
    page.drawText(fitText(fonts.regular, line, 6.5, width - 40), { x: 20, y: 10, size: 6.5, font: fonts.regular, color: MUTED });
  });
  if (manifestPages.length) decorate(manifestPages, fonts, clean, input.meta, await qrImage(pdf, input.meta.readerUrl), original.length, total);
  return Buffer.from(await pdf.save());
}

/** Marca d'água da cópia baixada (quem baixou e quando). */
export async function watermarkPdf(source: Buffer, text: string, footer: string): Promise<Buffer> {
  const pdf = await PDFDocument.load(source, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const small = await pdf.embedFont(StandardFonts.Helvetica);
  const clean = makeSanitizer(small);
  const mark = clean(text);
  const bottom = clean(footer);
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    const size = Math.max(18, Math.min(width, height) / 22);
    const textWidth = font.widthOfTextAtSize(mark, size);
    const angle = 35;
    const radians = (angle * Math.PI) / 180;
    page.drawText(mark, {
      x: width / 2 - (textWidth / 2) * Math.cos(radians),
      y: height / 2 - (textWidth / 2) * Math.sin(radians),
      size,
      font,
      color: rgb(0.7, 0.14, 0.14),
      opacity: 0.13,
      rotate: degrees(angle),
    });
    page.drawText(fitText(small, bottom, 6.5, width - 40), { x: 20, y: 2.5, size: 6.5, font: small, color: ALERT });
  }
  return Buffer.from(await pdf.save());
}
