'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, Info, Lock, RefreshCcw, Search, ShieldAlert } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import type { TableSummary } from '@/components/database-admin/types';

type SortKey = 'name' | 'estimatedRows' | 'sizeBytes' | 'columnCount';

export default function DatabaseTablesPage() {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<'all' | 'business' | 'system'>('all');
  const [moduleKey, setModuleKey] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const tables = useQuery<TableSummary[]>({
    queryKey: ['db-admin', 'tables'],
    queryFn: () => api<TableSummary[]>('/admin/database/tables'),
    refetchOnWindowFocus: false,
  });

  const rows = useMemo(() => {
    let list = tables.data ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const catalogText = [
          t.catalog?.module,
          t.catalog?.label,
          t.catalog?.origin,
          t.catalog?.purpose,
          t.catalog?.impact,
          t.comment,
        ].filter(Boolean).join(' ');
        return `${t.name} ${catalogText}`.toLowerCase().includes(q);
      });
    }
    if (kind !== 'all') list = list.filter((t) => t.kind === kind);
    if (moduleKey !== 'all') list = list.filter((t) => t.catalog?.moduleKey === moduleKey);
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [tables.data, search, kind, moduleKey, sortKey, sortDir]);

  const moduleOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const table of tables.data ?? []) {
      if (table.catalog?.moduleKey && table.catalog?.module) map.set(table.catalog.moduleKey, table.catalog.module);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [tables.data]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Tabelas</h2>
          <p className="text-sm text-muted-foreground">{formatNumber(rows.length)} tabela(s) listada(s).</p>
        </div>
        <Button variant="outline" onClick={() => tables.refetch()} disabled={tables.isFetching}>
          <RefreshCcw className={cn('mr-2 h-4 w-4', tables.isFetching && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      <SectionCard title="Catalogo de tabelas" description="Mapa navegavel de tabela fisica, modulo, origem, finalidade e impacto." contentClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por tabela, modulo, origem, finalidade ou impacto..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="w-auto">
            <option value="all">Todas</option>
            <option value="business">Negocio</option>
            <option value="system">Sistema</option>
          </NativeSelect>
          <NativeSelect value={moduleKey} onChange={(e) => setModuleKey(e.target.value)} className="w-auto max-w-[260px]">
            <option value="all">Todos os modulos</option>
            {moduleOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </NativeSelect>
        </div>

        {tables.isLoading && <LoadingState label="Lendo catalogo..." />}
        {!tables.isLoading && rows.length === 0 && <EmptyState title="Nenhuma tabela encontrada" className="border-0 bg-transparent" />}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <Th label="Tabela" onClick={() => toggleSort('name')} active={sortKey === 'name'} dir={sortDir} />
                  <th className="min-w-[260px] text-left">Identificacao</th>
                  <th className="min-w-[320px] text-left">O que faz / impacto</th>
                  <th className="text-left">Tipo</th>
                  <Th label="Registros (est.)" onClick={() => toggleSort('estimatedRows')} active={sortKey === 'estimatedRows'} dir={sortDir} />
                  <Th label="Colunas" onClick={() => toggleSort('columnCount')} active={sortKey === 'columnCount'} dir={sortDir} />
                  <th className="text-left">PK</th>
                  <th className="text-left">FKs</th>
                  <th className="text-left">Indices</th>
                  <Th label="Tamanho" onClick={() => toggleSort('sizeBytes')} active={sortKey === 'sizeBytes'} dir={sortDir} />
                  <th className="text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.name}>
                    <td>
                      <div className="flex items-center gap-2">
                        {t.protected && <Lock className="h-3.5 w-3.5 text-status-red" aria-label="Tabela protegida" />}
                        <Link href={`/settings/database/tables/${encodeURIComponent(t.name)}`} className="font-medium text-primary hover:underline">
                          {t.name}
                        </Link>
                      </div>
                      {t.comment && <div className="text-xs text-muted-foreground">{t.comment}</div>}
                    </td>
                    <td>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{t.catalog.module}</Badge>
                          <span className="font-medium">{t.catalog.label}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">Origem: {t.catalog.origin}</div>
                      </div>
                    </td>
                    <td>
                      <div className="max-w-[460px] space-y-1 text-sm">
                        <p>{t.catalog.purpose}</p>
                        <p className="flex gap-1 text-xs text-muted-foreground" title={t.catalog.impact}>
                          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{t.catalog.impact}</span>
                        </p>
                      </div>
                    </td>
                    <td>
                      <Badge variant="outline" className={cn(t.kind === 'system' && 'border-status-yellow/40 text-status-yellow')}>
                        {t.kind === 'system' ? 'Sistema' : 'Negocio'}
                      </Badge>
                    </td>
                    <td>{formatNumber(t.estimatedRows)}</td>
                    <td>{t.columnCount}</td>
                    <td className="font-mono text-xs">{t.primaryKey.join(', ') || '-'}</td>
                    <td>{t.foreignKeyCount}</td>
                    <td>{t.indexCount}</td>
                    <td>{t.sizePretty}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/settings/database/tables/${encodeURIComponent(t.name)}`}>Abrir</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldAlert className="h-3.5 w-3.5" />
        Acoes destrutivas (limpar/excluir tabela) ficam na tela da tabela, com confirmacao reforcada, backup automatico e auditoria.
      </p>
    </div>
  );
}

function Th({ label, onClick, active, dir }: { label: string; onClick: () => void; active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <th className="text-left">
      <button type="button" onClick={onClick} className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground')}>
        {label}
        <ArrowUpDown className={cn('h-3 w-3', active ? 'opacity-100' : 'opacity-40')} />
        {active && <span className="text-[10px]">{dir === 'asc' ? 'ASC' : 'DESC'}</span>}
      </button>
    </th>
  );
}
