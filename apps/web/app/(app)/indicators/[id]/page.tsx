'use client';

import { useParams } from 'next/navigation';
import { IndicatorDetailView } from '@/components/platform/indicator-detail-view';

export default function IndicatorDetailPage() {
  const params = useParams<{ id: string }>();
  return <IndicatorDetailView id={params.id} />;
}
