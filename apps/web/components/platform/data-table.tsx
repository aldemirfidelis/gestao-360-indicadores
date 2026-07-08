'use client';

import { useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/platform/empty-state';
import { cn } from '@/lib/utils';

export type { ColumnDef };

/**
 * Tabela padrão da plataforma: busca, ordenação por coluna, paginação
 * client-side e estados de loading/vazio integrados. Usar no lugar de
 * <table> manual nos módulos para comportamento e visual consistentes.
 *
 * Colunas seguem o ColumnDef do TanStack Table:
 *   { accessorKey: 'name', header: 'Nome', cell: ({ row }) => ... }
 * Ordenação por coluna é ativada por padrão; desative com enableSorting: false.
 */
export function DataTable<TData>({
  columns,
  data,
  loading = false,
  searchable = true,
  searchPlaceholder = 'Buscar...',
  pageSize = 25,
  emptyTitle = 'Nenhum registro encontrado',
  emptyDescription,
  emptyAction,
  onRowClick,
  toolbar,
  className,
}: {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** 0 desativa a paginação (mostra tudo) */
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: TData) => void;
  /** conteúdo extra à direita da busca (filtros, botões) */
  toolbar?: ReactNode;
  className?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const paginated = pageSize > 0;
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(paginated
      ? { getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize } } }
      : {}),
  });

  const rows = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination?.pageIndex ?? 0;
  const pageCount = table.getPageCount();

  return (
    <div className={cn('rounded-lg border bg-card shadow-sm', className)}>
      {(searchable || toolbar) && (
        <div className="flex flex-col gap-2 border-b border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between">
          {searchable ? (
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 pl-8"
              />
            </div>
          ) : (
            <div />
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      {loading ? (
        <div className="p-3">
          <SkeletonRows rows={6} />
        </div>
      ) : total === 0 ? (
        <EmptyState
          title={globalFilter ? 'Nada encontrado para a busca' : emptyTitle}
          description={globalFilter ? 'Tente outros termos ou limpe a busca.' : emptyDescription}
          action={globalFilter ? undefined : emptyAction}
          className="border-0"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-border/60 bg-muted/40">
                  {hg.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const dir = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        className={cn(
                          'whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground',
                          canSort && 'cursor-pointer select-none hover:text-foreground',
                        )}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      >
                        <span className="inline-flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort &&
                            (dir === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : dir === 'desc' ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-40" />
                            ))}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-border/40 last:border-0',
                    onRowClick && 'cursor-pointer transition-colors hover:bg-accent/50',
                  )}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paginated && !loading && total > pageSize && (
        <div className="flex items-center justify-between border-t border-border/60 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {total} registro{total === 1 ? '' : 's'} · página {pageIndex + 1} de {pageCount}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
