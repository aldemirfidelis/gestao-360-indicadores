'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Upload } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api';
import type { ColumnInfo, TableSummary } from '@/components/database-admin/types';

interface ExportPayload { filename: string; mimeType: string; encoding: 'utf8' | 'base64'; content: string; rowCount: number }
interface ImportPreview { table: string; sourceColumns: string[]; tableColumns: ColumnInfo[]; totalRows: number; sampleRows: Record<string, unknown>[]; suggestedMapping: Record<string, string> }
interface ImportReport { totalRows: number; inserted: number; updated: number; skipped: number; failed: number; errors: { row: number; message: string }[]; backupId: string | null }

function downloadPayload(p: ExportPayload) {
  const blob = p.encoding === 'base64'
    ? new Blob([Uint8Array.from(atob(p.content), (c) => c.charCodeAt(0))], { type: p.mimeType })
    : new Blob([p.content], { type: p.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = p.filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportExportPage() {
  const tables = useQuery<TableSummary[]>({ queryKey: ['db-admin', 'tables'], queryFn: () => api('/admin/database/tables'), refetchOnWindowFocus: false });
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Importar e Exportar</h2>
        <p className="text-sm text-muted-foreground">Exporte tabelas/consultas (CSV, Excel, JSON, SQL) e importe dados (CSV/JSON) com prévia e estratégias.</p>
      </div>
      <ExportCard tables={tables.data ?? []} />
      <ImportCard tables={tables.data ?? []} />
    </div>
  );
}

function ExportCard({ tables }: { tables: TableSummary[] }) {
  const [mode, setMode] = useState<'table' | 'query'>('table');
  const [table, setTable] = useState('');
  const [sql, setSql] = useState('SELECT * FROM "Indicator" LIMIT 100');
  const [format, setFormat] = useState<'csv' | 'json' | 'sql' | 'xlsx'>('csv');

  const exportMut = useMutation({
    mutationFn: () => api<ExportPayload>('/admin/database/export', { method: 'POST', json: mode === 'table' ? { table, format } : { sql, format } }),
    onSuccess: (p) => { downloadPayload(p); toast.success(`Exportado: ${p.rowCount} linha(s).`); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <SectionCard title="Exportar" description="Tabela completa ou resultado de uma consulta SELECT.">
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button variant={mode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setMode('table')}>Tabela</Button>
          <Button variant={mode === 'query' ? 'default' : 'outline'} size="sm" onClick={() => setMode('query')}>Consulta SELECT</Button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr,200px]">
          {mode === 'table' ? (
            <div>
              <Label>Tabela</Label>
              <NativeSelect value={table} onChange={(e) => setTable(e.target.value)}>
                <option value="">Selecione...</option>
                {tables.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
              </NativeSelect>
            </div>
          ) : (
            <div>
              <Label>SQL (somente SELECT)</Label>
              <Textarea rows={3} value={sql} onChange={(e) => setSql(e.target.value)} className="font-mono text-xs" />
            </div>
          )}
          <div>
            <Label>Formato</Label>
            <NativeSelect value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="json">JSON</option>
              <option value="sql">SQL (INSERTs)</option>
            </NativeSelect>
          </div>
        </div>
        <Button onClick={() => exportMut.mutate()} disabled={exportMut.isPending || (mode === 'table' && !table)}>
          <Download className="mr-2 h-4 w-4" /> {exportMut.isPending ? 'Exportando...' : 'Exportar'}
        </Button>
      </div>
    </SectionCard>
  );
}

function ImportCard({ tables }: { tables: TableSummary[] }) {
  const [table, setTable] = useState('');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [strategy, setStrategy] = useState<'insert' | 'ignoreDuplicates' | 'upsert' | 'replace' | 'onlyValid'>('insert');
  const [keyColumns, setKeyColumns] = useState<string[]>([]);
  const [report, setReport] = useState<ImportReport | null>(null);

  const previewMut = useMutation({
    mutationFn: () => api<ImportPreview>('/admin/database/import/preview', { method: 'POST', json: { table, format, content } }),
    onSuccess: (p) => { setPreview(p); setMapping(p.suggestedMapping); setReport(null); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const commitMut = useMutation({
    mutationFn: () => api<ImportReport>('/admin/database/import/commit', { method: 'POST', json: { table, format, content, mapping, strategy, keyColumns } }),
    onSuccess: (r) => { setReport(r); toast.success(`Importação concluída: +${r.inserted} inserido(s).`); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.endsWith('.json')) setFormat('json');
    else setFormat('csv');
    const reader = new FileReader();
    reader.onload = () => setContent(String(reader.result ?? ''));
    reader.readAsText(file);
  }

  return (
    <SectionCard title="Importar" description="CSV ou JSON. Pré-visualize, mapeie colunas, escolha a estratégia. Tudo roda em transação com snapshot.">
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <Label>Tabela destino</Label>
            <NativeSelect value={table} onChange={(e) => { setTable(e.target.value); setPreview(null); }}>
              <option value="">Selecione...</option>
              {tables.map((t) => <option key={t.name} value={t.name}>{t.name} {t.protected ? '🔒' : ''}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label>Formato</Label>
            <NativeSelect value={format} onChange={(e) => setFormat(e.target.value as 'csv' | 'json')}>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </NativeSelect>
          </div>
          <div>
            <Label>Arquivo</Label>
            <Input type="file" accept=".csv,.json,.txt" onChange={onFile} />
          </div>
        </div>
        <div>
          <Label>Conteúdo (ou cole aqui)</Label>
          <Textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} className="font-mono text-xs" placeholder="cole CSV/JSON..." />
        </div>
        <Button variant="outline" onClick={() => previewMut.mutate()} disabled={!table || !content || previewMut.isPending}>
          {previewMut.isPending ? 'Lendo...' : 'Pré-visualizar'}
        </Button>

        {preview && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="text-sm font-medium">{preview.totalRows} registro(s) · {preview.sourceColumns.length} coluna(s) na origem</div>
            <div>
              <Label>Mapeamento (origem → destino)</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {preview.sourceColumns.map((sc) => (
                  <div key={sc} className="flex items-center gap-2 text-xs">
                    <span className="w-32 truncate font-mono" title={sc}>{sc}</span>→
                    <NativeSelect value={mapping[sc] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [sc]: e.target.value }))} className="flex-1">
                      <option value="">(ignorar)</option>
                      {preview.tableColumns.map((tc) => <option key={tc.name} value={tc.name}>{tc.name}</option>)}
                    </NativeSelect>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label>Estratégia</Label>
                <NativeSelect value={strategy} onChange={(e) => setStrategy(e.target.value as typeof strategy)}>
                  <option value="insert">Inserir novos</option>
                  <option value="ignoreDuplicates">Ignorar duplicados</option>
                  <option value="upsert">Atualizar/Inserir (upsert)</option>
                  <option value="onlyValid">Somente válidos (relatar inválidos)</option>
                  <option value="replace">Substituir tudo (TRUNCATE + inserir)</option>
                </NativeSelect>
              </div>
              {strategy === 'upsert' && (
                <div>
                  <Label>Colunas-chave</Label>
                  <div className="flex flex-wrap gap-1">
                    {preview.tableColumns.map((tc) => {
                      const on = keyColumns.includes(tc.name);
                      return (
                        <button key={tc.name} type="button" onClick={() => setKeyColumns((k) => on ? k.filter((x) => x !== tc.name) : [...k, tc.name])} className={`rounded px-2 py-0.5 text-xs ${on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{tc.name}</button>
                      );
                    })}
                  </div>
                </div>
              )}
              <Button onClick={() => commitMut.mutate()} disabled={commitMut.isPending}>
                <Upload className="mr-2 h-4 w-4" /> {commitMut.isPending ? 'Importando...' : 'Importar'}
              </Button>
            </div>
          </div>
        )}

        {report && (
          <div className="rounded-lg border border-status-green/30 bg-status-green/10 p-3 text-sm">
            <div className="font-medium">Resultado: +{report.inserted} inserido(s) · {report.skipped} ignorado(s) · {report.failed} falha(s) de {report.totalRows}</div>
            {report.backupId && <div className="text-xs text-muted-foreground">Snapshot criado antes da operação.</div>}
            {report.errors.length > 0 && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer">Ver {report.errors.length} erro(s)</summary>
                <ul className="mt-1 list-inside list-disc">{report.errors.map((e, i) => <li key={i}>Linha {e.row}: {e.message}</li>)}</ul>
              </details>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
