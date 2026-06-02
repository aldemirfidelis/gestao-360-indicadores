import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { assertValidIdentifier, quoteIdent, assertInAllowlist } from './identifier.util';
import { toJsonSafe, safeStringify } from './serialize';

describe('identifier.util — defesa contra SQL injection em identificadores', () => {
  it('aceita identificadores válidos do Prisma/Postgres', () => {
    expect(assertValidIdentifier('User')).toBe('User');
    expect(assertValidIdentifier('_prisma_migrations')).toBe('_prisma_migrations');
    expect(assertValidIdentifier('indicator_result')).toBe('indicator_result');
    expect(assertValidIdentifier('col$1')).toBe('col$1');
  });

  it('rejeita injeção e nomes inválidos', () => {
    for (const bad of ['DROP TABLE x', 'a;b', 'a-b', 'a b', '1abc', '', '"x"', 'a)--']) {
      expect(() => assertValidIdentifier(bad)).toThrow(BadRequestException);
    }
  });

  it('rejeita identificador acima de 63 caracteres', () => {
    expect(() => assertValidIdentifier('a'.repeat(64))).toThrow(BadRequestException);
  });

  it('quota com aspas duplas preservando o case', () => {
    expect(quoteIdent('User')).toBe('"User"');
    expect(quoteIdent('OrgNode')).toBe('"OrgNode"');
  });

  it('allowlist bloqueia objetos inexistentes mesmo com nome válido', () => {
    const allow = new Set(['User', 'Indicator']);
    expect(assertInAllowlist('User', allow)).toBe('User');
    expect(() => assertInAllowlist('SecretTable', allow)).toThrow(BadRequestException);
  });
});

describe('serialize — saída JSON-safe e redação', () => {
  it('converte BigInt seguro em number e inseguro em string', () => {
    expect(toJsonSafe(123n)).toBe(123);
    expect(toJsonSafe(9007199254740993n)).toBe('9007199254740993');
  });

  it('serializa Date para ISO e percorre estruturas aninhadas', () => {
    const d = new Date('2026-01-02T03:04:05.000Z');
    expect(toJsonSafe(d)).toBe('2026-01-02T03:04:05.000Z');
    expect(toJsonSafe({ a: [1n, d], b: { c: 2n } })).toEqual({
      a: [1, '2026-01-02T03:04:05.000Z'],
      b: { c: 2 },
    });
  });

  it('safeStringify não quebra com BigInt', () => {
    expect(safeStringify({ count: 10n })).toBe('{"count":10}');
  });
});
