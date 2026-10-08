'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { DEMO_PATH } from '@/lib/public-site';

type DemoLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'> & {
  children: ReactNode;
  href?: string;
  source?: string;
};

export function DemoLink({ children, href = DEMO_PATH, source = 'site_cta', ...props }: DemoLinkProps) {
  const pathname = usePathname();
  const { loginDemo } = useAuth();
  const [busy, setBusy] = useState(false);
  // Já estamos na página de destino (o acesso está logo abaixo): o botão
  // não leva a lugar nenhum, então some — vale para o cabeçalho e para o hero.
  if (pathname === href.split('?')[0]) return null;

  function trackDemoAccess() {
    const payload = {
      event: 'demo_access_click',
      page: window.location.pathname,
      clickedAt: new Date().toISOString(),
      source,
      referrer: document.referrer || null,
      utm: Object.fromEntries(new URLSearchParams(window.location.search).entries()),
    };

    try {
      window.sessionStorage.setItem('g360.demoEntry', JSON.stringify(payload));
      window.localStorage.setItem('g360.lastDemoEntry', JSON.stringify(payload));
    } catch {
      /* Storage pode estar bloqueado; a navegação deve continuar. */
    }
    window.dispatchEvent(new CustomEvent('g360:analytics', { detail: payload }));
    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).dataLayer.push(payload);
  }

  return (
    <Link href={href} aria-disabled={busy} onClick={async (event) => {
      trackDemoAccess();
      if (href.split('?')[0] !== DEMO_PATH) return;
      event.preventDefault();
      if (busy) return;
      setBusy(true);
      try { await loginDemo(); }
      catch { toast.error('Demonstração indisponível no momento. Tente novamente em instantes.'); setBusy(false); }
    }} {...props}>
      {children}
    </Link>
  );
}
