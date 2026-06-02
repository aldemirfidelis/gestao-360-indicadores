'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Play, Plus, Trash2 } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api, ApiError } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import type { ExecuteResult, TableSchema, TableSummary } from '@/components/database-admin/types';

const CodeEditor = dynamic(() => import('@/components/database-admin/code-editor').then((m) => m.CodeEditor), { ssr: false });

const OPERATORS: { value: string; label: string; needsValue: boolean | 'two' | 'list' }[] = [
  { value: 'eq', label: '= igual', needsValue: true },
  { value: 'neq', label: '≠ diferente', needsValue: true },
  { value: 'gt', label: '> maior', needsValue: true },
  { value: 'lt', label: '< menor', needsValue: true },
  { value: 'gte', label: '≥ maior/igual', needsValue: true },
  { value: 'lte', label: '≤ menor/igual', needsValue: true },
  { value: 'contains', label: 'contém', needsValue: true },
  { value: 'ncontains', label: 'não contém', needsValue: true },
  { value: 'startsWith', label: 'inicia com', needsValue: true },
  { value: 'endsWith', label: 'termina com', needsValue: true },
  { value: 'isEmpty', label: 'está vazio', needsValue: false },
  { value: 'isNotEmpty', label: 'não vazio', needsValue: false },
  { value: 'between', label: 'entre', needsValue: 'two' },
  { value: 'in', label: 'na lista', needsValue: 'list' },
];

interface Cond {
  column: string;
  operator: string;
  value: string;
  value2: string;
}

function q(id: string) {
  return `"${id.replace(/"/g, '""')}"`;
}
function lit(v: string) {
  return `'${String(v).replace(/'/g, "''")}'`;
}

