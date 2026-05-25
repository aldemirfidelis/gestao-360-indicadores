import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string, ctx?: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user || !user.active || user.status !== 'ACTIVE' || user.deletedAt) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');

    const payload: AuthPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
    });

    const refreshRaw = randomBytes(40).toString('hex');
    const refreshHash = createHash('sha256').update(refreshRaw).digest('hex');
    const ttlDays = parseInt((process.env.JWT_REFRESH_TTL ?? '7d').replace('d', ''), 10) || 7;
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshHash,
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
      },
    });

    const profile = await this.userProfile(user.id);

    return {
      accessToken,
      refreshToken: refreshRaw,
      user: profile,
    };
  }

  async me(payload: AuthPayload) {
    return this.userProfile(payload.sub);
  }

  async refresh(refreshToken: string) {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || !stored.user.active) {
      throw new UnauthorizedException('Refresh inválido');
    }
    const payload: AuthPayload = {
      sub: stored.user.id,
      email: stored.user.email,
      name: stored.user.name,
      role: stored.user.role,
      companyId: stored.user.companyId,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
    });
    return { accessToken };
  }

  async logout(refreshToken?: string, ctx?: { userId?: string; companyId?: string; ip?: string; userAgent?: string }) {
    if (!refreshToken) return { ok: true };
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.refreshToken
      .update({ where: { tokenHash }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
    if (ctx?.userId) {
      await this.prisma.auditLog.create({
        data: {
          companyId: ctx.companyId,
          userId: ctx.userId,
          action: 'LOGOUT',
          module: 'auth',
          entity: 'User',
          entityId: ctx.userId,
          result: 'SUCCESS',
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        },
      });
    }
    return { ok: true };
  }

  private async userProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        avatarUrl: true,
        jobTitle: true,
        permissions: { select: { permission: { select: { key: true } } } },
        accessProfile: {
          select: {
            id: true,
            code: true,
            name: true,
            permissions: { select: { permission: { select: { key: true } } } },
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException('Usuário nao encontrado');
    const permissionKeys = new Set<string>();
    user.permissions.forEach((item) => permissionKeys.add(item.permission.key));
    user.accessProfile?.permissions.forEach((item) => permissionKeys.add(item.permission.key));
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      avatarUrl: user.avatarUrl,
      jobTitle: user.jobTitle,
      accessProfile: user.accessProfile ? { id: user.accessProfile.id, code: user.accessProfile.code, name: user.accessProfile.name } : null,
      permissions: Array.from(permissionKeys).sort(),
    };
  }
}
