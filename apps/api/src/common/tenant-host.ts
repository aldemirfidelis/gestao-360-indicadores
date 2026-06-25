/**
 * Resolução de tenant a partir do host (multi-tenant por subdomínio).
 *
 * Modelo: o tenant continua sendo derivado da IDENTIDADE do usuário no backend
 * (ver effective-company.ts). O host serve para branding da tela de login e para
 * validar que o usuário pertence à empresa daquele endereço — nunca como fonte
 * de autorização de dados.
 */

// Subdomínios que NÃO representam empresas (infra/serviços do portal).
const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'app',
  'admin',
  'platform',
  'collabora',
  'static',
  'assets',
  'cdn',
  'mail',
]);

/** Domínio raiz da plataforma (ex.: gestao360.org). Configurável por ambiente. */
export function platformRootDomain(): string {
  return (process.env.PLATFORM_ROOT_DOMAIN ?? 'gestao360.org').toLowerCase();
}

/** Remove porta, espaços e normaliza para minúsculas. */
export function normalizeHost(host?: string | null): string {
  return (host ?? '').toLowerCase().trim().split(':')[0];
}

/**
 * Extrai o slug do subdomínio quando o host está sob o domínio raiz.
 * Retorna null para o apex, `www`, subdomínios reservados, multi-nível
 * (a.b.raiz) e hosts que não pertencem ao domínio raiz (domínio próprio).
 */
export function subdomainFromHost(host?: string | null, root = platformRootDomain()): string | null {
  const h = normalizeHost(host);
  if (!h || h === root) return null;
  const suffix = `.${root}`;
  if (!h.endsWith(suffix)) return null;
  const label = h.slice(0, -suffix.length);
  if (!label || label.includes('.')) return null;
  if (RESERVED_SUBDOMAINS.has(label)) return null;
  return label;
}
