import { All, Controller, ForbiddenException, Param, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { Public } from '../auth/public.decorator';
import { DocumentEditorService, WopiTokenPayload } from './document-editor.service';
import { DocumentsService } from './documents.service';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const LOCK_TTL_SECONDS = 30 * 60;

/**
 * WebDAV minimalista para abrir/salvar DOCX no Word instalado.
 *
 * O Word recebe uma URL HTTPS com access_token assinado e usa GET/PUT/LOCK
 * diretamente contra a plataforma. Não há cookie/JWT de navegador aqui: a
 * autorização vem do token temporário emitido pelo fluxo aprovado de edição.
 */
@SkipThrottle()
@Controller('dav')
export class WebDavController {
  constructor(
    private readonly editor: DocumentEditorService,
    private readonly documents: DocumentsService,
  ) {}

  @Public()
  @All('files/:id/:fileName')
  async fileWithName(
    @Param('id') id: string,
    @Query('access_token') accessToken: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.handleFile(id, accessToken, req, res);
  }

  @Public()
  @All('files/:id')
  async fileWithoutName(
    @Param('id') id: string,
    @Query('access_token') accessToken: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.handleFile(id, accessToken, req, res);
  }

  @Public()
  @All('files')
  async filesRoot(@Req() req: Request, @Res() res: Response) {
    return this.handleCollection(req, res);
  }

  @Public()
  @All()
  async root(@Req() req: Request, @Res() res: Response) {
    return this.handleCollection(req, res);
  }

  private authorize(fileId: string, accessToken?: string): WopiTokenPayload {
    const token = this.editor.verifyToken(accessToken);
    if (!token || token.fileId !== fileId) {
      throw new UnauthorizedException('access_token inválido ou expirado.');
    }
    return token;
  }

  private async handleFile(fileId: string, accessToken: string | undefined, req: Request, res: Response) {
    applyDavHeaders(res);
    const method = req.method.toUpperCase();
    if (method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    const token = this.authorize(fileId, accessToken);
    switch (method) {
      case 'HEAD':
        return this.head(token, req, res);
      case 'GET':
        return this.get(token, req, res);
      case 'PUT':
        return this.put(token, req, res);
      case 'PROPFIND':
        return this.propfind(token, req, res);
      case 'LOCK':
        return this.lock(token, req, res);
      case 'UNLOCK':
        return this.unlock(token, req, res);
      default:
        res.setHeader('allow', DAV_ALLOW);
        res.status(405).end();
    }
  }

  private handleCollection(req: Request, res: Response) {
    applyDavHeaders(res);
    const method = req.method.toUpperCase();
    if (method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    if (method === 'PROPFIND') {
      res.status(207).type('application/xml; charset=utf-8').send(collectionXml(req));
      return;
    }
    res.setHeader('allow', 'OPTIONS, PROPFIND');
    res.status(405).end();
  }

  private async head(token: WopiTokenPayload, req: Request, res: Response) {
    const info = await this.documents.wopiCheckFileInfo(token);
    setFileHeaders(res, info);
    res.status(200).end();
  }

  private async get(token: WopiTokenPayload, req: Request, res: Response) {
    const [info, buffer] = await Promise.all([
      this.documents.wopiCheckFileInfo(token),
      this.documents.wopiGetFile(token),
    ]);
    setFileHeaders(res, { ...info, Size: buffer.length });
    const range = parseRange(header(req, 'range'), buffer.length);
    if (range) {
      const chunk = buffer.subarray(range.start, range.end + 1);
      res.setHeader('content-range', `bytes ${range.start}-${range.end}/${buffer.length}`);
      res.setHeader('content-length', String(chunk.length));
      res.status(206).end(chunk);
      return;
    }
    res.setHeader('content-length', String(buffer.length));
    res.status(200).end(buffer);
  }

  private async put(token: WopiTokenPayload, req: Request, res: Response) {
    if (!token.canWrite) throw new ForbiddenException('Token sem permissão de escrita.');
    const current = this.editor.getLock(token.fileId);
    if (current && !requestHasLock(req, current)) {
      res.setHeader('lock-token', `<${current}>`);
      res.status(423).end();
      return;
    }
    const buffer = Buffer.isBuffer(req.body) ? req.body : await readRawBody(req);
    const result = await this.documents.webDavPutFile(token, buffer);
    res.setHeader('etag', quoteEtag(result.version));
    res.status(204).end();
  }

  private async propfind(token: WopiTokenPayload, req: Request, res: Response) {
    const info = await this.documents.wopiCheckFileInfo(token);
    const lock = this.editor.getLock(token.fileId);
    res.status(207).type('application/xml; charset=utf-8').send(filePropfindXml(req, info, lock));
  }

  private lock(token: WopiTokenPayload, req: Request, res: Response) {
    if (!token.canWrite) throw new ForbiddenException('Token sem permissão de escrita.');
    const current = this.editor.getLock(token.fileId);
    if (current) {
      if (!requestHasLock(req, current)) {
        res.setHeader('lock-token', `<${current}>`);
        res.status(423).end();
        return;
      }
      this.editor.setLock(token.fileId, current, LOCK_TTL_SECONDS * 1000);
      res.setHeader('lock-token', `<${current}>`);
      res.setHeader('timeout', `Second-${LOCK_TTL_SECONDS}`);
      res.status(200).type('application/xml; charset=utf-8').send(lockResponseXml(req, current));
      return;
    }

    const lockToken = `opaquelocktoken:${randomUUID()}`;
    this.editor.setLock(token.fileId, lockToken, LOCK_TTL_SECONDS * 1000);
    res.setHeader('lock-token', `<${lockToken}>`);
    res.setHeader('timeout', `Second-${LOCK_TTL_SECONDS}`);
    res.status(201).type('application/xml; charset=utf-8').send(lockResponseXml(req, lockToken));
  }

  private unlock(token: WopiTokenPayload, req: Request, res: Response) {
    const current = this.editor.getLock(token.fileId);
    const requested = normalizeLockToken(header(req, 'lock-token'));
    if (!current || !requested || current !== requested) {
      if (current) res.setHeader('lock-token', `<${current}>`);
      res.status(409).end();
      return;
    }
    this.editor.clearLock(token.fileId);
    res.status(204).end();
  }
}

const DAV_ALLOW = 'OPTIONS, GET, HEAD, PUT, PROPFIND, LOCK, UNLOCK';

function applyDavHeaders(res: Response) {
  res.setHeader('dav', '1,2');
  res.setHeader('ms-author-via', 'DAV');
  res.setHeader('allow', DAV_ALLOW);
  res.setHeader('accept-ranges', 'bytes');
}

function setFileHeaders(res: Response, info: any) {
  const name = info.BaseFileName || 'documento.docx';
  res.setHeader('content-type', info.ContentType || DOCX_MIME);
  res.setHeader('content-disposition', `inline; filename="${safeHeaderFileName(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader('etag', quoteEtag(info.Version || info.SHA256 || String(info.Size ?? Date.now())));
  res.setHeader('last-modified', new Date(info.LastModifiedTime || Date.now()).toUTCString());
  res.setHeader('x-msdavext_locktimeout', String(LOCK_TTL_SECONDS));
  if (Number.isFinite(Number(info.Size))) res.setHeader('content-length', String(info.Size));
}

function collectionXml(req: Request) {
  const href = escapeXml(pathOnly(req));
  return xml(`\
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>${href}</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype><D:collection/></D:resourcetype>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`);
}

function filePropfindXml(req: Request, info: any, lockToken: string | null) {
  const href = escapeXml(pathOnly(req));
  const name = escapeXml(info.BaseFileName || 'documento.docx');
  const size = Number(info.Size ?? 0);
  const etag = escapeXml(quoteEtag(info.Version || String(size)));
  const modified = new Date(info.LastModifiedTime || Date.now()).toUTCString();
  return xml(`\
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>${href}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${name}</D:displayname>
        <D:getcontentlength>${size}</D:getcontentlength>
        <D:getcontenttype>${DOCX_MIME}</D:getcontenttype>
        <D:getetag>${etag}</D:getetag>
        <D:getlastmodified>${modified}</D:getlastmodified>
        <D:resourcetype/>
        <D:supportedlock>
          <D:lockentry>
            <D:lockscope><D:exclusive/></D:lockscope>
            <D:locktype><D:write/></D:locktype>
          </D:lockentry>
        </D:supportedlock>
        ${lockDiscoveryXml(req, lockToken)}
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`);
}

function lockResponseXml(req: Request, lockToken: string) {
  return xml(`\
<D:prop xmlns:D="DAV:">
  ${lockDiscoveryXml(req, lockToken)}
</D:prop>`);
}

function lockDiscoveryXml(req: Request, lockToken: string | null) {
  if (!lockToken) return '<D:lockdiscovery/>';
  return `\
<D:lockdiscovery>
  <D:activelock>
    <D:locktype><D:write/></D:locktype>
    <D:lockscope><D:exclusive/></D:lockscope>
    <D:depth>0</D:depth>
    <D:timeout>Second-${LOCK_TTL_SECONDS}</D:timeout>
    <D:locktoken><D:href>${escapeXml(lockToken)}</D:href></D:locktoken>
    <D:lockroot><D:href>${escapeXml(pathOnly(req))}</D:href></D:lockroot>
  </D:activelock>
</D:lockdiscovery>`;
}

function requestHasLock(req: Request, expected: string) {
  const lockToken = normalizeLockToken(header(req, 'lock-token'));
  if (lockToken === expected) return true;
  const ifHeader = header(req, 'if') ?? '';
  return ifHeader.includes(expected);
}

function normalizeLockToken(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw ?? '').replace(/[<>()]/g, '').trim();
}

function parseRange(value: string | undefined, size: number): { start: number; end: number } | null {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

async function readRawBody(req: Request): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function pathOnly(req: Request) {
  return req.originalUrl.split('?')[0];
}

function quoteEtag(value: string) {
  const clean = String(value || Date.now()).replace(/"/g, '');
  return `"${clean}"`;
}

function safeHeaderFileName(value: string) {
  return String(value || 'documento.docx').replace(/["\r\n]/g, '_');
}

function escapeXml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function xml(body: string) {
  return `<?xml version="1.0" encoding="utf-8"?>\n${body}`;
}
