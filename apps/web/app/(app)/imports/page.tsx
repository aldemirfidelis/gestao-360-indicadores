'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { Upload, Download, FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

type Target = 'INDICATORS' | 'TARGETS' | 'RESULTS';

interface PreviewRow {
  rowIndex: number;
  status: 'OK' | 'ERROR' | 'SKIPPED';
  message?: string;
  data: Record<string, unknown>;
}

interface Preview {
  totalRows: number;
  okRows: number;
  errorRows: number;
  rows: PreviewRow[];
}

interface Job {
  id: string;
  target: string;
  fileName: string;
  totalRows: number;
  okRows: number;
  errorRows: number;
  startedAt: string;
  finishedAt: string | null;
  _count: { errors: number };
}

const TARGET_HEADERS: Record<Target, string[]> = {
  INDICATORS: ['code', 'name', 'type', 'unit', 'periodicity', 'direction', 'ownerCode', 'description'],
  TARGETS: ['code', 'periodRef', 'target', 'lowerBound', 'upperBound'],
  RESULTS: ['code', 'periodRef', 'value', 'note'],
};

const TARGET_LABEL: Record<Target, string> = {
  INDICATORS: 'Indicadores',
  TARGETS: 'Metas',
  RESULTS: 'Realizados',
};

export default function ImportsPage() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<Target>('RESULTS');
  const [fileName, setFileName] = useState<string>('');
  const [rows, setRows] = useState<Array<{ rowIndex: number; data: Record<string, unknown> }>>([]);
  const [preview, setPreview] = useState<Preview | null>(null);

  const jobs = useQuery<Job[]>({
    queryKey: ['imports', 'jobs'],
    queryFn: () => api<Job[]>('/imports/jobs'),
  });

  const previewMutation = useMutation({
    mutationFn: () => api<Preview>('/imports/preview', { method: 'POST', json: { target, rows } }),
    onSuccess: (out) => {
      setPreview(out);
      toast.success(`Preview: ${out.okRows} ok, ${out.errorRows} com erro`);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha no preview'),
  });

  const commit = useMutation({
    mutationFn: () => api<{ jobId: string; totalRows: number; okRows: number; errorRows: number }>('/imports/commit', {
      method: 'POST',
      json: { target, fileName, rows },
    }),
    onSuccess: (out) => {
      toast.success(`Importacao concluida: ${out.okRows}/${out.totalRows} linhas`);
      qc.invalidateQueries({ queryKey: ['imports', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['indicators'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      reset();
    },
  });

  const reset = () => {
    setRows([]);
    setPreview(null);
    setFileName('');
    if (fileInput.current) fileInput.current.value = '';
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    setPreview(null);
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const parsed = (res.data ?? []).map((data, i) => ({ rowIndex: i + 2, data }));
        setRows(parsed);
        toast.success(`${parsed.length} linha(s) carregada(s) do CSV`);
      },
      error: (err) => toast.error(`Falha ao ler CSV: ${err.message}`),
    });
  };

  const downloadTemplate = () => {
    const headers = TARGET_HEADERS[target];
    const example = exampleRow(target);
    const csv = Papa.unparse([example], { columns: headers });
    const blob = new Blob(['﻿' + headers.join(',') + '\n' + Object.values(example).join(',')], {
      type: 'text/csv;charset=utf-8',
    });
    void csv; // mantido para clareza
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `modelo-${target.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Importacao de dados"
        description="CSV de indicadores, metas e realizados com preview antes de gravar."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Novo arquivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[200px,1fr,auto,auto] gap-3">
            <div>
              <Label>Tipo</Label>
              <NativeSelect value={target} onChange={(e) => setTarget(e.target.value as Target)}>
                {Object.entries(TARGET_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Arquivo CSV</Label>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm file:mr-3 file:border-0 file:bg-secondary file:px-3 file:py-1 file:rounded file:text-secondary-foreground"
              />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" /> Modelo
              </Button>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => previewMutation.mutate()} disabled={rows.length === 0 || previewMutation.isPending}>
                {previewMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                Preview
              </Button>
              <Button
                onClick={() => commit.mutate()}
                disabled={!preview || preview.errorRows === preview.totalRows || commit.isPending}
              >
                <Upload className="h-4 w-4 mr-2" />
                {commit.isPending ? 'Importando...' : 'Importar'}
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Colunas esperadas:{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded">{TARGET_HEADERS[target].join(', ')}</code>
          </div>

          {fileName && (
            <div className="text-sm">
              <Badge variant="outline">{fileName}</Badge> {rows.length} linha(s) carregada(s).
            </div>
          )}

          {preview && (
            <div className="rounded-lg border overflow-hidden">
              <div className="flex items-center justify-between bg-muted/50 px-3 py-2 text-xs">
                <div className="flex gap-3">
                  <span><strong>{preview.totalRows}</strong> total</span>
                  <span className="text-status-green flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> <strong>{preview.okRows}</strong> ok
                  </span>
                  <span className="text-status-red flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> <strong>{preview.errorRows}</strong> com erro
                  </span>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 text-left w-12">#</th>
                      <th className="px-3 py-1.5 text-left w-24">Status</th>
                      <th className="px-3 py-1.5 text-left">Mensagem / Dados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.rowIndex} className={cn('border-t', r.status === 'ERROR' && 'bg-status-red/5')}>
                        <td className="px-3 py-1.5">{r.rowIndex}</td>
                        <td className="px-3 py-1.5">
                          {r.status === 'OK' ? (
                            <span className="pill pill-green">ok</span>
                          ) : (
                            <span className="pill pill-red">erro</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11px]">
                          {r.message ? <span className="text-status-red">{r.message}</span> : null}
                          <div className="text-muted-foreground">
                            {Object.entries(r.data).map(([k, v]) => `${k}=${v}`).join('  ')}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historico de importacoes</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Arquivo</th>
                <th className="px-4 py-2">Iniciado</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">OK</th>
                <th className="px-4 py-2">Erros</th>
              </tr>
            </thead>
            <tbody>
              {jobs.data?.map((j) => (
                <tr key={j.id} className="border-t">
                  <td className="px-4 py-2"><Badge variant="outline">{j.target}</Badge></td>
                  <td className="px-4 py-2 font-mono text-xs">{j.fileName}</td>
                  <td className="px-4 py-2 text-xs">{formatDate(j.startedAt)}</td>
                  <td className="px-4 py-2">{j.totalRows}</td>
                  <td className="px-4 py-2 text-status-green">{j.okRows}</td>
                  <td className="px-4 py-2 text-status-red">{j.errorRows}</td>
                </tr>
              ))}
              {(jobs.data?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Nenhuma importacao registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function exampleRow(target: Target): Record<string, string> {
  switch (target) {
    case 'INDICATORS':
      return {
        code: 'EX-001',
        name: 'Exemplo de indicador',
        type: 'OPERATIONAL',
        unit: 'PERCENT',
        periodicity: 'MONTHLY',
        direction: 'HIGHER_BETTER',
        ownerCode: 'RH',
        description: 'Descricao do indicador',
      };
    case 'TARGETS':
      return { code: 'EX-001', periodRef: '2026-06', target: '95', lowerBound: '', upperBound: '' };
    case 'RESULTS':
    default:
      return { code: 'EX-001', periodRef: '2026-06', value: '92.5', note: 'Coleta manual' };
  }
}
