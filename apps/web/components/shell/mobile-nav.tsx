'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isActivePath, visibleMobileItems } from '@/components/shell/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = visibleMobileItems(user);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/96 px-2 pb-[env(safe-area-inset-bottom)] shadow-lg backdrop-blur lg:hidden">
      <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href, item.exact);
          return (
            <Link
              key={`${item.href}-${item.label}`}
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
