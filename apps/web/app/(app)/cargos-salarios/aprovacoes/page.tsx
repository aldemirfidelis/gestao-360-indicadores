'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Play, X } from 'lucide-react';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/utils';

interface ApprovalsData {
  movements: Array<{ id: string; protocol: string; type: string; reason: string; status: string; monthlyImpact: string | number | null; createdAt: string }>;
  descriptions: Array<{ id: string; version: number; status: string; updatedAt: string; jobCatalog?: { code: string; name: string } | null }>;
  salaryTables: Array<{ id: string; code: string; name: string; status: string; version: number; ranges: unknown[]; updatedAt: string }>;
  simulations: Array<{ id: string; name: string; scenarioType: string; status: string; monthlyImpact: string | number | null; createdAt: string }>;
}

export default function AprovacoesCargosSalariosPage() {
  const qc = useQueryClient();
  const approvalsQuery = useQuery<ApprovalsData>({ queryKey: ['compensation', 'approvals'], queryFn: () => api('/cargos-salarios/approvals') });
  const runAction = useMutation({
    mutationFn: ({ url, method, body }: { url: string; method: 'PATCH' | 'POST'; body?: Record<string, unknown> }) => api(url, { method, json: body ?? {} }),
    onSuccess: () => {
      toast.success('Aprovacao atualizada');
      qc.invalidateQueries({ queryKey: ['compensation', 'approvals'] });
      qc.invalidateQueries({ queryKey: ['compensation', 'movements'] });
      qc.invalidateQueries({ queryKey: ['compensation', 'salary-tables'] });
      qc.invalidateQueries({ queryKey: ['compensation', 'simulations'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao atualizar aprovacao'),
  });
  const data = approvalsQuery.data;

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salarios"
        title="Aprovacoes"
        description="Fila integrada de movimentacoes, descricoes, tabelas salariais e simulacoes do modulo."
        breadcrumbs={[{ label: 'Inicio', href: '/' }, { label: 'Cargos e Salarios', href: '/cargos-salarios' }, { label: 'Aprovacoes' }]}
      />
      <CompensationModuleNav />

      {approvalsQuery.isLoading && <LoadingState />}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title={`Movimentacoes (${data?.movements.length ?? 0})`}>
          <div className="space-y-2">
            {(data?.movements ?? []).map((movement) => (
              <div key={movement.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{movement.protocol} - {movement.type}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{movement.reason} - {formatDate(movement.createdAt)}</div>
                    <div className="mt-1 text-xs">Impacto: {formatMoney(movement.monthlyImpact)}</div>
                  </div>
                  <Badge>{movement.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {movement.status === 'APPROVED' ? (
                    <Button size="sm" onClick={() => runAction.mutate({ url: `/cargos-salarios/movements/${movement.id}/apply`, method: 'PATCH' })} disabled={runAction.isPending}>
                      <Play className="mr-2 h-4 w-4" />
                      Aplicar
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" onClick={() => runAction.mutate({ url: `/cargos-salarios/movements/${movement.id}/approve`, method: 'PATCH' })} disabled={runAction.isPending}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Aprovar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => runAction.mutate({ url: `/cargos-salarios/movements/${movement.id}/reject`, method: 'PATCH', body: { note: 'Rejeitado pela fila de aprovacoes' } })} disabled={runAction.isPending}>
                        <X className="mr-2 h-4 w-4" />
                        Rejeitar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {(data?.movements ?? []).length === 0 && <EmptyLine />}
          </div>
        </SectionCard>

        <SectionCard title={`Descricoes de cargos (${data?.descriptions.length ?? 0})`}>
          <div className="space-y-2">
            {(data?.descriptions ?? []).map((description) => (
              <div key={description.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{description.jobCatalog?.code} - {description.jobCatalog?.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Versao {description.version} - atualizado em {formatDate(description.updatedAt)}</div>
                  </div>
                  <Badge>{description.status}</Badge>
                </div>
                <div className="mt-3">
                  <Button size="sm" variant="outline" onClick={() => runAction.mutate({ url: `/cargos-salarios/descriptions/${description.id}/status`, method: 'PATCH', body: { status: nextDescriptionStatus(description.status), reason: 'Atualizado pela fila de aprovacoes' } })} disabled={runAction.isPending}>
                    Avancar fluxo
                  </Button>
                </div>
              </div>
            ))}
            {(data?.descriptions ?? []).length === 0 && <EmptyLine />}
          </div>
        </SectionCard>

        <SectionCard title={`Tabelas salariais (${data?.salaryTables.length ?? 0})`}>
          <div className="space-y-2">
            {(data?.salaryTables ?? []).map((table) => (
              <div key={table.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{table.code} - {table.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">v{table.version} - {formatNumber(table.ranges.length)} faixas</div>
                  </div>
                  <Badge>{table.status}</Badge>
                </div>
                <div className="mt-3">
                  <Button size="sm" onClick={() => runAction.mutate({ url: `/cargos-salarios/salary-tables/${table.id}/publish`, method: 'POST' })} disabled={runAction.isPending}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Publicar
                  </Button>
                </div>
              </div>
            ))}
            {(data?.salaryTables ?? []).length === 0 && <EmptyLine />}
          </div>
        </SectionCard>

        <SectionCard title={`Simulacoes (${data?.simulations.length ?? 0})`}>
          <div className="space-y-2">
            {(data?.simulations ?? []).map((simulation) => (
              <div key={simulation.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{simulation.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{simulation.scenarioType} - impacto {formatMoney(simulation.monthlyImpact)}</div>
                  </div>
                  <Badge>{simulation.status}</Badge>
                </div>
                <div className="mt-3">
                  <Button size="sm" variant="outline" onClick={() => runAction.mutate({ url: `/cargos-salarios/simulations/${simulation.id}/approve`, method: 'PATCH' })} disabled={runAction.isPending}>
                    Aprovar simulacao
                  </Button>
                </div>
              </div>
            ))}
            {(data?.simulations ?? []).length === 0 && <EmptyLine />}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function EmptyLine() {
  return <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Nenhum item pendente.</div>;
}

function nextDescriptionStatus(status: string) {
  if (status === 'IN_REVIEW') return 'IN_APPROVAL';
  if (status === 'IN_APPROVAL') return 'APPROVED';
  if (status === 'APPROVED') return 'PUBLISHED';
  return 'IN_APPROVAL';
}

function formatMoney(value: string | number | null) {
  if (value === null || value === undefined) return '-';
  return formatNumber(Number(value), { style: 'currency', currency: 'BRL' });
}
