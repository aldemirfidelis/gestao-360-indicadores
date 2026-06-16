import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Portal Administrativo Global',
  robots: { index: false, follow: false },
};

export default function PlatformAdminLayout({ children }: { children: ReactNode }) {
  return children;
}
