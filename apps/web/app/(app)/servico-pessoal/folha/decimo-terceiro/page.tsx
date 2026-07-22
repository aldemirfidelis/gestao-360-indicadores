'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Banknote,
  Percent,
  CheckCircle,
  FileSpreadsheet,
  Plus,
  ArrowLeft,
  Users,
  Calendar,
  AlertCircle,
  Coins,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  name: string;
  registrationId: string;
  hiringDate: string;
}

interface Competence {
  id: string;
  year: number;
  month: number;
  status: 'OPEN' | 'CLOSED';
}

export default function ThirteenthSalaryPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canOperate = hasPermission(['folha:operate']);

  const [batchOpen, setBatchOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({
    competenceId: '',
    kind: 'DECIMO_TERCEIRO_1',
  });

  const employeesQuery = useQuery<Employee[]>({
    queryKey: ['personnel-employees'],
    // /personnel/employees devolve { items, kpis }; item usa admissionDate (não hiringDate).
    queryFn: async () => {
      const res = await api<{ items: Array<{ id: string; name: string; registrationId: string; admissionDate: string | null }> }>('/personnel/employees');
      return (res.items ?? []).map((e) => ({ id: e.id, name: e.name, registrationId: e.registrationId, hiringDate: e.admissionDate ?? '' }));
    },
  });

  const competencesQuery = useQuery<Competence[]>({
    queryKey: ['payroll-competences'],
    queryFn: () => api<Competence[]>('/payroll/competences'),
  });

  const createRun = useMutation({
    mutationFn: (json: any) => api('/payroll/runs', { method: 'POST', json }),
    onSuccess: (data: any) => {
      toast.success('Lote de 13º Salário gerado com sucesso.');
      setBatchOpen(false);
      void qc.invalidateQueries({ queryKey: ['payroll-competences'] });
      if (data?.id) {
        router.push(`/servico-pessoal/folha/runs/${data.id}`);
      }
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao gerar lote.'),
  });

  const formatCurrency = (val: number) => {
    return (val / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const calculateAvos = (hiringDateStr: string) => {
    if (!hiringDateStr) return 12;
    const hire = new Date(hiringDateStr);
    const currentYear = new Date().getFullYear();
    if (hire.getFullYear() < currentYear) return 12;
    if (hire.getFullYear() > currentYear) return 0;
    
    // Contar avos no ano corrente (se contratado antes do dia 15, conta o mês completo)
    const month = hire.getMonth();
    const day = hire.getDate();
    const startMonth = day <= 15 ? month : month + 1;
    return Math.max(0, 12 - startMonth);
  };

  const employees = employeesQuery.data ?? [];
  const openCompetences = competencesQuery.data?.filter((c) => c.status === 'OPEN') ?? [];

  const handleOpenBatch = () => {
    if (openCompetences.length === 0) {
      toast.error('Nenhuma competência está aberta. Abra uma competência antes de prosseguir.');
      return;
    }
    setBatchForm({
      competenceId: openCompetences[0]?.id ?? '',
      kind: 'DECIMO_TERCEIRO_1',
    });
    setBatchOpen(true);
  };

  const onSubmitBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchForm.competenceId) {
      toast.error('Selecione uma competência ativa.');
      return;
    }
    createRun.mutate(batchForm);
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
          title="13º Salário (Gratificação Natalina)"
          description="Apuração de avos de direito, lançamento de adiantamentos (1ª parcela) e quitação anual (2ª parcela)."
        />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-background to-muted/50 border-border/80 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Colaboradores CLT</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
            <p className="text-xs text-muted-foreground">Elegíveis para gratificação</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-background to-muted/50 border-border/80 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prazo 1ª Parcela</CardTitle>
            <Calendar className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">30 de Nov</div>
            <p className="text-xs text-muted-foreground">Data limite de pagamento por lei</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-background to-muted/50 border-border/80 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prazo 2ª Parcela</CardTitle>
            <Calendar className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">20 de Dez</div>
            <p className="text-xs text-muted-foreground">Data limite para quitação de saldo</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Previsão de Avos */}
      <Card className="border-border/80 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Apuração e Projeção de Avos</CardTitle>
            <CardDescription>Visualização dos avos de direito calculados com base na data de admissão.</CardDescription>
          </div>
          {canOperate && (
            <Button onClick={handleOpenBatch}>
              <Plus className="mr-1 h-4 w-4" /> Gerar Lote do 13º
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {employeesQuery.isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Carregando listagem de funcionários...</div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b font-semibold">
                  <tr>
                    <th className="p-3">Funcionário</th>
                    <th className="p-3">Data Admissão</th>
                    <th className="p-3 text-center">Avos no Ano</th>
                    <th className="p-3 text-center">Percentual de Direito</th>
                    <th className="p-3 text-right">Previsão Proporcional (Integral)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employees.map((e) => {
                    const avos = calculateAvos(e.hiringDate);
                    const pct = Math.round((avos / 12) * 100);
                    return (
                      <tr key={e.id} className="hover:bg-muted/10">
                        <td className="p-3 font-medium">
                          <div>{e.name}</div>
                          <div className="text-[10px] text-muted-foreground">Matrícula: {e.registrationId}</div>
                        </td>
                        <td className="p-3 text-xs">
                          {e.hiringDate ? new Date(e.hiringDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A'}
                        </td>
                        <td className="p-3 text-center font-bold">
                          {avos} / 12 avos
                        </td>
                        <td className="p-3 text-center text-xs">
                          <Badge variant="outline" className={cn(
                            avos === 12 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
                            'border-transparent'
                          )}>
                            {pct}% do valor
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-medium text-muted-foreground">
                          Projeção calculada no fechamento
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

      {/* DIALOG: Emissão de Lote do 13º */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Coins className="h-5 w-5 text-indigo-600" /> Emissão de Lote de 13º Salário
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmitBatch} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Competência Ativa</label>
              <NativeSelect
                value={batchForm.competenceId}
                onChange={(e) => setBatchForm({ ...batchForm, competenceId: e.target.value })}
              >
                {openCompetences.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.month.toString().padStart(2, '0')}/{c.year} - Aberta
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Parcela do 13º</label>
              <NativeSelect
                value={batchForm.kind}
                onChange={(e) => setBatchForm({ ...batchForm, kind: e.target.value })}
              >
                <option value="DECIMO_TERCEIRO_1">1ª Parcela (Adiantamento 50% - Isento de INSS/IRRF)</option>
                <option value="DECIMO_TERCEIRO_2">2ª Parcela (Quitação Integral com descontos progressivos)</option>
              </NativeSelect>
            </div>

            <div className="p-3 bg-muted/40 border border-muted/80 rounded-md text-[11px] text-muted-foreground flex gap-2">
              <AlertCircle className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                {batchForm.kind === 'DECIMO_TERCEIRO_1' ? (
                  <span>
                    A **1ª Parcela** antecipa 50% do salário base de direito. Não há recolhimento de INSS ou IRRF neste momento. Incide apenas encargo de FGTS mensal sobre o valor bruto.
                  </span>
                ) : (
                  <span>
                    A **2ª Parcela** calcula o 13º integral de direito do ano, deduz os valores pagos na 1ª parcela e aplica os descontos de INSS e IRRF específicos s/ 13º.
                  </span>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setBatchOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createRun.isPending}>
                Gerar Processamento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
