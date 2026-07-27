'use client';

import { PageHeader } from '@/components/shell/page-header';
import { PublicationForm } from '@/components/communication/publication-form';

export default function NovaPublicacaoPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Comunicação"
        tone="launch"
        title="Criar publicação"
        description="Monte o conteúdo, escolha o formato, defina o público e publique ou programe a divulgação."
        breadcrumbs={[
          { label: 'Comunicação', href: '/comunicacao' },
          { label: 'Publicações', href: '/comunicacao/publicacoes' },
          { label: 'Nova' },
        ]}
      />
      <PublicationForm />
    </div>
  );
}
