'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlarmClockCheck, Camera, FileDown, History, MapPin, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  ADJUSTMENT_CATEGORY_LABEL,
  ADJUSTMENT_STATUS_LABEL,
  BANK_SOURCE_LABEL,
  OCCURRENCE_STATUS_LABEL,
  OCCURRENCE_TYPE_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  WEEKDAY_SHORT,
  addMonths,
  buildPunchReceiptPdf,
  currentPositionOrNull,
  formatDateTime,
  formatDayKey,
  formatTime,
  minutesLabel,
  monthEnd,
  nextPunchLabel,
  punchRoleLabel,
  type AdjustmentRequest,
  type BankStatement,
  type MirrorDay,
  type MirrorResponse,
  type OccurrenceRow,
  type PunchEntry,
  type PunchReceipt,
  type SummaryResponse,
} from '@/lib/personnel/time-clock-shared';

function SummaryLine({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-semibold tabular-nums', className)}>{value}</span>
    </div>
  );
}

type AdjustDialogState = { dayKey: string; times: string[]; reason: string; type: 'HORARIOS' | 'ABONO_DIA'; category: string };

/**
 * Visão pessoal do ponto do próprio colaborador (bater ponto, espelho, resumo do mês,
 * minhas ocorrências e minhas solicitações de ajuste). Fica em Minha Vida Funcional —
 * o Controle de Ponto é reservado ao Serviço Pessoal para conferir/ajustar o time todo.
 */
