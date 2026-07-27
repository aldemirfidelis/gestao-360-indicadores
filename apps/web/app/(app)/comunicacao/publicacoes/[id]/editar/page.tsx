'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shell/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicationForm } from '@/components/communication/publication-form';
import { api } from '@/lib/api';
import type { Publication } from '@/lib/communication/publications';

export default function EditarPublicacaoPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const publication = useQuery<Publication>({
    queryKey: ['communication-publication', id],
    queryFn: () => api(`/communication/publications/${id}`),
    enabled: Boolean(id),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Comunicação"
        tone="launch"
        title="Editar publicação"
        description="Ajuste o conteúdo, a aparência, o público ou as opções de divulgação."
        breadcrumbs={[
          { label: 'Comunicação', href: '/comunicacao' },
          { label: 'Publicações', href: '/comunicacao/publicacoes' },
          { label: publication.data?.title ?? 'Publicação' },
        ]}
      />
      {publication.isLoading ? <Skeleton className="h-96 w-full" /> : publication.data && <PublicationForm publication={publication.data} />}
    </div>
  );
}
