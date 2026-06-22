'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronRight, GitBranch, List, MessageSquare, Pencil, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
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
import { formatPercent } from '@/lib/utils';
import { LoadingState } from '@/components/platform/loading-state';

// React Flow (+CSS) e pesado e so e necessario na visao de fluxo; carrega sob demanda
// para nao entrar no bundle inicial da pagina de OKRs.
const OkrFlowchart = dynamic(() => import('./okr-flowchart').then((m) => m.OkrFlowchart), {
  ssr: false,
  loading: () => <LoadingState label="Carregando mapa de OKRs..." />,
});

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
  indicatorId?: string | null;
  indicator?: { id: string; name: string; code: string | null; unit?: string } | null;
  linkedValue?: number | null;
}

interface AreaOption {
  id: string;
  name: string;
  code?: string | null;
  type: string;
  parentId: string | null;
}

interface UserOption {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  jobTitle?: string | null;
}

interface IndicatorOption {
  id: string;
  name: string;
  code: string | null;
  unit: string;
  ownerNode?: { id: string; name: string } | null;
}

interface StrategicIndicator {
  id: string;
  name: string;
  code: string | null;
  ownerNode?: { id: string; name: string; type?: string } | null;
  results?: { light: string; attainment: number | null; periodRef: string; value: number | null }[];
}

interface StrategicObjectiveRef {
  id: string;
  name: string;
  status: string;
  ownerNode?: { id: string; name: string; type?: string } | null;
  perspective?: { id: string; name: string } | null;
  map?: { id: string; name: string } | null;
  indicators?: StrategicIndicator[];
}

interface Objective {
  id: string;
  name: string;
  description: string | null;
  ownerName: string | null;
  team: string | null;
  parentId: string | null;
  weight: number;
  confidence: number;
  status: string;
  progress: number;
  keyResults: KR[];
  strategicObj: StrategicObjectiveRef | null;
  checkins?: { weekRef: string; progress: number; confidence: number; createdAt: string }[];
  _count?: { checkins: number };
  ownerNode?: { id: string; name: string; type?: string } | null;
  ownerUser?: { id: string; name: string; email?: string; avatarUrl?: string | null; jobTitle?: string | null } | null;
  area?: { id: string; name: string; type?: string } | null;
  expectedProgress?: number | null;
  pace?: number | null;
  paceLabel?: 'AHEAD' | 'ON_TRACK' | 'BEHIND' | 'AT_RISK' | null;
  lastCheckinWeek?: string | null;
  needsCheckin?: boolean;
}

