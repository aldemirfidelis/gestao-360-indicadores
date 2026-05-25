'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatDate, periodRefLabel } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Deviation {
  id: string;
  number: number;
  title: string;
  periodRef: string;
  severity: 'LOW' | 'MODERATE' | 'CRITICAL';
  status: string;
  openedAt: string;
  dueDate: string | null;
  indicator: { id: string; name: string; code: string | null };
  responsibleUser: { id: string; name: string } | null;
  _count: { causes: number; actions: number; analyses: number };
}

const SEVERITY: Record<string, { label: string; className: string }> = {
  LOW: { label: 'Leve', className: 'bg-status-blue/15 text-status-blue' },
  MODERATE: { label: 'Moderado', className: 'bg-status-yellow/15 text-status-yellow' },
  CRITICAL: { label: 'Crítico', className: 'bg-status-red/15 text-status-red' },
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Aberto',
  IN_ANALYSIS: 'Em análise',
  WAITING_ACTION: 'Aguardando ação',
  IN_PROGRESS: 'Em execucao',
  CLOSED: 'Concluido',
  CLOSED_LATE: 'Concluido fora do prazo',
  CANCELLED: 'Cancelado',
};

export default function DeviationsPage() {
  const query = useQuery<Deviation[]>({
    queryKey: ['deviations'],
    queryFn: () => api<Deviation[]>('/deviations'),
  });

  return (
    <div>
      <PageHeader
        title="Desvios / FCA"
        description="Análises de causa para indicadores fora da meta, com vínculo direto aos planos de ação."
      />

      <div className="grid gap-3">
        {query.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {query.data?.map((d) => {
          const sev = SEVERITY[d.severity];
          return (
            <Card key={d.id} className="hover:border-primary/40 transition-colors">
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={cn('grid h-10 w-10 place-items-center rounded-md', sev.className)}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">#{d.number}</Badge>
                      <span className={cn('pill', sev.className.replace('bg-', 'pill-').replace('/15 text-', ' text-'))}>
                        {sev.label}
                      </span>
                      <Badge variant="secondary">{STATUS_LABEL[d.status] ?? d.status}</Badge>
                    </div>
                    <Link href={`/indicators/${d.indicator.id}`} className="font-medium hover:underline">
                      {d.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      Indicador: {d.indicator.name} - Período: {periodRefLabel(d.periodRef)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-6 text-right text-xs">
                  <div>
                    <div className="text-muted-foreground">Aberto</div>
                    <div className="font-medium">{formatDate(d.openedAt)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Prazo</div>
                    <div className="font-medium">{formatDate(d.dueDate)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Causas / Ações</div>
                    <div className="font-medium">
                      {d._count.causes} / {d._count.actions}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!query.isLoading && (query.data?.length ?? 0) === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhum desvio aberto. Ótimo trabalho.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
