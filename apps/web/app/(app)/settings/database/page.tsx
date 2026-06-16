'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Database,
  GitBranch,
  HardDrive,
  KeyRound,
  RefreshCcw,
  ShieldCheck,
  Stethoscope,
  Table2,
} from 'lucide-react';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import type { DbOverview } from '@/components/database-admin/types';

export default function DatabaseOverviewPage() {
  const overview = useQuery<DbOverview>({
    queryKey: ['db-admin', 'overview'],
    queryFn: () => api<DbOverview>('/admin/database/overview'),
    refetchOnWindowFocus: false,
  });

  const data = overview.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Visão Geral</h2>
          <p className="text-sm text-muted-foreground">Painel técnico do banco de dados em uso.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => overview.refetch()} disabled={overview.isFetching}>
            <RefreshCcw className={cn('mr-2 h-4 w-4', overview.isFetching && 'animate-spin')} />
            Atualizar informações
          </Button>
          <Button asChild variant="outline">
            <Link href="/settings/database/diagnostics">
              <Stethoscope className="mr-2 h-4 w-4" />
              Executar diagnóstico
            </Link>
          </Button>
          <Button asChild>
            <Link href="/settings/database/backups">
              <HardDrive className="mr-2 h-4 w-4" />
              Backups
            </Link>
          </Button>
        </div>
      </div>

      {overview.isLoading && <LoadingState label="Lendo metadados do banco..." />}

      {overview.isError && (
        <SectionCard title="Falha ao carregar" description="Não foi possível ler os metadados do banco.">
          <div className="rounded-lg border border-status-red/30 bg-status-red/10 p-4 text-sm">
            {(overview.error as Error)?.message}
          </div>
        </SectionCard>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Banco"
              value={data.database.name}
              description={`${data.database.engine} ${data.database.version}`}
              icon={<Database className="h-4 w-4" />}
              tone="blue"
            />
            <MetricCard
              title="Conexão"
              value={data.connection.ok ? 'Conectado' : 'Sem conexão'}
              description={data.connection.ok ? `${data.connection.latencyMs} ms` : 'Sem resposta'}
              icon={<Activity className="h-4 w-4" />}
              tone={data.connection.ok ? 'green' : 'red'}
            />
            <MetricCard
              title="Tamanho estimado"
              value={data.database.sizePretty}
              description={`${formatNumber(data.counts.totalEstimatedRows)} registros estimados`}
              icon={<HardDrive className="h-4 w-4" />}
              tone="purple"
            />
            <MetricCard
              title="Integridade"
              value={data.integrity.status}
              description={`${data.integrity.recentErrors} erro(s) em 7 dias`}
              icon={<ShieldCheck className="h-4 w-4" />}
              tone={data.integrity.status === 'OK' ? 'green' : 'yellow'}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
            <CountTile icon={<Table2 className="h-4 w-4" />} label="Tabelas" value={data.counts.tables} />
            <CountTile icon={<KeyRound className="h-4 w-4" />} label="Índices" value={data.counts.indexes} />
            <CountTile icon={<GitBranch className="h-4 w-4" />} label="Relacionamentos" value={data.counts.relationships} />
            <CountTile icon={<Database className="h-4 w-4" />} label="Views" value={data.counts.views} />
            <CountTile icon={<Activity className="h-4 w-4" />} label="Migrations" value={data.counts.migrations} />
          </div>

          {data.alerts.length > 0 && (
            <SectionCard title="Alertas" description="Pontos de atenção detectados automaticamente." contentClassName="space-y-2">
              {data.alerts.map((alert, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-2 rounded-lg border p-3 text-sm',
                    alert.level === 'critical' && 'border-status-red/30 bg-status-red/10',
                    alert.level === 'warning' && 'border-status-yellow/30 bg-status-yellow/10',
                    alert.level === 'info' && 'border-border bg-muted/30',
                  )}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{alert.message}</span>
                </div>
              ))}
            </SectionCard>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SectionCard title="Tabelas com maior volume" description="Top tabelas por tamanho em disco." contentClassName="p-0">
              <div className="overflow-x-auto">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th className="text-left">Tabela</th>
                      <th className="text-left">Registros (est.)</th>
                      <th className="text-left">Tamanho</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.biggestTables.map((t) => (
                      <tr key={t.name}>
                        <td>
                          <Link href={`/settings/database/tables/${encodeURIComponent(t.name)}`} className="font-medium text-primary hover:underline">
                            {t.name}
                          </Link>
                        </td>
                        <td>{formatNumber(t.estimatedRows)}</td>
                        <td>{t.sizePretty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="Últimas alterações" description="Operações administrativas recentes." contentClassName="p-0">
              <div className="overflow-x-auto">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th className="text-left">Quando</th>
                      <th className="text-left">Ação</th>
                      <th className="text-left">Tabela</th>
                      <th className="text-left">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentChanges.length === 0 ? (
                      <tr><td colSpan={4} className="text-center text-sm text-muted-foreground">Nenhuma alteração registrada.</td></tr>
                    ) : (
                      data.recentChanges.map((c) => (
                        <tr key={c.id}>
                          <td className="text-xs">{formatDate(c.createdAt)}</td>
                          <td><span className="font-mono text-xs">{c.action}</span></td>
                          <td>{c.targetTable ?? '-'}</td>
                          <td>
                            <span className={cn('pill', c.result === 'SUCCESS' ? 'pill-green' : c.result === 'DENIED' ? 'pill-yellow' : 'pill-red')}>
                              {c.result}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          <p className="text-xs text-muted-foreground">
            Backup/restore de banco inteiro: este projeto usa PostgreSQL gerenciado (Neon). Para recuperação completa use o
            ramificações e recuperação em ponto no tempo da Neon. Retratos lógicos por operação ficam em Backup e Restauração.
          </p>
        </>
      )}
    </div>
  );
}

function CountTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="panel flex items-center gap-3 p-4">
      <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-primary">{icon}</div>
      <div>
        <div className="text-xl font-semibold leading-tight">{formatNumber(value)}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
