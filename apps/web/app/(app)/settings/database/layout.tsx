'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Database, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';
import { dbAdminNav, DB_ADMIN_BASE } from '@/components/database-admin/nav';

export default function DatabaseAdminLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  if (loading) return <LoadingState label="Carregando administração do banco..." />;

  if (!isSuperAdmin) {
    return (
      <div>
        <PageHeader
          eyebrow="Configurações"
          tone="admin"
          title="Administração do Banco de Dados"
          description="Área restrita."
          breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Configurações', href: '/settings' }, { label: 'Banco de Dados' }]}
        />
        <SectionCard title="Acesso restrito ao Super Admin" description="Somente o Super Admin pode administrar o banco de dados.">
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            <ShieldAlert className="mx-auto mb-3 h-8 w-8 opacity-50" />
            Esta área manipula diretamente o banco de dados e é exclusiva do perfil Super Admin.
          </div>
        </SectionCard>
      </div>
    );
  }

  function isActive(href: string) {
    if (href === DB_ADMIN_BASE) return pathname === DB_ADMIN_BASE;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Configurações"
        tone="admin"
        title="Administração do Banco de Dados"
        description="Visualize e administre tabelas, registros, estrutura, índices, SQL, backups e diagnósticos."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Configurações', href: '/settings' }, { label: 'Banco de Dados' }]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px,1fr]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="panel overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 border-b px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Database className="h-4 w-4 text-primary" />
                Banco de Dados
              </span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
            </button>
            {open && (
              <nav className="flex flex-col p-2">
                {dbAdminNav.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-start gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
                      )}
                    >
                      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', active && 'text-primary')} />
                      <span className="min-w-0">
                        <span className="block font-medium leading-tight">{item.label}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{item.description}</span>
                      </span>
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
        </aside>

        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
