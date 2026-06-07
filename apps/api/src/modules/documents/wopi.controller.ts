import { Controller, Get, Param, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Public } from '../auth/public.decorator';
import { DocumentEditorService, WopiTokenPayload } from './document-editor.service';
import { DocumentsService } from './documents.service';

/**
 * Host WOPI para o Collabora Online.
 *
 * O Document Server chama estes endpoints (publicos) usando o `access_token`
 * assinado que emitimos em `POST /documents/:id/editor/open`. Nao ha JWT de
 * usuario aqui: a autorizacao vem inteiramente do token (empresa/arquivo/escopo).
 *
 * Protocolo: https://docs.collaboraonline.com/ (WOPI: CheckFileInfo, GetFile,
 * PutFile e operacoes de Lock).
 *
 * SkipThrottle: o Collabora chama estes endpoints periodicamente (lock/save)
 * a partir de um unico IP; o rate limit global por IP nao se aplica aqui.
 */
@SkipThrottle()
@Controller('wopi')
export class WopiController {
  constructor(
    private readonly editor: DocumentEditorService,
    private readonly documents: DocumentsService,
  ) {}

  private authorize(fileId: string, accessToken?: string): WopiTokenPayload {
    const token = this.editor.verifyToken(accessToken);
    if (!token || token.fileId !== fileId) {
      throw new UnauthorizedException('access_token invalido ou expirado.');
    }
    return token;
  }

  /** CheckFileInfo */
  @Public()
  @Get('files/:id')
  async checkFileInfo(@Param('id') id: string, @Query('access_token') accessToken: string) {
    const token = this.authorize(id, accessToken);
    return this.documents.wopiCheckFileInfo(token);
  }

  /** GetFile: bytes do documento */
  @Public()
  @Get('files/:id/contents')
  async getContents(
    @Param('id') id: string,
    @Query('access_token') accessToken: string,
    @Res() res: Response,
  ) {
    const token = this.authorize(id, accessToken);
    const buffer = await this.documents.wopiGetFile(token);
    res.setHeader('content-type', 'application/octet-stream');
    res.setHeader('content-length', String(buffer.length));
    res.status(200).end(buffer);
  }

  /** PutFile: salva a nova versao binaria (autosave/salvar do editor) */
  @Public()
  @Post('files/:id/contents')
  async putContents(
    @Param('id') id: string,
    @Query('access_token') accessToken: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const token = this.authorize(id, accessToken);

    // Respeita o lock corrente (se houver) antes de gravar.
    const current = this.editor.getLock(id);
    const requested = header(req, 'x-wopi-lock');
    if (current && requested && current !== requested) {
      res.setHeader('x-wopi-lock', current);
      res.status(409).end();
      return;
    }

    // Nest so faz parse de JSON/urlencoded; para octet-stream o stream chega
    // intacto e lemos o corpo binario diretamente da requisicao.
    const buffer = Buffer.isBuffer(req.body) ? req.body : await readRawBody(req);
    const result = await this.documents.wopiPutFile(token, buffer);
    res.status(200).json({ LastModifiedTime: new Date().toISOString(), Version: result.version });
  }

  /** Operacoes de bloqueio (X-WOPI-Override: LOCK | UNLOCK | REFRESH_LOCK | GET_LOCK | UNLOCK_AND_RELOCK) */
  @Public()
  @Post('files/:id')
  async fileOperation(
    @Param('id') id: string,
    @Query('access_token') accessToken: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    this.authorize(id, accessToken);
    const override = (header(req, 'x-wopi-override') ?? '').toUpperCase();
    const requested = header(req, 'x-wopi-lock') ?? '';
    const current = this.editor.getLock(id);

    const conflict = () => {
      res.setHeader('x-wopi-lock', current ?? '');
      res.status(409).end();
    };

    switch (override) {
      case 'GET_LOCK':
        res.setHeader('x-wopi-lock', current ?? '');
        res.status(200).end();
        return;

      case 'LOCK':
        if (!current || current === requested) {
          this.editor.setLock(id, requested);
          res.status(200).end();
          return;
        }
        conflict();
        return;

      case 'REFRESH_LOCK':
        if (current && current === requested) {
          this.editor.setLock(id, requested);
          res.status(200).end();
          return;
        }
        conflict();
        return;

      case 'UNLOCK':
        if (current && current === requested) {
          this.editor.clearLock(id);
          res.status(200).end();
          return;
        }
        conflict();
        return;

      case 'UNLOCK_AND_RELOCK': {
        const oldLock = header(req, 'x-wopi-oldlock') ?? '';
        if (current && current === oldLock) {
          this.editor.setLock(id, requested);
          res.status(200).end();
          return;
        }
        conflict();
        return;
      }

      default:
        // PUT_RELATIVE e demais operacoes nao sao suportadas.
        res.status(501).end();
        return;
    }
  }
}

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Le o corpo binario bruto da requisicao (PutFile do WOPI). */
async function readRawBody(req: Request): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
