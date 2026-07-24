'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { CompanyCareersPage } from '@/components/recruitment/company-careers-page';
import { GlobalCareersPage } from '@/components/recruitment/global-careers-page';
import { resolveCareersCompanySlug } from '@/lib/candidate-api';

export default function CareersRootPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Carregando oportunidades...</main>}>
      <CareersRootContent />
    </Suspense>
  );
}

function CareersRootContent() {
  const params = useSearchParams();
  const companySlug = useMemo(() => resolveCareersCompanySlug(params.get('empresa')), [params]);
  return companySlug ? <CompanyCareersPage empresa={companySlug} /> : <GlobalCareersPage />;
}
