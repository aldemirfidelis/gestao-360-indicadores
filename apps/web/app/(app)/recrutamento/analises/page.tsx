'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Briefcase, Clock, Timer, UserCheck, Users } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/select';
import { MetricCard } from '@/components/platform/metric-card';
import { EmptyState } from '@/components/platform/empty-state';
import { StageFunnelChart, SourceBreakdownChart, RejectionByStageChart } from '@/components/recruitment/analytics-charts';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

interface FunnelData {
  range: { from: string; to: string };
  overview: {
    totalApplications: number;
    totalHired: number;
    totalRejected: number;
    totalWithdrawn: number;
    activeApplications: number;
    openRequisitions: number;
    avgTimeToHireDays: number | null;
    avgTimeToFillDays: number | null;
  };
  funnel: Array<{ stageType: string; count: number }>;
  bySource: Array<{ source: string; count: number; hired: number }>;
  rejectionByStage: Array<{ stageName: string; count: number }>;
  aging: {
    staleCandidates: number;
    staleCandidatesThresholdDays: number;
    staleRequisitions: Array<{ id: string; code: string; daysOpen: number; slaDays: number; priority: string }>;
  };
}

const RANGE_PRESETS: Record<string, number> = { '30': 30, '90': 90, '180': 180, '365': 365 };

export default function RecruitmentAnalyticsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission(['recruit:view', 'recruit:manage']);
  const [rangeDays, setRangeDays] = useState('90');

  const { from, to } = useMemo(() => {
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - Number(rangeDays) * 86_400_000);
    return { from: fromDate.toISOString(), to: toDate.toISOString() };
  }, [rangeDays]);

  const query = useQuery<FunnelData>({
    queryKey: ['recruit-analytics-funnel', rangeDays],
    queryFn: () => api(`/recruitment/analytics/funnel?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    enabled: canView,
  });

  if (!canView) {
    return (
      <div className="space-y-4">
        <PageHeader title="Análises" description="Funil, tempo de contratação e origem das candidaturas." />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Você não tem permissão para ver as análises de recrutamento.</CardContent></Card>
      </div>
    );
  }

  const data = query.data;
  const o = data?.overview;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Análises"
        description="Funil de conversão, tempo de contratação, origem das candidaturas e vagas/candidatos parados."
        actions={
          <NativeSelect value={rangeDays} onChange={(e) => setRangeDays(e.target.value)} className="h-9 w-44">
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="180">Últimos 180 dias</option>
            <option value="365">Últimos 12 meses</option>
          </NativeSelect>
        }
      />

      {query.isLoading ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Carregando...</CardContent></Card>
      ) : !o ? (
        <EmptyState title="Não foi possível carregar os dados" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard title="Candidaturas" value={o.totalApplications} icon={<Users className="h-4 w-4" />} tone="blue" description="No período" compact />
            <MetricCard title="Contratações" value={o.totalHired} icon={<UserCheck className="h-4 w-4" />} tone="green" description="No período" compact />
            <MetricCard title="Ativas agora" value={o.activeApplications} icon={<Briefcase className="h-4 w-4" />} tone="neutral" description="Em processo" compact />
            <MetricCard title="Requisições abertas" value={o.openRequisitions} icon={<Briefcase className="h-4 w-4" />} tone="yellow" description="Em aprovação/recrutamento" compact />
            <MetricCard
              title="Tempo médio de contratação"
              value={o.avgTimeToHireDays != null ? `${o.avgTimeToHireDays}d` : '—'}
              icon={<Clock className="h-4 w-4" />}
              tone="purple"
              description="Candidatura → admissão"
              compact
            />
            <MetricCard
              title="Tempo médio de preenchimento"
              value={o.avgTimeToFillDays != null ? `${o.avgTimeToFillDays}d` : '—'}
              icon={<Timer className="h-4 w-4" />}
              tone="purple"
              description="Requisição → vaga preenchida"
              compact
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <div className="mb-2 text-sm font-semibold">Funil por etapa (candidaturas ativas)</div>
                <StageFunnelChart data={data.funnel} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="mb-2 text-sm font-semibold">Origem das candidaturas</div>
                <SourceBreakdownChart data={data.bySource} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="mb-2 text-sm font-semibold">Rejeições por etapa</div>
                <RejectionByStageChart data={data.rejectionByStage} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold">Vagas paradas (acima do SLA)</div>
                  {data.aging.staleCandidates > 0 && (
                    <Badge variant="outline" className="gap-1 text-[10px] text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" /> {data.aging.staleCandidates} candidato(s) sem movimentação há +{data.aging.staleCandidatesThresholdDays}d
                    </Badge>
                  )}
                </div>
                {data.aging.staleRequisitions.length === 0 ? (
                  <EmptyState title="Nenhuma requisição fora do SLA" description="Todas as requisições abertas estão dentro do prazo esperado." />
                ) : (
                  <div className="space-y-2">
                    {data.aging.staleRequisitions.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs dark:border-amber-900/40 dark:bg-amber-950/20">
                        <span className="flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /> {r.code}
                        </span>
                        <span className="text-muted-foreground">{r.daysOpen}d aberta (SLA {r.slaDays}d)</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
