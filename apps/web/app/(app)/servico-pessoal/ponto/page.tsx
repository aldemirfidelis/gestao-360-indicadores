'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlarmClockCheck,
  CalendarClock,
  CheckCircle2,
  Download,
  Fingerprint,
  History,
  ListChecks,
  Lock,
  LockOpen,
  MapPin,
  Plus,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api, getAccessToken } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { ReasonDialog, type ReasonDialogState } from '@/components/platform/reason-dialog';

type DayStatus = 'DAY_OFF' | 'IN_PROGRESS' | 'OK' | 'INCOMPLETE' | 'ABSENT' | 'OVERTIME' | 'UNDERTIME' | 'VACATION' | 'LEAVE';

interface PunchEntry {
  id: string;
  punchedAt: string;
  kind: 'IN' | 'OUT';
  source: string;
  note: string | null;
  hasLocation: boolean;
}

interface MirrorDay {
  dayKey: string;
  weekday: string;
  hasSchedule: boolean;
  plannedMinutes: number;
  workedMinutes: number;
  status: DayStatus;
  balanceMinutes: number;
  adjustment: { id: string; status: string; reason: string } | null;
  entries: PunchEntry[];
}

interface MirrorResponse {
  from: string;
  to: string;
  today: string;
  days: MirrorDay[];
  totals: { plannedMinutes: number; workedMinutes: number; balanceMinutes: number; okDays: number; inconsistentDays: number; absentDays: number };
}

interface SummaryResponse {
  today: MirrorDay & { nextKind: 'IN' | 'OUT' };
  month: MirrorResponse['totals'];
  bank: { totalMinutes: number; closedMinutes: number; liveMinutes: number };
  pendingAdjustments: number;
  myPendingAdjustments: number;
  period: { ref: string; status: string };
}

interface TeamRow {
  user: { id: string; name: string; email: string; jobTitle: string | null };
  hasSchedule: boolean;
  plannedMinutes: number;
  workedMinutes: number;
  status: DayStatus;
  balanceMinutes: number;
  entries: PunchEntry[];
}

interface AdjustmentRequest {
  id: string;
  dayKey: string;
  proposedTimes: string[];
  reason: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  decisionNote: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
  decidedBy?: { id: string; name: string; email: string } | null;
}

interface ShiftTemplate {
  id: string;
  name: string;
  description: string | null;
  toleranceMinutes: number;
  weeklyRules: Record<string, { start: string; end: string; breakMinutes?: number } | null>;
  active: boolean;
  activeAssignments: number;
}

interface PeriodRow {
  id: string | null;
  periodRef: string;
  status: 'OPEN' | 'CLOSED';
  closedAt: string | null;
  totals: { entries?: number } | null;
  closedByUser?: { id: string; name: string } | null;
}

const STATUS_LABEL: Record<DayStatus, string> = {
  DAY_OFF: 'Folga',
  IN_PROGRESS: 'Em andamento',
  OK: 'OK',
  INCOMPLETE: 'Inconsistente',
  ABSENT: 'Falta',
  OVERTIME: 'Hora extra',
  UNDERTIME: 'Débito',
  VACATION: 'Férias',
  LEAVE: 'Afastamento',
};

const STATUS_CLASS: Record<DayStatus, string> = {
  DAY_OFF: 'border-border text-muted-foreground',
  IN_PROGRESS: 'border-status-blue/40 text-status-blue',
  OK: 'border-status-green/40 text-status-green',
  INCOMPLETE: 'border-status-yellow/40 text-status-yellow',
  ABSENT: 'border-status-red/40 text-status-red',
  OVERTIME: 'border-status-purple/40 text-status-purple',
  UNDERTIME: 'border-status-red/40 text-status-red',
  VACATION: 'border-sky-400/50 text-sky-500',
  LEAVE: 'border-status-purple/40 text-status-purple',
};

const ADJUSTMENT_STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Aguardando aprovação',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  CANCELLED: 'Cancelado',
};

