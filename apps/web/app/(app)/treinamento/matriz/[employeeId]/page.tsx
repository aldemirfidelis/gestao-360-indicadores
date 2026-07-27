'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { EmptyState, MetricCard, RequirementOrigin, StatusPill } from '@/components/training/training-bits';
import { hoursLabel, percentLabel, type AssignmentItem } from '@/lib/training/types';

interface EmployeeHistory {
  employee: {
    id: string;
    name: string;
    registrationId?: string | null;
    status: string;
    job?: { name: string } | null;
    orgNode?: { name: string } | null;
  };
  compliance: number | null;
  workloadHours: number;
  assignments: AssignmentItem[];
  history: Array<{
    id: string;
    event: string;
    description?: string | null;
    previousValue?: string | null;
    newValue?: string | null;
    reason?: string | null;
    createdAt: string;
  }>;
}

/** Rótulos dos eventos da linha do tempo (nada de código do banco na tela). */
const EVENT_LABEL: Record<string, string> = {
  REQUIREMENT_CREATED: 'Exigência criada',
  ENROLLED: 'Inscrito em turma',
  SUMMONED: 'Convocado',
  ATTENDED: 'Participou',
  ABSENT: 'Ausente',
  ASSESSED: 'Avaliado',
  APPROVED: 'Aprovado',
  FAILED: 'Reprovado',
  CERTIFIED: 'Certificado',
  EXPIRED: 'Vencido',
  RECYCLED: 'Reciclagem',
  WAIVED: 'Dispensado',
  JOB_CHANGED: 'Alteração de cargo',
  MATRIX_CHANGED: 'Alteração da matriz',
  DOCUMENT_REVISED: 'Documento revisado',
  REVISION_TRAINED: 'Treinado na revisão',
};

export default function ColaboradorTreinamentoPage() {
  const params = useParams<{ employeeId: string }>();
  const employeeId = params?.employeeId;

  const data = useQuery<EmployeeHistory>({
    queryKey: ['training-employee-history', employeeId],
    queryFn: () => api(`/training/employees/${employeeId}/history`),
    enabled: Boolean(employeeId),
  });

  if (data.isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data.data) return <p className="py-16 text-center text-sm text-muted-foreground">Colaborador não encontrado.</p>;

  const { employee, assignments, history } = data.data;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Treinamento e Desenvolvimento"
        tone="view"
        title={employee.name}
        description={[employee.job?.name, employee.orgNode?.name].filter(Boolean).join(' · ') || undefined}
        breadcrumbs={[
          { label: 'Treinamento', href: '/treinamento' },
          { label: 'Matriz', href: '/treinamento/matriz' },
          { label: employee.name },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Conformidade" value={percentLabel(data.data.compliance)} hint="Exigências resolvidas sobre o total" />
        <MetricCard label="Carga horária acumulada" value={`${data.data.workloadHours}h`} hint="Treinamentos concluídos" />
        <MetricCard
          label="Matrícula"
          value={employee.registrationId ?? '—'}
          hint={employee.status === 'ACTIVE' ? 'Colaborador ativo' : 'Colaborador inativo'}
        />
      </div>

      <Tabs defaultValue="matriz" className="space-y-4">
        <TabsList>
          <TabsTrigger value="matriz">Matriz do colaborador</TabsTrigger>
          <TabsTrigger value="historico">Linha do tempo</TabsTrigger>
        </TabsList>

        <TabsContent value="matriz">
          {assignments.length === 0 ? (
            <EmptyState
              title="Nenhuma exigência de treinamento para este colaborador."
              description="As exigências nascem das regras cadastradas para o cargo, a área ou a empresa."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Treinamento</th>
                    <th className="px-4 py-2.5 text-left font-medium">Origem</th>
                    <th className="px-4 py-2.5 text-left font-medium">Situação</th>
                    <th className="px-4 py-2.5 text-left font-medium">Realizado</th>
                    <th className="px-4 py-2.5 text-left font-medium">Validade</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {assignments.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{row.training.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {row.training.code} · {hoursLabel(row.training.workloadMinutes)}
                        </div>
                      </td>
                      <td className="max-w-[240px] px-4 py-2.5">
                        <RequirementOrigin origin={row.origin} />
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill status={row.status} />
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {row.completedAt ? formatDate(row.completedAt) : '—'}
                        {row.score !== null && row.score !== undefined && (
                          <div className="text-[11px]">Nota {row.score}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {row.validUntil ? formatDate(row.validUntil) : row.dueAt ? `Prazo ${formatDate(row.dueAt)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardContent className="p-4">
              {history.length === 0 ? (
                <EmptyState title="Sem eventos registrados." />
              ) : (
                <ol className="space-y-2.5">
                  {history.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap items-baseline gap-2 border-b pb-2 text-sm last:border-0">
                      <span className="w-32 shrink-0 text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
                      <span className="font-medium">{EVENT_LABEL[entry.event] ?? entry.event}</span>
                      {entry.description && <span className="text-muted-foreground">{entry.description}</span>}
                      {entry.previousValue && entry.newValue && (
                        <span className="text-[11px] text-muted-foreground">
                          ({entry.previousValue} → {entry.newValue})
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
