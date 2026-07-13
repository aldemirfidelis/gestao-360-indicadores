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
  /(pass(word)?|senha|secret|^authorization$|cookie|token$|access[_-]?token|refresh[_-]?token|api[_-]?key|client[_-]?secret|private[_-]?key|cpf|cnpj|\brg\b|pix|card[_-]?number|cardnumber|\bcvv\b|\bcvc\b|\bpin\b|descriptor(s)?$|embedding(s)?$|(?:face|facial|biometric)[_-]?(?:descriptor|embedding|template|vector|payload|data|sample|samples|probe)$|nonce(?:[_-]?hash)?$|^challenge$|challenge[_-]?(?:id|token|secret|nonce|response|proof)$|liveness[_-]?(?:proof|payload|video|image|frames?)$)/i;

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
const PINO_BIOMETRIC_FIELDS = [
  'deviceToken',
  'device_token',
  'descriptor',
  'descriptors',
  'faceDescriptor',
  'facialDescriptor',
  'faceEmbedding',
  'biometricPayload',
  'biometric_payload',
  'biometricTemplate',
  'biometric_template',
  'nonce',
  'nonceHash',
  'nonce_hash',
  'challenge',
  'challengeId',
  'challenge_id',
  'challengeToken',
  'challenge_token',
  'challengeSecret',
  'challenge_secret',
  'challengeNonce',
  'challenge_nonce',
  'challengeResponse',
  'challenge_response',
  'livenessProof',
  'liveness_proof',
  'livenessPayload',
  'liveness_payload',
] as const;

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
  ...PINO_BIOMETRIC_FIELDS,
  ...PINO_BIOMETRIC_FIELDS.map((field) => `*.${field}`),
  ...PINO_BIOMETRIC_FIELDS.map((field) => `req.body.${field}`),
  ...PINO_BIOMETRIC_FIELDS.map((field) => `req.body.*.${field}`),
];
