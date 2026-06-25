import { api } from './api';

export interface TenantBranding {
  companyId: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
}

/**
 * Resolve o tenant (empresa) a partir do host atual — subdomínio (ex.:
 * goiasa.gestao360.org) ou domínio próprio. Retorna null no apex/host genérico.
 * Endpoint público; falhas degradam para o branding padrão.
 */
export async function fetchTenantBranding(): Promise<TenantBranding | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await api<{ tenant: TenantBranding | null }>(
      `/public/tenant?host=${encodeURIComponent(window.location.host)}`,
    );
    return res.tenant;
  } catch {
    return null;
  }
}
