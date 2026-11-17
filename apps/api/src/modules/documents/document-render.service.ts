import { Injectable, Logger } from '@nestjs/common';
import { DocumentContentFormat, DocumentFileKind } from '@prisma/client';
import { DOCUMENT_CONFIDENTIALITY_LABEL, isDocNode, type DocNode } from '@g360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentEditorService } from './document-editor.service';
import { DocumentStorageService } from './document-storage.service';
import { docxToText } from './document-text';
import { buildDocx, buildDocxFromDoc, isDocxBuffer } from './docx.util';
import { buildPdf } from './pdf.util';
import { renderStructuredPdf, renderTextPdf, stampPdf, watermarkPdf, type PdfDocumentMeta, type PdfSignatureRow } from './pdf-render';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ZONE = 'America/Sao_Paulo';

export const DOCUMENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  IN_DEVELOPMENT: 'Em elaboração',
  WAITING_REVIEW: 'Aguardando revisão',
  REVIEW: 'Em revisão',
  IN_REVIEW: 'Em revisão',
  ADJUSTMENTS_REQUESTED: 'Ajustes solicitados',
  REVIEWED: 'Revisado',
  WAITING_APPROVAL: 'Aguardando aprovação',
  IN_APPROVAL: 'Em aprovação',
  REJECTED: 'Reprovado',
  APPROVED: 'Aprovado',
  SCHEDULED_PUBLICATION: 'Publicação agendada',
  PUBLISHED: 'Vigente',
  NEAR_EXPIRATION: 'Vigente (próximo do vencimento)',
  EXPIRED: 'Vencido',
  PERIODIC_REVIEW: 'Em revisão periódica',
  REPLACED: 'Substituído',
  OBSOLETE: 'Obsoleto',
  ARCHIVED: 'Arquivado',
  CANCELLED: 'Cancelado',
};

export const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  POLICY: 'Política',
  PROCEDURE: 'Procedimento',
  INSTRUCTION: 'Instrução de trabalho',
  MANUAL: 'Manual',
  FORM: 'Formulário',
  TEMPLATE: 'Modelo',
  RECORD: 'Registro',
  INTERNAL_STANDARD: 'Norma interna',
  GUIDELINE: 'Diretriz',
  REGULATION: 'Regulamento',
  FLOWCHART: 'Fluxograma',
  PLAN: 'Plano',
  REPORT: 'Relatório',
  CHECKLIST: 'Lista de verificação',
  TECHNICAL_SPECIFICATION: 'Especificação técnica',
  EXTERNAL: 'Documento externo',
  OTHER: 'Outro',
};

const STAGE_LABEL: Record<string, string> = { REVIEWER: 'Revisão', APPROVER: 'Aprovação', PUBLISHER: 'Publicação' };
const DECISION_LABEL: Record<string, string> = {
  APPROVED: 'Aprovado',
  REJECTED: 'Reprovado',
  ADJUSTMENTS_REQUESTED: 'Ajustes solicitados',
  DELEGATED: 'Delegado',
  PENDING: 'Pendente',
};

export function formatDateBr(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pt-BR', { timeZone: ZONE });
}

