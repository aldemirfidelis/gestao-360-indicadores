'use client';

/**
 * Card de acompanhamento das AÇÕES DE SAÍDA da reunião — o que o fórum decidiu
 * em reuniões anteriores (e nesta) e que precisa prestar contas hoje.
 *
 * Complementa o "Planos de ação da área": lá está o que a área já vinha
 * tocando; aqui, o que a própria reunião determinou.
 */

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';

type OutcomeState = 'NAO_INICIADA' | 'EM_ANDAMENTO' | 'ENCERRADA' | 'CANCELADA';
type OutcomeSource = 'DA_AREA' | 'SAIDA_REUNIAO';

interface OutcomeItem {
  id: string;
  title: string;
  state: OutcomeState;
  source: OutcomeSource;
  sourceDetail: string | null;
  progress: number;
  dueDate: string | null;
  overdue: boolean;
  responsible: { id: string; name: string } | null;
  area: string | null;
  sector: string | null;
  indicator: { id: string; name: string; code: string | null } | null;
  fromMeeting: string | null;
  taskCount: number;
  taskDone: number;
}

interface OutcomeResponse {
  items: OutcomeItem[];
  summary: { total: number; closed: number; inProgress: number; notStarted: number; overdue: number; avgProgress: number };
  bySource?: Record<OutcomeSource, { total: number; closed: number; overdue: number }>;
}

const STATE_LABEL: Record<OutcomeState, string> = {
  NAO_INICIADA: 'Não iniciada',
  EM_ANDAMENTO: 'Em andamento',
  ENCERRADA: 'Encerrada',
  CANCELADA: 'Cancelada',
};

const STATE_CLASS: Record<OutcomeState, string> = {
  NAO_INICIADA: 'border-slate-200 bg-slate-50 text-slate-700',
  EM_ANDAMENTO: 'border-blue-200 bg-blue-50 text-blue-700',
  ENCERRADA: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELADA: 'border-slate-200 bg-slate-100 text-slate-500',
};

export function MeetingOutcomeActionsCard({
  meetingId,
  areaName,
  onOpenAction,
}: {
  meetingId: string;
  /** Quando informado, mostra só as ações daquela área (a que está sendo apresentada). */
  areaName?: string | null;
  onOpenAction?: (actionId: string) => void;
}) {
  const query = useQuery<OutcomeResponse>({
    queryKey: ['monthly-results', 'outcome-follow-up', meetingId],
    queryFn: () => api<OutcomeResponse>(`/monthly-results/meetings/${meetingId}/outcome-follow-up`),
  });

  const all = query.data?.items ?? [];
  const outcomes = all.filter((item) => item.source === 'SAIDA_REUNIAO');
  const items = areaName ? outcomes.filter((item) => item.area === areaName) : outcomes;
  const open = items.filter((item) => item.state !== 'ENCERRADA' && item.state !== 'CANCELADA');
  const closed = items.filter((item) => item.state === 'ENCERRADA');
  const overdue = items.filter((item) => item.overdue).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-status-purple" />
          Ações de saída da reunião
          <Badge variant="outline" className="text-[10px]">{formatNumber(items.length)}</Badge>
          {overdue > 0 && (
            <Badge variant="outline" className="border-red-200 bg-red-50 text-[10px] text-red-700">
              {formatNumber(overdue)} atrasada(s)
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          O que o fórum decidiu nas reuniões anteriores{areaName ? ` para ${areaName}` : ''} — e como está o andamento agora.
        </p>
      </CardHeader>
      <CardContent>
        {query.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

        {!query.isLoading && items.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Nenhuma ação de saída registrada até aqui. Decisões e escalonamentos criados na reunião aparecem neste
            card nas próximas edições.
          </p>
        )}

        {items.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <OutcomeColumn title="Em aberto" tone="text-status-yellow" items={open} onOpenAction={onOpenAction} />
            <OutcomeColumn title="Encerradas" tone="text-status-green" items={closed} onOpenAction={onOpenAction} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OutcomeColumn({
  title,
  tone,
  items,
  onOpenAction,
}: {
  title: string;
  tone: string;
  items: OutcomeItem[];
  onOpenAction?: (actionId: string) => void;
}) {
  return (
    <div>
      <div className={cn('mb-2 text-xs font-semibold uppercase tracking-wide', tone)}>
        {title} ({formatNumber(items.length)})
      </div>
      {items.length === 0 && <p className="text-xs text-muted-foreground">Nada aqui.</p>}
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpenAction?.(item.id)}
            className="w-full rounded-md border p-2.5 text-left transition-colors hover:bg-accent/30"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{item.title}</span>
              <Badge variant="outline" className={cn('shrink-0 text-[10px]', STATE_CLASS[item.state])}>
                {item.state === 'ENCERRADA' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                {STATE_LABEL[item.state]}
              </Badge>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              {item.fromMeeting && <span>Decidida em {item.fromMeeting}</span>}
              {item.responsible && <span>{item.responsible.name}</span>}
              {item.sector && <span>{item.sector}</span>}
              {item.indicator && <span>Indicador: {item.indicator.name}</span>}
            </div>

            <div className="mt-1.5 flex items-center gap-2">
              <Progress value={item.progress} className="h-1.5 flex-1" />
              <span className="shrink-0 text-[11px] tabular-nums">{formatNumber(item.progress)}%</span>
              {item.dueDate && (
                <span className={cn('shrink-0 text-[11px]', item.overdue ? 'font-semibold text-red-600' : 'text-muted-foreground')}>
                  {item.overdue && <AlertTriangle className="mr-0.5 inline h-3 w-3" />}
                  {formatDate(item.dueDate)}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
