'use client';

import Link from 'next/link';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { DEMO_PATH } from '@/lib/public-site';

type DemoLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'> & {
  children: ReactNode;
  href?: string;
  source?: string;
};

export function DemoLink({ children, href = DEMO_PATH, source = 'site_cta', ...props }: DemoLinkProps) {
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
    <Link href={href} onClick={trackDemoAccess} {...props}>
      {children}
    </Link>
  );
}
