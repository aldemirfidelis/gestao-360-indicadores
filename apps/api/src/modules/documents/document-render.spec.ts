import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { PDFDocument } from 'pdf-lib';
import { markdownToDoc } from '@g360/shared';
import { renderStructuredPdf, stampPdf, watermarkPdf, type PdfDocumentMeta } from './pdf-render';
import { buildDocxFromDoc, docxHasMacros, extractDocxText, isDocxBuffer, readZipEntries } from './docx.util';
import { DocumentStorageService } from './document-storage.service';

const PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const meta: PdfDocumentMeta = {
  companyName: 'Empresa Ação & Cia',
  code: 'POP-001',
  title: 'Higienização das mãos — produção',
  revision: 'Rev. 02',
  typeName: 'Procedimento Operacional Padrão (POP)',
  statusLabel: 'Vigente',
  publishedAt: '16/11/2026',
  validUntil: '16/11/2027',
  areaName: 'Produção',
  readerUrl: 'https://gestao360.org/documents/d1/leitor',
  contentHash: 'a'.repeat(64),
};

const doc = (() => {
  const base = markdownToDoc(
    [
      '# 1. Objetivo',
      'Garantir a **higienização** correta das mãos ✓ antes de entrar na linha 🚀.',
      '# 2. Responsabilidades',
      '| Função | Responsabilidade |',
      '|---|---|',
      ...Array.from({ length: 30 }, (_, index) => `| Operador ${index + 1} | Executa o passo ${index + 1} e registra no formulário FOR-010 |`),
      '# 3. Passo a passo',
      '1. Molhar as mãos',
      '2. Aplicar sabão e esfregar por 40 segundos',
      '- Atenção ao espaço entre os dedos',
    ].join('\n'),
  );
  base.content!.push({ type: 'image', attrs: { src: PIXEL_PNG, alt: 'Pia de higienização' } });
  return base;
})();

describe('PDF oficial do GED', () => {
  it('gera PDF real com várias páginas, caracteres especiais e registro de assinaturas', async () => {
    const pdf = await renderStructuredPdf({
      meta,
      doc,
      signatures: [{ stage: 'Aprovação', name: 'Gestora Qualidade', decision: 'Aprovado', at: '16/11/2026 10:00', verification: 'ABC123DEF456' }],
    });
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const loaded = await PDFDocument.load(pdf);
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(3);
    expect(loaded.getTitle()).toBe('POP-001 - Higienização das mãos — produção');
  });

  it('carimba PDF pronto e anexa o registro de assinaturas', async () => {
    const source = await PDFDocument.create();
    source.addPage([595.28, 841.89]);
    source.addPage([595.28, 841.89]);
    const stamped = await stampPdf({ meta, pdf: Buffer.from(await source.save()), signatures: [] });
    expect((await PDFDocument.load(stamped)).getPageCount()).toBe(3);
  });

  it('marca d’água preserva as páginas da cópia baixada', async () => {
    const original = await renderStructuredPdf({ meta, doc: markdownToDoc('Texto curto') });
    const copy = await watermarkPdf(original, 'CÓPIA NÃO CONTROLADA · Ana Ção', 'Baixado por Ana em 16/11/2026');
    expect((await PDFDocument.load(copy)).getPageCount()).toBe((await PDFDocument.load(original)).getPageCount());
  });
});

describe('Word a partir do editor visual', () => {
  it('gera .docx válido com tabela, listas e foto embutida', () => {
    const buffer = buildDocxFromDoc(doc as any, { companyName: 'Empresa', code: 'POP-001', title: 'Higienização', revision: 'Rev. 02', status: 'Vigente' });
    expect(isDocxBuffer(buffer)).toBe(true);
    const text = extractDocxText(buffer) ?? '';
    expect(text).toContain('Higienização');
    expect(text).toContain('Aplicar sabão');
    const entries = readZipEntries(buffer)!.map((entry) => entry.name);
    expect(entries).toContain('word/media/image1.png');
    expect(entries).toContain('word/_rels/document.xml.rels');
    expect(docxHasMacros(buffer)).toBe(false);
  });
});

describe('Arquivos guardados no banco', () => {
  const previous = process.env.DOCUMENT_STORAGE_PROVIDER;
  let dir = '';
  afterEach(() => {
    process.env.DOCUMENT_STORAGE_PROVIDER = previous;
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  it('padrão: grava e lê do Postgres com chave db:', async () => {
    delete process.env.DOCUMENT_STORAGE_PROVIDER;
    const prisma: any = {
      documentBlob: {
        create: vi.fn(async ({ data }: any) => ({ id: 'blob1', ...data })),
        findUnique: vi.fn().mockResolvedValue({ data: Buffer.from('conteudo') }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const storage = new DocumentStorageService(prisma);
    const stored = await storage.putBinary('companyA', 'documents/d1', 'Ação técnica.pdf', Buffer.from('conteudo'), 'application/pdf');
    expect(stored).toMatchObject({ storageProvider: 'DATABASE', storageKey: 'db:blob1', fileName: 'Acao-tecnica.pdf', sizeBytes: 8 });
    expect(prisma.documentBlob.create.mock.calls[0][0].data.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect((await storage.readBinary('db:blob1')).toString()).toBe('conteudo');
    await storage.remove('db:blob1');
    expect(prisma.documentBlob.deleteMany).toHaveBeenCalledWith({ where: { id: 'blob1' } });
  });

  it('arquivos antigos em disco continuam legíveis (LOCAL)', async () => {
    dir = mkdtempSync(join(tmpdir(), 'ged-storage-'));
    process.env.DOCUMENT_STORAGE_PROVIDER = 'LOCAL';
    const previousPath = process.env.DOCUMENT_STORAGE_PATH;
    process.env.DOCUMENT_STORAGE_PATH = dir;
    const storage = new DocumentStorageService({} as any);
    const stored = await storage.putText('companyA', 'docs', 'nota.txt', 'texto legado', 'text/plain');
    expect(stored.storageProvider).toBe('LOCAL');
    expect(await storage.readText(stored.storageKey)).toBe('texto legado');
    process.env.DOCUMENT_STORAGE_PATH = previousPath;
  });
});
