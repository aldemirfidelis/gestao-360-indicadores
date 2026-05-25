'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Calendar, CheckCircle2, LockKeyhole, Plus, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

interface WorkPeriod {
  id: string;
  year: number;
  name: string;
  startsAt: string;
  endsAt: string;
  status: 'OPEN' | 'CLOSED' | 'ARCHIVED';
  isCurrent: boolean;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PeriodsResponse {
  baseYear: number;
  current: WorkPeriod | null;
  periods: WorkPeriod[];
}

interface ClosedMonth {
  id: string;
  periodRef: string;
  reason: string | null;
  closedAt: string;
  closedBy: { id: string; name: string } | null;
  reopenedAt: string | null;
  reopenedBy: { id: string; name: string } | null;
  deletedAt: string | null;
  isClosed: boolean;
}

const statusLabel: Record<WorkPeriod['status'], string> = {
  OPEN: 'Aberto',
  CLOSED: 'Fechado',
  ARCHIVED: 'Arquivado',
};

export default function PeriodsPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [newClosedRef, setNewClosedRef] = useState('');
  const [newClosedReason, setNewClosedReason] = useState('');
  const periods = useQuery<PeriodsResponse>({
    queryKey: ['periods'],
    queryFn: () => api<PeriodsResponse>('/periods'),
  });
  const closedMonths = useQuery<ClosedMonth[]>({
    queryKey: ['closed-months'],
    queryFn: () => api<ClosedMonth[]>('/closed-months'),
  });

  const data = periods.data;
  const ordered = data?.periods ?? [];
  const current = data?.current ?? ordered.find((period) => period.isCurrent) ?? null;
  const selected = ordered.find((period) => period.id === selectedId) ?? current;
  const nextYear = useMemo(() => Math.max(data?.baseYear ? data.baseYear - 1 : 2025, ...ordered.map((period) => period.year)) + 1, [data?.baseYear, ordered]);

