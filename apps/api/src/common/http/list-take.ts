/**
 * Teto de segurança para listagens (auditoria 2026-07): as telas atuais
 * consomem a lista inteira, então o padrão é alto o bastante para não mudar
 * comportamento em bases reais, mas impede respostas ilimitadas conforme as
 * empresas crescem. Aceita `?limit=` opcional (clampado em `max`).
 */
export function listTake(raw?: string | number | null, fallback = 1000, max = 2000): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), max);
}
