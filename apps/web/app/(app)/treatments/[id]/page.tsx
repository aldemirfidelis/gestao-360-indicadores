'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, CalendarPlus, CheckCircle2, ClipboardList, Mail, SearchCheck } from 'lucide-react';
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

interface TreatmentDetail {
  id: string;
  periodRef: string;
  title: string;
  problem: string | null;
  status: string;
  ignoreReason: string | null;
  alerts: string[];
  indicator: {
    id: string;
    name: string;
    code: string | null;
    ownerNode: { id: string; name: string };
    responsibleUser: { id: string; name: string; email: string | null } | null;
    targets: { periodRef: string; target: number }[];
  };
  result: { id: string; value: number; light: string; deviationPct: number | null; periodRef: string } | null;
  deviation: { id: string; number: number; title: string; status: string } | null;
  analysis: { id: string; method: string; content: string } | null;
  meeting: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string | null;
    status: string;
    location: string | null;
    guests: { id: string; name: string; email: string; role: string }[];
    participants: { id: string; user: { id: string; name: string; email: string } }[];
    actions: { id: string; title: string; status: string; dueDate: string | null }[];
    emailLogs: { id: string; recipientEmail: string; status: string; errorMessage: string | null; createdAt: string }[];
  } | null;
  actions: { id: string; title: string; status: string; dueDate: string | null }[];
}

