'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, GitBranch, Plus, Save, Target } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { StatusBadge } from '@/components/platform/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn, formatPercent } from '@/lib/utils';

interface Perspective {
  id: string;
  kind: string;
  name: string;
  color: string | null;
  position: number;
}

interface Objective {
  id: string;
  perspectiveId: string;
  perspective: Perspective;
  name: string;
  description: string | null;
  status: string;
  weight: number;
  priority: number;
  aggregateLight: string;
  aggregateAttainment: number | null;
  indicators: { id: string; name: string; code: string | null }[];
  outRelations: { id: string; to: { id: string; name: string } }[];
  inRelations: { id: string; from: { id: string; name: string } }[];
}

interface StrategicMap {
  id: string;
  name: string;
  perspectives: Perspective[];
  objectives: Objective[];
}

interface Indicator {
  id: string;
  name: string;
  code: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Planejado',
  ON_TRACK: 'No prazo',
  AT_RISK: 'Em risco',
  OFF_TRACK: 'Atrasado',
  DONE: 'Concluido',
  CANCELLED: 'Cancelado',
};

const PERSPECTIVE_KIND = [
  ['CUSTOM', 'Livre'],
  ['FINANCIAL', 'Financeira'],
  ['CUSTOMERS', 'Clientes'],
  ['INTERNAL_PROCESS', 'Processos'],
  ['LEARNING_GROWTH', 'Aprendizado'],
  ['PEOPLE', 'Pessoas'],
  ['QUALITY', 'Qualidade'],
  ['PRODUCTIVITY', 'Produtividade'],
] as const;

