'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Info, RefreshCcw, ShieldAlert } from 'lucide-react';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import type { DiagnosticsReport, DiagnosticFinding } from '@/components/database-admin/types';

const LEVEL_ICON = {
  critical: <ShieldAlert className="h-4 w-4 text-status-red" />,
  warning: <AlertTriangle className="h-4 w-4 text-status-yellow" />,
  info: <Info className="h-4 w-4 text-status-blue" />,
};

export default function DiagnosticsPage() {
  const report = useQuery<DiagnosticsReport>({
    queryKey: ['db-admin', 'diagnostics'],
    queryFn: () => api<DiagnosticsReport>('/admin/database/diagnostics'),
    refetchOnWindowFocus: false,
  });
  const data = report.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Integridade e Diagnóstico</h2>
          <p className="text-sm text-muted-foreground">Verificações read-only. Nenhuma correção é aplicada automaticamente.</p>
        </div>
        <Button onClick={() => report.refetch()} disabled={report.isFetching}>
          <RefreshCcw className={cn('mr-2 h-4 w-4', report.isFetching && 'animate-spin')} />
          Executar diagnóstico
        </Button>
      </div>

      {report.isLoading && <LoadingState label="Analisando o banco..." />}
      {report.isError && (
        <SectionCard title="Falha" description="Não foi possível executar o diagnóstico.">
          <div className="rounded-lg border border-status-red/30 bg-status-red/10 p-4 text-sm">{(report.error as Error)?.message}</div>
        </SectionCard>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Conexão" value={data.connection.ok ? 'OK' : 'Falha'} description={`${data.connection.latencyMs} ms`} icon={<CheckCircle2 className="h-4 w-4" />} tone={data.connection.ok ? 'green' : 'red'} />
            <MetricCard title="Críticos" value={data.summary.critical} description="Requerem atenção" icon={<ShieldAlert className="h-4 w-4" />} tone={data.summary.critical > 0 ? 'red' : 'green'} />
            <MetricCard title="Avisos" value={data.summary.warning} description="Recomendações" icon={<AlertTriangle className="h-4 w-4" />} tone={data.summary.warning > 0 ? 'yellow' : 'green'} />
            <MetricCard title="Schema" value={`${data.schemaVersion.migrations} migrations`} description={data.schemaVersion.lastMigration ?? '-'} icon={<Info className="h-4 w-4" />} tone="blue" />
          </div>

          <SectionCard
            title="Achados"
            description={`${data.findings.length} item(ns). Gerado em ${formatDate(data.generatedAt)}.`}
            contentClassName={data.findings.length === 0 ? '' : 'p-0'}
          >
            {data.findings.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-status-green/30 bg-status-green/10 p-4 text-sm">
                <CheckCircle2 className="h-4 w-4 text-status-green" />
                Nenhum problema detectado.
              </div>
            ) : (
              <div className="divide-y">
                {data.findings.map((f: DiagnosticFinding) => (
                  <div key={f.id} className="flex items-start gap-3 p-4">
                    <div className="mt-0.5">{LEVEL_ICON[f.level]}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{f.title}</span>
                        <Badge variant="outline">{f.category}</Badge>
                        {f.table && <span className="font-mono text-xs text-muted-foreground">{f.table}</span>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>
                      {f.suggestion && <p className="mt-1 text-xs text-muted-foreground">💡 {f.suggestion}</p>}
                      {f.recommendedAction && <p className="mt-1 text-xs font-medium text-foreground">Ação recomendada: {f.recommendedAction}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
          <p className="text-xs text-muted-foreground">As correções devem ser feitas manualmente após análise, nas telas correspondentes (Estrutura, Índices, Editor de Registros).</p>
        </>
      )}
    </div>
  );
}
