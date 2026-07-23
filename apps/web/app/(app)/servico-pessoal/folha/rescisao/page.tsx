'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FileText,
  UserX,
  Plus,
  ArrowLeft,
  Users,
  AlertCircle,
  TrendingDown,
  Info,
  Calendar,
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

interface Employee {
  id: string;
  name: string;
  registrationId: string;
  hiringDate: string;
}

interface Termination {
  id: string;
  employeeId: string;
  terminationDate: string;
  kind: string;
  noticeType: string;
  noticeDays: number;
  status: string;
  resultsJson: any;
}

export default function TerminationsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canOperate = hasPermission(['folha:operate']);

  const [simulateOpen, setSimulateOpen] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [showResult, setShowResult] = useState(false);
  // Resultado real do motor (prévia ou registro): { header, calc: resultsJson-like }
  const [simulationResult, setSimulationResult] = useState<{
    employeeId: string;
    kind: string;
    noticeType: string;
    noticeDays: number;
    terminationDate: string;
    persisted: boolean;
    calc: {
      grossValue: number;
      deductionsValue: number;
      netValue: number;
      fgtsFineCents?: number;
      items?: Array<{ rubricCode: string; rubricName: string; nature: string; reference: string; amountCents: number }>;
      issues?: string[];
    };
  } | null>(null);

  const [form, setForm] = useState({
    terminationDate: new Date().toISOString().split('T')[0],
    kind: 'DISPENSA_SEM_JUSTA_CAUSA',
    noticeType: 'INDENIZADO',
    noticeDays: 30,
    fgtsBalance: '',
    expiredVacationAvos: 0,
  });

  const employeesQuery = useQuery<Employee[]>({
    queryKey: ['personnel-employees'],
    // /personnel/employees devolve { items, kpis }; item usa admissionDate (não hiringDate).
    queryFn: async () => {
      const res = await api<{ items: Array<{ id: string; name: string; registrationId: string; admissionDate: string | null }> }>('/personnel/employees');
      return (res.items ?? []).map((e) => ({ id: e.id, name: e.name, registrationId: e.registrationId, hiringDate: e.admissionDate ?? '' }));
    },
  });

  const terminationsQuery = useQuery<Termination[]>({
    queryKey: ['payroll-terminations'],
    queryFn: () => api<Termination[]>('/payroll/terminations'),
  });

  const buildPayload = () => ({
    employeeId: selectedEmpId,
    terminationDate: form.terminationDate,
    kind: form.kind,
    noticeType: form.noticeType,
    noticeDays: Number(form.noticeDays),
    fgtsBalance: form.fgtsBalance ? Number(form.fgtsBalance) : 0,
    expiredVacationAvos: Number(form.expiredVacationAvos) || 0,
  });

  const openResult = (calc: any, persisted: boolean) => {
    setSimulateOpen(false);
    setShowResult(true);
    setSimulationResult({
      employeeId: selectedEmpId,
      kind: form.kind,
      noticeType: form.noticeType,
      noticeDays: Number(form.noticeDays),
      terminationDate: form.terminationDate,
      persisted,
      calc,
    });
  };

  // Prévia com o motor real, sem gravar nada.
  const previewTermination = useMutation({
    mutationFn: () => api<any>('/payroll/terminations/preview', { method: 'POST', json: buildPayload() }),
    onSuccess: (data: any) => {
      openResult(
        {
          grossValue: data.totals?.earningsCents ?? 0,
          deductionsValue: data.totals?.deductionsCents ?? 0,
          netValue: data.totals?.netCents ?? 0,
          fgtsFineCents: data.informative?.fgtsFineCents ?? 0,
          items: data.items ?? [],
          issues: data.issues ?? [],
        },
        false,
      );
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao simular rescisão.'),
  });

  const createTermination = useMutation({
    mutationFn: () => api<any>('/payroll/terminations', { method: 'POST', json: buildPayload() }),
    onSuccess: (data: any) => {
      toast.success('Desligamento registrado com verbas calculadas pelo motor.');
      openResult(data.resultsJson ?? {}, true);
      void qc.invalidateQueries({ queryKey: ['payroll-terminations'] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao registrar rescisão.'),
  });

  const employeeMap = new Map(employeesQuery.data?.map((e) => [e.id, e]));

  const terminations = terminationsQuery.data ?? [];
  const employees = employeesQuery.data ?? [];

  const handleOpenSimulate = () => {
    if (employees.length === 0) {
      toast.error('Nenhum funcionário encontrado.');
      return;
    }
    setSelectedEmpId(employees[0]?.id ?? '');
    setSimulateOpen(true);
    setShowResult(false);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) {
      toast.error('Selecione o funcionário para simular.');
      return;
    }
    createTermination.mutate();
  };

  const formatDate = (d: string) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  const TERMINATION_KINDS: Record<string, string> = {
    DISPENSA_SEM_JUSTA_CAUSA: 'Dispensa Sem Justa Causa',
    PEDIDO: 'Pedido de Demissão',
    ACORDO: 'Acordo Consensual',
  };

  const formatCurrency = (val: number) => {
    return (val / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
          title="Rescisões e Desligamentos"
          description="Simulação de rescisão CLT, cálculo de saldo de salário, aviso prévio, férias vencidas/proporcionais e 13º salário avos."
        />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-gradient-to-br from-background to-muted/50 border-border/80 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Desligamentos Registrados</CardTitle>
            <UserX className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{terminations.length}</div>
            <p className="text-xs text-muted-foreground">Histórico de rescisões no sistema</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-background to-muted/50 border-border/80 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média de Aviso Prévio</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">30 dias</div>
            <p className="text-xs text-muted-foreground">Regra padrão de aviso CLT</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-background to-muted/50 border-border/80 shadow-md md:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Impacto no Caixa Mensal</CardTitle>
            <TrendingDown className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">Calculado no processamento</div>
            <p className="text-xs text-muted-foreground">Indenizações e verbas rescisórias</p>
          </CardContent>
        </Card>
      </div>

      {/* Histórico de Rescisões */}
      <Card className="border-border/80 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Histórico e Simulações de Desligamento</CardTitle>
            <CardDescription>Lista de rescisões efetuadas ou em rascunho de conferência.</CardDescription>
          </div>
          {canOperate && (
            <Button onClick={handleOpenSimulate}>
              <Plus className="mr-1 h-4 w-4" /> Nova Rescisão
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {terminationsQuery.isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Carregando desligamentos...</div>
          ) : terminations.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Nenhuma rescisão ou simulação cadastrada.</div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b font-semibold">
                  <tr>
                    <th className="p-3">Funcionário</th>
                    <th className="p-3">Data Desligamento</th>
                    <th className="p-3">Tipo de Rescisão</th>
                    <th className="p-3">Aviso Prévio</th>
                    <th className="p-3">Líquido Simulado</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {terminations.map((t) => {
                    const emp = employeeMap.get(t.employeeId);
                    const results = t.resultsJson as any;
                    return (
                      <tr key={t.id} className="hover:bg-muted/10">
                        <td className="p-3 font-medium">
                          {emp?.name ?? 'Funcionário Desligado'}
                        </td>
                        <td className="p-3 text-xs">
                          {formatDate(t.terminationDate)}
                        </td>
                        <td className="p-3 text-xs">
                          {TERMINATION_KINDS[t.kind] ?? t.kind}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {t.noticeType} ({t.noticeDays} dias)
                        </td>
                        <td className="p-3 font-semibold text-rose-500">
                          {results?.netValue ? formatCurrency(results.netValue) : 'Sob recálculo'}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="bg-sky-100 text-sky-800 border-transparent dark:bg-sky-900/20 dark:text-sky-400">
                            {t.status}
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

      {/* DIALOG: Simular Rescisão */}
      <Dialog open={simulateOpen} onOpenChange={setSimulateOpen}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <UserX className="h-5 w-5 text-rose-500" /> Assistente de Rescisão CLT
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="employeeId">Selecione o Colaborador</Label>
              <NativeSelect
                id="employeeId"
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} (Admissão: {formatDate(e.hiringDate)})
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1">
              <Label htmlFor="terminationDate">Data de Afastamento / Rescisão</Label>
              <Input
                id="terminationDate"
                type="date"
                value={form.terminationDate}
                onChange={(e) => setForm({ ...form, terminationDate: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="kind">Tipo de Afastamento</Label>
                <NativeSelect
                  id="kind"
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value })}
                >
                  <option value="DISPENSA_SEM_JUSTA_CAUSA">Dispensa sem Justa Causa</option>
                  <option value="PEDIDO">Pedido de Demissão</option>
                  <option value="ACORDO">Acordo Consensual (Art. 484-A)</option>
                </NativeSelect>
              </div>
              <div className="space-y-1">
                <Label htmlFor="noticeType">Aviso Prévio</Label>
                <NativeSelect
                  id="noticeType"
                  value={form.noticeType}
                  onChange={(e) => setForm({ ...form, noticeType: e.target.value })}
                >
                  <option value="INDENIZADO">Indenizado</option>
                  <option value="TRABALHADO">Trabalhado</option>
                  <option value="DISPENSADO">Dispensado</option>
                </NativeSelect>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="noticeDays">Dias de Aviso Prévio (Mínimo 30 dias)</Label>
              <Input
                id="noticeDays"
                type="number"
                value={form.noticeDays}
                onChange={(e) => setForm({ ...form, noticeDays: Number(e.target.value) })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="fgtsBalance">Saldo do FGTS (R$) — p/ multa</Label>
                <Input
                  id="fgtsBalance"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.fgtsBalance}
                  onChange={(e) => setForm({ ...form, fgtsBalance: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="expiredVacationAvos">Férias vencidas (avos 0–12)</Label>
                <Input
                  id="expiredVacationAvos"
                  type="number"
                  min="0"
                  max="12"
                  value={form.expiredVacationAvos}
                  onChange={(e) => setForm({ ...form, expiredVacationAvos: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="p-3 bg-muted/40 border border-muted/80 rounded-md text-[11px] text-muted-foreground flex gap-1.5">
              <Info className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                As verbas são calculadas pelo motor real da folha com o salário vigente em Cargos e Salários: saldo de
                salário, aviso prévio (30 + 3/ano, teto 90), 13º e férias proporcionais + 1/3, INSS/IRRF com incidências
                corretas e multa do FGTS quando o saldo é informado.
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setSimulateOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={previewTermination.isPending || !selectedEmpId}
                onClick={() => previewTermination.mutate()}
              >
                Somente Simular
              </Button>
              <Button type="submit" disabled={createTermination.isPending}>
                Efetivar e Calcular
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Resultado do Cálculo da Rescisão (motor real) */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {simulationResult?.persisted ? 'Rescisão Registrada — Verbas Calculadas' : 'Prévia da Rescisão — Motor Real'}
            </DialogTitle>
          </DialogHeader>
          {simulationResult && (
            <div className="space-y-4">
              <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-md text-xs">
                <div className="font-semibold text-muted-foreground">Colaborador</div>
                <div className="font-bold text-foreground text-sm">
                  {employeeMap.get(simulationResult.employeeId)?.name}
                </div>
                <div className="mt-1 text-muted-foreground">
                  Tipo: {TERMINATION_KINDS[simulationResult.kind] ?? simulationResult.kind} · Aviso: {simulationResult.noticeType} ({simulationResult.noticeDays} dias)
                </div>
                <div className="text-muted-foreground">
                  Data de Rescisão: {formatDate(simulationResult.terminationDate)}
                </div>
                {!simulationResult.persisted && (
                  <div className="mt-1 font-semibold text-amber-600 dark:text-amber-400">Simulação — nada foi gravado.</div>
                )}
              </div>

              {(simulationResult.calc.items?.length ?? 0) > 0 && (
                <div className="max-h-[280px] overflow-y-auto border rounded-md divide-y text-xs">
                  {simulationResult.calc.items!.map((item, index) => (
                    <div key={index} className="p-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{item.rubricName}</div>
                        <div className="text-[10px] text-muted-foreground">{item.reference}</div>
                      </div>
                      <span
                        className={
                          item.nature === 'PROVENTO'
                            ? 'shrink-0 font-semibold text-emerald-600 dark:text-emerald-400'
                            : item.nature === 'DESCONTO'
                              ? 'shrink-0 font-semibold text-rose-600 dark:text-rose-400'
                              : 'shrink-0 text-muted-foreground'
                        }
                      >
                        {item.nature === 'DESCONTO' ? '- ' : item.nature === 'INFORMATIVA' ? '· ' : ''}
                        {formatCurrency(item.amountCents)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border rounded-md divide-y text-sm">
                <div className="p-3 flex justify-between bg-muted/20 font-bold">
                  <span>Total de Verbas Brutas</span>
                  <span>{formatCurrency(simulationResult.calc.grossValue ?? 0)}</span>
                </div>
                <div className="p-3 flex justify-between text-muted-foreground">
                  <span>Total de Descontos (INSS/IRRF)</span>
                  <span>- {formatCurrency(simulationResult.calc.deductionsValue ?? 0)}</span>
                </div>
                {(simulationResult.calc.fgtsFineCents ?? 0) > 0 && (
                  <div className="p-3 flex justify-between text-muted-foreground">
                    <span>Multa FGTS (encargo do empregador)</span>
                    <span>{formatCurrency(simulationResult.calc.fgtsFineCents!)}</span>
                  </div>
                )}
                <div className="p-3 flex justify-between bg-rose-500/5 font-extrabold text-rose-600 dark:text-rose-400 text-lg border-t">
                  <span>Líquido da Rescisão</span>
                  <span>{formatCurrency(simulationResult.calc.netValue ?? 0)}</span>
                </div>
              </div>

              {(simulationResult.calc.issues?.length ?? 0) > 0 && (
                <div className="p-3 bg-amber-500/5 border border-amber-500/30 rounded-md text-[11px] text-amber-700 dark:text-amber-400 space-y-1">
                  {simulationResult.calc.issues!.map((issue, index) => (
                    <div key={index} className="flex gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{issue}</span>
                    </div>
                  ))}
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button onClick={() => setShowResult(false)}>Fechar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
