/**
 * Helpers de validacao de variaveis de ambiente sensiveis.
 *
 * Objetivo de seguranca: NUNCA permitir que a API suba com um segredo
 * ausente ou com um valor de exemplo/dev em producao. Antes, um fallback
 * silencioso ('change-me') permitia que tokens fossem forjados caso a env
 * nao estivesse configurada.
 */

const isProd = (): boolean => process.env.NODE_ENV === 'production';

// Valores conhecidos de exemplo/dev que NAO podem ser usados em producao.
const WEAK_SECRET_PATTERNS = [
  'change-me',
  'dev-access-secret',
  'dev-refresh-secret',
  'troque',
  'gerar_secret',
  'secret-32chars',
];

function isWeakSecret(value: string): boolean {
  const lower = value.toLowerCase();
  if (value.length < 32) return true;
  return WEAK_SECRET_PATTERNS.some((p) => lower.includes(p));
}

/**
 * Le um segredo obrigatorio. Lanca (fail-fast) se estiver ausente ou,
 * em producao, se for fraco/valor de exemplo.
 */
export function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `[CONFIG] Variavel de ambiente obrigatoria ausente: ${name}. ` +
        `Defina um segredo forte (ex.: openssl rand -base64 48).`,
    );
  }
  if (isProd() && isWeakSecret(value)) {
    throw new Error(
      `[CONFIG] ${name} usa um valor fraco/de exemplo em producao. ` +
        `Gere um segredo unico com >=32 chars (openssl rand -base64 48).`,
    );
  }
  return value;
}
