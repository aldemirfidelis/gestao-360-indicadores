'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReasonDialog, type ReasonDialogState } from '@/components/platform/reason-dialog';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, Play, X } from 'lucide-react';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { MetricCard } from '@/components/platform/metric-card';
import { StatusBadge } from '@/components/platform/status-badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/compensation/format';
import {
  DESCRIPTION_STATUS_LABELS,
  MOVEMENT_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  SIMULATION_STATUS_LABELS,
  TABLE_STATUS_LABELS,
  movementStatusTone,
} from '@/lib/compensation/types';
import { formatDate, formatNumber } from '@/lib/utils';

interface ApprovalsData {
  movements: Array<{ id: string; protocol: string; type: string; reason: string; status: string; monthlyImpact: string | number | null; createdAt: string; approvalSteps?: Array<{ role: string; status: string }> | null }>;
  descriptions: Array<{ id: string; version: number; status: string; updatedAt: string; jobCatalog?: { code: string; name: string } | null }>;
  salaryTables: Array<{ id: string; code: string; name: string; status: string; version: number; ranges: unknown[]; updatedAt: string }>;
  simulations: Array<{ id: string; name: string; scenarioType: string; status: string; monthlyImpact: string | number | null; createdAt: string }>;
}

export default function AprovacoesCargosSalariosPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canMovements = hasPermission(['compensation:movements:approve', 'compensation:manage']);
  const canExecute = hasPermission(['compensation:movements:execute', 'compensation:manage']);
  const canDescriptions = hasPermission(['compensation:descriptions:approve', 'compensation:manage']);
  const canTables = hasPermission(['compensation:salary-table:approve', 'compensation:manage']);
  const canSimulations = hasPermission(['compensation:manage', 'org:positions:manage']);

  const approvalsQuery = useQuery<ApprovalsData>({ queryKey: ['compensation', 'approvals'], queryFn: () => api('/cargos-salarios/approvals') });
  const runAction = useMutation({
    mutationFn: ({ url, method, body }: { url: string; method: 'PATCH' | 'POST'; body?: Record<string, unknown> }) => api(url, { method, json: body ?? {} }),
    onSuccess: () => {
      toast.success('Aprovação atualizada');
      qc.invalidateQueries({ queryKey: ['compensation', 'approvals'] });
      qc.invalidateQueries({ queryKey: ['compensation', 'movements'] });
      qc.invalidateQueries({ queryKey: ['compensation', 'salary-tables'] });
      qc.invalidateQueries({ queryKey: ['compensation', 'simulations'] });
      qc.invalidateQueries({ queryKey: ['compensation', 'descriptions'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao atualizar aprovação'),
  });
  const data = approvalsQuery.data;
  const total = data ? data.movements.length + data.descriptions.length + data.salaryTables.length + data.simulations.length : 0;
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState | null>(null);

  function rejectMovement(id: string) {
    setReasonDialog({
      title: 'Rejeitar movimentação',
      label: 'Motivo da rejeição',
      confirmLabel: 'Rejeitar',
      destructive: true,
      onConfirm: (note) => runAction.mutate({ url: `/cargos-salarios/movements/${id}/reject`, method: 'PATCH', body: { note } }),
    });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Aprovações"
        description="Fila integrada de movimentações, descrições, tabelas salariais e simulações aguardando decisão. Aprovações de posição no organograma e de eficácia ficam na central de Aprovações Gerais."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Aprovações' }]}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/aprovacoes-cargo">Aprovações Gerais (cargo/eficácia)</Link>
          </Button>
        }
      />
      <CompensationModuleNav />

      {approvalsQuery.isLoading && <LoadingState />}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <MetricCard title="Movimentações" value={formatNumber(data.movements.length)} tone="yellow" />
            <MetricCard title="Descrições" value={formatNumber(data.descriptions.length)} tone="blue" />
            <MetricCard title="Tabelas salariais" value={formatNumber(data.salaryTables.length)} tone="purple" />
            <MetricCard title="Simulações" value={formatNumber(data.simulations.length)} tone="green" />
          </div>

          {total === 0 && (
            <EmptyState title="Nada pendente" description="Não há itens aguardando decisão neste momento." />
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {data.movements.length > 0 && (
              <SectionCard title={`Movimentações (${data.movements.length})`}>
                <div className="space-y-2">
                  {data.movements.map((m) => (
                    <div key={m.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">{m.protocol} · {MOVEMENT_TYPE_LABELS[m.type] ?? m.type}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{m.reason} · {formatDate(m.createdAt)}</div>
                          <div className="mt-1 text-xs">Impacto: {formatMoney(m.monthlyImpact)}</div>
                          {m.approvalSteps && m.approvalSteps.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1">
                              {m.approvalSteps.map((step, idx) => (
                                <span
                                  key={`${step.role}-${idx}`}
                                  className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                                    step.status === 'APPROVED'
                                      ? 'bg-status-green/15 text-status-green border-status-green/30'
                                      : step.status === 'REJECTED'
                                        ? 'bg-status-red/15 text-status-red border-status-red/30'
                                        : 'bg-status-yellow/15 text-status-yellow border-status-yellow/30'
                                  }`}
                                  title={step.status}
                                >
                                  {step.role}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <StatusBadge value={m.status} tone={movementStatusTone(m.status)} label={MOVEMENT_STATUS_LABELS[m.status] ?? m.status} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.status === 'APPROVED'
                          ? canExecute && (
                              <Button size="sm" onClick={() => runAction.mutate({ url: `/cargos-salarios/movements/${m.id}/apply`, method: 'PATCH' })} disabled={runAction.isPending}>
                                <Play className="mr-2 h-4 w-4" /> Aplicar
                              </Button>
                            )
                          : canMovements && (
                              <>
                                <Button size="sm" onClick={() => runAction.mutate({ url: `/cargos-salarios/movements/${m.id}/approve`, method: 'PATCH' })} disabled={runAction.isPending}>
                                  <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => rejectMovement(m.id)} disabled={runAction.isPending}>
                                  <X className="mr-2 h-4 w-4" /> Rejeitar
                                </Button>
                              </>
                            )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {data.descriptions.length > 0 && (
              <SectionCard title={`Descrições de cargos (${data.descriptions.length})`}>
                <div className="space-y-2">
                  {data.descriptions.map((d) => (
                    <div key={d.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">{d.jobCatalog?.code} - {d.jobCatalog?.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">Versão {d.version} · atualizado em {formatDate(d.updatedAt)}</div>
                        </div>
                        <StatusBadge value={d.status} label={DESCRIPTION_STATUS_LABELS[d.status] ?? d.status} />
                      </div>
                      {canDescriptions && (
                        <div className="mt-3">
                          <Button size="sm" variant="outline" onClick={() => runAction.mutate({ url: `/cargos-salarios/descriptions/${d.id}/status`, method: 'PATCH', body: { status: nextDescriptionStatus(d.status), reason: 'Avançado pela fila de aprovações' } })} disabled={runAction.isPending}>
                            <ArrowRight className="mr-2 h-4 w-4" /> Avançar fluxo
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {data.salaryTables.length > 0 && (
              <SectionCard title={`Tabelas salariais (${data.salaryTables.length})`}>
                <div className="space-y-2">
                  {data.salaryTables.map((t) => (
                    <div key={t.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">{t.code} - {t.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">v{t.version} · {formatNumber(t.ranges.length)} faixas</div>
                        </div>
                        <StatusBadge value={t.status} label={TABLE_STATUS_LABELS[t.status] ?? t.status} />
                      </div>
                      {canTables && (
                        <div className="mt-3">
                          <Button size="sm" onClick={() => runAction.mutate({ url: `/cargos-salarios/salary-tables/${t.id}/publish`, method: 'POST' })} disabled={runAction.isPending}>
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Publicar
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {data.simulations.length > 0 && (
              <SectionCard title={`Simulações (${data.simulations.length})`}>
                <div className="space-y-2">
                  {data.simulations.map((s) => (
                    <div key={s.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">{s.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{s.scenarioType} · impacto {formatMoney(s.monthlyImpact)}</div>
                        </div>
                        <StatusBadge value={s.status} label={SIMULATION_STATUS_LABELS[s.status] ?? s.status} />
                      </div>
                      {canSimulations && (
                        <div className="mt-3">
                          <Button size="sm" variant="outline" onClick={() => runAction.mutate({ url: `/cargos-salarios/simulations/${s.id}/approve`, method: 'PATCH' })} disabled={runAction.isPending}>
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar simulação
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        </>
      )}
      <ReasonDialog state={reasonDialog} onClose={() => setReasonDialog(null)} />
    </div>
  );
}

function nextDescriptionStatus(status: string) {
  if (status === 'IN_REVIEW') return 'IN_APPROVAL';
  if (status === 'IN_APPROVAL') return 'APPROVED';
  if (status === 'APPROVED') return 'PUBLISHED';
  return 'IN_APPROVAL';
}
