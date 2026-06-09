'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trophy, Copy, Archive } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

interface Program {
  id: string;
  code: string;
  name: string;
  description: string | null;
  periodicity: string;
  currency: string;
  status: string;
  _count: { competences: number; annexes: number; indicators: number; versions: number };
}

const STATUS: Record<string, { label: string; variant: any }> = {
  DRAFT: { label: 'Rascunho', variant: 'secondary' },
  ACTIVE: { label: 'Ativo', variant: 'default' },
  INACTIVE: { label: 'Inativo', variant: 'outline' },
  ARCHIVED: { label: 'Arquivado', variant: 'outline' },
};
const PERIODICITY: Record<string, string> = {
  MONTHLY: 'Mensal', WEEKLY: 'Semanal', DAILY: 'Diário', QUARTERLY: 'Trimestral', SEMIANNUAL: 'Semestral', ANNUAL: 'Anual',
};

const emptyForm = { code: '', name: '', description: '', periodicity: 'MONTHLY', currency: 'BRL', status: 'DRAFT', roundingRule: 'HALF_UP_2', defaultRubric: '' };

export default function PrizeProgramsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['prize:programs:manage']);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['prize-programs'],
    queryFn: () => api<Program[]>('/prize/programs'),
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form };
      return editing
        ? api(`/prize/programs/${editing.id}`, { method: 'PATCH', json: payload })
        : api('/prize/programs', { method: 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success(editing ? 'Programa atualizado' : 'Programa criado');
      qc.invalidateQueries({ queryKey: ['prize-programs'] });
      setOpen(false);
    },
    onError: (e: ApiError) => toast.error(e.message || 'Erro ao salvar'),
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => api(`/prize/programs/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => { toast.success('Programa duplicado'); qc.invalidateQueries({ queryKey: ['prize-programs'] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(`/prize/programs/${id}/status`, { method: 'PATCH', json: { status } }),
    onSuccess: () => { toast.success('Status atualizado'); qc.invalidateQueries({ queryKey: ['prize-programs'] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  function openCreate() { setEditing(null); setForm(emptyForm); setOpen(true); }
  function openEdit(p: Program) {
    setEditing(p);
    setForm({ ...emptyForm, code: p.code, name: p.name, description: p.description ?? '', periodicity: p.periodicity, currency: p.currency, status: p.status });
    setOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Programas de Prêmio"
        eyebrow="Gestão de Prêmio"
        description="Cadastro dos programas de remuneração variável: regras gerais, periodicidade, prazos e responsáveis."
        tone="view"
        breadcrumbs={[{ label: 'Gestão de Prêmio', href: '/gestao-premio' }, { label: 'Programas' }]}
        actions={canManage ? <Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" />Novo programa</Button> : undefined}
      />

      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : programs.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Trophy className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nenhum programa de prêmio cadastrado.</p>
          {canManage && <Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" />Criar primeiro programa</Button>}
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((p) => (
            <Card key={p.id} className="transition-shadow hover:shadow-sm">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">{p.code}</span>
                      <Badge variant={STATUS[p.status]?.variant}>{STATUS[p.status]?.label ?? p.status}</Badge>
                    </div>
                    <h3 className="mt-1 truncate font-medium">{p.name}</h3>
                  </div>
                </div>
                {p.description && <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{PERIODICITY[p.periodicity] ?? p.periodicity}</span>
                  <span>{p._count.annexes} anexo(s)</span>
                  <span>{p._count.competences} competência(s)</span>
                  <span>{p._count.indicators} indicador(es)</span>
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(p)}>Editar</Button>
                    {p.status !== 'ACTIVE' && <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: p.id, status: 'ACTIVE' })}>Ativar</Button>}
                    {p.status === 'ACTIVE' && <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: p.id, status: 'INACTIVE' })}>Inativar</Button>}
                    <Button size="sm" variant="ghost" onClick={() => duplicate.mutate(p.id)}><Copy className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: p.id, status: 'ARCHIVED' })}><Archive className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar programa' : 'Novo programa de prêmio'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="auto (PRG-001)" /></div>
              <div><Label>Periodicidade</Label>
                <NativeSelect value={form.periodicity} onChange={(e) => setForm({ ...form, periodicity: e.target.value })}>
                  {Object.entries(PERIODICITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </NativeSelect>
              </div>
            </div>
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Prêmio por Resultados — Operação" /></div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Moeda</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
              <div><Label>Arredondamento</Label>
                <NativeSelect value={form.roundingRule} onChange={(e) => setForm({ ...form, roundingRule: e.target.value })}>
                  <option value="HALF_UP_2">2 casas (½ acima)</option>
                  <option value="FLOOR_2">2 casas (truncar)</option>
                  <option value="HALF_UP_0">Inteiro</option>
                </NativeSelect>
              </div>
              <div><Label>Rubrica padrão</Label><Input value={form.defaultRubric} onChange={(e) => setForm({ ...form, defaultRubric: e.target.value })} placeholder="Ex.: 1234" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>{save.isPending ? 'Salvando…' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
