'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import {
  canAccessSettings,
  isActivePath,
  settingsNavItem,
  visibleNavSections,
} from '@/components/shell/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function AccordionNavigation({
  collapsed = false,
  onCollapsedChange,
  onNavigate,
  mobile = false,
}: {
  collapsed?: boolean;
  onCollapsedChange?: (value: boolean) => void;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const sections = useMemo(() => visibleNavSections(user), [user]);
  const currentSection = sections.find((section) =>
    section.items.some((item) => isActivePath(pathname, item.href, item.exact)),
  );
  const [open, setOpen] = useState<Set<string>>(() => {
    const initial = currentSection?.heading ?? sections[0]?.heading;
    return new Set(initial ? [initial] : []);
  });
  const showSettings = canAccessSettings(user);
  const SettingsIcon = settingsNavItem.icon;
  const settingsActive = isActivePath(pathname, settingsNavItem.href);

  useEffect(() => {
    if (!currentSection) return;
    setOpen((prev) => new Set(prev).add(currentSection.heading));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSection?.heading]);

  function toggle(heading: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(heading)) next.delete(heading);
      else next.add(heading);
      return next;
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn('flex-1 overflow-y-auto', mobile ? 'px-2 py-3' : 'px-2 py-3')}>
        {!mobile && (
          <div className={cn('mb-2 flex items-center', collapsed ? 'justify-center' : 'justify-between px-2')}>
            {!collapsed && (
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                Navegação
              </div>
            )}
            {onCollapsedChange && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onCollapsedChange(!collapsed)}
                aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
                title={collapsed ? 'Expandir menu' : 'Recolher menu'}
              >
                {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
            )}
          </div>
        )}

        <div className="space-y-1">
          {sections.map((section) => {
            const SectionIcon = section.icon;
            const isOpen = collapsed ? true : open.has(section.heading);
            const sectionActive = currentSection?.heading === section.heading;

            return (
              <div key={section.heading}>
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggle(section.heading)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.1em] transition-colors',
                      sectionActive ? 'text-foreground' : 'text-muted-foreground/70 hover:text-foreground',
                    )}
                    title={section.description}
                  >
                    <SectionIcon className="h-3.5 w-3.5 opacity-70" />
                    <span className="min-w-0 flex-1 truncate">{section.heading}</span>
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', isOpen && 'rotate-180')} />
                  </button>
                )}

                {collapsed && (
                  <div className="px-1 pb-1 pt-2 text-center text-muted-foreground/50" title={section.heading}>
                    <SectionIcon className="mx-auto h-3.5 w-3.5" />
                  </div>
                )}

                <div
                  className={cn(
                    'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <div className="overflow-hidden">
                    {!collapsed ? (
                      <div className="relative ml-[18px] pb-2">
                        {/* Linha vertical do pai descendo ate o ultimo filho */}
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute left-0 top-0 h-full w-px bg-border"
                        />
                        <div className="space-y-0.5">
                          {section.items.map((item, idx) => {
                            const Icon = item.icon;
                            const active = sectionActive && isActivePath(pathname, item.href, item.exact);
                            const isLast = idx === section.items.length - 1;
                            return (
                              <Link
                                key={`${section.heading}-${item.href}-${item.label}`}
                                href={item.href}
                                onClick={onNavigate}
                                title={item.description}
                                className={cn(
                                  'group relative flex items-center gap-2.5 py-2 pl-5 pr-3 text-sm transition-colors',
                                  active
                                    ? 'bg-foreground/[0.06] font-medium text-foreground'
                                    : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
                                )}
                              >
                                {/* Conector horizontal pai -> filho (L invertido) */}
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    'pointer-events-none absolute left-0 top-1/2 h-px w-3 -translate-y-1/2',
                                    active ? 'bg-foreground' : 'bg-border',
                                  )}
                                />
                                {/* Mascara para encerrar a linha vertical no ultimo filho */}
                                {isLast && (
                                  <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute -left-px top-1/2 h-1/2 w-px bg-card"
                                  />
                                )}
                                {active && <span className="absolute left-0 top-0 h-full w-[2px] bg-foreground" />}
                                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-foreground' : 'text-muted-foreground/80')} />
                                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0.5 pb-2">
                        {section.items.map((item) => {
                          const Icon = item.icon;
                          const active = sectionActive && isActivePath(pathname, item.href, item.exact);
                          return (
                            <Link
                              key={`${section.heading}-${item.href}-${item.label}`}
                              href={item.href}
                              onClick={onNavigate}
                              title={item.label}
                              className={cn(
                                'group relative flex items-center justify-center gap-2.5 py-2 px-2 text-sm transition-colors',
                                active
                                  ? 'bg-foreground/[0.06] font-medium text-foreground'
                                  : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
                              )}
                            >
                              {active && <span className="absolute left-0 top-0 h-full w-[2px] bg-foreground" />}
                              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-foreground' : 'text-muted-foreground/80')} />
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showSettings && (
        <div className={cn('border-t border-border/60 p-2', collapsed && !mobile && 'px-1')}>
          <Link
            href={settingsNavItem.href}
            onClick={onNavigate}
            title={collapsed ? settingsNavItem.label : settingsNavItem.description}
            className={cn(
              'relative flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
              settingsActive
                ? 'bg-foreground/[0.06] font-medium text-foreground'
                : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
              collapsed && !mobile && 'justify-center px-2',
            )}
          >
            {settingsActive && <span className="absolute left-0 top-0 h-full w-[2px] bg-foreground" />}
            <SettingsIcon className={cn('h-4 w-4 shrink-0', settingsActive ? 'text-foreground' : 'text-muted-foreground/80')} />
            {(!collapsed || mobile) && <span className="min-w-0 flex-1 truncate">{settingsNavItem.label}</span>}
          </Link>
        </div>
      )}
    </div>
  );
}
