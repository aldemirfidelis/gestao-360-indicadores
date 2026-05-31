import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthPayload } from './auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { requireSecret } from '../../common/env';

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
      select: { id: true, active: true, status: true, deletedAt: true },
    });
    if (!user || !user.active || user.status !== 'ACTIVE' || user.deletedAt) {
      throw new UnauthorizedException('Usuário inativo');
    }
    return payload;
  }
}
