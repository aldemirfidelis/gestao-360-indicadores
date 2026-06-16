'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuditMigratedLayout(_props: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    router.replace('/platform-admin');
  }, [router]);

  return (
    <div className="grid min-h-[320px] place-items-center text-sm text-muted-foreground">
      <div className="border border-border/60 bg-card px-5 py-4">
        Auditoria movida para o Portal Administrativo Global. Redirecionando...
      </div>
    </div>
  );
}
