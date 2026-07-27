'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { EmptyState, RequirementOrigin, StatusLegend, StatusPill } from '@/components/training/training-bits';
import {
  ASSIGNMENT_STATUS,
  OPEN_STATUSES,
  hoursLabel,
  type AssignmentItem,
  type AssignmentStatus,
  type TrainingItem,
} from '@/lib/training/types';

export interface AssignmentFilters {
  search: string;
  status: string;
  trainingId: string;
  orgNodeId: string;
  jobId: string;
  onlyOpen: boolean;
}

const PAGE_SIZE = 50;

/**
 * Tabela da matriz. Matriz e Pendências usam este mesmo componente — muda só o
 * filtro inicial, para não duplicar tela nem consulta.
 */
export function AssignmentTable({
  initial,
  showOpenToggle = true,
  emptyTitle = 'Nenhum registro encontrado para os filtros selecionados.',
}: {
  initial?: Partial<AssignmentFilters>;
  showOpenToggle?: boolean;
  emptyTitle?: string;
}) {
  const [filters, setFilters] = useState<AssignmentFilters>({
    search: '',
    status: '',
    trainingId: '',
    orgNodeId: '',
    jobId: '',
    onlyOpen: false,
    ...initial,
  });
  const [page, setPage] = useState(0);

  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.status) params.set('status', filters.status);
  if (filters.trainingId) params.set('trainingId', filters.trainingId);
  if (filters.orgNodeId) params.set('orgNodeId', filters.orgNodeId);
  if (filters.jobId) params.set('jobId', filters.jobId);
  if (filters.onlyOpen && !filters.status) params.set('onlyOpen', '1');
  params.set('take', String(PAGE_SIZE));
  params.set('skip', String(page * PAGE_SIZE));

  const list = useQuery<{ total: number; items: AssignmentItem[] }>({
    queryKey: ['training-assignments', params.toString()],
    queryFn: () => api(`/training/assignments?${params.toString()}`),
  });
  const trainings = useQuery<TrainingItem[]>({
    queryKey: ['training-catalog-simple'],
    queryFn: () => api('/training/catalog/trainings'),
  });

  const update = (patch: Partial<AssignmentFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(0);
  };

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Colaborador ou matrícula..."
              value={filters.search}
              onChange={(event) => update({ search: event.target.value })}
            />
          </div>
          <NativeSelect value={filters.trainingId} onChange={(event) => update({ trainingId: event.target.value })}>
            <option value="">Todos os treinamentos</option>
            {(trainings.data ?? []).map((training) => (
              <option key={training.id} value={training.id}>
                {training.code} · {training.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect value={filters.status} onChange={(event) => update({ status: event.target.value })}>
            <option value="">Todas as situações</option>
            {(Object.keys(ASSIGNMENT_STATUS) as AssignmentStatus[]).map((status) => (
              <option key={status} value={status}>
                {ASSIGNMENT_STATUS[status].label}
              </option>
            ))}
          </NativeSelect>
          {showOpenToggle && (
            <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 text-sm">
              <input
                type="checkbox"
                checked={filters.onlyOpen}
                onChange={(event) => update({ onlyOpen: event.target.checked })}
                disabled={Boolean(filters.status)}
              />
              Somente em aberto
            </label>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">{list.isLoading ? 'Carregando...' : `${total} registro(s)`}</p>

      {list.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <EmptyState title={emptyTitle} description="Ajuste os filtros ou cadastre exigências para os cargos e áreas." />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Colaborador</th>
                <th className="px-4 py-2.5 text-left font-medium">Cargo / Área</th>
                <th className="px-4 py-2.5 text-left font-medium">Treinamento</th>
                <th className="px-4 py-2.5 text-left font-medium">Origem da exigência</th>
                <th className="px-4 py-2.5 text-left font-medium">Situação</th>
                <th className="px-4 py-2.5 text-left font-medium">Prazo / Validade</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((row) => (
                <tr key={row.id} className="align-top transition-colors hover:bg-muted/40">
                  <td className="px-4 py-2.5">
                    <Link href={`/treinamento/matriz/${row.employeeId}`} className="font-medium hover:underline">
                      {row.employee.name}
                    </Link>
                    {row.employee.registrationId && (
                      <div className="text-[11px] text-muted-foreground">Matrícula {row.employee.registrationId}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    <div>{row.employee.job?.name ?? '—'}</div>
                    <div className="text-[11px]">{row.employee.orgNode?.name ?? 'Sem área'}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{row.training.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {row.training.code} · {hoursLabel(row.training.workloadMinutes)}
                      {!row.mandatory && ' · recomendado'}
                    </div>
                  </td>
                  <td className="max-w-[260px] px-4 py-2.5">
                    <RequirementOrigin origin={row.origin} />
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={row.status} />
                    {row.class && (
                      <div className="mt-1 text-[11px] text-muted-foreground">Turma em {formatDate(row.class.startsAt)}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {row.validUntil ? (
                      <div>Válido até {formatDate(row.validUntil)}</div>
                    ) : row.dueAt ? (
                      <div>Prazo {formatDate(row.dueAt)}</div>
                    ) : (
                      <span>—</span>
                    )}
                    {row.completedAt && <div className="text-[11px]">Realizado em {formatDate(row.completedAt)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
            Anteriores
          </Button>
          <span className="text-xs text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={(page + 1) * PAGE_SIZE >= total}
            onClick={() => setPage((value) => value + 1)}
          >
            Próximos
          </Button>
        </div>
      )}

      {items.length > 0 && <StatusLegend statuses={OPEN_STATUSES.concat('VALID', 'WAIVED')} className="border-t pt-3" />}
    </div>
  );
}
