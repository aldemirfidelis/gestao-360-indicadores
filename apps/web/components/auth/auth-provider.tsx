'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { api, clearTokens, getAccessToken, setTokens } from '@/lib/api';
import { SUPER_ADMIN_ONLY_PERMISSION } from '@/components/shell/navigation';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  homeCompanyId?: string;
  impersonating?: boolean;
  activeCompany?: { id: string; name: string } | null;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  accessProfile?: { id: string; code: string; name: string } | null;
  permissions?: string[];
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  hasPermission: (permissions?: string | string[]) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  /** Super Admin: troca a empresa ativa (null = volta à empresa de origem) e recarrega. */
  switchCompany: (companyId: string | null) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

const PUBLIC_PATHS = ['/', '/login'];
const PUBLIC_PREFIXES = ['/platform-admin', '/portal-seguranca'];
const PLATFORM_ACCESS_KEY = 'g360.platformAdmin.accessToken';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const refreshUser = async () => {
    const profile = await api<AuthUser & { sub?: string }>('/auth/me');
    const normalized = { ...profile, id: profile.sub ?? profile.id, permissions: profile.permissions ?? [] };
    setUser((current) => {
      if (current && !sameAuthScope(current, normalized)) {
        queryClient.clear();
      }
      return normalized;
    });
    return normalized;
  };

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      if (!PUBLIC_PATHS.includes(pathname) && !PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        router.replace('/login');
      }
      return;
    }
    refreshUser()
      .catch(() => {
        clearTokens();
        queryClient.clear();
        router.replace('/login');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    queryClient.clear();
    setUser(null);
    const out = await api<{
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
    }>('/auth/login', { method: 'POST', json: { email, password } });
    setTokens(out.accessToken, out.refreshToken);
    queryClient.clear();
    const profile = await refreshUser();
    // Super Admin escolhe qual empresa administrar antes de entrar.
    if (profile?.role === 'SUPER_ADMIN') {
      router.replace('/selecionar-empresa');
      return;
    }
    // Pagina inicial padrao = Meu Dia, respeitando a preferencia do usuario.
    let landing = '/meu-dia';
    try {
      const pref: any = await api('/my-day/preferences');
      if (pref?.landingPage && typeof pref.landingPage === 'string' && pref.landingPage.startsWith('/')) {
        landing = pref.landingPage;
      }
    } catch {
      /* mantem o padrao */
    }
    router.replace(landing);
  };

  const switchCompany = async (companyId: string | null) => {
    await api('/platform/switch', { method: 'POST', json: { companyId } });
    queryClient.clear();
    // Reload duro: zera o cache do React Query e refaz todas as queries já no
    // escopo da nova empresa efetiva (recomputada no backend a cada requisição).
    if (typeof window !== 'undefined') window.location.assign('/dashboard');
  };

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST', json: { refreshToken: null } });
    } catch {
      /* no-op */
    }
    clearTokens();
    queryClient.clear();
    setUser(null);
    router.replace('/login');
  };

  const hasPermission = (permissions?: string | string[]) => {
    if (!permissions || (Array.isArray(permissions) && permissions.length === 0)) return true;
    if (
      pathname.startsWith('/platform-admin') &&
      typeof window !== 'undefined' &&
      window.localStorage.getItem(PLATFORM_ACCESS_KEY)
    ) {
      return true;
    }
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    const required = Array.isArray(permissions) ? permissions : [permissions];
    if (required.includes(SUPER_ADMIN_ONLY_PERMISSION)) return false;
    const granted = new Set(user.permissions ?? []);
    return required.some((permission) => granted.has(permission) || granted.has(`${permission.split(':')[0]}:manage`));
  };

  return <Ctx.Provider value={{ user, loading, hasPermission, login, logout, refreshUser, switchCompany }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth fora de AuthProvider');
  return ctx;
}

function sameAuthScope(a: AuthUser, b: AuthUser) {
  return (
    a.id === b.id &&
    a.companyId === b.companyId &&
    a.homeCompanyId === b.homeCompanyId &&
    a.role === b.role &&
    Boolean(a.impersonating) === Boolean(b.impersonating)
  );
}
