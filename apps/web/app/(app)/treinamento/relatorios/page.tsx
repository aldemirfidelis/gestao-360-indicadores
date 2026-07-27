'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, FileSpreadsheet } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/components/auth/auth-provider';
import { api, getAccessToken } from '@/lib/api';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/training/training-bits';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';

interface ReportMeta {
  kind: string;
  label: string;
  description: string;
}

export default function RelatoriosPage() {
  const { hasPermission } = useAuth();
  const canExport = hasPermission(['training:export', 'training:manage']);
  const [selected, setSelected] = useState<string | null>(null);

  const catalog = useQuery<ReportMeta[]>({
    queryKey: ['training-reports'],
    queryFn: () => api('/training/reports'),
  });

  // Prévia com os mesmos dados da exportação — o que se vê é o que sai.
  const preview = useQuery<{ fileName: string; rows: Array<Record<string, unknown>> }>({
    queryKey: ['training-report-preview', selected],
    queryFn: () => api(`/training/reports/${selected}`),
    enabled: Boolean(selected),
  });

  async function download(kind: string) {
    try {
      const response = await fetch(`${API_URL}/training/reports/${kind}/export.csv`, {
        headers: { authorization: `Bearer ${getAccessToken() ?? ''}` },
      });
      if (!response.ok) throw new Error('Não foi possível exportar o relatório.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `treinamento-${kind}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error?.message ?? 'Falha ao exportar.');
    }
  }

  const rows = preview.data?.rows ?? [];
  const headers = rows.length > 0 ? Object.keys(rows[0]!) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Treinamento e Desenvolvimento"
        tone="view"
        title="Relatórios"
        description="Consultas sobre os mesmos dados das telas, com exportação para Excel. Respeitam suas permissões e áreas."
        breadcrumbs={[{ label: 'Treinamento', href: '/treinamento' }, { label: 'Relatórios' }]}
      />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-2">
          {catalog.isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            (catalog.data ?? []).map((report) => (
              <button
                key={report.kind}
                type="button"
                onClick={() => setSelected(report.kind)}
                className={cn(
                  'w-full rounded-lg border p-3 text-left transition-colors',
                  selected === report.kind ? 'border-primary bg-primary/5' : 'hover:bg-muted/40',
                )}
              >
                <p className="text-sm font-medium">{report.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{report.description}</p>
              </button>
            ))
          )}
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            {!selected ? (
              <EmptyState title="Selecione um relatório." description="A prévia mostra exatamente o que será exportado." />
            ) : preview.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">{rows.length} registro(s)</p>
                  {canExport && rows.length > 0 && (
                    <Button size="sm" variant="outline" onClick={() => void download(selected)}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Exportar CSV
                    </Button>
                  )}
                </div>

                {rows.length === 0 ? (
                  <EmptyState title="Nenhum registro encontrado para os filtros selecionados." />
                ) : (
                  <div className="max-h-[520px] overflow-auto rounded-md border">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 border-b bg-muted/60 uppercase tracking-wide text-muted-foreground">
                        <tr>
                          {headers.map((header) => (
                            <th key={header} className="whitespace-nowrap px-3 py-2 text-left font-medium">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {rows.slice(0, 200).map((row, index) => (
                          <tr key={index}>
                            {headers.map((header) => (
                              <td key={header} className="whitespace-nowrap px-3 py-1.5">
                                {String(row[header] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {rows.length > 200 && (
                  <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Prévia limitada a 200 linhas. A exportação traz todos os {rows.length} registros.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
