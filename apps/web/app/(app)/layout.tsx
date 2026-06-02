'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { MobileNav } from '@/components/shell/mobile-nav';
import { useAuth } from '@/components/auth/auth-provider';
import { RoutePermissionGate } from '@/components/auth/route-permission-gate';
import { PortalRouteGate } from '@/components/portal-admin/portal-route-gate';
import { PortalAnnouncements } from '@/components/portal-admin/portal-announcements';
import { findRoutePermissions } from '@/components/shell/navigation';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  if (loading) {
    return (
      <div className="enterprise-shell grid min-h-screen place-items-center text-sm text-muted-foreground">
        <div className="border border-border/60 bg-card px-5 py-4">Carregando Gestão 360...</div>
      </div>
    );
  }
  if (!user) return null;
  const routePerms = findRoutePermissions(pathname ?? '');
  return (
    <div className="enterprise-shell flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar />
        <PortalAnnouncements />
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
    </div>
  );
}
