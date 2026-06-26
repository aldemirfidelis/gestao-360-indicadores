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
        'hidden shrink-0 border-r border-[#1b2b54]/50 bg-[#0a1128] text-slate-200 transition-[width] duration-200 lg:flex lg:flex-col',
        collapsed ? 'w-[64px]' : 'w-[248px]',
      )}
    >
      <Link
        href="/meu-dia"
        className={cn('flex h-14 items-center border-b border-[#1b2b54]/50 px-4 text-white', collapsed ? 'justify-center px-2' : 'gap-3')}
        title="Gestão 360"
      >
        {collapsed ? <BrandMark className="h-7 w-7 rounded bg-white text-[#0a1128]" /> : <BrandLogo className="text-white [&_.text-muted-foreground]:text-slate-400" />}
      </Link>

      <AccordionNavigation collapsed={collapsed} onCollapsedChange={setCollapsed} />
    </aside>
  );
}
