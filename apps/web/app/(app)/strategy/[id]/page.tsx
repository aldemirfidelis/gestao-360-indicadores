'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft, Plus, Target } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusLight } from '@/components/ui/status-light';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';

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

const STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Planejado',
  ON_TRACK: 'No prazo',
  AT_RISK: 'Em risco',
  OFF_TRACK: 'Atrasado',
  DONE: 'Concluido',
  CANCELLED: 'Cancelado',
};

export default function StrategyMapPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [perspectiveId, setPerspectiveId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const query = useQuery<StrategicMap>({
    queryKey: ['strategy', 'map', id],
    queryFn: () => api<StrategicMap>(`/strategy/maps/${id}`),
  });

  const create = useMutation({
    mutationFn: () =>
      api(`/strategy/maps/${id}/objectives`, {
        method: 'POST',
        json: { perspectiveId, name, description },
      }),
    onSuccess: () => {
      toast.success('Objetivo criado');
      setAddOpen(false);
      setName('');
      setDescription('');
      qc.invalidateQueries({ queryKey: ['strategy', 'map', id] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao criar'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ objId, status }: { objId: string; status: string }) =>
      api(`/strategy/objectives/${objId}`, { method: 'PATCH', json: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategy', 'map', id] }),
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!query.data) return null;
  const map = query.data;

  const byPersp = new Map<string, Objective[]>();
  map.perspectives.forEach((p) => byPersp.set(p.id, []));
  map.objectives.forEach((o) => {
    if (!byPersp.has(o.perspectiveId)) byPersp.set(o.perspectiveId, []);
    byPersp.get(o.perspectiveId)!.push(o);
  });

  return (
    <div>
      <Link href="/strategy" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Mapas estrategicos
      </Link>
      <PageHeader
        title={map.name}
        description="Objetivos organizados por perspectiva, com vinculo a indicadores e status agregado."
        actions={
          <Button
            onClick={() => {
              setPerspectiveId(map.perspectives[0]?.id ?? '');
              setAddOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo objetivo
          </Button>
        }
      />

      <div className="space-y-4">
        {map.perspectives.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: p.color ?? 'currentColor' }}
                />
                <h2 className="font-semibold">{p.name}</h2>
                <Badge variant="outline">{(byPersp.get(p.id) ?? []).length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(byPersp.get(p.id) ?? []).map((o) => (
                  <div
                    key={o.id}
                    className={cn(
                      'rounded-lg border p-3 hover:shadow-md transition-shadow',
                      o.aggregateLight === 'RED' && 'border-status-red/40',
                      o.aggregateLight === 'YELLOW' && 'border-status-yellow/40',
                      o.aggregateLight === 'GREEN' && 'border-status-green/40',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="font-medium text-sm leading-snug">{o.name}</div>
                      <StatusLight light={o.aggregateLight} />
                    </div>
                    {o.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{o.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
                      <Target className="h-3 w-3" />
                      {o.indicators.length} indicador(es) - peso {o.weight}
                    </div>
                    {(o.outRelations.length > 0 || o.inRelations.length > 0) && (
                      <div className="text-[10px] text-muted-foreground space-y-0.5 mb-2">
                        {o.outRelations.map((r) => (
                          <div key={r.id}>{'-> '}{r.to.name}</div>
                        ))}
                        {o.inRelations.map((r) => (
                          <div key={r.id}>{'<- '}{r.from.name}</div>
                        ))}
                      </div>
                    )}
                    <NativeSelect
                      className="h-7 text-xs"
                      value={o.status}
                      onChange={(e) => updateStatus.mutate({ objId: o.id, status: e.target.value })}
                    >
                      {Object.entries(STATUS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                ))}
                {(byPersp.get(p.id) ?? []).length === 0 && (
                  <div className="text-xs text-muted-foreground py-2">Sem objetivos nesta perspectiva.</div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo objetivo estrategico</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Perspectiva</Label>
              <NativeSelect value={perspectiveId} onChange={(e) => setPerspectiveId(e.target.value)}>
                {map.perspectives.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Descricao</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
