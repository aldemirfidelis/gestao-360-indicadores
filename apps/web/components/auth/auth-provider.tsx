'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, clearTokens, getAccessToken, setTokens } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  avatarUrl?: string | null;
  jobTitle?: string | null;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

const PUBLIC_PATHS = ['/login'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      if (!PUBLIC_PATHS.includes(pathname)) router.replace('/login');
      return;
    }
    api<AuthUser & { sub?: string }>('/auth/me')
      .then((u) => setUser({ ...u, id: u.sub ?? u.id }))
      .catch(() => {
        clearTokens();
        router.replace('/login');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const out = await api<{
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
    }>('/auth/login', { method: 'POST', json: { email, password } });
    setTokens(out.accessToken, out.refreshToken);
    setUser(out.user);
    router.replace('/');
  };

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST', json: { refreshToken: null } });
    } catch {
      /* no-op */
    }
    clearTokens();
    setUser(null);
    router.replace('/login');
  };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth fora de AuthProvider');
  return ctx;
}
