'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Settings } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { usePortalConfig } from '@/components/portal-admin/portal-config-provider';
import { isActivePath, visiblePortalServiceSections } from '@/components/shell/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PortalServicesMenu({
  collapsed = false,
  mobile = false,
  onNavigate,
}: {
  collapsed?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const { user } = useAuth();
  const { navHidden, sectionHidden, navLabel } = usePortalConfig();
  const sections = useMemo(
    () =>
      visiblePortalServiceSections(user)
        .filter((section) => !sectionHidden(section.heading))
        .map((section) => ({
          ...section,
          items: section.items
            .filter((item) => !navHidden(item.href))
            .map((item) => ({ ...item, label: navLabel(item.href) ?? item.label })),
        }))
        .filter((section) => section.items.length > 0),
    [user, navHidden, sectionHidden, navLabel],
  );
  const hasActiveItem = sections.some((section) =>
    section.items.some((item) => isActivePath(pathname, item.href, item.exact, currentSearch)),
  );

  if (sections.length === 0) return null;

  return (
    <div
      className={cn(
        'flex shrink-0 border-t border-[#1b2b54]/30 p-3',
        collapsed ? 'justify-center' : 'justify-end',
      )}
    >
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'relative h-9 w-9 text-slate-400 hover:bg-white/[0.06] hover:text-white',
              hasActiveItem && 'bg-blue-500/15 text-blue-300',
            )}
            aria-label="Abrir serviços do portal"
            title="Serviços do portal"
          >
            <Settings className="h-5 w-5" />
            {hasActiveItem && (
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-blue-400" />
            )}
          </Button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side={mobile ? 'top' : 'right'}
            align="end"
            sideOffset={8}
            collisionPadding={8}
            className="z-50 max-h-[min(70vh,560px)] w-[min(320px,calc(100vw-16px))] overflow-y-auto rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-2xl outline-none animate-in fade-in-0 zoom-in-95"
          >
            <DropdownMenu.Label className="flex items-center gap-2 px-2.5 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              <Settings className="h-4 w-4" />
              Serviços do portal
            </DropdownMenu.Label>

            {sections.map((section, sectionIndex) => (
              <div key={section.heading}>
                {sectionIndex > 0 && <DropdownMenu.Separator className="my-2 h-px bg-border" />}
                {!section.flat && (
                  <DropdownMenu.Label className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {section.heading}
                  </DropdownMenu.Label>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActivePath(pathname, item.href, item.exact, currentSearch);
                    return (
                      <DropdownMenu.Item key={`${section.heading}-${item.href}`} asChild>
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2.5 outline-none transition-colors focus:bg-accent',
                            active ? 'bg-primary/10 text-primary' : 'hover:bg-accent/70',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border',
                              active ? 'border-primary/25 bg-primary/10' : 'border-border bg-muted/40',
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium leading-5">{item.label}</span>
                            {item.description && (
                              <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                                {item.description}
                              </span>
                            )}
                          </span>
                        </Link>
                      </DropdownMenu.Item>
                    );
                  })}
                </div>
              </div>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
