import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

export interface DocumentEditorStatus {
  configured: boolean;
  provider: 'microsoft_365' | 'collabora' | 'onlyoffice' | 'manual' | string;
  mode: 'ONLINE' | 'MANUAL';
  url: string | null;
  autosave: boolean;
  concurrentEditing: boolean;
  message?: string;
  recommendationUrl?: string | null;
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
  editorUrl: string | null; // URL do editor WOPI com WOPISrc embutido
  accessToken: string | null;
  accessTokenTtl: number; // epoch em ms (contrato WOPI)
  wopiSrc: string | null;
}

const MANUAL_MESSAGE =
  'Editor DOCX online nao configurado. Use download/upload de nova versao ou configure Microsoft 365 para edicao segura via WOPI.';
const MICROSOFT_MESSAGE =
  'Microsoft 365 para web nao configurado. Configure DOCUMENT_EDITOR_PROVIDER=microsoft_365, DOCUMENT_EDITOR_WOPI_BASE e MICROSOFT_365_WOPI_ACTION_URL. Para empresas sem licenca Microsoft 365, recomendamos contratar a licenca corporativa antes de liberar edicao online.';
const MICROSOFT_RECOMMENDATION_URL =
  'https://www.microsoft.com/pt-br/microsoft-365/business/microsoft-365-plans-and-pricing';

const DISCOVERY_TTL_MS = 60 * 60 * 1000; // 1h
const DEFAULT_TOKEN_TTL_MS = 10 * 60 * 60 * 1000; // 10h

@Injectable()
export class DocumentEditorService {
  private readonly logger = new Logger('DocumentEditorService');
  /** Cache da discovery WOPI: ext (docx) -> urlsrc do editor. */
  private discoveryCache: { fetchedAt: number; actions: Map<string, string> } | null = null;
  /** Locks WOPI em memoria (1 instancia). fileId -> { lock, expiresAt }. */
  private readonly locks = new Map<string, { lock: string; expiresAt: number }>();

  get provider(): string {
    const raw = (process.env.DOCUMENT_EDITOR_PROVIDER ?? 'manual').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (['microsoft', 'microsoft365', 'microsoft_365', 'office', 'office_online', 'office_for_web'].includes(raw)) return 'microsoft_365';
    if (raw === 'collabora_online') return 'collabora';
    return raw || 'manual';
  }

  /** URL publica do editor WOPI ou action URL Microsoft, sem barra final. */
  get serverUrl(): string | null {
    const raw =
      this.provider === 'microsoft_365'
        ? (process.env.MICROSOFT_365_WOPI_ACTION_URL ?? process.env.DOCUMENT_EDITOR_URL ?? '').trim()
        : (process.env.DOCUMENT_EDITOR_URL ?? '').trim();
    return raw ? raw.replace(/\/+$/, '') : null;
  }

  /**
   * Base publica da API que o Document Server usa para chamar o host WOPI
   * (ex.: https://gestao360.org/api). Precisa ser alcancavel pelo Microsoft 365
   * para web ou pelo document server. Sem ela, o editor online nao consegue
   * ler/salvar o arquivo.
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
          'DOCUMENT_EDITOR_WOPI_BASE ausente: defina a URL publica da API (ex.: https://seu-dominio/api) que o editor WOPI deve usar para ler/salvar os documentos.';
      } else if (this.provider === 'microsoft_365') {
        message = MICROSOFT_MESSAGE;
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
      recommendationUrl: this.provider === 'microsoft_365' || !online ? MICROSOFT_RECOMMENDATION_URL : null,
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
   * editor WOPI com o WOPISrc embutido, apontando para o host WOPI.
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
        editorUrl = appendEditorParams(urlsrc, wopiSrc, this.provider);
      } else {
        message = this.provider === 'microsoft_365'
          ? 'Nao foi possivel resolver a action URL do Microsoft 365 para web.'
          : 'Nao foi possivel resolver a URL do editor a partir da discovery WOPI.';
      }
    } catch (err) {
      this.logger.error(`Falha ao resolver editor WOPI: ${(err as Error).message}`);
      message = this.provider === 'microsoft_365'
        ? 'Microsoft 365 para web inacessivel ou action URL invalida. Verifique MICROSOFT_365_WOPI_ACTION_URL.'
        : 'Servidor de documentos inacessivel (discovery). Verifique DOCUMENT_EDITOR_URL e a rede.';
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
   * document server (`/hosting/discovery`), com cache de 1h.
   */
  private async resolveEditorUrl(fileName: string): Promise<string | null> {
    if (this.provider === 'microsoft_365') return this.resolveMicrosoftEditorUrl();
    const ext = (fileName.split('.').pop() ?? 'docx').toLowerCase();
    const actions = await this.loadDiscovery();
    return actions.get(ext) ?? actions.get('docx') ?? null;
  }

  private resolveMicrosoftEditorUrl(): string | null {
    const actionUrl = this.serverUrl;
    if (!actionUrl) return null;
    return actionUrl;
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
 * edicao (name="edit"). Tolerante ao formato de document servers WOPI.
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

function appendEditorParams(urlsrc: string, wopiSrc: string, provider: string): string {
  if (urlsrc.includes('{wopiSrc}')) return urlsrc.replace('{wopiSrc}', encodeURIComponent(wopiSrc));
  if (urlsrc.includes('{WOPISrc}')) return urlsrc.replace('{WOPISrc}', encodeURIComponent(wopiSrc));
  const sep = urlsrc.includes('?') ? (urlsrc.endsWith('?') || urlsrc.endsWith('&') ? '' : '&') : '?';
  const locale = provider === 'microsoft_365' ? '&ui=pt-BR&rs=pt-BR' : '&lang=pt-BR&closebutton=1';
  return `${urlsrc}${sep}WOPISrc=${encodeURIComponent(wopiSrc)}${locale}`;
}
