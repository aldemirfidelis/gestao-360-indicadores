'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { usePortalConfig } from '@/components/portal-admin/portal-config-provider';
import {
  isActivePath,
  visibleNavSections,
} from '@/components/shell/navigation';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/brand/brand-mark';
import { api } from '@/lib/api';
import type { ConversationSummary } from '@/lib/communication/types';
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
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const { user } = useAuth();
  const { navHidden, sectionHidden, navLabel } = usePortalConfig();
  const sections = useMemo(() => {
    // Overlay do portal: remove seções/itens ocultos pela Central de Administração
    // (status de módulo/página E overrides da aba "Menus") e aplica rótulos custom.
    // Resiliente: sem config, os helpers são no-op e nada muda.
    return visibleNavSections(user)
      .filter((section) => !sectionHidden(section.heading))
      .map((section) => ({
        ...section,
        items: section.items
          .filter((item) => !navHidden(item.href))
          .map((item) => ({ ...item, label: navLabel(item.href) ?? item.label })),
      }))
      .filter((section) => section.items.length > 0);
  }, [user, navHidden, sectionHidden, navLabel]);
  const currentSection = sections.find((section) =>
    section.items.some((item) => isActivePath(pathname, item.href, item.exact, currentSearch)),
  );
  const conversations = useQuery<ConversationSummary[]>({
    queryKey: ['conversations'],
    queryFn: () => api('/communication/conversations'),
    enabled: !!user,
    refetchInterval: 30_000,
  });
  const unreadMessages = (conversations.data ?? []).reduce((sum, c) => sum + c.unread, 0);
  const [open, setOpen] = useState<Set<string>>(() => {
    const initial = currentSection?.heading ?? sections[0]?.heading;
    return new Set(initial ? [initial] : []);
  });

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
    <div className="flex h-full min-h-0 flex-col justify-between">
      <div className={cn('flex-1 overflow-y-auto', mobile ? 'px-2 py-3' : 'px-2 py-3')}>
        {!mobile && (
          <div className={cn('mb-2 flex items-center', collapsed ? 'justify-center' : 'justify-between px-2')}>
            {!collapsed && (
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Navegação
              </div>
            )}
            {onCollapsedChange && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-400 hover:text-white hover:bg-white/[0.05]"
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

            // Seção "flat": item único, renderizado como link direto (sem accordion/sub-menu).
            if (section.flat) {
              const item = section.items[0];
              if (!item) return null;
              const FlatIcon = item.icon;
              const flatActive = isActivePath(pathname, item.href, item.exact, currentSearch);
              return (
                <Link
                  key={section.heading}
                  href={item.href}
                  onClick={onNavigate}
                  title={item.description}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors',
                    collapsed && 'justify-center',
                    flatActive ? 'bg-blue-600 text-white shadow-sm font-medium' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]',
                  )}
                >
                  <FlatIcon className={cn("h-4 w-4 shrink-0", flatActive ? "opacity-100" : "opacity-70")} />
                  {!collapsed && <span className="min-w-0 flex-1 leading-tight">{item.label}</span>}
                </Link>
              );
            }

            return (
              <div key={section.heading}>
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggle(section.heading)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors',
                      sectionActive ? 'text-white font-bold' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]',
                    )}
                    title={section.description}
                  >
                    <SectionIcon className="h-4 w-4 shrink-0 opacity-70" />
                    <span className="min-w-0 flex-1 leading-tight line-clamp-2">{section.heading}</span>
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', isOpen && 'rotate-180')} />
                  </button>
                )}

                {collapsed && (
                  <div className="px-1 pb-1 pt-2 text-center text-slate-500" title={section.heading}>
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
                          className="pointer-events-none absolute left-0 top-0 h-full w-px bg-[#1b2b54]/50"
                        />
                        <div className="space-y-0.5">
                          {section.items.map((item, idx) => {
                            const Icon = item.icon;
                            const active = sectionActive && isActivePath(pathname, item.href, item.exact, currentSearch);
                            const isLast = idx === section.items.length - 1;
                            const itemUnread = item.href === '/comunicacao' ? unreadMessages : 0;
                            return (
                              <Link
                                key={`${section.heading}-${item.href}-${item.label}`}
                                href={item.href}
                                onClick={onNavigate}
                                title={item.description}
                                className={cn(
                                  'group relative flex items-center gap-2.5 py-2 pl-5 pr-3 text-[13px] transition-colors rounded-md',
                                  active
                                    ? 'bg-white/[0.08] font-medium text-white shadow-sm'
                                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
                                )}
                              >
                                {/* Conector horizontal pai -> filho (L invertido) */}
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    'pointer-events-none absolute left-0 top-1/2 h-px w-3 -translate-y-1/2',
                                    active ? 'bg-blue-500' : 'bg-[#1b2b54]/50',
                                  )}
                                />
                                {/* Mascara para encerrar a linha vertical no ultimo filho */}
                                {isLast && (
                                  <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute -left-px top-1/2 h-1/2 w-px bg-[#0a1128]"
                                  />
                                )}
                                {active && <span className="absolute left-0 top-0 h-full w-[2px] bg-blue-500" />}
                                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300')} />
                                <span className="min-w-0 flex-1 leading-tight line-clamp-2">{item.label}</span>
                                {itemUnread > 0 && (
                                  <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-status-red px-1.5 text-[10px] font-semibold text-white">
                                    {itemUnread > 99 ? '99+' : itemUnread}
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0.5 pb-2">
                        {section.items.map((item) => {
                          const Icon = item.icon;
                          const active = sectionActive && isActivePath(pathname, item.href, item.exact, currentSearch);
                          const itemUnread = item.href === '/comunicacao' ? unreadMessages : 0;
                          return (
                            <Link
                              key={`${section.heading}-${item.href}-${item.label}`}
                              href={item.href}
                              onClick={onNavigate}
                              title={item.label}
                              className={cn(
                                'group relative flex items-center justify-center gap-2.5 py-2 px-2 text-sm transition-colors rounded-md',
                                active
                                  ? 'bg-white/[0.08] font-medium text-white shadow-sm'
                                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
                              )}
                            >
                              {active && <span className="absolute left-0 top-0 h-full w-[2px] bg-blue-500" />}
                              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300')} />
                              {itemUnread > 0 && (
                                <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-status-red" />
                              )}
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

      {/* Card IA e Rodapé */}
      {!collapsed && (
        <div className="p-4 border-t border-[#1b2b54]/30 space-y-4">
          <div className="rounded-xl bg-gradient-to-br from-indigo-950/80 to-blue-900/60 p-4 border border-[#203363] space-y-3 relative overflow-hidden">
            {/* Ícone de Brilho de IA */}
            <div className="h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Novidade: IA Gestão 360</h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                Insights inteligentes para apoiar suas decisões.
              </p>
            </div>
            <button className="w-full py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors border border-white/10">
              Conhecer agora
            </button>
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-[11px] mt-2">
            <BrandMark className="h-5 w-5 rounded bg-white text-[#0a1128]" />
            <span>Gestão 360 &copy; 2026</span>
          </div>
        </div>
      )}
    </div>
  );
}
