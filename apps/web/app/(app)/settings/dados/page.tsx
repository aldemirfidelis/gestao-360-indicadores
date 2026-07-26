'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Database, Download, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

interface DatasetDefinition {
  id: string;
  label: string;
  description: string;
  columns: Array<{ key: string; label: string }>;
}

interface DatasetResult {
  dataset: DatasetDefinition;
  rows: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pageSize: number;
}

export default function CompanyDataPage() {
  const { hasPermission } = useAuth();
  const canExport = hasPermission('company-data:export');
  const [datasetId, setDatasetId] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);

  const catalog = useQuery<DatasetDefinition[]>({
    queryKey: ['company-data', 'catalog'],
    queryFn: () => api('/company-admin/data'),
  });

  useEffect(() => {
    if (!datasetId && catalog.data?.[0]) setDatasetId(catalog.data[0].id);
  }, [catalog.data, datasetId]);

  const data = useQuery<DatasetResult>({
    queryKey: ['company-data', datasetId, appliedSearch, page],
    queryFn: () => api(`/company-admin/data/${datasetId}?page=${page}&pageSize=25&search=${encodeURIComponent(appliedSearch)}`),
    enabled: Boolean(datasetId),
  });

  const totalPages = Math.max(1, Math.ceil((data.data?.total ?? 0) / (data.data?.pageSize ?? 25)));
  const definition = data.data?.dataset ?? catalog.data?.find((item) => item.id === datasetId);
  const rows = data.data?.rows ?? [];
  const columns = definition?.columns ?? [];
  const fileBase = useMemo(() => definition?.id ?? 'dados-empresa', [definition]);

  async function exportCsv() {
    try {
      const csv = await api<string>(`/company-admin/data/${datasetId}/export?search=${encodeURIComponent(appliedSearch)}`);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${fileBase}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('Exportação concluída');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao exportar');
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administração da empresa"
        tone="admin"
        title="Dados da Empresa"
        description="Visões de consulta e exportação isoladas pelo tenant. Esta área não fornece SQL, estrutura física, backups nem credenciais."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Configurações', href: '/settings' }, { label: 'Dados da Empresa' }]}
      />

      <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Isolamento multiempresa obrigatório</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">A empresa é obtida da sessão autenticada e nunca aceita como parâmetro da tela ou da API.</p>
        </div>
        <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><Database className="h-4 w-4 text-blue-600" /> Dados minimizados</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Senhas, biometria, salários, conteúdo de documentos, payloads e dados de rede não aparecem nestas visões.</p>
        </div>
      </div>

      <SectionCard
        title={definition?.label ?? 'Conjuntos de dados'}
        description={definition?.description ?? 'Selecione uma visão autorizada.'}
        actions={canExport ? <Button variant="outline" onClick={exportCsv} disabled={!datasetId || data.isFetching}><Download className="mr-2 h-4 w-4" />Exportar CSV</Button> : undefined}
        contentClassName="p-0"
      >
        <div className="grid gap-3 border-b p-4 md:grid-cols-[minmax(220px,0.8fr)_minmax(260px,1.2fr)_auto]">
          <NativeSelect value={datasetId} onChange={(event) => { setDatasetId(event.target.value); setPage(1); }}>
            {(catalog.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </NativeSelect>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setAppliedSearch(search.trim()); setPage(1); } }} placeholder="Pesquisar nesta visão..." />
          <Button onClick={() => { setAppliedSearch(search.trim()); setPage(1); }}><Search className="mr-2 h-4 w-4" />Pesquisar</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="table-modern min-w-[900px]">
            <thead><tr>{columns.map((column) => <th key={column.key} className="text-left">{column.label}</th>)}</tr></thead>
            <tbody>
              {data.isLoading && <tr><td colSpan={Math.max(columns.length, 1)} className="py-10 text-center text-sm text-muted-foreground">Carregando dados...</td></tr>}
              {!data.isLoading && rows.map((row, index) => (
                <tr key={String(row.id ?? index)}>{columns.map((column) => <td key={column.key} className="max-w-[280px] truncate text-xs" title={formatValue(row[column.key])}>{formatValue(row[column.key])}</td>)}</tr>
              ))}
              {!data.isLoading && rows.length === 0 && <tr><td colSpan={Math.max(columns.length, 1)} className="py-10 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t p-4 text-sm">
          <span className="text-muted-foreground">{data.data?.total ?? 0} registros · página {page} de {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || data.isFetching} onClick={() => setPage((value) => value - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages || data.isFetching} onClick={() => setPage((value) => value + 1)}>Próxima</Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString('pt-BR');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
