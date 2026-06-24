'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Mail,
  Plus,
  Send,
  Sparkles,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { StatusBadge } from '@/components/platform/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { AnalysisWorkspace, type AnalysisPayload } from '@/components/platform/analysis-workspace';
import { api } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/utils';

interface MeetingTask {
  id: string;
  title: string;
  done: boolean;
  startDate: string | null;
  endDate: string | null;
  dueDate: string | null;
  assignedToId: string | null;
  assignedTo: { id: string; name: string; email: string | null } | null;
}

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
  actions: {
    id: string;
    title: string;
    status: string;
    priority: string;
    progress: number;
    dueDate: string | null;
    problemDescription: string | null;
    rootCause: string | null;
    analysisTool: string | null;
    responsibleEmail: string | null;
    responsibleUser: { id: string; name: string; email: string | null } | null;
    tasks: MeetingTask[];
    analysisSessions: { id: string; method: string; problem: string | null; rootCause: string | null; updatedAt: string }[];
  }[];
  emailLogs: { id: string; recipientName: string | null; recipientEmail: string; status: string; errorMessage: string | null; attempts: number; createdAt: string; sentAt: string | null }[];
  calendarInvites: { id: string; uid: string; createdAt: string }[];
}

interface AiMinutesDraft {
  provider: 'gemini' | 'deterministic';
  generatedAt: string;
  summary: string;
  minutes: string;
  decisions: string[];
  actionItems: { description: string; owner: string | null; dueDate: string | null; priority: string | null; source: string }[];
  risks: string[];
  nextSteps: string[];
  markdown: string;
}

