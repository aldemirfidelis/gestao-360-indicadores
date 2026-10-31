import { describe, expect, it } from 'vitest';
import { isSitePage, trackingMode } from './site-analytics';

describe('trackingMode', () => {
  const base = { pathname: '/', loading: false, user: null, blocked: false };

  it('visitante nas páginas públicas conta como site', () => {
    expect(trackingMode(base)).toBe('site');
    expect(trackingMode({ ...base, pathname: '/solucoes/gestao-de-indicadores' })).toBe('site');
    expect(trackingMode({ ...base, pathname: '/demonstracao/' })).toBe('site');
  });

  it('sessão da demonstração conta como demo nas rotas da demo', () => {
    const demo = { ...base, user: { isDemo: true } };
    expect(trackingMode({ ...demo, pathname: '/meu-dia' })).toBe('demo');
    expect(trackingMode({ ...demo, pathname: '/indicators/3f2a9c1e-1b2c-4d5e-8f90-123456789abc' })).toBe('demo');
    expect(trackingMode({ ...demo, pathname: '/' })).toBe('site');
    expect(trackingMode({ ...demo, pathname: '/settings' })).toBe('off');
  });

  it('fica fora: carregando, usuário logado, equipe do portal e páginas internas', () => {
    expect(trackingMode({ ...base, loading: true })).toBe('off');
    expect(trackingMode({ ...base, user: { isDemo: false } })).toBe('off');
    expect(trackingMode({ ...base, user: {} })).toBe('off');
    expect(trackingMode({ ...base, blocked: true })).toBe('off');
    expect(trackingMode({ ...base, pathname: '/login' })).toBe('off');
    expect(trackingMode({ ...base, pathname: '/platform-admin' })).toBe('off');
    expect(trackingMode({ ...base, pathname: '/meu-dia' })).toBe('off');
  });

  it('reconhece só as páginas públicas do site', () => {
    expect(isSitePage('/')).toBe(true);
    expect(isSitePage('/conteudos/perguntas-frequentes')).toBe(true);
    expect(isSitePage('/indicators')).toBe(false);
  });
});