const WEEKDAYS: Array<{ key: string; label: string }> = [
  { key: 'mon', label: 'Segunda' },
  { key: 'tue', label: 'Terça' },
  { key: 'wed', label: 'Quarta' },
  { key: 'thu', label: 'Quinta' },
  { key: 'fri', label: 'Sexta' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
];

const WEEKDAY_SHORT: Record<string, string> = {
  mon: 'Seg', tue: 'Ter', wed: 'Qua', thu: 'Qui', fri: 'Sex', sat: 'Sáb', sun: 'Dom',
};

type TemplateDayForm = { enabled: boolean; start: string; end: string; breakMinutes: string };

const DEFAULT_TEMPLATE_FORM = () => ({
  name: '',
  description: '',
  toleranceMinutes: '10',
  days: Object.fromEntries(
    WEEKDAYS.map(({ key }) => [key, { enabled: !['sat', 'sun'].includes(key), start: '08:00', end: '17:00', breakMinutes: '60' } satisfies TemplateDayForm]),
  ) as Record<string, TemplateDayForm>,
});

export default function TimeClockPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();
  const canTeam = hasPermission(['ponto:team', 'ponto:manage']);
  const canManage = hasPermission(['ponto:manage']);

  const [tab, setTab] = useState(searchParams.get('tab') ?? 'meu-ponto');
  const [now, setNow] = useState(() => new Date());
  const [teamDay, setTeamDay] = useState('');
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState | null>(null);
  const [adjustDialog, setAdjustDialog] = useState<{ dayKey: string; times: string[]; reason: string } | null>(null);
  const [templateDialog, setTemplateDialog] = useState(false);
  const [templateForm, setTemplateForm] = useState(DEFAULT_TEMPLATE_FORM);
  const [assignForm, setAssignForm] = useState<{ templateId: string; userIds: string[] }>({ templateId: '', userIds: [] });
  const [mirrorMonth, setMirrorMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [importDialog, setImportDialog] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; duplicates: number; errors: string[] } | null>(null);
  const currentMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const summaryQuery = useQuery<SummaryResponse>({
    queryKey: ['time-clock', 'summary'],
    queryFn: () => api<SummaryResponse>('/personnel/time-clock/summary'),
    refetchInterval: 60_000,
  });
  const mirrorQuery = useQuery<MirrorResponse>({
    queryKey: ['time-clock', 'mirror', mirrorMonth],
    queryFn: () => api<MirrorResponse>(`/personnel/time-clock/me?from=${mirrorMonth}-01&to=${monthEnd(mirrorMonth)}`),
  });
  const myAdjustmentsQuery = useQuery<AdjustmentRequest[]>({
    queryKey: ['time-clock', 'adjustments', 'mine'],
    queryFn: () => api<AdjustmentRequest[]>('/personnel/time-clock/adjustments'),
  });
  const teamQuery = useQuery<{ dayKey: string; rows: TeamRow[] }>({
    queryKey: ['time-clock', 'team', teamDay],
    queryFn: () => api(`/personnel/time-clock/team${teamDay ? `?day=${teamDay}` : ''}`),
    enabled: canTeam && tab === 'equipe',
  });
  const pendingQuery = useQuery<AdjustmentRequest[]>({
    queryKey: ['time-clock', 'adjustments', 'pending'],
    queryFn: () => api<AdjustmentRequest[]>('/personnel/time-clock/adjustments/pending'),
    enabled: canManage,
  });
  const templatesQuery = useQuery<ShiftTemplate[]>({
    queryKey: ['time-clock', 'templates'],
    queryFn: () => api<ShiftTemplate[]>('/personnel/schedules'),
    enabled: tab === 'escalas' || tab === 'meu-ponto',
  });
  const assignmentsQuery = useQuery<Array<{ id: string; startsAt: string; user: { id: string; name: string } | null; template: { id: string; name: string } }>>({
    queryKey: ['time-clock', 'assignments'],
    queryFn: () => api('/personnel/schedules/assignments'),
    enabled: canManage && tab === 'escalas',
  });
  const optionsQuery = useQuery<{ users: Array<{ id: string; name: string; email: string; jobTitle: string | null }> }>({
    queryKey: ['time-clock', 'options'],
    queryFn: () => api('/personnel/options'),
    enabled: canManage && tab === 'escalas',
  });
  const periodsQuery = useQuery<PeriodRow[]>({
    queryKey: ['time-clock', 'periods'],
    queryFn: () => api<PeriodRow[]>('/personnel/time-clock/periods'),
    enabled: canManage && tab === 'fechamento',
  });

  const summary = summaryQuery.data;
  const mirror = mirrorQuery.data;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['time-clock'] });
    void qc.invalidateQueries({ queryKey: ['my-day'] });
  };

  const punch = useMutation({
    mutationFn: async () => {
      const position = await currentPositionOrNull();
      return api('/personnel/time-clock/punch', {
        method: 'POST',
        json: position
          ? { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }
          : {},
      });
    },
    onSuccess: (result: any) => {
      const kind = result?.entry?.kind === 'OUT' ? 'Saída' : 'Entrada';
      toast.success(`${kind} registrada às ${formatTime(result?.entry?.punchedAt)}`);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível registrar a batida'),
  });

  const requestAdjustment = useMutation({
    mutationFn: (payload: { dayKey: string; proposedTimes: string[]; reason: string }) =>
      api('/personnel/time-clock/adjustments', { method: 'POST', json: payload }),
    onSuccess: () => {
      toast.success('Solicitação de ajuste enviada');
      setAdjustDialog(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível solicitar o ajuste'),
  });

  const decideAdjustment = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: 'approve' | 'reject'; note?: string }) =>
      api(`/personnel/time-clock/adjustments/${id}/${action}`, { method: 'POST', json: { note } }),
    onSuccess: (_, variables) => {
      toast.success(variables.action === 'approve' ? 'Ajuste aprovado e espelho atualizado' : 'Ajuste rejeitado');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível decidir o ajuste'),
  });

  const createTemplate = useMutation({
    mutationFn: () => {
      const weeklyRules = Object.fromEntries(
        WEEKDAYS.map(({ key }) => {
          const day = templateForm.days[key];
          return [key, day.enabled ? { start: day.start, end: day.end, breakMinutes: Number(day.breakMinutes) || 0 } : null];
        }),
      );
      return api('/personnel/schedules', {
        method: 'POST',
        json: {
          name: templateForm.name,
          description: templateForm.description || null,
          toleranceMinutes: Number(templateForm.toleranceMinutes) || 10,
          weeklyRules,
        },
      });
    },
    onSuccess: () => {
      toast.success('Escala criada');
      setTemplateDialog(false);
      setTemplateForm(DEFAULT_TEMPLATE_FORM());
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível criar a escala'),
  });

  const patchTemplate = useMutation({
    mutationFn: ({ id, json }: { id: string; json: Record<string, unknown> }) =>
      api(`/personnel/schedules/${id}`, { method: 'PATCH', json }),
    onSuccess: () => {
      toast.success('Escala atualizada');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível atualizar a escala'),
  });

  const assign = useMutation({
    mutationFn: () => api('/personnel/schedules/assign', { method: 'POST', json: assignForm }),
    onSuccess: (result: any) => {
      toast.success(`Escala atribuída a ${result?.assigned ?? assignForm.userIds.length} colaborador(es)`);
      setAssignForm({ templateId: '', userIds: [] });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível atribuir a escala'),
  });

  const importPunches = useMutation({
    mutationFn: (content: string) => api<{ imported: number; duplicates: number; errors: string[] }>('/personnel/time-clock/import', { method: 'POST', json: { content } }),
    onSuccess: (result) => {
      setImportResult(result);
      toast.success(`${result.imported} batida(s) importada(s)`);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível importar as batidas'),
  });

  const closePeriod = useMutation({
    mutationFn: (ref: string) => api(`/personnel/time-clock/periods/${ref}/close`, { method: 'POST', json: {} }),
    onSuccess: () => {
      toast.success('Competência fechada');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível fechar a competência'),
  });

  const reopenPeriod = useMutation({
    mutationFn: (ref: string) => api(`/personnel/time-clock/periods/${ref}/reopen`, { method: 'POST', json: {} }),
    onSuccess: () => {
      toast.success('Competência reaberta');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível reabrir a competência'),
  });

  const openAdjustDialog = (day: MirrorDay) => {
    const times = day.entries.map((entry) => formatTime(entry.punchedAt));
    setAdjustDialog({ dayKey: day.dayKey, times: times.length ? times : ['08:00', '17:00'], reason: '' });
  };

  const monthBalance = summary?.month?.balanceMinutes ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controle de Ponto"
        description="Batida com geolocalização, espelho de ponto, ajustes com aprovação, escalas e fechamento de competência."
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="bg-slate-100 dark:bg-slate-800">
          <TabsTrigger value="meu-ponto" className="text-xs font-semibold"><Fingerprint className="mr-2 h-4 w-4" />Meu Ponto</TabsTrigger>
          {canTeam && <TabsTrigger value="equipe" className="text-xs font-semibold"><Users className="mr-2 h-4 w-4" />Equipe</TabsTrigger>}
          {canManage && (
            <TabsTrigger value="ajustes" className="text-xs font-semibold">
              <ListChecks className="mr-2 h-4 w-4" />Ajustes
              {(summary?.pendingAdjustments ?? 0) > 0 && (
                <span className="ml-1.5 rounded-full bg-status-yellow/20 px-1.5 text-[10px] font-bold text-status-yellow">{summary?.pendingAdjustments}</span>
              )}
            </TabsTrigger>
          )}
          {canManage && <TabsTrigger value="escalas" className="text-xs font-semibold"><CalendarClock className="mr-2 h-4 w-4" />Escalas</TabsTrigger>}
          {canManage && <TabsTrigger value="fechamento" className="text-xs font-semibold"><Lock className="mr-2 h-4 w-4" />Fechamento</TabsTrigger>}
        </TabsList>

        {/* ------------------------------ Meu Ponto ------------------------------ */}
        <TabsContent value="meu-ponto">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
            <div className="space-y-4">
              {/* Cartão de batida */}
              <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                <CardContent className="space-y-4 p-5 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </div>
                  <div className="font-mono text-4xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                    {now.toLocaleTimeString('pt-BR')}
                  </div>
                  <Button
                    size="lg"
                    className="h-12 w-full bg-sky-500 text-sm font-bold text-white hover:bg-sky-600"
                    disabled={punch.isPending || summary?.period?.status === 'CLOSED'}
                    onClick={() => punch.mutate()}
                  >
                    <AlarmClockCheck className="mr-2 h-5 w-5" />
                    {punch.isPending
                      ? 'Registrando...'
                      : summary?.today?.nextKind === 'OUT'
                        ? 'Registrar saída'
                        : 'Registrar entrada'}
                  </Button>
                  <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />A localização é registrada junto com a batida, quando autorizada.
                  </div>
                  {summary?.period?.status === 'CLOSED' && (
                    <div className="rounded-md border border-status-red/40 bg-status-red/5 p-2 text-[11px] text-status-red">
                      Competência {summary.period.ref} fechada — batidas bloqueadas.
                    </div>
                  )}
                  <div className="border-t pt-3">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Batidas de hoje</div>
                    {(summary?.today?.entries ?? []).length === 0 ? (
                      <div className="text-xs text-muted-foreground">Nenhuma batida registrada hoje.</div>
                    ) : (
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {(summary?.today?.entries ?? []).map((entry) => (
                          <Badge key={entry.id} variant="outline" className={cn('text-[10px] tabular-nums', entry.kind === 'IN' ? 'border-status-green/40 text-status-green' : 'border-status-red/40 text-status-red')}>
                            {entry.kind === 'IN' ? '→' : '←'} {formatTime(entry.punchedAt)}
                            {entry.source === 'MANUAL' && ' (ajuste)'}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Resumo do mês */}
              <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                <CardContent className="space-y-2 p-4 text-xs">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">Resumo do mês</div>
                  <SummaryLine label="Horas previstas" value={minutesLabel(summary?.month?.plannedMinutes ?? 0)} />
                  <SummaryLine label="Horas trabalhadas" value={minutesLabel(summary?.month?.workedMinutes ?? 0)} />
                  <SummaryLine
                    label="Banco de horas (mês)"
                    value={`${monthBalance > 0 ? '+' : ''}${minutesLabel(monthBalance)}`}
                    className={monthBalance > 0 ? 'text-status-green' : monthBalance < 0 ? 'text-status-red' : undefined}
                  />
                  <SummaryLine
                    label="Banco acumulado"
                    value={`${(summary?.bank?.totalMinutes ?? 0) > 0 ? '+' : ''}${minutesLabel(summary?.bank?.totalMinutes ?? 0)}`}
                    className={(summary?.bank?.totalMinutes ?? 0) > 0 ? 'text-status-green' : (summary?.bank?.totalMinutes ?? 0) < 0 ? 'text-status-red' : undefined}
                  />
                  <SummaryLine label="Dias inconsistentes" value={String(summary?.month?.inconsistentDays ?? 0)} className={summary?.month?.inconsistentDays ? 'text-status-yellow' : undefined} />
                  <SummaryLine label="Faltas" value={String(summary?.month?.absentDays ?? 0)} className={summary?.month?.absentDays ? 'text-status-red' : undefined} />
                </CardContent>
              </Card>

              {/* Minhas solicitações */}
              <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                <CardContent className="space-y-2 p-4 text-xs">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">Minhas solicitações de ajuste</div>
                  {(myAdjustmentsQuery.data ?? []).length === 0 && <div className="text-muted-foreground">Nenhuma solicitação enviada.</div>}
                  {(myAdjustmentsQuery.data ?? []).slice(0, 6).map((request) => (
                    <div key={request.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                      <div className="min-w-0">
                        <div className="font-semibold tabular-nums">{formatDayKey(request.dayKey)}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{request.reason}</div>
                      </div>
                      <Badge variant="outline" className={cn('shrink-0 text-[9px]', request.status === 'APPROVED' ? 'border-status-green/40 text-status-green' : request.status === 'REJECTED' ? 'border-status-red/40 text-status-red' : 'border-status-yellow/40 text-status-yellow')}>
                        {ADJUSTMENT_STATUS_LABEL[request.status] ?? request.status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Espelho do mês */}
            <Card className="min-w-0 border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                  <History className="h-4 w-4 text-sky-500" />Espelho de ponto — {formatDayKey(`${mirrorMonth}-01`).slice(3)}
                </h3>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setMirrorMonth((m) => addMonths(m, -1))}>‹ mês anterior</Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={mirrorMonth >= currentMonth} onClick={() => setMirrorMonth((m) => addMonths(m, 1))}>próximo ›</Button>
                </div>
              </div>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[720px] text-xs">
                  <thead className="border-b bg-slate-50/60 text-[10px] uppercase tracking-wider text-muted-foreground dark:bg-slate-900/40">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Dia</th>
                      <th className="px-2 py-2.5 text-left">Batidas</th>
                      <th className="px-2 py-2.5 text-right">Prevista</th>
                      <th className="px-2 py-2.5 text-right">Trabalhada</th>
                      <th className="px-2 py-2.5 text-right">Saldo</th>
                      <th className="px-2 py-2.5 text-left">Situação</th>
                      <th className="px-4 py-2.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {(mirror?.days ?? []).map((day) => (
                      <tr key={day.dayKey} className={cn(day.dayKey === mirror?.today && 'bg-sky-50/40 dark:bg-sky-950/20')}>
                        <td className="px-4 py-2 font-semibold tabular-nums">
                          {formatDayKey(day.dayKey)} <span className="text-[10px] font-normal text-muted-foreground">{WEEKDAY_SHORT[day.weekday]}</span>
                        </td>
                        <td className="px-2 py-2">
                          {day.entries.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className="tabular-nums">{day.entries.map((entry) => formatTime(entry.punchedAt)).join(' · ')}</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{day.plannedMinutes ? minutesLabel(day.plannedMinutes) : '—'}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{day.workedMinutes ? minutesLabel(day.workedMinutes) : '—'}</td>
                        <td className={cn('px-2 py-2 text-right font-semibold tabular-nums', day.balanceMinutes > 0 ? 'text-status-green' : day.balanceMinutes < 0 ? 'text-status-red' : 'text-muted-foreground')}>
                          {day.balanceMinutes ? `${day.balanceMinutes > 0 ? '+' : ''}${minutesLabel(day.balanceMinutes)}` : '—'}
                        </td>
                        <td className="px-2 py-2">
                          <Badge variant="outline" className={cn('text-[10px]', STATUS_CLASS[day.status])}>{STATUS_LABEL[day.status]}</Badge>
                          {day.adjustment?.status === 'REQUESTED' && (
                            <Badge variant="outline" className="ml-1 border-status-yellow/40 text-[9px] text-status-yellow">ajuste pendente</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {day.dayKey <= (mirror?.today ?? '') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px]"
                              disabled={day.adjustment?.status === 'REQUESTED'}
                              onClick={() => openAdjustDialog(day)}
                            >
                              Solicitar ajuste
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ------------------------------ Equipe ------------------------------ */}
        {canTeam && (
          <TabsContent value="equipe">
            <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                  <Users className="h-4 w-4 text-sky-500" />Espelho da equipe — {teamQuery.data ? formatDayKey(teamQuery.data.dayKey) : ''}
                </h3>
                <Input type="date" className="h-8 w-40 text-xs" value={teamDay} onChange={(e) => setTeamDay(e.target.value)} />
              </div>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[760px] text-xs">
                  <thead className="border-b bg-slate-50/60 text-[10px] uppercase tracking-wider text-muted-foreground dark:bg-slate-900/40">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Colaborador</th>
                      <th className="px-2 py-2.5 text-left">Batidas</th>
                      <th className="px-2 py-2.5 text-right">Prevista</th>
                      <th className="px-2 py-2.5 text-right">Trabalhada</th>
                      <th className="px-2 py-2.5 text-left">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {(teamQuery.data?.rows ?? []).map((row) => (
                      <tr key={row.user.id}>
                        <td className="max-w-[240px] px-4 py-2">
                          <div className="truncate font-medium text-slate-800 dark:text-slate-200">{row.user.name}</div>
                          <div className="truncate text-[10px] text-muted-foreground">{row.user.jobTitle ?? row.user.email}</div>
                        </td>
                        <td className="px-2 py-2 tabular-nums">
                          {row.entries.length === 0 ? <span className="text-muted-foreground">—</span> : row.entries.map((entry) => formatTime(entry.punchedAt)).join(' · ')}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{row.plannedMinutes ? minutesLabel(row.plannedMinutes) : '—'}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{row.workedMinutes ? minutesLabel(row.workedMinutes) : '—'}</td>
                        <td className="px-2 py-2">
                          <Badge variant="outline" className={cn('text-[10px]', STATUS_CLASS[row.status])}>{STATUS_LABEL[row.status]}</Badge>
                          {!row.hasSchedule && <span className="ml-1 text-[9px] text-muted-foreground">sem escala</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {teamQuery.isLoading && <div className="p-6 text-center text-xs text-muted-foreground">Carregando equipe...</div>}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ------------------------------ Ajustes ------------------------------ */}
        {canManage && (
          <TabsContent value="ajustes">
            <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
              <div className="border-b px-4 py-2.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                  <ListChecks className="h-4 w-4 text-sky-500" />Ajustes aguardando aprovação
                </h3>
              </div>
              <CardContent className="space-y-3 p-4">
                {(pendingQuery.data ?? []).length === 0 && (
                  <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">Nenhum ajuste pendente. 🎉</div>
                )}
                {(pendingQuery.data ?? []).map((request) => (
                  <div key={request.id} className="rounded-md border p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{request.user?.name ?? 'Colaborador'}</span>
                        <span className="ml-2 tabular-nums text-muted-foreground">{formatDayKey(request.dayKey)}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 bg-status-green text-[11px] text-white hover:bg-status-green/90" disabled={decideAdjustment.isPending} onClick={() => decideAdjustment.mutate({ id: request.id, action: 'approve' })}>
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Aprovar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={decideAdjustment.isPending} onClick={() => setReasonDialog({
                          title: 'Rejeitar ajuste de ponto',
                          label: 'Justificativa da rejeição',
                          confirmLabel: 'Rejeitar',
                          destructive: true,
                          onConfirm: (note) => decideAdjustment.mutate({ id: request.id, action: 'reject', note }),
                        })}>
                          <X className="mr-1 h-3.5 w-3.5" />Rejeitar
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(request.proposedTimes ?? []).map((time, index) => (
                        <Badge key={`${request.id}-${index}`} variant="outline" className={cn('text-[10px] tabular-nums', index % 2 === 0 ? 'border-status-green/40 text-status-green' : 'border-status-red/40 text-status-red')}>
                          {index % 2 === 0 ? '→' : '←'} {time}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-2 text-muted-foreground">Motivo: {request.reason}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ------------------------------ Escalas ------------------------------ */}
        {canManage && (
          <TabsContent value="escalas">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                <div className="flex items-center justify-between border-b px-4 py-2.5">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Escalas de trabalho</h3>
                  <Button size="sm" className="h-8 bg-sky-500 text-xs font-semibold text-white hover:bg-sky-600" onClick={() => setTemplateDialog(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />Nova escala
                  </Button>
                </div>
                <CardContent className="space-y-2 p-4">
                  {(templatesQuery.data ?? []).length === 0 && (
                    <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                      Nenhuma escala cadastrada. Crie a primeira para habilitar o cálculo do espelho.
                    </div>
                  )}
                  {(templatesQuery.data ?? []).map((template) => (
                    <div key={template.id} className={cn('rounded-md border p-3 text-xs', !template.active && 'opacity-60')}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{template.name}</span>
                            {!template.active && <Badge variant="outline" className="h-4 px-1.5 text-[9px]">Inativa</Badge>}
                          </div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            Tolerância {template.toleranceMinutes} min · {template.activeAssignments} colaborador(es)
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 shrink-0 text-[10px]" disabled={patchTemplate.isPending} onClick={() => patchTemplate.mutate({ id: template.id, json: { active: !template.active } })}>
                          {template.active ? 'Desativar' : 'Ativar'}
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {WEEKDAYS.map(({ key }) => {
                          const rule = template.weeklyRules?.[key];
                          return (
                            <span key={key} className={cn('rounded border px-1.5 py-0.5 text-[9px] tabular-nums', rule ? 'text-slate-700 dark:text-slate-300' : 'text-muted-foreground opacity-60')}>
                              {WEEKDAY_SHORT[key]} {rule ? `${rule.start}–${rule.end}` : 'folga'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                <div className="border-b px-4 py-2.5">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Atribuir escala aos colaboradores</h3>
                </div>
                <CardContent className="space-y-3 p-4 text-xs">
                  <div>
                    <Label>Escala</Label>
                    <NativeSelect value={assignForm.templateId} onChange={(e) => setAssignForm((f) => ({ ...f, templateId: e.target.value }))}>
                      <option value="">Selecione a escala</option>
                      {(templatesQuery.data ?? []).filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </NativeSelect>
                  </div>
                  <div>
                    <Label>Colaboradores ({assignForm.userIds.length} selecionado(s))</Label>
                    <div className="mt-1 max-h-64 space-y-0.5 overflow-y-auto rounded-md border p-2">
                      {(optionsQuery.data?.users ?? []).map((person) => {
                        const checked = assignForm.userIds.includes(person.id);
                        return (
                          <label key={person.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/60">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setAssignForm((f) => ({
                                  ...f,
                                  userIds: checked ? f.userIds.filter((id) => id !== person.id) : [...f.userIds, person.id],
                                }))
                              }
                            />
                            <span className="min-w-0 truncate">{person.name}</span>
                            <span className="ml-auto truncate text-[10px] text-muted-foreground">{person.jobTitle ?? ''}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <Button size="sm" className="bg-sky-500 font-semibold text-white hover:bg-sky-600" disabled={!assignForm.templateId || assignForm.userIds.length === 0 || assign.isPending} onClick={() => assign.mutate()}>
                    {assign.isPending ? 'Atribuindo...' : 'Atribuir escala'}
                  </Button>

                  <div className="border-t pt-3">
                    <div className="mb-2 font-semibold text-slate-800 dark:text-slate-200">Vigências ativas</div>
                    {(assignmentsQuery.data ?? []).length === 0 && <div className="text-muted-foreground">Nenhum colaborador com escala atribuída.</div>}
                    <div className="max-h-56 space-y-1 overflow-y-auto">
                      {(assignmentsQuery.data ?? []).map((assignment) => (
                        <div key={assignment.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1.5">
                          <span className="min-w-0 truncate">{assignment.user?.name ?? '—'}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{assignment.template?.name} · desde {formatDate(assignment.startsAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* ------------------------------ Fechamento ------------------------------ */}
        {canManage && (
          <TabsContent value="fechamento">
            <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                  <Lock className="h-4 w-4 text-sky-500" />Fechamento de competência
                </h3>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setImportResult(null); setImportDialog(true); }}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />Importar batidas (CSV)
                </Button>
              </div>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead className="border-b bg-slate-50/60 text-[10px] uppercase tracking-wider text-muted-foreground dark:bg-slate-900/40">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Competência</th>
                      <th className="px-2 py-2.5 text-left">Situação</th>
                      <th className="px-2 py-2.5 text-left">Fechada por</th>
                      <th className="px-2 py-2.5 text-right">Batidas</th>
                      <th className="px-4 py-2.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {(periodsQuery.data ?? []).map((period) => (
                      <tr key={period.periodRef}>
                        <td className="px-4 py-2.5 font-semibold tabular-nums">{period.periodRef}</td>
                        <td className="px-2 py-2.5">
                          <Badge variant="outline" className={period.status === 'CLOSED' ? 'border-status-red/40 text-status-red' : 'border-status-green/40 text-status-green'}>
                            {period.status === 'CLOSED' ? 'Fechada' : 'Aberta'}
                          </Badge>
                        </td>
                        <td className="px-2 py-2.5 text-muted-foreground">
                          {period.status === 'CLOSED' ? `${period.closedByUser?.name ?? '—'} em ${formatDate(period.closedAt)}` : '—'}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{period.totals?.entries ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Button variant="ghost" size="sm" className="h-7 text-[10px]" title="Baixar relatório da competência (CSV)" onClick={() => downloadPeriodReport(period.periodRef)}>
                            <Download className="mr-1 h-3 w-3" />Relatório
                          </Button>
                          {period.status === 'OPEN' ? (
                            <Button variant="outline" size="sm" className="h-7 text-[10px]" disabled={closePeriod.isPending} onClick={() => setReasonDialog({
                              title: `Fechar competência ${period.periodRef}`,
                              label: 'Confirme digitando uma observação (opcional)',
                              required: false,
                              confirmLabel: 'Fechar competência',
                              destructive: true,
                              onConfirm: () => closePeriod.mutate(period.periodRef),
                            })}>
                              <Lock className="mr-1 h-3 w-3" />Fechar
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-7 text-[10px]" disabled={reopenPeriod.isPending} onClick={() => reopenPeriod.mutate(period.periodRef)}>
                              <LockOpen className="mr-1 h-3 w-3" />Reabrir
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t p-3 text-[10px] text-muted-foreground">
                  Fechar uma competência bloqueia novas batidas e ajustes nos dias do mês. O histórico permanece auditável.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog: solicitar ajuste */}
      <Dialog open={Boolean(adjustDialog)} onOpenChange={(v) => !v && setAdjustDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar ajuste — {adjustDialog ? formatDayKey(adjustDialog.dayKey) : ''}</DialogTitle>
          </DialogHeader>
          {adjustDialog && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                Informe a lista completa de horários do dia (entrada, saída, entrada, saída...). Ao aprovar, o espelho do dia é substituído por estes horários.
              </div>
              <div className="space-y-2">
                {adjustDialog.times.map((time, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Badge variant="outline" className={cn('w-16 justify-center text-[10px]', index % 2 === 0 ? 'border-status-green/40 text-status-green' : 'border-status-red/40 text-status-red')}>
                      {index % 2 === 0 ? 'Entrada' : 'Saída'}
                    </Badge>
                    <Input
                      type="time"
                      className="h-8 w-32 text-xs"
                      value={time}
                      onChange={(e) => setAdjustDialog((d) => d && { ...d, times: d.times.map((t, i) => (i === index ? e.target.value : t)) })}
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-status-red" onClick={() => setAdjustDialog((d) => d && { ...d, times: d.times.filter((_, i) => i !== index) })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAdjustDialog((d) => d && { ...d, times: [...d.times, ''] })}>
                  <Plus className="mr-1 h-3 w-3" />Adicionar horário
                </Button>
              </div>
              <div>
                <Label>Motivo do ajuste</Label>
                <Textarea rows={3} value={adjustDialog.reason} onChange={(e) => setAdjustDialog((d) => d && { ...d, reason: e.target.value })} placeholder="Ex.: esqueci de registrar a saída do almoço." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog(null)}>Cancelar</Button>
            <Button
              className="bg-sky-500 font-semibold text-white hover:bg-sky-600"
              disabled={!adjustDialog || !adjustDialog.reason.trim() || adjustDialog.times.some((t) => !t) || requestAdjustment.isPending}
              onClick={() => adjustDialog && requestAdjustment.mutate({ dayKey: adjustDialog.dayKey, proposedTimes: adjustDialog.times, reason: adjustDialog.reason })}
            >
              {requestAdjustment.isPending ? 'Enviando...' : 'Enviar solicitação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: nova escala */}
      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Nova escala de trabalho</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <Label>Nome da escala</Label>
                <Input value={templateForm.name} onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex.: Administrativo 08h–17h" />
              </div>
              <div>
                <Label>Tolerância (min)</Label>
                <Input type="number" min={0} max={120} value={templateForm.toleranceMinutes} onChange={(e) => setTemplateForm((f) => ({ ...f, toleranceMinutes: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={templateForm.description} onChange={(e) => setTemplateForm((f) => ({ ...f, description: e.target.value }))} placeholder="Quando usar esta escala" />
            </div>
            <div className="space-y-1.5">
              <Label>Jornada semanal</Label>
              {WEEKDAYS.map(({ key, label }) => {
                const day = templateForm.days[key];
                return (
                  <div key={key} className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
                    <label className="flex w-28 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={day.enabled}
                        onChange={(e) => setTemplateForm((f) => ({ ...f, days: { ...f.days, [key]: { ...day, enabled: e.target.checked } } }))}
                      />
                      <span className={cn(!day.enabled && 'text-muted-foreground')}>{label}</span>
                    </label>
                    {day.enabled ? (
                      <>
                        <Input type="time" className="h-7 w-28 text-xs" value={day.start} onChange={(e) => setTemplateForm((f) => ({ ...f, days: { ...f.days, [key]: { ...day, start: e.target.value } } }))} />
                        <span className="text-muted-foreground">às</span>
                        <Input type="time" className="h-7 w-28 text-xs" value={day.end} onChange={(e) => setTemplateForm((f) => ({ ...f, days: { ...f.days, [key]: { ...day, end: e.target.value } } }))} />
                        <span className="text-muted-foreground">intervalo</span>
                        <Input type="number" min={0} className="h-7 w-20 text-xs" value={day.breakMinutes} onChange={(e) => setTemplateForm((f) => ({ ...f, days: { ...f.days, [key]: { ...day, breakMinutes: e.target.value } } }))} />
                        <span className="text-muted-foreground">min</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Folga</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog(false)}>Cancelar</Button>
            <Button className="bg-sky-500 font-semibold text-white hover:bg-sky-600" disabled={!templateForm.name.trim() || createTemplate.isPending} onClick={() => createTemplate.mutate()}>
              {createTemplate.isPending ? 'Salvando...' : 'Salvar escala'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: importar batidas CSV */}
      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar batidas (relógio/REP)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-xs">
            <div className="rounded-md border bg-muted/30 p-3 text-muted-foreground">
              <div className="font-semibold text-foreground">Formato do CSV (uma batida por linha):</div>
              <pre className="mt-1 font-mono text-[10px]">email;data;hora{'\n'}ana@empresa.com;2026-07-08;08:01{'\n'}ana@empresa.com;08/07/2026;12:00</pre>
              Também aceita <span className="font-mono">email;data-hora-ISO</span> e separador vírgula. Duplicadas são ignoradas; competência fechada bloqueia a linha.
            </div>
            <Input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="text-xs"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                const content = await file.text();
                importPunches.mutate(content);
              }}
            />
            {importPunches.isPending && <div className="text-muted-foreground">Importando batidas...</div>}
            {importResult && (
              <div className="space-y-1 rounded-md border p-3">
                <div className="font-semibold text-status-green">{importResult.imported} batida(s) importada(s)</div>
                {importResult.duplicates > 0 && <div className="text-muted-foreground">{importResult.duplicates} duplicada(s) ignorada(s)</div>}
                {importResult.errors.length > 0 && (
                  <div className="max-h-32 space-y-0.5 overflow-y-auto text-status-red">
                    {importResult.errors.slice(0, 20).map((error, index) => <div key={index}>{error}</div>)}
                    {importResult.errors.length > 20 && <div>... e mais {importResult.errors.length - 20} erro(s)</div>}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReasonDialog state={reasonDialog} onClose={() => setReasonDialog(null)} />
    </div>
  );
}

/** Baixa o relatório CSV da competência com o token de acesso (download controlado). */
async function downloadPeriodReport(ref: string) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
    const token = getAccessToken();
    const res = await fetch(`${apiUrl}/personnel/time-clock/periods/${ref}/report.csv`, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error('Falha ao gerar o relatório');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ponto-${ref}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error('Não foi possível baixar o relatório');
  }
}

function SummaryLine({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-semibold tabular-nums', className)}>{value}</span>
    </div>
  );
}

function minutesLabel(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  const sign = minutes < 0 ? '-' : '';
  if (hours === 0) return `${sign}${rest}min`;
  return `${sign}${hours}h${rest ? ` ${String(rest).padStart(2, '0')}min` : ''}`;
}

function formatTime(value: string | undefined): string {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDayKey(dayKey: string): string {
  const [year, month, day] = dayKey.split('-');
  return `${day}/${month}/${year}`;
}

/** Último dia do mês YYYY-MM (o backend limita ao dia de hoje). */
function monthEnd(ref: string): string {
  const [year, month] = ref.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${ref}-${String(lastDay).padStart(2, '0')}`;
}

/** Soma meses a uma referência YYYY-MM. */
function addMonths(ref: string, delta: number): string {
  const [year, month] = ref.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Geolocalização com timeout curto: sem permissão/sinal, a batida segue sem coordenadas. */
function currentPositionOrNull(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => resolve(null), 3000);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        resolve(position);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 2500, maximumAge: 60_000 },
    );
  });
}
