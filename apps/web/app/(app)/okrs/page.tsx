'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronRight, MessageSquare, Plus, Save, Target } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { StatusBadge } from '@/components/platform/status-badge';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { cn, formatDate, formatNumber, formatPercent } from '@/lib/utils';

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

const STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Planejado',
  ON_TRACK: 'No prazo',
  AT_RISK: 'Em risco',
  OFF_TRACK: 'Atrasado',
  DONE: 'Concluido',
  CANCELLED: 'Cancelado',
};

const emptyCycle = { name: '', startsAt: new Date().toISOString().slice(0, 10), endsAt: `${new Date().getFullYear()}-12-31` };
const emptyObjective = { name: '', description: '', ownerName: '', team: '', weight: 1 };
const emptyKr = { objectiveId: '', metric: '', unit: 'PERCENT', startValue: 0, currentValue: 0, targetValue: 100, direction: 'HIGHER_BETTER', weight: 1, responsible: '' };

export default function OkrsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['okrs:create']);
  const canUpdate = hasPermission(['okrs:update']);
  const canCheckin = hasPermission(['okrs:checkin', 'okrs:update']);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [cycleOpen, setCycleOpen] = useState(false);
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [krOpen, setKrOpen] = useState(false);
  const [cycleForm, setCycleForm] = useState(emptyCycle);
  const [objectiveForm, setObjectiveForm] = useState(emptyObjective);
  const [krForm, setKrForm] = useState(emptyKr);
  const [checkinObj, setCheckinObj] = useState<Objective | null>(null);
  const [checkin, setCheckin] = useState({ confidence: 0.7, progress: 0.5, note: '' });

  const cycles = useQuery<Cycle[]>({
    queryKey: ['okrs', 'cycles'],
    queryFn: () => api<Cycle[]>('/okrs/cycles'),
  });
  const cycleId = activeCycleId ?? cycles.data?.[0]?.id ?? null;
  const activeCycle = cycles.data?.find((c) => c.id === cycleId);

  const objectives = useQuery<Objective[]>({
    queryKey: ['okrs', 'objectives', cycleId],
    queryFn: () => api<Objective[]>(`/okrs/cycles/${cycleId}/objectives`),
    enabled: !!cycleId,
  });

  const createCycle = useMutation({
    mutationFn: () => api<Cycle>('/okrs/cycles', { method: 'POST', json: cycleForm }),
    onSuccess: (created) => {
      toast.success('Ciclo criado');
      setCycleOpen(false);
      setCycleForm(emptyCycle);
      setActiveCycleId(created.id);
      qc.invalidateQueries({ queryKey: ['okrs', 'cycles'] });
    },
  });

  const createObjective = useMutation({
    mutationFn: () => api(`/okrs/cycles/${cycleId}/objectives`, { method: 'POST', json: objectiveForm }),
    onSuccess: () => {
      toast.success('Objetivo criado');
      setObjectiveOpen(false);
      setObjectiveForm(emptyObjective);
      qc.invalidateQueries({ queryKey: ['okrs'] });
    },
  });

  const createKr = useMutation({
    mutationFn: () => api(`/okrs/objectives/${krForm.objectiveId}/krs`, { method: 'POST', json: krForm }),
    onSuccess: () => {
      toast.success('KR criado');
      setKrOpen(false);
      setKrForm(emptyKr);
      qc.invalidateQueries({ queryKey: ['okrs'] });
    },
  });

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

  const updateKR = useMutation({
    mutationFn: ({ krId, currentValue }: { krId: string; currentValue: number }) =>
      api(`/okrs/krs/${krId}`, { method: 'PATCH', json: { currentValue } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['okrs', 'objectives'] }),
  });

  const stats = useMemo(() => {
    const list = objectives.data ?? [];
    const krs = list.reduce((acc, obj) => acc + obj.keyResults.length, 0);
    const progress = list.length ? list.reduce((acc, obj) => acc + obj.progress, 0) / list.length : 0;
    const risk = list.filter((obj) => ['AT_RISK', 'OFF_TRACK'].includes(obj.status)).length;
    return { objectives: list.length, krs, progress, risk };
  }, [objectives.data]);

  return (
    <div>
      <PageHeader
        eyebrow="Visualização"
        tone="view"
        title="OKRs"
        description="Ciclos objetivos: crie o ciclo, defina objetivos, adicione KRs e registre check-ins semanais."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Visualização', href: '/visualization' }, { label: 'OKRs' }]}
        actions={
          canCreate ? (
            <>
              <Button variant="outline" onClick={() => setCycleOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo ciclo
              </Button>
              <Button onClick={() => setObjectiveOpen(true)} disabled={!cycleId}>
                <Plus className="mr-2 h-4 w-4" />
                Novo objetivo
              </Button>
            </>
          ) : null
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {cycles.data?.map((c) => (
          <Button key={c.id} variant={c.id === cycleId ? 'default' : 'outline'} size="sm" onClick={() => setActiveCycleId(c.id)}>
            {c.name}
            <Badge variant="secondary" className="ml-2">{c._count.objectives}</Badge>
          </Button>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Ciclo ativo" value={activeCycle?.name ?? '-'} description={activeCycle ? `${formatDate(activeCycle.startsAt)} - ${formatDate(activeCycle.endsAt)}` : 'Crie um ciclo'} tone="blue" />
        <MetricCard title="Objetivos" value={formatNumber(stats.objectives)} description="No ciclo selecionado" icon={<Target className="h-4 w-4" />} tone="purple" />
        <MetricCard title="Resultado" value={formatNumber(stats.krs)} description="Métrica de resultado" icon={<Target className="h-4 w-4" />} tone="green" />
        <MetricCard title="Progresso médio" value={formatPercent(stats.progress)} description={`${stats.risk} em risco`} icon={<Target className="h-4 w-4" />} tone="yellow" />
      </div>

      <div className="grid gap-4">
        {objectives.data?.map((o) => (
          <SectionCard
            key={o.id}
            title={o.name}
            description={o.description ?? `${o.ownerName ?? 'Sem owner'}${o.team ? ` - ${o.team}` : ''}`}
            actions={
              <div className="flex flex-wrap gap-2">
                <StatusBadge value={o.status} label={STATUS_LABEL[o.status] ?? o.status} />
                {canUpdate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setKrForm({ ...emptyKr, objectiveId: o.id });
                      setKrOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    KR
                  </Button>
                )}
              </div>
            }
          >
            <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">Progresso</div>
                <div className="text-xl font-semibold">{formatPercent(o.progress)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Confiança</div>
                <div className="text-xl font-semibold">{formatPercent(o.confidence)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Peso</div>
                <div className="text-xl font-semibold">{o.weight}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Check-ins</div>
                <div className="text-xl font-semibold">{o._count?.checkins ?? 0}</div>
              </div>
            </div>
            <Progress value={o.progress * 100} className="mb-4" />
            <div className="space-y-2">
              {o.keyResults.map((kr) => (
                <div key={kr.id} className="grid grid-cols-1 gap-3 rounded-lg border p-3 lg:grid-cols-[1fr,120px,120px,1fr] lg:items-center">
                  <div>
                    <div className="font-medium">{kr.metric}</div>
                    <div className="text-xs text-muted-foreground">peso {kr.weight} - {kr.direction}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">Início <strong className="text-foreground">{kr.startValue}</strong></div>
                  <div className="text-xs text-muted-foreground">Meta <strong className="text-foreground">{kr.targetValue}</strong></div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      defaultValue={kr.currentValue}
                      className="h-8 w-24"
                      step="0.01"
                      disabled={!canUpdate}
                      onBlur={(e) => {
                        if (!canUpdate) return;
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v) || v === kr.currentValue) return;
                        updateKR.mutate({ krId: kr.id, currentValue: v });
                      }}
                    />
                    <Progress value={kr.progress * 100} className="h-2 flex-1" />
                    <span className="w-14 text-right text-xs text-muted-foreground">{formatPercent(kr.progress)}</span>
                  </div>
                </div>
              ))}
              {o.keyResults.length === 0 && <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Adicione KRs para calcular o progresso automaticamente.</div>}
            </div>
            {canCheckin && (
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCheckinObj(o);
                    setCheckin({ confidence: o.confidence, progress: o.progress, note: '' });
                  }}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Check-in
                </Button>
              </div>
            )}
          </SectionCard>
        ))}
      </div>

      <Dialog open={cycleOpen} onOpenChange={setCycleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo ciclo OKR</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={cycleForm.name} onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })} placeholder="Ex.: OKR 2026 T1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input type="date" value={cycleForm.startsAt} onChange={(e) => setCycleForm({ ...cycleForm, startsAt: e.target.value })} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="date" value={cycleForm.endsAt} onChange={(e) => setCycleForm({ ...cycleForm, endsAt: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCycleOpen(false)}>Cancelar</Button>
            <Button onClick={() => createCycle.mutate()} disabled={!cycleForm.name || createCycle.isPending}>Criar ciclo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={objectiveOpen} onOpenChange={setObjectiveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo objetivo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Objetivo</Label>
              <Input value={objectiveForm.name} onChange={(e) => setObjectiveForm({ ...objectiveForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={objectiveForm.description} onChange={(e) => setObjectiveForm({ ...objectiveForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Owner</Label>
                <Input value={objectiveForm.ownerName} onChange={(e) => setObjectiveForm({ ...objectiveForm, ownerName: e.target.value })} />
              </div>
              <div>
                <Label>Time</Label>
                <Input value={objectiveForm.team} onChange={(e) => setObjectiveForm({ ...objectiveForm, team: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setObjectiveOpen(false)}>Cancelar</Button>
            <Button onClick={() => createObjective.mutate()} disabled={!objectiveForm.name || !cycleId || createObjective.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Criar objetivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={krOpen} onOpenChange={setKrOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Key Result</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Métrica</Label>
              <Input value={krForm.metric} onChange={(e) => setKrForm({ ...krForm, metric: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Início</Label>
                <Input type="number" value={krForm.startValue} onChange={(e) => setKrForm({ ...krForm, startValue: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Atual</Label>
                <Input type="number" value={krForm.currentValue} onChange={(e) => setKrForm({ ...krForm, currentValue: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Meta</Label>
                <Input type="number" value={krForm.targetValue} onChange={(e) => setKrForm({ ...krForm, targetValue: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Direção</Label>
              <NativeSelect value={krForm.direction} onChange={(e) => setKrForm({ ...krForm, direction: e.target.value })}>
                <option value="HIGHER_BETTER">Quanto maior, melhor</option>
                <option value="LOWER_BETTER">Quanto menor, melhor</option>
                <option value="EQUAL_TARGET">Igual a meta</option>
              </NativeSelect>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setKrOpen(false)}>Cancelar</Button>
            <Button onClick={() => createKr.mutate()} disabled={!krForm.metric || createKr.isPending}>
              <ChevronRight className="mr-2 h-4 w-4" />
              Criar KR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!checkinObj} onOpenChange={(v) => !v && setCheckinObj(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Check-in semanal</DialogTitle></DialogHeader>
          {checkinObj && (
            <div className="space-y-4">
              <p className="text-sm font-medium">{checkinObj.name}</p>
              <div>
                <Label>Confianca ({Math.round(checkin.confidence * 100)}%)</Label>
                <input type="range" min={0} max={1} step={0.05} value={checkin.confidence} onChange={(e) => setCheckin({ ...checkin, confidence: Number(e.target.value) })} className="w-full" />
              </div>
              <div>
                <Label>Progresso ({Math.round(checkin.progress * 100)}%)</Label>
                <input type="range" min={0} max={1} step={0.05} value={checkin.progress} onChange={(e) => setCheckin({ ...checkin, progress: Number(e.target.value) })} className="w-full" />
              </div>
              <div>
                <Label>Comentario</Label>
                <Textarea value={checkin.note} onChange={(e) => setCheckin({ ...checkin, note: e.target.value })} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCheckinObj(null)}>Cancelar</Button>
            <Button onClick={() => submitCheckin.mutate()} disabled={submitCheckin.isPending}>
              <ChevronRight className="mr-2 h-4 w-4" />
              Registrar
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
