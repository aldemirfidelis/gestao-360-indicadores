import type { ReactNode } from 'react';
import { PrizeModuleNav } from '@/components/gestao-premio/module-nav';

export default function PrizeLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <PrizeModuleNav />
      {children}
    </div>
  );
}
