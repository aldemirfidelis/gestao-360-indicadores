'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { LoadingState } from '@/components/platform/loading-state';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { Button } from '@/components/ui/button';
import { SUPER_ADMIN_ONLY_PERMISSION, defaultLandingFor } from '@/components/shell/navigation';

interface Props {
  permissions: string | string[];
  title?: string;
  description?: string;
  children: ReactNode;
}

export function RoutePermissionGate({ permissions, title, description, children }: Props) {
  const { hasPermission, loading, user } = useAuth();
  const landing = defaultLandingFor(user);
  const requiredLabel = Array.isArray(permissions)
    ? permissions.map(formatPermission).join(' ou ')
    : formatPermission(permissions);

  if (loading) {
    return <LoadingState label="Verificando permissões..." />;
  }

  if (!hasPermission(permissions)) {
    return (
      <div>
        <PageHeader
          eyebrow="Acesso restrito"
          tone="admin"
          title={title ?? 'Sem permissão para acessar'}
          description={description ?? 'Seu perfil não possui acesso a esta área. Solicite a um administrador a permissão adequada.'}
          breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Acesso restrito' }]}
        />
        <SectionCard
          title="Permissão necessária"
          description="Esta tela depende de uma permissão que ainda não foi atribuída ao seu perfil."
          actions={
            <Button asChild variant="outline">
              <Link href={landing}>Ir para uma área permitida</Link>
            </Button>
          }
        >
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            <ShieldAlert className="mx-auto mb-3 h-8 w-8 opacity-60" />
            Permissões exigidas:{' '}
            <span className="font-mono text-foreground">
              {requiredLabel}
            </span>
          </div>
        </SectionCard>
      </div>
    );
  }

  return <>{children}</>;
}

function formatPermission(permission: string) {
  return permission === SUPER_ADMIN_ONLY_PERMISSION ? 'SUPER_ADMIN' : permission;
}
