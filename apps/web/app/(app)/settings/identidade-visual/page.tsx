'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { LoadingState } from '@/components/platform/loading-state';
import { SectionCard } from '@/components/platform/section-card';
import { BrandingSection } from '@/components/settings/branding-section';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';

export default function IdentidadeVisualPage() {
  const { hasPermission, loading } = useAuth();
  const canView = hasPermission(['settings:view', 'settings:manage']);
  const canManage = hasPermission(['settings:manage']);

  if (loading) return <LoadingState label="Carregando identidade visual..." />;

  return (
    <div>
      <PageHeader
        eyebrow="Configurações"
        tone="admin"
        title="Logo e cores do portal"
        description="Personalize a identidade visual da sua empresa e confira a prévia antes de salvar."
        breadcrumbs={[
          { label: 'Início', href: '/' },
          { label: 'Configurações', href: '/settings' },
          { label: 'Logo e cores' },
        ]}
        actions={
          <Button asChild variant="outline">
            <Link href="/settings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Configurações
            </Link>
          </Button>
        }
      />
      {canView ? (
        <BrandingSection canManage={canManage} />
      ) : (
        <SectionCard title="Acesso restrito">
          <p className="text-sm text-muted-foreground">Seu perfil não possui permissão para visualizar as configurações da empresa.</p>
        </SectionCard>
      )}
    </div>
  );
}
