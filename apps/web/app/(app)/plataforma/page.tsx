'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** A Administração Global de Empresas foi movida para o Portal Admin Global. */
export default function PlataformaRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/platform-admin');
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Redirecionando para o Portal Admin Global...
    </div>
  );
}
