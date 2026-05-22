'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { navSections, type NavSection } from '@/components/shell/navigation';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/brand/brand-mark';

const intentClass: Record<NavSection['intent'], string> = {
  home: 'bg-primary/10 text-primary',
  launch: 'bg-status-blue/10 text-status-blue',
  view: 'bg-status-green/10 text-status-green',
  admin: 'bg-status-purple/10 text-status-purple',
};

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[280px] shrink-0 border-r bg-card/95 lg:flex lg:flex-col">
      <Link href="/" className="flex h-16 items-center gap-3 border-b px-5">
        <BrandLogo />
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-5">
          {navSections.map((section) => (
            <div key={section.heading}>
              <div className="mb-2 flex items-center gap-2 px-2">
                <span className={cn('h-2 w-2 rounded-full', intentClass[section.intent])} />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.heading}
                </span>
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={`${section.heading}-${item.href}`}
                      href={item.href}
                      className={cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-accent/75 hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {active && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t p-4">
        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="text-xs font-semibold">Ambiente principal</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Gestão 360 - v0.4</p>
        </div>
      </div>
    </aside>
  );
}

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
