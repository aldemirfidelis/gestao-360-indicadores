'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { attachPageListeners, observeHome, setTrackingMode, trackPage, trackingBlocked, trackingMode } from '@/lib/site-analytics';

/**
 * Visitantes do site e da demonstração (Portal Admin › Visitantes do Site): conta as páginas
 * públicas e a navegação dentro da Empresa Demonstração. Quem está logado no sistema ou no
 * Portal Admin não entra nos números.
 */
export function SiteTracker() {
  const { user, loading } = useAuth();
  const pathname = usePathname() ?? '/';
  const mode = trackingMode({ pathname, loading, user, blocked: trackingBlocked() });
  const active = mode !== 'off';

  useEffect(() => {
    setTrackingMode(mode);
  }, [mode]);

  useEffect(() => {
    if (!active) return;
    return attachPageListeners();
  }, [active]);

  useEffect(() => {
    if (mode !== 'off') trackPage(pathname);
  }, [mode, pathname]);

  useEffect(() => {
    if (mode !== 'site' || pathname !== '/') return;
    return observeHome();
  }, [mode, pathname]);

  return null;
}
