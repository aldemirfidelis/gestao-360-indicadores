'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AccordionNavigation } from '@/components/shell/accordion-navigation';
import { BrandLogo } from '@/components/brand/brand-logo';
import { CompanyLogo, useHasCompanyLogo } from '@/components/brand/company-logo';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  // Com logo da empresa, a marca Gestão 360 entra em versão ícone: as duas
  // horizontais juntas não cabem nos 248px da barra e o logo saía cortado.
  const hasCompanyLogo = useHasCompanyLogo();

  return (
    <aside
      className={cn(
        'hidden shrink-0 border-r border-[hsl(var(--shell-border)/0.5)] bg-[hsl(var(--shell-bg))] text-[hsl(var(--shell-muted))] transition-[width] duration-200 lg:flex lg:flex-col',
        collapsed ? 'w-[64px]' : 'w-[248px]',
      )}
    >
      <Link
        href="/meu-dia"
        className={cn(
          'flex h-14 items-center overflow-hidden border-b border-[hsl(var(--shell-border)/0.5)] px-4 text-[hsl(var(--shell-foreground))]',
          collapsed ? 'justify-center px-2' : 'gap-2.5',
        )}
        title="Gestão 360"
      >
        {collapsed ? (
          <BrandLogo variant="icon" size="sm" theme="dark" className="h-7 w-7" animated={true} />
        ) : hasCompanyLogo ? (
          <>
            <BrandLogo variant="icon" size="sm" theme="dark" className="h-8 w-8 shrink-0" animated={true} />
            <CompanyLogo imgClassName="h-7" />
          </>
        ) : (
          <BrandLogo variant="horizontal" size="sm" theme="dark" className="text-white" animated={true} />
        )}
      </Link>

      <AccordionNavigation collapsed={collapsed} onCollapsedChange={setCollapsed} />
    </aside>
  );
}
