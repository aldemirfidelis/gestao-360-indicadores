import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { requireSecret } from '../../../common/env';
import { swallow } from '../../../common/logging/swallow';
import { PLATFORM_PERMISSIONS_KEY } from '../decorators/platform-permissions.decorator';
import { hasPlatformPermission } from '../platform-admin.access';
import { PlatformAdminIdentity, PlatformAdminRequest } from '../platform-admin.types';

interface PlatformJwt {
  sub: string;
  email: string;
  name: string;
  sessionId: string;
  kind: 'platform-admin';
}

@Injectable()
export class PlatformAdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & PlatformAdminRequest>();
    const token = extractBearer(req.headers.authorization);
    if (!token) throw new UnauthorizedException('Token do Portal Admin Global ausente.');

    let payload: PlatformJwt;
    try {
      payload = await this.jwt.verifyAsync<PlatformJwt>(token, { secret: requireSecret('JWT_ACCESS_SECRET') });
    } catch {
      throw new UnauthorizedException('Token do Portal Admin Global invalido ou expirado.');
    }
    if (payload.kind !== 'platform-admin') {
      throw new UnauthorizedException('Token nao pertence ao Portal Admin Global.');
    }

    const session = await this.prisma.platformAdminSession.findUnique({
      where: { id: payload.sessionId },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: {
                  include: { permissions: { include: { permission: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      !session.user ||
      session.user.deletedAt ||
      session.user.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException('Sessao interna invalida, expirada ou revogada.');
    }

    const roles = session.user.roles.map((item) => item.role.code);
    const permissions = new Set<string>();
    for (const item of session.user.roles) {
      for (const link of item.role.permissions) permissions.add(link.permission.key);
    }

    const required = this.reflector.getAllAndOverride<string[]>(PLATFORM_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [];
    const allowed = required.length === 0 || required.some((permission) => hasPlatformPermission(permissions, permission));
    if (!allowed) {
      await this.prisma.platformAccessLog
        .create({
          data: {
            userId: session.user.id,
            userEmail: session.user.email,
            action: 'DENIED',
            result: 'DENIED',
            message: `Permissao requerida: ${required.join(', ')}`,
            path: req.originalUrl,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          },
        })
        .catch(swallow(undefined, 'platformAdmin.guard.accessLogDenied', 'debug'));
      throw new ForbiddenException('Permissao insuficiente no Portal Admin Global.');
    }

    req.platformAdmin = {
      sub: session.user.id,
      email: session.user.email,
      name: session.user.name,
      sessionId: session.id,
      roles,
      permissions: Array.from(permissions).sort(),
      kind: 'platform-admin',
    } satisfies PlatformAdminIdentity;

    void this.prisma.platformAdminSession
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(swallow(undefined, 'platformAdmin.guard.touchLastSeen', 'debug'));

    return true;
  }
}

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [kind, token] = header.split(' ');
  if (kind?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}
