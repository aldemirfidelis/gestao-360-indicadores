'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  Mail,
  Plus,
  Send,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { StatusBadge } from '@/components/platform/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber, periodRefLabel } from '@/lib/utils';

interface MeetingDetail {
  id: string;
  title: string;
  kind: string;
  format: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  objective: string | null;
  notes: string | null;
  indicator: {
    id: string;
    name: string;
    code: string | null;
    ownerNode: { id: string; name: string };
    responsibleUser: { id: string; name: string; email: string | null; jobTitle: string | null } | null;
    targets: { periodRef: string; target: number }[];
  } | null;
  deviation: { id: string; number: number; title: string; status: string; severity: string } | null;
  analysis: { id: string; method: string; content: string } | null;
  treatment: {
    id: string;
    periodRef: string;
    status: string;
    result: { id: string; value: number; deviationPct: number | null; light: string } | null;
  } | null;
  participants: {
    id: string;
    userId: string;
    attended: boolean;
    role: string;
    notes: string | null;
    user: { id: string; name: string; email: string | null };
  }[];
  guests: {
    id: string;
    name: string;
    email: string;
    jobTitle: string | null;
    area: string | null;
    role: string;
    confirmed: boolean;
    notes: string | null;
  }[];
  agendaItems: { id: string; topic: string; notes: string | null; position: number }[];
  decisions: { id: string; decision: string; owner: string | null; dueDate: string | null }[];
  actions: {
    id: string;
    title: string;
    status: string;
    priority: string;
    progress: number;
    dueDate: string | null;
    responsibleEmail: string | null;
    responsibleUser: { id: string; name: string; email: string | null } | null;
  }[];
  emailLogs: { id: string; recipientName: string | null; recipientEmail: string; status: string; errorMessage: string | null; attempts: number; createdAt: string; sentAt: string | null }[];
  calendarInvites: { id: string; uid: string; createdAt: string }[];
}

