'use client';

import { createContext, useContext, useMemo, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import type { PortalConfig } from '@/components/portal-admin/types';

interface RouteBlock {
  reason: 'maintenance' | 'blocked' | 'global';
  message?: string | null;
}

interface PortalConfigCtx {
  config: PortalConfig | null;
  loading: boolean;
  /** Item deve sair do menu (oculto/desativado). Sem config => false (não esconde). */
  navHidden: (href: string) => boolean;
  /** Seção/grupo do menu deve sair (override por heading). */
  sectionHidden: (heading: string) => boolean;
  /** Rótulo customizado do item de menu, se houver override. */
  navLabel: (href: string) => string | null;
  /** Rota indisponível (manutenção/bloqueio/global). Super Admin nunca é bloqueado. */
  routeBlock: (href: string) => RouteBlock | null;
  /** Flag habilitada para o usuário. Sem config => true (não esconde feature). */
  isFeature: (key: string) => boolean;
}

const Ctx = createContext<PortalConfigCtx | null>(null);

const HIDE_STATUSES = ['INACTIVE', 'BLOCKED', 'DISCONTINUED'];

export function PortalConfigProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const query = useQuery<PortalConfig>({
    queryKey: ['portal', 'config'],
    queryFn: () => api<PortalConfig>('/portal/config'),
    enabled: Boolean(user),
    retry: false,
    staleTime: 60_000,
  });
  const config = query.data ?? null;
  const isSuper = user?.role === 'SUPER_ADMIN';

  const value = useMemo<PortalConfigCtx>(() => {
    // Rotas ocultas: por status de módulo/página E por override de menu (aba "Menus").
    const hidden = new Set<string>();
    const sectionHiddenSet = new Set<string>();
    const labels = new Map<string, string>();
    const blocked: { route: string; block: RouteBlock }[] = [];

    if (config) {
      const items = [
        ...config.modules.map((m) => ({ route: m.route, status: m.status, hidden: m.hidden, maintenance: m.maintenance, message: m.unavailableMessage })),
        ...config.pages.map((p) => ({ route: p.route, status: p.status, hidden: p.hidden, maintenance: p.maintenance, message: p.unavailableMessage })),
      ];
      for (const it of items) {
        if (!it.route) continue;
        if (it.hidden || HIDE_STATUSES.includes(it.status)) hidden.add(it.route);
        if (it.maintenance) blocked.push({ route: it.route, block: { reason: 'maintenance', message: it.message } });
        else if (HIDE_STATUSES.includes(it.status)) blocked.push({ route: it.route, block: { reason: 'blocked', message: it.message } });
      }
      // Overrides de menu: itemKey iniciando com "/" é um item (rota); senão é heading de seção.
      for (const ov of config.navOverrides ?? []) {
        const isRoute = ov.itemKey.startsWith('/');
        if (ov.hidden) {
          if (isRoute) hidden.add(ov.itemKey);
          else sectionHiddenSet.add(ov.itemKey);
        }
        if (isRoute && ov.labelOverride) labels.set(ov.itemKey, ov.labelOverride);
      }
    }
    const globalMaint = config?.maintenance.global.active && !(isSuper && config.maintenance.global.allowSuperAdmin);

    return {
      config,
      loading: query.isLoading,
      navHidden: (href) => hidden.has(href),
      sectionHidden: (heading) => sectionHiddenSet.has(heading),
      navLabel: (href) => labels.get(href) ?? null,
      routeBlock: (href) => {
        if (isSuper) return null; // Super Admin nunca é bloqueado
        if (globalMaint) return { reason: 'global', message: config?.maintenance.global.message };
        const match = blocked
          .filter((b) => href === b.route || href.startsWith(`${b.route}/`))
          .sort((a, b) => b.route.length - a.route.length)[0];
        return match?.block ?? null;
      },
      isFeature: (key) => (config ? config.flags[key] ?? false : true),
    };
  }, [config, isSuper, query.isLoading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortalConfig(): PortalConfigCtx {
  const ctx = useContext(Ctx);
  // Resiliência: fora do provider, retorna no-op (comportamento atual do app).
  if (!ctx) {
    return { config: null, loading: false, navHidden: () => false, sectionHidden: () => false, navLabel: () => null, routeBlock: () => null, isFeature: () => true };
  }
  return ctx;
}

/** Hook utilitário para UI sob feature flag. */
export function useFeature(key: string): boolean {
  return usePortalConfig().isFeature(key);
}
