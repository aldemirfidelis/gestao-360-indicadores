'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AccordionNavigation } from '@/components/shell/accordion-navigation';
import { BrandLogo } from '@/components/brand/brand-logo';
import { CompanyLogo } from '@/components/brand/company-logo';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'hidden shrink-0 border-r border-[hsl(var(--shell-border)/0.5)] bg-[hsl(var(--shell-bg))] text-slate-200 transition-[width] duration-200 lg:flex lg:flex-col',
        collapsed ? 'w-[64px]' : 'w-[248px]',
      )}
    >
      <Link
        href="/meu-dia"
        className={cn('flex h-14 items-center border-b border-[hsl(var(--shell-border)/0.5)] px-4 text-white', collapsed ? 'justify-center px-2' : 'gap-3')}
        title="Gestão 360"
      >
        {collapsed ? (
          <BrandLogo variant="icon" size="sm" theme="dark" className="h-7 w-7" animated={true} />
        ) : (
          <>
            <BrandLogo variant="horizontal" size="sm" theme="dark" className="text-white" animated={true} />
            <CompanyLogo imgClassName="h-6 max-w-[84px]" />
          </>
        )}
      </Link>

      <AccordionNavigation collapsed={collapsed} onCollapsedChange={setCollapsed} />
    </aside>
  );
}
