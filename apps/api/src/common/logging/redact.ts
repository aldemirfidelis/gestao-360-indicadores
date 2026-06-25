/**
 * Sanitização (data masking) para logs e auditoria.
 *
 * `redactDeep` faz cópia recursiva de um valor mascarando QUALQUER chave sensível
 * (senha, token, CPF, etc.) em qualquer nível de profundidade — usar sempre que um
 * corpo/payload for gravado em log ou auditoria.
 *
 * `PINO_REDACT_PATHS` cobre os caminhos conhecidos que o pino serializa
 * automaticamente (defesa em profundidade, além dos serializers de req/res).
 */

// Cobre PT-BR e EN: senhas, tokens, segredos, cabeçalhos de auth e dados pessoais (LGPD).
const SENSITIVE_KEY =
  /(pass(word)?|senha|secret|^authorization$|cookie|^token$|access[_-]?token|refresh[_-]?token|api[_-]?key|client[_-]?secret|private[_-]?key|cpf|cnpj|\brg\b|pix|card[_-]?number|cardnumber|\bcvv\b|\bcvc\b|\bpin\b)/i;

const CENSOR = '[redacted]';
const MAX_DEPTH = 8;

export function redactDeep(input: unknown, depth = 0): unknown {
  if (input === null || input === undefined) return input;
  if (depth > MAX_DEPTH) return '[max-depth]';
  if (typeof input !== 'object') return input;
  if (input instanceof Date) return input.toISOString();
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) return `[buffer:${input.length}]`;
  if (Array.isArray(input)) return input.map((v) => redactDeep(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? CENSOR : redactDeep(value, depth + 1);
  }
  return out;
}

// Caminhos para o `redact` nativo do pino (auto-logging). Os serializers de req/res
// já removem headers/body, então isto é uma camada extra de segurança.
export const PINO_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  'senha',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'authorization',
  'apiKey',
  '*.password',
  '*.senha',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.authorization',
  '*.apiKey',
];
