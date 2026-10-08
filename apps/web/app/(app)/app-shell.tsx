'use client';
import { isDemoRouteAllowed } from '@g360/shared';

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { MobileNav } from '@/components/shell/mobile-nav';
import { useAuth } from '@/components/auth/auth-provider';
import { RoutePermissionGate } from '@/components/auth/route-permission-gate';
import { PortalRouteGate } from '@/components/portal-admin/portal-route-gate';
import { PortalAnnouncements } from '@/components/portal-admin/portal-announcements';
import { findRoutePermissions } from '@/components/shell/navigation';
import { Vision360Provider } from '@/components/ui/vision360-context';
import { Vision360Sidebar } from '@/components/ui/vision360-sidebar';
import { HelpBotFloatingButton } from '@/components/help-bot/help-bot-floating-button';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const exclusiveTotem = user?.accessProfile?.code === 'TOTEM';

  useEffect(() => {
    if (!loading && user?.isDemo && !isDemoRouteAllowed(pathname)) router.replace('/meu-dia');
    if (!loading && exclusiveTotem) router.replace('/totem');
  }, [exclusiveTotem, loading, router, user, pathname]);

  if (loading) {
    return (
      <div className="enterprise-shell grid min-h-screen place-items-center text-sm text-muted-foreground">
        <div className="border border-border/60 bg-card px-5 py-4">Carregando Gestão 360...</div>
      </div>
    );
  }
  if (!user || (user.isDemo && !isDemoRouteAllowed(pathname))) return null;
  if (exclusiveTotem) {
    return (
      <div className="enterprise-shell grid min-h-screen place-items-center text-sm text-muted-foreground">
        <div className="border border-border/60 bg-card px-5 py-4">Abrindo terminal de ponto...</div>
      </div>
    );
  }
  const routePerms = findRoutePermissions(pathname ?? '');
  return (
        <Vision360Provider>
          <div className="enterprise-shell flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar />
              <PortalAnnouncements />
              {user.isDemo && <div className="border-b bg-sky-50 px-4 py-2 text-sm text-sky-900">Empresa Demonstração · Dados fictícios · Acesso somente para consulta</div>}
              <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 sm:px-5 lg:px-6 lg:py-5">
                <PortalRouteGate>
                  {routePerms ? (
                    <RoutePermissionGate permissions={routePerms}>{children}</RoutePermissionGate>
                  ) : (
                    children
                  )}
                </PortalRouteGate>
              </main>
            </div>
            <MobileNav />
            <Vision360Sidebar />
            {!user.isDemo && <HelpBotFloatingButton />}
          </div>
        </Vision360Provider>
  );
}
