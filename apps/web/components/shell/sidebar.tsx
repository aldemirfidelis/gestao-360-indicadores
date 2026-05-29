'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AccordionNavigation } from '@/components/shell/accordion-navigation';
import { BrandLogo, BrandMark } from '@/components/brand/brand-mark';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'hidden shrink-0 border-r border-border/60 bg-card transition-[width] duration-200 lg:flex lg:flex-col',
        collapsed ? 'w-[64px]' : 'w-[248px]',
      )}
    >
      <Link
        href="/dashboard"
        className={cn('flex h-14 items-center border-b border-border/60 px-4', collapsed ? 'justify-center px-2' : 'gap-3')}
        title="Gestão 360"
      >
        {collapsed ? <BrandMark className="h-7 w-7" /> : <BrandLogo />}
      </Link>

      <AccordionNavigation collapsed={collapsed} onCollapsedChange={setCollapsed} />
    </aside>
  );
}