interface OkrOptions {
  strategicObjectives: StrategicObjectiveRef[];
  areas: AreaOption[];
  users: UserOption[];
  indicators: IndicatorOption[];
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
const emptyObjective = { name: '', description: '', ownerName: '', team: '', weight: 1, parentId: '', strategicObjId: '', ownerNodeId: '', ownerUserId: '' };
const emptyKr = { objectiveId: '', metric: '', unit: 'PERCENT', startValue: 0, currentValue: 0, targetValue: 100, direction: 'HIGHER_BETTER', weight: 1, responsible: '', indicatorId: '' };

const PACE_LABEL: Record<string, { label: string; tone: string }> = {
  AHEAD: { label: 'Adiantado', tone: 'text-status-blue' },
  ON_TRACK: { label: 'No ritmo', tone: 'text-status-green' },
  BEHIND: { label: 'Atrasado', tone: 'text-status-yellow' },
  AT_RISK: { label: 'Em risco', tone: 'text-status-red' },
};

export default function OkrsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['okrs:create']);
  const canUpdate = hasPermission(['okrs:update']);
  const canDelete = hasPermission(['okrs:delete']);
  const canCheckin = hasPermission(['okrs:checkin', 'okrs:update']);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'flow'>('list');
  const [areaFilterId, setAreaFilterId] = useState<string>('');
  const [cycleOpen, setCycleOpen] = useState(false);
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [krOpen, setKrOpen] = useState(false);
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null);
  const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(null);
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

  const objectives = useQuery<Objective[]>({
    queryKey: ['okrs', 'objectives', cycleId],
    queryFn: () => api<Objective[]>(`/okrs/cycles/${cycleId}/objectives`),
    enabled: !!cycleId,
  });

  const options = useQuery<OkrOptions>({
    queryKey: ['okrs', 'options'],
    queryFn: () => api<OkrOptions>('/okrs/options'),
  });

  const createCycle = useMutation({
    mutationFn: () =>
      editingCycleId
        ? api<Cycle>(`/okrs/cycles/${editingCycleId}`, { method: 'PATCH', json: cycleForm })
        : api<Cycle>('/okrs/cycles', { method: 'POST', json: cycleForm }),
    onSuccess: (created) => {
      toast.success(editingCycleId ? 'Ciclo atualizado' : 'Ciclo criado');
      setCycleOpen(false);
      setCycleForm(emptyCycle);
      setEditingCycleId(null);
      if (!editingCycleId) setActiveCycleId(created.id);
      qc.invalidateQueries({ queryKey: ['okrs', 'cycles'] });
    },
  });

  const removeCycle = useMutation({
    mutationFn: (id: string) => api(`/okrs/cycles/${id}`, { method: 'DELETE' }),
    onSuccess: (_removed, id) => {
      toast.success('Ciclo removido');
      if (activeCycleId === id) setActiveCycleId(null);
      qc.invalidateQueries({ queryKey: ['okrs'] });
    },
  });

  const createObjective = useMutation({
    mutationFn: () =>
      api(editingObjectiveId ? `/okrs/objectives/${editingObjectiveId}` : `/okrs/cycles/${cycleId}/objectives`, {
        method: editingObjectiveId ? 'PATCH' : 'POST',
        json: {
          ...objectiveForm,
          parentId: objectiveForm.parentId || null,
          strategicObjId: objectiveForm.strategicObjId || null,
          ownerNodeId: objectiveForm.ownerNodeId || null,
          ownerUserId: objectiveForm.ownerUserId || null,
        },
      }),
    onSuccess: () => {
      toast.success(editingObjectiveId ? 'Objetivo atualizado' : 'Objetivo criado');
      setObjectiveOpen(false);
      setEditingObjectiveId(null);
      setObjectiveForm(emptyObjective);
      qc.invalidateQueries({ queryKey: ['okrs'] });
    },
  });

  const removeObjective = useMutation({
    mutationFn: (id: string) => api(`/okrs/objectives/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Objetivo removido');
      qc.invalidateQueries({ queryKey: ['okrs'] });
    },
  });

  const createKr = useMutation({
    mutationFn: () => api(`/okrs/objectives/${krForm.objectiveId}/krs`, { method: 'POST', json: { ...krForm, indicatorId: krForm.indicatorId || null } }),
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
      toast.success('Atualização registrada');
      setCheckinObj(null);
      qc.invalidateQueries({ queryKey: ['okrs'] });
    },
  });

  const updateKR = useMutation({
    mutationFn: ({ krId, currentValue }: { krId: string; currentValue: number }) =>
      api(`/okrs/krs/${krId}`, { method: 'PATCH', json: { currentValue } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['okrs', 'objectives'] }),
  });

  const allObjectives = objectives.data ?? [];
  const areaOptions = options.data?.areas ?? [];
  const filteredObjectives = areaFilterId
    ? allObjectives.filter((o) => o.area?.id === areaFilterId || o.ownerNode?.id === areaFilterId)
    : allObjectives;

  const openNewCycle = () => {
    setEditingCycleId(null);
    setCycleForm(emptyCycle);
    setCycleOpen(true);
  };

  const openEditCycle = (cycle: Cycle) => {
    setEditingCycleId(cycle.id);
    setCycleForm({ name: cycle.name, startsAt: toDateInput(cycle.startsAt), endsAt: toDateInput(cycle.endsAt) });
    setCycleOpen(true);
  };

  const openNewObjective = () => {
    setEditingObjectiveId(null);
    setObjectiveForm(emptyObjective);
    setObjectiveOpen(true);
  };

  const openEditObjective = (objective: Objective) => {
    setEditingObjectiveId(objective.id);
    setObjectiveForm({
      name: objective.name,
      description: objective.description ?? '',
      ownerName: objective.ownerName ?? '',
      team: objective.team ?? '',
      weight: objective.weight ?? 1,
      parentId: objective.parentId ?? '',
      strategicObjId: objective.strategicObj?.id ?? '',
      ownerNodeId: objective.ownerNode?.id ?? objective.area?.id ?? '',
      ownerUserId: objective.ownerUser?.id ?? '',
    });
    setObjectiveOpen(true);
  };

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
              <Button variant="outline" onClick={openNewCycle}>
                <Plus className="mr-2 h-4 w-4" />
                Novo ciclo
              </Button>
              <Button onClick={openNewObjective} disabled={!cycleId}>
                <Plus className="mr-2 h-4 w-4" />
                Novo objetivo
              </Button>
            </>
          ) : null
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {cycles.data?.map((c) => (
          <div key={c.id} className="inline-flex items-center rounded-md border bg-card">
            <Button variant={c.id === cycleId ? 'default' : 'ghost'} size="sm" className="rounded-r-none" onClick={() => setActiveCycleId(c.id)}>
              {c.name}
              <Badge variant="secondary" className="ml-2">{c._count.objectives}</Badge>
            </Button>
            {canUpdate && (
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => openEditCycle(c)} title="Editar ciclo">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-l-none text-destructive hover:text-destructive"
                onClick={() => {
                  if (window.confirm(`Excluir o ciclo "${c.name}"? Os dados ficam preservados no histórico.`)) removeCycle.mutate(c.id);
                }}
                title="Excluir ciclo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <NativeSelect
            className="h-9 w-[200px] text-xs"
            value={areaFilterId}
            onChange={(e) => setAreaFilterId(e.target.value)}
            title="Filtrar por área"
          >
            <option value="">Todas as áreas</option>
            {areaOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </NativeSelect>
          <div className="inline-flex items-center rounded-md border p-0.5">
            <Button size="sm" variant={view === 'list' ? 'default' : 'ghost'} onClick={() => setView('list')}>
              <List className="mr-1.5 h-3.5 w-3.5" /> Lista
            </Button>
            <Button size="sm" variant={view === 'flow' ? 'default' : 'ghost'} onClick={() => setView('flow')}>
              <GitBranch className="mr-1.5 h-3.5 w-3.5" /> Fluxograma
            </Button>
          </div>
        </div>
      </div>

      {view === 'list' && (
      <div className="grid gap-4">
        {filteredObjectives.map((o) => (
          <SectionCard
            key={o.id}
            title={o.name}
            description={o.description ?? `${o.ownerUser?.name ?? o.ownerName ?? 'Sem responsável'}${o.team ? ` · ${o.team}` : ''}`}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {o.area && <Badge variant="outline">{o.area.name}</Badge>}
                {o.ownerUser && <span className="text-xs text-muted-foreground">{o.ownerUser.name}</span>}
                {o.paceLabel && PACE_LABEL[o.paceLabel] && (
                  <span className={`text-xs font-medium ${PACE_LABEL[o.paceLabel].tone}`}>{PACE_LABEL[o.paceLabel].label}</span>
                )}
                {o.needsCheckin && <Badge variant="secondary">Check-in pendente</Badge>}
                <StatusBadge value={o.status} label={STATUS_LABEL[o.status] ?? o.status} />
                {canUpdate && (
                  <Button variant="outline" size="sm" onClick={() => openEditObjective(o)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (window.confirm(`Excluir o objetivo "${o.name}"?`)) removeObjective.mutate(o.id);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </Button>
                )}
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
                <div className="text-xs text-muted-foreground">Atualizações</div>
                <div className="text-xl font-semibold">{o._count?.checkins ?? 0}</div>
              </div>
            </div>
            <Progress value={o.progress * 100} className="mb-4" />
            {o.strategicObj && (
              <div className="mb-4 rounded-lg border bg-muted/20 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">Conexão estrategica</div>
                    <div className="mt-1 font-medium">
                      {o.strategicObj.name}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                      {o.strategicObj.map && <Badge variant="secondary">{o.strategicObj.map.name}</Badge>}
                      {o.strategicObj.perspective && <Badge variant="outline">{o.strategicObj.perspective.name}</Badge>}
                      {o.strategicObj.ownerNode && <Badge variant="outline">{o.strategicObj.ownerNode.name}</Badge>}
                    </div>
                  </div>
                  {o.strategicObj.map && (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/strategy/${o.strategicObj.map.id}`}>Abrir mapa</Link>
                    </Button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(o.strategicObj.indicators ?? []).length === 0 && (
                    <span className="text-xs text-muted-foreground">Nenhum indicador vinculado ao objetivo estratégico.</span>
                  )}
                  {(o.strategicObj.indicators ?? []).slice(0, 6).map((indicator) => (
                    <Link
                      key={indicator.id}
                      href={`/indicators/${indicator.id}`}
                      className="rounded-full border bg-background px-2 py-1 text-xs transition hover:bg-accent/35"
                    >
                      {indicator.code ? `${indicator.code} - ` : ''}{indicator.name}
                    </Link>
                  ))}
                  {(o.strategicObj.indicators ?? []).length > 6 && (
                    <Badge variant="secondary">+{(o.strategicObj.indicators ?? []).length - 6}</Badge>
                  )}
                </div>
              </div>
            )}
            <div className="space-y-2">
              {o.keyResults.map((kr) => (
                <div key={kr.id} className="grid grid-cols-1 gap-3 rounded-lg border p-3 lg:grid-cols-[1fr,120px,120px,1fr] lg:items-center">
                  <div>
                    <div className="font-medium">{kr.metric}</div>
                    <div className="text-xs text-muted-foreground">peso {kr.weight} - {kr.direction}</div>
                    {kr.indicator && (
                      <Link href={`/indicators/${kr.indicator.id}`} className="mt-1 inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent/40">
                        <RefreshCw className="h-3 w-3" /> {kr.indicator.code ? `${kr.indicator.code} - ` : ''}{kr.indicator.name}
                      </Link>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">Início <strong className="text-foreground">{kr.startValue}</strong></div>
                  <div className="text-xs text-muted-foreground">Meta <strong className="text-foreground">{kr.targetValue}</strong></div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      defaultValue={kr.currentValue}
                      key={`${kr.id}-${kr.currentValue}`}
                      className="h-8 w-24"
                      step="0.01"
                      disabled={!canUpdate || !!kr.indicator}
                      title={kr.indicator ? 'Valor atualizado automaticamente pelo indicador vinculado' : undefined}
                      onBlur={(e) => {
                        if (!canUpdate || kr.indicator) return;
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
                  Atualizar andamento
                </Button>
              </div>
            )}
          </SectionCard>
        ))}
      </div>
      )}

      {view === 'flow' && (
        <OkrFlowchart
          objectives={filteredObjectives}
          onRefresh={() => objectives.refetch()}
          isFetching={objectives.isFetching}
        />
      )}

      <Dialog open={cycleOpen} onOpenChange={setCycleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCycleId ? 'Editar ciclo OKR' : 'Novo ciclo OKR'}</DialogTitle></DialogHeader>
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
            <Button onClick={() => createCycle.mutate()} disabled={!cycleForm.name || createCycle.isPending}>
              {editingCycleId ? 'Salvar ciclo' : 'Criar ciclo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={objectiveOpen} onOpenChange={setObjectiveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingObjectiveId ? 'Editar objetivo' : 'Novo objetivo'}</DialogTitle></DialogHeader>
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
                <Label>Área</Label>
                <NativeSelect value={objectiveForm.ownerNodeId} onChange={(e) => setObjectiveForm({ ...objectiveForm, ownerNodeId: e.target.value })}>
                  <option value="">Sem área</option>
                  {areaOptions.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label>Responsável</Label>
                <NativeSelect value={objectiveForm.ownerUserId} onChange={(e) => setObjectiveForm({ ...objectiveForm, ownerUserId: e.target.value })}>
                  <option value="">Sem responsável</option>
                  {(options.data?.users ?? []).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div>
              <Label>Equipe (opcional)</Label>
              <Input value={objectiveForm.team} onChange={(e) => setObjectiveForm({ ...objectiveForm, team: e.target.value })} />
            </div>
            <div>
              <Label>Objetivo pai (opcional)</Label>
              <NativeSelect value={objectiveForm.parentId} onChange={(e) => setObjectiveForm({ ...objectiveForm, parentId: e.target.value })}>
                <option value="">Nenhum (objetivo raiz)</option>
                {objectives.data?.filter((o) => o.id !== editingObjectiveId).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </NativeSelect>
              <p className="mt-1 text-xs text-muted-foreground">Defina o pai para montar a hierarquia no fluxograma.</p>
            </div>
            <div>
              <Label>Objetivo estratégico vinculado</Label>
              <NativeSelect
                value={objectiveForm.strategicObjId}
                onChange={(e) => {
                  const strategicObjId = e.target.value;
                  const selected = options.data?.strategicObjectives.find((item) => item.id === strategicObjId);
                  setObjectiveForm({
                    ...objectiveForm,
                    strategicObjId,
                    team: objectiveForm.team || selected?.ownerNode?.name || '',
                  });
                }}
              >
                <option value="">Sem vínculo estratégico</option>
                {options.data?.strategicObjectives.map((obj) => (
                  <option key={obj.id} value={obj.id}>
                    {obj.map?.name ? `${obj.map.name} / ` : ''}{obj.perspective?.name ? `${obj.perspective.name} / ` : ''}{obj.name}
                  </option>
                ))}
              </NativeSelect>
              <p className="mt-1 text-xs text-muted-foreground">
                O OKR herda contexto do mapa, área e indicadores vinculados ao objetivo estratégico.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setObjectiveOpen(false)}>Cancelar</Button>
            <Button onClick={() => createObjective.mutate()} disabled={!objectiveForm.name || (!editingObjectiveId && !cycleId) || createObjective.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {editingObjectiveId ? 'Salvar objetivo' : 'Criar objetivo'}
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
            <div>
              <Label>Indicador vinculado (opcional)</Label>
              <NativeSelect
                value={krForm.indicatorId}
                onChange={(e) => {
                  const indicatorId = e.target.value;
                  const ind = (options.data?.indicators ?? []).find((i) => i.id === indicatorId);
                  setKrForm({
                    ...krForm,
                    indicatorId,
                    metric: krForm.metric || ind?.name || '',
                    unit: ind?.unit ?? krForm.unit,
                  });
                }}
              >
                <option value="">Sem vínculo (valor manual)</option>
                {(options.data?.indicators ?? []).map((i) => (
                  <option key={i.id} value={i.id}>{i.code ? `${i.code} - ` : ''}{i.name}</option>
                ))}
              </NativeSelect>
              <p className="mt-1 text-xs text-muted-foreground">
                Se vinculado, o valor atual do KR é atualizado automaticamente pelo último realizado do indicador.
              </p>
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
          <DialogHeader><DialogTitle>Atualização semanal</DialogTitle></DialogHeader>
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

function toDateInput(value: string | Date | null | undefined) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}
