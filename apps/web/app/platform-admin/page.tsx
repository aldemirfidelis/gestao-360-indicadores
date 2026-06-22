'use client';

import dynamic from 'next/dynamic';

// App administrativo 100% client (usa useSearchParams/estado de sessao). Carregar
// com ssr:false evita o prerender estatico, que quebrava o `next build`.
const PlatformAdminApp = dynamic(
  () => import('@/components/platform-admin/platform-admin-app').then((m) => m.PlatformAdminApp),
  { ssr: false },
);

export default function PlatformAdminPage() {
  return <PlatformAdminApp />;
}
