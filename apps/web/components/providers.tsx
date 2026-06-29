'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/components/auth/auth-provider';
import { PortalConfigProvider } from '@/components/portal-admin/portal-config-provider';
import { PwaManager } from '@/components/pwa/pwa-manager';

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <PortalConfigProvider>
            {children}
            <Toaster position="top-right" richColors />
            <PwaManager />
          </PortalConfigProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
