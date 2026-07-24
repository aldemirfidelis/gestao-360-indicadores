import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthPayload } from './auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { requireSecret } from '../../common/env';
import { effectiveCompanyId } from '../../common/effective-company';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Sem fallback: se JWT_ACCESS_SECRET faltar (ou for fraco em prod),
      // a API nao sobe, evitando tokens forjaveis com segredo conhecido.
      secretOrKey: requireSecret('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: AuthPayload): Promise<AuthPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        active: true,
        status: true,
        deletedAt: true,
        role: true,
        companyId: true,
        activeCompanyId: true,
        accessProfile: { select: { code: true } },
        company: { select: { status: true, deletedAt: true } },
      },
    });
    if (!user || !user.active || user.status !== 'ACTIVE' || user.deletedAt) {
      throw new UnauthorizedException('Usuário inativo');
    }
    // Empresa de ORIGEM suspensa/inativa bloqueia o acesso de todos os seus usuários
    // (vale já na próxima requisição, sem esperar o token expirar). O Super Admin pode
    // administrar empresas suspensas, mas a própria empresa de origem precisa estar ativa.
    if (!user.company || user.company.deletedAt || user.company.status !== 'ACTIVE') {
      throw new UnauthorizedException('Empresa suspensa ou inativa. Contate o administrador.');
    }
    // Empresa efetiva recalculada do banco a cada requisição (fonte da verdade) — a troca
    // de empresa do Super Admin passa a valer imediatamente, mesmo com token antigo.
    const companyId = effectiveCompanyId(user);
    return {
      ...payload,
      role: user.role,
      companyId,
      homeCompanyId: user.companyId,
      impersonating: companyId !== user.companyId,
      accessProfileCode: user.accessProfile?.code ?? null,
    };
  }
}