const METHOD_LABEL: Record<string, string> = {
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

const steps = [
  ['AWAITING_CAUSE_ANALYSIS', 'Analise de causa'],
  ['CAUSE_ANALYSIS_CREATED', 'Analise criada'],
  ['MEETING_SCHEDULED', 'Reuniao agendada'],
  ['ACTION_PLAN_CREATED', 'Plano de acao'],
  ['AWAITING_REEVALUATION', 'Reavaliacao'],
  ['RESOLVED', 'Resolvido'],
];

export default function TreatmentPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [analysisForm, setAnalysisForm] = useState({
    problem: '',
    probableCause: '',
    rootCause: '',
    method: 'FIVE_WHYS',
    evidence: '',
    observations: '',
  });
  const [meetingForm, setMeetingForm] = useState({
    startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    endsAt: '',
    location: '',
    format: 'ONLINE',
    participantName: '',
    participantEmail: '',
    participantRole: 'PARTICIPANT',
  });
  const [actionForm, setActionForm] = useState({
    title: '',
    description: '',
    responsibleEmail: '',
    dueDate: '',
    priority: 'HIGH',
    expectedResult: '',
    evidenceRequired: true,
  });

  const query = useQuery<TreatmentDetail>({
    queryKey: ['treatment', id],
    queryFn: () => api<TreatmentDetail>(`/treatments/${id}`),
  });

  const treatment = query.data;
  const target = useMemo(() => {
    if (!treatment) return null;
    return treatment.indicator.targets.find((item) => item.periodRef === treatment.periodRef)?.target ?? null;
  }, [treatment]);

  const createAnalysis = useMutation({
    mutationFn: () => api(`/treatments/${id}/analysis`, { method: 'POST', json: analysisForm }),
    onSuccess: () => {
      toast.success('Analise de causa criada');
      qc.invalidateQueries({ queryKey: ['treatment', id] });
      qc.invalidateQueries({ queryKey: ['traceability'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel salvar a analise'),
  });

  const scheduleMeeting = useMutation({
    mutationFn: () =>
      api(`/treatments/${id}/meeting`, {
        method: 'POST',
        json: {
          startsAt: new Date(meetingForm.startsAt).toISOString(),
          endsAt: meetingForm.endsAt ? new Date(meetingForm.endsAt).toISOString() : undefined,
          location: meetingForm.location || undefined,
          format: meetingForm.format,
          participants:
            meetingForm.participantName && meetingForm.participantEmail
              ? [{
                  name: meetingForm.participantName,
                  email: meetingForm.participantEmail,
                  role: meetingForm.participantRole,
                }]
              : [],
        },
      }),
    onSuccess: () => {
      toast.success('Reuniao de tratativa agendada');
      qc.invalidateQueries({ queryKey: ['treatment', id] });
    },
  });

  const sendInvites = useMutation({
    mutationFn: (meetingId: string) => api(`/meetings/${meetingId}/invitations/send`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Convites processados');
      qc.invalidateQueries({ queryKey: ['treatment', id] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel enviar convites'),
  });

  const createAction = useMutation({
    mutationFn: () =>
      api(`/treatments/${id}/actions`, {
        method: 'POST',
        json: actionForm,
      }),
    onSuccess: () => {
      toast.success('Plano de acao criado');
      setActionForm({ title: '', description: '', responsibleEmail: '', dueDate: '', priority: 'HIGH', expectedResult: '', evidenceRequired: true });
      qc.invalidateQueries({ queryKey: ['treatment', id] });
      qc.invalidateQueries({ queryKey: ['actions'] });
    },
  });

  const reevaluate = useMutation({
    mutationFn: () => api(`/treatments/${id}/reevaluate`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Tratativa reavaliada');
      qc.invalidateQueries({ queryKey: ['treatment', id] });
    },
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Carregando tratativa...</p>;
  if (!treatment) return null;

  const allActions = [...treatment.actions, ...(treatment.meeting?.actions ?? [])];

  return (
    <div>
      <Link href={`/indicators/${treatment.indicator.id}`} className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Indicador
      </Link>
      <PageHeader
        eyebrow="Fluxo guiado"
        tone="launch"
        title={treatment.title}
        description="Tratativa rastreavel para indicador fora da meta: analise, reuniao, convite, plano de acao e reavaliacao."
        breadcrumbs={[{ label: 'Inicio', href: '/' }, { label: 'Indicadores', href: '/indicators' }, { label: 'Tratativa' }]}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/indicators/${treatment.indicator.id}`}>
                <SearchCheck className="mr-2 h-4 w-4" />
                Historico
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/tree">Ver no mapa</Link>
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Indicador" value={treatment.indicator.name} description={treatment.indicator.ownerNode.name} icon={<SearchCheck className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Resultado" value={formatNumber(treatment.result?.value)} description={`Meta ${formatNumber(target)}`} icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <MetricCard title="Desvio" value={treatment.result?.deviationPct !== null && treatment.result?.deviationPct !== undefined ? `${formatNumber(treatment.result.deviationPct)}%` : '-'} description={periodRefLabel(treatment.periodRef)} icon={<AlertTriangle className="h-4 w-4" />} tone="yellow" />
        <MetricCard title="Status" value={statusLabel(treatment.status)} description="Tratativa atual" icon={<ClipboardList className="h-4 w-4" />} tone="purple" />
      </div>

      <SectionCard title="Linha de progresso" description="O status avanca automaticamente conforme analise, reuniao, acao e reavaliacao evoluem." className="mb-6">
        <div className="grid gap-2 md:grid-cols-6">
          {steps.map(([key, label], index) => {
            const active = stepIndex(treatment.status) >= index;
            return (
              <div key={key} className={cn('rounded-lg border p-3 text-sm', active ? 'border-primary/50 bg-primary/10' : 'bg-muted/35 text-muted-foreground')}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase">Etapa {index + 1}</span>
                  {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </div>
                <div className="font-medium">{label}</div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {treatment.alerts.length > 0 && (
        <SectionCard title="Alertas inteligentes" description="Pontos que precisam de acao para a tratativa nao ficar parada." className="mb-6">
          <div className="space-y-2">
            {treatment.alerts.map((alert) => (
              <div key={alert} className="flex items-start gap-2 rounded-lg border border-status-yellow/30 bg-status-yellow/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-status-yellow" />
                {alert}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="1. Analise de causa" description="Registre problema, causa provavel, causa raiz, metodo e evidencias.">
          {treatment.analysis ? (
            <div className="rounded-lg border p-4">
              <StatusBadge value="CAUSE_ANALYSIS_CREATED" label={METHOD_LABEL[treatment.analysis.method] ?? treatment.analysis.method} />
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{treatment.analysis.content}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Problema identificado *</Label>
                <Textarea value={analysisForm.problem} onChange={(e) => setAnalysisForm({ ...analysisForm, problem: e.target.value })} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Causa provavel</Label>
                  <Input value={analysisForm.probableCause} onChange={(e) => setAnalysisForm({ ...analysisForm, probableCause: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Metodo</Label>
                  <NativeSelect value={analysisForm.method} onChange={(e) => setAnalysisForm({ ...analysisForm, method: e.target.value })}>
                    {Object.entries(METHOD_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </NativeSelect>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Causa raiz *</Label>
                <Textarea value={analysisForm.rootCause} onChange={(e) => setAnalysisForm({ ...analysisForm, rootCause: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Evidencias e observacoes</Label>
                <Textarea value={analysisForm.evidence} onChange={(e) => setAnalysisForm({ ...analysisForm, evidence: e.target.value })} />
              </div>
              <Button onClick={() => createAnalysis.mutate()} disabled={!analysisForm.problem || !analysisForm.rootCause || createAnalysis.isPending}>
                Salvar analise de causa
              </Button>
            </div>
          )}
        </SectionCard>

        <SectionCard title="2. Reuniao de tratativa" description="Agende a reuniao, defina participantes e envie convite com ICS.">
          {treatment.meeting ? (
            <div className="space-y-3">
              <div className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{treatment.meeting.title}</div>
                    <div className="text-sm text-muted-foreground">{formatDate(treatment.meeting.startsAt)} - {treatment.meeting.location ?? 'Online'}</div>
                  </div>
                  <StatusBadge value={treatment.meeting.status} label={treatment.meeting.status} />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {treatment.meeting.participants.length + treatment.meeting.guests.length} participante(s), {treatment.meeting.emailLogs.length} convite(s) registrado(s).
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => sendInvites.mutate(treatment.meeting!.id)} disabled={sendInvites.isPending}>
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar convite
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/meetings/${treatment.meeting.id}`}>Abrir reuniao</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Inicio *</Label>
                  <Input type="datetime-local" value={meetingForm.startsAt} onChange={(e) => setMeetingForm({ ...meetingForm, startsAt: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Fim</Label>
                  <Input type="datetime-local" value={meetingForm.endsAt} onChange={(e) => setMeetingForm({ ...meetingForm, endsAt: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Local ou link</Label>
                  <Input value={meetingForm.location} onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <NativeSelect value={meetingForm.format} onChange={(e) => setMeetingForm({ ...meetingForm, format: e.target.value })}>
                    <option value="ONLINE">Online</option>
                    <option value="PRESENTIAL">Presencial</option>
                    <option value="HYBRID">Hibrida</option>
                  </NativeSelect>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/35 p-3">
                <div className="mb-2 text-sm font-semibold">Participante externo opcional</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input placeholder="Nome" value={meetingForm.participantName} onChange={(e) => setMeetingForm({ ...meetingForm, participantName: e.target.value })} />
                  <Input placeholder="E-mail" type="email" value={meetingForm.participantEmail} onChange={(e) => setMeetingForm({ ...meetingForm, participantEmail: e.target.value })} />
                </div>
              </div>
              <Button onClick={() => scheduleMeeting.mutate()} disabled={!meetingForm.startsAt || scheduleMeeting.isPending}>
                <CalendarPlus className="mr-2 h-4 w-4" />
                Agendar reuniao
              </Button>
            </div>
          )}
        </SectionCard>

        <SectionCard title="3. Plano de acao" description="Crie a acao vinculada ao indicador, analise, reuniao e responsavel.">
          <div className="space-y-3">
            {allActions.map((action) => (
              <Link key={action.id} href={`/actions/${action.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-accent/35">
                <div>
                  <div className="font-medium">{action.title}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(action.dueDate)}</div>
                </div>
                <StatusBadge value={action.status} label={action.status} />
              </Link>
            ))}
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
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
              <Button onClick={() => createAction.mutate()} disabled={!actionForm.title || createAction.isPending}>
                Criar plano de acao
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="4. Acompanhamento" description="Depois das acoes, reavalie se o indicador voltou para a meta.">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Quando as acoes forem concluidas, lance novo resultado do indicador. A reavaliacao verifica o ultimo farol e atualiza a tratativa para resolvida ou nao resolvida.
            </p>
            <Button onClick={() => reevaluate.mutate()} disabled={reevaluate.isPending}>
              Reavaliar indicador
            </Button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function stepIndex(status: string) {
  if (['RESOLVED', 'CONCLUDED'].includes(status)) return 5;
  if (status === 'AWAITING_REEVALUATION') return 4;
  if (['ACTION_PLAN_CREATED', 'ACTIONS_IN_PROGRESS', 'ACTIONS_OVERDUE', 'AWAITING_EVIDENCE'].includes(status)) return 3;
  if (['MEETING_SCHEDULED', 'MEETING_COMPLETED'].includes(status)) return 2;
  if (status === 'CAUSE_ANALYSIS_CREATED') return 1;
  return 0;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    AWAITING_CAUSE_ANALYSIS: 'Aguardando analise',
    CAUSE_ANALYSIS_CREATED: 'Analise criada',
    MEETING_SCHEDULED: 'Reuniao agendada',
    MEETING_COMPLETED: 'Reuniao realizada',
    ACTION_PLAN_CREATED: 'Plano criado',
    ACTIONS_IN_PROGRESS: 'Acoes em andamento',
    ACTIONS_OVERDUE: 'Acoes atrasadas',
    AWAITING_EVIDENCE: 'Aguardando evidencia',
    AWAITING_REEVALUATION: 'Aguardando reavaliacao',
    RESOLVED: 'Resolvido',
    UNRESOLVED: 'Nao resolvido',
    REOPENED: 'Reaberto',
    CONCLUDED: 'Concluido',
    IGNORED_TEMPORARILY: 'Ignorado temporariamente',
  };
  return labels[status] ?? status;
}
