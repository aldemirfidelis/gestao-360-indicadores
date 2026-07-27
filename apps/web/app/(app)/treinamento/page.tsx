'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, GraduationCap, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { EmptyState, MetricCard } from '@/components/training/training-bits';
import { percentLabel, type TrainingOverview } from '@/lib/training/types';

export default function TreinamentoPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['training:manage', 'training:create']);
  const canClass = hasPermission(['training:class:manage', 'training:manage']);

  const overview = useQuery<TrainingOverview>({
    queryKey: ['training-overview'],
    queryFn: () => api('/training/overview'),
  });
  const data = overview.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Treinamento e Desenvolvimento"
        tone="view"
        title="Visão Geral"
        description="Conformidade da matriz, pendências, vencimentos e turmas — sobre os colaboradores e cargos reais da empresa."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canClass && (
              <Button asChild variant="outline">
                <Link href="/treinamento/turmas?nova=1">
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Nova turma
                </Link>
              </Button>
            )}
            {canManage && (
              <Button asChild>
                <Link href="/treinamento/treinamentos?novo=1">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo treinamento
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {overview.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <>
          {/* Cada card leva aos registros que compõem o número. */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Conformidade da matriz"
              value={percentLabel(data?.metrics.complianceRate)}
              hint={`${data?.metrics.employeesCompliant ?? 0} de ${data?.metrics.employeesTotal ?? 0} colaboradores em dia`}
              href="/treinamento/matriz"
            />
            <MetricCard
              label="Pendências abertas"
              value={data?.metrics.pending ?? 0}
              hint={`${data?.metrics.employeesWithPending ?? 0} colaborador(es) com pendência`}
              href="/treinamento/pendencias"
              tone="amber"
            />
            <MetricCard
              label="Vencidos"
              value={data?.metrics.expired ?? 0}
              hint="Exigem reciclagem imediata"
              href="/treinamento/pendencias?status=EXPIRED"
              tone="red"
            />
            <MetricCard
              label="Próximos do vencimento"
              value={data?.metrics.dueSoon ?? 0}
              hint="Dentro da antecedência configurada"
              href="/treinamento/pendencias?status=DUE_SOON"
              tone="amber"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Realizados no mês"
              value={data?.metrics.completedThisMonth ?? 0}
              hint={`${data?.metrics.workloadHoursThisMonth ?? 0}h de treinamento`}
            />
            <MetricCard label="Taxa de aprovação" value={percentLabel(data?.metrics.approvalRate)} hint="Sobre os resultados lançados" />
            <MetricCard
              label="Turmas programadas"
              value={data?.metrics.classesPlanned ?? 0}
              href="/treinamento/turmas"
            />
            <MetricCard
              label="Certificados a validar"
              value={data?.metrics.certificatesPending ?? 0}
              hint="Comprovantes externos aguardando análise"
              href="/treinamento/pendencias?aba=certificados"
              tone={data?.metrics.certificatesPending ? 'amber' : undefined}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <h2 className="mb-3 text-sm font-semibold">Pendências por área</h2>
                {(data?.byArea.length ?? 0) === 0 ? (
                  <EmptyState title="Nenhuma pendência por área." description="Nenhum colaborador com treinamento em aberto nos filtros atuais." />
                ) : (
                  <ul className="divide-y">
                    {data!.byArea.map((row) => (
                      <li key={row.areaId ?? 'sem-area'}>
                        <Link
                          href={`/treinamento/pendencias${row.areaId ? `?orgNodeId=${row.areaId}` : ''}`}
                          className="flex items-center justify-between gap-3 py-2 text-sm transition-colors hover:text-primary"
                        >
                          <span className="truncate">{row.area}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">{row.pending}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h2 className="mb-3 text-sm font-semibold">Pendências por treinamento</h2>
                {(data?.byTraining.length ?? 0) === 0 ? (
                  <EmptyState title="Nenhuma pendência por treinamento." />
                ) : (
                  <ul className="divide-y">
                    {data!.byTraining.map((row) => (
                      <li key={row.trainingId}>
                        <Link
                          href={`/treinamento/pendencias?trainingId=${row.trainingId}`}
                          className="flex items-center justify-between gap-3 py-2 text-sm transition-colors hover:text-primary"
                        >
                          <span className="min-w-0 truncate">
                            <span className="text-muted-foreground">{row.code}</span> {row.name}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">{row.pending}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {(data?.metrics.employeesTotal ?? 0) === 0 && (
            <Card>
              <CardContent className="p-6 text-center">
                <GraduationCap className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">Nenhum colaborador ativo encontrado.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  A matriz é montada sobre o cadastro do Serviço Pessoal. Cadastre os colaboradores para que as exigências
                  por cargo e área passem a gerar pendências.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
