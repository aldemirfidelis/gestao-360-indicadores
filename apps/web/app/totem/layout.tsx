import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Totem',
  description: 'Terminal interno de reconhecimento facial para registro de ponto.',
  alternates: { canonical: '/totem' },
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
  manifest: '/icons/manifest-totem.json',
  appleWebApp: {
    capable: true,
    title: 'Totem G360',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#020617',
};

export default function TotemLayout({ children }: { children: ReactNode }) {
  return children;
}
