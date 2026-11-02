import { describe, expect, it } from 'vitest';
import { formatQuantity } from './portuguese';

describe('formatQuantity', () => {
  it.each([
    [0, '0 itens vencidos exigem atenção'],
    [1, '1 item vencido exige atenção'],
    [2, '2 itens vencidos exigem atenção'],
  ])('concorda o substantivo e o verbo para %i', (count, expected) => {
    expect(formatQuantity(count, 'item vencido exige atenção', 'itens vencidos exigem atenção')).toBe(expected);
  });

  it('usa o plural irregular de aprovação', () => {
    expect(formatQuantity(1, 'aprovação', 'aprovações')).toBe('1 aprovação');
    expect(formatQuantity(3, 'aprovação', 'aprovações')).toBe('3 aprovações');
  });
});
