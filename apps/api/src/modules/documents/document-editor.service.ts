import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

export interface DocumentEditorStatus {
  configured: boolean;
  provider: string;
  mode: 'ONLINE' | 'MANUAL';
  url: string | null;
  autosave: boolean;
  concurrentEditing: boolean;
  message?: string;
}

/** Conteudo assinado dentro do access_token WOPI (stateless). */
export interface WopiTokenPayload {
  fileId: string;
  documentId: string;
  companyId: string;
  userId: string;
  userName: string;
  canWrite: boolean;
  exp: number; // epoch ms
}

/** Dados retornados ao frontend para abrir o editor online (iframe WOPI). */
export interface EditorSession extends DocumentEditorStatus {
  documentId: string;
  fileId: string | null;
  editorUrl: string | null; // URL do Collabora com WOPISrc embutido
  accessToken: string | null;
  accessTokenTtl: number; // epoch em ms (contrato WOPI)
  wopiSrc: string | null;
}

const MANUAL_MESSAGE =
  'Editor DOCX online nao configurado. Use download/upload de nova versao ate configurar DOCUMENT_EDITOR_PROVIDER e DOCUMENT_EDITOR_URL.';

const DISCOVERY_TTL_MS = 60 * 60 * 1000; // 1h
const DEFAULT_TOKEN_TTL_MS = 10 * 60 * 60 * 1000; // 10h

@Injectable()
export class DocumentEditorService {
  private readonly logger = new Logger('DocumentEditorService');
  /** Cache da discovery do Collabora: ext (docx) -> urlsrc do editor. */
  private discoveryCache: { fetchedAt: number; actions: Map<string, string> } | null = null;
  /** Locks WOPI em memoria (1 instancia). fileId -> { lock, expiresAt }. */
  private readonly locks = new Map<string, { lock: string; expiresAt: number }>();

  get provider(): string {
    return (process.env.DOCUMENT_EDITOR_PROVIDER ?? 'manual').trim().toLowerCase();
  }

  /** URL publica do Document Server (Collabora/ONLYOFFICE), sem barra final. */
  get serverUrl(): string | null {
    const raw = (process.env.DOCUMENT_EDITOR_URL ?? '').trim();
    return raw ? raw.replace(/\/+$/, '') : null;
  }

  /**
   * Base publica da API que o Document Server usa para chamar o host WOPI
   * (ex.: https://gestao360.org/api). Precisa ser alcancavel pelo container
   * do Collabora. Sem ela, o editor online nao consegue ler/salvar o arquivo.
   */
  get wopiBase(): string | null {
    const explicit = (process.env.DOCUMENT_EDITOR_WOPI_BASE ?? '').trim();
    if (explicit) return explicit.replace(/\/+$/, '');
    return null;
  }

  isOnline(): boolean {
    return this.provider !== 'manual' && Boolean(this.serverUrl) && Boolean(this.wopiBase);
  }

  status(): DocumentEditorStatus {
    const online = this.isOnline();
    let message: string | undefined;
    if (!online) {
      if (this.provider !== 'manual' && this.serverUrl && !this.wopiBase) {
        message =
          'DOCUMENT_EDITOR_WOPI_BASE ausente: defina a URL publica da API (ex.: https://seu-dominio/api) que o servidor Collabora deve usar para ler/salvar os documentos.';
      } else {
        message = MANUAL_MESSAGE;
      }
    }
    return {
      configured: online,
      provider: online ? this.provider : 'manual',
      mode: online ? 'ONLINE' : 'MANUAL',
      url: online ? this.serverUrl : null,
      autosave: online,
      concurrentEditing: online,
      message,
    };
  }

  /** Payload de status anexado ao detalhe do documento (sem token). */
  openPayload(documentId: string, fileId: string | null) {
    const status = this.status();
    return {
      ...status,
      documentId,
      fileId,
      providerDocumentKey: fileId ? `${documentId}:${fileId}` : documentId,
    };
  }

  // ----------------------------- access_token (WOPI) ------------------------

  private secret(): string {
    return (
      process.env.DOCUMENT_EDITOR_JWT_SECRET ||
      process.env.JWT_ACCESS_SECRET ||
      'g360-dev-editor-secret-change-me'
    );
  }

