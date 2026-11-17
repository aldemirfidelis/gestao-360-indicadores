import * as mammoth from 'mammoth';
import { extractDocxText } from './docx.util';

const MAX_IMPORT_HTML = 12 * 1024 * 1024;

/** Texto de um .docx real (busca, IA, comparação e PDF de contingência). */
export async function docxToText(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value ?? '').replace(/\n{3,}/g, '\n\n').trim();
    if (text) return text;
  } catch {
    // .docx gerado sem as partes que o mammoth espera: cai no leitor próprio.
  }
  return extractDocxText(buffer) ?? '';
}

/**
 * HTML de um .docx para importar no editor visual (títulos, listas, tabelas e
 * imagens embutidas). O editor só aceita os elementos do seu schema, então o
 * restante do HTML é descartado ao carregar.
 */
export async function docxToHtml(buffer: Buffer): Promise<{ html: string; imagesSkipped: boolean }> {
  const full = await mammoth.convertToHtml({ buffer });
  if (full.value.length <= MAX_IMPORT_HTML) return { html: full.value, imagesSkipped: false };
  const light = await mammoth.convertToHtml(
    { buffer },
    { convertImage: mammoth.images.imgElement(async () => ({ src: '' })) },
  );
  return { html: light.value, imagesSkipped: true };
}
