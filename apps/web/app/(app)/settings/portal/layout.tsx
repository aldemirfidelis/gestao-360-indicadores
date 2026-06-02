'use client';

import { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { useAuth } from '@/components/auth/auth-provider';

export default function PortalAdminLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  if (loading) return <LoadingState label="Carregando central do portal..." />;

  if (!isSuperAdmin) {
    return (
      <div>
        <PageHeader
          eyebrow="Configurações"
          tone="admin"
          title="Central de Administração do Portal"
          description="Área restrita."
          breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Configurações', href: '/settings' }, { label: 'Central do Portal' }]}
        />
        <SectionCard title="Acesso restrito ao Super Admin" description="Somente o Super Admin pode administrar o portal.">
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            <ShieldAlert className="mx-auto mb-3 h-8 w-8 opacity-50" />
            Esta central controla módulos, páginas, funcionalidades e comportamento do portal — exclusiva do Super Admin.
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Configurações"
        tone="admin"
        title="Central de Administração do Portal"
        description="Painel mestre: módulos, páginas, funcionalidades, menus, permissões, escopo, manutenção, parâmetros, integrações, comunicados, snapshots e diagnóstico."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Configurações', href: '/settings' }, { label: 'Central do Portal' }]}
      />
      {children}
    </div>
  );
}