  private tokenTtlMs(): number {
    const raw = Number(process.env.DOCUMENT_EDITOR_TOKEN_TTL_MS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TOKEN_TTL_MS;
  }

  mintToken(input: Omit<WopiTokenPayload, 'exp'>): { token: string; exp: number } {
    const exp = Date.now() + this.tokenTtlMs();
    const payload: WopiTokenPayload = { ...input, exp };
    const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
    const sig = this.sign(body);
    return { token: `${body}.${sig}`, exp };
  }

  verifyToken(token: string | undefined | null): WopiTokenPayload | null {
    if (!token || typeof token !== 'string') return null;
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return null;
    const body = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = this.sign(body);
    if (!safeEqual(sig, expected)) return null;
    try {
      const payload = JSON.parse(Buffer.from(b64urlDecode(body)).toString('utf8')) as WopiTokenPayload;
      if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }

  private sign(body: string): string {
    return b64url(createHmac('sha256', this.secret()).update(body).digest());
  }

  // ------------------------------ editor (iframe) ---------------------------

  /**
   * Monta a sessao do editor online: minta o access_token e resolve a URL do
   * editor (Collabora) com o WOPISrc embutido, apontando para o host WOPI.
   */
  async buildSession(input: {
    documentId: string;
    fileId: string;
    fileName: string;
    companyId: string;
    userId: string;
    userName: string;
    canWrite: boolean;
  }): Promise<EditorSession> {
    const base = this.openPayload(input.documentId, input.fileId);
    if (!this.isOnline()) {
      return { ...base, editorUrl: null, accessToken: null, accessTokenTtl: 0, wopiSrc: null };
    }

    const wopiSrc = `${this.wopiBase}/wopi/files/${input.fileId}`;
    const { token, exp } = this.mintToken({
      fileId: input.fileId,
      documentId: input.documentId,
      companyId: input.companyId,
      userId: input.userId,
      userName: input.userName,
      canWrite: input.canWrite,
    });

    let editorUrl: string | null = null;
    let message: string | undefined;
    try {
      const urlsrc = await this.resolveEditorUrl(input.fileName);
      if (urlsrc) {
        const sep = urlsrc.includes('?') ? (urlsrc.endsWith('?') || urlsrc.endsWith('&') ? '' : '&') : '?';
        editorUrl = `${urlsrc}${sep}WOPISrc=${encodeURIComponent(wopiSrc)}&lang=pt-BR&closebutton=1`;
      } else {
        message = 'Nao foi possivel resolver a URL do editor a partir da discovery do Collabora.';
      }
    } catch (err) {
      this.logger.error(`Falha ao contatar a discovery do Collabora: ${(err as Error).message}`);
      message = 'Servidor Collabora inacessivel (discovery). Verifique DOCUMENT_EDITOR_URL e a rede.';
    }

    return {
      ...base,
      editorUrl,
      accessToken: token,
      accessTokenTtl: exp,
      wopiSrc,
      message: editorUrl ? base.message : message,
    };
  }

  /**
   * Resolve o urlsrc do editor para a extensao do arquivo via discovery do
   * Collabora (`/hosting/discovery`), com cache de 1h.
   */
  private async resolveEditorUrl(fileName: string): Promise<string | null> {
    const ext = (fileName.split('.').pop() ?? 'docx').toLowerCase();
    const actions = await this.loadDiscovery();
    return actions.get(ext) ?? actions.get('docx') ?? null;
  }

  private async loadDiscovery(): Promise<Map<string, string>> {
    const now = Date.now();
    if (this.discoveryCache && now - this.discoveryCache.fetchedAt < DISCOVERY_TTL_MS) {
      return this.discoveryCache.actions;
    }
    const url = `${this.serverUrl}/hosting/discovery`;
    const res = await fetch(url, { headers: { accept: 'application/xml' } });
    if (!res.ok) throw new Error(`discovery HTTP ${res.status}`);
    const xml = await res.text();
    const actions = parseDiscovery(xml);
    this.discoveryCache = { fetchedAt: now, actions };
    return actions;
  }

  // -------------------------------- locks (WOPI) ----------------------------

  getLock(fileId: string): string | null {
    const entry = this.locks.get(fileId);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.locks.delete(fileId);
      return null;
    }
    return entry.lock;
  }

  setLock(fileId: string, lock: string, ttlMs = 30 * 60 * 1000): void {
    this.locks.set(fileId, { lock, expiresAt: Date.now() + ttlMs });
  }

  clearLock(fileId: string): void {
    this.locks.delete(fileId);
  }
}

// ------------------------------- helpers ------------------------------------

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(value: string): Buffer {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Extrai do XML de discovery o mapa extensao -> urlsrc, preferindo a acao de
 * edicao (name="edit"). Tolerante ao formato (Collabora e ONLYOFFICE).
 */
function parseDiscovery(xml: string): Map<string, string> {
  const actions = new Map<string, string>();
  const editPreferred = new Set<string>();
  const actionRe = /<action\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = actionRe.exec(xml)) !== null) {
    const attrs = match[1];
    const ext = attr(attrs, 'ext');
    const urlsrc = attr(attrs, 'urlsrc');
    if (!ext || !urlsrc) continue;
    const name = (attr(attrs, 'name') ?? '').toLowerCase();
    const key = ext.toLowerCase();
    const isEdit = name === 'edit';
    if (!actions.has(key) || (isEdit && !editPreferred.has(key))) {
      actions.set(key, decodeXmlEntities(urlsrc));
      if (isEdit) editPreferred.add(key);
    }
  }
  return actions;
}

function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i').exec(attrs);
  return m ? m[1] : null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
