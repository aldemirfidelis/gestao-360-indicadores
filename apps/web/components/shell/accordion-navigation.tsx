'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import {
  canAccessSettings,
  isActivePath,
  settingsNavItem,
  visibleNavSections,
  type NavSection,
} from '@/components/shell/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const intentClass: Record<NavSection['intent'], string> = {
  view: 'bg-status-green/10 text-status-green border-status-green/20',
  launch: 'bg-status-blue/10 text-status-blue border-status-blue/20',
  management: 'bg-status-purple/10 text-status-purple border-status-purple/20',
  reports: 'bg-status-yellow/10 text-status-yellow border-status-yellow/20',
};

const activeIntentClass: Record<NavSection['intent'], string> = {
  view: 'bg-status-green/15 text-status-green border-status-green/30',
  launch: 'bg-status-blue/15 text-status-blue border-status-blue/30',
  management: 'bg-status-purple/15 text-status-purple border-status-purple/30',
  reports: 'bg-status-yellow/15 text-status-yellow border-status-yellow/30',
};

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
      <div className={cn('flex-1 overflow-y-auto', mobile ? 'px-3 py-3' : 'px-3 py-4')}>
        {!mobile && (
          <div className={cn('mb-3 flex items-center', collapsed ? 'justify-center' : 'justify-between px-1')}>
            {!collapsed && (
              <div>
                <div className="text-xs font-semibold text-foreground">Navegação</div>
                <div className="text-[11px] text-muted-foreground">Gestão 360</div>
              </div>
            )}
            {onCollapsedChange && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onCollapsedChange(!collapsed)}
                aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
                title={collapsed ? 'Expandir menu' : 'Recolher menu'}
              >
                {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
            )}
          </div>
        )}

        <div className="space-y-2">
          {sections.map((section) => {
            const SectionIcon = section.icon;
            const isOpen = collapsed ? true : open.has(section.heading);
            const sectionActive = currentSection?.heading === section.heading;

            return (
              <div key={section.heading} className="rounded-xl border bg-background/55 p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => toggle(section.heading)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                    sectionActive ? activeIntentClass[section.intent] : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
                    collapsed && 'justify-center px-2',
                  )}
                  title={collapsed ? section.heading : section.description}
                >
                  <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-md border', intentClass[section.intent])}>
                    <SectionIcon className="h-4 w-4" />
                  </span>
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold uppercase tracking-wide">{section.heading}</span>
                        <span className="block truncate text-[11px] opacity-80">{section.description}</span>
                      </span>
                      <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', isOpen && 'rotate-180')} />
                    </>
                  )}
                </button>

                <div
                  className={cn(
                    'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <div className="overflow-hidden">
                    <div className={cn('space-y-1 py-1', collapsed ? 'px-0' : 'pl-2 pr-1')}>
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const active = sectionActive && isActivePath(pathname, item.href, item.exact);
                        return (
                          <Link
                            key={`${section.heading}-${item.href}-${item.label}`}
                            href={item.href}
                            onClick={onNavigate}
                            title={collapsed ? item.label : item.description}
                            className={cn(
                              'group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors',
                              active
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-accent/80 hover:text-foreground',
                              collapsed && 'justify-center px-2',
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            {!collapsed && (
                              <>
                                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                {active && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                              </>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showSettings && (
        <div className={cn('border-t bg-card/90 p-3', collapsed && !mobile && 'px-2')}>
          <Link
            href={settingsNavItem.href}
            onClick={onNavigate}
            title={collapsed ? settingsNavItem.label : settingsNavItem.description}
            className={cn(
              'flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors',
              settingsActive
                ? 'border-primary/35 bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-background/70 text-muted-foreground hover:bg-accent hover:text-foreground',
              collapsed && !mobile && 'justify-center px-2',
            )}
          >
            <SettingsIcon className="h-5 w-5 shrink-0" />
            {(!collapsed || mobile) && (
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{settingsNavItem.label}</span>
                <span className="block truncate text-xs opacity-80">{settingsNavItem.description}</span>
              </span>
            )}
          </Link>
        </div>
      )}
    </div>
  );
}