export default function StrategyMapPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [perspectiveOpen, setPerspectiveOpen] = useState(false);
  const [perspective, setPerspective] = useState({ kind: 'CUSTOM', name: '', color: '#164e63' });
  const [objective, setObjective] = useState({ perspectiveId: '', name: '', description: '', weight: 1 });
  const [attachment, setAttachment] = useState<Record<string, string>>({});
  const [relation, setRelation] = useState<Record<string, string>>({});

  const query = useQuery<StrategicMap>({
    queryKey: ['strategy', 'map', id],
    queryFn: () => api<StrategicMap>(`/strategy/maps/${id}`),
  });
  const indicators = useQuery<Indicator[]>({
    queryKey: ['indicators'],
    queryFn: () => api<Indicator[]>('/indicators'),
  });

  const map = query.data;
  const byPersp = useMemo(() => {
    const grouped = new Map<string, Objective[]>();
    map?.perspectives.forEach((p) => grouped.set(p.id, []));
    map?.objectives.forEach((o) => {
      if (!grouped.has(o.perspectiveId)) grouped.set(o.perspectiveId, []);
      grouped.get(o.perspectiveId)!.push(o);
    });
    return grouped;
  }, [map]);

  const createPerspective = useMutation({
    mutationFn: () => api(`/strategy/maps/${id}/perspectives`, { method: 'POST', json: perspective }),
    onSuccess: () => {
      toast.success('Perspectiva criada');
      setPerspectiveOpen(false);
      setPerspective({ kind: 'CUSTOM', name: '', color: '#164e63' });
      qc.invalidateQueries({ queryKey: ['strategy', 'map', id] });
    },
  });

  const createObjective = useMutation({
    mutationFn: () =>
      api(`/strategy/maps/${id}/objectives`, {
        method: 'POST',
        json: objective,
      }),
    onSuccess: () => {
      toast.success('Objetivo criado');
      setObjectiveOpen(false);
      setObjective({ perspectiveId: '', name: '', description: '', weight: 1 });
      qc.invalidateQueries({ queryKey: ['strategy', 'map', id] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao criar objetivo'),
  });

  const updateObjective = useMutation({
    mutationFn: ({ objId, patch }: { objId: string; patch: any }) =>
      api(`/strategy/objectives/${objId}`, { method: 'PATCH', json: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategy', 'map', id] }),
  });

  const attachIndicator = useMutation({
    mutationFn: ({ objId, indicatorId }: { objId: string; indicatorId: string }) =>
      api(`/strategy/objectives/${objId}/indicators/${indicatorId}`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Indicador vinculado');
      qc.invalidateQueries({ queryKey: ['strategy', 'map', id] });
      qc.invalidateQueries({ queryKey: ['indicators'] });
    },
  });

  const addRelation = useMutation({
    mutationFn: ({ fromId, toId }: { fromId: string; toId: string }) =>
      api('/strategy/relations', { method: 'POST', json: { fromId, toId, weight: 1 } }),
    onSuccess: () => {
      toast.success('Relacao criada');
      qc.invalidateQueries({ queryKey: ['strategy', 'map', id] });
    },
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!map) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Visualizacao"
        tone="view"
        title={map.name}
        description="Manipule perspectivas, objetivos, vinculos com indicadores e relacoes de causa e efeito."
        breadcrumbs={[{ label: 'Mapas estrategicos', href: '/strategy' }, { label: map.name }]}
        actions={
          <>
            <Button variant="outline" onClick={() => setPerspectiveOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Perspectiva
            </Button>
            <Button
              onClick={() => {
                setObjective({ perspectiveId: map.perspectives[0]?.id ?? '', name: '', description: '', weight: 1 });
                setObjectiveOpen(true);
              }}
              disabled={map.perspectives.length === 0}
            >
              <Plus className="mr-2 h-4 w-4" />
              Objetivo
            </Button>
          </>
        }
      />

      <Link href="/strategy" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Voltar
      </Link>

      <div className="space-y-5">
        {map.perspectives.map((p) => (
          <SectionCard key={p.id} title={p.name} description={`${(byPersp.get(p.id) ?? []).length} objetivo(s)`}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(byPersp.get(p.id) ?? []).map((o) => (
                <div
                  key={o.id}
                  className={cn(
                    'rounded-lg border p-4',
                    o.aggregateLight === 'RED' && 'border-status-red/40',
                    o.aggregateLight === 'YELLOW' && 'border-status-yellow/40',
                    o.aggregateLight === 'GREEN' && 'border-status-green/40',
                  )}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold leading-snug">{o.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">peso {o.weight} - prioridade {o.priority}</div>
                    </div>
                    <StatusBadge value={o.aggregateLight} label={o.aggregateLight === 'GRAY' ? 'Sem dados' : o.aggregateLight} />
                  </div>
                  {o.description && <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{o.description}</p>}
                  <div className="mb-3 flex flex-wrap gap-1">
                    {o.indicators.map((indicator) => (
                      <Badge key={indicator.id} variant="secondary">{indicator.code ?? 'IND'} - {indicator.name}</Badge>
                    ))}
                    {o.indicators.length === 0 && <span className="text-xs text-muted-foreground">Sem indicadores vinculados.</span>}
                  </div>
                  <div className="mb-3 text-xs text-muted-foreground">
                    Atingimento agregado: {formatPercent(o.aggregateAttainment)}
                  </div>
                  <NativeSelect
                    className="mb-2 h-8 text-xs"
                    value={o.status}
                    onChange={(e) => updateObjective.mutate({ objId: o.id, patch: { status: e.target.value } })}
                  >
                    {Object.entries(STATUS_LABEL).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </NativeSelect>
                  <div className="grid grid-cols-[1fr,auto] gap-2">
                    <NativeSelect value={attachment[o.id] ?? ''} onChange={(e) => setAttachment({ ...attachment, [o.id]: e.target.value })} className="h-8 text-xs">
                      <option value="">Vincular indicador</option>
                      {indicators.data?.map((indicator) => (
                        <option key={indicator.id} value={indicator.id}>{indicator.code ? `${indicator.code} - ` : ''}{indicator.name}</option>
                      ))}
                    </NativeSelect>
                    <Button size="sm" variant="outline" disabled={!attachment[o.id]} onClick={() => attachIndicator.mutate({ objId: o.id, indicatorId: attachment[o.id] })}>
                      <Target className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr,auto] gap-2">
                    <NativeSelect value={relation[o.id] ?? ''} onChange={(e) => setRelation({ ...relation, [o.id]: e.target.value })} className="h-8 text-xs">
                      <option value="">Relacionar com...</option>
                      {map.objectives.filter((target) => target.id !== o.id).map((target) => (
                        <option key={target.id} value={target.id}>{target.name}</option>
                      ))}
                    </NativeSelect>
                    <Button size="sm" variant="outline" disabled={!relation[o.id]} onClick={() => addRelation.mutate({ fromId: o.id, toId: relation[o.id] })}>
                      <GitBranch className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        ))}
      </div>

      <Dialog open={perspectiveOpen} onOpenChange={setPerspectiveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova perspectiva</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <NativeSelect value={perspective.kind} onChange={(e) => setPerspective({ ...perspective, kind: e.target.value })}>
                {PERSPECTIVE_KIND.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={perspective.name} onChange={(e) => setPerspective({ ...perspective, name: e.target.value })} />
            </div>
            <div>
              <Label>Cor</Label>
              <Input type="color" value={perspective.color} onChange={(e) => setPerspective({ ...perspective, color: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPerspectiveOpen(false)}>Cancelar</Button>
            <Button onClick={() => createPerspective.mutate()} disabled={!perspective.name || createPerspective.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={objectiveOpen} onOpenChange={setObjectiveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo objetivo estrategico</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Perspectiva</Label>
              <NativeSelect value={objective.perspectiveId} onChange={(e) => setObjective({ ...objective, perspectiveId: e.target.value })}>
                {map.perspectives.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={objective.name} onChange={(e) => setObjective({ ...objective, name: e.target.value })} />
            </div>
            <div>
              <Label>Descricao</Label>
              <Textarea value={objective.description} onChange={(e) => setObjective({ ...objective, description: e.target.value })} />
            </div>
            <div>
              <Label>Peso</Label>
              <Input type="number" value={objective.weight} onChange={(e) => setObjective({ ...objective, weight: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setObjectiveOpen(false)}>Cancelar</Button>
            <Button onClick={() => createObjective.mutate()} disabled={!objective.name || !objective.perspectiveId || createObjective.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Criar objetivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