export function MeuPontoPanel() {
  const qc = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const [mirrorMonth, setMirrorMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [bankOpen, setBankOpen] = useState(false);
  const [adjustDialog, setAdjustDialog] = useState<AdjustDialogState | null>(null);
  const [receiptEntryId, setReceiptEntryId] = useState<string | null>(null);
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
  const myOccurrencesQuery = useQuery<OccurrenceRow[]>({
    queryKey: ['time-clock', 'occurrences', 'mine'],
    queryFn: () => api<OccurrenceRow[]>('/personnel/occurrences/mine'),
  });
  const bankQuery = useQuery<BankStatement>({
    queryKey: ['time-clock', 'bank', 'me'],
    queryFn: () => api<BankStatement>('/personnel/time-bank/me'),
  });

  const summary = summaryQuery.data;
  const mirror = mirrorQuery.data;
  const monthBalance = summary?.month?.balanceMinutes ?? 0;

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
    mutationFn: (payload: { dayKey: string; proposedTimes: string[]; reason: string; type: 'HORARIOS' | 'ABONO_DIA'; category: string }) =>
      api('/personnel/time-clock/adjustments', { method: 'POST', json: payload }),
    onSuccess: (_result, variables) => {
      toast.success(variables.type === 'ABONO_DIA' ? 'Pedido de abono enviado' : 'Solicitação de ajuste enviada');
      setAdjustDialog(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível solicitar o ajuste'),
  });

  const openAdjustDialog = (day: MirrorDay) => {
    const times = day.entries.map((entry) => formatTime(entry.punchedAt));
    setAdjustDialog({
      dayKey: day.dayKey,
      times: times.length ? times : ['08:00', '17:00'],
      reason: '',
      type: day.status === 'ABSENT' ? 'ABONO_DIA' : 'HORARIOS',
      category: day.status === 'ABSENT' ? 'ATESTADO' : 'ESQUECIMENTO',
    });
  };

  const downloadReceipt = async (entry: PunchEntry) => {
    setReceiptEntryId(entry.id);
    try {
      const receipt = await api<PunchReceipt>(`/personnel/time-clock/entries/${entry.id}/receipt`);
      await buildPunchReceiptPdf(receipt);
      toast.success('Extrato interno da marcação gerado');
    } catch (error: any) {
      toast.error(error?.message ?? 'Não foi possível gerar o extrato da marcação');
    } finally {
      setReceiptEntryId(null);
    }
  };

  return (
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
              {punch.isPending ? 'Registrando...' : nextPunchLabel((summary?.today?.entries ?? []).length, summary?.autoLunch)}
            </Button>
            <Button asChild variant="outline" size="lg" className="h-11 w-full border-cyan-500/40 text-cyan-700 hover:bg-cyan-500/5 dark:text-cyan-300">
              <Link href="/servico-pessoal/ponto-facial"><Camera className="mr-2 h-5 w-5" />Usar reconhecimento facial</Link>
            </Button>
            {summary?.today?.expectedEndAt && summary?.today?.nextKind === 'OUT' && (
              <div className="rounded-md border border-sky-400/30 bg-sky-500/5 p-2 text-[11px] text-sky-700 dark:text-sky-300">
                Saída prevista às <span className="font-bold tabular-nums">{formatTime(summary.today.expectedEndAt)}</span>
              </div>
            )}
            {summary?.today?.expectedStartAt && summary?.today?.nextKind === 'IN' && (summary?.today?.entries ?? []).length === 0 && (
              <div className="rounded-md border border-sky-400/30 bg-sky-500/5 p-2 text-[11px] text-sky-700 dark:text-sky-300">
                Próxima marcação esperada: entrada às <span className="font-bold tabular-nums">{formatTime(summary.today.expectedStartAt)}</span>
              </div>
            )}
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
                  {(summary?.today?.entries ?? []).map((entry, i) => (
                    <span key={entry.id} className="inline-flex items-center rounded-md border bg-background">
                      <Badge variant="outline" className={cn('border-0 text-[10px] tabular-nums', entry.kind === 'IN' ? 'text-status-green' : 'text-status-red')}>
                        <span className="mr-1 font-semibold not-italic">{punchRoleLabel(i, summary?.autoLunch)}</span>
                        {formatTime(entry.punchedAt)}
                        {entry.nsr ? ` · NSR ${entry.nsr}` : ''}
                        {entry.source === 'MANUAL' && ' (ajuste)'}
                        {entry.source === 'FACIAL' && ' (facial)'}
                      </Badge>
                      <button
                        type="button"
                        className="border-l px-1.5 py-1 text-muted-foreground transition hover:text-sky-600 disabled:opacity-50"
                        disabled={Boolean(receiptEntryId)}
                        title="Baixar extrato interno — não substitui comprovante REP-P"
                        aria-label={`Baixar extrato interno da marcação${entry.nsr ? ` NSR ${entry.nsr}` : ''}`}
                        onClick={() => void downloadReceipt(entry)}
                      >
                        <FileDown className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {(summary?.today?.entries ?? []).length > 0 && (
                <div className="mt-2 text-[9px] text-muted-foreground">O extrato interno não substitui o comprovante oficial de um REP-P.</div>
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
            {(bankQuery.data?.expiringSoonMinutes ?? 0) > 0 && (
              <div className="rounded-md border border-amber-400/40 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-300">
                {minutesLabel(bankQuery.data!.expiringSoonMinutes)} do seu banco vencem nos próximos 30 dias.
              </div>
            )}
            <Button variant="outline" size="sm" className="mt-1 h-7 w-full text-[11px]" onClick={() => setBankOpen(true)}>
              <History className="mr-1.5 h-3.5 w-3.5" />Ver extrato do banco de horas
            </Button>
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

        {/* Minhas ocorrências (últimos 60 dias) */}
        <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
          <CardContent className="space-y-2 p-4 text-xs">
            <div className="font-semibold text-slate-800 dark:text-slate-200">Minhas ocorrências</div>
            {(myOccurrencesQuery.data ?? []).length === 0 && (
              <div className="text-muted-foreground">Nenhuma ocorrência nos últimos 60 dias. 🎉</div>
            )}
            {(myOccurrencesQuery.data ?? []).slice(0, 6).map((occurrence) => (
              <div key={occurrence.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                <div className="min-w-0">
                  <div className="font-semibold tabular-nums">{formatDayKey(occurrence.dayKey)}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {OCCURRENCE_TYPE_LABEL[occurrence.type] ?? occurrence.type}
                    {occurrence.minutes ? ` · ${minutesLabel(occurrence.minutes)}` : ''}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'shrink-0 text-[9px]',
                    occurrence.status === 'OPEN' ? 'border-status-yellow/40 text-status-yellow' : occurrence.status === 'RESOLVED' ? 'border-status-green/40 text-status-green' : 'border-border text-muted-foreground',
                  )}
                >
                  {OCCURRENCE_STATUS_LABEL[occurrence.status]}
                </Badge>
              </div>
            ))}
            <div className="text-[9px] text-muted-foreground">
              Ocorrências em aberto podem ser resolvidas solicitando um ajuste ou abono do dia no espelho.
            </div>
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
          <table className="w-full min-w-[820px] text-xs">
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
                      <span className="flex flex-wrap gap-1">
                        {day.entries.map((entry) => (
                          <span key={entry.id} className="inline-flex items-center rounded border bg-background tabular-nums">
                            <span className="px-1.5 py-0.5" title={entry.nsr ? `NSR ${entry.nsr}` : undefined}>
                              {formatTime(entry.punchedAt)}{entry.nsr ? ` · ${entry.nsr}` : ''}
                            </span>
                            <button
                              type="button"
                              className="border-l px-1 py-0.5 text-muted-foreground hover:text-sky-600 disabled:opacity-50"
                              disabled={Boolean(receiptEntryId)}
                              title="Extrato interno — não substitui comprovante REP-P"
                              aria-label={`Baixar extrato interno da marcação${entry.nsr ? ` NSR ${entry.nsr}` : ''}`}
                              onClick={() => void downloadReceipt(entry)}
                            >
                              <FileDown className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{day.plannedMinutes ? minutesLabel(day.plannedMinutes) : '—'}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{day.workedMinutes ? minutesLabel(day.workedMinutes) : '—'}</td>
                  <td className={cn('px-2 py-2 text-right font-semibold tabular-nums', day.balanceMinutes > 0 ? 'text-status-green' : day.balanceMinutes < 0 ? 'text-status-red' : 'text-muted-foreground')}>
                    {day.balanceMinutes ? `${day.balanceMinutes > 0 ? '+' : ''}${minutesLabel(day.balanceMinutes)}` : '—'}
                  </td>
                  <td className="px-2 py-2">
                    <Badge variant="outline" className={cn('text-[10px]', STATUS_CLASS[day.status])} title={day.holiday ?? undefined}>
                      {STATUS_LABEL[day.status]}
                    </Badge>
                    {day.holiday && day.status !== 'HOLIDAY' && (
                      <Badge variant="outline" className="ml-1 border-amber-400/50 text-[9px] text-amber-600" title={day.holiday}>feriado</Badge>
                    )}
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

      {/* Dialog: solicitar ajuste */}
      <Dialog open={Boolean(adjustDialog)} onOpenChange={(v) => !v && setAdjustDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar ajuste — {adjustDialog ? formatDayKey(adjustDialog.dayKey) : ''}</DialogTitle>
          </DialogHeader>
          {adjustDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>Tipo de solicitação</Label>
                  <NativeSelect value={adjustDialog.type} onChange={(e) => setAdjustDialog((d) => d && { ...d, type: e.target.value as 'HORARIOS' | 'ABONO_DIA' })}>
                    <option value="HORARIOS">Corrigir horários do dia</option>
                    <option value="ABONO_DIA">Abonar o dia (falta justificada)</option>
                  </NativeSelect>
                </div>
                <div>
                  <Label>Categoria do motivo</Label>
                  <NativeSelect value={adjustDialog.category} onChange={(e) => setAdjustDialog((d) => d && { ...d, category: e.target.value })}>
                    {Object.entries(ADJUSTMENT_CATEGORY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </NativeSelect>
                </div>
              </div>
              {adjustDialog.type === 'HORARIOS' ? (
                <>
                  <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Informe a lista completa de horários do dia (entrada, saída, entrada, saída...). Ao aprovar, os horários corrigidos são lançados separadamente; as marcações originais permanecem preservadas na auditoria.
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
                </>
              ) : (
                <div className="rounded-md border border-teal-400/30 bg-teal-500/5 p-3 text-xs text-teal-700 dark:text-teal-300">
                  O abono justifica a falta do dia sem criar batidas: aprovado, o dia deixa de contar como falta e o saldo fica zerado. Nenhuma marcação é criada ou alterada.
                </div>
              )}
              <div>
                <Label>{adjustDialog.type === 'ABONO_DIA' ? 'Motivo do abono' : 'Motivo do ajuste'}</Label>
                <Textarea rows={3} value={adjustDialog.reason} onChange={(e) => setAdjustDialog((d) => d && { ...d, reason: e.target.value })} placeholder={adjustDialog.type === 'ABONO_DIA' ? 'Ex.: consulta médica com atestado entregue ao DP.' : 'Ex.: esqueci de registrar a saída do almoço.'} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog(null)}>Cancelar</Button>
            <Button
              className="bg-sky-500 font-semibold text-white hover:bg-sky-600"
              disabled={!adjustDialog || !adjustDialog.reason.trim() || (adjustDialog.type === 'HORARIOS' && adjustDialog.times.some((t) => !t)) || requestAdjustment.isPending}
              onClick={() =>
                adjustDialog &&
                requestAdjustment.mutate({
                  dayKey: adjustDialog.dayKey,
                  proposedTimes: adjustDialog.type === 'HORARIOS' ? adjustDialog.times : [],
                  reason: adjustDialog.reason,
                  type: adjustDialog.type,
                  category: adjustDialog.category,
                })
              }
            >
              {requestAdjustment.isPending ? 'Enviando...' : 'Enviar solicitação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extrato do banco de horas */}
      <Sheet open={bankOpen} onOpenChange={setBankOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Extrato do banco de horas</SheetTitle>
            <SheetDescription>
              {bankQuery.data
                ? `Saldo atual ${bankQuery.data.balanceMinutes > 0 ? '+' : ''}${minutesLabel(bankQuery.data.balanceMinutes)}${(bankQuery.data.expiringSoonMinutes ?? 0) > 0 ? ` · ${minutesLabel(bankQuery.data.expiringSoonMinutes)} a vencer em 30 dias` : ''}`
                : 'Carregando…'}
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="space-y-2">
            {(bankQuery.data?.alerts ?? []).map((alert, index) => (
              <div key={index} className="rounded-md border border-amber-400/40 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-300">
                {alert.type === 'MAX_POSITIVE'
                  ? `Saldo positivo ${minutesLabel(alert.overBy)} acima do teto da empresa.`
                  : `Saldo negativo ${minutesLabel(alert.overBy)} abaixo do limite da empresa.`}
              </div>
            ))}
            {(bankQuery.data?.entries ?? []).length === 0 && (
              <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">Nenhum lançamento no banco de horas.</div>
            )}
            {(bankQuery.data?.entries ?? []).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold">{BANK_SOURCE_LABEL[entry.source] ?? entry.source}{entry.periodRef ? ` · ${entry.periodRef}` : ''}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                    {entry.expiresAt ? ` · vence ${formatDayKey(entry.expiresAt.slice(0, 10))}` : ''}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </div>
                </div>
                <span className={cn('shrink-0 font-semibold tabular-nums', entry.minutes > 0 ? 'text-status-green' : entry.minutes < 0 ? 'text-status-red' : 'text-muted-foreground')}>
                  {entry.minutes > 0 ? '+' : ''}{minutesLabel(entry.minutes)}
                </span>
              </div>
            ))}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}
