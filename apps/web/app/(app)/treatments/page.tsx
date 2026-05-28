'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { EmptyState } from '@/components/platform/empty-state';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface IndicatorBrief {
  id: string;
  name: string;
  code: string | null;
  results: { id: string; periodRef: string; light: string }[];
}

interface CurrentTreatment {
  id: string;
  status: string;
  periodRef: string;
  title: string;
}

export default function TreatmentsIndexPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const indicatorId = searchParams.get('indicatorId') ?? '';

  const indicator = useQuery<IndicatorBrief>({
    queryKey: ['indicator-brief', indicatorId],
    enabled: Boolean(indicatorId),
    queryFn: () => api<IndicatorBrief>(`/indicators/${indicatorId}`),
  });

  const lastResult = indicator.data?.results?.[indicator.data.results.length - 1];

  const current = useQuery<CurrentTreatment | null>({
    queryKey: ['treatment-current', indicatorId, lastResult?.periodRef],
    enabled: Boolean(indicatorId) && Boolean(lastResult?.periodRef),
    queryFn: () =>
      api<CurrentTreatment | null>(
        `/treatments/indicators/${indicatorId}/current?periodRef=${lastResult!.periodRef}`,
      ),
  });

  useEffect(() => {
    if (current.data?.id) {
      router.replace(`/treatments/${current.data.id}`);
    }
  }, [current.data?.id, router]);

  if (!indicatorId) {
    return (
      <div>
        <PageHeader
          eyebrow="Tratativas"
          title="Tratativas"
          description="Acesse uma tratativa a partir de um indicador, painel ou alerta."
          breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Tratativas' }]}
        />
        <EmptyState
          title="Selecione um indicador"
          description="Esta página exige um indicador. Abra um indicador em painel ou no mapa estratégico e clique em Tratativas."
        />
      </div>
    );
  }

  if (indicator.isLoading || current.isLoading) {
    return (
      <div>
        <PageHeader
          eyebrow="Tratativas"
          title="Carregando tratativa..."
          breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Tratativas' }]}
        />
        <LoadingState />
      </div>
    );
  }

  if (!indicator.data) {
    return (
      <div>
        <PageHeader
          eyebrow="Tratativas"
          title="Indicador não encontrado"
          breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Tratativas' }]}
        />
        <EmptyState
          title="Indicador inválido"
          description="O indicador informado não foi encontrado ou foi removido."
        />
      </div>
    );
  }

  const ind = indicator.data;

  return (
    <div>
      <Link
        href={`/indicators/${ind.id}`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para o indicador
      </Link>
      <PageHeader
        eyebrow="Tratativas"
        title={ind.name}
        description="Nenhuma tratativa aberta para o período atual."
        breadcrumbs={[
          { label: 'Início', href: '/' },
          { label: 'Indicadores', href: '/indicators' },
          { label: 'Tratativa' },
        ]}
      />
      <EmptyState
        title="Sem tratativa aberta"
        description={
          lastResult?.light === 'RED'
            ? 'Inicie uma tratativa abrindo o indicador.'
            : 'Este indicador não está crítico no último período registrado.'
        }
        action={
          <Button asChild>
            <Link href={`/indicators/${ind.id}`}>
              <AlertTriangle className="mr-2 h-4 w-4" /> Abrir indicador
            </Link>
          </Button>
        }
      />
    </div>
  );
}
