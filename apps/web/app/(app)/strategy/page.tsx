'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, Map, Plus, Save } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { EmptyState } from '@/components/platform/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/utils';

interface StrategicMap {
  id: string;
  name: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

const defaultPerspectives = [
  { kind: 'CUSTOM', name: 'Valores', color: '#164e63' },
  { kind: 'CUSTOM', name: 'Diretrizes', color: '#0f766e' },
  { kind: 'CUSTOM', name: 'Pilares', color: '#7c3aed' },
  { kind: 'CUSTOM', name: 'Indicadores', color: '#ca8a04' },
];

export default function StrategyPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    startsAt: new Date().toISOString().slice(0, 10),
    endsAt: `${new Date().getFullYear()}-12-31`,
    withDefaults: true,
  });

  const query = useQuery<StrategicMap[]>({
    queryKey: ['strategy', 'maps'],
    queryFn: () => api<StrategicMap[]>('/strategy/maps'),
  });

  const create = useMutation({
    mutationFn: async () => {
      const map = await api<{ id: string }>('/strategy/maps', {
        method: 'POST',
        json: { name: form.name, startsAt: form.startsAt, endsAt: form.endsAt },
      });
      if (form.withDefaults) {
        await Promise.all(
          defaultPerspectives.map((p) =>
            api(`/strategy/maps/${map.id}/perspectives`, { method: 'POST', json: p }),
          ),
        );
      }
      return map;
    },
    onSuccess: () => {
      toast.success('Mapa estrategico criado');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['strategy', 'maps'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao criar mapa'),
  });

  const active = query.data?.filter((m) => m.active).length ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Visualizacao"
        tone="view"
        title="Mapa Estrategico"
        description="Crie mapas por ciclo, organize perspectivas, objetivos, pilares e indicadores vinculados."
        breadcrumbs={[{ label: 'Inicio', href: '/' }, { label: 'Visualizacao', href: '/visualization' }, { label: 'Mapa Estrategico' }]}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo mapa
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard title="Mapas" value={formatNumber(query.data?.length)} description="Ciclos estrategicos" icon={<Map className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Ativos" value={formatNumber(active)} description="Em acompanhamento" icon={<Map className="h-4 w-4" />} tone="green" />
        <MetricCard title="Periodo atual" value={new Date().getFullYear()} description="Planejamento corporativo" icon={<CalendarDays className="h-4 w-4" />} tone="purple" />
      </div>

      <SectionCard title="Mapas cadastrados" description="Selecione um mapa para editar perspectivas, objetivos e vinculos." contentClassName="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {query.data?.map((m) => (
          <Link key={m.id} href={`/strategy/${m.id}`} className="panel panel-hover block p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Map className="h-5 w-5" />
              </div>
              {m.active && <Badge>Ativo</Badge>}
            </div>
            <div className="font-semibold">{m.name}</div>
            {m.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>}
            <div className="mt-3 text-xs text-muted-foreground">
              {formatDate(m.startsAt)} - {formatDate(m.endsAt)}
            </div>
          </Link>
        ))}
        {!query.isLoading && query.data?.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState title="Nenhum mapa estrategico" description="Crie o primeiro mapa para organizar diretrizes, pilares e indicadores." />
          </div>
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo mapa estrategico</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Mapa Estrategico 2026" />
            </div>
            <div>
              <Label>Descricao</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Inicio</Label>
                <Input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                checked={form.withDefaults}
                onChange={(e) => setForm({ ...form, withDefaults: e.target.checked })}
                className="mt-1"
              />
              <span>
                <span className="block font-medium">Criar estrutura inicial</span>
                <span className="text-xs text-muted-foreground">Valores, Diretrizes, Pilares e Indicadores.</span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Criar mapa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
