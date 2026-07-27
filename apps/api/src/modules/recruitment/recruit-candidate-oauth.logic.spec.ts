import { describe, expect, it } from 'vitest';
import {
  availableProviders,
  buildAuthorizeUrl,
  callbackUrl,
  failureRedirect,
  normalizeOAuthProfile,
  parseProvider,
  providerConfig,
  safeReturnTo,
  successRedirect,
} from './recruit-candidate-oauth.logic';

const SITE = { NEXT_PUBLIC_SITE_URL: 'https://gestao360.org' } as NodeJS.ProcessEnv;
const BOTH = {
  ...SITE,
  GOOGLE_OAUTH_CLIENT_ID: 'g-id',
  GOOGLE_OAUTH_CLIENT_SECRET: 'g-secret',
  LINKEDIN_OAUTH_CLIENT_ID: 'l-id',
  LINKEDIN_OAUTH_CLIENT_SECRET: 'l-secret',
} as NodeJS.ProcessEnv;

describe('parseProvider', () => {
  it('aceita o nome em qualquer caixa', () => {
    expect(parseProvider('google')).toBe('GOOGLE');
    expect(parseProvider('LinkedIn')).toBe('LINKEDIN');
  });

  it('recusa provedor desconhecido', () => {
    expect(parseProvider('facebook')).toBeNull();
    expect(parseProvider(undefined)).toBeNull();
  });
});

describe('providerConfig', () => {
  it('sem credenciais no ambiente, o provedor não existe', () => {
    expect(providerConfig('GOOGLE', SITE)).toBeNull();
  });

  it('client id sem secret também não vale', () => {
    expect(providerConfig('GOOGLE', { ...SITE, GOOGLE_OAUTH_CLIENT_ID: 'g-id' })).toBeNull();
  });

  it('com as duas credenciais, devolve a configuração', () => {
    const config = providerConfig('GOOGLE', BOTH);
    expect(config?.clientId).toBe('g-id');
    expect(config?.scope).toContain('email');
  });
});

describe('availableProviders', () => {
  it('lista só o que está configurado', () => {
    expect(availableProviders(SITE)).toEqual([]);
    expect(availableProviders({ ...SITE, LINKEDIN_OAUTH_CLIENT_ID: 'l', LINKEDIN_OAUTH_CLIENT_SECRET: 's' })).toEqual([
      { provider: 'LINKEDIN', label: 'LinkedIn' },
    ]);
    expect(availableProviders(BOTH).map((p) => p.provider)).toEqual(['GOOGLE', 'LINKEDIN']);
  });
});

describe('callbackUrl', () => {
  it('aponta para a API sob /api, no host público', () => {
    expect(callbackUrl('GOOGLE', SITE)).toBe('https://gestao360.org/api/careers/candidates/oauth/google/callback');
  });

  it('não duplica barra quando a base termina com /', () => {
    expect(callbackUrl('LINKEDIN', { NEXT_PUBLIC_SITE_URL: 'https://gestao360.org/' })).toBe(
      'https://gestao360.org/api/careers/candidates/oauth/linkedin/callback',
    );
  });
});

describe('buildAuthorizeUrl', () => {
  it('leva client_id, redirect_uri, escopo e state', () => {
    const url = new URL(buildAuthorizeUrl(providerConfig('GOOGLE', BOTH)!, 'state-123', callbackUrl('GOOGLE', BOTH)));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('g-id');
    expect(url.searchParams.get('state')).toBe('state-123');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('redirect_uri')).toBe('https://gestao360.org/api/careers/candidates/oauth/google/callback');
  });

  it('no Google pede escolha de conta (máquina compartilhada)', () => {
    const url = new URL(buildAuthorizeUrl(providerConfig('GOOGLE', BOTH)!, 's', 'https://x/cb'));
    expect(url.searchParams.get('prompt')).toBe('select_account');
  });
});

describe('normalizeOAuthProfile', () => {
  it('lê o perfil OIDC do Google', () => {
    expect(normalizeOAuthProfile({ sub: '123', email: 'Alguem@Gmail.com', email_verified: true, name: 'Alguém Silva' })).toEqual({
      providerAccountId: '123',
      email: 'alguem@gmail.com',
      emailVerified: true,
      name: 'Alguém Silva',
      pictureUrl: null,
    });
  });

  it('aceita email_verified como string (LinkedIn)', () => {
    expect(normalizeOAuthProfile({ sub: 'abc', email: 'a@b.com', email_verified: 'true' })?.emailVerified).toBe(true);
  });

  it('monta o nome a partir de given_name/family_name', () => {
    expect(normalizeOAuthProfile({ sub: 'abc', given_name: 'Ana', family_name: 'Souza' })?.name).toBe('Ana Souza');
  });

  it('sem sub não há identidade utilizável', () => {
    expect(normalizeOAuthProfile({ email: 'a@b.com' })).toBeNull();
    expect(normalizeOAuthProfile(null)).toBeNull();
  });
});

describe('safeReturnTo', () => {
  it('mantém caminho interno', () => {
    expect(safeReturnTo('/candidato?empresa=goiasa')).toBe('/candidato?empresa=goiasa');
  });

  it('bloqueia redirect aberto', () => {
    expect(safeReturnTo('https://site-falso.com/roubo')).toBe('/candidato');
    expect(safeReturnTo('//site-falso.com')).toBe('/candidato');
    expect(safeReturnTo('javascript:alert(1)')).toBe('/candidato');
    expect(safeReturnTo(null)).toBe('/candidato');
  });
});

describe('successRedirect', () => {
  it('entrega o token no fragmento, fora de log e Referer', () => {
    const url = successRedirect('/candidato', 'jwt.token.aqui', SITE);
    expect(url).toBe('https://gestao360.org/candidato#token=jwt.token.aqui');
    expect(url.split('#')[0]).not.toContain('token');
  });

  it('destino externo cai no padrão', () => {
    expect(successRedirect('https://site-falso.com', 't', SITE)).toBe('https://gestao360.org/candidato#token=t');
  });
});

describe('failureRedirect', () => {
  it('volta ao portal com o motivo', () => {
    expect(failureRedirect('/candidato', 'Autorização cancelada.', SITE)).toBe(
      'https://gestao360.org/candidato?erroLogin=Autoriza%C3%A7%C3%A3o%20cancelada.',
    );
  });

  it('preserva a query que já existia', () => {
    expect(failureRedirect('/candidato?empresa=goiasa', 'erro', SITE)).toContain('?empresa=goiasa&erroLogin=erro');
  });
});
