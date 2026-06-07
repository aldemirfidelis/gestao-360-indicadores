import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { requireSecret } from '../../../common/env';

@Injectable()
export class PlatformAdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string, ctx?: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.platformAdminUser.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });

    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      await this.accessLog(null, email, 'LOGIN', 'DENIED', 'Usuario interno inativo ou inexistente.', ctx);
      throw new UnauthorizedException('Credenciais invalidas');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await this.accessLog(user.id, user.email, 'LOGIN', 'DENIED', 'Senha invalida.', ctx);
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const refreshToken = randomBytes(40).toString('hex');
    const refreshTokenHash = hashToken(refreshToken);
    const ttlDays = parseInt((process.env.PLATFORM_ADMIN_REFRESH_TTL ?? process.env.JWT_REFRESH_TTL ?? '7d').replace('d', ''), 10) || 7;
    const session = await this.prisma.platformAdminSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
      },
    });
    await this.prisma.platformAdminUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.accessLog(user.id, user.email, 'LOGIN', 'SUCCESS', null, ctx);

    return {
      accessToken: await this.signAccess({
        sub: user.id,
        email: user.email,
        name: user.name,
        sessionId: session.id,
      }),
      refreshToken,
      user: this.profileFromUser(user, session.id),
    };
  }

  async me(userId: string, sessionId: string) {
    const user = await this.prisma.platformAdminUser.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    if (!user || user.deletedAt || user.status !== 'ACTIVE') throw new UnauthorizedException('Usuario interno inativo');
    return this.profileFromUser(user, sessionId);
  }

  async refresh(refreshToken: string) {
    const session = await this.prisma.platformAdminSession.findUnique({
      where: { refreshTokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date() || session.user.deletedAt || session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Refresh invalido');
    }
    await this.prisma.platformAdminSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
    return {
      accessToken: await this.signAccess({
        sub: session.user.id,
        email: session.user.email,
        name: session.user.name,
        sessionId: session.id,
      }),
    };
  }

  async logout(refreshToken?: string, ctx?: { userId?: string; email?: string; ip?: string; userAgent?: string }) {
    if (refreshToken) {
      await this.prisma.platformAdminSession
        .update({ where: { refreshTokenHash: hashToken(refreshToken) }, data: { revokedAt: new Date() } })
        .catch(() => undefined);
    }
    await this.accessLog(ctx?.userId ?? null, ctx?.email ?? null, 'LOGOUT', 'SUCCESS', null, ctx);
    return { ok: true };
  }

  private async signAccess(payload: { sub: string; email: string; name: string; sessionId: string }) {
    return this.jwt.signAsync(
      { ...payload, kind: 'platform-admin' },
      {
        secret: requireSecret('JWT_ACCESS_SECRET'),
        expiresIn: process.env.PLATFORM_ADMIN_ACCESS_TTL ?? process.env.JWT_ACCESS_TTL ?? '15m',
      },
    );
  }

  private profileFromUser(
    user: {
      id: string;
      email: string;
      name: string;
      jobTitle: string | null;
      avatarUrl: string | null;
      status: string;
      mfaEnabled: boolean;
      lastLoginAt: Date | null;
      roles: Array<{
        role: {
          code: string;
          name: string;
          permissions: Array<{ permission: { key: string } }>;
        };
      }>;
    },
    sessionId: string,
  ) {
    const permissions = new Set<string>();
    const roles = user.roles.map((item) => {
      item.role.permissions.forEach((link) => permissions.add(link.permission.key));
      return { code: item.role.code, name: item.role.name };
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      jobTitle: user.jobTitle,
      avatarUrl: user.avatarUrl,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      lastLoginAt: user.lastLoginAt,
      sessionId,
      roles,
      permissions: Array.from(permissions).sort(),
    };
  }

  private async accessLog(
    userId: string | null,
    userEmail: string | null,
    action: string,
    result: 'SUCCESS' | 'ERROR' | 'DENIED',
    message?: string | null,
    ctx?: { ip?: string; userAgent?: string },
  ) {
    await this.prisma.platformAccessLog
      .create({
        data: {
          userId,
          userEmail,
          action,
          result,
          message,
          ip: ctx?.ip,
          userAgent: ctx?.userAgent,
        },
      })
      .catch(() => undefined);
  }
}

function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
