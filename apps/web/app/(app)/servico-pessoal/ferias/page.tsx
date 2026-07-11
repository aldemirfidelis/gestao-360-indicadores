'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BedDouble,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Plus,
  Stethoscope,
  SunMedium,
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
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { ReasonDialog, type ReasonDialogState } from '@/components/platform/reason-dialog';

interface PeriodBalance {
  ref: string;
  start: string;
  end: string;
  concessiveDeadline: string;
  entitledDays: number;
  usedDays: number;
  balanceDays: number;
  expiring: boolean;
  overdue: boolean;
}

interface VacationRequest {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  days: number;
  periodRef: string | null;
  status: string;
  notes: string | null;
  decisionNote: string | null;
  createdAt: string;
  employee?: { id: string; name: string; registrationId: string | null };
}

interface MyOverview {
  linked: boolean;
  employee: { id: string; name: string; status: string } | null;
  balance: { periods: PeriodBalance[]; totalBalance: number; nextDeadline: string | null; expiring: boolean; overdue: boolean } | null;
  requests: VacationRequest[];
}

interface BalanceRow {
  employee: { id: string; name: string; registrationId: string | null; orgNode: { name: string } | null };
  admissionDate: string | null;
  totalBalance: number;
  nextDeadline: string | null;
  expiring: boolean;
  overdue: boolean;
  periods: PeriodBalance[];
}

interface LeaveRecord {
  id: string;
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string | null;
  description: string | null;
  hasCid: boolean;
  employee?: { id: string; name: string; registrationId: string | null };
}

const VACATION_STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Aguardando gestor',
  MANAGER_APPROVED: 'Aguardando DP',
  APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada',
  CANCELLED: 'Cancelada',
  DONE: 'Concluída',
};

const VACATION_STATUS_CLASS: Record<string, string> = {
  REQUESTED: 'border-status-yellow/40 text-status-yellow',
  MANAGER_APPROVED: 'border-status-purple/40 text-status-purple',
  APPROVED: 'border-status-green/40 text-status-green',
  REJECTED: 'border-status-red/40 text-status-red',
  CANCELLED: 'border-border text-muted-foreground',
  DONE: 'border-border text-muted-foreground',
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  ATESTADO: 'Atestado médico',
  ACIDENTE_TRABALHO: 'Acidente de trabalho',
  MATERNIDADE: 'Licença-maternidade',
  PATERNIDADE: 'Licença-paternidade',
  LICENCA_NAO_REMUNERADA: 'Licença não remunerada',
  FALTA_JUSTIFICADA: 'Falta justificada',
  OUTRO: 'Outro',
};

