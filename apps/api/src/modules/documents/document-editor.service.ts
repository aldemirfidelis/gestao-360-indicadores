import { Injectable } from '@nestjs/common';

export interface DocumentEditorStatus {
  configured: boolean;
  provider: string;
  mode: 'ONLINE' | 'MANUAL';
  url: string | null;
  autosave: boolean;
  concurrentEditing: boolean;
  message?: string;
}

@Injectable()
export class DocumentEditorService {
  status(): DocumentEditorStatus {
    const provider = process.env.DOCUMENT_EDITOR_PROVIDER ?? 'manual';
    const url = process.env.DOCUMENT_EDITOR_URL ?? null;
    const configured = provider !== 'manual' && Boolean(url);
    return {
      configured,
      provider,
      mode: configured ? 'ONLINE' : 'MANUAL',
      url,
      autosave: configured,
      concurrentEditing: configured,
      message: configured
        ? undefined
        : 'Editor DOCX online nao configurado. Use download/upload de nova versao ate configurar DOCUMENT_EDITOR_PROVIDER e DOCUMENT_EDITOR_URL.',
    };
  }

  openPayload(documentId: string, fileId: string | null) {
    const status = this.status();
    return {
      ...status,
      documentId,
      fileId,
      providerDocumentKey: fileId ? `${documentId}:${fileId}` : documentId,
    };
  }
}
