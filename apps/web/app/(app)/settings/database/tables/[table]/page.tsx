'use client';

import { useParams } from 'next/navigation';
import { TableDetailContent } from '@/components/database-admin/table-detail-content';

export default function TableDetailPage() {
  const params = useParams<{ table: string }>();
  const table = decodeURIComponent(params.table);

  return <TableDetailContent table={table} />;
}
