'use client';

import { useParams } from 'next/navigation';
import { ActionDetailView } from '@/components/platform/action-detail-view';

export default function ActionDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <ActionDetailView id={id} />;
}
