'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, Copy, Edit3, Map, Plus, Save, Trash2 } from 'lucide-react';
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
import { useAuth } from '@/components/auth/auth-provider';
import { cn, formatDate, formatNumber } from '@/lib/utils';

interface StrategicMap {
  id: string;
  name: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
  _count?: { perspectives: number; objectives: number; versions: number };
}

const defaultPerspectives = [
  { name: 'Financeira', color: '#16a34a', icon: 'F', description: 'Resultados economicos e sustentabilidade financeira.' },
  { name: 'Clientes', color: '#2563eb', icon: 'C', description: 'Valor percebido, mercado, relacionamento e satisfação.' },
  { name: 'Processos Internos', color: '#f59e0b', icon: 'P', description: 'Excelência operacional, qualidade, produtividade e segurança.' },
  { name: 'Pessoas e Aprendizado', color: '#7c3aed', icon: 'A', description: 'Capacidades, cultura, inovação e desenvolvimento.' },
];

export default function StrategyPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['strategy:maps:create', 'strategy:manage']);
  const canUpdate = hasPermission(['strategy:maps:update', 'strategy:manage']);
  const canDelete = hasPermission(['strategy:maps:delete', 'strategy:manage']);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StrategicMap | null>(null);
  const [form, setForm] = useState(defaultForm());

  const query = useQuery<StrategicMap[]>({
    queryKey: ['strategy', 'maps'],
    queryFn: () => api<StrategicMap[]>('/strategy/maps?includeInactive=true'),
  });

  const create = useMutation({
    mutationFn: async () => {
      const map = await api<{ id: string }>('/strategy/maps', {
        method: 'POST',
        json: { name: form.name, description: form.description, startsAt: form.startsAt, endsAt: form.endsAt },
      });
      if (form.withDefaults) {
        await Promise.all(defaultPerspectives.map((p) => api(`/strategy/maps/${map.id}/perspectives`, { method: 'POST', json: p })));
      }
      return map;
    },
    onSuccess: () => {
      toast.success('Mapa estratégico criado');
      closeDialog();
      qc.invalidateQueries({ queryKey: ['strategy', 'maps'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao criar mapa'),
  });

  const update = useMutation({
    mutationFn: () => api(`/strategy/maps/${editing?.id}`, { method: 'PATCH', json: form }),
    onSuccess: () => {
      toast.success('Mapa atualizado');
      closeDialog();
      qc.invalidateQueries({ queryKey: ['strategy', 'maps'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao atualizar mapa'),
  });

  const remove = useMutation({
    mutationFn: (mapId: string) => api(`/strategy/maps/${mapId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Mapa inativado');
      qc.invalidateQueries({ queryKey: ['strategy', 'maps'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao inativar mapa'),
  });

  const duplicate = useMutation({
    mutationFn: (mapId: string) => api(`/strategy/maps/${mapId}/duplicate`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Mapa duplicado');
      qc.invalidateQueries({ queryKey: ['strategy', 'maps'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao duplicar mapa'),
  });

  const maps = query.data ?? [];
  const active = maps.filter((m) => m.active).length;
  const objectives = maps.reduce((sum, item) => sum + (item._count?.objectives ?? 0), 0);
  const versions = maps.reduce((sum, item) => sum + (item._count?.versions ?? 0), 0);

  function openCreate() {
    setEditing(null);
    setForm(defaultForm());
    setOpen(true);
  }

  function openEdit(map: StrategicMap) {
    setEditing(map);
    setForm({
      name: map.name,
      description: map.description ?? '',
      startsAt: map.startsAt.slice(0, 10),
      endsAt: map.endsAt.slice(0, 10),
      withDefaults: false,
    });
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setEditing(null);
    setForm(defaultForm());
  }

  return (
    <div>
      <PageHeader
        eyebrow="Estratégia"
        tone="view"
        title="Mapa Estratégico"
        description="Crie, publique e mantenha mapas estratégicos editaveis conectados a Arvore Organizacional e aos indicadores."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Visualização', href: '/visualization' }, { label: 'Mapa Estratégico' }]}
        actions={
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Novo mapa
            </Button>
          ) : null
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <MetricCard compact title="Mapas" value={formatNumber(maps.length)} description="Ciclos cadastrados" icon={<Map className="h-4 w-4" />} tone="blue" />
        <MetricCard compact title="Ativos" value={formatNumber(active)} description="Em acompanhamento" icon={<Map className="h-4 w-4" />} tone="green" />
        <MetricCard compact title="Objetivos" value={formatNumber(objectives)} description="Conectados ao desempenho" icon={<CalendarDays className="h-4 w-4" />} tone="purple" />
        <MetricCard compact title="Versões" value={formatNumber(versions)} description="Histórico publicado" icon={<CalendarDays className="h-4 w-4" />} tone="yellow" />
      </div>

      <SectionCard title="Mapas cadastrados" description="Abra um mapa para editar perspectivas, objetivos, ligacoes e vínculos com indicadores." contentClassName="space-y-3">
        {maps.map((m) => (
          <div key={m.id} className={cn('rounded-lg border bg-card p-4', !m.active && 'opacity-60')}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Link href={`/strategy/${m.id}`} className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Map className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(m.startsAt)} - {formatDate(m.endsAt)}</div>
                  </div>
                  <Badge variant={m.active ? 'default' : 'secondary'}>{m.active ? 'Ativo' : 'Inativo'}</Badge>
                </div>
                {m.description && <p className="line-clamp-2 text-sm text-muted-foreground">{m.description}</p>}
              </Link>
              <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground sm:w-[260px]">
                <div className="rounded-md border p-2"><strong className="block text-sm text-foreground">{m._count?.perspectives ?? 0}</strong>persp.</div>
                <div className="rounded-md border p-2"><strong className="block text-sm text-foreground">{m._count?.objectives ?? 0}</strong>objetivos</div>
                <div className="rounded-md border p-2"><strong className="block text-sm text-foreground">{m._count?.versions ?? 0}</strong>versões</div>
              </div>
              <div className="flex gap-2">
                {canUpdate && (
                  <Button variant="outline" size="sm" onClick={() => openEdit(m)} title="Editar mapa">
                    <Edit3 className="h-4 w-4" />
                  </Button>
                )}
                {canCreate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => duplicate.mutate(m.id)}
                    disabled={duplicate.isPending}
                    title="Duplicar mapa (cria uma cópia com a mesma estrutura)"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
                {canDelete && (
                  <Button variant="outline" size="sm" onClick={() => window.confirm('Inativar este mapa estratégico?') && remove.mutate(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
        {!query.isLoading && maps.length === 0 && (
          <EmptyState title="Nenhum mapa estratégico" description="Crie o primeiro mapa para organizar perspectivas, objetivos, indicadores e relações." />
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar mapa estratégico' : 'Novo mapa estratégico'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Mapa Estratégico 2026" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
              </div>
            </div>
            {!editing && (
              <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.withDefaults}
                  onChange={(e) => setForm({ ...form, withDefaults: e.target.checked })}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">Criar estrutura inicial editavel</span>
                  <span className="text-xs text-muted-foreground">Financeira, Clientes, Processos Internos, Pessoas e Aprendizado.</span>
                </span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => (editing ? update.mutate() : create.mutate())} disabled={!form.name.trim() || create.isPending || update.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {editing ? 'Salvar mapa' : 'Criar mapa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function defaultForm() {
  return {
    name: '',
    description: '',
    startsAt: new Date().toISOString().slice(0, 10),
    endsAt: `${new Date().getFullYear()}-12-31`,
    withDefaults: true,
  };
}
