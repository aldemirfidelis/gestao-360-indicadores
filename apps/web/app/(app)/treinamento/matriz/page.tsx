'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shell/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { AssignmentTable } from '@/components/training/assignment-table';

function MatrizContent() {
  const searchParams = useSearchParams();
  return (
    <AssignmentTable
      initial={{
        trainingId: searchParams.get('trainingId') ?? '',
        orgNodeId: searchParams.get('orgNodeId') ?? '',
        jobId: searchParams.get('jobId') ?? '',
        status: searchParams.get('status') ?? '',
      }}
    />
  );
}

export default function MatrizPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Treinamento e Desenvolvimento"
        tone="view"
        title="Matriz de Treinamento"
        description="O que cada colaborador precisa realizar, de onde vem a exigência e em que situação está."
        breadcrumbs={[{ label: 'Treinamento', href: '/treinamento' }, { label: 'Matriz' }]}
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <MatrizContent />
      </Suspense>
    </div>
  );
}