const statusLabels: Record<string, string> = {
  SCHEDULED: 'Agendada',
  COMPLETED: 'Concluida',
  CANCELLED: 'Cancelada',
  NOT_STARTED: 'Nao iniciada',
  IN_PROGRESS: 'Em andamento',
  WAITING_THIRD: 'Aguardando terceiros',
  PAUSED: 'Pausada',
  DONE: 'Concluida',
  DONE_LATE: 'Concluida fora do prazo',
  CRITICAL: 'Critica',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baixa',
};

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [agendaTopic, setAgendaTopic] = useState('');
  const [decision, setDecision] = useState({ decision: '', owner: '', dueDate: '' });
  const [guest, setGuest] = useState({ name: '', email: '', jobTitle: '', area: '', role: 'PARTICIPANT', notes: '' });
  const [actionForm, setActionForm] = useState({
    title: '',
    description: '',
    responsibleEmail: '',
    dueDate: '',
    priority: 'HIGH',
    expectedResult: '',
    evidenceRequired: true,
  });

  const query = useQuery<MeetingDetail>({
    queryKey: ['meeting', id],
    queryFn: () => api<MeetingDetail>(`/meetings/${id}`),
  });

  const m = query.data;
  const target = useMemo(() => {
    if (!m?.indicator || !m.treatment) return null;
    return m.indicator.targets.find((item) => item.periodRef === m.treatment?.periodRef)?.target ?? null;
  }, [m]);

  const summary = useMemo(() => {
    const actions = m?.actions ?? [];
    const today = new Date();
    return {
      total: actions.length,
      pending: actions.filter((a) => a.status === 'NOT_STARTED').length,
      progress: actions.filter((a) => ['IN_PROGRESS', 'WAITING_THIRD', 'PAUSED'].includes(a.status)).length,
      overdue: actions.filter((a) => a.dueDate && new Date(a.dueDate) < today && !['DONE', 'DONE_LATE', 'CANCELLED'].includes(a.status)).length,
      done: actions.filter((a) => ['DONE', 'DONE_LATE'].includes(a.status)).length,
    };
  }, [m]);

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
      toast.success('Decisao registrada');
      setDecision({ decision: '', owner: '', dueDate: '' });
      qc.invalidateQueries({ queryKey: ['meeting', id] });
    },
  });

  const addGuest = useMutation({
    mutationFn: () => api(`/meetings/${id}/guests`, { method: 'POST', json: guest }),
    onSuccess: () => {
      toast.success('Participante adicionado');
      setGuest({ name: '', email: '', jobTitle: '', area: '', role: 'PARTICIPANT', notes: '' });
      qc.invalidateQueries({ queryKey: ['meeting', id] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel adicionar participante'),
  });

  const generateAction = useMutation({
    mutationFn: () => api(`/meetings/${id}/actions`, { method: 'POST', json: actionForm }),
    onSuccess: () => {
      toast.success('Acao criada e vinculada a reuniao');
      setActionForm({ title: '', description: '', responsibleEmail: '', dueDate: '', priority: 'HIGH', expectedResult: '', evidenceRequired: true });
      qc.invalidateQueries({ queryKey: ['meeting', id] });
      qc.invalidateQueries({ queryKey: ['actions'] });
    },
  });

  const attendance = useMutation({
    mutationFn: ({ userId, attended }: { userId: string; attended: boolean }) =>
      api(`/meetings/${id}/participants/${userId}`, { method: 'PATCH', json: { attended } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meeting', id] }),
  });

  const sendInvites = useMutation({
    mutationFn: () => api<{ count: number }>(`/meetings/${id}/invitations/send`, { method: 'POST' }),
    onSuccess: (data) => {
      toast.success(`${data.count} convite(s) processado(s)`);
      qc.invalidateQueries({ queryKey: ['meeting', id] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel enviar convites'),
  });

  const completeMeeting = useMutation({
    mutationFn: () => api(`/meetings/${id}/complete`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Reuniao concluida');
      qc.invalidateQueries({ queryKey: ['meeting', id] });
    },
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Carregando reuniao...</p>;
  if (!m) return null;

  return (
    <div>
      <Link href="/meetings" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Reunioes
      </Link>

      <PageHeader
        eyebrow="Reuniao de tratativa"
        tone="view"
        title={m.title}
        description={`${formatDateTime(m.startsAt)}${m.location ? ` - ${m.location}` : ''}`}
        breadcrumbs={[{ label: 'Inicio', href: '/' }, { label: 'Reunioes', href: '/meetings' }, { label: 'Tratativa' }]}
        actions={
          <>
            {m.treatment && (
              <Button variant="outline" asChild>
                <Link href={`/treatments/${m.treatment.id}`}>Fluxo guiado</Link>
              </Button>
            )}
            <Button variant="outline" onClick={() => sendInvites.mutate()} disabled={sendInvites.isPending}>
              <Send className="mr-2 h-4 w-4" />
              Enviar convite
            </Button>
            <Button onClick={() => completeMeeting.mutate()} disabled={completeMeeting.isPending || m.status === 'COMPLETED'}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Concluir
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Status" value={statusLabels[m.status] ?? m.status} description={formatLabel(m.format)} icon={<CalendarCheck2 className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Participantes" value={m.participants.length + m.guests.length} description={`${m.participants.filter((p) => p.attended).length} presenca(s) confirmadas`} icon={<Users className="h-4 w-4" />} tone="purple" />
        <MetricCard title="Acoes criadas" value={summary.total} description={`${summary.overdue} atrasada(s), ${summary.done} concluida(s)`} icon={<ClipboardList className="h-4 w-4" />} tone={summary.overdue ? 'red' : 'green'} />
        <MetricCard title="Convites" value={m.emailLogs.length} description={`${m.calendarInvites.length} arquivo(s) ICS`} icon={<Mail className="h-4 w-4" />} tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <SectionCard
          title="Indicador tratado"
          description="Contexto executivo da ocorrencia que gerou a reuniao."
          actions={m.treatment && <StatusBadge value={m.treatment.status} label={statusLabels[m.treatment.status] ?? m.treatment.status} />}
        >
          {m.indicator ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">Indicador</p>
                <Link href={`/indicators/${m.indicator.id}`} className="mt-1 block font-semibold hover:text-primary">
                  {m.indicator.name}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">{m.indicator.ownerNode.name}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">Meta x realizado</p>
                <div className="mt-1 text-sm">
                  Meta <strong>{formatNumber(target)}</strong> - Resultado <strong>{formatNumber(m.treatment?.result?.value)}</strong>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Desvio {m.treatment?.result?.deviationPct !== null && m.treatment?.result?.deviationPct !== undefined ? `${formatNumber(m.treatment.result.deviationPct)}%` : '-'}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">Responsavel</p>
                <div className="mt-1 font-semibold">{m.indicator.responsibleUser?.name ?? '-'}</div>
                <p className="mt-1 text-xs text-muted-foreground">{m.indicator.responsibleUser?.email ?? 'Sem e-mail cadastrado'}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Esta reuniao ainda nao possui indicador vinculado.</p>
          )}
        </SectionCard>

        <SectionCard title="Analise de causa" description="Resumo da causa registrada para a tratativa.">
          {m.analysis ? (
            <div className="space-y-3">
              <StatusBadge value={m.analysis.method} label={methodLabel(m.analysis.method)} tone="yellow" />
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{m.analysis.content}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma analise de causa vinculada.</p>
          )}
        </SectionCard>

        <SectionCard title="Pauta da reuniao" description="Itens para conduzir a discussao, decisao e plano de acao.">
          <div className="mb-3 flex gap-2">
            <Input
              placeholder="Adicionar item de pauta..."
              value={agendaTopic}
              onChange={(e) => setAgendaTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && agendaTopic && addAgenda.mutate()}
            />
            <Button onClick={() => addAgenda.mutate()} disabled={!agendaTopic || addAgenda.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ol className="space-y-2">
            {m.agendaItems.map((a, i) => (
              <li key={a.id} className="flex gap-3 rounded-lg border p-3 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs text-muted-foreground">{i + 1}</span>
                <span>{a.topic}</span>
              </li>
            ))}
          </ol>
          {m.agendaItems.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Sem itens de pauta.</p>}
        </SectionCard>

        <SectionCard title="Participantes" description="Participantes internos, convidados externos e presencas.">
          <div className="space-y-3">
            {m.participants.map((p) => (
              <label key={p.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={p.attended}
                  onChange={(e) => attendance.mutate({ userId: p.userId, attended: e.target.checked })}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.user.email ?? 'Sem e-mail'} - {roleLabel(p.role)}</span>
                </span>
                {p.attended && <StatusBadge value="DONE" label="Presente" />}
              </label>
            ))}
            {m.guests.map((g) => (
              <div key={g.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{g.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{g.email} - {roleLabel(g.role)}</div>
                  </div>
                  <StatusBadge value={g.confirmed ? 'DONE' : 'NOT_STARTED'} label={g.confirmed ? 'Confirmado' : 'Convidado'} />
                </div>
              </div>
            ))}

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-2 text-sm font-semibold">Adicionar participante externo</div>
              <div className="grid gap-2 md:grid-cols-2">
                <Input placeholder="Nome" value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} />
                <Input placeholder="E-mail" type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} />
                <Input placeholder="Cargo" value={guest.jobTitle} onChange={(e) => setGuest({ ...guest, jobTitle: e.target.value })} />
                <Input placeholder="Area" value={guest.area} onChange={(e) => setGuest({ ...guest, area: e.target.value })} />
                <NativeSelect value={guest.role} onChange={(e) => setGuest({ ...guest, role: e.target.value })}>
                  <option value="PARTICIPANT">Participante</option>
                  <option value="RESPONSIBLE">Responsavel</option>
                  <option value="APPROVER">Aprovador</option>
                  <option value="EXECUTOR">Executor</option>
                  <option value="GUEST">Convidado</option>
                </NativeSelect>
                <Button onClick={() => addGuest.mutate()} disabled={!guest.name || !guest.email || addGuest.isPending}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Decisoes e encaminhamentos" description="Registre as decisoes tomadas na reuniao.">
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px_160px_auto]">
            <Input placeholder="Decisao..." value={decision.decision} onChange={(e) => setDecision({ ...decision, decision: e.target.value })} />
            <Input placeholder="Responsavel" value={decision.owner} onChange={(e) => setDecision({ ...decision, owner: e.target.value })} />
            <Input type="date" value={decision.dueDate} onChange={(e) => setDecision({ ...decision, dueDate: e.target.value })} />
            <Button onClick={() => addDecision.mutate()} disabled={!decision.decision || addDecision.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {m.decisions.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <span className="flex-1">{d.decision}</span>
                <span className="text-xs text-muted-foreground">{d.owner ?? '-'} {d.dueDate ? `- ${formatDate(d.dueDate)}` : ''}</span>
              </div>
            ))}
            {m.decisions.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma decisao registrada.</p>}
          </div>
        </SectionCard>

        <SectionCard title="Plano de acao da reuniao" description="Acoes criadas aqui ficam vinculadas ao indicador, analise, reuniao e tratativa.">
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
            <ActionSummary label="Total" value={summary.total} />
            <ActionSummary label="Pendentes" value={summary.pending} />
            <ActionSummary label="Em andamento" value={summary.progress} />
            <ActionSummary label="Atrasadas" value={summary.overdue} danger />
            <ActionSummary label="Concluidas" value={summary.done} />
          </div>
          <div className="space-y-2">
            {m.actions.map((action) => (
              <Link key={action.id} href={`/actions/${action.id}`} className="block rounded-lg border p-3 hover:bg-accent/35">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{action.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {action.responsibleUser?.name ?? action.responsibleEmail ?? 'Sem responsavel'} - Prazo {formatDate(action.dueDate)}
                    </div>
                  </div>
                  <StatusBadge value={action.status} label={statusLabels[action.status] ?? action.status} />
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-4 space-y-2 rounded-lg border bg-muted/30 p-3">
            <Label>Nova acao</Label>
            <Input placeholder="Titulo da acao" value={actionForm.title} onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })} />
            <Textarea placeholder="Descricao" value={actionForm.description} onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })} />
            <div className="grid gap-2 md:grid-cols-3">
              <Input type="email" placeholder="E-mail do responsavel" value={actionForm.responsibleEmail} onChange={(e) => setActionForm({ ...actionForm, responsibleEmail: e.target.value })} />
              <Input type="date" value={actionForm.dueDate} onChange={(e) => setActionForm({ ...actionForm, dueDate: e.target.value })} />
              <NativeSelect value={actionForm.priority} onChange={(e) => setActionForm({ ...actionForm, priority: e.target.value })}>
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Critica</option>
              </NativeSelect>
            </div>
            <Input placeholder="Resultado esperado" value={actionForm.expectedResult} onChange={(e) => setActionForm({ ...actionForm, expectedResult: e.target.value })} />
            <Button onClick={() => generateAction.mutate()} disabled={!actionForm.title || generateAction.isPending}>
              Criar acao vinculada
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Convites e logs de e-mail" description="Cada envio fica registrado para auditoria e reenvio.">
          <div className="space-y-2">
            {m.emailLogs.map((log) => (
              <div key={log.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{log.recipientName ?? log.recipientEmail}</div>
                    <div className="truncate text-xs text-muted-foreground">{log.recipientEmail} - {formatDateTime(log.sentAt ?? log.createdAt)}</div>
                    {log.errorMessage && <div className="mt-1 text-xs text-status-red">{log.errorMessage}</div>}
                  </div>
                  <StatusBadge value={log.status} label={emailStatusLabel(log.status)} tone={log.status === 'SENT' ? 'green' : log.status === 'ERROR' ? 'red' : 'yellow'} />
                </div>
              </div>
            ))}
            {m.emailLogs.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Nenhum convite enviado ainda.</p>}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function ActionSummary({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className={cn('rounded-lg border p-3 text-center', danger && value > 0 ? 'border-status-red/30 bg-status-red/10 text-status-red' : 'bg-background')}>
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function methodLabel(value: string) {
  const labels: Record<string, string> = {
    FIVE_WHYS: '5 Porques',
    ISHIKAWA: 'Ishikawa',
    PARETO: 'Pareto',
    PDCA: 'PDCA',
    MASP: 'MASP',
    DMAIC: 'DMAIC',
    FCA: 'FCA',
    CAPA: 'CAPA',
    SIMPLE: 'Analise simples',
  };
  return labels[value] ?? value;
}

function roleLabel(value: string) {
  const labels: Record<string, string> = {
    RESPONSIBLE: 'Responsavel',
    PARTICIPANT: 'Participante',
    APPROVER: 'Aprovador',
    EXECUTOR: 'Executor',
    GUEST: 'Convidado',
  };
  return labels[value] ?? value;
}

function formatLabel(value: string) {
  const labels: Record<string, string> = {
    ONLINE: 'Online',
    PRESENTIAL: 'Presencial',
    HYBRID: 'Hibrida',
  };
  return labels[value] ?? value;
}

function emailStatusLabel(value: string) {
  const labels: Record<string, string> = {
    SENT: 'Enviado',
    ERROR: 'Erro',
    PENDING: 'Pendente',
  };
  return labels[value] ?? value;
}
