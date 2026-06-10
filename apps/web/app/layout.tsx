import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/providers';
import { AnalyticsScripts } from '@/components/marketing/analytics';
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/public-site';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | Plataforma de gestão corporativa integrada`,
    template: `%s | ${SITE_NAME}`,
  },
  description: 'Plataforma corporativa de gestão estratégica, indicadores, planos de ação e melhoria contínua.',
  alternates: { canonical: absoluteUrl('/') },
  icons: {
    icon: '/brand/favicon.svg',
    shortcut: '/brand/favicon.svg',
    apple: '/brand/apple-touch-icon.svg',
  },
  manifest: '/brand/site.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: SITE_NAME,
    title: `${SITE_NAME} | Plataforma de gestão corporativa integrada`,
    description: 'Conecte estratégia, indicadores, planos de ação, documentos, auditorias, riscos e melhoria contínua em um único ambiente.',
    url: absoluteUrl('/'),
    images: [{ url: absoluteUrl(DEFAULT_OG_IMAGE), width: 1200, height: 630, alt: `${SITE_NAME} - plataforma de gestão corporativa` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} | Plataforma de gestão corporativa integrada`,
    description: 'Conecte estratégia, indicadores, planos de ação, documentos, auditorias, riscos e melhoria contínua em um único ambiente.',
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
        <AnalyticsScripts />
      </body>
    </html>
  );
}
