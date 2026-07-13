import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Ponto Totem',
  description: 'Terminal interno compartilhado para registro de ponto facial.',
  alternates: { canonical: '/ponto-totem' },
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#020617',
};

export default function KioskLayout({ children }: { children: ReactNode }) {
  return children;
}
