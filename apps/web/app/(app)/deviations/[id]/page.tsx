'use client';

import { useParams } from 'next/navigation';
import { DeviationDetailView } from '@/components/platform/deviation-detail-view';

export default function DeviationDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <DeviationDetailView id={id} />;
}
