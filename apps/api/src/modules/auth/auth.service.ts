import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from './auth.types';
import { requireSecret } from '../../common/env';
import { effectiveCompanyId } from '../../common/effective-company';
import { swallow } from '../../common/logging/swallow';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string, ctx?: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { company: { select: { status: true, deletedAt: true } } },
    });
    if (!user || !user.active || user.status !== 'ACTIVE' || user.deletedAt) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');

    // Empresa suspensa/inativa bloqueia o login (após validar credenciais,
    // para não revelar o status da empresa a quem não tem acesso).
    if (!user.company || user.company.deletedAt || user.company.status !== 'ACTIVE') {
      throw new UnauthorizedException('Empresa suspensa ou inativa. Contate o administrador.');
    }

    const companyId = effectiveCompanyId(user);
    const payload: AuthPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId,
      homeCompanyId: user.companyId,
      impersonating: companyId !== user.companyId,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: requireSecret('JWT_ACCESS_SECRET'),
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
      include: { user: { include: { company: { select: { status: true, deletedAt: true } } } } },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || !stored.user.active) {
      throw new UnauthorizedException('Refresh inválido');
    }
    if (
      !stored.user.company ||
      stored.user.company.deletedAt ||
      stored.user.company.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException('Empresa suspensa ou inativa.');
    }
    const companyId = effectiveCompanyId(stored.user);
    const payload: AuthPayload = {
      sub: stored.user.id,
      email: stored.user.email,
      name: stored.user.name,
      role: stored.user.role,
      companyId,
      homeCompanyId: stored.user.companyId,
      impersonating: companyId !== stored.user.companyId,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: requireSecret('JWT_ACCESS_SECRET'),
      expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
    });
    return { accessToken };
  }

  async logout(refreshToken?: string, ctx?: { userId?: string; companyId?: string; ip?: string; userAgent?: string }) {
    if (!refreshToken) return { ok: true };
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.refreshToken
      .update({ where: { tokenHash }, data: { revokedAt: new Date() } })
      .catch(swallow(undefined, 'auth.logout(revogar refresh token)'));
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

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ctx?: { companyId?: string; ip?: string; userAgent?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, companyId: true, passwordHash: true },
    });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Senha atual inválida');

    const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(newPassword, rounds),
        passwordResetRequired: false,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId: ctx?.companyId ?? user.companyId,
        userId,
        action: 'CHANGE_PASSWORD',
        module: 'auth',
        entity: 'User',
        entityId: userId,
        result: 'SUCCESS',
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
      },
    });

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
        activeCompanyId: true,
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

    const companyId = effectiveCompanyId(user);
    const impersonating = companyId !== user.companyId;
    // Nome da empresa efetiva (para o seletor do topo exibir "Administrando: X").
    const activeCompany = await this.prisma.company
      .findUnique({ where: { id: companyId }, select: { id: true, name: true, tradeName: true } })
      .catch(swallow(null, 'auth.resolveActiveCompany', 'debug'));

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId,
      homeCompanyId: user.companyId,
      impersonating,
      activeCompany: activeCompany
        ? { id: activeCompany.id, name: activeCompany.tradeName || activeCompany.name }
        : null,
      avatarUrl: user.avatarUrl,
      jobTitle: user.jobTitle,
      accessProfile: user.accessProfile ? { id: user.accessProfile.id, code: user.accessProfile.code, name: user.accessProfile.name } : null,
      permissions: Array.from(permissionKeys).sort(),
    };
  }
}
