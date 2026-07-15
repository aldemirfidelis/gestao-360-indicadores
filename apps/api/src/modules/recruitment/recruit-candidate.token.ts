import { scryptSync } from 'crypto';
import { requireSecret } from '../../common/env';

/**
 * Segredo de assinatura dos tokens de CANDIDATO — derivado de forma determinística
 * do JWT_ACCESS_SECRET, mas DISTINTO dele. Assim um token de candidato jamais é
 * aceito pela estratégia JWT interna (e vice-versa): domínios de identidade
 * criptograficamente separados, sem exigir nova variável de ambiente.
 */
let cached: string | null = null;
export function candidateJwtSecret(): string {
  if (cached) return cached;
  const base = process.env.RECRUIT_CANDIDATE_SECRET || requireSecret('JWT_ACCESS_SECRET');
  cached = scryptSync(base, 'g360.recruit.candidate.v1', 32).toString('hex');
  return cached;
}

export const CANDIDATE_TOKEN_TTL = process.env.RECRUIT_CANDIDATE_TTL ?? '2h';

export interface CandidateTokenPayload {
  sub: string; // candidateId
  companyId: string;
  email: string;
  kind: 'candidate';
}
