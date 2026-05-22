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
        'hidden shrink-0 border-r bg-card/95 transition-[width] duration-200 lg:flex lg:flex-col',
        collapsed ? 'w-[88px]' : 'w-[304px]',
      )}
    >
      <Link
        href="/"
        className={cn('flex h-16 items-center border-b px-5', collapsed ? 'justify-center px-3' : 'gap-3')}
        title="Gestão 360"
      >
        {collapsed ? <BrandMark className="h-9 w-9" /> : <BrandLogo />}
      </Link>

      <AccordionNavigation collapsed={collapsed} onCollapsedChange={setCollapsed} />
    </aside>
  );
}
