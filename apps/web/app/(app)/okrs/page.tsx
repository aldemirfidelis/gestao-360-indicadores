'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronRight, Plus, MessageSquare, Target } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn, formatPercent, formatDate } from '@/lib/utils';

interface Cycle {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
  _count: { objectives: number };
}

interface KR {
  id: string;
  metric: string;
  unit: string;
  startValue: number;
  currentValue: number;
  targetValue: number;
  direction: string;
  weight: number;
  progress: number;
}

interface Objective {
  id: string;
  name: string;
  description: string | null;
  ownerName: string | null;
  team: string | null;
  weight: number;
  confidence: number;
  status: string;
  progress: number;
  keyResults: KR[];
  strategicObj: { id: string; name: string } | null;
  _count?: { checkins: number };
}

const STATUS_PILL: Record<string, string> = {
  PLANNED: 'pill-gray',
  ON_TRACK: 'pill-green',
  AT_RISK: 'pill-yellow',
  OFF_TRACK: 'pill-red',
  DONE: 'pill-blue',
  CANCELLED: 'pill-gray',
};

const STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Planejado',
  ON_TRACK: 'No prazo',
  AT_RISK: 'Em risco',
  OFF_TRACK: 'Atrasado',
  DONE: 'Concluido',
  CANCELLED: 'Cancelado',
};

export default function OkrsPage() {
  const qc = useQueryClient();
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);

  const cycles = useQuery<Cycle[]>({
    queryKey: ['okrs', 'cycles'],
    queryFn: () => api<Cycle[]>('/okrs/cycles'),
  });

  const cycleId = activeCycleId ?? cycles.data?.[0]?.id ?? null;

  const objectives = useQuery<Objective[]>({
    queryKey: ['okrs', 'objectives', cycleId],
    queryFn: () => api<Objective[]>(`/okrs/cycles/${cycleId}/objectives`),
    enabled: !!cycleId,
  });

  // Check-in modal
  const [checkinObj, setCheckinObj] = useState<Objective | null>(null);
  const [checkin, setCheckin] = useState({ confidence: 0.7, progress: 0.5, note: '' });

  const submitCheckin = useMutation({
    mutationFn: () =>
      api(`/okrs/objectives/${checkinObj?.id}/checkin`, {
        method: 'POST',
        json: {
          weekRef: weekRef(new Date()),
          confidence: checkin.confidence,
          progress: checkin.progress,
          note: checkin.note,
        },
      }),
    onSuccess: () => {
      toast.success('Check-in registrado');
      setCheckinObj(null);
      qc.invalidateQueries({ queryKey: ['okrs'] });
    },
  });

  // KR update inline
  const updateKR = useMutation({
    mutationFn: ({ krId, currentValue }: { krId: string; currentValue: number }) =>
      api(`/okrs/krs/${krId}`, { method: 'PATCH', json: { currentValue } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['okrs', 'objectives'] }),
  });

  return (
    <div>
      <PageHeader
        title="OKRs"
        description="Objetivos e Key Results por ciclo, com calculo de progresso e confianca."
        actions={<Button disabled><Plus className="h-4 w-4 mr-2" />Novo ciclo</Button>}
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {cycles.data?.map((c) => (
          <Button
            key={c.id}
            variant={c.id === cycleId ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCycleId(c.id)}
          >
            {c.name}
            <Badge variant="secondary" className="ml-2">{c._count.objectives}</Badge>
          </Button>
        ))}
      </div>

      <div className="grid gap-4">
        {objectives.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {objectives.data?.map((o) => (
          <Card key={o.id}>
            <CardContent className="p-5">
              <div className="flex flex-col lg:flex-row lg:items-start gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={cn('pill', STATUS_PILL[o.status])}>{STATUS_LABEL[o.status]}</span>
                    {o.strategicObj && (
                      <Badge variant="outline" className="text-[10px]">
                        BSC: {o.strategicObj.name}
                      </Badge>
                    )}
                    {o.team && <Badge variant="secondary" className="text-[10px]">{o.team}</Badge>}
                  </div>
                  <h3 className="font-semibold">{o.name}</h3>
                  {o.description && <p className="text-sm text-muted-foreground mt-1">{o.description}</p>}
                </div>
                <div className="grid grid-cols-2 gap-6 text-right">
                  <div>
                    <div className="text-[11px] uppercase text-muted-foreground">Progresso</div>
                    <div className="text-xl font-semibold">{formatPercent(o.progress)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase text-muted-foreground">Confianca</div>
                    <div className="text-xl font-semibold">{formatPercent(o.confidence)}</div>
                  </div>
                </div>
              </div>

              <Progress value={o.progress * 100} className="mb-4" />

              <div className="space-y-2">
                {o.keyResults.map((kr) => (
                  <div
                    key={kr.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr,140px,140px,1fr] gap-3 items-center rounded-md border p-2"
                  >
                    <div className="text-sm">
                      <div className="font-medium flex items-center gap-2">
                        <Target className="h-3 w-3 text-muted-foreground" />
                        {kr.metric}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {kr.direction === 'HIGHER_BETTER' ? 'subir' : kr.direction === 'LOWER_BETTER' ? 'reduzir' : 'manter'}{' '}
                        - peso {kr.weight}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Inicio <strong className="text-foreground">{kr.startValue}</strong>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Meta <strong className="text-foreground">{kr.targetValue}</strong>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        defaultValue={kr.currentValue}
                        className="h-8 w-24"
                        step="0.01"
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isFinite(v) || v === kr.currentValue) return;
                          updateKR.mutate({ krId: kr.id, currentValue: v });
                        }}
                      />
                      <div className="flex-1">
                        <Progress value={kr.progress * 100} className="h-2" />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {formatPercent(kr.progress)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center mt-4">
                <span className="text-xs text-muted-foreground">
                  {o._count?.checkins ?? 0} check-in(s)
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCheckinObj(o);
                    setCheckin({ confidence: o.confidence, progress: o.progress, note: '' });
                  }}
                >
                  <MessageSquare className="h-4 w-4 mr-2" /> Check-in
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!objectives.isLoading && objectives.data?.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhum objetivo neste ciclo.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!checkinObj} onOpenChange={(v) => !v && setCheckinObj(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check-in semanal</DialogTitle>
          </DialogHeader>
          {checkinObj && (
            <div className="space-y-4">
              <p className="text-sm font-medium">{checkinObj.name}</p>
              <div>
                <Label>Confianca ({Math.round(checkin.confidence * 100)}%)</Label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={checkin.confidence}
                  onChange={(e) => setCheckin({ ...checkin, confidence: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <Label>Progresso ({Math.round(checkin.progress * 100)}%)</Label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={checkin.progress}
                  onChange={(e) => setCheckin({ ...checkin, progress: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <Label>Comentario (opcional)</Label>
                <Textarea
                  value={checkin.note}
                  onChange={(e) => setCheckin({ ...checkin, note: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCheckinObj(null)}>
              Cancelar
            </Button>
            <Button onClick={() => submitCheckin.mutate()} disabled={submitCheckin.isPending}>
              <ChevronRight className="h-4 w-4 mr-2" /> Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function weekRef(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
