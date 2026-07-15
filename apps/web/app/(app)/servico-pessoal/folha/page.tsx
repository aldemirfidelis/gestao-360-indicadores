'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Banknote,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Coins,
  FileSpreadsheet,
  FileCode2,
  FileText,
  FolderPlus,
  Gauge,
  Lock,
  Plus,
  RefreshCw,
  Unlock,
  Users,
  Calendar,
  UserX,
  Settings,
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
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/auth-provider';

interface RunSummary {
  id: string;
  kind: 'MENSAL' | 'ADIANTAMENTO';
  status: string;
  updatedAt: string;
}

interface Competence {
  id: string;
  year: number;
  month: number;
  status: 'OPEN' | 'CLOSED';
  notes: string | null;
  createdAt: string;
  runs: RunSummary[];
}

function formatCompetenceLabel(year: number, month: number): string {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return `${months[month - 1]} de ${year}`;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  IMPORTING: 'Importando',
  CALCULATING: 'Calculando',
  CALCULATED: 'Calculado',
  WITH_ISSUES: 'Inconsistências',
  APPROVED: 'Aprovado',
  CLOSED: 'Fechado',
  REOPENED: 'Reaberto',
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground border-transparent',
  IMPORTING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-transparent',
  CALCULATING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-transparent',
  CALCULATED: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400 border-transparent',
  WITH_ISSUES: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-transparent',
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-transparent',
  CLOSED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-transparent',
  REOPENED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-transparent',
};