export default function QueryBuilderPage() {
  const [table, setTable] = useState('');
  const [cols, setCols] = useState<Set<string>>(new Set());
  const [conds, setConds] = useState<Cond[]>([]);
  const [combinator, setCombinator] = useState<'AND' | 'OR'>('AND');
  const [orderBy, setOrderBy] = useState('');
  const [orderDir, setOrderDir] = useState<'ASC' | 'DESC'>('ASC');
  const [limit, setLimit] = useState('100');
  const [result, setResult] = useState<ExecuteResult | null>(null);

  const tables = useQuery<TableSummary[]>({ queryKey: ['db-admin', 'tables'], queryFn: () => api('/admin/database/tables'), refetchOnWindowFocus: false });
  const schema = useQuery<TableSchema>({
    queryKey: ['db-admin', 'table-schema', table],
    queryFn: () => api(`/admin/database/tables/${encodeURIComponent(table)}/schema`),
    enabled: !!table,
    refetchOnWindowFocus: false,
  });
  const columns = schema.data?.columns ?? [];
  const columnNames = columns.map((c) => c.name);

  const sql = useMemo(() => {
    if (!table) return '';
    const selectCols = cols.size === 0 ? '*' : [...cols].map(q).join(', ');
    let s = `SELECT ${selectCols}\nFROM ${q(table)}`;
    const valid = conds.filter((c) => c.column && columnNames.includes(c.column));
    if (valid.length > 0) {
      const parts = valid.map((c) => {
        const col = q(c.column);
        switch (c.operator) {
          case 'eq': return `${col} = ${lit(c.value)}`;
          case 'neq': return `${col} <> ${lit(c.value)}`;
          case 'gt': return `${col} > ${lit(c.value)}`;
          case 'lt': return `${col} < ${lit(c.value)}`;
          case 'gte': return `${col} >= ${lit(c.value)}`;
          case 'lte': return `${col} <= ${lit(c.value)}`;
          case 'contains': return `${col}::text ILIKE ${lit(`%${c.value}%`)}`;
          case 'ncontains': return `${col}::text NOT ILIKE ${lit(`%${c.value}%`)}`;
          case 'startsWith': return `${col}::text ILIKE ${lit(`${c.value}%`)}`;
          case 'endsWith': return `${col}::text ILIKE ${lit(`%${c.value}`)}`;
          case 'isEmpty': return `(${col} IS NULL OR ${col}::text = '')`;
          case 'isNotEmpty': return `(${col} IS NOT NULL AND ${col}::text <> '')`;
          case 'between': return `${col} BETWEEN ${lit(c.value)} AND ${lit(c.value2)}`;
          case 'in': return `${col}::text IN (${c.value.split(',').map((v) => lit(v.trim())).join(', ')})`;
          default: return '';
        }
      });
      s += `\nWHERE ${parts.join(`\n  ${combinator} `)}`;
    }
    if (orderBy && columnNames.includes(orderBy)) s += `\nORDER BY ${q(orderBy)} ${orderDir}`;
    const lim = parseInt(limit, 10);
    if (Number.isFinite(lim) && lim > 0) s += `\nLIMIT ${lim}`;
    return s + ';';
  }, [table, cols, conds, combinator, orderBy, orderDir, limit, columnNames]);

  const execute = useMutation({
    mutationFn: () => api<ExecuteResult>('/admin/database/query/execute', { method: 'POST', json: { sql, mode: 'safe' } }),
    onSuccess: (r) => {
      setResult(r);
      toast.success(`${r.rowCount} linha(s) em ${r.durationMs} ms.`);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Construtor Visual de Consultas</h2>
        <p className="text-sm text-muted-foreground">Monte um SELECT sem escrever SQL. Executa em Modo Seguro (somente leitura).</p>
      </div>

      <SectionCard title="Origem" description="Tabela e colunas.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[280px,1fr]">
          <div>
            <Label>Tabela</Label>
            <NativeSelect value={table} onChange={(e) => { setTable(e.target.value); setCols(new Set()); setConds([]); setOrderBy(''); setResult(null); }}>
              <option value="">Selecione...</option>
              {(tables.data ?? []).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </NativeSelect>
          </div>
          {table && (
            <div>
              <Label>Colunas ({cols.size === 0 ? 'todas' : cols.size})</Label>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-auto rounded-lg border p-2">
                {columns.map((c) => {
                  const on = cols.has(c.name);
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setCols((prev) => { const n = new Set(prev); n.has(c.name) ? n.delete(c.name) : n.add(c.name); return n; })}
                      className={`rounded px-2 py-0.5 text-xs ${on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {table && (
        <SectionCard
          title="Filtros e ordenação"
          description="Combine condições."
          actions={
            <Button size="sm" variant="outline" onClick={() => setConds((c) => [...c, { column: columnNames[0] ?? '', operator: 'eq', value: '', value2: '' }])}>
              <Plus className="mr-1.5 h-4 w-4" /> Condição
            </Button>
          }
        >
          <div className="space-y-2">
            {conds.length > 1 && (
              <div className="flex items-center gap-2 text-xs">
                Combinar com
                <NativeSelect value={combinator} onChange={(e) => setCombinator(e.target.value as 'AND' | 'OR')} className="w-auto">
                  <option value="AND">E (AND)</option>
                  <option value="OR">OU (OR)</option>
                </NativeSelect>
              </div>
            )}
            {conds.map((c, i) => {
              const op = OPERATORS.find((o) => o.value === c.operator);
              return (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <NativeSelect value={c.column} onChange={(e) => updateCond(setConds, i, { column: e.target.value })} className="w-auto">
                    {columnNames.map((n) => <option key={n} value={n}>{n}</option>)}
                  </NativeSelect>
                  <NativeSelect value={c.operator} onChange={(e) => updateCond(setConds, i, { operator: e.target.value })} className="w-auto">
                    {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </NativeSelect>
                  {op?.needsValue === true && <Input className="w-44" value={c.value} onChange={(e) => updateCond(setConds, i, { value: e.target.value })} placeholder="valor" />}
                  {op?.needsValue === 'two' && (
                    <>
                      <Input className="w-32" value={c.value} onChange={(e) => updateCond(setConds, i, { value: e.target.value })} placeholder="de" />
                      <Input className="w-32" value={c.value2} onChange={(e) => updateCond(setConds, i, { value2: e.target.value })} placeholder="até" />
                    </>
                  )}
                  {op?.needsValue === 'list' && <Input className="w-56" value={c.value} onChange={(e) => updateCond(setConds, i, { value: e.target.value })} placeholder="v1, v2, v3" />}
                  <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => setConds((cs) => cs.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Label className="text-xs">Ordenar por</Label>
              <NativeSelect value={orderBy} onChange={(e) => setOrderBy(e.target.value)} className="w-auto">
                <option value="">—</option>
                {columnNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </NativeSelect>
              <NativeSelect value={orderDir} onChange={(e) => setOrderDir(e.target.value as 'ASC' | 'DESC')} className="w-auto">
                <option value="ASC">ASC</option>
                <option value="DESC">DESC</option>
              </NativeSelect>
              <Label className="text-xs">Limite</Label>
              <Input className="w-24" type="number" value={limit} onChange={(e) => setLimit(e.target.value)} />
            </div>
          </div>
        </SectionCard>
      )}

      {table && (
        <SectionCard title="SQL gerado" description="Revise antes de executar." actions={<Button size="sm" onClick={() => execute.mutate()} disabled={execute.isPending}><Play className="mr-1.5 h-4 w-4" /> Executar</Button>}>
          <CodeEditor value={sql} height="120px" readOnly />
        </SectionCard>
      )}

      {result && (
        <SectionCard title="Resultado" description={`${formatNumber(result.rowCount)} linha(s) · ${result.durationMs} ms`} contentClassName="p-0">
          {result.rows.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Sem linhas.</div>
          ) : (
            <div className="max-h-[420px] overflow-auto">
              <table className="table-modern">
                <thead><tr>{result.columns.map((c) => <th key={c} className="text-left">{c}</th>)}</tr></thead>
                <tbody>
                  {result.rows.map((r, i) => (
                    <tr key={i}>{result.columns.map((c) => <td key={c} className="max-w-[280px] truncate font-mono text-xs">{r[c] === null ? 'NULL' : typeof r[c] === 'object' ? JSON.stringify(r[c]) : String(r[c])}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}

function updateCond(setConds: React.Dispatch<React.SetStateAction<Cond[]>>, i: number, patch: Partial<Cond>) {
  setConds((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
}
