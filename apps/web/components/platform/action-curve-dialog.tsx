'use client';

/**
 * Curva S de uma ação da ata: o avanço PLANEJADO (ritmo combinado na reunião,
 * derivado dos prazos das tarefas) contra o REALIZADO. Responde de bate-pronto
 * se a ação está no ritmo, adiantada ou atrasada.
 */

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/platform/loading-state';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';

interface CurvePoint {
  date: string;
  planned: number;
  actual: number | null;
}

interface CurveResponse {
  action: {
    id: string;
    title: string;
    status: string;
    state: 'NAO_INICIADA' | 'EM_ANDAMENTO' | 'ENCERRADA' | 'CANCELADA';
    progress: number;
    startDate: string;
    dueDate: string | null;
    completedAt: string | null;
    responsible: { id: string; name: string } | null;
    taskCount: number;
    taskDone: number;
  };
  deviationPp: number;
  points: CurvePoint[];
  tasks: Array<{ id: string; title: string; done: boolean; dueDate: string | null }>;
}

const STATE_LABEL: Record<CurveResponse['action']['state'], string> = {
  NAO_INICIADA: 'Não iniciada',
  EM_ANDAMENTO: 'Em andamento',
  ENCERRADA: 'Encerrada',
  CANCELADA: 'Cancelada',
};

export function ActionCurveDialog({
  actionId,
  onOpenChange,
}: {
  actionId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const curve = useQuery<CurveResponse>({
    queryKey: ['minutes', 'curve', actionId],
    enabled: Boolean(actionId),
    queryFn: () => api<CurveResponse>(`/monthly-results/minutes/actions/${actionId}/curve`),
  });

  const data = curve.data;
  const chartData = (data?.points ?? []).map((point) => ({
    ...point,
    label: shortDate(point.date),
  }));
  // Positivo = à frente do combinado; negativo = atrás.
  const delta = data?.deviationPp ?? 0;
  const behind = delta < -5;
  const ahead = delta > 5;

  return (
    <Dialog open={Boolean(actionId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="pr-6 text-base leading-snug">{data?.action.title ?? 'Curva S da ação'}</DialogTitle>
        </DialogHeader>

        {curve.isLoading && <LoadingState />}

        {data && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">{STATE_LABEL[data.action.state]}</Badge>
              {data.action.responsible && <Badge variant="outline">{data.action.responsible.name}</Badge>}
              <Badge variant="outline">
                Início {formatDate(data.action.startDate)}
                {data.action.dueDate ? ` · Fim ${formatDate(data.action.dueDate)}` : ''}
              </Badge>
              {data.action.taskCount > 0 && (
                <Badge variant="outline">
                  {formatNumber(data.action.taskDone)}/{formatNumber(data.action.taskCount)} tarefas
                </Badge>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Tile label="Avanço realizado" value={`${formatNumber(data.action.progress)}%`} />
              <Tile
                label="Ritmo combinado"
                value={`${formatNumber(Math.max(0, data.action.progress - delta))}%`}
                hint="Onde a ação deveria estar hoje"
              />
              <Tile
                label="Diferença"
                value={`${delta > 0 ? '+' : ''}${formatNumber(delta)} p.p.`}
                tone={behind ? 'red' : ahead ? 'green' : 'neutral'}
                hint={behind ? 'Atrás do combinado' : ahead ? 'À frente do combinado' : 'No ritmo'}
              />
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} width={40} domain={[0, 100]} unit="%" />
                  <Tooltip content={<CurveTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area
                    type="monotone"
                    dataKey="planned"
                    name="Planejado"
                    stroke="#94a3b8"
                    strokeDasharray="6 4"
                    strokeWidth={2}
                    fill="#94a3b8"
                    fillOpacity={0.12}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Realizado"
                    stroke={behind ? '#ef4444' : '#10b981'}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {data.tasks.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tarefas que compõem o avanço
                </div>
                <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                  {data.tasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-2 rounded border px-2 py-1.5 text-xs">
                      {task.done ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className={cn('min-w-0 flex-1 truncate', task.done && 'text-muted-foreground line-through')}>
                        {task.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {task.dueDate ? formatDate(task.dueDate) : 'sem prazo'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.action.taskCount === 0 && (
              <p className="text-xs text-muted-foreground">
                Esta ação não tem tarefas cadastradas: o planejado é a reta entre o início e o prazo. Detalhar as
                tarefas no plano deixa a curva fiel ao que foi combinado.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {data && (
            <Button asChild variant="outline">
              <Link href={`/actions/${data.action.id}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir plano de ação
              </Link>
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Tile({ label, value, hint, tone = 'neutral' }: { label: string; value: string; hint?: string; tone?: 'neutral' | 'red' | 'green' }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          'mt-1 text-lg font-semibold tabular-nums',
          tone === 'red' && 'text-red-600',
          tone === 'green' && 'text-emerald-600',
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function CurveTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const planned = payload.find((p: any) => p.dataKey === 'planned')?.value;
  const actual = payload.find((p: any) => p.dataKey === 'actual')?.value;
  return (
    <div className="rounded-md border bg-background p-2 text-xs shadow-sm">
      <div className="font-semibold">{label}</div>
      <div>Planejado: {formatNumber(planned)}%</div>
      <div>Realizado: {actual === null || actual === undefined ? '—' : `${formatNumber(actual)}%`}</div>
    </div>
  );
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
