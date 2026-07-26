import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
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
  private readonly usage = new Map<string, { minute: number; count: number }>();

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

    const requestIp = normalizeIp(String(req.ip ?? req.socket?.remoteAddress ?? ''));
    if (key.allowedIps.length > 0 && !key.allowedIps.map(normalizeIp).includes(requestIp)) {
      throw new ForbiddenException('IP nao autorizado para esta chave de API.');
    }
    this.enforceKeyRateLimit(key.id, key.rateLimitPerMinute);

    req.apiKey = { id: key.id, companyId: key.companyId, scopes: key.scopes } as ApiKeyContext;
    // best-effort: marca último uso sem bloquear a requisição.
    this.prisma.inboundApiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date(), lastUsedIp: requestIp || null } }).catch(swallow(undefined, 'externalApi.touchKeyLastUsed', 'debug'));

    const required = this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [context.getHandler(), context.getClass()]) ?? [];
    if (required.length && !required.every((s) => key.scopes.includes(s))) {
      throw new ForbiddenException('Escopo insuficiente para esta operação.');
    }
    return true;
  }

  private enforceKeyRateLimit(keyId: string, limit: number | null) {
    if (!limit) return;
    const minute = Math.floor(Date.now() / 60_000);
    const current = this.usage.get(keyId);
    if (!current || current.minute !== minute) {
      this.usage.set(keyId, { minute, count: 1 });
      return;
    }
    if (current.count >= limit) {
      throw new HttpException('Limite por minuto da chave de API excedido.', HttpStatus.TOO_MANY_REQUESTS);
    }
    current.count += 1;
  }
}

function normalizeIp(ip: string): string {
  return ip.trim().replace(/^::ffff:/i, '');
}
