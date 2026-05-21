'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft, Plus, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface MeetingDetail {
  id: string;
  title: string;
  kind: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  notes: string | null;
  participants: { id: string; userId: string; attended: boolean; user: { id: string; name: string; email: string } }[];
  agendaItems: { id: string; topic: string; notes: string | null; position: number }[];
  decisions: { id: string; decision: string; owner: string | null; dueDate: string | null }[];
}

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const query = useQuery<MeetingDetail>({
    queryKey: ['meeting', id],
    queryFn: () => api<MeetingDetail>(`/meetings/${id}`),
  });

  const [agendaTopic, setAgendaTopic] = useState('');
  const [decision, setDecision] = useState({ decision: '', owner: '', dueDate: '' });
  const [actionForm, setActionForm] = useState({ title: '', dueDate: '' });

  const addAgenda = useMutation({
    mutationFn: () => api(`/meetings/${id}/agenda`, { method: 'POST', json: { topic: agendaTopic } }),
    onSuccess: () => {
      setAgendaTopic('');
      qc.invalidateQueries({ queryKey: ['meeting', id] });
    },
  });
  const addDecision = useMutation({
    mutationFn: () => api(`/meetings/${id}/decisions`, { method: 'POST', json: decision }),
    onSuccess: () => {
      setDecision({ decision: '', owner: '', dueDate: '' });
      qc.invalidateQueries({ queryKey: ['meeting', id] });
    },
  });
  const generateAction = useMutation({
    mutationFn: () => api(`/meetings/${id}/actions`, { method: 'POST', json: actionForm }),
    onSuccess: () => {
      toast.success('Acao gerada e disponivel em Planos de Acao');
      setActionForm({ title: '', dueDate: '' });
    },
  });
  const attendance = useMutation({
    mutationFn: ({ userId, attended }: { userId: string; attended: boolean }) =>
      api(`/meetings/${id}/participants/${userId}`, { method: 'PATCH', json: { attended } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meeting', id] }),
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!query.data) return null;
  const m = query.data;

  return (
    <div>
      <Link href="/meetings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Reunioes
      </Link>
      <PageHeader title={m.title} description={`${formatDate(m.startsAt)}${m.location ? ' - ' + m.location : ''}`} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pauta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Adicionar item de pauta..."
                value={agendaTopic}
                onChange={(e) => setAgendaTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && agendaTopic && addAgenda.mutate()}
              />
              <Button onClick={() => addAgenda.mutate()} disabled={!agendaTopic}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {m.agendaItems.length === 0 && (
              <p className="text-xs text-muted-foreground py-3 text-center">Sem itens de pauta.</p>
            )}
            <ol className="space-y-1.5">
              {m.agendaItems.map((a, i) => (
                <li key={a.id} className="flex gap-3 rounded-md border p-2 text-sm">
                  <span className="text-muted-foreground w-6">{i + 1}.</span>
                  <span>{a.topic}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Participantes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {m.participants.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum participante registrado.</p>
            )}
            {m.participants.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={p.attended}
                  onChange={(e) => attendance.mutate({ userId: p.userId, attended: e.target.checked })}
                />
                <span className="flex-1 truncate">{p.user.name}</span>
                {p.attended && <Badge variant="secondary" className="text-[10px]">Presente</Badge>}
              </label>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Decisoes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr,160px,160px,auto] gap-2">
            <Input
              placeholder="Decisao..."
              value={decision.decision}
              onChange={(e) => setDecision({ ...decision, decision: e.target.value })}
            />
            <Input
              placeholder="Responsavel"
              value={decision.owner}
              onChange={(e) => setDecision({ ...decision, owner: e.target.value })}
            />
            <Input
              type="date"
              value={decision.dueDate}
              onChange={(e) => setDecision({ ...decision, dueDate: e.target.value })}
            />
            <Button onClick={() => addDecision.mutate()} disabled={!decision.decision}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {m.decisions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhuma decisao registrada.</p>
          )}
          {m.decisions.map((d) => (
            <div key={d.id} className="rounded-md border p-2 text-sm flex items-center justify-between">
              <span className="flex-1">{d.decision}</span>
              <span className="text-xs text-muted-foreground">
                {d.owner ?? '—'} {d.dueDate && `- ${formatDate(d.dueDate)}`}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Gerar acao a partir da reuniao</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr,160px,auto] gap-2">
            <Input
              placeholder="Titulo da acao"
              value={actionForm.title}
              onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })}
            />
            <Input
              type="date"
              value={actionForm.dueDate}
              onChange={(e) => setActionForm({ ...actionForm, dueDate: e.target.value })}
            />
            <Button onClick={() => generateAction.mutate()} disabled={!actionForm.title || generateAction.isPending}>
              <ChevronRight className="h-4 w-4 mr-2" /> Gerar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            A acao sera criada com origem MEETING e podera ser acompanhada em /actions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
