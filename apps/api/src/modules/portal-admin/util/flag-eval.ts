/**
 * Avaliação pura de feature flag — testável sem banco.
 * Ordem: enabled → janela de datas → ambiente → roles → usuários → escopos → rollout%.
 * SUPER_ADMIN faz bypass (sempre vê a feature quando habilitada) para poder testar.
 */
import { createHash } from 'crypto';

export interface FlagLike {
  key: string;
  enabled: boolean;
  rolloutPercentage: number | null;
  allowedRoles: string[];
  allowedUserIds: string[];
  allowedScopes: string[];
  environment: string | null;
  scheduledOnAt: Date | string | null;
  scheduledOffAt: Date | string | null;
}

export interface FlagContext {
  userId: string;
  role: string;
  environment: string;
  scopeIds: string[];
  now?: Date;
}

export function evaluateFlag(flag: FlagLike, ctx: FlagContext): boolean {
  if (!flag.enabled) return false;
  const now = ctx.now ?? new Date();
  if (flag.scheduledOnAt && now < new Date(flag.scheduledOnAt)) return false;
  if (flag.scheduledOffAt && now > new Date(flag.scheduledOffAt)) return false;

  if (ctx.role === 'SUPER_ADMIN') return true;

  if (flag.environment && flag.environment !== ctx.environment) return false;
  if (flag.allowedRoles.length > 0 && !flag.allowedRoles.includes(ctx.role)) return false;
  if (flag.allowedUserIds.length > 0 && !flag.allowedUserIds.includes(ctx.userId)) return false;
  if (flag.allowedScopes.length > 0 && !flag.allowedScopes.some((s) => ctx.scopeIds.includes(s))) return false;

  if (flag.rolloutPercentage != null && flag.rolloutPercentage < 100) {
    if (flag.rolloutPercentage <= 0) return false;
    return bucket(`${flag.key}:${ctx.userId}`) < flag.rolloutPercentage;
  }
  return true;
}

/** Bucket determinístico 0-99 a partir de uma string. */
export function bucket(seed: string): number {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 8);
  return parseInt(hex, 16) % 100;
}
