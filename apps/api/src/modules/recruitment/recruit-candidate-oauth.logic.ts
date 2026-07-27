/**
 * Login social do candidato (Google e LinkedIn), lógica pura.
 *
 * Os dois provedores falam OpenID Connect, então o formato do `userinfo` é o
 * mesmo (`sub`, `email`, `email_verified`, `name`, `picture`) e o tratamento é
 * comum. O que muda por provedor são as URLs e os escopos.
 */

export type OAuthProvider = 'GOOGLE' | 'LINKEDIN';

export interface OAuthProviderConfig {
  provider: OAuthProvider;
  label: string;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
}

export interface OAuthProfile {
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  pictureUrl: string | null;
}

const PROVIDERS: Record<OAuthProvider, Omit<OAuthProviderConfig, 'clientId' | 'clientSecret'> & { idEnv: string; secretEnv: string }> = {
  GOOGLE: {
    provider: 'GOOGLE',
    label: 'Google',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
    idEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    secretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
  },
  LINKEDIN: {
    provider: 'LINKEDIN',
    label: 'LinkedIn',
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    // "Sign In with LinkedIn using OpenID Connect" — o endpoint /v2/me antigo
    // exigia o produto legado e não devolvia e-mail junto.
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    scope: 'openid profile email',
    idEnv: 'LINKEDIN_OAUTH_CLIENT_ID',
    secretEnv: 'LINKEDIN_OAUTH_CLIENT_SECRET',
  },
};

/** Normaliza o nome do provedor vindo da URL (`google`, `GOOGLE`, ...). */
export function parseProvider(value: unknown): OAuthProvider | null {
  const key = String(value ?? '').trim().toUpperCase();
  return key === 'GOOGLE' || key === 'LINKEDIN' ? key : null;
}

/**
 * Configuração do provedor, ou `null` quando as credenciais não estão no
 * ambiente — é isso que faz o botão sumir da tela em vez de quebrar no clique.
 */
export function providerConfig(provider: OAuthProvider, env: NodeJS.ProcessEnv = process.env): OAuthProviderConfig | null {
  const base = PROVIDERS[provider];
  const clientId = String(env[base.idEnv] ?? '').trim();
  const clientSecret = String(env[base.secretEnv] ?? '').trim();
  if (!clientId || !clientSecret) return null;
  const { idEnv, secretEnv, ...rest } = base;
  return { ...rest, clientId, clientSecret };
}

/** Provedores prontos para uso, na ordem em que aparecem na tela. */
export function availableProviders(env: NodeJS.ProcessEnv = process.env): Array<{ provider: OAuthProvider; label: string }> {
  return (['GOOGLE', 'LINKEDIN'] as const)
    .map((provider) => ({ provider, config: providerConfig(provider, env) }))
    .filter((item) => item.config !== null)
    .map((item) => ({ provider: item.provider, label: item.config!.label }));
}

/** Base pública do site (o app e a API dividem o mesmo host, a API sob `/api`). */
export function publicSiteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.PUBLIC_SITE_URL ?? env.NEXT_PUBLIC_SITE_URL ?? 'https://gestao360.org';
  return raw.trim().replace(/\/+$/, '');
}

/** URL de callback registrada no provedor. Precisa bater caractere a caractere. */
export function callbackUrl(provider: OAuthProvider, env: NodeJS.ProcessEnv = process.env): string {
  return `${publicSiteUrl(env)}/api/careers/candidates/oauth/${provider.toLowerCase()}/callback`;
}

export function buildAuthorizeUrl(config: OAuthProviderConfig, state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: config.scope,
    state,
  });
  // O Google só devolve e-mail já consentido sem reperguntar; `select_account`
  // evita entrar direto na conta errada em máquina compartilhada.
  if (config.provider === 'GOOGLE') params.set('prompt', 'select_account');
  return `${config.authorizeUrl}?${params.toString()}`;
}

/**
 * Converte o `userinfo` OIDC no que o portal precisa.
 * Devolve `null` quando falta o identificador do provedor.
 */
export function normalizeOAuthProfile(raw: any): OAuthProfile | null {
  const providerAccountId = String(raw?.sub ?? '').trim();
  if (!providerAccountId) return null;

  const email = String(raw?.email ?? '').trim().toLowerCase() || null;
  const name = String(raw?.name ?? [raw?.given_name, raw?.family_name].filter(Boolean).join(' ') ?? '').trim() || null;
  return {
    providerAccountId,
    email,
    // O LinkedIn devolve `email_verified` como string em algumas respostas.
    emailVerified: raw?.email_verified === true || raw?.email_verified === 'true',
    name,
    pictureUrl: String(raw?.picture ?? '').trim() || null,
  };
}

/**
 * Só aceita caminho interno como destino pós-login.
 * Sem isso, `?returnTo=https://site-falso` transformaria o callback em redirect
 * aberto — e um link de phishing passaria pelo nosso domínio.
 */
export function safeReturnTo(value: unknown, fallback = '/candidato'): string {
  const raw = String(value ?? '').trim();
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}

/**
 * Destino final: o token vai no FRAGMENTO da URL, não na query.
 * Fragmento não é enviado ao servidor nem gravado em log de acesso/Referer.
 */
export function successRedirect(returnTo: string, token: string, env: NodeJS.ProcessEnv = process.env): string {
  return `${publicSiteUrl(env)}${safeReturnTo(returnTo)}#token=${encodeURIComponent(token)}`;
}

/** Volta para a tela de login mostrando o motivo, sem detalhe técnico. */
export function failureRedirect(returnTo: string, reason: string, env: NodeJS.ProcessEnv = process.env): string {
  const path = safeReturnTo(returnTo);
  const separator = path.includes('?') ? '&' : '?';
  return `${publicSiteUrl(env)}${path}${separator}erroLogin=${encodeURIComponent(reason)}`;
}
