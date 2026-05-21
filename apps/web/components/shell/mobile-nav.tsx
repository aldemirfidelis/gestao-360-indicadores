'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { mobileNavItems } from '@/components/shell/navigation';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/96 px-2 pb-[env(safe-area-inset-bottom)] shadow-lg backdrop-blur lg:hidden">
      <div className="grid h-16 grid-cols-5">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'fill-primary/10')} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
