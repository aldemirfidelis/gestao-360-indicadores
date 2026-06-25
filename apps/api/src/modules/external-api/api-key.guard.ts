import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { hashApiKey } from '../../common/crypto';
import { swallow } from '../../common/logging/swallow';

export const SCOPES_KEY = 'apiScopes';
/** Declara os escopos exigidos por uma rota da API pública (ex.: 'results:write'). */
export const RequireScopes = (...scopes: string[]) => SetMetadata(SCOPES_KEY, scopes);

export interface ApiKeyContext {
  id: string;
  companyId: string;
  scopes: string[];
}

/** Injeta o contexto resolvido a partir da chave de API (empresa SEMPRE vem daqui). */
export const ApiKeyCtx = createParamDecorator((_data, ctx: ExecutionContext): ApiKeyContext => {
  return ctx.switchToHttp().getRequest().apiKey;
});

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const raw = req.headers['x-api-key'] ?? String(req.headers['authorization'] ?? '').replace(/^ApiKey\s+/i, '');
    const token = Array.isArray(raw) ? raw[0] : raw;
    if (!token) throw new UnauthorizedException('Chave de API ausente (header X-Api-Key).');

    const key = await this.prisma.inboundApiKey.findUnique({ where: { keyHash: hashApiKey(String(token)) } });
    if (!key || key.status !== 'active') throw new UnauthorizedException('Chave de API inválida.');
    if (key.expiresAt && key.expiresAt < new Date()) throw new UnauthorizedException('Chave de API expirada.');

    req.apiKey = { id: key.id, companyId: key.companyId, scopes: key.scopes } as ApiKeyContext;
    // best-effort: marca último uso sem bloquear a requisição.
    this.prisma.inboundApiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(swallow(undefined, 'externalApi.touchKeyLastUsed', 'debug'));

    const required = this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [context.getHandler(), context.getClass()]) ?? [];
    if (required.length && !required.every((s) => key.scopes.includes(s))) {
      throw new ForbiddenException('Escopo insuficiente para esta operação.');
    }
    return true;
  }
}
