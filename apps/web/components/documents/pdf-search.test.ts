import { describe, expect, it } from 'vitest';
import { findMatchStarts, normalizeSearchable, resolveMatchPosition } from './pdf-search';

describe('normalizeSearchable', () => {
  it('remove acentos e caixa preservando o comprimento', () => {
    const input = 'Reunião de Comunicação';
    const out = normalizeSearchable(input);
    expect(out).toBe('reuniao de comunicacao');
    expect(out.length).toBe(input.length);
  });

  it('preserva comprimento mesmo com caracteres especiais', () => {
    const samples = ['ÀÉÎÕÜç', 'aç~ão', 'ß', 'İstanbul', 'coração 💙 água'];
    for (const s of samples) {
      expect(normalizeSearchable(s).length).toBe(s.length);
    }
  });

  it('permite busca insensível a acento nos dois lados', () => {
    const hay = normalizeSearchable('MEDIÇÃO e Monitoramento');
    const needle = normalizeSearchable('medicao');
    expect(hay.indexOf(needle)).toBe(0);
  });
});

describe('findMatchStarts', () => {
  it('encontra todas as ocorrências não sobrepostas', () => {
    expect(findMatchStarts('abcabcabc', 'abc')).toEqual([0, 3, 6]);
    expect(findMatchStarts('aaaa', 'aa')).toEqual([0, 2]);
  });

  it('retorna vazio para needle vazio ou sem ocorrência', () => {
    expect(findMatchStarts('abc', '')).toEqual([]);
    expect(findMatchStarts('abc', 'zz')).toEqual([]);
  });
});

describe('resolveMatchPosition', () => {
  it('mapeia índice global para página e índice local', () => {
    const counts = [2, 0, 3, 1];
    expect(resolveMatchPosition(counts, 0)).toEqual({ page: 1, localIndex: 0 });
    expect(resolveMatchPosition(counts, 1)).toEqual({ page: 1, localIndex: 1 });
    expect(resolveMatchPosition(counts, 2)).toEqual({ page: 3, localIndex: 0 });
    expect(resolveMatchPosition(counts, 4)).toEqual({ page: 3, localIndex: 2 });
    expect(resolveMatchPosition(counts, 5)).toEqual({ page: 4, localIndex: 0 });
  });

  it('retorna null para índice fora do total', () => {
    expect(resolveMatchPosition([1, 1], 2)).toBeNull();
    expect(resolveMatchPosition([], 0)).toBeNull();
  });
});