export default function PayrollDashboardPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canOperate = hasPermission(['folha:operate']);

  const [newCompOpen, setNewCompOpen] = useState(false);
  const [newRunOpen, setNewRunOpen] = useState(false);
  const [selectedCompId, setSelectedCompId] = useState('');

  const [compForm, setCompForm] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    notes: '',
  });

  const [runForm, setRunForm] = useState({
    kind: 'MENSAL',
  });

  const competencesQuery = useQuery<Competence[]>({
    queryKey: ['payroll-competences'],
    queryFn: () => api<Competence[]>('/payroll/competences'),
  });

  const createCompetence = useMutation({
    mutationFn: (json: typeof compForm) => api('/payroll/competences', { method: 'POST', json }),
    onSuccess: () => {
      toast.success('Competência de folha aberta com sucesso.');
      setNewCompOpen(false);
      void qc.invalidateQueries({ queryKey: ['payroll-competences'] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao abrir competência.'),
  });

  const createRun = useMutation({
    mutationFn: (json: { competenceId: string; kind: string }) => api('/payroll/runs', { method: 'POST', json }),
    onSuccess: (data: any) => {
      toast.success('Processamento criado.');
      setNewRunOpen(false);
      void qc.invalidateQueries({ queryKey: ['payroll-competences'] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao criar processamento.'),
  });

  const years = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const activeCompetences = competencesQuery.data || [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Folha de Pagamento"
        description="Controle e cálculo de folhas mensais, adiantamentos e recolhimento de encargos"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/servico-pessoal/folha/parametros">
                <FileText className="mr-2 h-4 w-4" /> Parâmetros Legais
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/servico-pessoal/folha/esocial">
                <FileCode2 className="mr-2 h-4 w-4" /> eSocial
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/servico-pessoal/folha/obrigacoes">
                <CalendarClock className="mr-2 h-4 w-4" /> Obrigações
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/servico-pessoal/folha/banco">
                <Banknote className="mr-2 h-4 w-4" /> Banco
              </Link>
            </Button>
            {canOperate && (
              <Button onClick={() => setNewCompOpen(true)} size="sm">
                <FolderPlus className="mr-2 h-4 w-4" /> Abrir Competência
              </Button>
            )}
          </div>
        }
      />

      {/* Grid de Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Competência Ativa</CardTitle>
            <CalendarDays className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeCompetences.length > 0
                ? formatCompetenceLabel(activeCompetences[0].year, activeCompetences[0].month)
                : 'Nenhuma'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Último período de fechamento cadastrado
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status da Competência</CardTitle>
            {activeCompetences[0]?.status === 'CLOSED' ? (
              <Lock className="h-4 w-4 text-purple-500" />
            ) : (
              <Unlock className="h-4 w-4 text-emerald-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeCompetences[0]?.status === 'CLOSED' ? 'Fechada' : activeCompetences.length > 0 ? 'Aberta' : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Competência ativa aceitando cálculos
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Processamentos</CardTitle>
            <ClipboardList className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeCompetences.reduce((acc, c) => acc + c.runs.length, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total de lotes de folha calculados
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Auditoria de Cálculos</CardTitle>
            <Gauge className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">100%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Rastreabilidade total e memórias salvas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rotinas Especiais de DP */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link href="/servico-pessoal/folha/ferias">
          <Card className="hover:bg-muted/30 transition-all cursor-pointer border-border/80 shadow-md">
            <CardHeader className="p-4 flex flex-row items-center gap-3">
              <Calendar className="h-8 w-8 text-sky-600 dark:text-sky-400" />
              <div>
                <CardTitle className="text-sm font-bold">Gestão de Férias</CardTitle>
                <CardDescription className="text-xs">Saldos e gozos</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/servico-pessoal/folha/decimo-terceiro">
          <Card className="hover:bg-muted/30 transition-all cursor-pointer border-border/80 shadow-md">
            <CardHeader className="p-4 flex flex-row items-center gap-3">
              <Coins className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              <div>
                <CardTitle className="text-sm font-bold">13º Salário</CardTitle>
                <CardDescription className="text-xs">1ª e 2ª parcelas</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/servico-pessoal/folha/rescisao">
          <Card className="hover:bg-muted/30 transition-all cursor-pointer border-border/80 shadow-md">
            <CardHeader className="p-4 flex flex-row items-center gap-3">
              <UserX className="h-8 w-8 text-rose-600 dark:text-rose-400" />
              <div>
                <CardTitle className="text-sm font-bold">Rescisões</CardTitle>
                <CardDescription className="text-xs">Afastamento e termos</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/servico-pessoal/folha/beneficios">
          <Card className="hover:bg-muted/30 transition-all cursor-pointer border-border/80 shadow-md">
            <CardHeader className="p-4 flex flex-row items-center gap-3">
              <Settings className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              <div>
                <CardTitle className="text-sm font-bold">Benefícios e Descontos</CardTitle>
                <CardDescription className="text-xs">VT, VA, consignados, pensões</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Lista de Competências */}
      <Card className="border-border/60 bg-card/40">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Histórico de Competências</CardTitle>
            <CardDescription>Gerencie as competências abertas e acesse os fechamentos</CardDescription>
          </div>
          <Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ['payroll-competences'] })}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/60 text-sm">
            {competencesQuery.isLoading && (
              <div className="py-8 text-center text-muted-foreground">Carregando competências...</div>
            )}
            {!competencesQuery.isLoading && activeCompetences.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">Nenhuma competência de folha encontrada. Abra uma acima para começar.</div>
            )}
            {activeCompetences.map((comp) => (
              <div key={comp.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base">{formatCompetenceLabel(comp.year, comp.month)}</span>
                    <Badge variant={comp.status === 'CLOSED' ? 'secondary' : 'default'} className="text-[10px]">
                      {comp.status === 'CLOSED' ? 'Fechado' : 'Aberto'}
                    </Badge>
                  </div>
                  {comp.notes && <p className="text-xs text-muted-foreground">{comp.notes}</p>}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Runs cadastrados */}
                  <div className="flex gap-2">
                    {comp.runs.map((run) => (
                      <Link key={run.id} href={`/servico-pessoal/folha/runs/${run.id}`}>
                        <Badge
                          variant="outline"
                          className={cn(
                            'cursor-pointer transition-colors hover:bg-muted/80 text-[11px] py-1 px-2.5 flex items-center gap-1.5 border border-border/80',
                            STATUS_BADGE[run.status]
                          )}
                        >
                          <Coins className="h-3 w-3" />
                          <span className="font-bold">{run.kind}:</span>
                          <span>{STATUS_LABEL[run.status]}</span>
                        </Badge>
                      </Link>
                    ))}
                  </div>

                  {canOperate && comp.status === 'OPEN' && (
                    <Button
                      onClick={() => {
                        setSelectedCompId(comp.id);
                        setNewRunOpen(true);
                      }}
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1"
                    >
                      <Plus className="h-3 w-3" /> Novo Lote
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* DIALOG: Nova Competência */}
      <Dialog open={newCompOpen} onOpenChange={setNewCompOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Abrir Nova Competência</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="month" className="text-right">Mês</Label>
              <NativeSelect
                id="month"
                className="col-span-3"
                value={compForm.month}
                onChange={(e) => setCompForm({ ...compForm, month: Number(e.target.value) })}
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m < 10 ? `0${m}` : m}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="year" className="text-right">Ano</Label>
              <NativeSelect
                id="year"
                className="col-span-3"
                value={compForm.year}
                onChange={(e) => setCompForm({ ...compForm, year: Number(e.target.value) })}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">Notas</Label>
              <Input
                id="notes"
                className="col-span-3"
                value={compForm.notes}
                onChange={(e) => setCompForm({ ...compForm, notes: e.target.value })}
                placeholder="Observações complementares"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createCompetence.mutate(compForm)} disabled={createCompetence.isPending}>
              {createCompetence.isPending ? 'Abrindo...' : 'Confirmar Abertura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Novo Lote (Run) */}
      <Dialog open={newRunOpen} onOpenChange={setNewRunOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Novo Lote de Processamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="kind" className="text-right">Tipo</Label>
              <NativeSelect
                id="kind"
                className="col-span-3"
                value={runForm.kind}
                onChange={(e) => setRunForm({ kind: e.target.value })}
              >
                <option value="MENSAL">Folha Mensal</option>
                <option value="ADIANTAMENTO">Adiantamento Salarial</option>
              </NativeSelect>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createRun.mutate({ competenceId: selectedCompId, kind: runForm.kind })}
              disabled={createRun.isPending}
            >
              {createRun.isPending ? 'Criando...' : 'Iniciar Processamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
