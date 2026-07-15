import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { candidateJwtSecret, CandidateTokenPayload } from './recruit-candidate.token';

export interface CandidateContext {
  id: string;
  companyId: string;
  email: string;
  name: string;
}

/**
 * Guard das rotas do PORTAL DO CANDIDATO. As rotas são @Public (a estratégia JWT
 * interna não roda) e este guard valida o token de candidato com o segredo próprio,
 * confirma que o candidato existe e está ATIVO e injeta req.candidate.
 */
@Injectable()
export class CandidateGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string>; candidate?: CandidateContext }>();
    const header = req.headers['authorization'] ?? req.headers['Authorization'];
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Faça login para continuar.');

    let payload: CandidateTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<CandidateTokenPayload>(token, { secret: candidateJwtSecret() });
    } catch {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }
    if (payload.kind !== 'candidate' || !payload.sub) throw new UnauthorizedException('Token inválido.');

    const candidate = await this.prisma.recruitCandidate.findFirst({
      where: { id: payload.sub, companyId: payload.companyId, deletedAt: null },
      select: { id: true, companyId: true, email: true, name: true, status: true },
    });
    if (!candidate || candidate.status !== 'ACTIVE') throw new UnauthorizedException('Conta indisponível.');

    req.candidate = { id: candidate.id, companyId: candidate.companyId, email: candidate.email, name: candidate.name };
    return true;
  }
}
