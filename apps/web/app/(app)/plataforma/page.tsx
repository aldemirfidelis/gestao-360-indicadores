'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** A Administração Global de Empresas foi movida para Configurações > Empresas. */
export default function PlataformaRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings/empresas');
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Redirecionando para Configurações &gt; Empresas...
    </div>
  );
}
