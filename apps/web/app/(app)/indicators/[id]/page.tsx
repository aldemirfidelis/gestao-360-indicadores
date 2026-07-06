'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { IndicatorDetailView } from '@/components/platform/indicator-detail-view';

export default function IndicatorDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  // Vindo do Painel Executivo: abre o indicador já no mês e visão escolhidos,
  // para tratar os desvios daquele mês mesmo com o mês vigente se alimentando.
  const initialPeriodRef = searchParams.get('periodRef') ?? undefined;
  const initialView = searchParams.get('view') === 'cumulative' ? 'cumulative' : undefined;
  return <IndicatorDetailView id={params.id} initialPeriodRef={initialPeriodRef} initialView={initialView} />;
}
