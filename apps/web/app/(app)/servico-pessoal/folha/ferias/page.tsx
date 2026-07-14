'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  ArrowLeft,
  Users,
  CalendarDays,
  FileCheck,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';

interface VacationPeriod {
  id: string;
  employeeId: string;
  startAquisition: string;
  endAquisition: string;
  concessionLimit: string;
  totalDays: number;
  takenDays: number;
  status: 'ACQUIRING' | 'CONCESSIVE' | 'TAKEN';
  requests: VacationRequest[];
}

interface VacationRequest {
  id: string;
  startDate: string;
  endDate: string;
  takenDays: number;
  sellDays: number;
  advanceThirteenth: boolean;
  status: 'DRAFT' | 'APPROVED' | 'CALCULATED' | 'CLOSED';
}

interface Employee {
  id: string;
  name: string;
  registrationId: string;
}

export default function VacationsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canOperate = hasPermission(['folha:operate']);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<VacationPeriod | null>(null);

  const [form, setForm] = useState({
    startDate: '',
    endDate: '',
    takenDays: 30,
    sellDays: 0,
    advanceThirteenth: false,
  });

  const vacationsQuery = useQuery<VacationPeriod[]>({
    queryKey: ['payroll-vacations'],
    queryFn: () => api<VacationPeriod[]>('/payroll/vacations'),
  });

  const employeesQuery = useQuery<Employee[]>({
    queryKey: ['personnel-employees'],
    queryFn: () => api<Employee[]>('/personnel/employees'),
  });

  const scheduleVacation = useMutation({
    mutationFn: (json: any) => api('/payroll/vacations/request', { method: 'POST', json }),
    onSuccess: () => {
      toast.success('Férias programadas com sucesso.');
      setScheduleOpen(false);
      void qc.invalidateQueries({ queryKey: ['payroll-vacations'] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao programar férias.'),
  });

  const employeeMap = new Map(employeesQuery.data?.map((e) => [e.id, e]));

  const periods = vacationsQuery.data ?? [];
  const activeRequests = periods.flatMap((p) =>
    p.requests.map((r) => ({ ...r, employeeId: p.employeeId, periodId: p.id }))
  );

  const totalConcessive = periods.filter((p) => p.status === 'CONCESSIVE').length;
  
  const today = new Date();
  const warningLimitDate = new Date();
  warningLimitDate.setDate(today.getDate() + 60);

  const doubleWarningCount = periods.filter((p) => {
    if (p.status !== 'CONCESSIVE') return false;
    const limit = new Date(p.concessionLimit);
    return limit <= warningLimitDate && p.totalDays - p.takenDays > 0;
  }).length;

  const handleOpenSchedule = (period: VacationPeriod) => {
    setSelectedPeriod(period);
    setForm({
      startDate: '',
      endDate: '',
      takenDays: period.totalDays - period.takenDays,
      sellDays: 0,
      advanceThirteenth: false,
    });
    setScheduleOpen(true);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeriod) return;

    if (!form.startDate || !form.endDate) {
      toast.error('Informe as datas de início e término.');
      return;
    }

    scheduleVacation.mutate({
      vacationPeriodId: selectedPeriod.id,
      startDate: form.startDate,
      endDate: form.endDate,
      takenDays: Number(form.takenDays),
      sellDays: Number(form.sellDays),
      advanceThirteenth: form.advanceThirteenth,
    });
  };

  const formatDate = (d: string) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/servico-pessoal/folha">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader
          title="Gestão de Férias CLT"
          description="Controle de períodos aquisitivos, saldos de dias de direito e programação de férias com simulação de encargos."
        />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-background to-muted/50 border-border/80 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Colaboradores Monitorados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employeesQuery.data?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">Vínculos CLT ativos</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-background to-muted/50 border-border/80 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Períodos Concessivos</CardTitle>
            <CalendarDays className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">{totalConcessive}</div>
            <p className="text-xs text-muted-foreground">Direito de férias adquirido</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/5 to-background border-red-500/20 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risco de Dobra de Férias</CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-500">{doubleWarningCount}</div>
            <p className="text-xs text-muted-foreground">Limite concessivo expira em 60 dias</p>
          </CardContent>
        </Card>
      </div>

      {/* Períodos Aquisitivos */}
      <Card className="border-border/80 shadow-lg">
        <CardHeader>
          <CardTitle>Períodos Aquisitivos e Concessivos</CardTitle>
          <CardDescription>Acompanhe os saldos de dias de férias de todos os funcionários ativos.</CardDescription>
        </CardHeader>
        <CardContent>
          {vacationsQuery.isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Carregando períodos aquisitivos...</div>
          ) : periods.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Nenhum período aquisitivo registrado no sistema.</div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b font-semibold">
                  <tr>
                    <th className="p-3">Funcionário</th>
                    <th className="p-3">Período Aquisitivo</th>
                    <th className="p-3">Limite Concessivo</th>
                    <th className="p-3 text-center">Saldo (Dias)</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {periods.map((p) => {
                    const emp = employeeMap.get(p.employeeId);
                    const isNearLimit = p.status === 'CONCESSIVE' && new Date(p.concessionLimit) <= warningLimitDate;
                    return (
                      <tr key={p.id} className="hover:bg-muted/10">
                        <td className="p-3 font-medium">
                          <div>{emp?.name ?? 'Carregando...'}</div>
                          <div className="text-[10px] text-muted-foreground">Matrícula: {emp?.registrationId ?? 'N/A'}</div>
                        </td>
                        <td className="p-3 text-xs">
                          {formatDate(p.startAquisition)} a {formatDate(p.endAquisition)}
                        </td>
                        <td className="p-3 text-xs">
                          <span className={isNearLimit ? 'text-rose-500 font-bold flex items-center gap-1' : ''}>
                            {isNearLimit && <AlertTriangle className="h-3 w-3" />}
                            {formatDate(p.concessionLimit)}
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold">
                          {p.totalDays - p.takenDays} dias
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={cn(
                            p.status === 'ACQUIRING' && 'bg-amber-100 text-amber-800 border-transparent dark:bg-amber-900/20 dark:text-amber-400',
                            p.status === 'CONCESSIVE' && 'bg-sky-100 text-sky-800 border-transparent dark:bg-sky-900/20 dark:text-sky-400',
                            p.status === 'TAKEN' && 'bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-900/20 dark:text-emerald-400'
                          )}>
                            {p.status === 'ACQUIRING' ? 'Em Aquisição' : p.status === 'CONCESSIVE' ? 'Concessivo' : 'Gozado'}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          {canOperate && p.totalDays - p.takenDays > 0 && (
                            <Button size="sm" onClick={() => handleOpenSchedule(p)}>
                              <Plus className="mr-1 h-3.5 w-3.5" /> Programar
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Programações Agendadas */}
      <Card className="border-border/80 shadow-lg">
        <CardHeader>
          <CardTitle>Histórico de Férias e Agendamentos</CardTitle>
          <CardDescription>Lista de férias programadas ou já quitadas.</CardDescription>
        </CardHeader>
        <CardContent>
          {activeRequests.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Nenhuma solicitação de férias cadastrada.</div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b font-semibold">
                  <tr>
                    <th className="p-3">Funcionário</th>
                    <th className="p-3">Período de Gozo</th>
                    <th className="p-3 text-center">Dias Gozo</th>
                    <th className="p-3 text-center">Abono (Dias)</th>
                    <th className="p-3">Adiant. 13º</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activeRequests.map((r) => {
                    const emp = employeeMap.get(r.employeeId);
                    return (
                      <tr key={r.id} className="hover:bg-muted/10">
                        <td className="p-3 font-medium">
                          {emp?.name ?? 'Carregando...'}
                        </td>
                        <td className="p-3 text-xs">
                          {formatDate(r.startDate)} a {formatDate(r.endDate)}
                        </td>
                        <td className="p-3 text-center font-semibold">
                          {r.takenDays} dias
                        </td>
                        <td className="p-3 text-center text-muted-foreground">
                          {r.sellDays > 0 ? `${r.sellDays} dias` : 'Não'}
                        </td>
                        <td className="p-3 text-xs">
                          {r.advanceThirteenth ? (
                            <Badge variant="outline" className="bg-sky-50 text-sky-700 dark:bg-sky-950/20 dark:text-sky-400">Sim</Badge>
                          ) : 'Não'}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={cn(
                            r.status === 'DRAFT' && 'bg-muted text-muted-foreground',
                            r.status === 'APPROVED' && 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
                            r.status === 'CALCULATED' && 'bg-sky-100 text-sky-800 dark:bg-sky-900/20 dark:text-sky-400',
                            r.status === 'CLOSED' && 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                          )}>
                            {r.status === 'DRAFT' ? 'Rascunho' : r.status === 'APPROVED' ? 'Aprovado' : r.status === 'CALCULATED' ? 'Calculado' : 'Fechado/Pago'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOG: Programar Férias */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Calendar className="h-5 w-5 text-sky-600" /> Programar Férias
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            {selectedPeriod && (
              <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1 border">
                <div className="font-semibold text-muted-foreground">Matrícula de Ref.</div>
                <div className="font-bold text-foreground">
                  {employeeMap.get(selectedPeriod.employeeId)?.name}
                </div>
                <div className="text-muted-foreground">
                  Período Aquisitivo: {formatDate(selectedPeriod.startAquisition)} a {formatDate(selectedPeriod.endAquisition)}
                </div>
                <div className="text-rose-500 font-medium">
                  Limite de Gozo: {formatDate(selectedPeriod.concessionLimit)}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="startDate">Data de Início</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="endDate">Data de Término</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="takenDays">Dias de Gozo</Label>
                <NativeSelect
                  id="takenDays"
                  value={form.takenDays}
                  onChange={(e) => setForm({ ...form, takenDays: Number(e.target.value) })}
                >
                  <option value={30}>30 dias</option>
                  <option value={20}>20 dias</option>
                  <option value={15}>15 dias</option>
                  <option value={10}>10 dias</option>
                </NativeSelect>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sellDays">Abono Pecuniário</Label>
                <NativeSelect
                  id="sellDays"
                  value={form.sellDays}
                  onChange={(e) => setForm({ ...form, sellDays: Number(e.target.value) })}
                >
                  <option value={0}>Sem abono (0 dias)</option>
                  <option value={10}>Vender 10 dias</option>
                </NativeSelect>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                id="advanceThirteenth"
                type="checkbox"
                checked={form.advanceThirteenth}
                onChange={(e) => setForm({ ...form, advanceThirteenth: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
              <Label htmlFor="advanceThirteenth" className="text-xs font-semibold cursor-pointer">
                Adiantar a 1ª Parcela do 13º Salário
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setScheduleOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={scheduleVacation.isPending}>
                Confirmar Programação
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
