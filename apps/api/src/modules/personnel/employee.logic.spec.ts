import { describe, expect, it } from 'vitest';
import { isValidCpf, maskCpf, normalizeCpf, onlyDigits, parseFlexibleDate } from './employee.logic';

describe('employee.logic', () => {
  it('isValidCpf: valida dígitos verificadores', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true); // CPF válido conhecido
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('529.982.247-26')).toBe(false); // dígito errado
    expect(isValidCpf('111.111.111-11')).toBe(false); // repetido
    expect(isValidCpf('123')).toBe(false);
    expect(isValidCpf('')).toBe(false);
  });

  it('normalizeCpf e onlyDigits', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725');
    expect(normalizeCpf('')).toBeNull();
    expect(normalizeCpf(null)).toBeNull();
    expect(onlyDigits('a1b2c3')).toBe('123');
  });

  it('maskCpf: LGPD — mostra só as pontas', () => {
    expect(maskCpf('52998224725')).toBe('529.•••.•••-25');
    expect(maskCpf('529.982.247-25')).toBe('529.•••.•••-25');
    expect(maskCpf('123')).toBeNull();
    expect(maskCpf(null)).toBeNull();
  });

  it('parseFlexibleDate: ISO, BR e inválidas', () => {
    expect(parseFlexibleDate('2026-07-10')?.toISOString()).toBe('2026-07-10T12:00:00.000Z');
    expect(parseFlexibleDate('10/07/2026')?.toISOString()).toBe('2026-07-10T12:00:00.000Z');
    expect(parseFlexibleDate('2026-07-10T08:30:00.000Z')?.toISOString()).toBe('2026-07-10T12:00:00.000Z');
    expect(parseFlexibleDate('31/02/2026')).toBeNull();
    expect(parseFlexibleDate('')).toBeNull();
    expect(parseFlexibleDate('abc')).toBeNull();
  });
});
