'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import type { ColumnInfo } from '@/components/database-admin/types';

interface RowsResponse {
  table: string;
  columns: ColumnInfo[];
  primaryKey: string[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

type DialogMode = { type: 'create' | 'edit' | 'duplicate'; row?: Record<string, unknown> } | null;

export function RecordEditor({ table }: { table: string }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState<string>('');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [cell, setCell] = useState<{ col: string; value: unknown } | null>(null);

  const key = ['db-admin', 'rows', table, { page, pageSize, search, sort, dir }];
  const query = useQuery<RowsResponse>({
    queryKey: key,
    queryFn: () =>
      api<RowsResponse>(
        `/admin/database/tables/${encodeURIComponent(table)}/rows?` +
          new URLSearchParams({ page: String(page), pageSize: String(pageSize), search, sort, dir }).toString(),
      ),
    refetchOnWindowFocus: false,
  });

  const data = query.data;
  const pk = data?.primaryKey ?? [];
  const hasPk = pk.length > 0;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function rowKey(row: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(pk.map((c) => [c, row[c]]));
  }
  function rowKeyId(row: Record<string, unknown>): string {
    return pk.map((c) => String(row[c])).join('|');
  }

  const deleteMut = useMutation({
    mutationFn: (keys: Record<string, unknown>[]) =>
      api<{ deleted: number; backupId: string | null }>(`/admin/database/tables/${encodeURIComponent(table)}/rows/delete`, {
        method: 'POST',
        json: { keys },
      }),
    onSuccess: (res) => {
      toast.success(`${res.deleted} registro(s) excluído(s).${res.backupId ? ' Snapshot criado.' : ''}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['db-admin', 'rows', table] });
    },
    onError: (e: ApiError) => toast.error(e.message || 'Falha ao excluir.'),
  });

  function applySearch() {
    setPage(1);
    setSearch(searchInput);
  }
  function toggleSort(col: string) {
    if (sort === col) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(col);
      setDir('asc');
    }
    setPage(1);
  }
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function confirmDeleteSelected() {
    if (!data) return;
    const keys = data.rows.filter((r) => selected.has(rowKeyId(r))).map(rowKey);
    if (keys.length === 0) return;
    if (window.confirm(`Excluir ${keys.length} registro(s) de "${table}"? Um snapshot automático será criado. Esta ação é irreversível pela interface (use o backup para restaurar).`)) {
      deleteMut.mutate(keys);
    }
  }
  function confirmDeleteRow(row: Record<string, unknown>) {
    if (window.confirm(`Excluir este registro de "${table}"? Um snapshot automático será criado.`)) {
      deleteMut.mutate([rowKey(row)]);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="w-64 pl-9"
              placeholder="Busca global..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            />
          </div>
          <Button variant="outline" size="sm" onClick={applySearch}>Buscar</Button>
          <Button variant="ghost" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCcw className={cn('mr-1.5 h-4 w-4', query.isFetching && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button variant="outline" size="sm" className="text-destructive" onClick={confirmDeleteSelected} disabled={deleteMut.isPending}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Excluir selecionados ({selected.size})
            </Button>
          )}
          <Button size="sm" onClick={() => setDialog({ type: 'create' })} disabled={!data}>
            <Plus className="mr-1.5 h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>

      {query.isLoading && <LoadingState label="Lendo registros..." />}
      {query.isError && (
        <div className="rounded-lg border border-status-red/30 bg-status-red/10 p-4 text-sm">{(query.error as Error)?.message}</div>
      )}

      {data && (
        <>
          {!hasPk && (
            <div className="rounded-lg border border-status-yellow/30 bg-status-yellow/10 p-3 text-xs">
              Esta tabela não possui chave primária — edição e exclusão por registro estão desabilitadas.
            </div>
          )}
          {data.rows.length === 0 ? (
            <EmptyState title="Nenhum registro" description="A consulta atual não retornou linhas." />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="table-modern">
                <thead>
                  <tr>
                    {hasPk && <th className="w-8" />}
                    {data.columns.map((c) => (
                      <th key={c.name} className="whitespace-nowrap text-left">
                        <button type="button" onClick={() => toggleSort(c.name)} className="inline-flex items-center gap-1 hover:text-foreground">
                          {c.name}
                          {c.isPrimaryKey && <span className="text-[9px] text-status-yellow">PK</span>}
                          {sort === c.name && <span className="text-[10px]">{dir === 'asc' ? '▲' : '▼'}</span>}
                        </button>
                        <div className="font-mono text-[9px] font-normal text-muted-foreground">{c.dataType}</div>
                      </th>
                    ))}
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => {
                    const id = rowKeyId(row);
                    return (
                      <tr key={id} className={cn(selected.has(id) && 'bg-primary/5')}>
                        {hasPk && (
                          <td>
                            <input type="checkbox" checked={selected.has(id)} onChange={() => toggleSelect(id)} aria-label="Selecionar" />
                          </td>
                        )}
                        {data.columns.map((c) => (
                          <td key={c.name} className="max-w-[260px]">
                            <button
                              type="button"
                              className="block max-w-[260px] truncate text-left hover:text-primary"
                              title="Clique para ver/copiar"
                              onClick={() => setCell({ col: c.name, value: row[c.name] })}
                            >
                              <CellValue value={row[c.name]} />
                            </button>
                          </td>
                        ))}
                        <td className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" title="Duplicar" onClick={() => setDialog({ type: 'duplicate', row })} disabled={!data}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Editar" onClick={() => setDialog({ type: 'edit', row })} disabled={!hasPk}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Excluir" className="text-destructive" onClick={() => confirmDeleteRow(row)} disabled={!hasPk}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="text-muted-foreground">
              {formatNumber(data.total)} registro(s) · página {data.page} de {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <NativeSelect
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value, 10));
                  setPage(1);
                }}
                className="w-auto"
              >
                {[25, 50, 100, 200].map((n) => (
                  <option key={n} value={n}>{n}/página</option>
                ))}
              </NativeSelect>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={data.page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={data.page >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {dialog && data && (
        <RecordDialog
          table={table}
          columns={data.columns}
          primaryKey={pk}
          mode={dialog}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            qc.invalidateQueries({ queryKey: ['db-admin', 'rows', table] });
          }}
        />
      )}

      {cell && (
        <Dialog open onOpenChange={(o) => !o && setCell(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-mono text-sm">{cell.col}</DialogTitle>
            </DialogHeader>
            <pre className="max-h-[60vh] overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">
              {cell.value === null || cell.value === undefined ? 'NULL' : typeof cell.value === 'object' ? JSON.stringify(cell.value, null, 2) : String(cell.value)}
            </pre>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  const text = cell.value === null || cell.value === undefined ? '' : typeof cell.value === 'object' ? JSON.stringify(cell.value) : String(cell.value);
                  navigator.clipboard?.writeText(text);
                  toast.success('Copiado.');
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="italic text-muted-foreground/60">NULL</span>;
  if (typeof value === 'boolean') return <span className="font-mono">{value ? 'true' : 'false'}</span>;
  if (typeof value === 'object') return <span className="font-mono text-xs text-status-purple">{JSON.stringify(value)}</span>;
  return <span>{String(value)}</span>;
}

function RecordDialog({
  table,
  columns,
  primaryKey,
  mode,
  onClose,
  onSaved,
}: {
  table: string;
  columns: ColumnInfo[];
  primaryKey: string[];
  mode: NonNullable<DialogMode>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = mode.type === 'edit';
  const source = mode.row ?? {};
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of columns) {
      const v = source[c.name];
      init[c.name] = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
    return init;
  });
  const [nullFields, setNullFields] = useState<Set<string>>(new Set());

  const editable = columns.filter((c) => !(isEdit && c.isPrimaryKey));

  const save = useMutation({
    mutationFn: () => {
      const values: Record<string, unknown> = {};
      for (const c of editable) {
        if (nullFields.has(c.name)) {
          values[c.name] = null;
          continue;
        }
        const raw = form[c.name];
        if (raw === '' && (mode.type !== 'edit')) {
          // criação: omite vazios para respeitar defaults
          if (!c.nullable && c.default === null) continue; // exigirá validação abaixo
          continue;
        }
        values[c.name] = raw;
      }
      if (isEdit) {
        const key = Object.fromEntries(primaryKey.map((c) => [c, source[c]]));
        return api(`/admin/database/tables/${encodeURIComponent(table)}/rows`, { method: 'PATCH', json: { key, values } });
      }
      return api(`/admin/database/tables/${encodeURIComponent(table)}/rows`, { method: 'POST', json: { values } });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Registro atualizado.' : 'Registro incluído.');
      onSaved();
    },
    onError: (e: ApiError) => toast.error(e.message || 'Falha ao salvar.'),
  });

  const title = mode.type === 'edit' ? 'Editar registro' : mode.type === 'duplicate' ? 'Duplicar registro' : 'Novo registro';

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title} · <span className="font-mono text-sm">{table}</span></DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {editable.map((c) => {
            const required = !c.nullable && c.default === null;
            const isNull = nullFields.has(c.name);
            return (
              <div key={c.name} className={cn(c.dataType === 'jsonb' || c.dataType === 'json' || c.dataType === 'text' ? 'md:col-span-2' : '')}>
                <div className="flex items-center justify-between">
                  <Label className={required ? 'field-required' : undefined}>
                    {c.name} <span className="font-mono text-[10px] text-muted-foreground">{c.dataType}</span>
                  </Label>
                  {c.nullable && (
                    <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={isNull}
                        onChange={(e) =>
                          setNullFields((prev) => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(c.name) : next.delete(c.name);
                            return next;
                          })
                        }
                      />
                      NULL
                    </label>
                  )}
                </div>
                {renderField(c, form[c.name] ?? '', (v) => setForm((f) => ({ ...f, [c.name]: v })), isNull)}
                {c.references && <p className="mt-0.5 text-[10px] text-muted-foreground">FK → {c.references.table}.{c.references.column}</p>}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function renderField(c: ColumnInfo, value: string, onChange: (v: string) => void, disabled: boolean) {
  const t = c.dataType.toLowerCase();
  if (t === 'boolean') {
    return (
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">(vazio)</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </NativeSelect>
    );
  }
  if (t === 'json' || t === 'jsonb' || t === 'text') {
    return <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="font-mono text-xs" />;
  }
  const inputType = ['integer', 'bigint', 'smallint', 'numeric', 'double precision', 'real'].includes(t) ? 'number' : 'text';
  return <Input type={inputType} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={c.default ?? ''} />;
}
