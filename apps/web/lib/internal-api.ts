/**
 * Base da API para chamadas feitas NO SERVIDOR (route handlers, generateMetadata).
 *
 * No navegador `NEXT_PUBLIC_API_URL` é `/api` — relativo, resolvido pela origem
 * da página. No servidor não existe origem: o mesmo `/api` não leva a lugar
 * nenhum. Em produção o container `web` alcança a API pelo nome de serviço da
 * rede do compose (`INTERNAL_API_URL=http://api:3333/api`).
 */
export function internalApiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.INTERNAL_API_URL ?? env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
  if (/^https?:\/\//i.test(configured)) return configured.replace(/\/$/, '');

  const path = configured.startsWith('/') ? configured : `/${configured}`;
  const host = env.NODE_ENV === 'production' ? 'http://api:3333' : 'http://localhost:3333';
  return `${host}${path}`.replace(/\/$/, '');
}

/** Base pública do site — usada para montar URLs absolutas (Open Graph, share). */
export function publicSiteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.NEXT_PUBLIC_SITE_URL ?? 'https://gestao360.org';
  return raw.trim().replace(/\/+$/, '');
}
