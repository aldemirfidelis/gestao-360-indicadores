'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Calendar, Plus, ArrowLeft, CalendarDays, ExternalLink, Coins } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';

/** Férias aprovadas no Serviço Pessoal (fonte canônica), consumidas pela folha. */
interface ApprovedVacation {
  id: string;
  employee: { id: string; name: string; registrationId: string | null } | null;
  startDate: string;
  endDate: string;
  days: number;
  sellDays: number;
  advanceThirteenth: boolean;
  periodRef: string | null;
  status: 'APPROVED' | 'DONE';
  competence: string;
}

export default function VacationsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canOperate = hasPermission(['folha:operate']);

  const [editing, setEditing] = useState<ApprovedVacation | null>(null);
  const [form, setForm] = useState({ sellDays: 0, advanceThirteenth: false });

  const vacationsQuery = useQuery<ApprovedVacation[]>({
    queryKey: ['payroll-vacations'],
    queryFn: () => api<ApprovedVacation[]>('/payroll/vacations'),
  });

  const saveInputs = useMutation({
    mutationFn: (json: any) => api('/payroll/vacations/payroll-inputs', { method: 'POST', json }),
    onSuccess: () => {
      toast.success('Insumos de folha atualizados.');
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['payroll-vacations'] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao salvar.'),
  });

  const vacations = vacationsQuery.data ?? [];
  const sellingCount = vacations.filter((v) => v.sellDays > 0).length;
  const advanceCount = vacations.filter((v) => v.advanceThirteenth).length;

  const openEdit = (v: ApprovedVacation) => {
    setEditing(v);
    setForm({ sellDays: v.sellDays, advanceThirteenth: v.advanceThirteenth });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    saveInputs.mutate({ vacationRequestId: editing.id, sellDays: Number(form.sellDays), advanceThirteenth: form.advanceThirteenth });
  };

  const formatDate = (d: string) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/servico-pessoal/folha">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader
          title="Férias na Folha"
          description="Férias aprovadas no Serviço Pessoal que entram no cálculo da folha. A programação e a aprovação de férias são feitas no módulo de Férias & Afastamentos."
        />
      </div>

      {/* A gestão de férias vive no DP — aqui a folha apenas consome o aprovado. */}
      <Card className="border-sky-500/30 bg-sky-500/5 shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" />
            <div className="text-sm">
              <div className="font-semibold">Programar e aprovar férias</div>
              <div className="text-muted-foreground">Períodos aquisitivos, saldo CLT, alerta de dobra e aprovação ficam no módulo de Férias & Afastamentos (fonte única).</div>
            </div>
          </div>
          <Link href="/servico-pessoal/ferias">
            <Button variant="outline">
              <ExternalLink className="mr-1.5 h-4 w-4" /> Abrir Férias & Afastamentos
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Férias aprovadas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vacations.length}</div>
            <p className="text-xs text-muted-foreground">Disponíveis para a folha</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com abono pecuniário</CardTitle>
            <Coins className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{sellingCount}</div>
            <p className="text-xs text-muted-foreground">Venda de até 1/3 dos dias</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Antecipam 13º</CardTitle>
            <CalendarDays className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">{advanceCount}</div>
            <p className="text-xs text-muted-foreground">1ª parcela junto das férias</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 shadow-lg">
        <CardHeader>
          <CardTitle>Férias aprovadas por competência</CardTitle>
          <CardDescription>Ajuste o abono pecuniário e a antecipação do 13º usados no cálculo. Os dias e datas vêm da aprovação no DP.</CardDescription>
        </CardHeader>
        <CardContent>
          {vacationsQuery.isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Carregando férias aprovadas...</div>
          ) : vacations.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhuma férias aprovada. Programe e aprove no módulo de Férias & Afastamentos.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Colaborador</th>
                    <th className="p-3">Competência</th>
                    <th className="p-3">Período de gozo</th>
                    <th className="p-3 text-center">Dias</th>
                    <th className="p-3 text-center">Abono</th>
                    <th className="p-3">Adiant. 13º</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {vacations.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/10">
                      <td className="p-3 font-medium">
                        <div>{v.employee?.name ?? '—'}</div>
                        <div className="text-[10px] text-muted-foreground">Matrícula: {v.employee?.registrationId ?? 'N/A'}</div>
                      </td>
                      <td className="p-3 text-xs">{v.competence}</td>
                      <td className="p-3 text-xs">{formatDate(v.startDate)} a {formatDate(v.endDate)}</td>
                      <td className="p-3 text-center font-semibold">{v.days}</td>
                      <td className="p-3 text-center text-muted-foreground">{v.sellDays > 0 ? `${v.sellDays} dias` : '—'}</td>
                      <td className="p-3">
                        {v.advanceThirteenth ? (
                          <Badge variant="outline" className="bg-sky-50 text-sky-700 dark:bg-sky-950/20 dark:text-sky-400">Sim</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Não</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {canOperate && v.status === 'APPROVED' && (
                          <Button size="sm" variant="outline" onClick={() => openEdit(v)}>
                            <Plus className="mr-1 h-3.5 w-3.5" /> Abono / 13º
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Coins className="h-5 w-5 text-amber-500" /> Insumos de folha das férias
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-xs">
                <div className="font-bold text-foreground">{editing.employee?.name}</div>
                <div className="text-muted-foreground">
                  {formatDate(editing.startDate)} a {formatDate(editing.endDate)} · {editing.days} dias
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sellDays">Abono pecuniário (venda de dias)</Label>
                <NativeSelect id="sellDays" value={form.sellDays} onChange={(e) => setForm({ ...form, sellDays: Number(e.target.value) })}>
                  <option value={0}>Sem abono (0 dias)</option>
                  <option value={10}>Vender 10 dias (1/3)</option>
                </NativeSelect>
                <p className="text-[10px] text-muted-foreground">O abono é limitado a 1/3 do período (até 10 dias).</p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  id="advanceThirteenth"
                  type="checkbox"
                  checked={form.advanceThirteenth}
                  onChange={(e) => setForm({ ...form, advanceThirteenth: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                />
                <Label htmlFor="advanceThirteenth" className="cursor-pointer text-xs font-semibold">
                  Antecipar a 1ª parcela do 13º junto das férias
                </Label>
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button type="submit" disabled={saveInputs.isPending}>Salvar</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