  useEffect(() => {
    if (!selectedId && current?.id) setSelectedId(current.id);
  }, [current?.id, selectedId]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['periods'] });

  const setCurrent = useMutation({
    mutationFn: (id: string) => api<WorkPeriod>(`/periods/${id}/current`, { method: 'PATCH' }),
    onSuccess: () => {
      toast.success('Ano de trabalho atualizado');
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível alterar o período'),
  });

  const closePeriod = useMutation({
    mutationFn: (id: string) => api<WorkPeriod>(`/periods/${id}/close`, { method: 'POST' }),
    onSuccess: (next) => {
      toast.success(`Ano fechado. ${next.year} foi aberto automaticamente.`);
      setSelectedId(next.id);
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível fechar o período'),
  });

  const createNext = useMutation({
    mutationFn: () => api<WorkPeriod>('/periods', { method: 'POST', json: { year: nextYear } }),
    onSuccess: (period) => {
      toast.success(`Período ${period.year} criado`);
      setSelectedId(period.id);
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível criar o próximo ano'),
  });

  const closeMonth = useMutation({
    mutationFn: () =>
      api<ClosedMonth>('/closed-months', {
        method: 'POST',
        json: { periodRef: newClosedRef.trim(), reason: newClosedReason.trim() || null },
      }),
    onSuccess: () => {
      toast.success(`Mês ${newClosedRef.trim()} fechado para lançamentos`);
      setNewClosedRef('');
      setNewClosedReason('');
      qc.invalidateQueries({ queryKey: ['closed-months'] });
      qc.invalidateQueries({ queryKey: ['results', 'pending'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível fechar o mes'),
  });

  const reopenMonth = useMutation({
    mutationFn: (id: string) => api<ClosedMonth>(`/closed-months/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Mês reaberto');
      qc.invalidateQueries({ queryKey: ['closed-months'] });
      qc.invalidateQueries({ queryKey: ['results', 'pending'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível reabrir o mes'),
  });

  const handleClose = (period: WorkPeriod) => {
    const confirmed = window.confirm(`Fechar o ano ${period.year}? O sistema abrira automaticamente ${period.year + 1} de 01/01/${period.year + 1} a 31/12/${period.year + 1}.`);
    if (confirmed) closePeriod.mutate(period.id);
  };

  if (periods.isLoading) return <LoadingState label="Carregando períodos..." />;

  return (
    <div>
      <PageHeader
        eyebrow="Gestão"
        tone="admin"
        title="Períodos de trabalho"
        description="Defina o ano vigente para metas, lançamentos, resultados e análises do sistema."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Gestão' }, { label: 'Períodos' }]}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">Ano vigente</div>
            <Calendar className="h-4 w-4 text-status-blue" />
          </div>
          <div className="mt-3 text-3xl font-semibold">{current?.year ?? '-'}</div>
          <div className="mt-1 text-xs text-muted-foreground">{current ? `${formatDate(current.startsAt)} a ${formatDate(current.endsAt)}` : 'Nenhum período aberto'}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Períodos cadastrados</div>
          <div className="mt-3 text-3xl font-semibold">{ordered.length}</div>
          <div className="mt-1 text-xs text-muted-foreground">A partir de {data?.baseYear ?? 2026}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Anos fechados</div>
          <div className="mt-3 text-3xl font-semibold">{ordered.filter((period) => period.status === 'CLOSED').length}</div>
          <div className="mt-1 text-xs text-muted-foreground">Histórico protegido</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Próximo ano</div>
          <div className="mt-3 text-3xl font-semibold">{nextYear}</div>
          <div className="mt-1 text-xs text-muted-foreground">Criado automaticamente ao fechar</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px,1fr]">
        <SectionCard
          title="Ano de trabalho"
          description="Escolha o exercício usado como referência operacional."
          actions={
            <Button variant="outline" size="sm" onClick={() => periods.refetch()} disabled={periods.isFetching}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          }
        >
          {ordered.length === 0 && <EmptyState title="Nenhum período cadastrado" description="O sistema cria 2026 automaticamente no primeiro carregamento." />}
          {ordered.length > 0 && (
            <div className="space-y-4">
              <NativeSelect value={selected?.id ?? ''} onChange={(event) => setSelectedId(event.target.value)}>
                {ordered.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.year} - {period.isCurrent ? 'vigente' : statusLabel[period.status]}
                  </option>
                ))}
              </NativeSelect>

              {selected && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">{selected.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(selected.startsAt)} a {formatDate(selected.endsAt)}
                      </div>
                    </div>
                    <PeriodBadge period={selected} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <Info label="Início" value={formatDate(selected.startsAt)} />
                    <Info label="Fim" value={formatDate(selected.endsAt)} />
                    <Info label="Status" value={selected.isCurrent ? 'Vigente' : statusLabel[selected.status]} />
                    <Info label="Fechado em" value={formatDate(selected.closedAt)} />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={selected.isCurrent || selected.status !== 'OPEN' || setCurrent.isPending}
                      onClick={() => setCurrent.mutate(selected.id)}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Usar este ano
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={selected.status !== 'OPEN' || closePeriod.isPending}
                      onClick={() => handleClose(selected)}
                    >
                      <LockKeyhole className="mr-2 h-4 w-4" />
                      Fechar ano
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Calendario anual"
          description="Cada período anual sempre cobre 01/01 a 31/12 do respectivo ano."
          actions={
            <Button variant="outline" size="sm" onClick={() => createNext.mutate()} disabled={createNext.isPending}>
              <Plus className="mr-2 h-4 w-4" />
              Criar {nextYear}
            </Button>
          }
          contentClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Ano</th>
                  <th className="px-4 py-3 text-left">Início</th>
                  <th className="px-4 py-3 text-left">Fim</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((period) => (
                  <tr key={period.id} className={cn('border-t', period.isCurrent && 'bg-status-blue/5')}>
                    <td className="px-4 py-3 font-semibold">{period.year}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(period.startsAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(period.endsAt)}</td>
                    <td className="px-4 py-3"><PeriodBadge period={period} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={period.isCurrent || period.status !== 'OPEN' || setCurrent.isPending}
                          onClick={() => setCurrent.mutate(period.id)}
                        >
                          Usar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={period.status !== 'OPEN' || closePeriod.isPending}
                          onClick={() => handleClose(period)}
                        >
                          Fechar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard
          title="Bloqueio de lançamento por mes"
          description="Mês fechado impede o lançamento ou alteração de realizado por todas as áreas. Reabertura sempre disponível ao admin."
        >
          <div className="grid gap-4 md:grid-cols-[1fr,1fr,auto]">
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Período (YYYY-MM)</label>
              <input
                value={newClosedRef}
                onChange={(e) => setNewClosedRef(e.target.value)}
                placeholder="2026-05"
                className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Motivo (opcional)</label>
              <input
                value={newClosedReason}
                onChange={(e) => setNewClosedReason(e.target.value)}
                placeholder="Ex.: fechamento contábil"
                className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => closeMonth.mutate()}
                disabled={!newClosedRef.trim() || closeMonth.isPending}
              >
                <LockKeyhole className="mr-2 h-4 w-4" />
                Fechar mes
              </Button>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Período</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Motivo</th>
                  <th className="px-4 py-3 text-left">Fechado por</th>
                  <th className="px-4 py-3 text-left">Reaberto por</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(closedMonths.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Nenhum mes fechado ate o momento.
                    </td>
                  </tr>
                )}
                {(closedMonths.data ?? []).map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{row.periodRef}</td>
                    <td className="px-4 py-3">
                      {row.isClosed ? (
                        <Badge variant="secondary">Fechado</Badge>
                      ) : (
                        <Badge variant="outline" className="border-status-green text-status-green">
                          Reaberto
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.reason ?? '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.closedBy?.name ?? '-'}
                      <div className="text-xs">{formatDate(row.closedAt)}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.reopenedBy?.name ?? '-'}
                      <div className="text-xs">{row.reopenedAt ? formatDate(row.reopenedAt) : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.isClosed && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reopenMonth.isPending}
                          onClick={() => reopenMonth.mutate(row.id)}
                        >
                          Reabrir
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function PeriodBadge({ period }: { period: WorkPeriod }) {
  if (period.isCurrent) return <Badge className="bg-status-blue text-white">Vigente</Badge>;
  if (period.status === 'CLOSED') return <Badge variant="secondary">Fechado</Badge>;
  if (period.status === 'ARCHIVED') return <Badge variant="outline">Arquivado</Badge>;
  return <Badge variant="outline" className="border-status-green text-status-green">Aberto</Badge>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
