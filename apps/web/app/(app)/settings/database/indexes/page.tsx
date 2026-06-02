'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCcw, Search, Trash2 } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import { DdlDialog } from '@/components/database-admin/ddl-dialog';
import type { IndexInfo } from '@/components/database-admin/types';

export default function IndexesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [dropIdx, setDropIdx] = useState<IndexInfo | null>(null);
  const indexes = useQuery<IndexInfo[]>({
    queryKey: ['db-admin', 'indexes'],
    queryFn: () => api<IndexInfo[]>('/admin/database/indexes'),
    refetchOnWindowFocus: false,
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = indexes.data ?? [];
    if (!q) return list;
    return list.filter((i) => [i.name, i.table, i.columns.join(',')].join(' ').toLowerCase().includes(q));
  }, [indexes.data, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Índices e Constraints</h2>
          <p className="text-sm text-muted-foreground">{formatNumber(rows.length)} índice(s).</p>
        </div>
        <Button variant="outline" onClick={() => indexes.refetch()} disabled={indexes.isFetching}>
          <RefreshCcw className={cn('mr-2 h-4 w-4', indexes.isFetching && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      <SectionCard title="Índices" description="Índices do schema public. Criação/remoção será habilitada na Fase E (DDL)." contentClassName="p-0">
        <div className="border-b p-3">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar índice, tabela ou coluna..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {indexes.isLoading && <LoadingState label="Lendo índices..." />}
        {!indexes.isLoading && rows.length === 0 && <EmptyState title="Nenhum índice encontrado" className="border-0 bg-transparent" />}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th className="text-left">Índice</th>
                  <th className="text-left">Tabela</th>
                  <th className="text-left">Colunas</th>
                  <th className="text-left">Tipo</th>
                  <th className="text-left">Definição</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={`${i.table}.${i.name}`}>
                    <td className="font-mono text-xs">{i.name}</td>
                    <td>{i.table}</td>
                    <td className="font-mono text-xs">{i.columns.join(', ')}</td>
                    <td className="flex gap-1">
                      {i.isPrimary && <Badge variant="outline" className="border-status-yellow/40 text-status-yellow">PK</Badge>}
                      {i.isUnique && !i.isPrimary && <Badge variant="outline" className="border-status-blue/40 text-status-blue">UNIQUE</Badge>}
                      {!i.isUnique && !i.isPrimary && <Badge variant="outline">INDEX</Badge>}
                    </td>
                    <td className="max-w-[360px] truncate font-mono text-xs text-muted-foreground" title={i.definition}>{i.definition}</td>
                    <td className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        title={i.isPrimary ? 'Índice de PK não pode ser removido aqui' : 'Remover índice'}
                        disabled={i.isPrimary}
                        onClick={() => setDropIdx(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {dropIdx && (
        <DdlDialog
          title={`Remover índice ${dropIdx.name}`}
          operation="dropIndex"
          params={{ name: dropIdx.name }}
          onClose={() => setDropIdx(null)}
          onDone={() => {
            setDropIdx(null);
            qc.invalidateQueries({ queryKey: ['db-admin', 'indexes'] });
          }}
        />
      )}
    </div>
  );
}
