import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { RecruitmentModuleNav } from '@/components/recruitment/module-nav';

export const metadata: Metadata = {
  title: 'Recrutamento e Seleção | Gestão 360',
};

export default function RecruitmentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <RecruitmentModuleNav />
      {children}
    </div>
  );
}
