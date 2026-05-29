'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Sparkles, AlertCircle, TrendingDown, Lightbulb, FileText } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';


interface Insight {
  id: string;
  kind: 'EXECUTIVE_SUMMARY' | 'WORSENING_TREND' | 'CAUSE_SUGGESTION' | 'ACTION_SUGGESTION' | 'RISK_FLAG';
  title: string;
  body: string;
  refs?: { type: string; id: string; label: string }[];
  severity?: 'info' | 'warning' | 'critical';
  source?: 'ai' | 'rules';
}

interface AiStatus {
  provider: string;
  enabled: boolean;
}

const KIND_META: Record<Insight['kind'], { label: string; icon: any; color: string }> = {
  EXECUTIVE_SUMMARY: { label: 'Resumo executivo', icon: FileText, color: 'bg-status-blue/15 text-status-blue' },
  WORSENING_TREND: { label: 'Tendência de piora', icon: TrendingDown, color: 'bg-status-yellow/15 text-status-yellow' },
  CAUSE_SUGGESTION: { label: 'Sugestão de causa', icon: AlertCircle, color: 'bg-status-purple/15 text-status-purple' },
  ACTION_SUGGESTION: { label: 'Sugestão de ação', icon: Lightbulb, color: 'bg-status-green/15 text-status-green' },
  RISK_FLAG: { label: 'Risco', icon: AlertCircle, color: 'bg-status-red/15 text-status-red' },
};

const SEVERITY_BORDER: Record<NonNullable<Insight['severity']>, string> = {
  info: 'border-status-blue/30',
  warning: 'border-status-yellow/40',
  critical: 'border-status-red/50',
};

export default function InsightsPage() {
  const aiStatus = useQuery<AiStatus>({
    queryKey: ['ai', 'status'],
    queryFn: () => api<AiStatus>('/ai/status'),
    staleTime: 60_000,
  });
  const query = useQuery<Insight[]>({
    queryKey: ['insights'],
    queryFn: () => api<Insight[]>('/insights'),
  });

  const aiEnabled = aiStatus.data?.enabled ?? false;

  return (
    <div>
      <PageHeader
        title="Insights"
        description="Resumo executivo, tendências e sugestões geradas a partir do estado atual dos indicadores."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {query.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {query.data?.map((i) => {
          const meta = KIND_META[i.kind];
          const Icon = meta.icon;
          return (
            <Card
              key={i.id}
              className={cn('border-2', i.severity ? SEVERITY_BORDER[i.severity] : 'border-border')}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn('grid h-10 w-10 place-items-center rounded-lg shrink-0', meta.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {meta.label}
                      </Badge>
                      {i.source === 'ai' && (
                        <Badge className="text-[10px] border-primary/30 bg-primary/10 text-primary">
                          <Sparkles className="mr-1 h-2.5 w-2.5" /> IA
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-base leading-tight">{i.title}</h3>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{i.body}</p>
                {i.refs && i.refs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {i.refs.map((r) => {
                      const href =
                        r.type === 'indicator'
                          ? `/indicators/${r.id}`
                          : r.type === 'deviation'
                            ? `/deviations/${r.id}`
                            : '#';
                      return (
                        <Link
                          key={`${r.type}-${r.id}`}
                          href={href}
                          className="text-xs px-2 py-1 rounded-md border hover:bg-accent"
                        >
                          {r.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!query.isLoading && (query.data?.length ?? 0) === 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhum insight relevante neste momento.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
