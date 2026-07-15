'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Gauge, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Kpis { totalCostCents: number; netCents: number; avgCostCents: number; workers: number; chargesCents: number; chargesPct: number }
interface SeriesPoint { periodRef: string; earningsCents: number; netCents: number; workers: number; kpis: Kpis }
interface Dashboard { latest: SeriesPoint | null; series: SeriesPoint[] }
interface Anomaly { severity: string; code: string; name: string; message: string; currentCents?: number; previousCents?: number }
interface AnomalyResult { previousPeriodRef: string | null; count: number; high: number; anomalies: Anomaly[] }
interface Competence { id: string; year: number; month: number; runs: Array<{ id: string; kind: string; status: string }> }

const money = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const SEV_TONE: Record<string, string> = { HIGH: 'text-rose-600 dark:text-rose-400', MEDIUM: 'text-amber-600 dark:text-amber-400', INFO: 'text-sky-600 dark:text-sky-400' };

export default function PayrollDashboardPage() {
  const [runId, setRunId] = useState('');
  const dashboardQuery = useQuery<Dashboard>({ queryKey: ['payroll-dashboard'], queryFn: () => api('/payroll/dashboard') });
  const competencesQuery = useQuery<Competence[]>({ queryKey: ['payroll-competences'], queryFn: () => api('/payroll/competences') });
  const runs = useMemo(() => (competencesQuery.data ?? []).flatMap((c) => c.runs.filter((r) => r.kind === 'MENSAL').map((r) => ({ ...r, label: `${c.year}-${String(c.month).padStart(2, '0')} · ${r.status}` }))), [competencesQuery.data]);
  const effectiveRun = runId || runs.find((r) => r.status === 'CLOSED')?.id || runs[0]?.id || '';
  const anomaliesQuery = useQuery<AnomalyResult>({ queryKey: ['payroll-anomalies', effectiveRun], queryFn: () => api(`/payroll/runs/${effectiveRun}/anomalies`), enabled: Boolean(effectiveRun) });

  const dash = dashboardQuery.data;
  const latest = dash?.latest;
  const maxCost = Math.max(1, ...(dash?.series ?? []).map((s) => s.kpis.totalCostCents));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/servico-pessoal/folha" className="flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Voltar para Folha</Link>
      </div>
      <PageHeader title="Gestão à Vista da Folha" description="Custo de pessoal, encargos, evolução e detecção de anomalias entre competências." />

      {!latest ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma folha mensal fechada ainda.</CardContent></Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: 'Custo total de pessoal', value: money(latest.kpis.totalCostCents), icon: Gauge, tone: '' },
              { label: 'Custo médio', value: money(latest.kpis.avgCostCents), icon: Users, tone: '' },
              { label: 'Líquido pago', value: money(latest.kpis.netCents), icon: TrendingUp, tone: '' },
              { label: 'Encargos (FGTS)', value: `${money(latest.kpis.chargesCents)} · ${latest.kpis.chargesPct}%`, icon: Gauge, tone: 'text-amber-600 dark:text-amber-400' },
              { label: 'Colaboradores', value: String(latest.kpis.workers), icon: Users, tone: '' },
            ].map((k) => (
              <Card key={k.label}><CardContent className="p-3">
                <div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.label}</span><k.icon className="h-4 w-4 text-muted-foreground" /></div>
                <div className={cn('mt-1 text-lg font-bold', k.tone)}>{k.value}</div>
              </CardContent></Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Evolução do custo (12 competências)</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {(dash?.series ?? []).map((s) => (
                <div key={s.periodRef} className="flex items-center gap-2 text-xs">
                  <span className="w-16 shrink-0 text-muted-foreground">{s.periodRef}</span>
                  <div className="h-4 flex-1 rounded bg-muted/40">
                    <div className="h-4 rounded bg-sky-500/70" style={{ width: `${Math.max(2, (s.kpis.totalCostCents / maxCost) * 100)}%` }} />
                  </div>
                  <span className="w-28 shrink-0 text-right font-medium">{money(s.kpis.totalCostCents)}</span>
                  <span className="w-14 shrink-0 text-right text-muted-foreground">{s.workers} col.</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-amber-500" /> Anomalias vs mês anterior</CardTitle>
          <NativeSelect className="h-8 w-56 text-xs" value={effectiveRun} onChange={(e) => setRunId(e.target.value)}>
            {runs.length === 0 && <option value="">Nenhum processamento</option>}
            {runs.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </NativeSelect>
        </CardHeader>
        <CardContent className="text-xs">
          {!anomaliesQuery.data ? (
            <div className="py-4 text-muted-foreground">Selecione um processamento.</div>
          ) : anomaliesQuery.data.count === 0 ? (
            <div className="py-4 text-emerald-600 dark:text-emerald-400">Sem anomalias vs {anomaliesQuery.data.previousPeriodRef ?? 'mês anterior'}.</div>
          ) : (
            <div className="space-y-1">
              <div className="mb-2 text-muted-foreground">{anomaliesQuery.data.count} anomalia(s) · {anomaliesQuery.data.high} alta(s) · comparado a {anomaliesQuery.data.previousPeriodRef ?? '—'}</div>
              {anomaliesQuery.data.anomalies.slice(0, 100).map((a, i) => (
                <div key={i} className="flex items-center justify-between border-b py-1 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn('text-[9px]', SEV_TONE[a.severity])}>{a.severity}</Badge>
                    <span className="font-medium">{a.name}</span>
                    <span className="text-muted-foreground">{a.message}</span>
                  </div>
                  {(a.currentCents != null || a.previousCents != null) && (
                    <span className="text-muted-foreground">{a.previousCents != null ? money(a.previousCents) : '—'} → {a.currentCents != null ? money(a.currentCents) : '—'}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