export function formatDateTimeBr(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('pt-BR', { timeZone: ZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function publicSiteUrl(): string {
  return (process.env.PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gestao360.org').trim().replace(/\/+$/, '');
}

export function readerUrl(documentId: string): string {
  return `${publicSiteUrl()}/documents/${documentId}/leitor`;
}

export type OfficialPdfSource = 'NATIVE' | 'CONVERTED' | 'TEXT' | 'FILE';

/**
 * Geração do PDF oficial e das cópias do GED.
 *
 * - Editor visual (STRUCTURED) e texto (TEXT): layout próprio (pdf-lib).
 * - Word (DOCX): conversão fiel pelo servidor de documentos (Collabora,
 *   `/cool/convert-to/pdf`) quando ele está no ar; sem ele, o PDF sai do texto
 *   extraído do Word com aviso explícito no topo.
 * - Arquivo anexado (FILE): o PDF enviado recebe o carimbo de controle.
 */
@Injectable()
export class DocumentRenderService {
  private readonly logger = new Logger(DocumentRenderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: DocumentStorageService,
    private readonly editor: DocumentEditorService,
  ) {}

  /** Endereço interno do conversor DOCX -> PDF (Collabora). */
  converterUrl(): string | null {
    const explicit = (process.env.DOCUMENT_CONVERTER_URL ?? '').trim();
    if (explicit) return explicit.replace(/\/+$/, '');
    if (this.editor.provider !== 'collabora' || !this.editor.serverUrl) return null;
    return process.env.NODE_ENV === 'production' ? 'http://collabora:9980' : this.editor.serverUrl;
  }

  async convertDocxToPdf(docx: Buffer, fileName: string): Promise<Buffer | null> {
    const base = this.converterUrl();
    if (!base) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    try {
      const form = new FormData();
      form.append('data', new Blob([new Uint8Array(docx)], { type: DOCX_MIME }), fileName.toLowerCase().endsWith('.docx') ? fileName : `${fileName}.docx`);
      const response = await fetch(`${base}/cool/convert-to/pdf`, { method: 'POST', body: form, signal: controller.signal });
      if (!response.ok) {
        this.logger.warn(`Conversão DOCX->PDF recusada: HTTP ${response.status}`);
        return null;
      }
      const pdf = Buffer.from(await response.arrayBuffer());
      return pdf.subarray(0, 5).toString('latin1') === '%PDF-' ? pdf : null;
    } catch (error) {
      this.logger.warn(`Conversão DOCX->PDF indisponível: ${(error as Error).message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async meta(doc: any, version: { versionLabel: string; contentHash?: string | null } | null, overrides: Partial<PdfDocumentMeta> = {}): Promise<PdfDocumentMeta> {
    const [company, owner, area, typeConfig] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: doc.companyId }, select: { name: true, tradeName: true } }),
      doc.ownerUserId ? this.prisma.user.findFirst({ where: { id: doc.ownerUserId }, select: { name: true } }) : null,
      doc.orgNodeId ? this.prisma.orgNode.findFirst({ where: { id: doc.orgNodeId }, select: { name: true } }) : null,
      doc.typeConfigId ? this.prisma.documentTypeConfig.findFirst({ where: { id: doc.typeConfigId }, select: { name: true } }) : null,
    ]);
    const confidentiality = String(doc.confidentiality ?? 'INTERNAL') as keyof typeof DOCUMENT_CONFIDENTIALITY_LABEL;
    return {
      companyName: company?.tradeName || company?.name || 'Gestão 360',
      code: doc.code ?? `#${doc.number}`,
      title: doc.title,
      revision: version?.versionLabel ?? `Rev. ${String(Math.max(0, (doc.version ?? 1) - 1)).padStart(2, '0')}`,
      typeName: typeConfig?.name ?? DOCUMENT_TYPE_LABEL[doc.type] ?? 'Documento',
      statusLabel: DOCUMENT_STATUS_LABEL[doc.status] ?? doc.status,
      publishedAt: formatDateBr(doc.publishedAt),
      validUntil: formatDateBr(doc.validUntil),
      areaName: area?.name ?? null,
      ownerName: owner?.name ?? null,
      confidentialityLabel: confidentiality !== 'INTERNAL' ? `Documento ${DOCUMENT_CONFIDENTIALITY_LABEL[confidentiality] ?? confidentiality}` : null,
      readerUrl: readerUrl(doc.id),
      contentHash: version?.contentHash ?? null,
      ...overrides,
    };
  }

  /** Assinaturas eletrônicas da revisão (revisores, aprovadores e publicação). */
  async signatures(companyId: string, documentId: string, versionId: string): Promise<PdfSignatureRow[]> {
    const approvals = await this.prisma.documentApproval.findMany({
      where: { companyId, documentId, versionId, signatureHash: { not: null }, decidedAt: { not: null } },
      orderBy: [{ decidedAt: 'asc' }],
    });
    const ids = [...new Set(approvals.map((item) => item.approverUserId).filter(Boolean))] as string[];
    const users = ids.length ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    const names = new Map(users.map((user) => [user.id, user.name]));
    return approvals.map((item) => ({
      stage: STAGE_LABEL[item.approverRole ?? ''] ?? item.approverRole ?? 'Decisão',
      name: (item.approverUserId && names.get(item.approverUserId)) || 'Usuário',
      decision: DECISION_LABEL[item.decision] ?? item.decision,
      at: formatDateTimeBr(item.decidedAt) ?? '',
      verification: (item.signatureHash ?? '').slice(0, 12).toUpperCase(),
    }));
  }

  /** PDF oficial da revisão a partir do formato principal do documento. */
  async officialPdf(input: {
    doc: any;
    version: any;
    signatures: PdfSignatureRow[];
  }): Promise<{ buffer: Buffer; source: OfficialPdfSource }> {
    const { doc, version, signatures } = input;
    const meta = await this.meta(doc, version);
    const format = doc.contentFormat as DocumentContentFormat;
    if (format === DocumentContentFormat.STRUCTURED) {
      const json = (isDocNode(version?.contentJson) ? version.contentJson : doc.contentJson) as DocNode | null;
      if (isDocNode(json)) return { buffer: await renderStructuredPdf({ meta, doc: json, signatures }), source: 'NATIVE' };
    }
    if (format === DocumentContentFormat.FILE) {
      const pdfFile = await this.prisma.documentFile.findFirst({
        // PDF principal (formato "PDF pronto"): anexo PDF marcado como protegido.
        where: { documentId: doc.id, companyId: doc.companyId, versionId: version?.id, kind: DocumentFileKind.ATTACHMENT, mimeType: 'application/pdf', protected: true, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (pdfFile) {
        const bytes = await this.storage.readBinary(pdfFile.storageKey);
        try {
          return { buffer: await stampPdf({ meta, pdf: bytes, signatures }), source: 'FILE' };
        } catch (error) {
          this.logger.warn(`PDF anexado não pôde ser carimbado (${(error as Error).message}); seguindo com o texto.`);
        }
      }
    }
    if (format === DocumentContentFormat.DOCX) {
      const docx = await this.latestDocx(doc, version);
      if (docx) {
        const converted = await this.convertDocxToPdf(docx.buffer, docx.fileName);
        if (converted) {
          try {
            return { buffer: await stampPdf({ meta, pdf: converted, signatures }), source: 'CONVERTED' };
          } catch (error) {
            this.logger.warn(`Falha ao carimbar o PDF convertido: ${(error as Error).message}`);
          }
        }
        const text = await docxToText(docx.buffer);
        return {
          buffer: await renderTextPdf({
            meta: { ...meta, notice: 'PDF gerado a partir do texto do arquivo Word: tabelas, imagens e estilos do arquivo original podem não aparecer. O arquivo Word oficial segue disponível no documento.' },
            text,
            signatures,
          }),
          source: 'TEXT',
        };
      }
    }
    const text = version?.bodyText ?? doc.bodyText ?? doc.content ?? doc.description ?? '';
    return { buffer: await renderTextPdf({ meta, text, signatures }), source: 'NATIVE' };
  }

  /** Último DOCX da revisão (binário real ou legado em texto convertido). */
  async latestDocx(doc: any, version: any): Promise<{ buffer: Buffer; fileName: string } | null> {
    const file = version?.docxFileId
      ? await this.prisma.documentFile.findFirst({ where: { id: version.docxFileId, companyId: doc.companyId, deletedAt: null } })
      : await this.prisma.documentFile.findFirst({ where: { documentId: doc.id, companyId: doc.companyId, kind: DocumentFileKind.DOCX, deletedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!file) return null;
    if (file.contentText != null) return { buffer: buildDocx(file.contentText), fileName: file.fileName };
    const buffer = await this.storage.readBinary(file.storageKey);
    return isDocxBuffer(buffer) ? { buffer, fileName: file.fileName } : null;
  }

  /** Word para baixar: editor visual vira .docx real; Word mantém o arquivo. */
  async exportDocx(doc: any, version: any): Promise<{ buffer: Buffer; fileName: string }> {
    const base = `${doc.code ?? `DOC-${doc.number}`}-${(version?.versionLabel ?? 'Rev').replace(/[^\w-]+/g, '')}`;
    if (doc.contentFormat === DocumentContentFormat.STRUCTURED) {
      const json = (isDocNode(version?.contentJson) && !['DRAFT', 'IN_DEVELOPMENT', 'ADJUSTMENTS_REQUESTED', 'REJECTED'].includes(doc.status) ? version.contentJson : doc.contentJson) as DocNode | null;
      const meta = await this.meta(doc, version);
      return {
        buffer: buildDocxFromDoc(isDocNode(json) ? (json as any) : { type: 'doc', content: [] }, {
          companyName: meta.companyName,
          code: meta.code,
          title: meta.title,
          revision: meta.revision,
          status: meta.statusLabel,
        }),
        fileName: `${base}.docx`,
      };
    }
    const docx = await this.latestDocx(doc, version);
    if (docx) return { buffer: docx.buffer, fileName: docx.fileName.toLowerCase().endsWith('.docx') ? docx.fileName : `${base}.docx` };
    return { buffer: buildDocx(doc.bodyText ?? doc.content ?? ''), fileName: `${base}.docx` };
  }

  /** Cópia baixada: marca d'água com quem baixou e quando. */
  async downloadCopy(pdf: Buffer, userName: string): Promise<Buffer> {
    try {
      return await watermarkPdf(
        pdf,
        `CÓPIA NÃO CONTROLADA · ${userName}`,
        `Baixado por ${userName} em ${formatDateTimeBr(new Date())}. Consulte a revisão vigente no Gestão 360.`,
      );
    } catch (error) {
      this.logger.warn(`Marca d'água não aplicada: ${(error as Error).message}`);
      return pdf;
    }
  }

  /** PDF simples de contingência para arquivos legados só com texto. */
  legacyTextPdf(text: string): Buffer {
    return buildPdf(text);
  }
}
