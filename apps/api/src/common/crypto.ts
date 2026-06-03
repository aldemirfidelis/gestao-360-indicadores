/**
 * Criptografia de credenciais de integração (AES-256-GCM) + geração/hash de chaves de API.
 *
 * Segurança: credenciais de sistemas externos NUNCA ficam em texto puro no banco nem
 * voltam ao frontend. A chave-mestra vem de `INTEGRATIONS_SECRET` (ou, na ausência,
 * derivada do `JWT_ACCESS_SECRET` que já existe em produção) — assim funciona sem nova
 * env, mas o ideal é definir uma env dedicada.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';
let cachedKey: Buffer | null = null;

function masterKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.INTEGRATIONS_SECRET || process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error(
      '[CONFIG] Defina INTEGRATIONS_SECRET (ou JWT_ACCESS_SECRET) para cifrar credenciais de integração.',
    );
  }
  // Deriva 32 bytes determinísticos a partir do segredo (salt fixo de aplicação).
  cachedKey = scryptSync(secret, 'g360.integrations.v1', 32);
  return cachedKey;
}

/** Cifra um objeto → string "v1:<iv>:<tag>:<ciphertext>" (base64). */
export function encryptJson(obj: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, masterKey(), iv);
  const plain = Buffer.from(JSON.stringify(obj ?? {}), 'utf8');
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/** Decifra a string gerada por encryptJson. Retorna {} se vazio; lança se corrompida. */
export function decryptJson<T = Record<string, unknown>>(enc: string | null | undefined): T {
  if (!enc) return {} as T;
  const parts = enc.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Credenciais em formato inválido.');
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const ct = Buffer.from(parts[3], 'base64');
  const decipher = createDecipheriv(ALGO, masterKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(plain.toString('utf8')) as T;
}

/** Gera uma chave de API inbound: token (mostrado 1x), hash (persistido) e prefixo (exibição). */
export function generateApiKey(): { token: string; hash: string; prefix: string } {
  const raw = randomBytes(24).toString('base64url');
  const token = `g360_${raw}`;
  return { token, hash: hashApiKey(token), prefix: token.slice(0, 12) };
}

export function hashApiKey(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
