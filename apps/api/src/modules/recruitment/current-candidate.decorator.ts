import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CandidateContext } from './candidate.guard';

/** Injeta o candidato autenticado (populado pelo CandidateGuard) no handler. */
export const CurrentCandidate = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CandidateContext => {
    return ctx.switchToHttp().getRequest<{ candidate: CandidateContext }>().candidate;
  },
);
