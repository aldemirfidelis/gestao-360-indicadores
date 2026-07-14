'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarClock,
  Clock,
  Coins,
  FileCheck,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Info,
  TrendingDown,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatCurrency, formatCompetence } from '@/components/payroll/payslip-card';
import PayslipCard from '@/components/payroll/payslip-card';

interface MemoryStep {
  step: string;
  formula: string;
  inputs: Record<string, string | number>;
  resultCents: number;
  legalVersionId?: string;
}

interface WorkerMemoryDetail {
  id: string;
  companyId: string;
  runId: string;
  employeeId: string;
  status: string;
  baseSalary: string;
  totalEarnings: string;
  totalDeductions: string;
  netPay: string;
  inssBase: string;
  inssValue: string;
  irrfBase: string;
  irrfValue: string;
  fgtsBase: string;
  fgtsValue: string;
  issues: string[] | null;
  memory: MemoryStep[];
  employee: {
    name: string;
    registrationId: string | null;
  } | null;
  items: Array<{
    id: string;
    rubricCode: string;
    rubricName: string;
    nature: 'PROVENTO' | 'DESCONTO' | 'BASE' | 'INFORMATIVA';
    reference: string | null;
    amount: string;
    origin: string;
  }>;
  run: {
    id: string;
    status: string;
    kind: string;
    legalRefs: Record<string, string> | null;
    competence: {
      year: number;
      month: number;
    };
  };
}

export default function WorkerMemoryPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const memoryQuery = useQuery<WorkerMemoryDetail>({
    queryKey: ['payroll-worker-memory', id],
    queryFn: () => api<WorkerMemoryDetail>(`/payroll/workers/${id}/memory`),
    enabled: !!id,
  });

  if (memoryQuery.isLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Carregando memória de cálculo...</div>;
  }

  if (memoryQuery.isError || !memoryQuery.data) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Memória de cálculo não encontrada.</div>;
  }

  const w = memoryQuery.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/servico-pessoal/folha/runs/${w.runId}`} className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar para o Lote
        </Link>
      </div>

      <PageHeader
        title={w.employee?.name || 'Colaborador'}
        description={`Matrícula: ${w.employee?.registrationId || '—'} · Lote: ${w.run.kind} de ${formatCompetence(w.run.competence.year, w.run.competence.month)}`}
      />

      {/* Grid de Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/60">
          <CardHeader className="py-3">
            <CardDescription className="uppercase font-bold text-[9px] tracking-wider text-muted-foreground">Salário Base</CardDescription>
            <CardTitle className="text-xl font-bold">R$ {formatCurrency(w.baseSalary)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/60">
          <CardHeader className="py-3">
            <CardDescription className="uppercase font-bold text-[9px] tracking-wider text-muted-foreground">Proventos</CardDescription>
            <CardTitle className="text-xl font-bold text-emerald-600 dark:text-emerald-500">R$ {formatCurrency(w.totalEarnings)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/60">
          <CardHeader className="py-3">
            <CardDescription className="uppercase font-bold text-[9px] tracking-wider text-muted-foreground">Descontos</CardDescription>
            <CardTitle className="text-xl font-bold text-red-600 dark:text-red-400">R$ {formatCurrency(w.totalDeductions)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/60 bg-blue-500/5">
          <CardHeader className="py-3">
            <CardDescription className="uppercase font-bold text-[9px] tracking-wider text-blue-500">Valor Líquido</CardDescription>
            <CardTitle className="text-xl font-extrabold text-blue-600 dark:text-blue-400">R$ {formatCurrency(w.netPay)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="memory" className="space-y-4">
        <TabsList className="bg-muted/40 p-1 border border-border/60">
          <TabsTrigger value="memory" className="text-xs">Memória de Cálculo</TabsTrigger>
          <TabsTrigger value="holerite" className="text-xs">Contracheque (Recibo)</TabsTrigger>
        </TabsList>

        {/* Memória de Cálculo detalhada */}
        <TabsContent value="memory">
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Passos do Motor */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Passos Executados pelo Motor</CardTitle>
                  <CardDescription>Rastreamento das equações aritméticas executadas em centavos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {w.memory.map((step, idx) => (
                    <div key={idx} className="p-3 border border-border/80 rounded-lg hover:bg-muted/5 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-foreground uppercase">{step.step}</span>
                        <span className="font-mono text-xs font-semibold bg-muted/60 px-2 py-0.5 rounded text-blue-600 dark:text-blue-400">
                          R$ {formatCurrency((step.resultCents / 100).toString())}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs font-mono">{step.formula}</p>

                      {/* Inputs do passo */}
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-border/40 pt-2 text-[11px] font-mono">
                        {Object.entries(step.inputs).map(([key, val]) => (
                          <div key={key} className="flex flex-col">
                            <span className="text-muted-foreground/80 font-bold uppercase text-[9px]">{key}</span>
                            <span className="text-foreground">{val}</span>
                          </div>
                        ))}
                        {step.legalVersionId && (
                          <div className="flex flex-col col-span-2 sm:col-span-1">
                            <span className="text-amber-600 dark:text-amber-500 font-bold uppercase text-[9px] flex items-center gap-0.5">
                              Tabela Legal
                            </span>
                            <span className="truncate text-amber-700 dark:text-amber-400 text-[10px]">
                              {step.legalVersionId.slice(0, 8)}...
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Rubricas calculadas no lote */}
            <div className="space-y-4">
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Rubricas do Colaborador</CardTitle>
                  <CardDescription>Valores persistidos na folha</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/60 text-xs">
                    {w.items.map((item) => (
                      <div key={item.id} className="p-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-muted-foreground">{item.rubricCode}</span>
                            <span className="font-semibold uppercase">{item.rubricName}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-0.5 block">
                            Ref: {item.reference || '—'} · Origem: {item.origin}
                          </span>
                        </div>
                        <span
                          className={cn(
                            'font-bold font-mono',
                            item.nature === 'PROVENTO' && 'text-emerald-600 dark:text-emerald-500',
                            item.nature === 'DESCONTO' && 'text-red-600 dark:text-red-400',
                            item.nature === 'INFORMATIVA' && 'text-muted-foreground',
                            item.nature === 'BASE' && 'text-blue-500'
                          )}
                        >
                          {item.nature === 'DESCONTO' ? '-' : ''} R$ {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Visualização de Holerite */}
        <TabsContent value="holerite" className="max-w-[700px] mx-auto">
          <PayslipCard data={w as any} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
