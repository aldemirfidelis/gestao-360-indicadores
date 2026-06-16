'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SectionCard } from '@/components/platform/section-card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { RecordEditor } from '@/components/database-admin/record-editor';
import type { TableSummary } from '@/components/database-admin/types';

export default function RecordsPage() {
  const [table, setTable] = useState('');
  const tables = useQuery<TableSummary[]>({
    queryKey: ['db-admin', 'tables'],
    queryFn: () => api<TableSummary[]>('/admin/database/tables'),
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Editor de Registros</h2>
        <p className="text-sm text-muted-foreground">Selecione uma tabela para visualizar e editar registros (CRUD com retrato e auditoria).</p>
      </div>

      <SectionCard title="Tabela" description="Escolha a tabela a editar.">
        <div className="max-w-md">
          <Label>Tabela</Label>
          <NativeSelect value={table} onChange={(e) => setTable(e.target.value)}>
            <option value="">Selecione...</option>
            {(tables.data ?? []).map((t) => (
              <option key={t.name} value={t.name}>
                {t.name} {t.protected ? '🔒' : ''} ({t.kind === 'system' ? 'sistema' : 'negócio'})
              </option>
            ))}
          </NativeSelect>
        </div>
      </SectionCard>

      {table && (
        <SectionCard title={`Registros · ${table}`} description="Busca, páginação, edição, duplicação e exclusão (individual e em massa).">
          <RecordEditor table={table} />
        </SectionCard>
      )}
    </div>
  );
}
