import { describe, expect, it } from 'vitest';
import { formatRegistration, sanitizeRegistrationFormat } from './personnel-settings.logic';

describe('formatRegistration', () => {
  const base = { registrationPrefix: '', registrationSuffix: '', registrationWidth: 5, registrationPadChar: '0' };

  it('preenche com zeros à esquerda na largura configurada', () => {
    expect(formatRegistration(1, base)).toBe('00001');
    expect(formatRegistration(42, base)).toBe('00042');
  });

  it('aplica prefixo (ex.: começar com 9) e sufixo', () => {
    expect(formatRegistration(1, { ...base, registrationPrefix: '9', registrationWidth: 4 })).toBe('90001');
    expect(formatRegistration(7, { ...base, registrationPrefix: 'MAT-', registrationWidth: 4 })).toBe('MAT-0007');
    expect(formatRegistration(7, { ...base, registrationSuffix: '-BR', registrationWidth: 3 })).toBe('007-BR');
  });

  it('não trunca sequenciais maiores que a largura', () => {
    expect(formatRegistration(123456, { ...base, registrationWidth: 4 })).toBe('123456');
  });

  it('largura 0 = sequencial sem padding', () => {
    expect(formatRegistration(5, { ...base, registrationWidth: 0 })).toBe('5');
  });

  it('respeita caractere de preenchimento customizado', () => {
    expect(formatRegistration(9, { ...base, registrationWidth: 3, registrationPadChar: ' ' })).toBe('  9');
  });
});

describe('sanitizeRegistrationFormat', () => {
  it('limita largura ao intervalo são e trunca prefixo longo', () => {
    const out = sanitizeRegistrationFormat({ registrationWidth: 999, registrationPrefix: 'X'.repeat(50) });
    expect(out.registrationWidth).toBe(12);
    expect(out.registrationPrefix?.length).toBe(16);
  });

  it('reduz padChar a um único caractere e ignora campos ausentes', () => {
    const out = sanitizeRegistrationFormat({ registrationPadChar: '00' });
    expect(out.registrationPadChar).toBe('0');
    expect(out.registrationWidth).toBeUndefined();
    expect(out.registrationPrefix).toBeUndefined();
  });

  it('impede sequencial negativo', () => {
    expect(sanitizeRegistrationFormat({ registrationNextSequence: -5 }).registrationNextSequence).toBe(0);
  });
});