export default function VacationsPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const canView = hasPermission(['pessoal:view', 'pessoal:manage']);
  const canDecide = hasPermission(['pessoal:update', 'pessoal:manage']);

  const [tab, setTab] = useState(searchParams.get('tab') ?? 'minhas');
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState | null>(null);
  const [requestDialog, setRequestDialog] = useState<{ employeeId?: string; self: boolean } | null>(null);
  const [requestForm, setRequestForm] = useState({ startDate: '', endDate: '', notes: '' });
  const [leaveDialog, setLeaveDialog] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ employeeId: '', type: 'ATESTADO', startDate: '', endDate: '', cid: '', description: '' });

  const myQuery = useQuery<MyOverview>({
    queryKey: ['vacations', 'me'],
    queryFn: () => api<MyOverview>('/personnel/vacations/me'),
  });
  const requestsQuery = useQuery<VacationRequest[]>({
    queryKey: ['vacations', 'requests'],
    queryFn: () => api<VacationRequest[]>('/personnel/vacations'),
    enabled: canView,
  });
  const balancesQuery = useQuery<BalanceRow[]>({
    queryKey: ['vacations', 'balances'],
    queryFn: () => api<BalanceRow[]>('/personnel/vacations/balances'),
    enabled: canView && tab === 'saldos',
  });
  const leavesQuery = useQuery<LeaveRecord[]>({
    queryKey: ['vacations', 'leaves'],
    queryFn: () => api<LeaveRecord[]>('/personnel/leaves'),
    enabled: canView && tab === 'afastamentos',
  });
  const employeesQuery = useQuery<{ items: Array<{ id: string; name: string; status: string }> }>({
    queryKey: ['personnel-employees', { search: '', orgNodeId: '', status: 'ACTIVE' }],
    queryFn: () => api('/personnel/employees?status=ACTIVE'),
    enabled: canDecide && (leaveDialog || Boolean(requestDialog && !requestDialog.self)),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['vacations'] });
    void qc.invalidateQueries({ queryKey: ['time-clock'] });
    void qc.invalidateQueries({ queryKey: ['my-day'] });
  };

  const createRequest = useMutation({
    mutationFn: () => {
      const payload = { startDate: requestForm.startDate, endDate: requestForm.endDate, notes: requestForm.notes || undefined };
      return requestDialog?.self
        ? api('/personnel/vacations/me', { method: 'POST', json: payload })
        : api('/personnel/vacations', { method: 'POST', json: { ...payload, employeeId: requestDialog?.employeeId } });
    },
    onSuccess: () => {
      toast.success('Solicitação de férias enviada');
      setRequestDialog(null);
      setRequestForm({ startDate: '', endDate: '', notes: '' });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível solicitar as férias'),
  });

  const decide = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: 'approve' | 'reject' | 'cancel'; note?: string }) =>
      api(`/personnel/vacations/${id}/${action}`, { method: 'POST', json: { note } }),
    onSuccess: (_, variables) => {
      toast.success(variables.action === 'approve' ? 'Solicitação aprovada' : variables.action === 'reject' ? 'Solicitação rejeitada' : 'Solicitação cancelada');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível decidir a solicitação'),
  });

  const cancelMine = useMutation({
    mutationFn: (id: string) => api(`/personnel/vacations/me/${id}/cancel`, { method: 'POST', json: {} }),
    onSuccess: () => {
      toast.success('Solicitação cancelada');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível cancelar'),
  });

  const createLeave = useMutation({
    mutationFn: () =>
      api('/personnel/leaves', {
        method: 'POST',
        json: {
          employeeId: leaveForm.employeeId,
          type: leaveForm.type,
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate || undefined,
          cid: leaveForm.cid || undefined,
          description: leaveForm.description || undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Afastamento registrado');
      setLeaveDialog(false);
      setLeaveForm({ employeeId: '', type: 'ATESTADO', startDate: '', endDate: '', cid: '', description: '' });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível registrar o afastamento'),
  });

  const closeLeave = useMutation({
    mutationFn: (id: string) => api(`/personnel/leaves/${id}/close`, { method: 'POST', json: {} }),
    onSuccess: () => {
      toast.success('Afastamento encerrado (retorno registrado)');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível encerrar'),
  });

  const my = myQuery.data;
  const pending = (requestsQuery.data ?? []).filter((r) => ['REQUESTED', 'MANAGER_APPROVED'].includes(r.status));
  const decided = (requestsQuery.data ?? []).filter((r) => !['REQUESTED', 'MANAGER_APPROVED'].includes(r.status));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Férias e Afastamentos"
        description="Períodos aquisitivos e saldo (CLT), solicitações com aprovação em 2 níveis e afastamentos integrados ao espelho de ponto."
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="bg-slate-100 dark:bg-slate-800">
          <TabsTrigger value="minhas" className="text-xs font-semibold"><SunMedium className="mr-2 h-4 w-4" />Minhas Férias</TabsTrigger>
          {canView && (
            <TabsTrigger value="solicitacoes" className="text-xs font-semibold">
              <CheckCircle2 className="mr-2 h-4 w-4" />Solicitações
              {pending.length > 0 && <span className="ml-1.5 rounded-full bg-status-yellow/20 px-1.5 text-[10px] font-bold text-status-yellow">{pending.length}</span>}
            </TabsTrigger>
          )}
          {canView && <TabsTrigger value="saldos" className="text-xs font-semibold"><Users className="mr-2 h-4 w-4" />Saldos</TabsTrigger>}
          {canView && <TabsTrigger value="afastamentos" className="text-xs font-semibold"><Stethoscope className="mr-2 h-4 w-4" />Afastamentos</TabsTrigger>}
        </TabsList>

        {/* ------------------------------ Minhas Férias ------------------------------ */}
        <TabsContent value="minhas">
          {!my?.linked ? (
            <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                Seu usuário ainda não está vinculado a um colaborador do quadro.
                <br />Procure o Serviço Pessoal para vincular seu cadastro e visualizar seu saldo de férias.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
              <div className="space-y-4">
                <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                  <CardContent className="space-y-3 p-5 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Saldo disponível</div>
                    <div className={cn('text-4xl font-extrabold', (my.balance?.totalBalance ?? 0) > 0 ? 'text-status-green' : 'text-slate-500')}>
                      {my.balance?.totalBalance ?? 0} <span className="text-base font-semibold">dias</span>
                    </div>
                    {my.balance?.overdue && (
                      <div className="rounded-md border border-status-red/40 bg-status-red/5 p-2 text-[11px] text-status-red">
                        Há período com prazo de gozo vencido (risco de dobra). Procure o DP.
                      </div>
                    )}
                    {!my.balance?.overdue && my.balance?.expiring && (
                      <div className="rounded-md border border-status-yellow/40 bg-status-yellow/5 p-2 text-[11px] text-status-yellow">
                        Período com prazo de gozo vencendo em breve — programe suas férias.
                      </div>
                    )}
                    <Button
                      className="w-full bg-sky-500 font-semibold text-white hover:bg-sky-600"
                      disabled={(my.balance?.totalBalance ?? 0) <= 0}
                      onClick={() => setRequestDialog({ self: true })}
                    >
                      <Plus className="mr-1.5 h-4 w-4" />Solicitar férias
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                  <CardContent className="space-y-2 p-4 text-xs">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">Períodos aquisitivos</div>
                    {(my.balance?.periods ?? []).length === 0 && (
                      <div className="text-muted-foreground">Nenhum período completo ainda (ou admissão não informada no prontuário).</div>
                    )}
                    {(my.balance?.periods ?? []).map((period) => (
                      <div key={period.ref} className="rounded-md border p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold tabular-nums">{period.ref}</span>
                          <Badge variant="outline" className={period.balanceDays > 0 ? 'border-status-green/40 text-status-green' : 'border-border text-muted-foreground'}>
                            {period.balanceDays} dia(s)
                          </Badge>
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          Gozar até {formatDate(period.concessiveDeadline)}
                          {period.overdue && <span className="ml-1 font-bold text-status-red">VENCIDO</span>}
                          {!period.overdue && period.expiring && <span className="ml-1 font-bold text-status-yellow">vence em breve</span>}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card className="min-w-0 border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                <div className="border-b px-4 py-2.5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                    <CalendarDays className="h-4 w-4 text-sky-500" />Minhas solicitações
                  </h3>
                </div>
                <CardContent className="space-y-2 p-4 text-xs">
                  {(my.requests ?? []).length === 0 && <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">Nenhuma solicitação de férias ainda.</div>}
                  {(my.requests ?? []).map((request) => (
                    <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                      <div>
                        <div className="font-semibold tabular-nums">{formatDate(request.startDate)} a {formatDate(request.endDate)} · {request.days} dia(s)</div>
                        {request.decisionNote && <div className="mt-0.5 text-[10px] text-muted-foreground">{request.decisionNote}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('text-[10px]', VACATION_STATUS_CLASS[request.status])}>{VACATION_STATUS_LABEL[request.status] ?? request.status}</Badge>
                        {['REQUESTED', 'MANAGER_APPROVED', 'APPROVED'].includes(request.status) && new Date(request.startDate) > new Date() && (
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] text-status-red" disabled={cancelMine.isPending} onClick={() => cancelMine.mutate(request.id)}>
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ------------------------------ Solicitações (DP) ------------------------------ */}
        {canView && (
          <TabsContent value="solicitacoes">
            <div className="space-y-4">
              <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                <div className="flex items-center justify-between border-b px-4 py-2.5">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Aguardando aprovação</h3>
                  {canDecide && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setRequestForm({ startDate: '', endDate: '', notes: '' }); setRequestDialog({ self: false }); }}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />Registrar p/ colaborador
                    </Button>
                  )}
                </div>
                <CardContent className="space-y-2 p-4 text-xs">
                  {pending.length === 0 && <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">Nenhuma solicitação pendente. 🎉</div>}
                  {pending.map((request) => (
                    <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{request.employee?.name}</div>
                        <div className="mt-0.5 tabular-nums text-muted-foreground">
                          {formatDate(request.startDate)} a {formatDate(request.endDate)} · {request.days} dia(s)
                          {request.periodRef && <span className="ml-1">· período {request.periodRef}</span>}
                        </div>
                        {request.notes && <div className="mt-0.5 text-[10px] text-muted-foreground">{request.notes}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('text-[10px]', VACATION_STATUS_CLASS[request.status])}>{VACATION_STATUS_LABEL[request.status]}</Badge>
                        {canDecide && (
                          <>
                            <Button size="sm" className="h-7 bg-status-green text-[11px] text-white hover:bg-status-green/90" disabled={decide.isPending} onClick={() => decide.mutate({ id: request.id, action: 'approve' })}>
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />{request.status === 'REQUESTED' ? 'Aprovar (gestor)' : 'Aprovar (DP)'}
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={decide.isPending} onClick={() => setReasonDialog({
                              title: 'Rejeitar solicitação de férias',
                              label: 'Justificativa',
                              confirmLabel: 'Rejeitar',
                              destructive: true,
                              onConfirm: (note) => decide.mutate({ id: request.id, action: 'reject', note }),
                            })}>
                              <X className="mr-1 h-3.5 w-3.5" />Rejeitar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                <div className="border-b px-4 py-2.5"><h3 className="text-sm font-semibold text-slate-800 dark:text-white">Histórico</h3></div>
                <CardContent className="max-h-80 space-y-1.5 overflow-y-auto p-4 text-xs">
                  {decided.length === 0 && <div className="text-muted-foreground">Nenhuma solicitação decidida ainda.</div>}
                  {decided.map((request) => (
                    <div key={request.id} className="flex items-center justify-between gap-2 rounded border px-2.5 py-1.5">
                      <span className="min-w-0 truncate">{request.employee?.name} · <span className="tabular-nums">{formatDate(request.startDate)} a {formatDate(request.endDate)}</span> · {request.days}d</span>
                      <Badge variant="outline" className={cn('shrink-0 text-[9px]', VACATION_STATUS_CLASS[request.status])}>{VACATION_STATUS_LABEL[request.status]}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* ------------------------------ Saldos ------------------------------ */}
        {canView && (
          <TabsContent value="saldos">
            <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
              <div className="border-b px-4 py-2.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                  <CalendarClock className="h-4 w-4 text-sky-500" />Saldo de férias por colaborador
                </h3>
              </div>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[760px] text-xs">
                  <thead className="border-b bg-slate-50/60 text-[10px] uppercase tracking-wider text-muted-foreground dark:bg-slate-900/40">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Colaborador</th>
                      <th className="px-2 py-2.5 text-left">Área</th>
                      <th className="px-2 py-2.5 text-left">Admissão</th>
                      <th className="px-2 py-2.5 text-right">Saldo</th>
                      <th className="px-2 py-2.5 text-left">Gozar até</th>
                      <th className="px-2 py-2.5 text-left">Alerta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {(balancesQuery.data ?? []).map((row) => (
                      <tr key={row.employee.id}>
                        <td className="max-w-[220px] truncate px-4 py-2 font-medium text-slate-800 dark:text-slate-200">{row.employee.name}</td>
                        <td className="max-w-[140px] truncate px-2 py-2">{row.employee.orgNode?.name ?? '—'}</td>
                        <td className="px-2 py-2 tabular-nums">{formatDate(row.admissionDate)}</td>
                        <td className={cn('px-2 py-2 text-right font-semibold tabular-nums', row.totalBalance > 0 ? 'text-status-green' : 'text-muted-foreground')}>{row.totalBalance}d</td>
                        <td className="px-2 py-2 tabular-nums">{row.nextDeadline ? formatDate(row.nextDeadline) : '—'}</td>
                        <td className="px-2 py-2">
                          {row.overdue && <Badge variant="outline" className="border-status-red/40 text-[9px] text-status-red">DOBRA</Badge>}
                          {!row.overdue && row.expiring && <Badge variant="outline" className="border-status-yellow/40 text-[9px] text-status-yellow">vencendo</Badge>}
                          {!row.overdue && !row.expiring && <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {balancesQuery.isLoading && <div className="p-6 text-center text-xs text-muted-foreground">Calculando saldos...</div>}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ------------------------------ Afastamentos ------------------------------ */}
        {canView && (
          <TabsContent value="afastamentos">
            <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                  <BedDouble className="h-4 w-4 text-sky-500" />Afastamentos e atestados
                </h3>
                {canDecide && (
                  <Button size="sm" className="h-8 bg-sky-500 text-xs font-semibold text-white hover:bg-sky-600" onClick={() => setLeaveDialog(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />Registrar afastamento
                  </Button>
                )}
              </div>
              <CardContent className="space-y-2 p-4 text-xs">
                {(leavesQuery.data ?? []).length === 0 && <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">Nenhum afastamento registrado.</div>}
                {(leavesQuery.data ?? []).map((leave) => {
                  const open = !leave.endDate || new Date(leave.endDate) >= new Date();
                  return (
                    <div key={leave.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{leave.employee?.name}</div>
                        <div className="mt-0.5 text-muted-foreground">
                          {LEAVE_TYPE_LABEL[leave.type] ?? leave.type} · <span className="tabular-nums">{formatDate(leave.startDate)}{leave.endDate ? ` a ${formatDate(leave.endDate)}` : ' — em aberto'}</span>
                          {leave.hasCid && <span className="ml-1 text-[10px]">· CID registrado</span>}
                        </div>
                        {leave.description && <div className="mt-0.5 text-[10px] text-muted-foreground">{leave.description}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={open ? 'border-status-yellow/40 text-status-yellow' : 'border-border text-muted-foreground'}>
                          {open ? 'Em curso' : 'Encerrado'}
                        </Badge>
                        {canDecide && !leave.endDate && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={closeLeave.isPending} onClick={() => closeLeave.mutate(leave.id)}>
                            Registrar retorno
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog: solicitar férias */}
      <Dialog open={Boolean(requestDialog)} onOpenChange={(v) => !v && setRequestDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{requestDialog?.self ? 'Solicitar minhas férias' : 'Registrar férias para colaborador'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!requestDialog?.self && (
              <div>
                <Label>Colaborador</Label>
                <NativeSelect value={requestDialog?.employeeId ?? ''} onChange={(e) => setRequestDialog((d) => d && { ...d, employeeId: e.target.value })}>
                  <option value="">Selecione o colaborador</option>
                  {(employeesQuery.data?.items ?? []).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                </NativeSelect>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input type="date" value={requestForm.startDate} onChange={(e) => setRequestForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="date" value={requestForm.endDate} onChange={(e) => setRequestForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            {requestForm.startDate && requestForm.endDate && (
              <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
                {daysBetween(requestForm.startDate, requestForm.endDate)} dia(s) corridos — mínimo 5, máximo 30 (CLT art. 134).
              </div>
            )}
            <div>
              <Label>Observações</Label>
              <Textarea rows={2} value={requestForm.notes} onChange={(e) => setRequestForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialog(null)}>Cancelar</Button>
            <Button
              className="bg-sky-500 font-semibold text-white hover:bg-sky-600"
              disabled={createRequest.isPending || !requestForm.startDate || !requestForm.endDate || (!requestDialog?.self && !requestDialog?.employeeId)}
              onClick={() => createRequest.mutate()}
            >
              {createRequest.isPending ? 'Enviando...' : 'Enviar solicitação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: registrar afastamento */}
      <Dialog open={leaveDialog} onOpenChange={setLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar afastamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Colaborador</Label>
              <NativeSelect value={leaveForm.employeeId} onChange={(e) => setLeaveForm((f) => ({ ...f, employeeId: e.target.value }))}>
                <option value="">Selecione o colaborador</option>
                {(employeesQuery.data?.items ?? []).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Tipo</Label>
              <NativeSelect value={leaveForm.type} onChange={(e) => setLeaveForm((f) => ({ ...f, type: e.target.value }))}>
                {Object.entries(LEAVE_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <Label>Fim (vazio = em aberto)</Label>
                <Input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>CID (opcional — dado sensível, restrito ao DP)</Label>
              <Input value={leaveForm.cid} onChange={(e) => setLeaveForm((f) => ({ ...f, cid: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={leaveForm.description} onChange={(e) => setLeaveForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveDialog(false)}>Cancelar</Button>
            <Button
              className="bg-sky-500 font-semibold text-white hover:bg-sky-600"
              disabled={createLeave.isPending || !leaveForm.employeeId || !leaveForm.startDate}
              onClick={() => createLeave.mutate()}
            >
              {createLeave.isPending ? 'Registrando...' : 'Registrar afastamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReasonDialog state={reasonDialog} onClose={() => setReasonDialog(null)} />
    </div>
  );
}

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T12:00:00Z`);
  const end = new Date(`${endIso}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}
