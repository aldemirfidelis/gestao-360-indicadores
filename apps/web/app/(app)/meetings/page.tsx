'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Calendar, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Meeting {
  id: string;
  title: string;
  kind: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  _count: { participants: number; agendaItems: number; decisions: number };
}

const KIND_LABEL: Record<string, string> = {
  INDICATORS: 'Indicadores',
  BOARD: 'Diretoria',
  SECTOR: 'Setor',
  PROJECT: 'Projeto',
  DEVIATION: 'Desvio',
};

export default function MeetingsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    kind: 'INDICATORS',
    startsAt: new Date().toISOString().slice(0, 16),
    location: '',
  });

  const query = useQuery<Meeting[]>({
    queryKey: ['meetings'],
    queryFn: () => api<Meeting[]>('/meetings'),
  });

  const create = useMutation({
    mutationFn: () => api('/meetings', { method: 'POST', json: form }),
    onSuccess: () => {
      toast.success('Reunião criada');
      setOpen(false);
      setForm({ title: '', kind: 'INDICATORS', startsAt: new Date().toISOString().slice(0, 16), location: '' });
      qc.invalidateQueries({ queryKey: ['meetings'] });
    },
  });

  return (
    <div>
      <PageHeader
        title="Reuniões de Gestão"
        description="Pauta, decisões e ações geradas em cada encontro."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova reunião
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {query.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {query.data?.map((m) => (
          <Link key={m.id} href={`/meetings/${m.id}`}>
            <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <Badge variant="secondary">{KIND_LABEL[m.kind] ?? m.kind}</Badge>
                </div>
                <h3 className="font-semibold">{m.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(m.startsAt)} {m.location ? ` - ${m.location}` : ''}
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mt-3">
                  <div>
                    <div className="text-[10px] uppercase">Participantes</div>
                    <div className="text-foreground">{m._count.participants}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase">Pauta</div>
                    <div className="text-foreground">{m._count.agendaItems}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase">Decisões</div>
                    <div className="text-foreground">{m._count.decisions}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!query.isLoading && query.data?.length === 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma reunião registrada.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova reunião</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Tipo</Label>
              <NativeSelect value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {Object.entries(KIND_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Data e hora</Label>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </div>
            <div>
              <Label>Local (opcional)</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={!form.title || create.isPending}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
