'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Construction, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { Button } from '@/components/ui/button';
import { usePortalConfig } from '@/components/portal-admin/portal-config-provider';

const DEFAULT_MSG = 'Esta funcionalidade está temporariamente indisponível para manutenção. Tente novamente mais tarde.';

/**
 * Bloqueia páginas marcadas como manutenção/bloqueadas pela Central de Administração.
 * Super Admin nunca é bloqueado (routeBlock retorna null). Resiliente: sem config, não bloqueia.
 */
export function PortalRouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { routeBlock } = usePortalConfig();
  const block = routeBlock(pathname ?? '');

  if (!block) return <>{children}</>;

  const isGlobal = block.reason === 'global';
  const isMaint = block.reason === 'maintenance' || isGlobal;

  return (
    <div>
      <PageHeader
        eyebrow={isMaint ? 'Manutenção' : 'Indisponível'}
        tone="admin"
        title={isGlobal ? 'Portal em manutenção' : isMaint ? 'Em manutenção' : 'Indisponível'}
        description={block.message || DEFAULT_MSG}
        breadcrumbs={[{ label: 'Início', href: '/' }]}
      />
      <SectionCard
        title={isMaint ? 'Voltamos em breve' : 'Recurso indisponível'}
        description="Esta área foi temporariamente desativada pelo administrador do portal."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard">Voltar ao início</Link>
          </Button>
        }
      >
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {isMaint ? <Construction className="mx-auto mb-3 h-8 w-8 opacity-60" /> : <ShieldAlert className="mx-auto mb-3 h-8 w-8 opacity-60" />}
          {block.message || DEFAULT_MSG}
        </div>
      </SectionCard>
    </div>
  );
}
