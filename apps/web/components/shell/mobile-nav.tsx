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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="grid h-14" style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href, item.exact);
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground/80',
              )}
            >
              {active && <span className="absolute top-0 h-[2px] w-8 bg-foreground" />}
              <Icon className="h-4 w-4" strokeWidth={active ? 2.2 : 1.6} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