const statusLabels: Record<string, string> = {
  SCHEDULED: 'Agendada',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
  NOT_STARTED: 'Não iniciada',
  IN_PROGRESS: 'Em andamento',
  WAITING_THIRD: 'Aguardando terceiros',
  PAUSED: 'Pausada',
  DONE: 'Concluída',
  DONE_LATE: 'Concluída fora do prazo',
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Média',
  LOW: 'Baixa',
};

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const [agendaTopic, setAgendaTopic] = useState('');
  const [guest, setGuest] = useState({ name: '', email: '', jobTitle: '', area: '', role: 'PARTICIPANT', notes: '' });
  const [minutesDraft, setMinutesDraft] = useState<AiMinutesDraft | null>(null);
  const canGenerateMinutes = hasPermission(['meetings:update']);

  const query = useQuery<MeetingDetail>({
    queryKey: ['meeting', id],
    queryFn: () => api<MeetingDetail>(`/meetings/${id}`),
  });

  const m = query.data;
  const linkedAction = m?.actions?.[0] ?? null;

  // Detalhe completo do plano vinculado p/ alimentar a ferramenta de análise (mesmo molde do plano).
  const actionQuery = useQuery<any>({
    queryKey: ['action', linkedAction?.id],
    queryFn: () => api(`/actions/${linkedAction!.id}`),
    enabled: !!linkedAction?.id,
  });

  const target = useMemo(() => {
    if (!m?.indicator || !m.treatment) return null;
    return m.indicator.targets.find((item) => item.periodRef === m.treatment?.periodRef)?.target ?? null;
  }, [m]);

  const addAgenda = useMutation({
    mutationFn: () => api(`/meetings/${id}/agenda`, { method: 'POST', json: { topic: agendaTopic } }),
    onSuccess: () => {
      setAgendaTopic('');
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
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível adicionar participante'),
  });

  // Garante (cria, se preciso) o Plano de Ação da reunião — usado quando a análise/5W2H começa
  // sem um plano vinculado (o plano "nasce" da análise feita na reunião).
  const ensureActionPlan = async (): Promise<string> => {
    if (linkedAction?.id) return linkedAction.id;
    const res = await api<{ id: string }>(`/meetings/${id}/action-plan`, { method: 'POST' });
    await qc.invalidateQueries({ queryKey: ['meeting', id] });
    await qc.invalidateQueries({ queryKey: ['action', res.id] });
    return res.id;
  };

  const saveAnalysis = useMutation({
    mutationFn: async (payload: AnalysisPayload) => {
      const actionId = linkedAction?.id ?? (await ensureActionPlan());
      return api(`/actions/${actionId}/analysis`, { method: 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success('Análise de causa sincronizada com o plano');
      qc.invalidateQueries({ queryKey: ['meeting', id] });
      if (linkedAction?.id) qc.invalidateQueries({ queryKey: ['action', linkedAction.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível salvar a análise'),
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
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível enviar convites'),
  });

  const generateMinutes = useMutation({
    mutationFn: () => api<AiMinutesDraft>(`/meetings/${id}/ai/minutes`, { method: 'POST' }),
    onSuccess: (data) => {
      setMinutesDraft(data);
      toast.success(data.provider === 'gemini' ? 'Minuta gerada por IA' : 'Minuta gerada por regras locais');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível gerar a minuta'),
  });

  const completeMeeting = useMutation({
    mutationFn: () => api(`/meetings/${id}/complete`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Reunião concluída — análises enviadas ao plano e execução iniciada');
      qc.invalidateQueries({ queryKey: ['meeting', id] });
      if (linkedAction?.id) qc.invalidateQueries({ queryKey: ['action', linkedAction.id] });
      qc.invalidateQueries({ queryKey: ['actions'] });
    },
  });

  const copyMinutes = async () => {
    if (!minutesDraft) return;
    await navigator.clipboard.writeText(minutesDraft.markdown);
    toast.success('Minuta copiada');
  };

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Carregando reunião...</p>;
  if (!m) return null;

  return (
    <div>
      <Link href="/meetings" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Reuniões
      </Link>

      <PageHeader
        eyebrow="Reunião"
        tone="view"
        title={m.title}
        description={`${formatDateTime(m.startsAt)}${m.location ? ` - ${m.location}` : ''}`}
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Reuniões', href: '/meetings' }, { label: 'Reunião' }]}
        actions={
          <>
            <StatusBadge value={m.status} label={statusLabels[m.status] ?? m.status} />
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

      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-6">
          <SectionCard
            title="Indicador tratado"
            description="Contexto do indicador e do desvio analisado nesta reunião."
            actions={linkedAction && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/actions/${linkedAction.id}`}>Abrir plano</Link>
              </Button>
            )}
          >
            {m.indicator ? (
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <InfoLine label="Indicador" value={<Link href={`/indicators/${m.indicator.id}`} className="font-semibold hover:text-primary">{m.indicator.name}</Link>} />
                <InfoLine label="Área" value={m.indicator.ownerNode.name} />
                <InfoLine label="Meta x realizado" value={`Meta ${formatNumber(target)} · Resultado ${formatNumber(m.treatment?.result?.value)}`} />
                <InfoLine
                  label="Desvio"
                  value={m.treatment?.result?.deviationPct !== null && m.treatment?.result?.deviationPct !== undefined ? `${formatNumber(m.treatment.result.deviationPct)}%` : '-'}
                />
                <InfoLine label="Responsável" value={m.indicator.responsibleUser?.name ?? '-'} />
                <InfoLine label="Formato" value={formatLabel(m.format)} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Esta reunião ainda não possui indicador vinculado.</p>
            )}
          </SectionCard>

          <SectionCard title="Pauta da reunião" description="Itens para conduzir a conversa e registrar os pontos tratados.">
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

          <SectionCard title="Participantes" description="Participantes internos, externos e presenças.">
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
                    <span className="block truncate text-xs text-muted-foreground">{roleLabel(p.role)}</span>
                  </span>
                  {p.attended && <StatusBadge value="DONE" label="Presente" />}
                </label>
              ))}
              {m.guests.map((g) => (
                <div key={g.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{g.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{g.email} · {roleLabel(g.role)}</div>
                    </div>
                    <StatusBadge value={g.confirmed ? 'DONE' : 'NOT_STARTED'} label={g.confirmed ? 'Confirmado' : 'Convidado'} />
                  </div>
                </div>
              ))}

              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Users className="h-4 w-4" />
                  Adicionar participante externo
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input placeholder="Nome" value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} />
                  <Input placeholder="E-mail" type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} />
                  <Input placeholder="Cargo" value={guest.jobTitle} onChange={(e) => setGuest({ ...guest, jobTitle: e.target.value })} />
                  <Input placeholder="Área" value={guest.area} onChange={(e) => setGuest({ ...guest, area: e.target.value })} />
                  <NativeSelect value={guest.role} onChange={(e) => setGuest({ ...guest, role: e.target.value })}>
                    <option value="PARTICIPANT">Participante</option>
                    <option value="RESPONSIBLE">Responsável</option>
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

          {linkedAction ? (
            !actionQuery.data ? (
              <SectionCard title="Análise de causa" description="Carregando a ferramenta de análise...">
                <p className="text-sm text-muted-foreground">Carregando...</p>
              </SectionCard>
            ) : (
              <AnalysisWorkspace
                action={actionQuery.data}
                onSave={(payload) => saveAnalysis.mutate(payload)}
                onEnsureActionPlan={ensureActionPlan}
                saving={saveAnalysis.isPending}
                title="Análise de causa (ferramentas)"
                description={`Escolha o método (Ishikawa, 5 Porquês, 5W2H, PDCA...) e preencha a ferramenta. Problema e causa raiz ficam sincronizados com o plano: ${linkedAction.title}`}
              />
            )
          ) : m?.indicator || m?.deviation ? (
            <AnalysisWorkspace
              action={{
                id: undefined,
                analysisTool: 'ISHIKAWA',
                problemDescription: m?.deviation?.title ?? m?.indicator?.name ?? m?.title ?? null,
                rootCause: null,
                analysisSessions: [],
                indicator: m?.indicator ?? null,
                ownerNode: m?.indicator?.ownerNode ?? null,
                responsibleUser: m?.indicator?.responsibleUser ?? null,
                deviationId: m?.deviation?.id,
              }}
              onSave={(payload) => saveAnalysis.mutate(payload)}
              onEnsureActionPlan={ensureActionPlan}
              saving={saveAnalysis.isPending}
              title="Análise de causa (ferramentas)"
              description="Conduza Ishikawa → 5 Porquês → 5W2H → PDCA. O plano de ação é criado automaticamente quando a 1ª tarefa do 5W2H é gerada."
            />
          ) : (
            <SectionCard title="Análise de causa" description="Vincule um indicador ou desvio para conduzir a análise de causa.">
              <p className="text-sm text-muted-foreground">Esta reunião ainda não está vinculada a um indicador ou desvio.</p>
            </SectionCard>
          )}

          <SectionCard title="Tarefas do plano" description="As ações nascem da ferramenta 5W2H (acima). Ao concluir o 5W2H, a tarefa entra automaticamente aqui e na Execução do plano.">
            {!linkedAction ? (
              <p className="text-sm text-muted-foreground">As tarefas aparecem aqui assim que você gerar a 1ª tarefa no 5W2H (o plano é criado automaticamente).</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-3 text-sm">
                  <div>
                    <div className="font-semibold">{linkedAction.title}</div>
                    <div className="text-xs text-muted-foreground">{linkedAction.tasks.length} tarefa(s) cadastrada(s)</div>
                  </div>
                  <StatusBadge value={linkedAction.status} label={statusLabels[linkedAction.status] ?? linkedAction.status} />
                </div>

                <div className="space-y-2">
                  {linkedAction.tasks.map((task) => (
                    <div key={task.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium">{task.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {task.assignedTo?.name ?? 'Sem responsável'} · {formatDate(task.startDate)} até {formatDate(task.endDate ?? task.dueDate)}
                          </div>
                        </div>
                        <StatusBadge value={task.done ? 'DONE' : 'NOT_STARTED'} label={task.done ? 'Concluída' : 'Aberta'} />
                      </div>
                    </div>
                  ))}
                  {linkedAction.tasks.length === 0 && (
                    <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                      Nenhuma tarefa ainda. Use a ferramenta <span className="font-medium">5W2H</span> na Análise de causa acima para preencher e gerar a tarefa.
                    </div>
                  )}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Convites e registros de e-mail" description="Cada envio fica registrado para auditoria e reenvio.">
            <div className="space-y-2">
              {m.emailLogs.map((log) => (
                <div key={log.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{log.recipientName ?? log.recipientEmail}</div>
                      <div className="truncate text-xs text-muted-foreground">{log.recipientEmail} · {formatDateTime(log.sentAt ?? log.createdAt)}</div>
                      {log.errorMessage && <div className="mt-1 text-xs text-status-red">{log.errorMessage}</div>}
                    </div>
                    <StatusBadge value={log.status} label={emailStatusLabel(log.status)} tone={log.status === 'SENT' ? 'green' : log.status === 'ERROR' ? 'red' : 'yellow'} />
                  </div>
                </div>
              ))}
              {m.emailLogs.length === 0 && (
                <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Nenhum convite enviado ainda.
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {m.calendarInvites.length} arquivo(s) ICS gerado(s)
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          {canGenerateMinutes && (
            <SectionCard
              title="Minuta por IA"
              description="Gere um rascunho revisavel da ata com decisões, pendências e proximos passos."
              actions={
                <Button variant="outline" size="sm" onClick={() => generateMinutes.mutate()} disabled={generateMinutes.isPending}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {generateMinutes.isPending ? 'Gerando...' : 'Gerar minuta'}
                </Button>
              }
            >
              {minutesDraft ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                    <span>
                      Fonte: {minutesDraft.provider === 'gemini' ? 'Gemini' : 'regras locais'} - {formatDateTime(minutesDraft.generatedAt)}
                    </span>
                    <Button variant="ghost" size="sm" onClick={copyMinutes}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar
                    </Button>
                  </div>
                  <Textarea
                    rows={18}
                    value={minutesDraft.markdown}
                    onChange={(e) => setMinutesDraft({ ...minutesDraft, markdown: e.target.value })}
                    className="font-mono text-xs leading-relaxed"
                  />
                  <p className="text-xs text-muted-foreground">
                    Revise a minuta antes de enviar ou registrar como ata oficial.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhuma minuta gerada nesta sessão. Use o botao acima para criar um rascunho com base em pauta,
                  participantes, decisões e tarefas vinculadas.
                </div>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1">{value || '-'}</div>
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

function roleLabel(value: string) {
  const labels: Record<string, string> = {
    RESPONSIBLE: 'Responsável',
    PARTICIPANT: 'Participante',
    APPROVER: 'Aprovador',
    EXECUTOR: 'Executor',
    GUEST: 'Convidado',
  };
  return labels[value] ?? value;
}

function formatLabel(value: string) {
  const labels: Record<string, string> = {
    ONLINE: 'Remota',
    PRESENTIAL: 'Presencial',
    HYBRID: 'Híbrida',
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
