import { describe, expect, it } from 'vitest';
import { demoAreaOf, normalizeSitePath } from './site-analytics';

describe('normalizeSitePath', () => {
  it('tira parâmetros e troca identificadores por :id', () => {
    expect(normalizeSitePath('/')).toBe('/');
    expect(normalizeSitePath('/solucoes/gestao-de-indicadores?utm_source=google#faq')).toBe('/solucoes/gestao-de-indicadores');
    expect(normalizeSitePath('/indicators/3f2a9c1e-1b2c-4d5e-8f90-123456789abc')).toBe('/indicators/:id');
    expect(normalizeSitePath('/meetings/42/')).toBe('/meetings/:id');
    expect(normalizeSitePath('/actions/ckx1y2z3a4b5c6d7e8f9g0h1')).toBe('/actions/:id');
    expect(normalizeSitePath('/Meu-Dia')).toBe('/meu-dia');
  });

  it('não guarda texto livre nem o que não é caminho', () => {
    expect(normalizeSitePath('/conteudos/artigos/olá mundo')).toBe('/conteudos/artigos/:id');
    expect(normalizeSitePath('https://exemplo.com/x')).toBeNull();
    expect(normalizeSitePath('')).toBeNull();
    expect(normalizeSitePath(null)).toBeNull();
    expect(normalizeSitePath('/a/b/c/d/e/f/g/h')).toBe('/a/b/c/d/e/f');
  });
});

describe('demoAreaOf', () => {
  it('devolve a área das rotas liberadas à demonstração', () => {
    expect(demoAreaOf('/meu-dia')).toBe('meu-dia');
    expect(demoAreaOf('/indicators/3f2a9c1e-1b2c-4d5e-8f90-123456789abc')).toBe('indicators');
    expect(demoAreaOf('/gestao-premio/espelhos')).toBe('gestao-premio');
  });

  it('fora da demonstração não há área', () => {
    expect(demoAreaOf('/')).toBeNull();
    expect(demoAreaOf('/settings')).toBeNull();
    expect(demoAreaOf('/gestao-premio/integracoes')).toBeNull();
    expect(demoAreaOf('/recrutamento')).toBeNull();
  });
});
