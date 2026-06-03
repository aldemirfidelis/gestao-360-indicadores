import { describe, it, expect } from 'vitest';
import { directKey } from './conversation.service';

describe('directKey (idempotência de conversa individual)', () => {
  it('é simétrico: (a,b) === (b,a)', () => {
    expect(directKey('a', 'b')).toBe(directKey('b', 'a'));
  });

  it('gera par ordenado estável', () => {
    expect(directKey('zeta', 'alfa')).toBe('alfa:zeta');
    expect(directKey('alfa', 'zeta')).toBe('alfa:zeta');
  });

  it('UUIDs distintos produzem chaves distintas', () => {
    const k1 = directKey('11111111', '22222222');
    const k2 = directKey('11111111', '33333333');
    expect(k1).not.toBe(k2);
  });
});
