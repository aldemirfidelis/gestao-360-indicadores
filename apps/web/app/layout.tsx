import './globals.css';
import type { Metadata, Viewport } from 'next';
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
  description: 'Plataforma corporativa integrada para estratégia, qualidade, segurança, suprimentos e toda a jornada de pessoas, do cargo ao ponto e à folha.',
  alternates: { canonical: absoluteUrl('/') },
  icons: {
    icon: [
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/icons/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
  manifest: '/icons/manifest.json',
  applicationName: SITE_NAME,
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: SITE_NAME,
    title: `${SITE_NAME} | Plataforma de gestão corporativa integrada`,
    description: 'Conecte estratégia, indicadores, qualidade, segurança, suprimentos, cargos, recrutamento, ponto, folha e vida funcional em um único ambiente.',
    url: absoluteUrl('/'),
    images: [{ url: absoluteUrl(DEFAULT_OG_IMAGE), width: 1200, height: 630, alt: `${SITE_NAME} - plataforma de gestão corporativa` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} | Plataforma de gestão corporativa integrada`,
    description: 'Conecte estratégia, indicadores, qualidade, segurança, suprimentos, cargos, recrutamento, ponto, folha e vida funcional em um único ambiente.',
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0f2042' },
    { media: '(prefers-color-scheme: dark)', color: '#081023' },
  ],
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
