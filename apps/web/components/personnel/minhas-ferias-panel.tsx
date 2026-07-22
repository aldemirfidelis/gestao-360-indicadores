'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

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
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  decisionNote: string | null;
}

interface MyOverview {
  linked: boolean;
  employee: { id: string; name: string; status: string } | null;
  balance: { periods: PeriodBalance[]; totalBalance: number; nextDeadline: string | null; expiring: boolean; overdue: boolean } | null;
  requests: VacationRequest[];
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

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T12:00:00Z`);
  const end = new Date(`${endIso}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

/**
 * Autoatendimento de férias do próprio colaborador (Minha Vida Funcional).
 * Solicita e acompanha as próprias férias; o pedido segue para o superior
 * imediato (gestor) e depois para o DP aprovarem. Endpoints /personnel/vacations/me
 * são liberados a qualquer usuário autenticado.
 */
export function MinhasFeriasPanel() {
  const qc = useQueryClient();
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ startDate: '', endDate: '', notes: '' });

  const myQuery = useQuery<MyOverview>({
    queryKey: ['vacations', 'me'],
    queryFn: () => api<MyOverview>('/personnel/vacations/me'),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['vacations'] });
    void qc.invalidateQueries({ queryKey: ['time-clock'] });
    void qc.invalidateQueries({ queryKey: ['my-day'] });
  };

  const createRequest = useMutation({
    mutationFn: () =>
      api('/personnel/vacations/me', {
        method: 'POST',
        json: { startDate: requestForm.startDate, endDate: requestForm.endDate, notes: requestForm.notes || undefined },
      }),
    onSuccess: () => {
      toast.success('Solicitação enviada ao seu superior imediato');
      setRequestOpen(false);
      setRequestForm({ startDate: '', endDate: '', notes: '' });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível solicitar as férias'),
  });

  const cancelMine = useMutation({
    mutationFn: (id: string) => api(`/personnel/vacations/me/${id}/cancel`, { method: 'POST', json: {} }),
    onSuccess: () => {
      toast.success('Solicitação cancelada');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível cancelar'),
  });

  const my = myQuery.data;

  if (myQuery.isLoading) {
    return <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">Carregando suas férias...</div>;
  }

  if (!my?.linked) {
    return (
      <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Seu usuário ainda não está vinculado a um colaborador do quadro.
          <br />Procure o Serviço Pessoal para vincular seu cadastro e visualizar seu saldo de férias.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
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
                onClick={() => setRequestOpen(true)}
              >
                <Plus className="mr-1.5 h-4 w-4" />Solicitar férias
              </Button>
              <p className="text-[10px] text-muted-foreground">Sua solicitação segue para o superior imediato e depois para o DP.</p>
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

      {/* Dialog: solicitar minhas férias */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar minhas férias</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
            <Button variant="outline" onClick={() => setRequestOpen(false)}>Cancelar</Button>
            <Button
              className="bg-sky-500 font-semibold text-white hover:bg-sky-600"
              disabled={createRequest.isPending || !requestForm.startDate || !requestForm.endDate}
              onClick={() => createRequest.mutate()}
            >
              {createRequest.isPending ? 'Enviando...' : 'Enviar solicitação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
