'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shell/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { AssignmentTable } from '@/components/training/assignment-table';

function PendenciasContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status') ?? '';
  return (
    <AssignmentTable
      // Pendências abre já filtrada no que está em aberto.
      initial={{
        status,
        onlyOpen: !status,
        trainingId: searchParams.get('trainingId') ?? '',
        orgNodeId: searchParams.get('orgNodeId') ?? '',
      }}
      showOpenToggle={false}
      emptyTitle="Nenhum treinamento pendente encontrado para os filtros selecionados."
    />
  );
}

export default function PendenciasPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Treinamento e Desenvolvimento"
        tone="view"
        title="Pendências e Vencimentos"
        description="Tudo que exige ação: pendentes, vencidos, próximos do vencimento e aguardando validação."
        breadcrumbs={[{ label: 'Treinamento', href: '/treinamento' }, { label: 'Pendências' }]}
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <PendenciasContent />
      </Suspense>
    </div>
  );
}
