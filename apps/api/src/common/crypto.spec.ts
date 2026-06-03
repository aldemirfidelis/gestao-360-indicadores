import { beforeAll, describe, expect, it } from 'vitest';

// A chave-mestra é lida de env na primeira utilização — definir antes de importar.
beforeAll(() => {
  process.env.INTEGRATIONS_SECRET = 'unit-test-integrations-secret-0123456789abcdef';
});

describe('crypto (credenciais de integração)', () => {
  it('encryptJson/decryptJson faz round-trip', async () => {
    const { encryptJson, decryptJson } = await import('./crypto');
    const secret = { apiKey: 'abc123', username: 'u', password: 'p' };
    const enc = encryptJson(secret);
    expect(enc.startsWith('v1:')).toBe(true);
    expect(enc).not.toContain('abc123'); // não vaza em texto puro
    expect(decryptJson(enc)).toEqual(secret);
  });

  it('decryptJson de vazio retorna {}', async () => {
    const { decryptJson } = await import('./crypto');
    expect(decryptJson(null)).toEqual({});
    expect(decryptJson('')).toEqual({});
  });

  it('cada cifragem usa IV diferente (não-determinística)', async () => {
    const { encryptJson } = await import('./crypto');
    expect(encryptJson({ a: 1 })).not.toEqual(encryptJson({ a: 1 }));
  });

  it('hashApiKey é determinístico e generateApiKey produz token+hash coerentes', async () => {
    const { generateApiKey, hashApiKey } = await import('./crypto');
    const { token, hash, prefix } = generateApiKey();
    expect(token.startsWith('g360_')).toBe(true);
    expect(prefix).toBe(token.slice(0, 12));
    expect(hashApiKey(token)).toBe(hash);
    expect(hashApiKey(token)).toBe(hashApiKey(token));
  });
});
